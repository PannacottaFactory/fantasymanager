import type { Lang } from '../../core/i18n.ts';
import type { Rng } from '../../core/rng.ts';
import { FR_SURNAMES, FR_TEAM_NAME_PARTS } from '../../data/i18n/fr.ts';
import { NAME_CULTURES, TEAM_NAME_PARTS } from '../../data/names.ts';

/** Creature name. The language only changes the surname wording; the RNG draws are identical. */
export function generateName(rng: Rng, cultureId: string, lang: Lang = 'en'): string {
  const c = NAME_CULTURES[cultureId];
  if (!c) throw new Error(`Unknown name culture ${cultureId}`);
  let name: string;
  if (c.style === 'compound') {
    name = rng.pick(c.starts) + rng.pick(c.ends);
  } else {
    const mid = c.middles && rng.chance(c.middleChance ?? 0) ? rng.pick(c.middles) : '';
    name = rng.pick(c.starts) + mid + rng.pick(c.ends);
  }
  if (c.surnames && rng.chance(c.surnameChance ?? 0)) {
    const i = rng.int(0, c.surnames.length - 1);
    const fr = FR_SURNAMES[cultureId];
    name += ' ' + (lang === 'fr' && fr?.[i] ? fr[i] : c.surnames[i]);
  }
  return name;
}

/** Stable name ("Iron Fangs", "Hounds of Skarn" / "Crocs de Fer", "Molosses de Skarn"). Same draws in every language. */
export function generateTeamName(rng: Rng, lang: Lang = 'en'): string {
  const p = TEAM_NAME_PARTS;
  const byPlace = !rng.chance(0.5);
  const i = rng.int(0, p.adjectives.length - 1);
  const j = rng.int(0, p.nouns.length - 1);
  const k = rng.int(0, p.places.length - 1);
  if (lang === 'fr') {
    const f = FR_TEAM_NAME_PARTS;
    const [noun, gender] = f.nouns[j % f.nouns.length]!;
    if (byPlace) return `${noun} ${f.places[k % f.places.length]}`;
    const adj = f.adjectives[i % f.adjectives.length]!;
    return `${noun} ${gender === 'f' ? adj[1] : adj[0]}`;
  }
  return byPlace ? `${p.nouns[j]} of ${p.places[k]}` : `${p.adjectives[i]} ${p.nouns[j]}`;
}
