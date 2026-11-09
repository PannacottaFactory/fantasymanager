/** Season state. Plain serializable data: this is what a save file contains. */
import type { MatchMethod, MatchResult, Side } from '../combat/types.ts';
import type { Team } from '../model.ts';

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
);

export interface StoredMatch {
  fixtureId: string;
  /** Player's team is always side 0 in the stored result. */
  result: MatchResult;
}

export interface GameState {
  version: 1;
  worldSeed: string;
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
}
