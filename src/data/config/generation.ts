/** Creature generation balancing. Ability values (current/potential) are on a 1–200 scale. */
export const GENERATION_CONFIG = {
  /** Quality tiers used to generate creatures and teams. Mean/sd of potential ability. */
  qualities: {
    novice: { label: 'Novice pit', potentialMean: 55, potentialSd: 18 },
    regional: { label: 'Regional arena', potentialMean: 85, potentialSd: 22 },
    professional: { label: 'Professional league', potentialMean: 115, potentialSd: 25 },
    elite: { label: 'Elite circuit', potentialMean: 145, potentialSd: 22 },
    legendary: { label: 'Legendary', potentialMean: 175, potentialSd: 15 },
  },
  minAbility: 10,
  maxAbility: 200,
  /** Fraction of potential reached at minAge (grows linearly to 1 at peakStart). */
  abilityAtMinAge: 0.55,
  /** Random spread of each attribute around its expected value. */
  attributeSd: { physical: 1.3, combat: 1.3, mental: 2.2 },
  /** Mental attributes depend less on ability: blend weight of ability vs pure species average. */
  mentalAbilityWeight: 0.55,
  /** Age distribution of generated (non-youth) creatures: fraction of span minAge → maxAge. */
  ageSpanMax: 0.75,
  /** New creatures start this share below what their age allows (room to level up): uniform min–max. */
  headroom: { min: 0.1, max: 0.25 },
  /**
   * The player's starting squad: same strength, much less room to grow (the stars come later, from the market and
   * the young prospects). Potential = ability + (drawn potential − ability) × room, capped at `max`.
   */
  /**
   * The player's starting squad: mean potential by the choice made at new game (whatever the difficulty), little room
   * to grow (potential = ability + gap × room, at most `max`). Solid ≈ a little above the Marches League's average.
   */
  startingSquad: { room: 0.35, max: 101, potential: { modest: 65, solid: 72, gifted: 80 } },
  /** Probability of having 0, 1, 2, 3 traits. */
  traitCountWeights: [0.15, 0.45, 0.3, 0.1],
  hidden: { mean: 10, sd: 4 },
  condition: { formMean: 10, formSd: 2.5, moraleMean: 60, moraleSd: 12 },
  /** Team generator: starters + bench. */
  team: { starters: 5, bench: 3, potentialSpread: 1.0 },
};

export type GenerationConfig = typeof GENERATION_CONFIG;
export type QualityId = keyof typeof GENERATION_CONFIG.qualities;
