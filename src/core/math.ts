export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const round = (v: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

export const sum = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0);

export const avg = (values: readonly number[]): number => (values.length ? sum(values) / values.length : 0);

/** Maps v from [inMin, inMax] to [0, 1], clamped. */
export const norm = (v: number, inMin: number, inMax: number): number =>
  inMax === inMin ? 0 : clamp((v - inMin) / (inMax - inMin), 0, 1);

export function maxBy<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}

export function groupCount<T extends string>(items: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[it] = (out[it] ?? 0) + 1;
  return out;
}
