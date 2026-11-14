/**
 * Career mode: the manager (the player) has a reputation of their own, can be sacked by the board and is offered jobs
 * by other stables. `takeOver` moves the manager to another stable: the old one goes back to an AI manager, the new
 * one loses its AI identity. Everything is deterministic (own RNG streams) and never changes match results.
 */
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { clubOf } from '../economy/finance.ts';
import { divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import { divisionTables } from '../league/news.ts';
import type { GameState, JobOffer, JobOfferReason, ManagerState, SackReason, SeasonRecord } from '../league/types.ts';
import type { Team } from '../model.ts';
import { placeHeldPoints, releaseYouth, snapshotSeasonStart } from '../progression/training.ts';
import { initBestiary } from '../team/record.ts';
import { drawIdentities } from '../team/identity.ts';
import { aiPrepare, seasonOver } from '../league/season.ts';
import { seasonRequests } from './requests.ts';
import { moodOf, objectiveMet, pickObjective } from './board.ts';

export interface CareerOptions {
  career?: boolean;
  ironman?: boolean;
}

/** The manager of a game started with the given options (first job = the player's stable). */
export function initManager(state: GameState, opts: CareerOptions = {}, cfg: GameConfig = DEFAULT_CONFIG) {
  const team = state.teams.find((t) => t.id === state.playerTeamId)!;
  state.manager = {
    career: !!opts.career,
    ironman: !!opts.career && !!opts.ironman,
    reputation: cfg.career.start,
    jobs: [{ teamId: team.id, teamName: team.name, from: { season: state.season, matchday: state.matchday } }],
    offers: [],
  };
}

export const careerOn = (state: GameState) => !!state.manager?.career;
export const unemployed = (state: GameState) => !!state.manager?.unemployed;

/** Manager reputation (old saves: the start value). */
export const managerReputation = (state: GameState, cfg: GameConfig = DEFAULT_CONFIG) => state.manager?.reputation ?? cfg.career.start;

function moveReputation(m: ManagerState, d: number, cfg: GameConfig) {
  const gain = d > 0 ? d * Math.max(0.15, 1 - m.reputation / cfg.career.season.gainDivisor) : d;
  m.reputation = clamp(Math.round(m.reputation + gain), 0, 100);
}

const aiTeams = (state: GameState) => state.teams.filter((t) => t.id !== state.playerTeamId);

/** Stables that sacked the manager never call back. */
const burnt = (state: GameState) => new Set((state.manager?.jobs ?? []).filter((j) => j.end === 'sacked').map((j) => j.teamId));

/** How badly a stable is doing: its place in its division's table, 0 (top) … 1 (bottom). */
function trouble(state: GameState, tables: ReturnType<typeof divisionTables>, teamId: string): number {
  const table = tables[divisionOf(state, teamId)] ?? [];
  const i = table.findIndex((r) => r.teamId === teamId);
  return table.length > 1 && i >= 0 ? i / (table.length - 1) : 0.5;
}

/** Stables that would hire the manager as a step up from the current one. */
export function jobCandidates(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): Team[] {
  const o = cfg.career.offers;
  const rep = managerReputation(state, cfg);
  const current = clubOf(state, state.playerTeamId).reputation;
  const skip = burnt(state);
  const offered = new Set(state.manager?.offers.map((x) => x.teamId) ?? []);
  return aiTeams(state).filter((t) => {
    const r = clubOf(state, t.id).reputation;
    return !skip.has(t.id) && !offered.has(t.id) && r <= rep + o.reach && r >= current + o.step;
  });
}

function addOffer(state: GameState, team: Team, reason: JobOfferReason, until: number) {
  const m = state.manager!;
  const offer: JobOffer = { id: `job${state.nextId++}`, teamId: team.id, reason, season: state.season, until };
  m.offers.push(offer);
  pushMessage(state, { kind: 'jobOffer', offerId: offer.id, teamId: team.id, team: team.name, division: divisionOf(state, team.id), reason, until });
}

/** Out of a job: stables in trouble that would take the manager (at least one, whatever the reputation). */
function rescueOffers(state: GameState, cfg: GameConfig) {
  const o = cfg.career.offers;
  const rep = managerReputation(state, cfg);
  const skip = burnt(state);
  const tables = divisionTables(state, cfg);
  // Never straight back to the stable just left.
  const left = state.manager?.jobs.at(-1)?.teamId;
  const pool = aiTeams(state).filter((t) => !skip.has(t.id) && t.id !== left);
  const byTrouble = (list: Team[]) =>
    [...list].sort((a, b) => trouble(state, tables, b.id) - trouble(state, tables, a.id) || clubOf(state, b.id).reputation - clubOf(state, a.id).reputation || a.id.localeCompare(b.id));
  let picks = byTrouble(pool.filter((t) => clubOf(state, t.id).reputation <= rep + o.reach)).slice(0, o.rescue);
  if (!picks.length) {
    // Nobody fits: the humblest stables of the lowest division still take a chance.
    const lowest = state.divisions.length - 1;
    picks = byTrouble(pool.filter((t) => divisionOf(state, t.id) === lowest)).slice(0, 1);
  }
  for (const t of picks) addOffer(state, t, 'rescue', Number.MAX_SAFE_INTEGER);
}

/** The board sacks the manager (mutates): reputation falls, rescue offers come; no week is played before one is taken. */
export function sack(state: GameState, reason: SackReason, cfg: GameConfig = DEFAULT_CONFIG) {
  const m = state.manager;
  if (!m || m.unemployed) return;
  delete m.pendingSack;
  const job = m.jobs[m.jobs.length - 1];
  if (job) {
    job.to = { season: state.season, matchday: state.matchday };
    job.end = 'sacked';
  }
  m.unemployed = true;
  moveReputation(m, cfg.career.sacked, cfg);
  m.offers = [];
  pushMessage(state, { kind: 'sacked', team: state.teams.find((t) => t.id === state.playerTeamId)!.name, reason, reputation: m.reputation });
  rescueOffers(state, cfg);
}

/**
 * The manager resigns (career mode, pure): the job ends, reputation dips a little, stables within reach make offers
 * (as after a sacking); no week is played before one is taken.
 */
export function resign(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const m0 = state.manager;
  if (!m0?.career || m0.unemployed) return state;
  const next: GameState = structuredClone(state);
  const m = next.manager!;
  const job = m.jobs[m.jobs.length - 1];
  if (job) {
    job.to = { season: next.season, matchday: next.matchday };
    job.end = 'resigned';
  }
  m.unemployed = true;
  delete m.pendingSack;
  moveReputation(m, cfg.career.resigned, cfg);
  m.offers = [];
  pushMessage(next, { kind: 'resigned', team: next.teams.find((t) => t.id === next.playerTeamId)!.name, reputation: m.reputation });
  rescueOffers(next, cfg);
  return next;
}

/** The board asks for the manager's head (career mode only); handled at the end of the week. */
export function requestSack(state: GameState, reason: SackReason, cfg: GameConfig = DEFAULT_CONFIG) {
  const m = state.manager;
  if (!m?.career || m.unemployed) return;
  if (reason === 'ultimatum') {
    // A missed ultimatum is a strike; the last one allowed costs the job.
    const need = cfg.career.sack.ultimatumStrikes;
    m.strikes = (m.strikes ?? 0) + 1;
    if (!need || m.strikes < need) return;
  }
  m.pendingSack ??= reason;
}

/** One more missed ultimatum and the manager is out (the board's last warning). */
export const lastWarning = (state: GameState, cfg: GameConfig = DEFAULT_CONFIG) =>
  !!state.manager?.career && cfg.career.sack.ultimatumStrikes > 0 && (state.manager.strikes ?? 0) === cfg.career.sack.ultimatumStrikes - 1;

/** End of season (career mode): objective missed with a low confidence (before the verdict) costs the job. */
export function careerVerdict(state: GameState, met: boolean, confidence: number, cfg: GameConfig = DEFAULT_CONFIG) {
  const job = state.manager?.jobs.at(-1);
  const late = !!job && job.from.season === state.season && job.from.matchday > cfg.career.sack.verdictJoinedBy;
  if (!met && !late && confidence < cfg.career.sack.verdictBelow) requestSack(state, 'verdict', cfg);
}

/** End of a league week: a pending sacking, lapsed offers, a stable that calls mid-season. Mutates. */
export function weeklyCareer(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const m = state.manager;
  if (!m?.career) return;
  if (m.pendingSack) sack(state, m.pendingSack, cfg);
  m.offers = m.offers.filter((x) => x.reason === 'rescue' || (x.season === state.season && state.matchday <= x.until));
  if (m.unemployed) return;
  const o = cfg.career.offers;
  // `matchday` is already the next one: the week just played is matchday − 1.
  const week = state.matchday - 1;
  if (week < o.midFrom || week > o.midTo || m.offers.length >= o.max) return;
  const rng = new Rng(deriveSeed(state.worldSeed, 'jobs', state.season, week));
  if (!rng.chance(o.weeklyChance)) return;
  const tables = divisionTables(state, cfg);
  // A stable doing badly is the one parting with its manager.
  const list = jobCandidates(state, cfg).sort((a, b) => trouble(state, tables, b.id) - trouble(state, tables, a.id) || a.id.localeCompare(b.id));
  const pick = list.length ? list[rng.int(0, Math.ceil(list.length / 2) - 1)] : undefined;
  if (pick) addOffer(state, pick, 'vacancy', state.matchday - 1 + o.weeks);
}

/** Reputation change for a finished season of the manager's stable. */
export function seasonReputationDelta(state: GameState, record: SeasonRecord, cfg: GameConfig = DEFAULT_CONFIG): number {
  const s = cfg.career.season;
  const size = state.divisions[record.division]?.length ?? 10;
  const promoted = cfg.league.promoted;
  let d = (record.met ?? objectiveMet(state.board.objective, record.position, size, cfg)) ? s.met : s.missed;
  if (record.position === 1) d += s.title;
  if (record.division > 0 && record.position <= promoted) d += s.promotion;
  if (record.division < state.divisions.length - 1 && record.position > size - promoted) d += s.relegation;
  d += (record.trophies?.length ?? 0) * s.trophy + (record.cupWon ? s.shadow : 0);
  return d * (s.divisionWeight[record.division] ?? 1);
}

/** Season change, before the board's new objective: the season just finished moves the manager's reputation. Mutates. */
export function careerSeasonReview(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const m = state.manager;
  if (!m) return;
  const record = state.career?.find((r) => r.season === state.season);
  if (record) moveReputation(m, seasonReputationDelta(state, record, cfg), cfg);
  // A new season wipes the slate: missed ultimatums only add up within a season.
  delete m.strikes;
  m.trend = [...(m.trend ?? []), m.reputation].slice(-20);
}

/** New season (career mode): stables a step up may call (offers open until week `offers.weeks`). Mutates. */
export function seasonOffers(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const m = state.manager;
  if (!m?.career || m.unemployed) return;
  const o = cfg.career.offers;
  m.offers = m.offers.filter((x) => x.reason === 'rescue');
  const rng = new Rng(deriveSeed(state.worldSeed, 'jobs', state.season, 0));
  const list = jobCandidates(state, cfg).sort((a, b) => clubOf(state, b.id).reputation - clubOf(state, a.id).reputation || a.id.localeCompare(b.id));
  let n = 0;
  for (const t of list) {
    if (n >= o.seasonMax || m.offers.length >= o.max) break;
    if (!rng.chance(o.seasonChance)) continue;
    addOffer(state, t, 'poach', o.weeks);
    n++;
  }
}

/**
 * The manager takes over another stable (pure). The stable left gets an AI manager (a new identity; held free points
 * placed, its tactic set by the AI); the new one loses its identity. What belonged to the old job is cleared (sale
 * list, offers, bids, training plans, open requests, line-up memory, sessions, youngsters awaiting a decision), the
 * board and the supporters start afresh. The manager keeps their inbox, knowledge (and knows the old squad well),
 * bestiary, ambitions, replays and memorial.
 */
export function takeOver(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  if (teamId === state.playerTeamId || !state.teams.some((t) => t.id === teamId)) return state;
  const next: GameState = structuredClone(state);
  const difficulty = next.difficulty ?? 'normal';
  const old = next.teams.find((t) => t.id === next.playerTeamId)!;
  const team = next.teams.find((t) => t.id === teamId)!;
  next.manager ??= { career: false, ironman: false, reputation: cfg.career.start, jobs: [{ teamId: old.id, teamName: old.name, from: { season: 1, matchday: 1 } }], offers: [] };
  const m = next.manager;
  const now = { season: next.season, matchday: next.matchday };

  // Youngsters awaiting the old job's decision go to the market.
  releaseYouth(next);

  // The stable left: an AI manager comes in.
  const rng = new Rng(deriveSeed(next.worldSeed, 'takeOver', next.season, next.matchday, old.id));
  old.identity = { ...drawIdentities(rng, 1)[0]!, gen: m.jobs.length };
  placeHeldPoints(next, old, cfg);
  for (const c of old.creatures) {
    next.scouting.knowledge[c.id] = Math.max(next.scouting.knowledge[c.id] ?? 0, cfg.career.formerKnowledge);
    delete next.training[c.id];
  }

  // The new stable: no AI identity, its creatures are the manager's own.
  delete team.identity;
  for (const c of team.creatures) delete next.scouting.knowledge[c.id];
  next.playerTeamId = team.id;
  old.tactic = aiPrepare(old, cfg, difficulty).tactic;

  next.forSale = [];
  next.offers = [];
  next.bids = {};
  next.lineups = [];
  next.requests = (next.requests ?? []).filter((r) => r.status !== 'open' && r.status !== 'promised');
  next.sessions = { available: 0, total: next.sessions?.total ?? 0, recent: [] };
  delete next.fans;
  for (const t of next.tournaments) delete t.registered;

  const start = cfg.club.board.start;
  next.board = { objective: pickObjective(next, cfg), confidence: start, mood: moodOf(start, cfg), cooldown: cfg.career.sack.graceWeeks };
  seasonRequests(next, cfg);
  next.greatSeason = [];
  snapshotSeasonStart(next, cfg);
  initBestiary(next);

  const last = m.jobs[m.jobs.length - 1];
  if (last && !last.to) {
    last.to = now;
    last.end = 'left';
  }
  m.jobs.push({ teamId: team.id, teamName: team.name, from: now });
  m.offers = [];
  delete m.unemployed;
  delete m.pendingSack;
  delete m.strikes;
  pushMessage(next, { kind: 'newJob', teamId: team.id, team: team.name, division: divisionOf(next, team.id), from: old.name });
  if (!seasonOver(next, cfg)) pushMessage(next, { kind: 'boardObjective', objective: next.board.objective, division: divisionOf(next, team.id) });
  return next;
}

export type JobError = 'notFound' | 'expired';

/** Accepts a job offer: the manager moves to that stable. */
export function acceptJob(state: GameState, offerId: string, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: { kind: 'hired'; teamId: string } | { kind: 'error'; error: JobError } } {
  const offer = state.manager?.offers.find((x) => x.id === offerId);
  if (!offer) return { state, outcome: { kind: 'error', error: 'notFound' } };
  if (offer.reason !== 'rescue' && (offer.season !== state.season || state.matchday > offer.until)) return { state, outcome: { kind: 'error', error: 'expired' } };
  return { state: takeOver(state, offer.teamId, cfg), outcome: { kind: 'hired', teamId: offer.teamId } };
}

/** Turns an offer down (a sacked manager cannot turn down the last one). */
export function declineJob(state: GameState, offerId: string): GameState {
  const m = state.manager;
  if (!m?.offers.some((x) => x.id === offerId)) return state;
  if (m.unemployed && m.offers.length <= 1) return state;
  const next: GameState = structuredClone(state);
  next.manager!.offers = next.manager!.offers.filter((x) => x.id !== offerId);
  return next;
}
