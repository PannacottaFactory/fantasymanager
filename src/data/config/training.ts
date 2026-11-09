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
  /** Playing in the week's match helps. */
  playedBonus: 0.15,
  /** Intensity: growth multiplier, extra fatigue per week, injury chance per week (× proneness/10). */
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
    wagePerQualitySq: 1.6,
    /** One-off hiring fee = this many weeks of wages. */
    hireWeeks: 4,
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
