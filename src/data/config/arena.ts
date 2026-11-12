/**
 * Arena conditions: the weather, the ground, the crowd or the magic of the day, drawn for each league / cup match once
 * the first weeks are past (so a new manager is not drowned in rules). One readable global rule per condition, the same
 * for both sides — never a team bonus.
 */
import type { ElementId } from '../schema.ts';

export type ArenaConditionId =
  | 'rain' | 'heat' | 'fog' | 'night' | 'sun' | 'storm'
  | 'sacred' | 'cursed' | 'swamp' | 'ice' | 'frenzy' | 'thinAir' | 'mana' | 'pit' | 'eclipse' | 'sandstorm' | 'eruption';

export interface ArenaCondition {
  /** Damage multiplier per element of the attack. */
  elements?: Partial<Record<ElementId, number>>;
  /** Damage multiplier per kind of attack. */
  kinds?: Partial<Record<'melee' | 'ranged' | 'spell', number>>;
  /** Added to the hit chance of ranged attacks. */
  rangedHit?: number;
  /** Added to the hit chance of melee attacks. */
  meleeHit?: number;
  /** Multiplier on every stamina cost. */
  staminaCost?: number;
  /** Multiplier on the stamina recovered each round (and when resting). */
  staminaRegen?: number;
  /** Multiplier on every heal (abilities, regeneration, life drain). */
  healing?: number;
  /** Multiplier on damage over time (poison, burns, bleeding…). */
  dot?: number;
  /** Added to every critical-hit chance. */
  critBonus?: number;
  /** Morale gained (or lost) by every creature on the sand each round. */
  moralePerRound?: number;
}

export const ARENA_CONFIG = {
  /** First week with conditions in the very first season (from the second season on: every week). */
  startWeek: 4,
  /** Chance of an ordinary day (no condition). */
  clearChance: 0.4,
  conditions: {
    rain: { elements: { water: 1.15, fire: 0.85 } },
    heat: { staminaCost: 1.15, elements: { fire: 1.1, water: 0.95 } },
    fog: { rangedHit: -0.12 },
    night: { elements: { shadow: 1.15, light: 0.9 } },
    sun: { elements: { light: 1.15, shadow: 0.9 } },
    storm: { elements: { air: 1.15 }, rangedHit: -0.06 },
    sacred: { healing: 1.25, elements: { light: 1.1 } },
    cursed: { healing: 0.7, elements: { shadow: 1.1 } },
    swamp: { dot: 1.3, elements: { nature: 1.1 } },
    ice: { meleeHit: -0.08, elements: { water: 1.1, fire: 0.9 } },
    frenzy: { moralePerRound: 3, critBonus: 0.05 },
    thinAir: { staminaRegen: 0.7, elements: { air: 1.1 } },
    mana: { kinds: { spell: 1.15 } },
    pit: { kinds: { melee: 1.12, ranged: 0.85 } },
    eclipse: { elements: { light: 0.8, fire: 0.9, shadow: 1.1 } },
    sandstorm: { elements: { earth: 1.15 }, rangedHit: -0.08 },
    eruption: { elements: { fire: 1.15 }, dot: 1.15 },
  } satisfies Record<ArenaConditionId, ArenaCondition> as Record<ArenaConditionId, ArenaCondition>,
};

export const ARENA_CONDITION_IDS = Object.keys(ARENA_CONFIG.conditions) as ArenaConditionId[];
