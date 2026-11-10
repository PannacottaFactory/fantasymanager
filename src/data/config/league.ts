/** League & season balancing (phase 2: one division, double round-robin). */
export const LEAGUE_CONFIG = {
  /** Stables per division. */
  teams: 10,
  /** Creatures per stable (5 starters + 3 bench + reserves to rotate). */
  squadSize: 12,
  /** Quality tier of the player's stable. */
  playerQuality: 'regional' as const,
  /** Division the player starts in (0 = top division). */
  playerDivision: 1,
  /**
   * Quality tier of each stable, per division (index 0 = D1). The player's stable takes the last slot
   * of its division.
   */
  divisions: [
    ['elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional'],
    ['professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'regional'],
  ] as const,
  /** Teams going up / down between two divisions each season. */
  promoted: 2,
  /** Money scale by division (tickets, sponsor, prizes). */
  divisionMoney: [1.35, 1],
  cup: {
    /** Round r is played in the week after league matchday after[r]. */
    after: [3, 7, 11, 14, 17],
    /** Teams entering in round 2 directly (the strongest), the others play a preliminary round. */
    byes: 12,
    /** Prize for winning each round (the last one = the trophy). */
    prize: [1500, 3000, 6000, 12000, 25000],
  },
  /** Player's matches kept for replay. */
  replayHistory: 10,
  /** Each pairing meets this many times (2 = home and away). */
  legs: 2,
  week: {
    /** Fatigue (0–100) recovered each week: base + recovery attribute × perRecovery. */
    fatigueRecovery: 22,
    fatigueRecoveryPerAttr: 0.6,
    /** Morale drifts back towards this value each week, by this fraction of the gap. */
    moraleBaseline: 60,
    moraleDrift: 0.15,
    /** Form (1–20) drifts back towards 10 by this fraction of the gap. */
    formDrift: 0.15,
  },
  afterMatch: {
    /** Morale change for creatures of the team that played (by outcome). */
    morale: { koWin: 8, pointsWin: 5, pointsLoss: -3, koLoss: -7 },
    /** Form change per rating point above/below 6 (creatures who played). */
    formPerRatingPoint: 0.9,
    /** Extra morale for the match MVP. */
    mvpMorale: 6,
  },
  ai: {
    /** AI managers rest creatures whose fatigue is above this. */
    restFatigue: 55,
    /** Weight of fatigue in lineup choices: score = ability × (1 − fatigue/100 × weight). */
    fatigueWeight: 0.6,
  },
};

export type LeagueConfig = typeof LEAGUE_CONFIG;
