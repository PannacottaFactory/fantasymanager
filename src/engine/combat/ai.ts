/**
 * Combat AI: picks an action for a creature by scoring every option.
 * Personality matters: low tactics → noisy choices and blindness to type matchups;
 * role weights → tanks guard, supports heal, skirmishers hunt the back line.
 */
import { ABILITIES } from '../../data/abilities.ts';
import { EFFECTS } from '../../data/effects.ts';
import { ROLES } from '../../data/roles.ts';
import { TRAITS } from '../../data/traits.ts';
import type { GameConfig } from '../../data/config/index.ts';
import type { AbilityDef, TargetPriority } from '../../data/schema.ts';
import type { ArenaCondition } from '../../data/config/arena.ts';
import type { Rng } from '../../core/rng.ts';
import type { TeamOrders } from '../model.ts';
import {
  attackKind,
  effectMod,
  effectStacks,
  coverMult,
  executeMult,
  lineTargets,
  packMult,
  elementMultiplier,
  hasEffect,
  hasEffectFlag,
  isSilenceable,
  arenaCostMult,
  arenaElementMult,
  isCleansable,
  hitChance,
  hpFraction,
  mitigation,
  rawDamage,
  resolveElement,
  staminaCost,
  staminaFraction,
  staminaRegen,
} from './formulas.ts';
import type { Combatant } from './types.ts';

export type ChosenAction =
  | { type: 'ability'; ability: AbilityDef; target: Combatant | null; flank: boolean; score: number }
  | { type: 'guard'; score: number }
  | { type: 'rest'; score: number };

export interface AiContext {
  cfg: GameConfig;
  rng: Rng;
  allies(c: Combatant): Combatant[];
  enemies(c: Combatant): Combatant[];
  orders(c: Combatant): TeamOrders;
  /** Has an ally of `attacker` already hit `target` this round? */
  comboOn(attacker: Combatant, target: Combatant): boolean;
  /** How many allies of `attacker` already hit `target` this round. */
  alliesOn(attacker: Combatant, target: Combatant): number;
  /** Fraction by which the creature's team trails on health (0 if ahead). */
  behind(c: Combatant): number;
  /** Cover points of a side's front line (creatures standing in it, tanks count more). */
  coverPoints(side: Combatant['side']): number;
  /** Arena condition of the match (weather), if any. */
  arena?: ArenaCondition;
}

export interface ChooseOptions {
  priority: TargetPriority;
  /** Disable randomness (used to know what the orders "wanted"). */
  deterministic?: boolean;
  /** Enraged creatures neither rest nor guard. */
  attackOnly?: boolean;
}

/** Target preference when a creature acts on instinct rather than orders. */
export function instinctPriority(c: Combatant): TargetPriority {
  for (const t of c.traits) {
    const p = TRAITS[t]?.combat?.instinctTarget;
    if (p) return p;
  }
  if (c.attrs.aggression >= 14) return 'threat';
  if (c.attrs.tactics >= 14) return 'weakest';
  return 'nearest';
}

/**
 * Enemies this ability can reach, with a flank flag for melee strikes on the back line past a standing front line
 * (an accuracy penalty: small for skirmishers, large for anyone else).
 */
export function reachableTargets(actor: Combatant, ability: AbilityDef, enemies: Combatant[]): { target: Combatant; flank: boolean }[] {
  if (attackKind(ability) !== 'melee' || ability.reachBack || actor.flying) {
    return enemies.map((target) => ({ target, flank: false }));
  }
  const front = enemies.filter((e) => e.line === 'front');
  if (!front.length) return enemies.map((target) => ({ target, flank: false }));
  return enemies.map((target) => ({ target, flank: target.line === 'back' }));
}

/**
 * Enemies a single-target hostile ability may pick: camouflaged ones are out of sight (unless every enemy is),
 * and a provoking enemy within reach draws every such blow.
 */
export function pickableTargets(options: { target: Combatant; flank: boolean }[]): { target: Combatant; flank: boolean }[] {
  const seen = options.filter((o) => !hasEffectFlag(o.target, 'hidden'));
  const visible = seen.length ? seen : options;
  const taunting = visible.filter((o) => hasEffectFlag(o.target, 'taunt'));
  return taunting.length ? taunting : visible;
}

