/**
 * Pure combat formulas. Every number comes from GameConfig; these functions only combine them.
 */
import type { ArenaCondition } from '../../data/config/arena.ts';
import { clamp } from '../../core/math.ts';
import { EFFECTS } from '../../data/effects.ts';
import { TRAITS } from '../../data/traits.ts';
import type { GameConfig } from '../../data/config/index.ts';
import type { AbilityDef, DamageElement, EffectMods, ElementId, TraitCombatEffects } from '../../data/schema.ts';
import type { TeamOrders } from '../model.ts';
import type { AttackKind, Combatant } from './types.ts';

export function attackKind(ability: AbilityDef): AttackKind {
  if (ability.kind === 'melee') return 'melee';
  if (ability.kind === 'ranged') return 'ranged';
  return 'spell';
}

export function resolveElement(element: DamageElement, user: Combatant): ElementId | 'physical' {
  if (element === 'innate') return user.elements[0] ?? 'physical';
  return element;
}

export function elementMultiplier(attack: ElementId | 'physical', defender: readonly ElementId[], cfg: GameConfig): number {
  if (attack === 'physical') return 1;
  const e = cfg.elements;
  let mult = 1;
  for (const d of defender) {
    if (e.strong[attack].includes(d)) mult *= e.strongMult;
    else if (e.weak[attack].includes(d)) mult *= e.weakMult;
  }
  return clamp(mult, e.minMult, e.maxMult);
}

/** Sum of a numeric field over a combatant's traits. */
export function traitSum(c: Combatant, key: keyof TraitCombatEffects): number {
  let s = 0;
  for (const t of c.traits) {
    const v = TRAITS[t]?.combat?.[key];
    if (typeof v === 'number') s += v;
  }
  return s;
}

/** Product of a multiplier field over a combatant's traits (default 1). */
export function traitMult(c: Combatant, key: keyof TraitCombatEffects): number {
  let m = 1;
  for (const t of c.traits) {
    const v = TRAITS[t]?.combat?.[key];
    if (typeof v === 'number') m *= v;
  }
  return m;
}

export function hasTraitFlag(c: Combatant, key: keyof TraitCombatEffects): boolean {
  return c.traits.some((t) => Boolean(TRAITS[t]?.combat?.[key]));
}

/** Sum (additive mods) or product (multiplier mods) of active effect modifiers. */
export function effectMod(c: Combatant, key: keyof EffectMods): number {
  const multiplicative = key === 'damageMult' || key === 'initiativeMult' || key === 'healingTaken' || key === 'staminaRegenMult';
  let v = multiplicative ? 1 : 0;
  for (const e of c.effects) {
    const m = EFFECTS[e.id]?.mods?.[key];
    if (m === undefined) continue;
    // Additive mods add up per stack (corrosion); multiplicative ones apply once.
    v = multiplicative ? v * m : v + m * (e.stacks ?? 1);
  }
  return v;
}

/** Does any effect on the creature carry this flag (silence, provocation, camouflage)? */
export function hasEffectFlag(c: Combatant, flag: 'silence' | 'taunt' | 'hidden'): boolean {
  return c.effects.some((e) => EFFECTS[e.id]?.[flag]);
}

/** Weather multiplier on an attack's element (1 on an ordinary day or for physical blows). */
export function arenaElementMult(arena: ArenaCondition | undefined, element: ElementId | 'physical'): number {
  return element === 'physical' ? 1 : (arena?.elements?.[element] ?? 1);
}

/** Arena multiplier on stamina costs (heat). */
export function arenaCostMult(arena: ArenaCondition | undefined): number {
  return arena?.staminaCost ?? 1;
}

/** Abilities a silenced creature cannot use. */
export function isSilenceable(ability: AbilityDef): boolean {
  return ability.kind === 'spell' || ability.kind === 'heal';
}

export function hasEffect(c: Combatant, id: string): boolean {
  return c.effects.some((e) => e.id === id);
}

/** Stacks of an effect on a combatant (0 when absent, 1 for non-stacking effects). */
export function effectStacks(c: Combatant, id: string): number {
  const e = c.effects.find((x) => x.id === id);
  return e ? (e.stacks ?? 1) : 0;
}

/** Harmful effects a cleanse removes: not curses, not permanent passives. */
export function isCleansable(id: string, remaining: number): boolean {
  const def = EFFECTS[id];
  return Boolean(def && !def.beneficial && !def.curse && remaining < 999);
}

