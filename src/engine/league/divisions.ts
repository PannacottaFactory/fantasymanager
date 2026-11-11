/** Division helpers shared by the season flow, the economy and the board. */
import type { GameState } from './types.ts';

export function divisionOf(state: GameState, teamId: string): number {
  const d = (state.divisions ?? []).findIndex((ids) => ids.includes(teamId));
  return d < 0 ? 0 : d;
}

/** League fixtures of a division. */
export const divisionFixtures = (state: GameState, division: number) => state.fixtures.filter((f) => !f.competition && (f.division ?? 0) === division);
