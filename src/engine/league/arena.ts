/**
 * Arena conditions of a league / cup match (rain, heat, fog, night, sun, storm), drawn from the world seed and the
 * fixture — the same answer before the match (pre-match screen) and when it is played. None in the first weeks of the
 * first season, so a new manager learns the basics first.
 */
import { deriveSeed, Rng } from '../../core/rng.ts';
import { ARENA_CONDITION_IDS, type ArenaConditionId } from '../../data/config/arena.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { Fixture, GameState } from './types.ts';

/** Have arena conditions started for this game? */
export function arenaActive(state: GameState, week: number, cfg: GameConfig = DEFAULT_CONFIG): boolean {
  return state.season > 1 || week >= cfg.arena.startWeek;
}

export function arenaFor(state: GameState, fixture: Fixture, cfg: GameConfig = DEFAULT_CONFIG): ArenaConditionId | undefined {
  if (!arenaActive(state, fixture.matchday, cfg)) return undefined;
  const rng = new Rng(deriveSeed(state.worldSeed, 'arena', state.season, fixture.id));
  if (rng.chance(cfg.arena.clearChance)) return undefined;
  return rng.pick(ARENA_CONDITION_IDS);
}
