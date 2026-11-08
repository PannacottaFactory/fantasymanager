import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed, hashString } from '../src/core/rng.ts';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('accepts string seeds', () => {
    expect(new Rng('dragon').next()).toBe(new Rng('dragon').next());
    expect(new Rng('dragon').next()).not.toBe(new Rng('goblin').next());
  });

  it('produces values in range with a sane distribution', () => {
    const r = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
    const ints = new Set<number>();
    for (let i = 0; i < 500; i++) ints.add(r.int(1, 6));
    expect([...ints].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('forks independent but reproducible streams', () => {
    const r = new Rng(1);
    expect(r.fork('a').next()).toBe(new Rng(1).fork('a').next());
    expect(r.fork('a').next()).not.toBe(r.fork('b').next());
  });

  it('restores from state', () => {
    const r = new Rng(99);
    r.next();
    const copy = Rng.fromState(r.seed, r.getState());
    expect(copy.next()).toBe(r.next());
  });

  it('weighted pick respects weights', () => {
    const r = new Rng(3);
    let heavy = 0;
    for (let i = 0; i < 2000; i++) if (r.weighted(['a', 'b'], (x) => (x === 'a' ? 9 : 1)) === 'a') heavy++;
    expect(heavy / 2000).toBeGreaterThan(0.85);
  });

  it('hashes are stable', () => {
    expect(hashString('arena')).toBe(hashString('arena'));
    expect(deriveSeed('world', 1)).not.toBe(deriveSeed('world', 2));
  });
});
