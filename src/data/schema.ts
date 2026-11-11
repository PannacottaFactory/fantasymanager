/**
 * Shapes of static game data (bestiary, traits, abilities…).
 * Files in src/data only DECLARE data with these types — no game logic.
 */
import type { AttributeCategory, AttributeKey, Attributes } from './attributes.ts';

export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'nature' | 'shadow' | 'light';
/** 'physical' is neutral; 'innate' means "the user's primary element". */
export type DamageElement = ElementId | 'physical' | 'innate';

export type SizeClass = 'small' | 'medium' | 'large' | 'huge';
export type RoleId = 'tank' | 'striker' | 'support' | 'caster' | 'skirmisher';
export type Line = 'front' | 'back';
export type TargetPriority = 'nearest' | 'weakest' | 'strongest' | 'casters' | 'threat';

export interface ElementDef {
  id: ElementId;
  name: string;
  color: string;
}

export interface LifeCurve {
  /** Youngest age at which the species can fight in an arena (years). */
  minAge: number;
  /** Age at which the creature reaches its full potential. */
  peakStart: number;
  /** Age at which decline begins. */
  peakEnd: number;
  /** Fraction of ability lost per year after peakEnd. */
  declineRate: number;
  /** Typical retirement age. */
  maxAge: number;
}

export interface SpeciesDef {
  id: string;
  name: string;
  plural: string;
  description: string;
  elements: ElementId[];
  size: SizeClass;
  flying?: boolean;
  /** Attribute span: [value for a weak specimen, value for an outstanding one]. */
  attributes: Record<AttributeKey, [number, number]>;
  lifeCurve: LifeCurve;
  /** How fast each category develops (1 = normal). Used from phase 4. */
  growth: Record<AttributeCategory, number>;
  roles: RoleId[];
  abilities: { id: string; minAbility?: number }[];
  /** Permanent effects (e.g. troll regeneration). */
  passives?: string[];
  nameCulture: string;
  /** Relative chance for traits (default 1). */
  traitWeights?: Record<string, number>;
  /** Weekly food & keep, in gold pieces. Used from phase 3. */
  upkeep: number;
  rarity: number;
  /** Market value multiplier from the species' real combat strength (calibrated with `npm run sim:species`). */
  valueMult?: number;
}

export type AbilityKind = 'melee' | 'ranged' | 'spell' | 'heal' | 'buff' | 'debuff';
/** enemyFront / enemyBack hit a whole line (everyone if that line is empty). */
export type AbilityTarget = 'enemy' | 'enemyFront' | 'enemyBack' | 'allEnemies' | 'ally' | 'allAllies' | 'self';

export interface AbilityEffectRef {
  effect: string;
  chance: number;
  on: 'target' | 'self';
  duration?: number;
  /** Stacks added at once (stacking effects such as poison or chill; default 1). */
  stacks?: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  element: DamageElement;
  target: AbilityTarget;
  /** Base damage or heal amount. */
  power: number;
  staminaCost: number;
  cooldown: number;
  /** Melee attack able to reach the back line (dives, charges). */
  reachBack?: boolean;
  accuracyMod?: number;
  critMod?: number;
  lifesteal?: number;
  /** Removes every harmful effect that can be cleansed (not curses) from the targets. */
  cleanse?: boolean;
  /** Execution: damage × (1 + execute) against a target below cfg executeBelow health. */
  execute?: number;
  /** Stamina removed from each target hit (or affected, for debuffs). */
  staminaDrain?: number;
  /** Pack: damage +pack for each ally that already hit the same target this round (up to 4). */
  pack?: number;
  /** Sacrifice: fraction of the user's max health paid to use it (never below 1 HP). */
  hpCost?: number;
  /** Several strikes in one action (single target): each one rolls to hit and deals `power`. */
  hits?: number;
  /** Morale damage inflicted on targets. */
  fear?: number;
  effects?: AbilityEffectRef[];
  /** Short verb used by the commentary ("breathes fire at"). */
  verb: string;
}

