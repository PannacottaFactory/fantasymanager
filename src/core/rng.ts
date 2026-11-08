/**
 * Seeded pseudo-random generator (sfc32, seeded through splitmix32).
 *
 * Every random decision in the engine goes through an Rng instance so that
 * a given seed always reproduces the same match / season.
 * Use `deriveSeed(...)` / `rng.fork(label)` to create independent streams:
 * e.g. the commentary uses its own stream so text variety never alters results.
 */

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** 32-bit string hash (cyrb53 folded to 32 bits). Stable across platforms. */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Combine several parts (world seed, match id, label…) into one 32-bit seed. */
export function deriveSeed(...parts: (string | number)[]): number {
  return hashString(parts.map(String).join('|'));
}

/** Accepts numbers or arbitrary strings ("dragon-cup-final"). */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  return hashString(String(seed));
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  readonly seed: number;

  constructor(seed: number | string) {
    this.seed = normalizeSeed(seed);
    const sm = splitmix32(this.seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    // Warm up to decorrelate close seeds.
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  static fromState(seed: number, state: RngState): Rng {
    const r = new Rng(seed);
    r.a = state.a;
    r.b = state.b;
    r.c = state.c;
    r.d = state.d;
    return r;
  }

  getState(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  /** Independent child stream, deterministic from this rng's seed and the label. */
  fork(label: string | number): Rng {
    return new Rng(deriveSeed(this.seed, 'fork', label));
  }

  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) >>> 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Picks an item with probability proportional to its weight. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weight(it));
      if (roll < 0) return it;
    }
    return items[items.length - 1]!;
  }

  /** Normal distribution (Box–Muller). */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
