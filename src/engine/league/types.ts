/** Season state. Plain serializable data: this is what a save file contains. */
import type { AmbitionId } from '../club/ambitions.ts';
import type { Lang } from '../../core/i18n.ts';
import type { AttributeCategory, AttributeKey } from '../../data/attributes.ts';
import type { IntensityId, ProgramId } from '../../data/config/training.ts';
import type { FacilityId } from '../../data/config/club.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import type { MedalFamily } from '../../data/config/collection.ts';
import type { MatchMethod, MatchResult, MatchSetup, Side } from '../combat/types.ts';
import type { Creature, Team } from '../model.ts';
import type { SessionState } from '../progression/sessions.ts';

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
  /** Cup and tournament ties only (league fixtures have none). */
  competition?: 'cup' | 'tournament';
  /** Tournament ties: which tournament. */
  tournamentId?: string;
  /** Cup / tournament round (0-based). */
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
  | {
      kind: 'scoutReport';
      target: 'creature' | 'team';
      targetId: string;
      name: string;
      /** Creature reports: knowledge before the report (the reveal narrows the ranges from there), verdict. */
      before?: number;
      verdict?: ScoutVerdict;
      /** Gems: weeks before the world notices it. */
      quiet?: number;
    }
  | { kind: 'gemNoticed'; creatureId: string; name: string }
  | { kind: 'contractExpiring'; names: string[] }
  | { kind: 'contractLeft'; names: string[] }
  | { kind: 'seasonPrize'; position: number; amount: number }
  | { kind: 'financeWarning'; balance: number }
  | { kind: 'marketNews'; moves: TransferMove[] }
  | { kind: 'emergencySigning'; names: string[] }
  // ——— Phase 4: training & life cycle ———
  | { kind: 'youthIntake'; names: string[]; count?: number }
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
  | { kind: 'levelUp'; creatureId: string; name: string; level: number; points: number; gains?: { k: AttributeKey; d: number }[] }
  | { kind: 'coachHired'; name: string; domain: AttributeCategory; quality: number }
  // ——— Phase 5: divisions, cup, club ———
  /** Cup messages; with `tournament` (a tournament id), they are about that tournament. */
  | { kind: 'cupDraw'; round: number; opponent: string; home: boolean; tournament?: string; rounds?: number }
  | { kind: 'cupOut'; round: number; by: string; tournament?: string; rounds?: number }
  | { kind: 'cupWon'; prize: number; tournament?: string }
  | { kind: 'tournamentInvite'; tournament: string; fee: number }
  | { kind: 'championsQualified' }
  | { kind: 'promoted'; division: number }
  | { kind: 'relegated'; division: number }
  | { kind: 'boardObjective'; objective: ObjectiveId; division: number }
  | { kind: 'boardVerdict'; objective: ObjectiveId; met: boolean; position: number; bonus: number; confidence: number }
  | { kind: 'boardWarning'; confidence: number }
  | { kind: 'boardMood'; from: BoardMood; to: BoardMood; confidence: number }
  | { kind: 'fansMood'; from: FansTier; to: FansTier; mood: number }
  | { kind: 'request'; requestId: string; request: RequestKind; creatureId: string; name: string; wage?: number; asked?: number; fee?: number; fromTeam?: string }
  | { kind: 'requestOutcome'; request: RequestKind; creatureId: string; name: string; outcome: 'kept' | 'broken' | 'expired'; friends: string[] }
  | { kind: 'ultimatum'; need: number; of: number }
  /** Career mode: `warning` = one more miss costs the job; `sacked` = this one did. */
  | { kind: 'ultimatumOver'; met: boolean; wins: number; need: number; of: number; reputation: number; frozen: number; warning?: boolean; sacked?: boolean }
  | { kind: 'facilityDone'; facility: FacilityId; level: number }
  | { kind: 'friendLeft'; name: string; friends: string[] }
  | { kind: 'death'; creatureId: string; name: string; speciesId: string; injuryId: string; opponent: string; friends: string[] }
  | { kind: 'relation'; a: string; b: string; bond: 'friends' | 'rivals' }
  | { kind: 'ambition'; ambition: AmbitionId }
  | { kind: 'medal'; creatureId: string; name: string; family: MedalFamily; tier: number; /** Other creatures that won the same medal that week. */ more?: { creatureId: string; name: string }[] }
  | { kind: 'bestiary'; seen: string[]; owned: string[]; rewards: BestiaryReward[] }
  | { kind: 'arenaIntro' }
  // ——— Career mode ———
  | { kind: 'sacked'; team: string; reason: SackReason; reputation: number }
  | { kind: 'jobOffer'; offerId: string; teamId: string; team: string; division: number; reason: JobOfferReason; until: number }
  | { kind: 'newJob'; teamId: string; team: string; division: number; from: string }
  | { kind: 'resigned'; team: string; reputation: number }
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
export type ExpenseKind = 'wages' | 'staff' | 'upkeep' | 'medical' | 'scouting' | 'facilities' | 'purchases' | 'compensation' | 'fees';

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

