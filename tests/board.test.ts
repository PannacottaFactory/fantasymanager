import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { boardMood, moodOf, objectiveTarget, recruitmentBudget, weeklyBoard, weeklyBoardStanding, worksFactor } from '../src/engine/club/board.ts';
import { startBuilding } from '../src/engine/club/facilities.ts';
import { bid } from '../src/engine/economy/actions.ts';
import { clubOf } from '../src/engine/economy/finance.ts';
import { askingPrice } from '../src/engine/economy/market.ts';
import { newGame } from '../src/engine/league/season.ts';
import type { Fixture, GameState } from '../src/engine/league/types.ts';

const B = DEFAULT_CONFIG.club.board;
const game = (seed = 'board') => newGame({ seed, teamName: 'Test', lang: 'en' });

/** A league fixture of the player, already played. */
function result(g: GameState, won: boolean, ko = false, competition?: 'cup'): Fixture {
  const opp = g.teams.find((t) => t.id !== g.playerTeamId)!.id;
  const f = { id: `x${Math.random()}`, home: g.playerTeamId, away: opp, matchday: g.matchday, season: g.season, division: 0, result: { winner: won ? 0 : 1, method: ko ? 'ko' : 'points' } } as unknown as Fixture;
  if (competition) (f as { competition?: string }).competition = competition;
  return f;
}

describe('board', () => {
  it('moods follow the confidence thresholds', () => {
    expect(moodOf(B.moods.delighted)).toBe('delighted');
    expect(moodOf(B.moods.content)).toBe('content');
    expect(moodOf(B.moods.uneasy)).toBe('uneasy');
    expect(moodOf(B.moods.uneasy - 1)).toBe('angry');
  });

  it('the recruitment budget is a share of the treasury set by the mood, and blocks bids above it', () => {
    const g = game();
    const balance = clubOf(g, g.playerTeamId).balance;
    g.board.confidence = 90;
    expect(recruitmentBudget(g)).toBe(Math.floor(balance * B.budget.delighted));
    g.board.confidence = 10;
    expect(recruitmentBudget(g)).toBe(Math.floor(balance * B.budget.angry));
    const team = g.teams.find((t) => t.id !== g.playerTeamId)!;
    const c = [...team.creatures].sort((a, b) => askingPrice(team, a) - askingPrice(team, b)).find((x) => askingPrice(team, x) > recruitmentBudget(g) && askingPrice(team, x) <= balance);
    if (c) expect(bid(g, c.id, askingPrice(team, c), 1).outcome).toEqual({ kind: 'error', error: 'board' });
    g.board.frozen = 2;
    expect(recruitmentBudget(g)).toBe(0);
  });

  it('a delighted board makes works cheaper, an angry one freezes them', () => {
    const g = game();
    g.board.confidence = 90;
    expect(worksFactor(g)).toBe(B.worksDelighted);
    g.board.confidence = 10;
    expect(worksFactor(g)).toBeNull();
    expect(startBuilding(g, 'training').outcome).toEqual({ kind: 'error', error: 'board' });
  });

  it('results move the confidence and a change of mood is announced', () => {
    const g = game();
    g.board.confidence = B.moods.content;
    g.board.mood = 'content';
    weeklyBoard(g, [result(g, false, true)]);
    expect(g.board.confidence).toBe(B.moods.content + B.result.koLoss);
    expect(boardMood(g)).toBe('uneasy');
    expect(g.inbox.at(-1)).toMatchObject({ kind: 'boardMood', from: 'content', to: 'uneasy' });
  });

  it('an angry board sets an ultimatum; met = confidence up, missed = reputation down and recruitment frozen', () => {
    const u = B.ultimatum;
    const g = game();
    g.board.mood = 'uneasy';
    g.board.confidence = B.moods.uneasy;
    weeklyBoard(g, [result(g, false)]);
    expect(g.board.ultimatum).toMatchObject({ need: u.need, of: u.of, wins: 0, played: 0 });
    expect(g.inbox.some((m) => m.kind === 'ultimatum')).toBe(true);
    // Cup matches do not count.
    weeklyBoard(g, [result(g, true, false, 'cup')]);
    expect(g.board.ultimatum?.played).toBe(0);
    const met = structuredClone(g);
    const before = met.board.confidence;
    for (let i = 0; i < u.need; i++) weeklyBoard(met, [result(met, true)]);
    expect(met.board.ultimatum).toBeUndefined();
    expect(met.board.confidence).toBe(before + u.need * B.result.pointsWin + u.reward);
    expect(met.inbox.some((m) => m.kind === 'ultimatumOver' && m.met)).toBe(true);

    const missed = structuredClone(g);
    const rep = clubOf(missed, missed.playerTeamId).reputation;
    for (let i = 0; i < u.of - u.need + 1; i++) weeklyBoard(missed, [result(missed, false)]);
    expect(missed.board.ultimatum).toBeUndefined();
    expect(missed.board.frozen).toBe(u.frozenWeeks);
    expect(clubOf(missed, missed.playerTeamId).reputation).toBe(Math.max(0, rep - u.reputation));
    expect(missed.inbox.some((m) => m.kind === 'ultimatumOver' && !m.met)).toBe(true);
    // No new ultimatum straight away; countdowns run with the league weeks.
    weeklyBoard(missed, [result(missed, false)]);
    expect(missed.board.ultimatum).toBeUndefined();
    weeklyBoardStanding(missed);
    expect(missed.board.frozen).toBe(u.frozenWeeks - 1);
  });

  it('objective targets: last place that still meets the objective', () => {
    expect(objectiveTarget('title', 10)).toBe(1);
    expect(objectiveTarget('promotion', 10)).toBe(DEFAULT_CONFIG.league.promoted);
    expect(objectiveTarget('topHalf', 10)).toBe(5);
  });
});
