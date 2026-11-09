/** League news feed: notable results, streaks, leaders, big transfers, star injuries… (pure, mutating). */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { MatchResult } from '../combat/types.ts';
import { creatureValue } from '../economy/value.ts';
import { divisionFixtures } from './divisions.ts';
import { computeStandings } from './standings.ts';
import type { Fixture, GameState, NewsItem, StandingRow } from './types.ts';

type NewsBody = NewsItem extends infer N ? (N extends NewsItem ? Omit<N, 'id' | 'season' | 'matchday'> : never) : never;

export function addNews(state: GameState, body: NewsBody, cfg: GameConfig = DEFAULT_CONFIG) {
  state.news.push({ ...body, id: `n${state.nextId++}`, season: state.season, matchday: state.matchday } as NewsItem);
  if (state.news.length > cfg.club.news.keep) state.news = state.news.slice(-cfg.club.news.keep);
}

const nameOf = (state: GameState, id: string) => state.teams.find((t) => t.id === id)?.name ?? '?';

/** Standings of every division (league fixtures only). */
export function divisionTables(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): StandingRow[][] {
  return state.divisions.map((ids, d) => computeStandings(ids, divisionFixtures(state, d), cfg));
}

/** News from a batch of played fixtures, given the tables before them. */
export function newsFromResults(
  state: GameState,
  played: { fixture: Fixture; result: MatchResult }[],
  before: StandingRow[][],
  cfg: GameConfig = DEFAULT_CONFIG,
) {
  const n = cfg.club.news;
  const rank = (id: string) => {
    for (const [d, table] of before.entries()) {
      const i = table.findIndex((r) => r.teamId === id);
      if (i >= 0) return d * 100 + i;
    }
    return 999;
  };
  for (const { fixture: f } of played) {
    const r = f.result;
    if (!r) continue;
    const winner = r.winner === 0 ? f.home : f.away;
    const loser = r.winner === 0 ? f.away : f.home;
    const cup = f.competition === 'cup';
    const gap = rank(winner) - rank(loser);
    const upset = cup ? Math.floor(rank(winner) / 100) > Math.floor(rank(loser) / 100) : gap >= n.upsetPlaces && state.matchday > 3;
    if (upset) addNews(state, { kind: 'upset', winner: nameOf(state, winner), loser: nameOf(state, loser), cup }, cfg);
    else if (r.method === 'ko' && r.rounds <= n.quickKoRounds) addNews(state, { kind: 'quickKo', winner: nameOf(state, winner), loser: nameOf(state, loser), rounds: r.rounds }, cfg);
  }
  // Streaks and new leaders (league weeks only).
  if (played.some((p) => p.fixture.competition === 'cup')) return;
  const after = divisionTables(state, cfg);
  after.forEach((table, d) => {
    const leader = table[0];
    if (leader && before[d]?.[0] && before[d]![0]!.teamId !== leader.teamId && state.matchday > 2) {
      addNews(state, { kind: 'leader', team: nameOf(state, leader.teamId), division: d }, cfg);
    }
    for (const row of table) {
      let wins = 0;
      for (let i = row.form.length - 1; i >= 0 && (row.form[i] === 'W' || row.form[i] === 'w'); i--) wins++;
      if (n.streaks.includes(wins) && row.form.length > 0 && (row.form[row.form.length - 1] === 'W' || row.form[row.form.length - 1] === 'w')) {
        addNews(state, { kind: 'streak', team: nameOf(state, row.teamId), wins }, cfg);
      }
    }
  });
}

/** Most valuable creatures of the league (top 10 %), for star news. */
export function isStar(state: GameState, creatureId: string): boolean {
  const all = state.teams.flatMap((t) => t.creatures).map((c) => ({ id: c.id, v: creatureValue(c) }));
  all.sort((a, b) => b.v - a.v);
  const top = all.slice(0, Math.max(1, Math.round(all.length / 10)));
  return top.some((x) => x.id === creatureId);
}
