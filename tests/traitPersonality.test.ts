import { describe, expect, it } from 'vitest';
import type { Creature } from '../src/engine/model.ts';
import { ambitionOf, leaveDrive, moraleVolatility, traitTrainingMult } from '../src/engine/creature/traitPersonality.ts';
import { askingWage } from '../src/engine/economy/value.ts';
import { newGame } from '../src/engine/league/season.ts';

const make = (traits: string[]) => ({ traits, hidden: { ambition: 10 } }) as unknown as Creature;

describe('traits outside the arena', () => {
  it('neutral without such traits', () => {
    const c = make(['lucky']);
    expect(traitTrainingMult(c)).toBe(1);
    expect(ambitionOf(c)).toBe(10);
    expect(leaveDrive(c)).toBe(10);
    expect(moraleVolatility(c)).toBe(1);
  });

  it('training, ambition, loyalty and morale swings follow the traits', () => {
    expect(traitTrainingMult(make(['quick-learner']))).toBeGreaterThan(1);
    expect(traitTrainingMult(make(['lazy']))).toBeLessThan(1);
    expect(ambitionOf(make(['ambitious']))).toBeGreaterThan(10);
    expect(leaveDrive(make(['loyal']))).toBeLessThan(10);
    expect(moraleVolatility(make(['hothead']))).toBeGreaterThan(1);
  });

  it('an ambitious creature asks a higher wage', () => {
    const g = newGame({ seed: 'wage', teamName: 'X', lang: 'fr' });
    const c = structuredClone(g.teams[0]!.creatures[0]!);
    c.traits = [];
    const plain = askingWage(c, 50);
    c.traits = ['ambitious'];
    expect(askingWage(c, 50)).toBeGreaterThan(plain);
  });
});
