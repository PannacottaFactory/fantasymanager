/**
 * Career mode (an option at new game): the manager has a reputation of their own, the board can sack them, other
 * stables offer them a job. Every number of `engine/club/career.ts` lives here.
 */
export const CAREER_CONFIG = {
  /** Manager reputation (0–100) at the start of a game (about the size of a Marches League club). */
  start: 20,
  /**
   * End of each season, before promotions: objective met / missed, title, promotion, relegation, each trophy (the
   * Shadow Cup counts `shadow`), all × the division's weight (index 0 = Grand Arena). Gains shrink near the top
   * (× (1 − reputation / `gainDivisor`)).
   */
  season: {
    met: 5,
    missed: -4,
    title: 8,
    promotion: 6,
    relegation: -8,
    trophy: 3,
    shadow: 6,
    divisionWeight: [1.6, 1.3, 1.1, 1],
    gainDivisor: 140,
  },
  /** Reputation lost when sacked. */
  sacked: -5,
  /** Reputation lost when resigning (the manager then picks among `offers.rescue` stables within reach). */
  resigned: -2,
  sack: {
    /** Missed ultimatums in the same job and season that cost it (the one before is a last warning); 0 = never. */
    ultimatumStrikes: 2,
    /** End of season: objective missed and confidence below this ⇒ sacked… */
    verdictBelow: 20,
    /** …unless the manager arrived this season after this league week (not judged on someone else's season). */
    verdictJoinedBy: 6,
    /** A new job: no ultimatum during its first league weeks. */
    graceWeeks: 6,
  },
  offers: {
    /** A stable may offer a job when its reputation ≤ the manager's + `reach`… */
    reach: 8,
    /** …and it is a step up: its reputation ≥ the current club's + `step`. */
    step: 4,
    /** At the season change: chance of an offer (per eligible stable, at most `seasonMax`). */
    seasonChance: 0.5,
    seasonMax: 2,
    /** During the season (league weeks `midFrom`…`midTo`): weekly chance that one eligible stable calls. */
    weeklyChance: 0.05,
    midFrom: 6,
    midTo: 15,
    /** League weeks to answer an offer (pre-season counts as week 1). */
    weeks: 3,
    /** Sacked: this many stables in trouble offer a way back (at least one, whatever the reputation). */
    rescue: 3,
    /** Never more than this many offers on the table. */
    max: 3,
  },
  /** Knowledge kept of the creatures of a stable the manager left (0–100, as a scout's report). */
  formerKnowledge: 90,
};

export type CareerConfig = typeof CAREER_CONFIG;
