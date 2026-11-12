/**
 * Things to collect over a career: medals of each creature (from its record) and the bestiary (species met and owned).
 * Display and small rewards only — never a combat bonus.
 */

export type MedalFamily = 'matches' | 'wins' | 'kos' | 'mvp' | 'damage' | 'healing' | 'trophies';

export const COLLECTION_CONFIG = {
  /** Medal thresholds per family (bronze, silver, gold, then « legend » when there is a fourth). */
  medals: {
    matches: [10, 25, 50, 100],
    wins: [8, 20, 40, 75],
    kos: [5, 15, 30, 60],
    mvp: [1, 5, 12, 25],
    damage: [1000, 3000, 7000, 14000],
    healing: [400, 1500, 4000, 8000],
    trophies: [1, 3, 6],
  } satisfies Record<MedalFamily, number[]>,
  /** Bestiary: rewards (gold, reputation) when the number of species met / owned reaches a tier. */
  bestiary: {
    seen: [
      { n: 10, gold: 600, rep: 0 },
      { n: 20, gold: 1200, rep: 1 },
      { n: 30, gold: 2000, rep: 1 },
      { n: 40, gold: 3000, rep: 2 },
      { n: 50, gold: 4500, rep: 2 },
      { n: 60, gold: 6000, rep: 3 },
      { n: 67, gold: 10000, rep: 4 },
    ],
    owned: [
      { n: 5, gold: 800, rep: 0 },
      { n: 10, gold: 1500, rep: 1 },
      { n: 15, gold: 2500, rep: 1 },
      { n: 20, gold: 4000, rep: 2 },
      { n: 30, gold: 6000, rep: 3 },
      { n: 40, gold: 9000, rep: 4 },
    ],
  },
};
