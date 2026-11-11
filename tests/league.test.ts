import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { isInjured } from '../src/engine/creature/derived.ts';
import { roundRobin } from '../src/engine/league/schedule.ts';
import {
  fixtureSetup, lastMatchday, newGame, playMatchday, playerFixture, seasonOver, standings, startNextSeason,
} from '../src/engine/league/season.ts';
import { repairTactic, validateTactic } from '../src/engine/team/team.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';

describe('calendar', () => {
  it('double round-robin: everyone meets twice, once at home, one match per matchday', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const fx = roundRobin(new Rng('cal'), ids, 2);
    expect(fx.length).toBe(90);
    for (let d = 1; d <= 18; d++) {
      const day = fx.filter((f) => f.matchday === d);
      expect(day.length).toBe(5);
      expect(new Set(day.flatMap((f) => [f.home, f.away])).size).toBe(10);
    }
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue;
        expect(fx.filter((f) => f.home === a && f.away === b).length, `${a}-${b}`).toBe(1);
      }
    for (const a of ids) {
      const home = fx.filter((f) => f.home === a).length;
      expect(home).toBe(9);
    }
  });
});

describe('season', () => {
  const start = () => newGame({ seed: 'test-world', teamName: 'Test Stable', lang: 'fr' });

  it('creates a league with the configured size and a welcome message', () => {
    const g = start();
    const divisions = DEFAULT_CONFIG.league.divisions.length;
    expect(g.teams.length).toBe(DEFAULT_CONFIG.league.teams * divisions);
    expect(g.divisions.length).toBe(divisions);
    for (const d of g.divisions) expect(d.length).toBe(DEFAULT_CONFIG.league.teams);
    // The player starts in the configured division.
    expect(g.divisions[DEFAULT_CONFIG.league.playerDivision]).toContain(g.playerTeamId);
    for (const t of g.teams) {
      expect(t.creatures.length).toBe(DEFAULT_CONFIG.league.squadSize);
      expect(validateTactic(t)).toEqual([]);
    }
    expect(new Set(g.teams.map((t) => t.name)).size).toBe(g.teams.length);
    expect(g.teams.find((t) => t.id === g.playerTeamId)!.name).toBe('Test Stable');
    expect(g.inbox[0]!.kind).toBe('welcome');
    expect(lastMatchday(g)).toBe(18);
    expect(playerFixture(g)).toBeDefined();
  });

  it('plays a whole season deterministically, without mutating previous states', () => {
    let a = start();
    let b = start();
    const first = structuredClone(a);
    while (!seasonOver(a)) {
      a = playMatchday(a);
      b = playMatchday(b);
    }
    expect(JSON.stringify(a.fixtures)).toBe(JSON.stringify(b.fixtures));
    expect(start()).toEqual(first);
    expect(a.fixtures.every((f) => f.result)).toBe(true);
    for (let d = 0; d < a.divisions.length; d++) {
      const table = standings(a, d);
      expect(table.length).toBe(10);
      for (const r of table) expect(r.played).toBe(18);
      // Points: each match hands out 3+0 (KO) or 2+1 (points); cup ties never count.
      const totalPoints = table.reduce((s, r) => s + r.points, 0);
      expect(totalPoints).toBe(90 * 3);
    }
    expect(a.inbox.some((m) => m.kind === 'seasonEnd')).toBe(true);
    const cupTies = a.fixtures.filter((f) => f.competition && (f.home === a.playerTeamId || f.away === a.playerTeamId)).length;
    expect(a.inbox.filter((m) => m.kind === 'matchResult').length).toBe(18 + cupTies);
    // The cup is played to the end and has a winner.
    expect(a.cup.round).toBe(a.cup.rounds);
    expect(a.cup.winner).toBeDefined();
    // Fatigue and morale stay in range.
    for (const t of a.teams)
      for (const c of t.creatures) {
        expect(c.condition.fatigue).toBeGreaterThanOrEqual(0);
        expect(c.condition.fatigue).toBeLessThanOrEqual(100);
        expect(c.condition.form).toBeGreaterThanOrEqual(1);
        expect(c.condition.form).toBeLessThanOrEqual(20);
      }

    const s2 = startNextSeason(a);
    expect(s2.season).toBe(2);
    expect(s2.matchday).toBe(1);
    expect(s2.fixtures.every((f) => !f.result)).toBe(true);
    // Promotion & relegation: two teams swapped between the divisions.
    const n = DEFAULT_CONFIG.league.promoted;
    const d1Before = new Set(a.divisions[0]);
    expect(s2.divisions[0]!.filter((id) => !d1Before.has(id)).length).toBe(n);
  }, 30000);

  it('a live player match is recorded with the player as side 0', () => {
    const g = start();
    const f = playerFixture(g)!;
    const { setup, swapped } = fixtureSetup(g, f);
    expect(setup.teams[0].id).toBe(g.playerTeamId);
    const live = simulateMatch(setup);
    const next = playMatchday(g, live);
    const rec = next.fixtures.find((x) => x.id === f.id)!.result!;
    const playerWon = live.outcome.winner === 0;
    const playerIsHome = !swapped;
    expect(rec.winner === 0).toBe(playerWon === playerIsHome);
    expect(next.lastMatch?.result.seed).toBe(live.seed);
  }, 60000);

  it('injured creatures miss matches and heal', () => {
    let g = start();
    let seen = false;
    for (let i = 0; i < 18 && !seen; i++) {
      g = playMatchday(g);
      for (const t of g.teams) {
        const injured = t.creatures.filter(isInjured);
        if (!injured.length) continue;
        seen = true;
        if (t.id !== g.playerTeamId) {
          const lineupIds = [...t.tactic.lineup.map((s) => s.creatureId), ...t.tactic.bench];
          for (const c of injured) expect(lineupIds).not.toContain(c.id);
        }
      }
    }
    expect(seen).toBe(true);
  });

  it('the assistant repairs a lineup containing an injured creature', () => {
    const g = start();
    const team = structuredClone(g.teams[0]!);
    const starter = team.creatures.find((c) => c.id === team.tactic.lineup[0]!.creatureId)!;
    starter.condition.injuries.push({ injuryId: 'gash', weeksLeft: 2 });
    expect(validateTactic(team, DEFAULT_CONFIG, true).some((x) => x.code === 'injured')).toBe(true);
    const fixed = repairTactic(team);
    expect(validateTactic(fixed, DEFAULT_CONFIG, true)).toEqual([]);
  });
});

