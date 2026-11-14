/** Economy, contracts, transfers and scouting balancing (phase 3). Money is in gold pieces. */
export const ECONOMY_CONFIG = {
  value: {
    /** Value of a creature with current ability 100 (before age / potential / rarity factors). */
    base: 10000,
    /** value ∝ (ability / 100) ^ exponent. */
    exponent: 2.5,
    /** Young creatures: + (potential − ability) / 100 × this, until the end of their prime. */
    potentialWeight: 1.3,
    /** Past their prime: × (1 − this × years past peakEnd), floored at minAgeFactor. */
    declinePerYear: 0.18,
    minAgeFactor: 0.25,
    /** Rare species are worth more: × (1 + (10 − rarity) × this). */
    rarityWeight: 0.05,
    /** Displayed / negotiated amounts are rounded to this. */
    round: 50,
  },
  wage: {
    /** Weekly wage asked = value × perValue + base (rounded to 10). */
    perValue: 0.009,
    base: 20,
    /** Ambitious creatures ask more: × (1 + (ambition − 10) × this). */
    ambitionWeight: 0.03,
    /** Small clubs pay a premium: × (1 + (referenceReputation − reputation) / this) when positive. */
    referenceReputation: 60,
    reputationDivisor: 200,
    /** Extra wage asked per contract year beyond the first. */
    perExtraYear: 0.05,
    /** Contracts last 1–3 seasons. */
    minYears: 1,
    maxYears: 3,
  },
  income: {
    /** Home match ticket revenue = base × (0.6 + reputation/100 × 0.8) × (1 + opponent reputation/100 × 0.3). */
    ticketsBase: 3000,
    /** Weekly sponsor = base + reputation × perReputation. */
    sponsorBase: 500,
    sponsorPerReputation: 8,
    /** Match prizes by outcome (paid to each side). */
    matchPrize: { koWin: 450, pointsWin: 300, pointsLoss: 100, koLoss: 0 },
    /** Season prizes by final position (1st … 10th). */
    seasonPrize: [30000, 22000, 17000, 13000, 10000, 8000, 6000, 4500, 3500, 2500],
  },
  expense: {
    /** Weekly care of an injured creature. */
    medicalPerInjury: 60,
    /** Weekly cost of a scout on a mission. */
    scoutPerWeek: 250,
  },
  club: {
    /** Starting reputation (0–100) and treasury by quality tier. */
    reputation: { novice: 20, regional: 35, professional: 50, elite: 70, legendary: 85 },
    startBalance: { novice: 15000, regional: 25000, professional: 40000, elite: 70000, legendary: 110000 },
    /** End of season: reputation += (middle position − position) × this. */
    reputationPerPlace: 2,
    /** …then moves this share of the way back to its division's usual level (D1 … D4). */
    reputationBaseline: [64, 46, 30, 18],
    reputationReversion: 0.2,
    minSquad: 9,
    maxSquad: 16,
  },
  transfers: {
    /** AI asking price = value × (base + importance × importanceWeight); importance 1 = starter, 0.5 = bench, 0 = reserve. */
    askBase: 1.1,
    importanceWeight: 0.4,
    /** Bids above asking × (1 ± acceptJitter) are accepted; above asking × counterFrom a counter-offer is made. */
    acceptJitter: 0.05,
    counterFrom: 0.75,
    /** Negotiation rounds per creature and week before the other stable stops answering. */
    maxBidsPerWeek: 3,
    /** Free agents: one-off signing bonus = value × this. */
    signingBonus: 0.55,
    /** Chance per week that an AI stable bids for one of the player's creatures (and extra per listed creature). */
    aiOfferChance: 0.2,
    aiOfferChanceListed: 0.35,
    /** AI offer = value × [min, max] (listed creatures: lower bound). */
    aiOfferRange: [0.85, 1.15],
    aiOfferRangeListed: [0.75, 1.0],
    /** Incoming offers stay open this many weeks. */
    offerWeeks: 2,
    /** Chance per week that an AI stable signs a free agent / buys from another AI stable. */
    aiSignChance: 0.25,
    aiBuyChance: 0.06,
    /** AI stables keep this much money (+ one week of wages) aside before spending. */
    aiReserve: 8000,
    /** Short-handed AI stables (below the usual squad size) sign a free agent with this chance per week. */
    aiNeedChance: 0.6,
    /** AI stables in the red sell a creature to a richer one (chance per week, price × value). */
    distressSellChance: 0.5,
    distressPrice: 0.9,
    /** Above this treasury an AI stable shops much more (× aiBuyChance) and settles for smaller upgrades. */
    richBalance: 150000,
    richBuyFactor: 4,
    /** Releasing a creature costs this fraction of its remaining wages. */
    releaseCompensation: 0.5,
  },
  freeAgents: {
    /** Pool size kept by weekly arrivals. */
    pool: 8,
    /** At most this many free agents: the least valuable leave (e.g. after the off-season's young prospects). */
    max: 10,
    /** « Other stables » shortlist: offers shown, divisions around the player's. */
    offers: 15,
    offerDivisions: 1,
    /** Of which « dream » offers: the most valuable creatures of the divisions above, whatever their price. */
    dreamOffers: 5,
    /** Chance per week that a free agent signs elsewhere / leaves. */
    leaveChance: 0.2,
    /** Quality of newcomers (weights). */
    qualityWeights: { novice: 4, regional: 6, professional: 3, elite: 0.5 },
  },
  scouting: {
    /** Scouts available to the player. */
    scouts: 2,
    /** Mission length (weeks) and knowledge reached. */
    creatureWeeks: 2,
    creatureKnowledge: 90,
    /**
     * Scout verdicts, from the scout's estimates only. Reference = average maximum level of the player's best five.
     * Gem: potential ≥ reference + 1 while costing ≤ `cheapRatio` of what it would be worth at its potential.
     * Star: potential ≥ reference + `starLevels`, priced like it. Good: potential ≥ reference, or better now than the
     * player's fifth best. Otherwise below.
     */
    verdict: { starLevels: 2, cheapRatio: 0.6 },
    /**
     * A gem the player alone knows stays cheap for `quietWeeks`; then the world notices it: value × `hype`, AI stables
     * look harder at it (+`aiFit` aptitude points in their choices) for `hypeWeeks`.
     */
    gem: { quietWeeks: 3, hype: 1.3, aiFit: 25, hypeWeeks: 8 },
    teamWeeks: 3,
    teamKnowledge: 70,
    /** Starting knowledge (0–100) of league creatures and free agents. */
    leagueBaseline: 25,
    freeAgentBaseline: 10,
    /** Facing a creature in a match teaches this much (up to matchCap). */
    perMatch: 20,
    matchCap: 60,
    /** Attribute ranges: half-width = round(maxSpread × (1 − knowledge/100)). */
    maxSpread: 6,
    /** Potential estimate error (ability points) at zero knowledge. */
    potentialError: 40,
  },
  /** Inbox warning for contracts ending this season, this many matchdays before the end. */
  contractWarningMatchdays: 4,
};

export type EconomyConfig = typeof ECONOMY_CONFIG;
