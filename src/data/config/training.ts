/** Training, coaches, ageing and youth intake balancing (phase 4). */
export const TRAINING_CONFIG = {
  /** Weekly ability gain = (potential − ability) × gapRate × modifiers (before the end of the prime). */
  gapRate: 0.03,
  /** Minimum weekly gain while below potential (so the last points still come). */
  minWeekly: 0.15,
  /** Growth multiplier by life stage. */
  stage: { young: 1, prime: 0.5, declining: 0 },
  /** Professionalism 1–20 → × (base + prof/20 × range). */
  professionalism: { base: 0.6, range: 0.8 },
  /** Playing in the week's match helps (legacy multiplier, replaced by match XP). */
  playedBonus: 0,
  /**
   * Levels 1–10 (100 XP each). `steps[i]` = aptitude where level i + 1 starts (steps[0] = where the level-1 bar
   * starts). Short steps at the bottom, long ones at the top: a modest creature still climbs 3–4 levels in its career,
   * a new stable sits around levels 1–4, the elite reach 8–10 and level 10 stays rare.
   */
  levels: { max: 10, steps: [28, 40, 50, 60, 72, 86, 102, 120, 142, 168], top: 200, xpPerLevel: 100, xpPerAbility: 6.25 },
  /**
   * Experience. Training gives `trainingShare` of the former weekly gain; a match gives
   * played + starter + (rating − 5) × perRatingPoint + win (× life stage, up to the potential). No KO bonus: it would
   * favour strikers over healers and tanks; the rating already rewards every role.
   */
  // Match XP is converted into aptitude at `levels.xpPerAbility` XP per point (the growth speed does not depend on the level).
  xp: { trainingShare: 0.6, played: 3.75, starter: 1.25, perRatingPoint: 1.25, ko: 0, win: 1.25 },
  /** Intensity: growth multiplier, extra fatigue per week, injury chance per week (× proneness/10). */
  /** Visual progression kept for the player's creatures. */
  progressLog: { recent: 16, history: 72 },
  intensity: {
    light: { growth: 0.6, fatigue: -6, injury: 0 },
    normal: { growth: 1, fatigue: 0, injury: 0.003 },
    intense: { growth: 1.4, fatigue: 8, injury: 0.015 },
  },
  /** Attribute weights by program (by category; 'role' follows the role-fit weights). */
  programs: {
    balanced: { physical: 1, combat: 1, mental: 1 },
    physical: { physical: 2.4, combat: 0.4, mental: 0.3 },
    combat: { physical: 0.4, combat: 2.4, mental: 0.3 },
    mental: { physical: 0.3, combat: 0.4, mental: 2.6 },
  },
  /** Rest program: no growth, extra fatigue recovery. */
  restRecovery: 15,
  /** Attributes cannot exceed the species range at full potential by more than this. */
  attributeHeadroom: 2,
  coaches: {
    /** Growth in a coach's domain × (base + quality × perQuality); no coach = noCoach. */
    base: 0.6,
    perQuality: 0.04,
    noCoach: 0.5,
    /** Weekly wage = base + quality² × perQualitySq (rounded to 10). */
    wageBase: 40,
    wagePerQualitySq: 2.2,
    /** One-off hiring fee = this many weeks of wages. */
    hireWeeks: 12,
    /** Coaches on the market at the start of each season. */
    market: 9,
    /** Starting coach quality by club quality tier (mean). */
    startQuality: { novice: 5, regional: 7, professional: 9, elite: 12, legendary: 15 },
  },
  ageing: {
    /** Past the prime, each birthday costs this share of the species decline rate × potential (physical hit hardest). */
    declineWeights: { physical: 1.5, combat: 1, mental: 0.3 },
  },
  youth: {
    /** Young creatures offered each off-season. */
    min: 2,
    max: 4,
    /** Potential = normal(base + reputation × perReputation, sd). */
    potentialBase: 55,
    potentialPerReputation: 0.5,
    potentialSd: 18,
    /** Wage of a youth contract = asked wage × this. */
    wageFactor: 0.5,
    years: 3,
  },
  /** Every this many matchdays, a training report lists the biggest improvers. */
  reportEvery: 6,
};

export type TrainingConfig = typeof TRAINING_CONFIG;
export type ProgramId = keyof typeof TRAINING_CONFIG.programs | 'role' | 'rest';
export type IntensityId = keyof typeof TRAINING_CONFIG.intensity;
export const PROGRAM_IDS: ProgramId[] = ['balanced', 'physical', 'combat', 'mental', 'role', 'rest'];
export const INTENSITY_IDS: IntensityId[] = ['light', 'normal', 'intense'];
