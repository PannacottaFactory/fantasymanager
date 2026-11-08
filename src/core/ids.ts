import type { Rng } from './rng.ts';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Deterministic id (prefix + 8 base36 chars) drawn from the given rng. */
export function makeId(rng: Rng, prefix: string): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[rng.int(0, ALPHABET.length - 1)];
  return `${prefix}_${s}`;
}
