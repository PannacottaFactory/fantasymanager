/**
 * The player's season as a list of matches in play order (past and coming), grouped by week:
 * week 0 = pre-season, week d = league matchday d then the cup / tournament rounds keyed d (or d.5).
 * Display only — read from the game state, never changes it.
 */
import { DEFAULT_CONFIG } from '../data/config/index.ts';
import { cupDue, lastMatchday, teamById } from '../engine/league/season.ts';
import { midweekKey } from '../engine/league/tournaments.ts';
import type { Fixture, GameState } from '../engine/league/types.ts';
import { compDef, compName, divName, roundKey } from './competitions.ts';
import type { StringKey } from './i18n/strings.ts';

export interface SeasonItem {
  /** Order of play: d = league matchday d, d.01 = a round after it, d.5 = a later one. */
  key: number;
  week: number;
  league: boolean;
  /** 'league' or a competition definition (shadow, division, champions…). */
  def: string;
  /** Tournament id (undefined = the Shadow Cup or the league). */
  tournamentId?: string;
  division?: number;
  round?: number;
  rounds?: number;
  fixtureId?: string;
  opp?: string;
  played: boolean;
  outcome?: 'win' | 'loss';
  score?: [number, number];
  ko?: boolean;
  /** A later round the player only reaches by winning the current one. */
  maybe?: boolean;
  /** Current round, opponent not drawn yet. */
  tbd?: boolean;
}

const orderKey = (k: number) => (Number.isInteger(k) && k > 0 ? k + 0.01 : k);

export function playerSeason(game: GameState): SeasonItem[] {
  const me = game.playerTeamId;
  const items: SeasonItem[] = [];
  const mineF = (f: Fixture) => f.home === me || f.away === me;
  const played = (f: Fixture, base: Omit<SeasonItem, 'played' | 'opp' | 'fixtureId'>): SeasonItem => {
    const side = f.home === me ? 0 : 1;
    return {
      ...base,
      fixtureId: f.id,
      opp: teamById(game, side === 0 ? f.away : f.home).name,
      played: !!f.result,
      outcome: f.result ? (f.result.winner === side ? 'win' : 'loss') : undefined,
      score: f.result ? (side === 0 ? f.result.score : [f.result.score[1], f.result.score[0]]) : undefined,
      ko: f.result?.method === 'ko',
    };
  };
  for (const f of game.fixtures) {
    if (f.competition || !mineF(f)) continue;
    items.push(played(f, { key: f.matchday, week: f.matchday, league: true, def: 'league', division: f.division ?? 0 }));
  }
  const comps = [
    { id: undefined as string | undefined, keys: DEFAULT_CONFIG.league.cup.after as readonly number[], round: game.cup.round, rounds: game.cup.rounds, entrants: null as string[] | null, alive: game.cup.alive, winner: game.cup.winner, fixtures: game.fixtures.filter((f) => f.competition === 'cup') },
    ...(game.tournaments ?? []).map((x) => ({ id: x.id as string | undefined, keys: x.keys, round: x.round, rounds: x.rounds, entrants: x.entrants, alive: x.alive, winner: x.winner, fixtures: game.fixtures.filter((f) => f.tournamentId === x.id) })),
  ];
  for (const c of comps) {
    if (c.entrants && !c.entrants.includes(me)) continue;
    const def = compDef(c.id);
    const base = (r: number) => {
      const k = c.keys[r] ?? 0;
      return { key: orderKey(k), week: Math.floor(k), league: false, def, tournamentId: c.id, round: r, rounds: c.rounds };
    };
    for (const f of c.fixtures) if (mineF(f) && f.result) items.push(played(f, base(f.round ?? 0)));
    if (c.winner || !c.alive.includes(me)) continue;
    for (let r = c.round; r < c.rounds; r++) {
      if (c.keys[r] === undefined) continue;
      const tie = c.fixtures.find((f) => !f.result && f.round === r && mineF(f));
      if (tie) items.push({ ...played(tie, base(r)), maybe: r > c.round });
      else items.push({ ...base(r), played: false, maybe: r > c.round, tbd: r === c.round });
    }
  }
  return items.sort((a, b) => a.key - b.key);
}

/** Matches grouped by week, in order. */
export function byWeek(items: SeasonItem[]): { week: number; items: SeasonItem[] }[] {
  const weeks: { week: number; items: SeasonItem[] }[] = [];
  for (const x of items) {
    const last = weeks.at(-1);
    if (last && last.week === x.week) last.items.push(x);
    else weeks.push({ week: x.week, items: [x] });
  }
  return weeks;
}

/**
 * Last week fully played (−1 = pre-season still running). A week is over once its league matchday and every
 * round keyed to it have been played.
 */
export function completedWeek(game: GameState): number {
  if (cupDue(game)) return Math.floor(midweekKey(game) ?? 0) - 1;
  return Math.min(game.matchday - 1, lastMatchday(game));
}

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/** « Marches League » or « Shadow Cup · Quarter-finals ». */
export function itemLabel(t: T, x: SeasonItem): string {
  return x.league ? divName(t, x.division ?? 0) : `${compName(t, x.tournamentId)} · ${t(roundKey(x.round ?? 0, x.rounds ?? 1))}`;
}
