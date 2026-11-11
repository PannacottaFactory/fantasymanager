/** The player renames one of its creatures (its id stays: relations, history and replays keep following it). */
import type { GameState } from '../league/types.ts';

export const MAX_NAME_LENGTH = 30;

export function renameCreature(state: GameState, creatureId: string, name: string): GameState {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const c = team?.creatures.find((x) => x.id === creatureId);
  if (!c || !clean || clean === c.name) return state;
  const next = structuredClone(state);
  next.teams.find((t) => t.id === next.playerTeamId)!.creatures.find((x) => x.id === creatureId)!.name = clean;
  return next;
}
