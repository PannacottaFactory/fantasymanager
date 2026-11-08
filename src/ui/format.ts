import { ELEMENTS } from '../data/elements.ts';
import { ROLES } from '../data/roles.ts';
import { SPECIES } from '../data/species.ts';
import type { RoleId } from '../data/schema.ts';

export const speciesName = (id: string) => SPECIES[id]?.name ?? id;
export const roleName = (id: RoleId) => ROLES[id]?.name ?? id;
export const roleShort: Record<RoleId, string> = { tank: 'TNK', striker: 'STR', support: 'SUP', caster: 'CST', skirmisher: 'SKR' };

/** Colour band for a 1–20 attribute. */
export function attrClass(v: number): string {
  if (v >= 17) return 'a5';
  if (v >= 14) return 'a4';
  if (v >= 10) return 'a3';
  if (v >= 6) return 'a2';
  return 'a1';
}

export function ratingClass(r: number): string {
  if (r >= 8) return 'r-great';
  if (r >= 7) return 'r-good';
  if (r >= 6) return 'r-mid';
  return 'r-bad';
}

export function speciesColor(id: string): string {
  const el = SPECIES[id]?.elements[0];
  return el ? ELEMENTS[el].color : '#777';
}

export function hpColor(frac: number): string {
  if (frac > 0.6) return 'var(--hp)';
  if (frac > 0.3) return 'var(--hp-mid)';
  return 'var(--hp-low)';
}

export function moraleLabel(m: number): string {
  if (m >= 80) return 'Fired up';
  if (m >= 60) return 'Confident';
  if (m >= 40) return 'Steady';
  if (m >= 25) return 'Shaken';
  return 'Panicking';
}

export function randomSeed(): string {
  return String(Math.floor(Math.random() * 1_000_000));
}
