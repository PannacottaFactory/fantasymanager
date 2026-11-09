import type { Rng } from '../../core/rng.ts';
import type { Fixture } from './types.ts';

/**
 * Round-robin calendar (circle method). Every team plays once per matchday; with `legs` = 2 the
 * second half repeats the pairings with home and away swapped. Home/away alternate as much as possible.
 */
export function roundRobin(rng: Rng, teamIds: readonly string[], legs = 2, season = 1): Fixture[] {
  if (teamIds.length % 2 !== 0) throw new Error('Round-robin needs an even number of teams');
  const order = teamIds.slice();
  // Shuffle so the calendar differs from one world to another.
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const n = order.length;
  const rounds: [string, string][][] = [];
  const rot = order.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const ring = [order[0]!, ...rot];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]!;
      const b = ring[n - 1 - i]!;
      // Alternate who hosts so nobody stays home (or away) all season.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rot.unshift(rot.pop()!);
  }
  const fixtures: Fixture[] = [];
  for (let leg = 0; leg < legs; leg++) {
    rounds.forEach((pairs, r) => {
      const matchday = leg * rounds.length + r + 1;
      pairs.forEach(([h, a], i) => {
        const [home, away] = leg % 2 === 0 ? [h, a] : [a, h];
        fixtures.push({ id: `s${season}-d${matchday}-${i}`, matchday, home, away });
      });
    });
  }
  return fixtures;
}

export function matchdayCount(fixtures: readonly Fixture[]): number {
  return fixtures.reduce((m, f) => Math.max(m, f.matchday), 0);
}
