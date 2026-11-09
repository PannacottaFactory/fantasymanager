/** The board: a season objective for the player and a confidence that moves with results (no sacking). */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { earn } from '../economy/finance.ts';
import { divisionFixtures, divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import { computeStandings } from '../league/standings.ts';
import type { Fixture, GameState, ObjectiveId } from '../league/types.ts';
export { divisionOf };
import type { Team } from '../model.ts';

/** Strength used to rank stables before a season: average ability of the eight best creatures. */
export function teamStrength(team: Team): number {
  const best = [...team.creatures].sort((a, b) => b.ability - a.ability).slice(0, 8);
  return best.reduce((s, c) => s + c.ability, 0) / Math.max(1, best.length);
}

/** Objective from the expected rank inside the division. */
export function pickObjective(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): ObjectiveId {
  const div = divisionOf(state, state.playerTeamId);
  const ids = state.divisions[div]!;
  const ranked = ids
    .map((id) => state.teams.find((t) => t.id === id)!)
    .sort((a, b) => teamStrength(b) - teamStrength(a) || a.id.localeCompare(b.id));
  const rank = ranked.findIndex((t) => t.id === state.playerTeamId) + 1;
  const n = ids.length;
  const promoted = cfg.league.promoted;
  if (div === 0) return rank === 1 ? 'title' : rank <= n / 2 - 1 ? 'topHalf' : rank <= n - promoted - 1 ? 'midTable' : 'survive';
  return rank <= promoted ? 'promotion' : rank <= n / 2 ? 'topHalf' : 'midTable';
}

/** Is the objective met at this final position? */
export function objectiveMet(objective: ObjectiveId, position: number, size: number, cfg: GameConfig = DEFAULT_CONFIG): boolean {
  const promoted = cfg.league.promoted;
  switch (objective) {
    case 'title':
      return position === 1;
    case 'promotion':
      return position <= promoted;
    case 'topHalf':
      return position <= size / 2;
    case 'midTable':
      return position <= size - 3;
    case 'survive':
      return position <= size - promoted;
  }
}

export function newSeasonObjective(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  state.board.objective = pickObjective(state, cfg);
  pushMessage(state, { kind: 'boardObjective', objective: state.board.objective, division: divisionOf(state, state.playerTeamId) });
}

/** Results of the player's matches this week move the board's confidence. */
export function weeklyBoard(state: GameState, played: Fixture[], cfg: GameConfig = DEFAULT_CONFIG) {
  const b = cfg.club.board;
  for (const f of played) {
    const side = f.home === state.playerTeamId ? 0 : f.away === state.playerTeamId ? 1 : -1;
    if (side < 0 || !f.result) continue;
    const won = f.result.winner === side;
    const d = won ? (f.result.method === 'ko' ? b.result.koWin : b.result.pointsWin) : f.result.method === 'ko' ? b.result.koLoss : b.result.pointsLoss;
    const before = state.board.confidence;
    state.board.confidence = clamp(before + d, 0, 100);
    if (before >= b.warning && state.board.confidence < b.warning) pushMessage(state, { kind: 'boardWarning', confidence: state.board.confidence });
  }
}

/** End of season: the board judges the objective; meeting it brings a bonus. */
export function boardVerdict(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const b = cfg.club.board;
  const div = divisionOf(state, state.playerTeamId);
  const ids = state.divisions[div]!;
  const table = computeStandings(ids, divisionFixtures(state, div), cfg);
  const position = table.findIndex((r) => r.teamId === state.playerTeamId) + 1;
  const met = objectiveMet(state.board.objective, position, ids.length, cfg);
  state.board.confidence = clamp(state.board.confidence + (met ? b.met : b.missed), 0, 100);
  const bonus = met ? Math.round(b.bonus * (cfg.league.divisionMoney[div] ?? 1)) : 0;
  if (bonus) earn(state, state.playerTeamId, 'prizes', bonus);
  pushMessage(state, { kind: 'boardVerdict', objective: state.board.objective, met, position, bonus, confidence: state.board.confidence });
}
