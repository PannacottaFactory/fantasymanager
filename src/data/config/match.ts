/** Arena rules for a match. Leagues may override these later. */
export const MATCH_CONFIG = {
  starters: 5,
  benchSize: 3,
  maxRounds: 20,
  /** After these rounds the horn sounds: managers may substitute and change orders. */
  breakRounds: [5, 10, 15],
  maxSubstitutions: 3,
  /** League points per outcome. */
  points: { koWin: 3, pointsWin: 2, pointsLoss: 1, koLoss: 0 },
};

export type MatchConfig = typeof MATCH_CONFIG;
