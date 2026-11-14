/** Facilities, board, relations and news balancing (phase 5). */
export const CLUB_CONFIG = {
  facilities: {
    maxLevel: 3,
    /** Cost and building time (weeks) of each level (index 0 = level 1). */
    cost: [15000, 35000, 70000],
    weeks: [4, 6, 8],
    /** Weekly upkeep per level. */
    upkeepPerLevel: 60,
    /** Effects per level. */
    infirmary: { injuryWeeks: -0.15, medicalCost: -0.15 },
    training: { growth: 0.1 },
    stands: { tickets: 0.12 },
    /** Starting level by club quality. */
    start: { novice: 0, regional: 0, professional: 1, elite: 2, legendary: 3 },
    /** AI stables start building when they can afford it with this much left over. */
    aiReserve: 25000,
    aiChance: 0.04,
  },
  board: {
    start: 60,
    /** Confidence change by result (league, cup and tournaments; losses × the difficulty's boardLoss). */
    result: { koWin: 3, pointsWin: 2, pointsLoss: -1, koLoss: -2 },
    /**
     * Each league week from matchday `from`: on course for the objective (current place at or above the target) +onTarget,
     * `behind` places or more below the target `offTarget` (× boardLoss).
     */
    standing: { from: 3, onTarget: 1, behind: 3, offTarget: -1 },
    /** Mood thresholds (confidence at or above): below `uneasy` the board is angry. */
    moods: { delighted: 75, content: 50, uneasy: 30 },
    /** Recruitment budget: one purchase (fee or signing bonus) may use at most this share of the treasury. */
    budget: { delighted: 1, content: 0.75, uneasy: 0.5, angry: 0.25 },
    /** Facility works cost × this when delighted; frozen when angry. */
    worksDelighted: 0.8,
    /**
     * An angry board issues an ultimatum: `need` wins out of the next `of` league matches. Met: +reward confidence. Missed:
     * reputation −reputation, recruitment frozen `frozenWeeks` league weeks. No new one for `cooldown` league weeks.
     */
    ultimatum: { need: 2, of: 4, reward: 12, reputation: 5, frozenWeeks: 4, cooldown: 6 },
    /** Weeks of confidence kept for the trend line. */
    trendWeeks: 12,
    /** End of season: objective met / missed. */
    met: 15,
    missed: -20,
    /** Bonus paid when the objective is met (× division money). */
    bonus: 15000,
  },
  relations: {
    /** Starters who fought together gain this much relation per match. */
    perMatch: 3,
    teamPlayerBonus: 2,
    lonerFactor: 0.5,
    /** Weekly chance of a quarrel in each stable (between volatile creatures). */
    quarrelChance: 0.08,
    quarrel: -25,
    friend: 60,
    rival: -50,
    /** Match-start morale per teammate on the field: relation / 100 × this (total clamped to ±maxMorale). */
    moralePerTeammate: 4,
    maxMorale: 8,
    /** Morale lost when a friend leaves. */
    friendLeft: -10,
    /** Friendships and rivalries drawn at the start of a game, per stable. */
    startFriends: 2,
    startRivals: 1,
  },
  news: {
    keep: 80,
    /** A win against a team this many places higher (or a lower division in the cup) is an upset. */
    upsetPlaces: 5,
    /** KO wins this early make headlines. */
    quickKoRounds: 8,
    streaks: [4, 6, 8, 10],
    /** Transfers above this fee make the news. */
    bigFee: 30000,
    /** Injuries of at least this many weeks to the most valuable creatures. */
    starInjuryWeeks: 3,
  },
};

export type ClubConfig = typeof CLUB_CONFIG;
export type FacilityId = 'infirmary' | 'training' | 'stands';
export const FACILITY_IDS: FacilityId[] = ['training', 'infirmary', 'stands'];
