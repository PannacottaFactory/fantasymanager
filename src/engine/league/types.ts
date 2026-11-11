/** Season state. Plain serializable data: this is what a save file contains. */
import type { Lang } from '../../core/i18n.ts';
import type { AttributeCategory, AttributeKey } from '../../data/attributes.ts';
import type { IntensityId, ProgramId } from '../../data/config/training.ts';
import type { FacilityId } from '../../data/config/club.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import type { MatchMethod, MatchResult, MatchSetup, Side } from '../combat/types.ts';
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
  /** 1-based. Cup ties carry the league matchday they follow. */
  matchday: number;
  home: string;
  away: string;
  result?: FixtureResult;
  /** League fixtures: division index (0 = D1). */
  division?: number;
  /** Cup ties only. */
  competition?: 'cup';
  /** Cup round (0-based). */
  round?: number;
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
  // ——— Phase 4: training & life cycle ———
  | { kind: 'youthIntake'; names: string[] }
  | { kind: 'youthReleased'; names: string[] }
  | { kind: 'retired'; names: string[] }
  | {
      kind: 'trainingReport';
      /** Changes since the previous report (gain = attribute points; abilityFrom/To = aptitude 1–200). */
      items: { creatureId: string; name: string; gain: number; attrs?: { k: AttributeKey; d: number }[]; abilityFrom?: number; abilityTo?: number }[];
      weeks?: number;
    }
  /** `ability` = level at which it unlocked. */
  | { kind: 'abilityUnlocked'; creatureId: string; name: string; abilityId: string; ability: number }
  | { kind: 'levelUp'; creatureId: string; name: string; level: number; points: number }
  | { kind: 'coachHired'; name: string; domain: AttributeCategory; quality: number }
  // ——— Phase 5: divisions, cup, club ———
  | { kind: 'cupDraw'; round: number; opponent: string; home: boolean }
  | { kind: 'cupOut'; round: number; by: string }
  | { kind: 'cupWon'; prize: number }
  | { kind: 'promoted'; division: number }
  | { kind: 'relegated'; division: number }
  | { kind: 'boardObjective'; objective: ObjectiveId; division: number }
  | { kind: 'boardVerdict'; objective: ObjectiveId; met: boolean; position: number; bonus: number; confidence: number }
  | { kind: 'boardWarning'; confidence: number }
  | { kind: 'facilityDone'; facility: FacilityId; level: number }
  | { kind: 'friendLeft'; name: string; friends: string[] }
  | { kind: 'death'; creatureId: string; name: string; speciesId: string; injuryId: string; opponent: string; friends: string[] }
  | { kind: 'relation'; a: string; b: string; bond: 'friends' | 'rivals' }
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
export type ExpenseKind = 'wages' | 'staff' | 'upkeep' | 'medical' | 'scouting' | 'facilities' | 'purchases' | 'compensation';

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

/**
 * What it takes to replay one of the player's matches exactly: the teams as they entered the arena and the
 * decisions taken at the breaks (the fight is deterministic). Player's team is side 0.
 */
export interface MatchRecord {
  fixtureId: string;
  season: number;
  matchday: number;
  setup: MatchSetup;
  decisions: MatchResult['decisions'];
}

export interface TrainingPlan {
  program: ProgramId;
  intensity: IntensityId;
}

export interface Coach {
  id: string;
  name: string;
  domain: AttributeCategory;
  /** 1–20. */
  quality: number;
  /** Gold per week. */
  wage: number;
}

export type ObjectiveId = 'title' | 'promotion' | 'topHalf' | 'midTable' | 'survive';

export interface BoardState {
  objective: ObjectiveId;
  /** 0–100. */
  confidence: number;
}

export interface CupState {
  /** Next round to play (0-based); equals the number of rounds once the cup is over. */
  round: number;
  rounds: number;
  /** Teams still in the cup. */
  alive: string[];
  winner?: string;
}

export interface FacilityState {
  level: number;
  /** Level being built and weeks left (null when idle). */
  building: { level: number; weeksLeft: number } | null;
}

export type Facilities = Record<FacilityId, FacilityState>;

/** League news, stored as data and worded by the UI. */
export type NewsItem = { id: string; season: number; matchday: number } & (
  | { kind: 'upset'; winner: string; loser: string; cup: boolean }
  | { kind: 'quickKo'; winner: string; loser: string; rounds: number }
  | { kind: 'streak'; team: string; wins: number }
  | { kind: 'leader'; team: string; division: number }
  | { kind: 'bigTransfer'; name: string; from: string | null; to: string; fee: number }
  | { kind: 'starInjury'; name: string; team: string; weeks: number }
  | { kind: 'cupWinner'; team: string }
  | { kind: 'champion'; team: string; division: number }
  | { kind: 'promotion'; teams: string[]; division: number }
  | { kind: 'relegation'; teams: string[]; division: number }
  | { kind: 'retirement'; name: string; team: string }
  | { kind: 'death'; name: string; team: string }
);

/** A creature of the player's stable who died after a match (kept for the memorial). */
export interface FallenCreature {
  id: string;
  name: string;
  speciesId: string;
  age: number;
  level: number;
  season: number;
  matchday: number;
  opponent: string;
  injuryId: string;
}

export interface GameState {
  version: 5;
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
  // ——— Phase 4 ———
  /** Player's training plans (missing = balanced, normal). */
  training: Record<string, TrainingPlan>;
  /** Coaches of each stable, one per domain at most. */
  staff: Record<string, Partial<Record<AttributeCategory, Coach>>>;
  /** Coaches looking for a stable. */
  coachMarket: Coach[];
  /** This off-season's young creatures awaiting the player's decision. */
  youth: Creature[];
  // ——— Phase 5 ———
  /** Team ids per division (index 0 = D1). */
  divisions: string[][];
  cup: CupState;
  board: BoardState;
  facilities: Record<string, Facilities>;
  news: NewsItem[];
  // ——— Identities & difficulty ———
  difficulty: DifficultyId;
  /** The player's last matches, replayable (most recent last). */
  matchHistory?: MatchRecord[];
  /** The player's creatures who died (memorial), oldest first. */
  fallen?: FallenCreature[];
}
