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
    expect(g.teams.length).toBe(DEFAULT_CONFIG.league.teams);
    for (const t of g.teams) {
      expect(t.creatures.length).toBe(DEFAULT_CONFIG.league.squadSize);
      expect(validateTactic(t)).toEqual([]);
    }
    expect(new Set(g.teams.map((t) => t.name)).size).toBe(g.teams.length);
    expect(g.teams[0]!.name).toBe('Test Stable');
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
    const table = standings(a);
    expect(table.length).toBe(10);
    for (const r of table) expect(r.played).toBe(18);
    // Points: each match hands out 3+0 (KO) or 2+1 (points).
    const totalPoints = table.reduce((s, r) => s + r.points, 0);
    expect(totalPoints).toBe(90 * 3);
    expect(a.inbox.some((m) => m.kind === 'seasonEnd')).toBe(true);
    expect(a.inbox.filter((m) => m.kind === 'matchResult').length).toBe(18);
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
  });

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
  });

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
