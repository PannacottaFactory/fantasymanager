import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { SPECIES } from '../src/data/species.ts';
import { TRAITS } from '../src/data/traits.ts';
import { generateTraits } from '../src/engine/creature/generate.ts';
import { newGame, playMatchday, seasonOver } from '../src/engine/league/season.ts';
import type { Creature } from '../src/engine/model.ts';
import { drawTraitChange, gainableTraits } from '../src/engine/progression/traitEvolution.ts';

const te = DEFAULT_CONFIG.traitEvolution;
const creature = (traits: string[]) => ({ traits }) as unknown as Creature;

describe('trait evolution: data', () => {
  it('new traits are drawn at birth, and a seed still gives the same world', () => {
    const a = newGame({ seed: 'birth-world', teamName: 'X', lang: 'fr' });
    const b = newGame({ seed: 'birth-world', teamName: 'X', lang: 'fr' });
    expect(JSON.stringify(a.teams)).toBe(JSON.stringify(b.teams));
    const drawn = new Set(a.teams.flatMap((t) => t.creatures.flatMap((c) => c.traits)));
    expect(['tireless', 'elusive', 'focused', 'jinxed'].some((t) => drawn.has(t))).toBe(true);
  });

  it('traits earned in matches only are never drawn at birth', () => {
    const rng = new Rng('birth');
    const species = Object.values(SPECIES);
    for (let i = 0; i < 3000; i++) {
      for (const t of generateTraits(rng, species[i % species.length]!, DEFAULT_CONFIG)) expect(TRAITS[t]!.acquired, t).toBeFalsy();
    }
  });
});

describe('trait evolution: a change', () => {
  it('never gains a trait beside its opposite', () => {
    const options = gainableTraits(creature(['coward', 'lucky']));
    expect(options).not.toContain('fearless');
    expect(options).not.toContain('coward');
    expect(options).not.toContain('clumsy');
    expect(options).toContain('battle-scarred');
  });

  it('keeps at most maxTraits: a full creature that gains loses another at random', () => {
    const rng = new Rng('full');
    for (let i = 0; i < 500; i++) {
      const c = creature(['loyal', 'cunning', 'patient']);
      const ch = drawTraitChange(rng, c);
      expect(ch).not.toBeNull();
      if (ch!.gained) expect(c.traits).toContain(ch!.replaced);
      else expect(c.traits).toContain(ch!.t);
    }
  });

  it('a creature without traits always gains', () => {
    const rng = new Rng('empty');
    for (let i = 0; i < 200; i++) expect(drawTraitChange(rng, creature([]))!.gained).toBe(true);
  });
});

describe('trait evolution: a season', () => {
  it('changes are random but deterministic, capped, and told to the player', () => {
    const run = () => {
      let g = newGame({ seed: 'traits-world', teamName: 'Test Stable', lang: 'fr' });
      while (!seasonOver(g)) g = playMatchday(g);
      return g;
    };
    const a = run();
    const b = run();
    const logs = (g: typeof a) => g.teams.flatMap((t) => t.creatures.map((c) => [c.id, c.traits, c.traitLog ?? []]));
    expect(JSON.stringify(logs(a))).toBe(JSON.stringify(logs(b)));
    const changes = a.teams.flatMap((t) => t.creatures.flatMap((c) => c.traitLog ?? []));
    expect(changes.length).toBeGreaterThan(a.teams.length);
    for (const t of a.teams) for (const c of t.creatures) expect(c.traits.length, c.name).toBeLessThanOrEqual(te.maxTraits);
    expect(a.inbox.filter((m) => m.kind === 'trait').length).toBeGreaterThan(0);
  }, 120_000);
});
