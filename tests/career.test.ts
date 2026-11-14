import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { acceptJob, declineJob, jobCandidates, lastWarning, requestSack, resign, seasonOffers, seasonReputationDelta, takeOver, weeklyCareer } from '../src/engine/club/career.ts';
import { clubOf } from '../src/engine/economy/finance.ts';
import { knowledgeOf } from '../src/engine/economy/scouting.ts';
import { newGame, playMatchday, playerFixture, playerTeam, playCupRound, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import { divisionOf } from '../src/engine/league/divisions.ts';
import { managerName } from '../src/engine/team/identity.ts';
import type { GameState, SeasonRecord } from '../src/engine/league/types.ts';

const C = DEFAULT_CONFIG.career;
const game = (career = true, seed = 'career') => newGame({ seed, teamName: 'Test', lang: 'en', career, ironman: career });
/** An AI stable of another division than the player's. */
const elsewhere = (g: GameState) => g.teams.find((t) => t.id !== g.playerTeamId && divisionOf(g, t.id) !== divisionOf(g, g.playerTeamId))!;

describe('career mode', () => {
  it('a new game has a manager: career and ironman options, start reputation, first job', () => {
    const g = game();
    expect(g.manager).toMatchObject({ career: true, ironman: true, reputation: C.start, offers: [] });
    expect(g.manager!.jobs).toEqual([{ teamId: g.playerTeamId, teamName: playerTeam(g).name, from: { season: 1, matchday: 1 } }]);
    const plain = newGame({ seed: 'career', teamName: 'Test', lang: 'en', ironman: true });
    expect(plain.manager).toMatchObject({ career: false, ironman: false });
  });

  it('takeOver moves the manager: the old stable gets an AI identity, the new one loses its own', () => {
    const g = game();
    const oldId = g.playerTeamId;
    const target = elsewhere(g);
    const oldCreature = playerTeam(g).creatures[0]!;
    oldCreature.growth = { ability: 0, pool: 0, season: 0, freePoints: 2 };
    g.training[oldCreature.id] = { program: 'mental', intensity: 'normal' };
    g.forSale = [oldCreature.id];
    const before = structuredClone(g);
    const next = takeOver(g, target.id);
    expect(g).toEqual(before); // pure
    expect(next.playerTeamId).toBe(target.id);
    const newTeam = next.teams.find((t) => t.id === target.id)!;
    const oldTeam = next.teams.find((t) => t.id === oldId)!;
    expect(newTeam.identity).toBeUndefined();
    expect(oldTeam.identity?.gen).toBe(1);
    expect(managerName(oldTeam)).not.toBe(managerName({ id: oldId }));
    // Held free points were placed, the old job's lists are cleared.
    const placed = oldTeam.creatures.find((c) => c.id === oldCreature.id)!;
    expect(placed.growth?.freePoints).toBe(0);
    expect(Object.values(placed.attributes).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(oldCreature.attributes).reduce((a, b) => a + b, 0));
    expect(next.forSale).toEqual([]);
    expect(next.training[oldCreature.id]).toBeUndefined();
    // Knowledge: the old squad stays well known, the new one is fully known.
    expect(knowledgeOf(next, oldCreature.id)).toBe(C.formerKnowledge);
    expect(knowledgeOf(next, newTeam.creatures[0]!.id)).toBe(100);
    // Fresh board, history of jobs, a message.
    expect(next.board.confidence).toBe(DEFAULT_CONFIG.club.board.start);
    expect(next.board.ultimatum).toBeUndefined();
    expect(next.manager!.jobs.map((j) => [j.teamId, j.end])).toEqual([[oldId, 'left'], [target.id, undefined]]);
    expect(next.inbox.some((m) => m.kind === 'newJob' && m.teamId === target.id)).toBe(true);
    // Every creature of the new stable has a season-start snapshot (attribute arrows).
    expect(newTeam.creatures.every((c) => c.growth?.seasonStart)).toBe(true);
  });

  it('after a takeover the weeks go on with the new stable as the player and the old one as AI', () => {
    let g = takeOver(game(), elsewhere(game()).id);
    const me = g.playerTeamId;
    // The pre-season tournament (the old stable's) is played without the manager.
    while (g.matchday === 1 && !playerFixture(g)) g = playMatchday(g);
    const f = playerFixture(g)!;
    expect([f.home, f.away]).toContain(me);
    while (g.matchday < 4) g = playMatchday(g);
    const league = g.fixtures.filter((x) => !x.competition && x.matchday < 4 && (x.home === me || x.away === me));
    expect(league.length).toBe(3);
    expect(league.every((x) => x.result)).toBe(true);
    expect(g.inbox.filter((m) => m.kind === 'matchResult').length).toBeGreaterThanOrEqual(3);
    expect(g.playerTeamId).toBe(me);
  });

  it('a missed ultimatum costs the job in career mode only; a sacked manager cannot play a week before taking an offer', () => {
    const plain = game(false);
    requestSack(plain, 'ultimatum');
    expect(plain.manager!.pendingSack).toBeUndefined();

    const g = game();
    const club = playerTeam(g).name;
    // The first missed ultimatum is a last warning, the next one costs the job.
    requestSack(g, 'ultimatum');
    expect(g.manager!.pendingSack).toBeUndefined();
    expect(lastWarning(g)).toBe(true);
    requestSack(g, 'ultimatum');
    g.matchday = 5;
    weeklyCareer(g);
    const m = g.manager!;
    expect(m.unemployed).toBe(true);
    expect(m.reputation).toBe(C.start + C.sacked);
    expect(m.jobs[0]!.end).toBe('sacked');
    expect(g.inbox.some((x) => x.kind === 'sacked' && x.team === club)).toBe(true);
    expect(m.offers.length).toBeGreaterThanOrEqual(1);
    expect(m.offers.every((o) => o.reason === 'rescue' && o.teamId !== g.playerTeamId)).toBe(true);
    // Blocked until a job is taken.
    expect(playMatchday(g)).toBe(g);
    expect(playCupRound(g)).toBe(g);
    // The last offer cannot be declined.
    let h = g;
    for (const o of [...m.offers]) h = declineJob(h, o.id);
    expect(h.manager!.offers.length).toBe(1);
    const { state, outcome } = acceptJob(h, h.manager!.offers[0]!.id);
    expect(outcome.kind).toBe('hired');
    expect(state.manager!.unemployed).toBeUndefined();
    expect(state.manager!.offers).toEqual([]);
    expect(state.manager!.strikes).toBeUndefined();
    expect(state.board.cooldown).toBe(C.sack.graceWeeks);
    expect(playMatchday(state)).not.toBe(state);
    // The stable that sacked the manager never calls back.
    expect(jobCandidates(state).some((t) => t.id === g.playerTeamId)).toBe(false);
  });

  it('a manager may resign in career mode: the job ends, offers come, never from the stable left', () => {
    expect(resign(game(false))).toEqual(game(false));
    const g = game();
    const next = resign(g);
    const m = next.manager!;
    expect(m.unemployed).toBe(true);
    expect(m.jobs[0]!.end).toBe('resigned');
    expect(m.reputation).toBe(C.start + C.resigned);
    expect(m.offers.length).toBeGreaterThanOrEqual(1);
    expect(m.offers.some((o) => o.teamId === g.playerTeamId)).toBe(false);
    expect(next.inbox.some((x) => x.kind === 'resigned')).toBe(true);
    expect(playMatchday(next)).toBe(next);
  });

  it('the board sacks a manager who misses the objective with a low confidence at the end of the season', () => {
    let g = game(true, 'verdict');
    while (!seasonOver(g)) {
      g.board.confidence = 0;
      g.board.cooldown = 99; // no ultimatum: only the verdict
      g.board.objective = 'title';
      g = playMatchday(g);
      if (g.manager!.unemployed) break;
    }
    expect(g.manager!.unemployed).toBe(true);
    expect(g.inbox.some((m) => m.kind === 'sacked' && m.reason === 'verdict')).toBe(true);
    expect(startNextSeason(g)).toBe(g);
  });

  it('a season moves the manager reputation: objective, title, promotion, trophies, by division', () => {
    const g = game();
    const rec = (r: Partial<SeasonRecord>): SeasonRecord => ({ season: 1, division: 3, position: 5, points: 20, cupWon: false, ...r });
    const s = C.season;
    expect(seasonReputationDelta(g, rec({ met: true }))).toBe(s.met);
    expect(seasonReputationDelta(g, rec({ met: false }))).toBe(s.missed);
    expect(seasonReputationDelta(g, rec({ met: true, position: 1 }))).toBe(s.met + s.title + s.promotion);
    expect(seasonReputationDelta(g, rec({ met: true, cupWon: true, trophies: ['marches'] }))).toBe(s.met + s.shadow + s.trophy);
    expect(seasonReputationDelta(g, rec({ met: false, division: 0, position: 10 }))).toBeCloseTo((s.missed + s.relegation) * s.divisionWeight[0]!);
  });

  it('a reputed manager is offered jobs by bigger stables at the season change, never by smaller ones', () => {
    const g = game();
    g.manager!.reputation = 60;
    seasonOffers(g);
    const mine = clubOf(g, g.playerTeamId).reputation;
    const offers = g.manager!.offers;
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.length).toBeLessThanOrEqual(C.offers.seasonMax);
    for (const o of offers) {
      const rep = clubOf(g, o.teamId).reputation;
      expect(rep).toBeGreaterThanOrEqual(mine + C.offers.step);
      expect(rep).toBeLessThanOrEqual(60 + C.offers.reach);
    }
    // A plain game never gets offers.
    const plain = game(false);
    plain.manager!.reputation = 60;
    seasonOffers(plain);
    expect(plain.manager!.offers).toEqual([]);
  });

  it('offers lapse after their week; an expired offer cannot be accepted', () => {
    const g = game();
    g.manager!.reputation = 60;
    seasonOffers(g);
    const offer = g.manager!.offers[0]!;
    g.matchday = offer.until + 1;
    expect(acceptJob(g, offer.id).outcome).toEqual({ kind: 'error', error: 'expired' });
    weeklyCareer(g);
    expect(g.manager!.offers.some((o) => o.id === offer.id)).toBe(false);
  });

  it('a full career season stays deterministic and the record names the stable', () => {
    const run = () => {
      let g = game(true, 'det');
      while (!seasonOver(g)) g = playMatchday(g);
      return g;
    };
    const a = run();
    const b = run();
    expect(a.manager).toEqual(b.manager);
    expect(a.career?.at(-1)).toMatchObject({ teamId: a.playerTeamId, teamName: playerTeam(a).name });
    if (!a.manager!.unemployed) {
      const next = startNextSeason(a);
      expect(next.manager!.trend?.length).toBe(1);
    }
  }, 60_000);
});