/** gem = high potential for its price; star = very high potential, priced like it; good; below the squad. */
export type ScoutVerdict = 'gem' | 'star' | 'good' | 'below';

/** A gem found by the player's scout: quiet for a few weeks, then noticed by everyone (hype), then forgotten. */
export interface ScoutGem {
  creatureId: string;
  phase: 'quiet' | 'hyped';
  weeksLeft: number;
}

export interface ScoutingState {
  /** 0–100 knowledge of each creature not in the player's stable. */
  knowledge: Record<string, number>;
  missions: ScoutMission[];
  gems?: ScoutGem[];
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

export type BoardMood = 'delighted' | 'content' | 'uneasy' | 'angry';

export type RequestKind = 'playtime' | 'raise' | 'leave';
export type RequestChoice = 'promise' | 'refuse' | 'list' | 'accept' | 'compromise' | 'sell' | 'raise';

/** A star of the player's stable asks for something (one open at a time, a few per season). */
export interface CreatureRequest {
  id: string;
  kind: RequestKind;
  creatureId: string;
  name: string;
  season: number;
  /** League matchday it was asked. */
  matchday: number;
  /** Last matchday to answer (silence = refusal). */
  until: number;
  status: 'open' | 'promised' | 'answered' | 'kept' | 'broken' | 'expired';
  choice?: RequestChoice;
  /** Raise: wage now and wage asked. */
  wage?: number;
  asked?: number;
  /** Leave: the stable courting it and its fee. */
  fromTeamId?: string;
  fee?: number;
  /** Playing-time promise: matches played since, starts among them. */
  seen?: number;
  starts?: number;
}

/** One match of the player's stable: who started, who was fit. */
export interface LineupRecord {
  starters: string[];
  available: string[];
}

export type FansTier = 'euphoric' | 'enthusiastic' | 'loyal' | 'grumbling' | 'furious';

/** The player's supporters. */
export interface FansState {
  /** 0–100 (50 = usual). */
  mood: number;
  /** Wins (> 0) or defeats (< 0) in a row. */
  streak: number;
  /** Last tier announced. */
  tier?: FansTier;
  /** Mood after each of the last weeks with a match (oldest first). */
  trend?: number[];
}

/** `need` wins out of the next `of` league matches of the player. */
export interface Ultimatum {
  need: number;
  of: number;
  wins: number;
  played: number;
}

export interface BoardState {
  objective: ObjectiveId;
  /** 0–100. */
  confidence: number;
  /** Last mood announced to the player (a change sends a message). */
  mood?: BoardMood;
  /** Confidence after each of the last weeks (oldest first). */
  trend?: number[];
  ultimatum?: Ultimatum;
  /** League weeks before another ultimatum may be issued. */
  cooldown?: number;
  /** League weeks of frozen recruitment left (missed ultimatum). */
  frozen?: number;
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
  | { kind: 'cupWinner'; team: string; tournament?: string }
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
  version: 6;
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
  /** Free agents before the last weekly market (display: « new » badge). */
  freeAgentsBefore?: string[];
  // ——— Phase 5 ———
  /** Team ids per division (index 0 = D1). */
  divisions: string[][];
  cup: CupState;
  /** This season's other knockout competitions (pre-season, division cups, Champions Cup, invitationals). */
  tournaments: Tournament[];
  board: BoardState;
  /** Requests of the player's stars (absent in old saves: none). */
  requests?: CreatureRequest[];
  /** Record (matches, rating sum ×10) of the player's creatures when the season started (great-season raises). */
  recordBase?: Record<string, { m: number; r: number }>;
  /** The player's creatures that had a great season last season. */
  greatSeason?: string[];
  /** The player's last matches: starters and fit creatures (playing-time requests). */
  lineups?: LineupRecord[];
  /** The player's supporters (absent in old saves: usual mood). */
  fans?: FansState;
  facilities: Record<string, Facilities>;
  news: NewsItem[];
  // ——— Identities & difficulty ———
  difficulty: DifficultyId;
  /** The player's last matches, replayable (most recent last). */
  matchHistory?: MatchRecord[];
  /** The player's creatures who died (memorial), oldest first. */
  fallen?: FallenCreature[];
  /** The player's finished seasons, oldest first. */
  career?: SeasonRecord[];
  /** Ambitions reached (season when reached). */
  ambitions?: Partial<Record<AmbitionId, number>>;
  /** The player's bestiary: species met in a match / owned, with the season of the first time. */
  bestiary?: Bestiary;
  /** The player's training sessions (earned by playing matches). */
  sessions?: SessionState;
  /** The manager (the player): reputation, jobs, career mode (absent in old saves: no career mode). */
  manager?: ManagerState;
}

export type SackReason = 'ultimatum' | 'verdict';
/** poach = a bigger stable wants the manager; vacancy = a stable parted with its manager mid-season; rescue = after a sacking. */
export type JobOfferReason = 'poach' | 'vacancy' | 'rescue';

/** A stable offers the manager a job. */
export interface JobOffer {
  id: string;
  teamId: string;
  reason: JobOfferReason;
  season: number;
  /** Last league matchday (inclusive) to accept; rescue offers do not lapse. */
  until: number;
}

/** A stable the manager ran. */
export interface ManagerJob {
  teamId: string;
  teamName: string;
  from: { season: number; matchday: number };
  /** Absent for the current job. */
  to?: { season: number; matchday: number };
  /** How it ended: sacked, resigned, or left for another stable. */
  end?: 'sacked' | 'left' | 'resigned';
}

export interface ManagerState {
  /** The manager's name, chosen at new game (absent: unnamed). */
  name?: string;
  /** Career mode: the board can sack the manager, other stables offer jobs. */
  career: boolean;
  /** One save, no going back (the UI keeps a single autosave). */
  ironman: boolean;
  /** 0–100: which stables would hire the manager. */
  reputation: number;
  /** Stables managed, oldest first; the last one is the current job (or the one just lost while unemployed). */
  jobs: ManagerJob[];
  offers: JobOffer[];
  /** Sacked: no week can be played before accepting an offer. */
  unemployed?: boolean;
  /** Ultimatums missed in the current job this season (the last one before `sack.ultimatumStrikes` is a last warning). */
  strikes?: number;
  /** Set by the board during a week, handled at its end (`weeklyCareer`). */
  pendingSack?: SackReason;
  /** Reputation after each finished season (oldest first). */
  trend?: number[];
}

export interface Bestiary {
  seen: Record<string, number>;
  owned: Record<string, number>;
  /** Reward tiers already paid (number of species of the last tier reached). */
  paid: { seen: number; owned: number };
}

export interface BestiaryReward {
  list: 'seen' | 'owned';
  n: number;
  gold: number;
  rep: number;
}

/** One finished season of the player's stable. */
export interface SeasonRecord {
  season: number;
  /** Stable managed that season (career mode: may change; absent in old saves = the current one). */
  teamId?: string;
  teamName?: string;
  division: number;
  position: number;
  points: number;
  cupWon: boolean;
  /** The board's objective was met (absent in old saves). */
  met?: boolean;
  /** League wins and defeats (absent in old saves). */
  won?: number;
  lost?: number;
  /** Board objective of that season. */
  objective?: ObjectiveId;
  /** Tournaments won that season (tournament definition ids: preseason, division, champions, marches…). */
  trophies?: string[];
}

export type TournamentKind = 'preseason' | 'division' | 'champions' | 'open';

/** A knockout competition of the season other than the Shadow Cup. */
export interface Tournament {
  /** Unique this season: preseason, division-0…, champions, marches, argent, or. */
  id: string;
  kind: TournamentKind;
  /** Definition id (the config key, and the name in the UI): preseason, division, champions, marches, argent, or. */
  def: string;
  /** Division cups: which division. Scaled prizes use this division's money. */
  division?: number;
  /** When each round is played (see `cfg.league.tournaments`). */
  keys: number[];
  /** Next round to play (= rounds when over). */
  round: number;
  rounds: number;
  entrants: string[];
  alive: string[];
  winner?: string;
  /** Invitationals: the player paid the fee and plays. */
  registered?: boolean;
}