describe('tactics selection', () => {
  it('sets starter / bench / reserve, refuses a full group, and swaps places', async () => {
    const { generateTeam } = await import('../src/engine/team/team.ts');
    const { selectionOf, setSelection, swapCreatures } = await import('../src/engine/team/edit.ts');
    const { Rng } = await import('../src/core/rng.ts');
    const team = generateTeam(new Rng(5), { quality: 'professional', size: 12 });
    const reserve = team.creatures.find((c) => selectionOf(team, c.id) === 'reserve')!;
    const starter = team.tactic.lineup[0]!.creatureId;
    // Full lineup: no change.
    expect(setSelection(team, reserve.id, 'starter')).toBe(team);
    const swapped = swapCreatures(team, reserve.id, starter);
    expect(selectionOf(swapped, reserve.id)).toBe('starter');
    expect(selectionOf(swapped, starter)).toBe('reserve');
    expect(swapped.tactic.lineup).toHaveLength(team.tactic.lineup.length);
    expect(swapped.tactic.lineup.find((s) => s.creatureId === reserve.id)!.line).toBe(team.tactic.lineup[0]!.line);
    const freed = setSelection(team, starter, 'reserve');
    expect(freed.tactic.lineup).toHaveLength(team.tactic.lineup.length - 1);
    expect(selectionOf(setSelection(freed, reserve.id, 'starter'), reserve.id)).toBe('starter');
  });
});

describe('match replay', () => {
  it('the player’s recorded matches replay exactly', async () => {
    const { newGame, playMatchday } = await import('../src/engine/league/season.ts');
    const { replayMatch } = await import('../src/engine/combat/simulate.ts');
    let g = newGame({ seed: 'replay', teamName: 'Me', lang: 'en' });
    for (let i = 0; i < 3; i++) g = playMatchday(g);
    expect(g.matchHistory?.length).toBe(g.inbox.filter((m) => m.kind === 'matchResult').length);
    const rec = g.matchHistory!.find((m) => m.fixtureId === g.lastMatch!.fixtureId)!;
    const again = replayMatch(rec.setup, rec.decisions);
    expect(again.outcome).toEqual(g.lastMatch!.result.outcome);
    expect(again.events.length).toBe(g.lastMatch!.result.events.length);
  });

  it('a match with the player’s own break decisions replays exactly', async () => {
    const { Combat } = await import('../src/engine/combat/combat.ts');
    const { replayMatch } = await import('../src/engine/combat/simulate.ts');
    const { generateTeam } = await import('../src/engine/team/team.ts');
    const { Rng } = await import('../src/core/rng.ts');
    const rng = new Rng(77);
    const setup = { seed: 9, teams: [generateTeam(rng, { quality: 'professional' }), generateTeam(rng, { quality: 'professional' })] as [ReturnType<typeof generateTeam>, ReturnType<typeof generateTeam>] };
    const c = new Combat(structuredClone(setup));
    while (c.phase !== 'ended') {
      c.advance();
      if (c.phase === 'break') {
        const bench = c.bench(0)[0];
        const out = c.active(0)[0];
        c.applyBreakDecision(0, { orders: { ...c.sides[0].orders, aggression: 'cautious' }, substitutions: bench && out ? [{ outId: out.id, inId: bench.id }] : [] });
        c.applyBreakDecision(1, {});
        c.resume();
      }
    }
    const live = c.result();
    const again = replayMatch(structuredClone(setup), live.decisions);
    expect(again.outcome).toEqual(live.outcome);
    expect(JSON.stringify(again.events)).toBe(JSON.stringify(live.events));
  });
});