export interface EffectMods {
  damageMult?: number;
  mitigation?: number;
  hitBonus?: number;
  dodgeBonus?: number;
  initiativeMult?: number;
  critBonus?: number;
  /** Multiplier on healing received (heals, regeneration, life drain). */
  healingTaken?: number;
  /** Multiplier on stamina recovered each round. */
  staminaRegenMult?: number;
  /** Fraction of melee damage taken that is sent back to the attacker (additive). */
  thorns?: number;
  /** Fury: damage bonus that grows with missing health (full value at 0 HP; additive). */
  fury?: number;
}

export interface EffectDef {
  id: string;
  name: string;
  kind: 'dot' | 'hot' | 'stun' | 'mods' | 'shield';
  description: string;
  defaultDuration: number;
  /** Damage/heal per round for dot/hot (fraction of max HP), shield amount (fraction of max HP). */
  magnitude?: number;
  mods?: EffectMods;
  moralePerRound?: number;
  beneficial: boolean;
  /** Stacking effect: each application adds a stack up to this cap (dot damage scales with stacks). */
  maxStacks?: number;
  /** Reaching maxStacks turns the effect into this one (chill → frozen). */
  onMaxStacks?: string;
  /** Curse: lasts until the next break (or the end of the match) and cannot be cleansed. */
  curse?: boolean;
  /** Removed by any healing ability (bleeding). */
  endsOnHeal?: boolean;
  /** Passive used up when knocked out: the creature gets back up once with this fraction of its max health. */
  revive?: number;
}

export interface TraitCombatEffects {
  attrMods?: Partial<Attributes>;
  /** Multiplies morale losses (cowards > 1, fearless < 1). */
  moraleLossMult?: number;
  moraleGainMult?: number;
  /** Multiplies the chance to ignore orders. */
  disobeyMult?: number;
  /** Flies into a rage when HP fraction falls below this. */
  enrageBelowHp?: number;
  enrageOnAllyKo?: boolean;
  /** Morale given to every ally on the field each round. */
  auraMorale?: number;
  interceptBonus?: number;
  critBonus?: number;
  damageMult?: number;
  /** Raises the morale level under which the creature may hesitate or flee. */
  breakThresholdMod?: number;
  /** Target preference when acting on instinct. */
  instinctTarget?: TargetPriority;
  /** Chance per turn to waste the action showing off to the crowd. */
  showboatChance?: number;
  /** Damage bonus when no ally targeted the same enemy this round. */
  soloDamageMult?: number;
  /** Bonus when allies already hit the same target this round. */
  comboBonus?: number;
}

export interface TraitDef {
  id: string;
  name: string;
  description: string;
  polarity: 'positive' | 'negative' | 'mixed';
  /** Mutually exclusive traits. */
  excludes?: string[];
  combat?: TraitCombatEffects;
  /** Used from phase 4 (training) and phase 5 (morale). */
  training?: { gainMult?: number; injuryMult?: number };
  personality?: { moraleVolatility?: number; ambitionMod?: number; loyaltyMod?: number };
}

export interface RoleDef {
  id: RoleId;
  name: string;
  description: string;
  defaultLine: Line;
  /** Attribute weights used to rate how well a creature fits the role. */
  fit: Partial<Record<AttributeKey, number>>;
  /** Action preferences of the combat AI. */
  ai: { damage: number; heal: number; buff: number; debuff: number; guard: number; backlineHunter: number };
}

export interface InjuryDef {
  id: string;
  name: string;
  /** Weeks out, min–max. */
  weeks: [number, number];
  severity: 'minor' | 'moderate' | 'severe' | 'career';
  relapseRisk: number;
  /** Damage element that tends to cause this injury ('any' = generic). */
  cause: DamageElement | 'any';
  weight: number;
}
