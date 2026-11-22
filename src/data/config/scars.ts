/** Scars: a healed injury may leave a permanent mark (`data/scars.ts`). */
export const SCAR_CONFIG = {
  /** Chance, when an injury heals, that it leaves a scar, by severity (minor injuries never do). */
  chance: { minor: 0, moderate: 0.25, severe: 0.5, career: 1 } as Record<'minor' | 'moderate' | 'severe' | 'career', number>,
  /** Most scars a creature can carry. */
  max: 3,
};
