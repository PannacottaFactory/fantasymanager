import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { Commentator } from '../src/engine/commentary/commentator.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { buildReport } from '../src/engine/report/report.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import { COMMENTARY } from '../src/data/text/commentary.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';

function match(i: number) {
  const rng = new Rng(deriveSeed('cr', i));
  const a = generateTeam(rng);
  const b = generateTeam(rng);
  return simulateMatch({ seed: i, teams: [a, b] });
}

const narrate = (r: ReturnType<typeof match>) =>
  new Commentator(r.seed, r.roster, [r.teams[0].name, r.teams[1].name]).narrateAll(r.events);

describe('commentary', () => {
  it('produces readable lines with no unfilled placeholders', () => {
    for (let i = 0; i < 40; i++) {
      const lines = narrate(match(i));
      expect(lines.length).toBeGreaterThan(20);
      for (const l of lines) {
        expect(l.text, l.text).not.toMatch(/\{\w+\}/);
        expect(l.text, l.text).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('is deterministic and rarely repeats a line back-to-back', () => {
    const r = match(100);
    const a = narrate(r).map((l) => l.text);
    expect(a).toEqual(narrate(r).map((l) => l.text));
    const shapes = a.map((t) => t.replace(/\d+/g, '#'));
    let repeats = 0;
    for (let i = 1; i < shapes.length; i++) if (shapes[i] === shapes[i - 1]) repeats++;
    expect(repeats / shapes.length).toBeLessThan(0.1);
  });

  it('every template key used by the commentator exists', () => {
    const keys = [
      'matchStart', 'roundFirst', 'roundLast', 'roundOpen', 'attack.hit', 'attack.miss', 'attack.intercept', 'aoe.open',
      'aoe.hit', 'aoe.miss', 'heal', 'heal.group', 'buff', 'debuff', 'guard', 'rest', 'hesitate', 'flee', 'stunned', 'showboat', 'disobey',
      'enrage', 'exhausted', 'moraleShift', 'ko', 'injury', 'effect.generic', 'tick', 'break', 'substitution',
      'ordersChanged', 'matchEnd', 'crowd',
    ];
    for (const k of keys) expect(COMMENTARY[k]?.length, k).toBeGreaterThan(0);
  });
});

describe('match report', () => {
  it('ratings are within bounds and every starter is rated', () => {
    for (let i = 0; i < 30; i++) {
      const r = match(200 + i);
      const rep = buildReport(r, 0);
      for (const c of rep.creatures) {
        if (r.roster[c.id]!.starter) expect(c.played).toBe(true);
        if (c.played) {
          expect(c.rating).toBeGreaterThanOrEqual(DEFAULT_CONFIG.report.rating.min);
          expect(c.rating).toBeLessThanOrEqual(DEFAULT_CONFIG.report.rating.max);
        }
      }
      expect(rep.momentum.length).toBe(r.outcome.rounds);
      expect(rep.headline.length).toBeGreaterThan(10);
      expect(rep.won).toBe(r.outcome.winner === 0);
      for (const rm of rep.remarks) expect(rm.text).not.toMatch(/\{\w+\}|undefined|NaN/);
      for (const m of rep.keyMoments) expect(m.text).not.toMatch(/\{\w+\}|undefined/);
    }
  });

  it('damage totals in the report match the event log', () => {
    const r = match(300);
    const rep = buildReport(r, 1);
    const fromEvents = r.events.reduce((s, e) => s + (e.type === 'attack' && e.hit ? e.damage : e.type === 'thorns' ? e.amount : 0), 0);
    expect(rep.creatures.reduce((s, c) => s + c.damageDealt, 0)).toBe(fromEvents);
  });

  it('the assistant flags early exhaustion when it happens', () => {
    let found = false;
    for (let i = 0; i < 80 && !found; i++) {
      const r = match(400 + i);
      for (const side of [0, 1] as const) if (buildReport(r, side).remarks.some((x) => x.key === 'exhaustedEarly')) found = true;
    }
    expect(found).toBe(true);
  });
});
