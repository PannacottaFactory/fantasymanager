import { ELEMENTS } from '../data/elements.ts';
import { SPECIES } from '../data/species.ts';
import type { StringKey } from './i18n/strings.ts';

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

export function fatigueColor(f: number): string {
  if (f >= 60) return 'var(--bad)';
  if (f >= 35) return 'var(--warn)';
  return 'var(--good)';
}

export function moraleKey(m: number): StringKey {
  if (m >= 80) return 'morale.firedUp';
  if (m >= 60) return 'morale.confident';
  if (m >= 40) return 'morale.steady';
  if (m >= 25) return 'morale.shaken';
  return 'morale.panicking';
}

/** Colour of a morale level (same bands as moraleKey): fired up = bright green … panicking = red. */
export function moraleColor(m: number): string {
  if (m >= 80) return 'var(--a5)';
  if (m >= 60) return 'var(--a4)';
  if (m >= 40) return 'var(--a3)';
  if (m >= 25) return 'var(--a2)';
  return 'var(--a1)';
}

/** Two-letter monogram of a creature: initials of the first two words, or its first two letters. */
export function initials(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const w = words[0] ?? '?';
  return (w[0]!.toUpperCase() + (w[1] ?? '')).slice(0, 2);
}

export function randomSeed(): string {
  return String(Math.floor(Math.random() * 1_000_000));
}