export function staminaFraction(c: Combatant): number {
  return c.maxStamina ? c.stamina / c.maxStamina : 0;
}

export function hpFraction(c: Combatant): number {
  return c.maxHp ? c.hp / c.maxHp : 0;
}

/** 0 when fresh, up to maxPenalty when spent. */
export function fatiguePenalty(c: Combatant, cfg: GameConfig): number {
  const f = cfg.combat.fatigue;
  const ratio = staminaFraction(c);
  if (ratio >= f.threshold) return 0;
  return (f.maxPenalty * (f.threshold - ratio)) / f.threshold;
}

/** Morale performance multiplier around 1. */
export function moraleFactor(c: Combatant, cfg: GameConfig): number {
  return 1 + (cfg.combat.morale.performanceSwing * (c.morale - 50)) / 50;
}

export function initiative(c: Combatant, noise: number, cfg: GameConfig): number {
  const i = cfg.combat.initiative;
  const base = c.attrs.speed * i.perSpeed + c.attrs.anticipation * i.perAnticipation + i.sizeMod[c.size] + noise;
  return base * effectMod(c, 'initiativeMult') * (1 - fatiguePenalty(c, cfg));
}

export function attackSkill(c: Combatant, kind: AttackKind): number {
  const a = c.attrs;
  if (kind === 'melee') return a.attack * 0.7 + a.technique * 0.3;
  if (kind === 'ranged') return a.accuracy * 0.7 + a.technique * 0.3;
  return a.focus * 0.7 + a.magic * 0.3;
}

export function defenseSkill(c: Combatant, kind: AttackKind): number {
  const a = c.attrs;
  if (kind === 'melee') return a.defense * 0.6 + a.agility * 0.4;
  if (kind === 'ranged') return a.agility * 0.7 + a.anticipation * 0.3;
  return a.focus * 0.5 + a.anticipation * 0.5;
}

export interface HitContext {
  flank: boolean;
  combo: boolean;
  orders: TeamOrders;
}

export function hitChance(
  attacker: Combatant,
  defender: Combatant,
  ability: AbilityDef,
  ctx: HitContext,
  cfg: GameConfig,
): number {
  const h = cfg.combat.hit;
  const kind = attackKind(ability);
  let p = h.base + (attackSkill(attacker, kind) - defenseSkill(defender, kind)) * h.perPoint;
  p += h.sizeMod[defender.size];
  p += ability.accuracyMod ?? 0;
  if (kind === 'spell') p += h.spellBonus;
  // Reaching the back line past a standing front line: easy for a skilled skirmisher, hard for anyone else.
  if (ctx.flank) p -= attacker.role === 'skirmisher' ? h.flankPenalty * (2 - attacker.roleFactor) : h.reachPenalty;
  if (ctx.combo) p += attacker.attrs.teamwork * h.comboPerTeamwork + traitSum(attacker, 'comboBonus');
  p += effectMod(attacker, 'hitBonus') - effectMod(defender, 'dodgeBonus');
  if (ctx.orders.risk === 'high') p += cfg.combat.orders.riskHigh.hitBonus;
  if (ctx.orders.risk === 'low') p += cfg.combat.orders.riskLow.hitBonus;
  p -= fatiguePenalty(attacker, cfg);
  p *= moraleFactor(attacker, cfg);
  return clamp(p, h.min, h.max);
}

export function critChance(attacker: Combatant, ability: AbilityDef, orders: TeamOrders, cfg: GameConfig): number {
  const d = cfg.combat.damage;
  let p = d.critBase + attacker.attrs.technique * d.critPerTechnique + attacker.attrs.composure * d.critPerComposure;
  p += (ability.critMod ?? 0) + traitSum(attacker, 'critBonus') + effectMod(attacker, 'critBonus');
  if (orders.risk === 'high') p += cfg.combat.orders.riskHigh.critBonus;
  if (orders.risk === 'low') p += cfg.combat.orders.riskLow.critBonus;
  return clamp(p, 0, 0.5);
}

/** Stat driving damage for an ability. */
export function powerStat(c: Combatant, kind: AttackKind): number {
  const a = c.attrs;
  if (kind === 'melee') return a.strength;
  if (kind === 'ranged') return (a.accuracy + a.technique) / 2;
  return a.magic;
}

