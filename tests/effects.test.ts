import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { executeMult, staminaRegen } from '../src/engine/combat/formulas.ts';
import { initialView, applyEvent } from '../src/engine/combat/view.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import type { Combatant, MatchEvent, MatchSetup } from '../src/engine/combat/types.ts';

function setup(seed: string | number, pool?: string[]): MatchSetup {
  const rng = new Rng(deriveSeed('fx-teams', seed));
  return {
    seed,
    teams: [generateTeam(rng, { quality: 'professional', speciesPool: pool }), generateTeam(rng, { quality: 'professional' })],
  };
}

/** Test access to the combat internals (TypeScript allows bracket access to private members). */
function addEffect(c: Combat, target: Combatant, id: string, stacks = 1) {
  c['addEffect'](target, id, EFFECTS[id]!.defaultDuration, undefined, false, stacks);
}

describe('stacking effects', () => {
  it('poison stacks up to 5 doses and its damage scales with them', () => {
    const c = new Combat(setup(1));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'poisoned');
    addEffect(c, t, 'poisoned', 2);
    expect(t.effects.find((e) => e.id === 'poisoned')!.stacks).toBe(3);
    addEffect(c, t, 'poisoned', 9);
    expect(t.effects.find((e) => e.id === 'poisoned')!.stacks).toBe(5);
    const hp = t.hp;
    c['startOfRoundEffects']();
    expect(hp - t.hp).toBe(Math.round(t.maxHp * EFFECTS.poisoned!.magnitude! * 5));
  });

  it('three charges of cold freeze the target, who then loses its turn', () => {
    const c = new Combat(setup(2));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'chilled');
    addEffect(c, t, 'chilled');
    expect(t.effects.some((e) => e.id === 'frozen')).toBe(false);
    addEffect(c, t, 'chilled');
    expect(t.effects.some((e) => e.id === 'chilled')).toBe(false);
    expect(t.effects.some((e) => e.id === 'frozen')).toBe(true);
    // No more cold while frozen.
    addEffect(c, t, 'chilled');
    expect(t.effects.some((e) => e.id === 'chilled')).toBe(false);
    c['takeTurn'](t);
    const last = c.events.at(-1)!;
    expect(last).toMatchObject({ type: 'stunned', actor: t.id, effect: 'frozen' });
    expect(t.effects.some((e) => e.id === 'frozen')).toBe(false);
  });
});

describe('curses and purification', () => {
  it('curses last until the break, then fade', () => {
    const c = new Combat(setup(3));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'hexed');
    for (let i = 0; i < 3; i++) c['endOfRound']();
    expect(t.effects.some((e) => e.id === 'hexed')).toBe(true);
    c['liftCurses']();
    expect(t.effects.some((e) => e.id === 'hexed')).toBe(false);
  });

  it('a purifying heal removes poison and cold but not curses', () => {
    const c = new Combat(setup(4));
    const [healer, ally] = c.active(0);
    addEffect(c, ally!, 'poisoned', 3);
    addEffect(c, ally!, 'chilled');
    addEffect(c, ally!, 'blighted');
    c['cleanse'](healer!, ABILITIES['purifying-light']!, ally!);
    expect(ally!.effects.map((e) => e.id)).toEqual(['blighted']);
    const ev = c.events.at(-1)!;
    expect(ev).toMatchObject({ type: 'cleanse', removed: ['poisoned', 'chilled'] });
  });

  it('blight halves healing received', () => {
    const c = new Combat(setup(5));
    const t = c.active(0)[0]!;
    t.hp = 1;
    t.effects.push({ id: 'regenerating', remaining: 3 });
    c['startOfRoundEffects']();
    const full = t.hp - 1;
    t.hp = 1;
    addEffect(c, t, 'blighted');
    c['startOfRoundEffects']();
    expect(Math.abs(t.hp - 1 - full / 2)).toBeLessThanOrEqual(1);
  });
});

describe('new styles in real matches', () => {
  it('poison and frost teams play deterministic matches and the view follows the stacks', () => {
    for (const pool of [['giant-spider', 'giant-scorpion', 'myconid'], ['winter-wolf', 'frost-wraith', 'frost-giant'], ['hag', 'unicorn']]) {
      const s = setup(`pool-${pool[0]}`, pool);
      const a = simulateMatch(s);
      const b = simulateMatch(s);
      expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
      let view = initialView(a.roster);
      let maxStack = 0;
      for (const e of a.events as MatchEvent[]) {
        view = applyEvent(view, e);
        for (const cv of Object.values(view.creatures)) for (const n of Object.values(cv.stacks)) maxStack = Math.max(maxStack, n);
      }
      if (pool[0] !== 'hag') expect(maxStack).toBeGreaterThan(1);
    }
  });
});

describe('wave 2 mechanics', () => {
  it('bleeding stacks to 3 and any healing stops it', () => {
    const c = new Combat(setup(10));
    const [healer, t] = c.active(0);
    addEffect(c, t!, 'bleeding', 5);
    expect(t!.effects.find((e) => e.id === 'bleeding')!.stacks).toBe(3);
    c['stopOnHeal'](t!);
    expect(t!.effects.some((e) => e.id === 'bleeding')).toBe(false);
    expect(healer).toBeDefined();
  });

  it('thorns send melee damage back to the attacker', () => {
    const c = new Combat(setup(11));
    const attacker = c.active(0)[0]!;
    const target = c.active(1)[0]!;
    addEffect(c, target, 'thorned');
    const before = attacker.hp;
    for (let i = 0; i < 20 && attacker.hp === before; i++) c['attack'](attacker, target, ABILITIES['axe-swing']!, false, false);
    const thorns = c.events.find((e) => e.type === 'thorns');
    expect(thorns).toBeDefined();
    expect(attacker.hp).toBeLessThan(before);
  });

  it('execution hits harder on a target below 30 % health', () => {
    const c = new Combat(setup(12));
    const target = c.active(1)[0]!;
    const dec = ABILITIES.decapitate!;
    expect(executeMult(dec, target, c.cfg)).toBe(1);
    target.hp = Math.floor(target.maxHp * 0.2);
    expect(executeMult(dec, target, c.cfg)).toBe(2);
  });

  it('draining removes stamina and sapping halves its recovery', () => {
    const c = new Combat(setup(13));
    const [a, t] = [c.active(0)[0]!, c.active(1)[0]!];
    const st = t.stamina;
    c['drainStamina'](a, ABILITIES.engulf!, t);
    expect(t.stamina).toBe(st - ABILITIES.engulf!.staminaDrain!);
    const regen = staminaRegen(t, c.cfg);
    addEffect(c, t, 'sapped');
    expect(staminaRegen(t, c.cfg)).toBeCloseTo(regen / 2);
  });
});
