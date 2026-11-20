import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../src/data/config/index.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import type { MatchEvent } from '../src/engine/combat/types.ts';
import { applyEvent, initialView } from '../src/engine/combat/view.ts';
import { generateTeam } from '../src/engine/team/team.ts';

const withGrace = (chance: number): GameConfig => ({ ...DEFAULT_CONFIG, combat: { ...DEFAULT_CONFIG.combat, grace: { ...DEFAULT_CONFIG.combat.grace, chance } } });
const teams = (i: number) => {
  const rng = new Rng(deriveSeed('grace-test', i));
  return [generateTeam(rng, { quality: 'professional' }), generateTeam(rng, { quality: 'regional' })] as const;
};

describe('touched by grace', () => {
  it('has its own stream: matches where it never comes are unchanged', () => {
    for (let i = 0; i < 20; i++) {
      const [a, b] = teams(i);
      const off = simulateMatch({ seed: i, teams: [structuredClone(a), structuredClone(b)] }, { cfg: withGrace(0) });
      const on = simulateMatch({ seed: i, teams: [structuredClone(a), structuredClone(b)] });
      expect(off.events.some((e) => e.type === 'grace')).toBe(false);
      if (!on.events.some((e) => e.type === 'grace')) expect(on.outcome).toEqual(off.outcome);
    }
  });

  it('comes at most once per side, only to a side in trouble, and lifts the creature', () => {
    const cfg = withGrace(1);
    let seen = 0;
    for (let i = 0; i < 20; i++) {
      const [a, b] = teams(i);
      const r = simulateMatch({ seed: i, teams: [a, b] }, { cfg });
      const graces = r.events.filter((e): e is Extract<MatchEvent, { type: 'grace' }> => e.type === 'grace');
      const sides = graces.map((g) => r.roster[g.actor]!.side);
      expect(new Set(sides).size).toBe(sides.length);
      let v = initialView(r.roster);
      for (const e of r.events) {
        v = applyEvent(v, e);
        if (e.type !== 'grace') continue;
        seen++;
        expect(e.round).toBeGreaterThanOrEqual(cfg.combat.grace.minRound);
        const c = v.creatures[e.actor]!;
        expect(c.effects).toContain('graced');
        expect(c.stamina).toBe(e.stamina);
        expect(c.hp).toBe(e.hp);
        expect(e.morale).toBeGreaterThanOrEqual(cfg.combat.grace.morale);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
