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
import type { Rng } from '../../core/rng.ts';
import type { TeamOrders } from '../model.ts';
import {
  attackKind,
  elementMultiplier,
  hasEffect,
  hitChance,
  hpFraction,
  mitigation,
  rawDamage,
  resolveElement,
  staminaCost,
  staminaFraction,
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
  /** Fraction by which the creature's team trails on health (0 if ahead). */
  behind(c: Combatant): number;
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

/** Enemies this ability can reach, with a flank flag for skirmishers hitting the back line. */
export function reachableTargets(actor: Combatant, ability: AbilityDef, enemies: Combatant[]): { target: Combatant; flank: boolean }[] {
  if (attackKind(ability) !== 'melee' || ability.reachBack || actor.flying) {
    return enemies.map((target) => ({ target, flank: false }));
  }
  const front = enemies.filter((e) => e.line === 'front');
  if (!front.length) return enemies.map((target) => ({ target, flank: false }));
  if (actor.role === 'skirmisher') {
    return enemies.map((target) => ({ target, flank: target.line === 'back' }));
  }
  return front.map((target) => ({ target, flank: false }));
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
  const raw = rawDamage(actor, ability, { orders, behind: ctx.behind(actor), solo: !ctx.comboOn(actor, target) }, cfg);
  const trueMult = elementMultiplier(resolveElement(ability.element, actor), target.elements, cfg);
  // A creature only "sees" type matchups in proportion to its tactical sense.
  const awareness = (actor.attrs.tactics / 20) * cfg.combat.ai.elementAwareness;
  const perceivedMult = 1 + (trueMult - 1) * awareness;
  const mit = mitigation(target, attackKind(ability), ctx.orders(target), cfg);
  const p = hitChance(actor, target, ability, { flank, combo: ctx.comboOn(actor, target), orders }, cfg);
  return raw * perceivedMult * (1 - mit) * p;
}

function effectValue(ability: AbilityDef, targets: Combatant[]): number {
  let v = 0;
  for (const ref of ability.effects ?? []) {
    if (ref.on !== 'target') continue;
    for (const t of targets) if (!hasEffect(t, ref.effect)) v += ref.chance * 0.15;
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
  const riskBias =
    orders.risk === 'high' ? cfg.combat.orders.riskHigh.bigAbilityBias : orders.risk === 'low' ? cfg.combat.orders.riskLow.bigAbilityBias : 0;

  for (const id of actor.abilities) {
    const ability = ABILITIES[id];
    if (!ability) continue;
    if ((actor.cooldowns[id] ?? 0) > 0) continue;
    const cost = staminaCost(actor, ability, orders, cfg);
    if (cost > actor.stamina) continue;
    let bigMult = 1;
    if (actor.favorites.includes(id)) {
      const f = cfg.combat.favorites;
      bigMult *= 1 + f.bonus * (0.4 + (0.6 * actor.attrs.discipline) / 20);
    }
    if (ability.staminaCost >= 12) {
      bigMult += riskBias;
      if (actor.stance === 'conserve') bigMult *= 0.7;
      if (actor.stance === 'allOut') bigMult *= 1.2;
      // Don't burn the last of the energy on a big move unless willing to risk it.
      if (stFrac < 0.4 && orders.risk !== 'high') bigMult *= 0.7;
    }

    const damaging = ability.power > 0 && (ability.kind === 'melee' || ability.kind === 'ranged' || ability.kind === 'spell' || ability.kind === 'debuff');

    if (ability.target === 'enemy') {
      for (const { target, flank } of reachableTargets(actor, ability, enemies)) {
        let score = 0;
        if (damaging) {
          const exp = expectedDamage(ctx, actor, ability, target, flank);
          score += (exp / target.maxHp) * 3 * role.damage;
          if (exp >= target.hp) score += ai.killBonus;
        }
        if (ability.kind === 'debuff') score += effectValue(ability, [target]) * role.debuff * 2 + (ability.fear ?? 0) * 0.01 * role.debuff;
        else score += effectValue(ability, [target]) * Math.max(role.debuff, 0.5);
        score += priorityMatch(opts.priority, target, enemies) * ai.priorityBonus;
        if (target.line === 'back') score += role.backlineHunter * 0.12;
        options.push({ type: 'ability', ability, target, flank, score: score * bigMult });
      }
    } else if (ability.target === 'enemyFront' || ability.target === 'allEnemies') {
      const front = enemies.filter((e) => e.line === 'front');
      const targets = ability.target === 'allEnemies' || !front.length ? enemies : front;
      if (!targets.length) continue;
      let score = 0;
      for (const t of targets) {
        if (damaging) {
          const exp = expectedDamage(ctx, actor, ability, t, false);
          score += (exp / t.maxHp) * 3 * role.damage;
          if (exp >= t.hp) score += ai.killBonus * 0.7;
        }
        score += (ability.fear ?? 0) * 0.008 * role.debuff;
      }
      score += effectValue(ability, targets) * Math.max(role.debuff, 0.5);
      options.push({ type: 'ability', ability, target: null, flank: false, score: score * bigMult });
    } else if (ability.kind === 'heal') {
      const candidates = ability.target === 'allAllies' ? [null] : allies;
      for (const t of candidates) {
        const hurt = t ? [t] : allies;
        const missing = hurt.reduce((s, a) => s + (1 - hpFraction(a)), 0);
        const worst = Math.max(...hurt.map((a) => 1 - hpFraction(a)));
        if (worst < 0.25) continue;
        const score = missing * 1.6 * role.heal * (t ? 1 : 0.6);
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
        if (effectId === 'enraged') score += 0.3 * role.damage * (0.5 + hurt);
        if (effectId === 'fortified') score += 0.3 * role.guard * (0.3 + hurt);
        if (effectId === 'evasive') score += 0.3 * (0.3 + hurt);
        options.push({ type: 'ability', ability, target: actor, flank: false, score: score * bigMult });
      } else if (ability.target === 'allAllies') {
        const without = allies.filter((a) => !effectId || !hasEffect(a, effectId)).length;
        if (without < 2) continue;
        options.push({ type: 'ability', ability, target: null, flank: false, score: 0.14 * without * role.buff * bigMult });
      } else {
        for (const t of allies) {
          if (effectId && hasEffect(t, effectId)) continue;
          const exposure = t.line === 'front' ? 1 : 0.5;
          const score = (0.25 + (1 - hpFraction(t)) * 0.6) * exposure * role.buff;
          options.push({ type: 'ability', ability, target: t, flank: false, score: score * bigMult });
        }
      }
    } else if (ability.kind === 'debuff') {
      // Non-damaging debuffs on all enemies (roars, screeches).
      const score = enemies.length * ((ability.fear ?? 0) * 0.01 + 0.1) * role.debuff + effectValue(ability, enemies) * role.debuff;
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
