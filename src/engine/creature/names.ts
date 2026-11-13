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

/** Kinds of stable names, with their weights. */
const TEAM_NAME_KINDS = [
  ['adjective', 24],
  ['place', 14],
  ['order', 20],
  ['orderPlace', 10],
  ['standalone', 22],
  ['figure', 10],
] as const;

/**
 * Stable name: "Iron Fangs", "Hounds of Skarn", "Order of the Broken Tusk", "Legion of Skarn", "Gravewind",
 * "Mother Gorza's Brood" (French: "Crocs de Fer", "Ordre de la Défense Brisée", "Couvée de Mère Gorza"…).
 * Always the same draws whatever the kind and the language (indices are taken modulo each list).
 */
export function generateTeamName(rng: Rng, lang: Lang = 'en'): string {
  const kind = rng.weighted(TEAM_NAME_KINDS, (k) => k[1])[0];
  const a = rng.int(0, 9999);
  const b = rng.int(0, 9999);
  const at = <T,>(list: readonly T[], n: number) => list[n % list.length]!;
  if (lang === 'fr') {
    const f = FR_TEAM_NAME_PARTS;
    switch (kind) {
      case 'adjective': {
        const [noun, gender] = at(f.nouns, a);
        const adj = at(f.adjectives, b);
        return `${noun} ${gender === 'f' ? adj[1] : adj[0]}`;
      }
      case 'place': return `${at(f.nouns, a)[0]} ${at(f.places, b)}`;
      case 'order': return `${at(f.orders, a)} ${at(f.emblems, b)}`;
      case 'orderPlace': return `${at(f.orders, a)} ${at(f.places, b)}`;
      case 'standalone': return at(f.standalone, a);
      case 'figure': return `${at(f.troupes, a)} ${at(f.figures, b)}`;
    }
  }
  const p = TEAM_NAME_PARTS;
  switch (kind) {
    case 'adjective': return `${at(p.adjectives, b)} ${at(p.nouns, a)}`;
    case 'place': return `${at(p.nouns, a)} of ${at(p.places, b)}`;
    case 'order': return `${at(p.orders, a)} of ${at(p.emblems, b)}`;
    case 'orderPlace': return `${at(p.orders, a)} of ${at(p.places, b)}`;
    case 'standalone': return at(p.standalone, a);
    case 'figure': {
      const who = at(p.figures, b);
      return `${who.charAt(0).toUpperCase()}${who.slice(1)}'s ${at(p.troupes, a)}`;
    }
  }
}