/** Bonus factor (0–1) for how well a target matches the given priority. */
export function priorityMatch(priority: TargetPriority, target: Combatant, enemies: Combatant[]): number {
  switch (priority) {
    case 'nearest':
      return target.line === 'front' ? 1 : 0;
    case 'casters':
      return target.role === 'caster' || target.role === 'support' ? 1 : target.line === 'back' ? 0.5 : 0;
    case 'weakest': {
      const min = Math.min(...enemies.map((e) => e.hp));
      return target.hp === min ? 1 : 0;
    }
    case 'strongest': {
      const max = Math.max(...enemies.map((e) => e.ability));
      return target.ability === max ? 1 : 0;
    }
    case 'threat': {
      const max = Math.max(...enemies.map((e) => e.damageDealt));
      if (max <= 0) {
        const maxA = Math.max(...enemies.map((e) => e.ability));
        return target.ability === maxA ? 1 : 0;
      }
      return target.damageDealt === max ? 1 : 0;
    }
  }
}

/** Expected damage of an ability on a target, as the attacker perceives it. */
export function expectedDamage(ctx: AiContext, actor: Combatant, ability: AbilityDef, target: Combatant, flank: boolean): number {
  const { cfg } = ctx;
  const orders = ctx.orders(actor);
  const raw = rawDamage(actor, ability, { orders, foeOrders: ctx.orders(target), behind: ctx.behind(actor), solo: !ctx.comboOn(actor, target) }, cfg);
  const trueMult = elementMultiplier(resolveElement(ability.element, actor), target.elements, cfg);
  // A creature only "sees" type matchups in proportion to its tactical sense.
  const awareness = (actor.attrs.tactics / 20) * cfg.combat.ai.elementAwareness;
  const perceivedMult = 1 + (trueMult - 1) * awareness;
  const mit = mitigation(target, attackKind(ability), ctx.orders(target), cfg);
  const p = hitChance(actor, target, ability, { flank, combo: ctx.comboOn(actor, target), orders, foeOrders: ctx.orders(target) }, cfg);
  const pack = packMult(ability, ctx.alliesOn(actor, target), cfg);
  const cover = coverMult(attackKind(ability), target, ctx.coverPoints(target.side), cfg);
  // The weather is plain to see: everyone takes it into account.
  const kind = attackKind(ability);
  const weather = arenaElementMult(ctx.arena, resolveElement(ability.element, actor)) * (ctx.arena?.kinds?.[kind] ?? 1);
  const arenaHit = kind === 'ranged' ? (ctx.arena?.rangedHit ?? 0) : kind === 'melee' ? (ctx.arena?.meleeHit ?? 0) : 0;
  const hit = arenaHit ? Math.max(0.05, p + arenaHit) : p;
  return raw * perceivedMult * weather * executeMult(ability, target, cfg) * pack * cover * (1 - mit) * hit * (ability.hits ?? 1);
}

/** How much one more application of an effect is worth on a target (0 = useless). */
function effectGain(effectId: string, t: Combatant, foeHealers: boolean): number {
  const def = EFFECTS[effectId];
  if (!def) return 0;
  const stacks = effectStacks(t, effectId);
  if (def.onMaxStacks && hasEffect(t, def.onMaxStacks)) return 0;
  // Curses last until the break: worth more early in the period. A stun takes a whole turn away.
  let weight = def.curse ? 1.5 : def.kind === 'stun' ? 3 : 1;
  // Cutting healing only matters against a side that heals; a silence only against spells and heals.
  if (def.mods?.healingTaken !== undefined && !foeHealers) weight *= 0.1;
  if (def.silence && !t.abilities.some((id) => { const ab = ABILITIES[id]; return !!ab && isSilenceable(ab); })) weight *= 0.1;
  if (!stacks) return weight;
  if (!def.maxStacks || stacks >= def.maxStacks) return 0;
  // A charge closer to a freeze is worth more; poison doses keep their value.
  return def.onMaxStacks ? 1 + stacks * 0.6 : 0.9;
}

/** Does the side of these creatures have a healer standing? (healing cuts are only worth it then) */
function sideHeals(targets: Combatant[], all: Combatant[]): boolean {
  const side = targets[0]?.side;
  return all.some((c) => c.side === side && c.abilities.some((id) => ABILITIES[id]?.kind === 'heal'));
}

function effectValue(ability: AbilityDef, targets: Combatant[], foes: Combatant[] = targets): number {
  let v = 0;
  const heals = sideHeals(targets, foes);
  for (const ref of ability.effects ?? []) {
    if (ref.on !== 'target') continue;
    for (const t of targets) v += ref.chance * 0.15 * effectGain(ref.effect, t, heals) * Math.min(2, ref.stacks ?? 1);
  }
  return v;
}

