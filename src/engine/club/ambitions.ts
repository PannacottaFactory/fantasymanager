/**
 * Ambitions: long-term goals of a career (first win, promotion, cup, titles…), from the first weeks to a dynasty.
 * Checked after every week and at the season change; each one is reached once (`GameState.ambitions`), with an
 * inbox message. Seasons are logged in `GameState.career` when the league ends.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { FACILITY_IDS } from '../../data/config/club.ts';
import { divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import type { GameState, SeasonRecord } from '../league/types.ts';
import { levelOf } from '../progression/levels.ts';

export const AMBITION_IDS = [
  'firstWin',
  'topHalf',
  'firstTrophy',
  'promotion',
  'cupRun',
  'star',
  'royal',
  'crown',
  'topFlight',
  'survive',
  'builder',
  'cupWin',
  'champion',
  'championsCup',
  'double',
  'dynasty',
] as const;
export type AmbitionId = (typeof AMBITION_IDS)[number];

/** Level a creature must reach for "star". */
export const STAR_LEVEL = 8;
/** D1 titles for "dynasty". */
export const DYNASTY_TITLES = 3;

const career = (s: GameState): SeasonRecord[] => s.career ?? [];

/** Whether an ambition is met by the current state (and the seasons logged so far). */
function met(s: GameState, id: AmbitionId, cfg: GameConfig): boolean {
  const me = s.playerTeamId;
  const size = (d: number) => s.divisions[d]?.length ?? 10;
  const d1Titles = career(s).filter((r) => r.division === 0 && r.position === 1);
  const won = (def: string) => career(s).some((r) => r.trophies?.includes(def)) || (s.tournaments ?? []).some((t) => t.def === def && t.winner === me);
  const div = divisionOf(s, me);
  switch (id) {
    case 'firstTrophy':
      return s.cup.winner === me || career(s).some((r) => r.cupWon || (r.trophies ?? []).some((x) => x !== 'preseason')) || (s.tournaments ?? []).some((t) => t.kind !== 'preseason' && t.winner === me);
    case 'royal':
      return div <= 1;
    case 'topFlight':
      return div === 0;
    case 'crown':
      return won('or');
    case 'championsCup':
      return won('champions');
    case 'firstWin':
      return s.fixtures.some((f) => f.result && ((f.home === me && f.result.winner === 0) || (f.away === me && f.result.winner === 1)));
    case 'topHalf':
      return career(s).some((r) => r.position <= size(r.division) / 2);
    case 'cupRun':
      // Into the semi-finals (or beyond).
      return s.cup.winner === me || (s.cup.alive.includes(me) && s.cup.alive.length <= 4);
    case 'promotion':
      return div < cfg.league.playerDivision;
    case 'star':
      return s.teams.find((t) => t.id === me)!.creatures.some((c) => levelOf(c, cfg) >= STAR_LEVEL);
    case 'survive':
      return career(s).some((r) => r.division === 0 && r.position <= size(0) - cfg.league.promoted);
    case 'builder': {
      const f = s.facilities[me];
      return !!f && FACILITY_IDS.every((k) => f[k].level >= cfg.club.facilities.maxLevel);
    }
    case 'cupWin':
      return s.cup.winner === me || career(s).some((r) => r.cupWon);
    case 'champion':
      return d1Titles.length > 0;
    case 'double':
      return d1Titles.some((r) => r.cupWon);
    case 'dynasty':
      return d1Titles.length >= DYNASTY_TITLES;
  }
}

/** Progress towards an ambition, when it has a count (e.g. titles 1 / 3). */
export function ambitionProgress(s: GameState, id: AmbitionId): { n: number; of: number } | null {
  if (id === 'dynasty') return { n: career(s).filter((r) => r.division === 0 && r.position === 1).length, of: DYNASTY_TITLES };
  return null;
}

/** Marks newly reached ambitions (in order) and tells the player. Mutates. */
export function checkAmbitions(s: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  s.ambitions ??= {};
  for (const id of AMBITION_IDS) {
    if (s.ambitions[id] !== undefined || !met(s, id, cfg)) continue;
    s.ambitions[id] = s.season;
    pushMessage(s, { kind: 'ambition', ambition: id });
  }
}

/** Logs the season that just ended for the player (league position, cup). Mutates. */
export function recordSeason(s: GameState, division: number, position: number, points: number, trophies: string[] = []) {
  s.career ??= [];
  if (s.career.some((r) => r.season === s.season)) return;
  s.career.push({ season: s.season, division, position, points, cupWon: s.cup.winner === s.playerTeamId, trophies });
}
