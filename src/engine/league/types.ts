/** Season state. Plain serializable data: this is what a save file contains. */
import type { Lang } from '../../core/i18n.ts';
import type { MatchMethod, MatchResult, Side } from '../combat/types.ts';
import type { Creature, Team } from '../model.ts';

export interface FixtureResult {
  /** 0 = home team won, 1 = away team won. */
  winner: Side;
  method: MatchMethod;
  rounds: number;
  /** Judges' score [home, away]. */
  score: [number, number];
  /** Creatures knocked out by [home, away]. */
  kos: [number, number];
  seed: number;
}

export interface Fixture {
  id: string;
  /** 1-based. */
  matchday: number;
  home: string;
  away: string;
  result?: FixtureResult;
}

export interface StandingRow {
  teamId: string;
  played: number;
  koWins: number;
  pointsWins: number;
  pointsLosses: number;
  koLosses: number;
  points: number;
  /** Judges' score summed over matches (for / against). */
  scoreFor: number;
  scoreAgainst: number;
  kosFor: number;
  kosAgainst: number;
  /** Last results, most recent last: W = KO win, w = points win, l = points loss, L = KO loss. */
  form: string[];
}

/** Inbox messages are stored as structured data and worded by the UI in the player's language. */
export type InboxMessage = { id: string; matchday: number; season: number; read: boolean } & (
  | { kind: 'welcome'; teamName: string; teams: number; matchdays: number }
  | { kind: 'matchResult'; opponent: string; won: boolean; method: MatchMethod; score: [number, number]; rounds: number; fixtureId: string }
  | { kind: 'injury'; creatureId: string; name: string; injuryId: string; weeks: number }
  | { kind: 'recovered'; creatureId: string; name: string }
  | { kind: 'tired'; names: string[] }
  | { kind: 'seasonEnd'; position: number; champion: string; points: number }
  | { kind: 'newSeason' }
  // ——— Phase 3: economy ———
  | { kind: 'offerReceived'; offerId: string; creatureId: string; name: string; fromTeam: string; fee: number }
  | { kind: 'offerExpired'; name: string; fromTeam: string }
  | { kind: 'transferIn'; creatureId: string; name: string; fromTeam: string | null; fee: number; wage: number }
  | { kind: 'transferOut'; name: string; toTeam: string | null; fee: number }
  | { kind: 'scoutReport'; target: 'creature' | 'team'; targetId: string; name: string }
  | { kind: 'contractExpiring'; names: string[] }
  | { kind: 'contractLeft'; names: string[] }
  | { kind: 'seasonPrize'; position: number; amount: number }
  | { kind: 'financeWarning'; balance: number }
  | { kind: 'marketNews'; moves: TransferMove[] }
  | { kind: 'emergencySigning'; names: string[] }
);

/** A transfer between two stables (null = free agent pool). */
export interface TransferMove {
  name: string;
  speciesId: string;
  from: string | null;
  to: string | null;
  fee: number;
}

export type IncomeKind = 'tickets' | 'sponsor' | 'prizes' | 'sales';
export type ExpenseKind = 'wages' | 'upkeep' | 'medical' | 'scouting' | 'purchases' | 'compensation';

/** Money in and out during one matchday week. */
export interface LedgerEntry {
  season: number;
  matchday: number;
  income: Partial<Record<IncomeKind, number>>;
  expense: Partial<Record<ExpenseKind, number>>;
  /** Treasury after the week. */
  balance: number;
}

export interface Club {
  balance: number;
  /** 0–100: attendance, sponsors, attractiveness to creatures. */
  reputation: number;
  /** Current and previous season. */
  ledger: LedgerEntry[];
}

/** An AI stable's offer for one of the player's creatures. */
export interface TransferOffer {
  id: string;
  creatureId: string;
  fromTeamId: string;
  fee: number;
  season: number;
  /** Last matchday (inclusive) before the offer lapses. */
  expires: number;
}

export interface ScoutMission {
  id: string;
  target: 'creature' | 'team';
  /** Creature id or team id. */
  targetId: string;
  weeksLeft: number;
}

export interface ScoutingState {
  /** 0–100 knowledge of each creature not in the player's stable. */
  knowledge: Record<string, number>;
  missions: ScoutMission[];
}

/** Negotiation memory for the player's bids (per creature, per week). */
export interface BidMemory {
  season: number;
  matchday: number;
  count: number;
  /** Last counter-offer made by the other stable. */
  counter?: number;
}

export interface StoredMatch {
  fixtureId: string;
  /** Player's team is always side 0 in the stored result. */
  result: MatchResult;
}

export interface GameState {
  version: 2;
  worldSeed: string;
  /** Language of names generated during the game (free agents). */
  lang: Lang;
  season: number;
  /** Next matchday to play (1-based); greater than the last matchday when the season is over. */
  matchday: number;
  teams: Team[];
  playerTeamId: string;
  fixtures: Fixture[];
  inbox: InboxMessage[];
  /** Full log of the player's last match (to re-read the report). */
  lastMatch: StoredMatch | null;
  /** Counter for message ids. */
  nextMessageId: number;
  // ——— Phase 3 ———
  clubs: Record<string, Club>;
  /** Creatures without a stable, available to sign. */
  freeAgents: Creature[];
  scouting: ScoutingState;
  /** Pending AI offers for the player's creatures. */
  offers: TransferOffer[];
  bids: Record<string, BidMemory>;
  /** Player's creatures listed for sale. */
  forSale: string[];
  /** Counter for offer / mission ids. */
  nextId: number;
}
