import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { executeMult, lineTargets, packMult, rawDamage, staminaRegen } from '../src/engine/combat/formulas.ts';
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

describe('wave 3 mechanics', () => {
  it('pack abilities grow with allies already on the target (capped)', () => {
    const c = new Combat(setup(20));
    const bite = ABILITIES['hyena-bite']!;
    expect(packMult(bite, 0, c.cfg)).toBe(1);
    expect(packMult(bite, 2, c.cfg)).toBeCloseTo(1 + 2 * bite.pack!);
    expect(packMult(bite, 9, c.cfg)).toBeCloseTo(1 + c.cfg.combat.damage.packMax * bite.pack!);
  });

  it('back-line abilities hit the whole back line, or everyone if it is empty', () => {
    const foes = [{ line: 'front' }, { line: 'back' }, { line: 'back' }];
    expect(lineTargets('enemyBack', foes)).toHaveLength(2);
    expect(lineTargets('enemyFront', foes)).toHaveLength(1);
    expect(lineTargets('enemyBack', [{ line: 'front' }])).toHaveLength(1);
  });

  it('fury hits harder the more wounded the creature is', () => {
    const c = new Combat(setup(21));
    const a = c.active(0)[0]!;
    const ab = ABILITIES['ogre-club']!;
    const ctx = { orders: c.sides[0].orders, behind: 0, solo: false };
    addEffect(c, a, 'bloodlust');
    const fresh = rawDamage(a, ab, ctx, c.cfg);
    a.hp = a.maxHp * 0.5;
    // Composure softens the low-health penalty, which only starts lower: at half health only fury changes.
    expect(rawDamage(a, ab, ctx, c.cfg) / fresh).toBeCloseTo(1 + EFFECTS.bloodlust!.mods!.fury! * 0.5);
  });

  it('a sacrifice costs health but never kills its user', () => {
    const c = new Combat(setup(22));
    const a = c.active(0)[0]!;
    const t = c.active(1)[0]!;
    a.stamina = a.maxStamina;
    a.hp = 2;
    t.effects = []; // no thorns: only the price itself is tested
    c['execute'](a, { type: 'ability', ability: ABILITIES['blood-price']!, target: t, flank: false, score: 1 });
    expect(a.hp).toBeGreaterThanOrEqual(1);
    a.hp = a.maxHp;
    c['execute'](a, { type: 'ability', ability: ABILITIES['blood-price']!, target: t, flank: false, score: 1 });
    const ev = c.events.filter((e) => e.type === 'sacrifice' && e.actor === a.id).at(-1);
    expect(ev).toMatchObject({ amount: Math.round(a.maxHp * 0.1) });
  });
});

describe('new bestiary mechanics', () => {
  it('a multi-strike ability attacks several times in one action', () => {
    const c = new Combat(setup('hits', ['hydra']));
    const a = c.active(0)[0]!;
    const t = c.active(1)[0]!;
    t.hp = t.maxHp = 10000;
    a.stamina = a.maxStamina;
    const before = c.events.length;
    c['execute'](a, { type: 'ability', ability: ABILITIES['hydra-bites']!, target: t, flank: false, score: 1 });
    const attacks = c.events.slice(before).filter((e) => e.type === 'attack' && e.actor === a.id);
    expect(attacks.length).toBe(3);
  });

  it('the skeleton gets back up once, then stays down', () => {
    const c = new Combat(setup('revive', ['skeleton']));
    const s = c.active(0)[0]!;
    expect(s.effects.some((e) => e.id === 'reassembling')).toBe(true);
    s.hp = 0;
    c['knockOut'](s);
    expect(s.state).toBe('active');
    expect(s.hp).toBe(Math.round(s.maxHp * EFFECTS.reassembling!.revive!));
    expect(c.events.some((e) => e.type === 'revive' && e.target === s.id)).toBe(true);
    s.hp = 0;
    c['knockOut'](s);
    expect(s.state).toBe('ko');
  });
});
