/**
 * Sacking a hopeless manager (career mode), through the real weeks rather than direct calls: a squad with every
 * attribute at 1 loses everything, the board turns angry, ultimatums are missed, the job goes. Plus the edges of the
 * end-of-season verdict and of the strikes.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { careerSeasonReview, careerVerdict, lastWarning, requestSack } from '../src/engine/club/career.ts';
import { newGame, playMatchday, playerTeam, playCupRound, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import type { GameState } from '../src/engine/league/types.ts';

const S = DEFAULT_CONFIG.career.sack;
const TRACKED = ['ultimatum', 'ultimatumOver', 'sacked', 'boardVerdict'];

/** A new game whose squad cannot win a match (every attribute at 1). */
function hopeless(career: boolean, seed = 'hopeless') {
  const g = newGame({ seed, teamName: 'Hopeless', lang: 'en', career });
  for (const c of playerTeam(g).creatures) for (const k of Object.keys(c.attributes) as (keyof typeof c.attributes)[]) c.attributes[k] = 1;
  return g;
}

/** Plays league weeks until the season ends or the manager is out; returns the board / career messages in order. */
function playSeason(g: GameState) {
  while (!seasonOver(g) && !g.manager!.unemployed) g = playMatchday(g);
  const log = g.inbox.filter((m) => TRACKED.includes(m.kind)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { g, log };
}

describe('sacking a hopeless manager', () => {
  it('a shaky board and a hopeless squad: warning at the first missed ultimatum, sacked at the second, mid-season', () => {
    const start = hopeless(true);
    start.board.confidence = 28; // already angry: the first ultimatum comes at once
    const { g, log } = playSeason(start);
    const m = g.manager!;
    expect(m.unemployed).toBe(true);
    expect(seasonOver(g)).toBe(false); // out before the season ends
    expect(log.map((x) => x.kind)).toEqual(['ultimatum', 'ultimatumOver', 'ultimatum', 'ultimatumOver', 'sacked']);
    const [, first, , second, sacked] = log;
    expect(first).toMatchObject({ met: false, warning: true, sacked: false });
    expect(second).toMatchObject({ met: false, sacked: true });
    expect(sacked).toMatchObject({ reason: 'ultimatum', team: 'Hopeless', reputation: DEFAULT_CONFIG.career.start + DEFAULT_CONFIG.career.sacked });
    expect(m.jobs.at(-1)).toMatchObject({ teamId: g.playerTeamId, end: 'sacked', to: { season: 1 } });
    expect(m.offers.length).toBeGreaterThanOrEqual(1);
    expect(m.offers.every((o) => o.reason === 'rescue' && o.teamId !== g.playerTeamId)).toBe(true);
    // Nothing goes on until a job is taken.
    expect(playMatchday(g)).toBe(g);
    expect(playCupRound(g)).toBe(g);
  });

  it('the same hopeless season in free mode: ultimatums keep coming but the manager stays', () => {
    const start = hopeless(false);
    start.board.confidence = 28;
    const { g, log } = playSeason(start);
    expect(seasonOver(g)).toBe(true);
    expect(g.manager!.unemployed).toBeUndefined();
    expect(g.manager!.strikes).toBeUndefined();
    expect(log.some((x) => x.kind === 'sacked')).toBe(false);
    const over = log.filter((x) => x.kind === 'ultimatumOver');
    expect(over.length).toBeGreaterThanOrEqual(2);
    // No career wording on the board's messages.
    for (const x of over) expect(x).not.toHaveProperty('warning');
    expect(startNextSeason(g)).not.toBe(g);
  });

  it('from a fresh board, a hopeless first season ends with the verdict: one strike only, sacked at the end', () => {
    const { g, log } = playSeason(hopeless(true));
    expect(g.manager!.unemployed).toBe(true);
    expect(seasonOver(g)).toBe(true);
    const sacked = log.filter((x) => x.kind === 'sacked');
    expect(sacked).toHaveLength(1);
    expect(sacked[0]).toMatchObject({ reason: 'verdict' });
    expect(log.filter((x) => x.kind === 'ultimatumOver' && !x.met)).toHaveLength(1);
    expect(log.findLast((x) => x.kind === 'boardVerdict')).toMatchObject({ met: false });
    expect(startNextSeason(g)).toBe(g);
  });
});

describe('the board verdict and strikes, at their edges', () => {
  const fresh = () => newGame({ seed: 'edges', teamName: 'Edge', lang: 'en', career: true });

  it('the verdict sacks only a missed objective below the confidence threshold', () => {
    const below = fresh();
    careerVerdict(below, false, S.verdictBelow - 1);
    expect(below.manager!.pendingSack).toBe('verdict');

    const at = fresh();
    careerVerdict(at, false, S.verdictBelow);
    expect(at.manager!.pendingSack).toBeUndefined();

    const met = fresh();
    careerVerdict(met, true, 0);
    expect(met.manager!.pendingSack).toBeUndefined();

    const free = newGame({ seed: 'edges', teamName: 'Edge', lang: 'en' });
    careerVerdict(free, false, 0);
    expect(free.manager!.pendingSack).toBeUndefined();
  });

  it('a manager who joined after the verdict week is not judged on that season', () => {
    const late = fresh();
    late.manager!.jobs[0]!.from = { season: late.season, matchday: S.verdictJoinedBy + 1 };
    careerVerdict(late, false, 0);
    expect(late.manager!.pendingSack).toBeUndefined();

    const onTime = fresh();
    onTime.manager!.jobs[0]!.from = { season: onTime.season, matchday: S.verdictJoinedBy };
    careerVerdict(onTime, false, 0);
    expect(onTime.manager!.pendingSack).toBe('verdict');

    // Joined late last season: judged normally this one.
    const lastSeason = fresh();
    lastSeason.manager!.jobs[0]!.from = { season: lastSeason.season - 1, matchday: 15 };
    careerVerdict(lastSeason, false, 0);
    expect(lastSeason.manager!.pendingSack).toBe('verdict');
  });

  it('missed ultimatums only add up within a season', () => {
    const g = fresh();
    requestSack(g, 'ultimatum');
    expect(lastWarning(g)).toBe(true);
    careerSeasonReview(g); // season change
    expect(g.manager!.strikes).toBeUndefined();
    expect(lastWarning(g)).toBe(false);
    requestSack(g, 'ultimatum');
    expect(g.manager!.pendingSack).toBeUndefined();
    expect(lastWarning(g)).toBe(true);
    requestSack(g, 'ultimatum');
    expect(g.manager!.pendingSack).toBe('ultimatum');
  });
});
