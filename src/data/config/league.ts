/** League & season balancing (phase 2: one division, double round-robin). */
export const LEAGUE_CONFIG = {
  teams: 10,
  /** Creatures per stable (5 starters + 3 bench + reserves to rotate). */
  squadSize: 12,
  /** Quality tier of the player's stable. */
  playerQuality: 'professional' as const,
  /** Quality tier of each AI stable (teams − 1 entries). A mix makes a readable table. */
  aiQualities: ['elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional', 'professional'] as const,
  /** Each pairing meets this many times (2 = home and away). */
  legs: 2,
  week: {
    /** Fatigue (0–100) recovered each week: base + recovery attribute × perRecovery. */
    fatigueRecovery: 28,
    fatigueRecoveryPerAttr: 1,
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
