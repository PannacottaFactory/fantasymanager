import type { RoleId, SizeClass } from '../schema.ts';

/** All combat balancing numbers. Attributes are on a 1–20 scale. */
export const COMBAT_CONFIG = {
  hp: {
    base: 65,
    perToughness: 3,
    perStrength: 1,
    sizeMult: { small: 0.8, medium: 1, large: 1.35, huge: 1.75 } as Record<SizeClass, number>,
  },
  stamina: {
    base: 40,
    perStamina: 4,
    /** Regen per round = max(regenMin, regenBase + recovery × regenPerRecovery + stamina × regenPerStamina). */
    regenBase: -1,
    regenMin: 0.3,
    regenPerRecovery: 0.3,
    regenPerStamina: 0.08,
    /** Regen multiplier when the creature spends its turn resting. */
    restMult: 4,
    sizeCostMult: { small: 0.85, medium: 1, large: 1.15, huge: 1.3 } as Record<SizeClass, number>,
    /** Ability costs × (1 − (discipline − 10) × this): disciplined fighters spend less. */
    disciplinePerPoint: 0.025,
    /** Pre-match fatigue (0–100) removes this fraction of the pool at 100. */
    preMatchFatigueLoss: 0.5,
  },
  fatigue: {
    /** Penalties start when stamina falls below this fraction of max. */
    threshold: 0.5,
    /** Penalty (hit, damage, initiative) at 0 stamina. */
    maxPenalty: 0.35,
    /** Share of that penalty taken on the chance to hit (0.57 → −20 % at most): spent creatures hit softer, they miss less. */
    hitShare: 0.57,
    /** Fatigue penalties × (1 − (determination − 10) × this). */
    determinationPerPoint: 0.08,
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
    /** To hit per point of the attacker's composure above 10 (below 10: less). */
    perComposure: 0.006,
    /** Harder to hit per point of the target's speed above 10. */
    dodgePerSpeed: 0.006,
    /** Allies' hit bonus per point of the best leader's leadership above 10 (a poor leader: a malus). */
    perLeadership: 0.008,
    /** When an ally already hit the target this round: comboBase + (teamwork − 10) × comboPerTeamwork to hit. */
    comboBase: 0.04,
    comboPerTeamwork: 0.015,
  },
  /** How attributes combine into the skill to hit and the power of melee blows (shares add up to 1). */
  mix: {
    meleeHit: { attack: 0.6, accuracy: 0.2, technique: 0.2 },
    rangedHit: { accuracy: 0.7, technique: 0.3 },
    meleePower: { strength: 0.8, technique: 0.2 },
  },
  damage: {
    statBase: 0.55,
    statPerPoint: 0.045,
    /** Physical damage × (1 + aggressionBase + (aggression − 10) × aggressionPerPoint). */
    aggressionBase: 0.06,
    aggressionPerPoint: 0.02,
    variance: 0.15,
    critBase: 0.04,
    critPerTechnique: 0.004,
    critPerComposure: 0.002,
    critMult: 1.6,
    /** Execution abilities hit harder on targets below this health fraction. */
    executeBelow: 0.3,
    /** Pack abilities count at most this many allies already on the target. */
    packMax: 4,
    /** Chain abilities: each leap to another enemy deals this fraction of the previous one. */
    chainFalloff: 0.7,
    /** Steadfast creatures (two heads): harmful stuns, freezes and charms land this fraction of the time. */
    steadfastMult: 0.5,
    /** Physical mitigation per point of toughness. */
    physMitigationPerToughness: 0.017,
    /** Front-line armour per point of courage above 10. */
    courageFrontPerPoint: 0.012,
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
    /** Healing = power × (statBase + magic × statPerPoint). Halved when the judges started counting it. */
    statBase: 0.28,
    statPerPoint: 0.02,
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
    /**
     * Team talks (one per period, given before the match and at each break). Rally and second wind act once when given
     * (morale towards `target`, a share of the missing stamina); the others last the period.
     */
    talks: {
      rally: { share: 0.3, target: 75 },
      secondWind: { share: 0.1 },
      focus: { hit: 0.03 },
      /** Front-line armour against melee only, plus interceptions. */
      ranks: { mitigation: 0.05, intercept: 0.06 },
      /** Against ranged attacks and spells. */
      evade: { dodge: 0.045 },
      fury: { damage: 0.08, cost: 0.1 },
    },
    ascendancy: { bonus: 0.08, beats: { cautious: 'aggressive', aggressive: 'balanced', balanced: 'cautious' } as Record<'cautious' | 'balanced' | 'aggressive', 'cautious' | 'balanced' | 'aggressive'> },
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
  /** offRoleBonus: share of the role's bonus kept outside the species' natural roles (costs stay whole). */
  roleFit: { perPoint: 0.022, min: 0.78, max: 1.2, offRoleBonus: 0.5 },
  /**
   * What each role does to a creature: damage multipliers per attack kind, healing multiplier and flat armour.
   * Bonuses (> 1, or armour > 0) grow with role fit; penalties do not. Outside the roles natural to its
   * species, a creature gets only `roleFit.offRoleBonus` of the role's bonuses (its costs still apply).
   */
  roles: {
    tank: { melee: 0.88, ranged: 0.88, spell: 0.88, heal: 1, mitigation: 0.02 },
    striker: { melee: 1.15, ranged: 1, spell: 1, heal: 1, mitigation: -0.05 },
    caster: { melee: 1, ranged: 1, spell: 1.15, heal: 1, mitigation: -0.05 },
    support: { melee: 0.85, ranged: 0.85, spell: 0.85, heal: 1.15, mitigation: 0 },
    skirmisher: { melee: 1.05, ranged: 1.1, spell: 1, heal: 1, mitigation: -0.04 },
  } as Record<RoleId, { melee: number; ranged: number; spell: number; heal: number; mitigation: number }>,
  /**
   * Cover: the creatures standing in the front line shield the back line from ranged attacks and spells.
   * points = front creatures (a tank counts `tankWeight`); reduction = max × (1 − (1 − perPoint)^points):
   * one creature ≈ −11 %, a lone tank ≈ −15 %, two ≈ −18 %, three ≈ −24 %, four ≈ −27 % — never total.
   */
  cover: { perPoint: 0.3, tankWeight: 1.5, max: 0.36 },
  /** Skills: five per species, unlocked by level; the manager equips a few of them (the AI then picks in the match). */
  skills: {
    equipped: 2,
    /** Level at which each of the five skills unlocks (in the species' order). */
    unlockLevels: [1, 2, 4, 6, 8] as number[],
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
    /**
     * Abilities that deal no damage (curses, cries, snares): share of the target-priority bonus they get (the priority
     * says whom to hit, not whom to hex), and weight of their effects against a plain attack. Calibrated with
     * `sim:abilities` so that a control ability, when chosen, is worth the attack it replaces.
     */
    debuffPriority: 0.3,
    debuffWeight: 1,
    /** Same for cries and auras on a whole line or every foe (roars, screeches, blights). */
    cryWeight: 0.7,
    /**
     * Heal floor: a creature whose role does not heal (tank, striker, skirmisher weigh healing at 0) still uses a heal
     * it has equipped at this weight, so a heal skill is never dead outside the support role.
     */
    healFloor: 0.6,
    /**
     * Stamina reserve: a cheaper action that would leave too little stamina to cast, next round, an ability costing at
     * least `reserveMinCost` that is ready (or back next round) has its score × `staminaReserve` (1 = no reserve).
     */
    staminaReserve: 0.5,
    reserveMinCost: 12,
  },
  rage: { duration: 3 },
  /**
   * Bonds between two creatures of a stable (relations, see club.relations: friends ≥ friend, rivals ≤ rival): a friend
   * knocked out makes the other « avenging » (effect, `avengeRounds`); a friend who already hit the target this round
   * adds `friendCombo` to the chance to hit; a rival's hit never counts as teamwork.
   */
  bonds: { avengeRounds: 4, friendCombo: 0.04 },
  /**
   * Touched by grace: from `minRound`, while a side trails on the judges' cards by ≥ `trailBy` or has fewer creatures
   * standing, each of its creatures may rise above itself at the start of a round with `chance` × (floor + courage) /
   * (floor + 10) (courage 1 ≈ ×0.4, 20 ≈ ×1.7: the brave more often, never only them). Once per side and match:
   * effect `graced` for `rounds`, `stamina` of the missing stamina and `heal` of its health back, morale + `morale`.
   * Own RNG stream. Measured (`sim:upsets --league`): in ≈ 20 % of the matches, the side touched wins ≈ 35 % instead of
   * ≈ 16 % (same matches without it), 63 % of the time it comes to the weaker side; upsets +1.3 points.
   */
  grace: { chance: 0.005, minRound: 3, trailBy: 15, courageFloor: 5, rounds: 20, stamina: 1, heal: 0.5, morale: 30 },
  injury: {
    /** Chance of injury when knocked out (before modifiers). */
    onKo: 0.08,
    /** Chance per heavy hit taken. */
    onHeavyHit: 0.01,
    /** injuryProneness (1–20) multiplies chance by (0.5 + prone/20). */
    pronenessWeight: 1,
  },
  postMatch: {
    /**
     * Fatigue (0–100) gained = base + (1 − staminaFraction) × fromStamina + share of the rounds on the field × fromRounds
     * + onKo when knocked out. Time in the arena and a KO tire too, so creatures with cheap blows and quick recovery
     * (skeletons, goblins…) no longer come back fresh every week.
     */
    fatigueBase: 10,
    fatigueFromStamina: 34,
    fatigueFromRounds: 14,
    fatigueOnKo: 10,
  },
};

export type CombatConfig = typeof COMBAT_CONFIG;
