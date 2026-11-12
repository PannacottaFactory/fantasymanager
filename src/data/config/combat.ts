import type { RoleId, SizeClass } from '../schema.ts';

/** All combat balancing numbers. Attributes are on a 1–20 scale. */
export const COMBAT_CONFIG = {
  hp: {
    base: 60,
    perToughness: 3,
    perStrength: 1,
    sizeMult: { small: 0.8, medium: 1, large: 1.35, huge: 1.75 } as Record<SizeClass, number>,
  },
  stamina: {
    base: 40,
    perStamina: 4,
    regenBase: 0.5,
    regenPerRecovery: 0.15,
    regenPerStamina: 0.08,
    /** Regen multiplier when the creature spends its turn resting. */
    restMult: 4,
    sizeCostMult: { small: 0.85, medium: 1, large: 1.15, huge: 1.3 } as Record<SizeClass, number>,
    /** Pre-match fatigue (0–100) removes this fraction of the pool at 100. */
    preMatchFatigueLoss: 0.5,
  },
  fatigue: {
    /** Penalties start when stamina falls below this fraction of max. */
    threshold: 0.5,
    /** Penalty (hit, damage, initiative) at 0 stamina. */
    maxPenalty: 0.35,
    /** Injury chances × (1 + pre-match fatigue/100 × this). */
    injuryFromFatigue: 1,
    /** "Exhausted" announced below this fraction. */
    exhaustedBelow: 0.25,
  },
  initiative: {
    perSpeed: 1,
    perAnticipation: 0.4,
    noise: 6,
    sizeMod: { small: 2, medium: 0, large: -1.5, huge: -3 } as Record<SizeClass, number>,
  },
  hit: {
    base: 0.67,
    perPoint: 0.025,
    min: 0.15,
    max: 0.97,
    /** Big targets are easier to hit. */
    sizeMod: { small: -0.06, medium: 0, large: 0.04, huge: 0.08 } as Record<SizeClass, number>,
    /** Skirmishers hitting the back line past a standing front line (× (2 − role factor)). */
    flankPenalty: 0.1,
    /** Other melee fighters forcing their way to the back line past a standing front line. */
    reachPenalty: 0.22,
    spellBonus: -0.03,
    /** Bonus per point of teamwork when an ally already hit the target this round. */
    comboPerTeamwork: 0.004,
  },
  damage: {
    statBase: 0.55,
    statPerPoint: 0.045,
    aggressionPerPoint: 0.006,
    variance: 0.15,
    critBase: 0.04,
    critPerTechnique: 0.004,
    critPerComposure: 0.002,
    critMult: 1.6,
    /** Execution abilities hit harder on targets below this health fraction. */
    executeBelow: 0.3,
    /** Pack abilities count at most this many allies already on the target. */
    packMax: 4,
    /** Physical mitigation per point of toughness. */
    physMitigationPerToughness: 0.017,
    /** Spell mitigation per point of (focus + courage) / 2. */
    spellMitigationPerPoint: 0.015,
    sizeArmor: { small: 0, medium: 0, large: 0.04, huge: 0.08 } as Record<SizeClass, number>,
    /** Aggression lowers guard. */
    aggressionMitigationPenalty: 0.004,
    maxMitigation: 0.65,
    minMitigation: -0.3,
    /** Multi-target attacks deal this fraction to each target. */
    aoeFactor: 1,
    /** When behind, determination adds up to this × (det/20) damage. */
    determinationMax: 0.12,
    /** Low-HP penalty softened by composure. */
    lowHpThreshold: 0.3,
    lowHpPenalty: 0.1,
  },
  heal: {
    statBase: 0.55,
    statPerPoint: 0.04,
  },
  guard: {
    /** Passive intercept chance for front-line tanks. */
    passiveBase: 0.1,
    /** Intercept chance when the tank chose to guard this round. */
    activeBase: 0.32,
    perAnticipation: 0.012,
    perTeamwork: 0.006,
    max: 0.6,
    /** Damage reduction while guarding. */
    guardMitigation: 0.12,
    staminaCost: 3,
  },
  morale: {
    /** In-combat morale is 0–100. Start = 50 + (creature morale − 50) × weight + (form − 10) × formWeight. */
    startWeight: 0.5,
    formWeight: 1.5,
    allyKo: -12,
    enemyKo: 8,
    critDealt: 3,
    heavyHitTaken: -6,
    /** "Heavy" = more than this fraction of max HP in one blow. */
    heavyHitFraction: 0.22,
    /** Courage reduces losses: × (1 − courage × this). */
    courageReductionPerPoint: 0.03,
    /** Drift toward 50 each round. */
    driftPerRound: 1.5,
    /** Best leader on the field (≥ minLeadership) gives allies leadership × this per round. */
    leadershipAuraPerPoint: 0.15,
    minLeadership: 11,
    hesitateBelow: 25,
    hesitateMaxChance: 0.45,
    composureReductionPerPoint: 0.03,
    fleeBelow: 10,
    fleeMaxChance: 0.3,
    fleeHpBelow: 0.35,
    /** Performance modifier: ± this at morale 100 / 0. */
    performanceSwing: 0.08,
  },
  orders: {
    disobeyBase: 0.28,
    /** chance = base × (1 − discipline/20)^exponent × trait multipliers. */
    disobeyExponent: 1.5,
    /** Aggression trades stamina for damage: strong for a few rounds, ruinous over a whole match. */
    aggressive: { damageMult: 1.2, mitigation: -0.04, staminaCostMult: 1.25, restBias: -0.3 },
    balanced: { damageMult: 1, mitigation: 0, staminaCostMult: 1, restBias: 0 },
    cautious: { damageMult: 0.88, mitigation: 0.05, staminaCostMult: 0.9, restBias: 0.35 },
    /**
     * Ascendancy: an approach that "beats" the opponent's deals more damage.
     * Cautious thwarts aggressive, aggressive overwhelms balanced, balanced wears down cautious.
     */
    ascendancy: { bonus: 0.08, beats: { cautious: 'aggressive', aggressive: 'balanced', balanced: 'cautious' } as Record<'cautious' | 'balanced' | 'aggressive', 'cautious' | 'balanced' | 'aggressive'> },
    riskHigh: { critBonus: 0.02, hitBonus: -0.03, bigAbilityBias: 0.3 },
    riskLow: { critBonus: -0.01, hitBonus: 0.02, bigAbilityBias: -0.3 },
  },
  /**
   * Individual instruction of a creature. Each one away from normal trades something:
   * all out hits harder but costs stamina and leaves it open; pacing itself saves stamina but holds back its blows.
   */
  stances: {
    normal: { damageMult: 1, mitigation: 0, staminaCostMult: 1 },
    allOut: { damageMult: 1.08, mitigation: -0.04, staminaCostMult: 1.15 },
    conserve: { damageMult: 0.92, mitigation: 0, staminaCostMult: 0.85 },
  },
  /**
   * How well a creature suits its role (role fit 1–20) scales what the role does: tank interceptions,
   * striker melee damage, caster spell damage, support healing, skirmisher strikes on the back line.
   * factor = 1 + (fit − 10) × perPoint, clamped.
   */
  roleFit: { perPoint: 0.022, min: 0.78, max: 1.2, offRole: 0.8 },
  /**
   * What each role does to a creature: damage multipliers per attack kind, healing multiplier and flat armour.
   * Bonuses (> 1, or armour > 0) grow with role fit; penalties do not. Outside the roles natural to its
   * species, a creature also deals and heals `roleFit.offRole` times as much.
   */
  roles: {
    tank: { melee: 0.88, ranged: 0.88, spell: 0.88, heal: 1, mitigation: 0.03 },
    striker: { melee: 1.15, ranged: 1, spell: 1, heal: 1, mitigation: -0.05 },
    caster: { melee: 1, ranged: 1, spell: 1.15, heal: 1, mitigation: -0.05 },
    support: { melee: 0.85, ranged: 0.85, spell: 0.85, heal: 1.25, mitigation: 0 },
    skirmisher: { melee: 1.05, ranged: 1.1, spell: 1, heal: 1, mitigation: -0.04 },
  } as Record<RoleId, { melee: number; ranged: number; spell: number; heal: number; mitigation: number }>,
  /**
   * Cover: the creatures standing in the front line shield the back line from ranged attacks and spells.
   * points = front creatures (a tank counts `tankWeight`); reduction = max × (1 − (1 − perPoint)^points):
   * one creature ≈ −11 %, a lone tank ≈ −15 %, two ≈ −18 %, three ≈ −24 %, four ≈ −27 % — never total.
   */
  cover: { perPoint: 0.3, tankWeight: 1.5, max: 0.36 },
  /** Favourite abilities chosen by the manager (per creature). */
  favorites: {
    max: 1,
    /** Score multiplier = 1 + bonus × (0.4 + 0.6 × discipline/20): disciplined creatures follow the build more. */
    bonus: 0.9,
  },
  ai: {
    /** Decision noise = (1 − tactics/20) × this. Low tactics → erratic choices. */
    noiseMax: 0.6,
    killBonus: 0.6,
    priorityBonus: 0.8,
    /** Share of the priority bonus kept when a non-skirmisher would have to reach past the front line. */
    reachPriority: 0.3,
    /** Rest becomes attractive below this stamina fraction. */
    restBelow: 0.35,
    restWeight: 1.2,
    /** How much tactics lets a creature weigh type matchups (0 = ignores them). */
    elementAwareness: 1,
  },
  rage: { duration: 3 },
  injury: {
    /** Chance of injury when knocked out (before modifiers). */
    onKo: 0.09,
    /** Chance per heavy hit taken. */
    onHeavyHit: 0.01,
    /** injuryProneness (1–20) multiplies chance by (0.5 + prone/20). */
    pronenessWeight: 1,
  },
  postMatch: {
    /** Fatigue (0–100) gained = (1 − staminaFraction) × this + base. */
    fatigueBase: 10,
    fatigueFromStamina: 50,
  },
};

export type CombatConfig = typeof COMBAT_CONFIG;