/** Damage multiplier when one's approach has the upper hand on the opponent's. */
export function ascendancyMult(mine: TeamOrders, theirs: TeamOrders | undefined, cfg: GameConfig): number {
  const a = cfg.combat.orders.ascendancy;
  return theirs && a.beats[mine.aggression] === theirs.aggression ? 1 + a.bonus : 1;
}

/** The approach that has the upper hand on this one. */
export function counterApproach(theirs: TeamOrders['aggression'], cfg: GameConfig): TeamOrders['aggression'] {
  const beats = cfg.combat.orders.ascendancy.beats;
  return (Object.keys(beats) as TeamOrders['aggression'][]).find((k) => beats[k] === theirs) ?? 'balanced';
}

export interface DamageContext {
  orders: TeamOrders;
  /** Orders of the target's side (ascendancy between approaches). */
  foeOrders?: TeamOrders;
  /** Fraction (0–1) by which the attacker's team trails on health. */
  behind: number;
  solo: boolean;
}

/** Share of a role's bonus this creature gets: all of it in a role natural to its species, less in another. */
function bonusShare(c: Combatant, cfg: GameConfig): number {
  return c.roleFactor * (c.naturalRole === false ? cfg.combat.roleFit.offRoleBonus : 1);
}

/** A role bonus grows with role fit (smaller outside the species' natural roles); a penalty stays as it is. */
function scaled(v: number, c: Combatant, cfg: GameConfig): number {
  return v > 1 ? 1 + (v - 1) * bonusShare(c, cfg) : v;
}

/** Role effect on damage of this kind (a smaller bonus outside the species' natural roles). */
export function roleDamageFactor(c: Combatant, kind: AttackKind, cfg: GameConfig): number {
  return scaled(cfg.combat.roles[c.role][kind], c, cfg);
}

/** Role effect on healing given (a smaller bonus outside the species' natural roles). */
export function roleHealFactor(c: Combatant, cfg: GameConfig): number {
  return scaled(cfg.combat.roles[c.role].heal, c, cfg);
}

/** Role armour (a tank's bonus grows with its fit, smaller outside the species' natural roles). */
export function roleMitigation(c: Combatant, cfg: GameConfig): number {
  const m = cfg.combat.roles[c.role].mitigation;
  return m > 0 ? m * bonusShare(c, cfg) : m;
}

export function rawDamage(attacker: Combatant, ability: AbilityDef, ctx: DamageContext, cfg: GameConfig): number {
  const d = cfg.combat.damage;
  const kind = attackKind(ability);
  let dmg = ability.power * (d.statBase + powerStat(attacker, kind) * d.statPerPoint);
  if (kind !== 'spell') dmg *= 1 + attacker.attrs.aggression * d.aggressionPerPoint;
  dmg *= effectMod(attacker, 'damageMult');
  // Fury: the more wounded, the harder it hits.
  dmg *= 1 + effectMod(attacker, 'fury') * (1 - hpFraction(attacker));
  dmg *= traitMult(attacker, 'damageMult');
  dmg *= roleDamageFactor(attacker, kind, cfg);
  dmg *= cfg.combat.orders[ctx.orders.aggression].damageMult;
  dmg *= ascendancyMult(ctx.orders, ctx.foeOrders, cfg);
  dmg *= cfg.combat.stances[attacker.stance].damageMult;
  if (ctx.solo) dmg *= traitMult(attacker, 'soloDamageMult');
  dmg *= 1 - fatiguePenalty(attacker, cfg);
  dmg *= moraleFactor(attacker, cfg);
  if (ctx.behind > 0) dmg *= 1 + d.determinationMax * (attacker.attrs.determination / 20) * Math.min(1, ctx.behind * 2);
  if (hpFraction(attacker) < d.lowHpThreshold) dmg *= 1 - d.lowHpPenalty * (1 - attacker.attrs.composure / 20);
  return dmg;
}

/** Cover points of a front line: one per creature standing in it, a tank counts more. */
export function coverPoints(front: { role: string }[], cfg: GameConfig): number {
  return front.reduce((s, c) => s + (c.role === 'tank' ? cfg.combat.cover.tankWeight : 1), 0);
}

/** Share of ranged / spell damage the back line is spared for these cover points (grows with diminishing returns). */
export function coverReduction(points: number, cfg: GameConfig): number {
  const c = cfg.combat.cover;
  return points > 0 ? c.max * (1 - Math.pow(1 - c.perPoint, points)) : 0;
}

/**
 * Cover: a back-line creature takes less from ranged attacks and spells while its front line holds — more with
 * more creatures (and tanks) in front, never all of it. Melee that reaches the back line ignores it.
 */
