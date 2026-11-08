import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.ts';
import { ATTRIBUTE_KEYS } from '../src/data/attributes.ts';
import { SPECIES, SPECIES_IDS } from '../src/data/species.ts';
import { TRAITS } from '../src/data/traits.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { NAME_CULTURES } from '../src/data/names.ts';
import { generateCreature, ageAbilityFactor } from '../src/engine/creature/generate.ts';
import { getAbilities, maxHp } from '../src/engine/creature/derived.ts';
import { autoTactic, generateTeam, validateTactic } from '../src/engine/team/team.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';

describe('static data integrity', () => {
  it('every species references existing abilities, passives, cultures and traits', () => {
    for (const s of Object.values(SPECIES)) {
      for (const a of s.abilities) expect(ABILITIES[a.id], `${s.id}:${a.id}`).toBeDefined();
      for (const p of s.passives ?? []) expect(EFFECTS[p], p).toBeDefined();
      expect(NAME_CULTURES[s.nameCulture], s.nameCulture).toBeDefined();
      for (const t of Object.keys(s.traitWeights ?? {})) expect(TRAITS[t], t).toBeDefined();
      for (const k of ATTRIBUTE_KEYS) {
        const [lo, hi] = s.attributes[k];
        expect(lo).toBeLessThanOrEqual(hi);
        expect(lo).toBeGreaterThanOrEqual(1);
        expect(hi).toBeLessThanOrEqual(20);
      }
      expect(s.abilities.some((a) => !a.minAbility), `${s.id} needs a basic ability`).toBe(true);
    }
  });

  it('abilities reference existing effects', () => {
    for (const a of Object.values(ABILITIES)) for (const e of a.effects ?? []) expect(EFFECTS[e.effect], `${a.id}:${e.effect}`).toBeDefined();
  });

  it('trait exclusions reference existing traits', () => {
    for (const t of Object.values(TRAITS)) for (const x of t.excludes ?? []) expect(TRAITS[x], x).toBeDefined();
  });
});

describe('creature generation', () => {
  it('is deterministic', () => {
    expect(generateCreature(new Rng(5))).toEqual(generateCreature(new Rng(5)));
  });

  it('respects bounds for every species', () => {
    const rng = new Rng(11);
    for (const id of SPECIES_IDS) {
      for (let i = 0; i < 30; i++) {
        const c = generateCreature(rng, { speciesId: id });
        for (const k of ATTRIBUTE_KEYS) {
          expect(c.attributes[k]).toBeGreaterThanOrEqual(1);
          expect(c.attributes[k]).toBeLessThanOrEqual(20);
        }
        expect(c.ability).toBeLessThanOrEqual(c.potential);
        expect(c.age).toBeGreaterThanOrEqual(SPECIES[id]!.lifeCurve.minAge);
        expect(c.name.length).toBeGreaterThan(1);
        expect(getAbilities(c).length).toBeGreaterThan(0);
        expect(maxHp(c, DEFAULT_CONFIG)).toBeGreaterThan(20);
      }
    }
  });

  it('never produces mutually exclusive traits', () => {
    const rng = new Rng(13);
    for (let i = 0; i < 500; i++) {
      const c = generateCreature(rng);
      for (const t of c.traits) for (const x of TRAITS[t]!.excludes ?? []) expect(c.traits).not.toContain(x);
      expect(new Set(c.traits).size).toBe(c.traits.length);
    }
  });

  it('better quality gives better creatures on average', () => {
    const rng = new Rng(17);
    const avg = (q: 'novice' | 'elite') => {
      let s = 0;
      for (let i = 0; i < 200; i++) s += generateCreature(rng, { quality: q }).potential;
      return s / 200;
    };
    expect(avg('elite')).toBeGreaterThan(avg('novice') + 50);
  });

  it('life curves: goblins peak early, dragons late', () => {
    const goblin = SPECIES.goblin!;
    const dragon = SPECIES.dragon!;
    expect(ageAbilityFactor(goblin, 5)).toBe(1);
    expect(ageAbilityFactor(goblin, 10)).toBeLessThan(0.75);
    expect(ageAbilityFactor(dragon, 12)).toBeLessThan(0.7);
    expect(ageAbilityFactor(dragon, 60)).toBe(1);
  });
});

describe('teams', () => {
  it('generates a valid tactic with at least one front-liner', () => {
    const rng = new Rng(19);
    for (let i = 0; i < 50; i++) {
      const team = generateTeam(rng);
      expect(validateTactic(team)).toEqual([]);
      expect(team.tactic.lineup.some((s) => s.line === 'front')).toBe(true);
      expect(team.tactic.bench.length).toBe(DEFAULT_CONFIG.match.benchSize);
    }
  });

  it('autoTactic skips injured creatures when possible', () => {
    const rng = new Rng(23);
    const team = generateTeam(rng);
    const star = team.creatures.slice().sort((a, b) => b.ability - a.ability)[0]!;
    star.condition.injuries.push({ injuryId: 'gash', weeksLeft: 2 });
    const t = autoTactic(team.creatures);
    expect(t.lineup.map((s) => s.creatureId)).not.toContain(star.id);
  });
});
