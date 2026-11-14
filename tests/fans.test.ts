import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { fansDrift, fansOf, fansTicketFactor, tierOf, weeklyFans } from '../src/engine/club/fans.ts';
import { ticketRevenue } from '../src/engine/economy/finance.ts';
import { newGame, playMatchday } from '../src/engine/league/season.ts';
import type { Fixture, GameState } from '../src/engine/league/types.ts';

const F = DEFAULT_CONFIG.club.fans;
const game = (seed = 'fans') => newGame({ seed, teamName: 'Test', lang: 'en' });
let n = 0;
const match = (g: GameState, home: boolean, won: boolean, ko = false): Fixture => {
  const opp = g.teams.find((t) => t.id !== g.playerTeamId)!.id;
  const side = home ? 0 : 1;
  return {
    id: `f${n++}`,
    home: home ? g.playerTeamId : opp,
    away: home ? opp : g.playerTeamId,
    result: { winner: won ? side : 1 - side, method: ko ? 'ko' : 'points' },
  } as unknown as Fixture;
};

describe('supporters', () => {
  it('start at the usual mood: tickets unchanged', () => {
    const g = game();
    expect(fansOf(g).mood).toBe(F.start);
    expect(fansTicketFactor(g)).toBeCloseTo(1, 5);
  });

  it('a KO win at home moves them more than a win away; defeats sink them', () => {
    const a = game();
    weeklyFans(a, [match(a, true, true, true)]);
    const b = game();
    weeklyFans(b, [match(b, false, true)]);
    expect(fansOf(a).mood - F.start).toBe(F.result.home.koWin);
    expect(fansOf(b).mood - F.start).toBe(F.result.away.pointsWin);
    const c = game();
    weeklyFans(c, [match(c, true, false, true)]);
    expect(fansOf(c).mood).toBe(F.start + F.result.home.koLoss);
  });

  it('a winning run adds a bonus from the third win', () => {
    const g = game();
    for (let i = 0; i < F.streak.from; i++) weeklyFans(g, [match(g, false, true)]);
    expect(fansOf(g).streak).toBe(F.streak.from);
    expect(fansOf(g).mood).toBe(F.start + F.streak.from * F.result.away.pointsWin + F.streak.bonus);
  });

  it('the mood sets the ticket revenue of home matches only, and a new tier is announced', () => {
    const g = game();
    const [home, away] = [g.playerTeamId, g.teams.find((t) => t.id !== g.playerTeamId)!.id];
    const base = ticketRevenue(g, home, away);
    const other = ticketRevenue(g, away, home);
    g.fans = { mood: 100, streak: 0 };
    expect(ticketRevenue(g, home, away)).toBeGreaterThan(base);
    expect(ticketRevenue(g, away, home)).toBe(other);
    expect(tierOf(100)).toBe('euphoric');
    const h = game();
    h.fans = { mood: F.tiers.enthusiastic - 1, streak: 0, tier: 'loyal' };
    weeklyFans(h, [match(h, true, true, true)]);
    expect(h.inbox.at(-1)).toMatchObject({ kind: 'fansMood', from: 'loyal', to: 'enthusiastic' });
  });

  it('drifts back towards the usual mood, and is filled by real weeks', () => {
    const g = game();
    g.fans = { mood: 90, streak: 0 };
    fansDrift(g);
    expect(fansOf(g).mood).toBeLessThan(90);
    expect(fansOf(g).mood).toBeGreaterThan(F.start);
    let w = game('fans-weeks');
    for (let i = 0; i < 4; i++) w = playMatchday(w);
    expect(w.fans).toBeDefined();
  });
});
