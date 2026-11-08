/** Post-match report: creature ratings (out of 10) and assistant remark thresholds. */
export const REPORT_CONFIG = {
  rating: {
    base: 6,
    min: 3,
    max: 10,
    /** Per unit of (damage dealt / average damage dealt by a creature in this match − 1). */
    damageWeight: 1.1,
    damageCap: 2,
    perKo: 0.45,
    healWeight: 0.9,
    perIntercept: 0.12,
    /** Per unit of (damage taken / average − 1) for tanks (soaking is their job). */
    tankSoakWeight: 0.5,
    knockedOut: -0.6,
    fled: -1.2,
    perHesitation: -0.2,
    perDisobey: -0.1,
    accuracyWeight: 0.8,
    winBonus: 0.3,
    /** Minimum rounds on the field to get a full rating. */
    minRounds: 2,
  },
  remarks: {
    exhaustedEarlyRound: 8,
    lowAccuracy: 0.55,
    minAttacksForAccuracy: 4,
    typeDisadvantage: 0.9,
    typeAdvantage: 1.15,
    backlineDamageShare: 0.35,
    disobeyCount: 2,
    closePointsMargin: 6,
    maxRemarks: 7,
  },
  keyMoments: { max: 8, bigHitFraction: 0.3, swingThreshold: 0.25 },
};

export type ReportConfig = typeof REPORT_CONFIG;
