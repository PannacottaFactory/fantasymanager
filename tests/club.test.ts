import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { startBuilding, ticketsFactor } from '../src/engine/club/facilities.ts';
import { friendsMourn, relationOf, shiftRelation } from '../src/engine/club/relations.ts';
import { migrateGame } from '../src/engine/league/migrate.ts';
import { cupDue, newGame, playMatchday, playerTeam, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import type { GameState } from '../src/engine/league/types.ts';

const game = (seed = 'club') => newGame({ seed, teamName: 'Test', lang: 'en' });

function playSeason(g: GameState): GameState {
  while (!seasonOver(g)) g = playMatchday(g);
  return g;
}

describe('cup', () => {
  it('starts with a preliminary round for the weaker stables and ends with one winner', () => {
    let g = game('cup');
    const c = DEFAULT_CONFIG.league.cup;
    expect(g.cup.rounds).toBe(c.after.length);
    const prelim = g.fixtures.filter((f) => f.competition === 'cup' && f.round === 0);
    expect(prelim.length).toBe((g.teams.length - c.byes) / 2);
    // The cup week comes right after its matchday.
    while (g.matchday <= c.after[0]!) g = playMatchday(g);
    expect(cupDue(g)).toBe(true);
    g = playMatchday(g);
    expect(cupDue(g)).toBe(false);
    expect(g.cup.round).toBe(1);
    expect(g.cup.alive.length).toBe(16);
    g = playSeason(g);
    expect(g.cup.winner).toBeDefined();
    expect(g.cup.alive).toEqual([g.cup.winner]);
    expect(g.news.some((n) => n.kind === 'cupWinner')).toBe(true);
  });
});

describe('divisions & board', () => {
  it('the player starts in the lower division with an objective; the board judges it at the end', () => {
    let g = game('board');
    expect(g.divisions[DEFAULT_CONFIG.league.playerDivision]).toContain(g.playerTeamId);
    expect(g.inbox.some((m) => m.kind === 'boardObjective')).toBe(true);
    g = playSeason(g);
    expect(g.inbox.some((m) => m.kind === 'boardVerdict')).toBe(true);
    expect(g.news.filter((n) => n.kind === 'champion').length).toBe(g.divisions.length);
    const next = startNextSeason(g);
    expect(next.inbox.filter((m) => m.kind === 'boardObjective').length).toBe(2);
    expect(next.news.some((n) => n.kind === 'promotion')).toBe(true);
    for (const d of next.divisions) expect(d.length).toBe(DEFAULT_CONFIG.league.teams);
  });
});

describe('facilities', () => {
  it('building is paid up front and completes after its weeks', () => {
    let g = game('fac');
    const before = g.clubs[g.playerTeamId]!.balance;
    const level = g.facilities[g.playerTeamId]!.stands.level;
    const r = startBuilding(g, 'stands');
    expect(r.outcome.kind).toBe('started');
    g = r.state;
    expect(g.clubs[g.playerTeamId]!.balance).toBe(before - DEFAULT_CONFIG.club.facilities.cost[level]!);
    expect(startBuilding(g, 'stands').outcome).toEqual({ kind: 'error', error: 'busy' });
    const factor = ticketsFactor(g, g.playerTeamId);
    for (let i = 0; i < DEFAULT_CONFIG.club.facilities.weeks[level]! + 2; i++) g = playMatchday(g);
    expect(g.facilities[g.playerTeamId]!.stands.level).toBe(level + 1);
    expect(ticketsFactor(g, g.playerTeamId)).toBeGreaterThan(factor);
    expect(g.inbox.some((m) => m.kind === 'facilityDone')).toBe(true);
  });
});

describe('relations', () => {
  it('starters bond by fighting together; friends mourn a departure', () => {
    let g = game('rel');
    const team = playerTeam(g);
    const [a, b] = team.tactic.lineup.map((s) => team.creatures.find((c) => c.id === s.creatureId)!);
    const before = relationOf(a!, b!);
    for (let i = 0; i < 3; i++) g = playMatchday(g);
    const t2 = playerTeam(g);
    const a2 = t2.creatures.find((c) => c.id === a!.id);
    const b2 = t2.creatures.find((c) => c.id === b!.id);
    if (a2 && b2 && t2.tactic.lineup.some((s) => s.creatureId === a2.id)) expect(relationOf(a2, b2)).toBeGreaterThanOrEqual(before);

    const x = t2.creatures[0]!;
    const y = t2.creatures[1]!;
    shiftRelation(x, y, 100);
    const morale = y.condition.morale;
    const names = friendsMourn(t2, x);
    expect(names).toContain(y.name);
    expect(y.condition.morale).toBeLessThan(morale + 1);
    expect(y.relations[x.id]).toBeUndefined();
  });
});

describe('migration', () => {
  it('a phase-4 save (one league) gains a second division whose past weeks were played', () => {
    let g = game('mig');
    for (let i = 0; i < 2; i++) g = playMatchday(g);
    // Rebuild what a phase-4 save looked like: one 10-team league, no cup/board/facilities/news.
    const d1 = new Set(g.divisions[0]);
    const old = structuredClone(g) as unknown as Record<string, unknown> & GameState;
    old.teams = old.teams.filter((t) => d1.has(t.id));
    old.fixtures = old.fixtures.filter((f) => f.competition !== 'cup' && f.division === 0).map((f) => ({ ...f, division: undefined }));
    old.playerTeamId = old.teams[0]!.id;
    for (const k of ['divisions', 'cup', 'board', 'facilities', 'news']) delete old[k];
    (old as unknown as { version: number }).version = 3;
    const m = migrateGame(old)!;
    expect(m.version).toBe(5);
    expect(m.divisions.length).toBe(2);
    expect(m.divisions[1]!.length).toBe(10);
    const d2Played = m.fixtures.filter((f) => f.division === 1 && f.result);
    expect(d2Played.length).toBe(2 * 5);
    expect(() => playMatchday(m)).not.toThrow();
  });
});

describe('deaths', () => {
  it('are rare, remove the creature for good and are announced', () => {
    // Every severe or career injury of a knocked-out creature is fatal in this config.
    const cfg = structuredClone(DEFAULT_CONFIG);
    cfg.league.death.chance = { minor: 0, moderate: 0, severe: 1, career: 1 };
    let g = game('deaths');
    for (let i = 0; i < 12; i++) g = playMatchday(g, null, cfg);
    const dead = g.news.filter((n) => n.kind === 'death');
    expect(dead.length).toBeGreaterThan(0);
    for (const f of g.fallen ?? []) expect(g.teams.some((t) => t.creatures.some((c) => c.id === f.id))).toBe(false);
    expect(dead.every((d) => d.kind === 'death' && d.name.length > 0)).toBe(true);
    // Same seed, same world: deaths are deterministic.
    let h = game('deaths');
    for (let i = 0; i < 12; i++) h = playMatchday(h, null, cfg);
    expect(h.news.filter((n) => n.kind === 'death')).toEqual(dead);
  });
});
