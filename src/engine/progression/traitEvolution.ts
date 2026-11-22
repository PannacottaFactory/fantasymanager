/**
 * Traits that change after matches, at random. After each match, with `chance`, one creature of the stable among
 * those that played gains a trait (`gainShare`) or loses one. A gain never sits beside an opposite trait; a creature
 * already holding `maxTraits` loses another one at random. Own RNG stream per match and stable: it never changes a
 * match result.
 */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { TraitChangeKind } from '../../data/config/traits.ts';
import { TRAITS } from '../../data/traits.ts';
import type { MatchResult, Side } from '../combat/types.ts';
import type { GameState } from '../league/types.ts';
import type { Creature, Team, TraitChange } from '../model.ts';

/** Traits the creature could take now: not held, no opposite held. */
export function gainableTraits(c: Creature): string[] {
  return Object.keys(TRAITS).filter(
    (id) => !c.traits.includes(id) && !c.traits.some((o) => TRAITS[id]!.excludes?.includes(o) || TRAITS[o]?.excludes?.includes(id)),
  );
}

/** Kind of a change (the message's sentence). */
export function changeKind(traitId: string, gained: boolean): TraitChangeKind {
  const p = TRAITS[traitId]?.polarity ?? 'mixed';
  const k = p === 'positive' ? 'Good' : p === 'negative' ? 'Bad' : 'Mixed';
  return `${gained ? 'gained' : 'lost'}${k}`;
}

/** Draws a change for this creature (null = none possible). */
export function drawTraitChange(rng: Rng, c: Creature, cfg: GameConfig = DEFAULT_CONFIG): Omit<TraitChange, 's' | 'w'> | null {
  const te = cfg.traitEvolution;
  const options = gainableTraits(c);
  const gain = options.length > 0 && (c.traits.length === 0 || rng.chance(te.gainShare));
  const line = rng.int(1, te.lines);
  if (gain) {
    const t = rng.pick(options);
    const replaced = c.traits.length >= te.maxTraits ? rng.pick(c.traits) : undefined;
    return { t, gained: true, line, ...(replaced ? { replaced } : {}) };
  }
  if (!c.traits.length) return null;
  return { t: rng.pick(c.traits), gained: false, line };
}

/** A creature's traits change (mutates). */
export function applyTraitChange(state: GameState, c: Creature, ch: Omit<TraitChange, 's' | 'w'>): TraitChange {
  if (ch.gained) c.traits = [...c.traits.filter((t) => t !== ch.replaced), ch.t];
  else c.traits = c.traits.filter((t) => t !== ch.t);
  const log = (c.traitLog ??= []);
  const entry: TraitChange = { ...ch, s: state.season, w: state.matchday };
  log.push(entry);
  if (log.length > 12) log.splice(0, log.length - 12);
  return entry;
}

/** After one match of a stable (mutates): maybe one trait change. Returns it (null = none). */
export function evolveTraits(state: GameState, team: Team, result: MatchResult, side: Side, matchKey: string, cfg: GameConfig = DEFAULT_CONFIG): { creature: Creature; change: TraitChange } | null {
  const rng = new Rng(deriveSeed(state.worldSeed, 'traits', state.season, matchKey, team.id));
  if (!rng.chance(cfg.traitEvolution.chance)) return null;
  const played = team.creatures.filter((c) => result.postMatch.some((pm) => pm.creatureId === c.id && pm.played && result.roster[c.id]?.side === side));
  if (!played.length) return null;
  const c = rng.pick(played);
  const ch = drawTraitChange(rng, c, cfg);
  return ch ? { creature: c, change: applyTraitChange(state, c, ch) } : null;
}

/** Traits a creature gained in the last `newWeeks` weeks of this season (UI « new » tag). */
export function newTraits(c: Creature, season: number, week: number, cfg: GameConfig = DEFAULT_CONFIG): Set<string> {
  const out = new Set<string>();
  for (const x of c.traitLog ?? []) if (x.gained && x.s === season && week - x.w < cfg.traitEvolution.newWeeks && c.traits.includes(x.t)) out.add(x.t);
  return out;
}
