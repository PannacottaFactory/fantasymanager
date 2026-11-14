/**
 * The board: a season objective and a confidence that moves with results and the table. Its mood sets the recruitment
 * budget and facility works; an angry board issues an ultimatum. No sacking (career mode will add it).
 */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { clubOf, earn } from '../economy/finance.ts';
import { divisionFixtures, divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import { computeStandings } from '../league/standings.ts';
import type { BoardMood, Fixture, GameState, ObjectiveId } from '../league/types.ts';
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
  state.board.mood ??= boardMood(state, cfg);
  pushMessage(state, { kind: 'boardObjective', objective: state.board.objective, division: divisionOf(state, state.playerTeamId) });
}

/** The board is more or less forgiving depending on the difficulty. */
const lossMult = (state: GameState, cfg: GameConfig) => cfg.identity.difficulties[state.difficulty ?? 'normal'].boardLoss;

/** Mood of the board for a confidence. */
export function moodOf(confidence: number, cfg: GameConfig = DEFAULT_CONFIG): BoardMood {
  const m = cfg.club.board.moods;
  return confidence >= m.delighted ? 'delighted' : confidence >= m.content ? 'content' : confidence >= m.uneasy ? 'uneasy' : 'angry';
}

export const boardMood = (state: GameState, cfg: GameConfig = DEFAULT_CONFIG) => moodOf(state.board.confidence, cfg);

/** Most the board lets the player spend on one purchase (fee or signing bonus); 0 while recruitment is frozen. */
export function recruitmentBudget(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): number {
  if ((state.board.frozen ?? 0) > 0) return 0;
  const balance = Math.max(0, clubOf(state, state.playerTeamId).balance);
  return Math.floor(balance * cfg.club.board.budget[boardMood(state, cfg)]);
}

/** Facility works: cost multiplier, or null when the board refuses any new works. */
export function worksFactor(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): number | null {
  const mood = boardMood(state, cfg);
  return mood === 'angry' ? null : mood === 'delighted' ? cfg.club.board.worksDelighted : 1;
}

/** Last place that still meets the objective in a division of `size`. */
export function objectiveTarget(objective: ObjectiveId, size: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  for (let p = size; p >= 1; p--) if (objectiveMet(objective, p, size, cfg)) return p;
  return 1;
}

/** Current place of the player in its division. */
export function playerPosition(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): { position: number; size: number } {
  const div = divisionOf(state, state.playerTeamId);
  const ids = state.divisions[div]!;
  const table = computeStandings(ids, divisionFixtures(state, div), cfg);
  return { position: table.findIndex((r) => r.teamId === state.playerTeamId) + 1, size: ids.length };
}

function shift(state: GameState, d: number) {
  state.board.confidence = clamp(Math.round(state.board.confidence + d), 0, 100);
}

/**
 * After any change of confidence: announces a new mood and, when the board turns angry, issues an ultimatum (unless one
 * is running, one was just settled, or the season is over).
 */
function settle(state: GameState, cfg: GameConfig, canIssue = true) {
  const mood = boardMood(state, cfg);
  const before = state.board.mood;
  if (before && before !== mood) pushMessage(state, { kind: 'boardMood', from: before, to: mood, confidence: state.board.confidence });
  state.board.mood = mood;
  const u = cfg.club.board.ultimatum;
  if (canIssue && mood === 'angry' && !state.board.ultimatum && !(state.board.cooldown ?? 0)) {
    state.board.ultimatum = { need: u.need, of: u.of, wins: 0, played: 0 };
    pushMessage(state, { kind: 'ultimatum', need: u.need, of: u.of });
  }
}

/** One match of the player during an ultimatum. */
function ultimatumMatch(state: GameState, won: boolean, cfg: GameConfig) {
  const t = state.board.ultimatum;
  if (!t) return;
  const u = cfg.club.board.ultimatum;
  t.played++;
  if (won) t.wins++;
  const met = t.wins >= t.need;
  const lost = t.played - t.wins > t.of - t.need;
  if (!met && !lost) return;
  delete state.board.ultimatum;
  state.board.cooldown = u.cooldown;
  if (met) {
    shift(state, u.reward);
    pushMessage(state, { kind: 'ultimatumOver', met: true, wins: t.wins, need: t.need, of: t.of, reputation: 0, frozen: 0 });
  } else {
    const club = clubOf(state, state.playerTeamId);
    club.reputation = clamp(club.reputation - u.reputation, 0, 100);
    state.board.frozen = u.frozenWeeks;
    pushMessage(state, { kind: 'ultimatumOver', met: false, wins: t.wins, need: t.need, of: t.of, reputation: u.reputation, frozen: u.frozenWeeks });
  }
}

/** Results of the player's matches this week move the board's confidence (and an ultimatum's count). */
export function weeklyBoard(state: GameState, played: Fixture[], cfg: GameConfig = DEFAULT_CONFIG) {
  const b = cfg.club.board;
  let any = false;
  for (const f of played) {
    const side = f.home === state.playerTeamId ? 0 : f.away === state.playerTeamId ? 1 : -1;
    if (side < 0 || !f.result) continue;
    any = true;
    const won = f.result.winner === side;
    const raw = won ? (f.result.method === 'ko' ? b.result.koWin : b.result.pointsWin) : f.result.method === 'ko' ? b.result.koLoss : b.result.pointsLoss;
    shift(state, raw < 0 ? raw * lossMult(state, cfg) : raw);
    // An ultimatum counts league matches only (cup draws against stronger divisions would be unfair).
    if (!f.competition) ultimatumMatch(state, won, cfg);
  }
  if (!any) return;
  settle(state, cfg);
  state.board.trend = [...(state.board.trend ?? []), state.board.confidence].slice(-cfg.club.board.trendWeeks);
}

/**
 * End of a league week: the table against the objective moves the confidence; countdowns (frozen recruitment, time
 * before another ultimatum) run down.
 */
export function weeklyBoardStanding(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const s = cfg.club.board.standing;
  if (state.board.frozen) state.board.frozen--;
  if (state.board.cooldown) state.board.cooldown--;
  if (state.matchday < s.from) return;
  const { position, size } = playerPosition(state, cfg);
  const target = objectiveTarget(state.board.objective, size, cfg);
  const d = position <= target ? s.onTarget : position - target >= s.behind ? s.offTarget * lossMult(state, cfg) : 0;
  if (!d) return;
  shift(state, d);
  settle(state, cfg);
  const tr = state.board.trend;
  if (tr?.length) tr[tr.length - 1] = state.board.confidence;
}

/** End of season: the board judges the objective; meeting it brings a bonus. */
export function boardVerdict(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const b = cfg.club.board;
  const div = divisionOf(state, state.playerTeamId);
  const ids = state.divisions[div]!;
  const table = computeStandings(ids, divisionFixtures(state, div), cfg);
  const position = table.findIndex((r) => r.teamId === state.playerTeamId) + 1;
  const met = objectiveMet(state.board.objective, position, ids.length, cfg);
  state.board.confidence = clamp(Math.round(state.board.confidence + (met ? b.met : b.missed * lossMult(state, cfg))), 0, 100);
  // The season is over: a running ultimatum lapses; the next one may come with the new season.
  delete state.board.ultimatum;
  settle(state, cfg, false);
  const bonus = met ? Math.round(b.bonus * (cfg.league.divisionMoney[div] ?? 1)) : 0;
  if (bonus) earn(state, state.playerTeamId, 'prizes', bonus);
  pushMessage(state, { kind: 'boardVerdict', objective: state.board.objective, met, position, bonus, confidence: state.board.confidence });
}
