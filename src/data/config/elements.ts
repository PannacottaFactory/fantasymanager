import type { ElementId } from '../schema.ts';

/** Elemental matchups: STRONG[attacker] lists the defender elements it is strong against. */
export const ELEMENT_CONFIG = {
  strongMult: 1.5,
  weakMult: 0.67,
  /** Final multiplier clamp when a defender has two elements. */
  minMult: 0.45,
  maxMult: 2.0,
  strong: {
    fire: ['nature', 'air'],
    water: ['fire', 'earth'],
    earth: ['fire', 'light'],
    air: ['nature', 'water'],
    nature: ['water', 'earth'],
    shadow: ['light', 'nature'],
    light: ['shadow', 'air'],
  } as Record<ElementId, ElementId[]>,
  weak: {
    fire: ['water', 'earth'],
    water: ['nature', 'air'],
    earth: ['nature', 'air'],
    air: ['earth', 'light'],
    nature: ['fire', 'shadow'],
    shadow: ['shadow'],
    light: ['earth', 'light'],
  } as Record<ElementId, ElementId[]>,
};

export type ElementConfig = typeof ELEMENT_CONFIG;