export function coverMult(kind: AttackKind, target: Combatant, points: number, cfg: GameConfig): number {
  return kind !== 'melee' && target.line === 'back' ? 1 - coverReduction(points, cfg) : 1;
}

/** Damage multiplier of an execution ability on this target. */
export function executeMult(ability: AbilityDef, target: Combatant, cfg: GameConfig): number {
  return ability.execute && hpFraction(target) < cfg.combat.damage.executeBelow ? 1 + ability.execute : 1;
}

/** Pack multiplier: allies that already struck this target this round. */
export function packMult(ability: AbilityDef, alliesOnTarget: number, cfg: GameConfig): number {
  return ability.pack ? 1 + ability.pack * Math.min(alliesOnTarget, cfg.combat.damage.packMax) : 1;
}

/** Enemies hit by a line / area ability. */
export function lineTargets<T extends { line: string }>(target: AbilityDef['target'], enemies: T[]): T[] {
  if (target === 'allEnemies') return enemies;
  const line = target === 'enemyBack' ? 'back' : 'front';
  const inLine = enemies.filter((e) => e.line === line);
  return inLine.length ? inLine : enemies;
}

export function mitigation(defender: Combatant, kind: AttackKind, orders: TeamOrders, cfg: GameConfig): number {
  const d = cfg.combat.damage;
  const a = defender.attrs;
  let m: number;
  if (kind === 'spell') {
    m = ((a.focus + a.courage) / 2) * d.spellMitigationPerPoint;
  } else {
    m = a.toughness * d.physMitigationPerToughness + d.sizeArmor[defender.size] - a.aggression * d.aggressionMitigationPenalty;
  }
  m += effectMod(defender, 'mitigation');
  m += roleMitigation(defender, cfg);
  m += cfg.combat.orders[orders.aggression].mitigation;
  m += cfg.combat.stances[defender.stance].mitigation;
  if (defender.guarding) m += cfg.combat.guard.guardMitigation;
  return clamp(m, d.minMitigation, d.maxMitigation);
}

export function healAmount(healer: Combatant, ability: AbilityDef, cfg: GameConfig): number {
  const h = cfg.combat.heal;
  return ability.power * (h.statBase + healer.attrs.magic * h.statPerPoint) * moraleFactor(healer, cfg) * roleHealFactor(healer, cfg);
}

export function staminaCost(c: Combatant, ability: AbilityDef, orders: TeamOrders, cfg: GameConfig): number {
  let cost = ability.staminaCost * cfg.combat.stamina.sizeCostMult[c.size];
  cost *= cfg.combat.orders[orders.aggression].staminaCostMult;
  cost *= cfg.combat.stances[c.stance].staminaCostMult;
  return Math.round(cost);
}

export function staminaRegen(c: Combatant, cfg: GameConfig): number {
  const s = cfg.combat.stamina;
  return (s.regenBase + c.attrs.recovery * s.regenPerRecovery + c.attrs.stamina * s.regenPerStamina) * effectMod(c, 'staminaRegenMult');
}

export function interceptChance(guard: Combatant, cfg: GameConfig): number {
  const g = cfg.combat.guard;
  const base = guard.guarding ? g.activeBase : g.passiveBase;
  const p = base + guard.attrs.anticipation * g.perAnticipation + guard.attrs.teamwork * g.perTeamwork + traitSum(guard, 'interceptBonus');
  const role = guard.role === 'tank' ? guard.roleFactor : 1;
  return clamp(p * role * (1 - fatiguePenalty(guard, cfg)), 0, g.max);
}

/** Chance to ignore the manager's orders this turn. */
export function disobeyChance(c: Combatant, cfg: GameConfig): number {
  const o = cfg.combat.orders;
  const base = o.disobeyBase * Math.pow(1 - c.attrs.discipline / 20, o.disobeyExponent);
  return clamp(base * traitMult(c, 'disobeyMult'), 0, 0.9);
}

/** Morale change after courage / traits. */
export function scaledMoraleDelta(c: Combatant, delta: number, cfg: GameConfig): number {
  if (delta < 0) {
    const courage = 1 - c.attrs.courage * cfg.combat.morale.courageReductionPerPoint;
    return delta * Math.max(0.2, courage) * traitMult(c, 'moraleLossMult');
  }
  return delta * traitMult(c, 'moraleGainMult');
}