/** Stamina drained matters most against creatures low on stamina. */
function drainValue(ability: AbilityDef, targets: Combatant[]): number {
  if (!ability.staminaDrain) return 0;
  let v = 0;
  for (const t of targets) v += Math.min(1, ability.staminaDrain / Math.max(1, t.stamina)) * 0.25;
  return v;
}

/** A heal also stops bleeding. */
function bleedValue(t: Combatant): number {
  let v = 0;
  for (const e of t.effects) if (EFFECTS[e.id]?.endsOnHeal) v += 0.12 * (e.stacks ?? 1);
  return v;
}

/** Value of purifying an ally: poison doses, chill charges, stuns weigh most. */
export function cleanseValue(t: Combatant): number {
  let v = 0;
  for (const e of t.effects) {
    if (!isCleansable(e.id, e.remaining)) continue;
    const def = EFFECTS[e.id]!;
    if (def.kind === 'dot') v += 0.12 * (e.stacks ?? 1);
    else if (def.kind === 'stun') v += 0.3;
    // A charge of cold short of a freeze is worth clearing now.
    else if (def.onMaxStacks) v += 0.15 * (e.stacks ?? 1) * (e.stacks ?? 1);
    else v += 0.1;
  }
  return v;
}

export function chooseAction(ctx: AiContext, actor: Combatant, opts: ChooseOptions): ChosenAction {
  const { cfg, rng } = ctx;
  const ai = cfg.combat.ai;
  const role = ROLES[actor.role].ai;
  const orders = ctx.orders(actor);
  const enemies = ctx.enemies(actor);
  const allies = ctx.allies(actor);
  const options: ChosenAction[] = [];
  const stFrac = staminaFraction(actor);
  const silenced = hasEffectFlag(actor, 'silence');

  for (const id of actor.abilities) {
    const ability = ABILITIES[id];
    if (!ability) continue;
    if ((actor.cooldowns[id] ?? 0) > 0) continue;
    const cost = staminaCost(actor, ability, orders, cfg) * arenaCostMult(ctx.arena);
    if (cost > actor.stamina) continue;
    // Silenced: no spells, no heals.
    if (silenced && isSilenceable(ability)) continue;
    let bigMult = ability.aiWeight ?? 1;
    if (ability.hpCost) {
      // Sacrifice: never at death's door, and less eagerly the more it costs.
      const hp = hpFraction(actor);
      if (hp < ability.hpCost + 0.2) continue;
      bigMult *= 1 - ability.hpCost * (1.5 - hp);
    }
    if (actor.favorites.includes(id)) {
      const f = cfg.combat.favorites;
      bigMult *= 1 + f.bonus * (0.4 + (0.6 * actor.attrs.discipline) / 20);
    }
    if (ability.staminaCost >= 12) {
      if (actor.stance === 'conserve') bigMult *= 0.7;
      if (actor.stance === 'allOut') bigMult *= 1.2;
      // Don't burn the last of the energy on a big move.
      if (stFrac < 0.4) bigMult *= 0.7;
    }

    const damaging = ability.power > 0 && (ability.kind === 'melee' || ability.kind === 'ranged' || ability.kind === 'spell' || ability.kind === 'debuff');

    if (ability.target === 'enemy') {
      for (const { target, flank } of pickableTargets(reachableTargets(actor, ability, enemies))) {
        let score = 0;
        if (damaging) {
          const exp = expectedDamage(ctx, actor, ability, target, flank);
          score += (exp / target.maxHp) * 3 * role.damage;
          if (exp >= target.hp) score += ai.killBonus;
        }
        // Control without damage is weighed against the attack it replaces (`debuffWeight`).
        const control = damaging ? 1 : ai.debuffWeight;
        if (ability.kind === 'debuff') score += (effectValue(ability, [target], enemies) * role.debuff * 2 + (ability.fear ?? 0) * 0.01 * role.debuff) * control;
        else score += effectValue(ability, [target], enemies) * Math.max(role.debuff, 0.5);
        score += drainValue(ability, [target]) * Math.max(role.debuff, 0.5) * control;
        // Thorns hurt whoever strikes them in melee, mirrors whoever casts at them (seen in proportion to tactics).
        const thorns = attackKind(ability) === 'melee' ? effectMod(target, 'thorns') : attackKind(ability) === 'spell' ? effectMod(target, 'spellReflect') : 0;
        if (thorns > 0 && damaging) score -= ((expectedDamage(ctx, actor, ability, target, flank) * thorns) / actor.maxHp) * 3 * (actor.attrs.tactics / 20);
        // Forcing a way past a standing front line is costly for anyone but a skirmisher: the target priority only
        // pulls them there when it is really worth it.
        const reach = flank && actor.role !== 'skirmisher' ? ai.reachPriority : 1;
        // The priority says whom to hit: a curse or a snare only keeps part of it.
        score += priorityMatch(opts.priority, target, enemies) * ai.priorityBonus * reach * (damaging ? 1 : ai.debuffPriority);
        // Pack hunters converge on prey their allies are already biting.
        if (ability.pack) score += Math.min(ctx.alliesOn(actor, target), cfg.combat.damage.packMax) * ability.pack * 2;
        if (target.line === 'back') score += role.backlineHunter * 0.12;
        options.push({ type: 'ability', ability, target, flank, score: score * bigMult });
      }
    } else if (ability.target === 'enemyFront' || ability.target === 'enemyBack' || ability.target === 'allEnemies') {
      const targets = lineTargets(ability.target, enemies);
      if (!targets.length) continue;
      if (!damaging) {
        // Cries and auras that only shake or weaken (no damage): weighed by `cryWeight` against the attack they replace.
        const w = Math.max(role.debuff, 0.9) * ai.cryWeight;
        const score = targets.length * ((ability.fear ?? 0) * 0.012 + 0.12) * w + effectValue(ability, targets, enemies) * w * 1.5 + drainValue(ability, targets) * w;
        options.push({ type: 'ability', ability, target: null, flank: false, score: score * bigMult });
        continue;
      }
      let score = 0;
      for (const t of targets) {
        if (damaging) {
          const exp = expectedDamage(ctx, actor, ability, t, false);
          score += (exp / t.maxHp) * 3 * role.damage;
          if (exp >= t.hp) score += ai.killBonus * 0.7;
        }
        score += (ability.fear ?? 0) * 0.008 * role.debuff;
      }
      // An area attack that catches the priority target serves the orders too (it used to get no priority bonus at all,
      // so a plain blow on the priority target nearly always beat a breath over the whole line).
      score += Math.max(0, ...targets.map((t) => priorityMatch(opts.priority, t, enemies))) * ai.priorityBonus;
      score += effectValue(ability, targets, enemies) * Math.max(role.debuff, 0.5);
      score += drainValue(ability, targets) * Math.max(role.debuff, 0.5);
      options.push({ type: 'ability', ability, target: null, flank: false, score: score * bigMult });
    } else if (ability.kind === 'heal') {
      // A sacrifice heal is for others.
      const candidates = ability.target === 'allAllies' ? [null] : ability.hpCost ? allies.filter((a) => a.id !== actor.id) : allies;
      for (const t of candidates) {
        const hurt = t ? [t] : allies;
        const missing = hurt.reduce((s, a) => s + (1 - hpFraction(a)), 0);
        const worst = Math.max(...hurt.map((a) => 1 - hpFraction(a)));
        const purge = (ability.cleanse ? hurt.reduce((s, a) => s + cleanseValue(a), 0) : 0) + hurt.reduce((s, a) => s + bleedValue(a), 0);
        if (worst < 0.25 && purge < 0.2) continue;
        const score = (missing * 1.6 + purge * 1.5) * role.heal * (t ? 1 : 0.6);
        options.push({ type: 'ability', ability, target: t, flank: false, score: score * bigMult });
      }
    } else if (ability.kind === 'buff') {
      const effectId = ability.effects?.[0]?.effect;
      if (ability.target === 'self') {
        if (effectId && hasEffect(actor, effectId)) continue;
        // Rampage-style self buffs are worth more when there is fighting to do.
        // Defensive self-buffs matter more once the creature is taking a beating.
        const hurt = 1 - hpFraction(actor);
        let score = 0.2 * role.buff;
        if (effectId === 'enraged') score += 0.5 * role.damage * (0.5 + hurt);
        if (effectId === 'fortified') score += 0.3 * role.guard * (0.3 + hurt);
        // Dodging is worth it under fire: in the front line, or once wounded.
        if (effectId === 'evasive') score += 0.8 * (0.4 + hurt) * (actor.line === 'front' ? 1.2 : 0.8);
        // A stance that sets up one heavy blow (spent by the next attack).
        if (effectId === 'poised') score += 0.6 * role.damage * (0.8 + hurt);
        // Frenzy grows with the wounds: worth it once hurt.
        if (effectId === 'frenzied') score += 0.35 * role.damage * (0.2 + 1.5 * hurt);
        if (effectId === 'shielded') score += 0.3 * role.guard * (0.3 + hurt);
        // Slipping out of sight sets up a big blow; provoking protects the back line.
        if (effectId === 'camouflaged') score += 0.5 * role.damage * (0.6 + hurt);
        if (effectId === 'provoking') {
          const back = allies.filter((a) => a.line === 'back' && a.id !== actor.id).length;
          score += role.guard * (back ? 0.25 + 0.08 * back : 0.05) * (1.2 - hurt);
        }
        options.push({ type: 'ability', ability, target: actor, flank: false, score: score * bigMult });
      } else if (ability.target === 'allAllies') {
        const without = allies.filter((a) => !effectId || !hasEffect(a, effectId)).length;
        if (without < 2) continue;
        // Lifting the whole side is worth it whatever the caster's role.
        options.push({ type: 'ability', ability, target: null, flank: false, score: 0.22 * without * Math.max(role.buff, 0.8) * bigMult });
      } else {
        const def = effectId ? EFFECTS[effectId] : undefined;
        // A spell mirror only pays against spellcasters.
        const casters = enemies.filter((e) => e.abilities.some((id) => ABILITIES[id]?.kind === 'spell')).length;
        for (const t of allies) {
          if (effectId && hasEffect(t, effectId)) continue;
          const exposure = t.line === 'front' ? 1 : 0.5;
          let score = (0.25 + (1 - hpFraction(t)) * 0.6) * exposure;
          // A fury or a boost to hit harder goes to the ally who hits hardest.
          if ((def?.mods?.damageMult ?? 1) > 1) score = 0.25 + 0.3 * ROLES[t.role].ai.damage;
          if (def?.mods?.spellReflect) score *= casters ? 0.6 + 0.3 * casters : 0.1;
          options.push({ type: 'ability', ability, target: t, flank: false, score: score * Math.max(role.buff, 0.8) * bigMult });
        }
      }
    } else if (ability.kind === 'debuff') {
      // Non-damaging debuffs on all enemies (roars, screeches).
      // Shaking or weakening every foe at once is worth it whatever the caster's role.
      const w = Math.max(role.debuff, 0.9) * ai.debuffWeight;
      const score = enemies.length * ((ability.fear ?? 0) * 0.012 + 0.12) * w + effectValue(ability, enemies) * w * 1.5;
      options.push({ type: 'ability', ability, target: null, flank: false, score: score * bigMult });
    }
  }

  if (!opts.attackOnly) {
    // Guard: protect back-line allies (tanks especially).
    if (actor.line === 'front' && role.guard > 0 && actor.stamina >= cfg.combat.guard.staminaCost) {
      const backAllies = allies.filter((a) => a.line === 'back' && a.id !== actor.id).length;
      const score = role.guard * (backAllies ? 0.28 + 0.06 * backAllies : 0.1);
      options.push({ type: 'guard', score });
    }
    // Rest: recover stamina.
    let rest = 0;
    if (stFrac < ai.restBelow) rest = ai.restWeight * ((ai.restBelow - stFrac) / ai.restBelow) + 0.15;
    rest += cfg.combat.orders[orders.aggression].restBias * (1 - stFrac);
    if (actor.stance === 'conserve') rest += 0.2 * (1 - stFrac);
    if (actor.stance === 'allOut') rest -= 0.2;
    options.push({ type: 'rest', score: Math.max(0.01, rest) });
  }

  if (!options.length) return { type: 'rest', score: 0 };

  // Stamina kept for a big ability coming back (ready now or next round): a cheaper action that would leave too little
  // to cast it next round is worth less, so the creature does not fritter away its breath on small blows.
  if (ai.staminaReserve < 1) {
    let reserve = 0;
    for (const id of actor.abilities) {
      const ab = ABILITIES[id];
      if (!ab || ab.staminaCost < ai.reserveMinCost || (actor.cooldowns[id] ?? 0) > 1) continue;
      if (silenced && isSilenceable(ab)) continue;
      reserve = Math.max(reserve, staminaCost(actor, ab, orders, cfg) * arenaCostMult(ctx.arena));
    }
    const next = actor.stamina + staminaRegen(actor, cfg) * (ctx.arena?.staminaRegen ?? 1);
    if (reserve > 0 && next >= reserve) {
      for (const o of options) {
        if (o.type !== 'ability') continue;
        const c = staminaCost(actor, o.ability, orders, cfg) * arenaCostMult(ctx.arena);
        if (c < reserve && next - c < reserve) o.score *= ai.staminaReserve;
      }
    }
  }

  const noise = opts.deterministic ? 0 : (1 - actor.attrs.tactics / 20) * ai.noiseMax;
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const o of options) {
    const s = noise > 0 ? o.score * (1 + rng.normal(0, noise)) : o.score;
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}

export function isEffectBeneficial(id: string): boolean {
  return EFFECTS[id]?.beneficial ?? false;
}
