import type { Rng } from '../../core/rng.ts';
import { NAME_CULTURES, TEAM_NAME_PARTS } from '../../data/names.ts';

export function generateName(rng: Rng, cultureId: string): string {
  const c = NAME_CULTURES[cultureId];
  if (!c) throw new Error(`Unknown name culture ${cultureId}`);
  let name: string;
  if (c.style === 'compound') {
    name = rng.pick(c.starts) + rng.pick(c.ends);
  } else {
    const mid = c.middles && rng.chance(c.middleChance ?? 0) ? rng.pick(c.middles) : '';
    name = rng.pick(c.starts) + mid + rng.pick(c.ends);
  }
  if (c.surnames && rng.chance(c.surnameChance ?? 0)) name += ' ' + rng.pick(c.surnames);
  return name;
}

export function generateTeamName(rng: Rng): string {
  const p = TEAM_NAME_PARTS;
  return rng.chance(0.5)
    ? `${rng.pick(p.adjectives)} ${rng.pick(p.nouns)}`
    : `${rng.pick(p.nouns)} of ${rng.pick(p.places)}`;
}
