/**
 * The player's market decisions. Each action takes a GameState and returns a new one plus an outcome
 * the UI can word; invalid actions return the state unchanged with an error code.
 */
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { pushMessage } from '../league/messages.ts';
import type { GameState } from '../league/types.ts';
import { clubOf, spend } from './finance.ts';
import { askingPrice, canAdd, canLose, isPlayerTeam, locate, remainingWeeks, renewalDemand, signingBonus, transfer } from './market.ts';
import { askingWage, roundTo } from './value.ts';

export type MarketError = 'notFound' | 'notAvailable' | 'squadFull' | 'squadMin' | 'noMoney' | 'closed' | 'busy' | 'refused';

export type BidOutcome =
  | { kind: 'accepted'; fee: number; wage: number }
  | { kind: 'counter'; fee: number }
  | { kind: 'rejected' }
  | { kind: 'error'; error: MarketError };

export interface Result<O> {
  state: GameState;
  outcome: O;
}

const playerTeamOf = (s: GameState) => s.teams.find((t) => t.id === s.playerTeamId)!;
const err = <O>(state: GameState, error: MarketError) => ({ state, outcome: { kind: 'error', error } as O });

/** Bid for a creature of an AI stable. The other stable accepts, counters or rejects (deterministic). */
export function bid(state: GameState, creatureId: string, fee: number, years: number, cfg: GameConfig = DEFAULT_CONFIG): Result<BidOutcome> {
  const t = cfg.economy.transfers;
  const loc = locate(state, creatureId);
  if (!loc) return err(state, 'notFound');
  if (!loc.team || isPlayerTeam(state, loc.team)) return err(state, 'notAvailable');
  if (!canAdd(playerTeamOf(state), cfg)) return err(state, 'squadFull');
  if (!canLose(loc.team, cfg)) return err(state, 'squadMin');
  if (clubOf(state, state.playerTeamId).balance < fee) return err(state, 'noMoney');

  const next = structuredClone(state);
  const mem = next.bids[creatureId];
  const fresh = !mem || mem.season !== next.season || mem.matchday !== next.matchday;
  const count = fresh ? 0 : mem.count;
  if (count >= t.maxBidsPerWeek) return err(state, 'closed');

  const seller = next.teams.find((x) => x.id === loc.team!.id)!;
  const c = seller.creatures.find((x) => x.id === creatureId)!;
  const asking = askingPrice(seller, c, cfg);
  const rng = new Rng(deriveSeed(next.worldSeed, 'bid', next.season, next.matchday, creatureId, count));
  const threshold = asking * (1 + rng.range(-t.acceptJitter, t.acceptJitter));
  const counterKnown = !fresh && mem.counter !== undefined ? mem.counter : Infinity;
  next.bids[creatureId] = { season: next.season, matchday: next.matchday, count: count + 1, counter: fresh ? undefined : mem.counter };

  if (fee >= threshold || fee >= counterKnown) {
    const wage = askingWage(c, clubOf(next, next.playerTeamId).reputation, years, cfg);
    const move = transfer(next, creatureId, next.playerTeamId, fee, { wage, years }, cfg);
    delete next.bids[creatureId];
    if (move) pushMessage(next, { kind: 'transferIn', creatureId, name: c.name, fromTeam: seller.name, fee, wage });
    return { state: next, outcome: { kind: 'accepted', fee, wage } };
  }
  if (fee >= asking * t.counterFrom) {
    const counter = roundTo(Math.max(fee * 1.05, threshold * rng.range(1, 1.05)), cfg.economy.value.round);
    next.bids[creatureId]!.counter = counter;
    return { state: next, outcome: { kind: 'counter', fee: counter } };
  }
  return { state: next, outcome: { kind: 'rejected' } };
}

export type SignOutcome = { kind: 'signed'; fee: number; wage: number } | { kind: 'error'; error: MarketError };

/** Signs a free agent: one-off bonus + asked wage. Very ambitious creatures snub small clubs. */
export function signFreeAgent(state: GameState, creatureId: string, years: number, cfg: GameConfig = DEFAULT_CONFIG): Result<SignOutcome> {
  const loc = locate(state, creatureId);
  if (!loc) return err(state, 'notFound');
  if (loc.team) return err(state, 'notAvailable');
  const c = loc.creature;
  const club = clubOf(state, state.playerTeamId);
  if (!canAdd(playerTeamOf(state), cfg)) return err(state, 'squadFull');
  const fee = signingBonus(c, cfg);
  if (club.balance < fee) return err(state, 'noMoney');
  if (c.hidden.ambition >= 16 && club.reputation < 35) return err(state, 'refused');
  const next = structuredClone(state);
  const wage = askingWage(c, club.reputation, years, cfg);
  spend(next, next.playerTeamId, 'purchases', fee);
  transfer(next, creatureId, next.playerTeamId, 0, { wage, years }, cfg);
  pushMessage(next, { kind: 'transferIn', creatureId, name: c.name, fromTeam: null, fee, wage });
  return { state: next, outcome: { kind: 'signed', fee, wage } };
}

export type OfferOutcome = { kind: 'sold'; fee: number } | { kind: 'declined' } | { kind: 'error'; error: MarketError };

/** Accepts or declines an AI stable's offer for one of the player's creatures. */
export function answerOffer(state: GameState, offerId: string, accept: boolean, cfg: GameConfig = DEFAULT_CONFIG): Result<OfferOutcome> {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return err(state, 'notFound');
  const next = structuredClone(state);
  if (!accept) {
    next.offers = next.offers.filter((o) => o.id !== offerId);
    return { state: next, outcome: { kind: 'declined' } };
  }
  if (!canLose(playerTeamOf(next), cfg)) return err(state, 'squadMin');
  const buyer = next.teams.find((t) => t.id === offer.fromTeamId);
  const c = locate(next, offer.creatureId)?.creature;
  if (!buyer || !c || !canAdd(buyer, cfg)) return err(state, 'notAvailable');
  transfer(next, c.id, buyer.id, offer.fee, { wage: askingWage(c, clubOf(next, buyer.id).reputation, 2, cfg), years: 2 }, cfg);
  pushMessage(next, { kind: 'transferOut', name: c.name, toTeam: buyer.name, fee: offer.fee });
  return { state: next, outcome: { kind: 'sold', fee: offer.fee } };
}

export function toggleForSale(state: GameState, creatureId: string): GameState {
  const next = structuredClone(state);
  next.forSale = next.forSale.includes(creatureId) ? next.forSale.filter((id) => id !== creatureId) : [...next.forSale, creatureId];
  return next;
}

/** Cost of releasing a creature now: part of its remaining wages. */
export function releaseCost(state: GameState, creatureId: string, cfg: GameConfig = DEFAULT_CONFIG): number {
  const c = locate(state, creatureId)?.creature;
  if (!c?.contract) return 0;
  return roundTo(c.contract.wage * remainingWeeks(state, c) * cfg.economy.transfers.releaseCompensation, 10);
}

export type ReleaseOutcome = { kind: 'released'; cost: number } | { kind: 'error'; error: MarketError };

export function release(state: GameState, creatureId: string, cfg: GameConfig = DEFAULT_CONFIG): Result<ReleaseOutcome> {
  const loc = locate(state, creatureId);
  if (!loc || !isPlayerTeam(state, loc.team)) return err(state, 'notFound');
  if (!canLose(loc.team!, cfg)) return err(state, 'squadMin');
  const cost = releaseCost(state, creatureId, cfg);
  const next = structuredClone(state);
  spend(next, next.playerTeamId, 'compensation', cost);
  transfer(next, creatureId, null, 0, null, cfg);
  pushMessage(next, { kind: 'transferOut', name: loc.creature.name, toTeam: null, fee: 0 });
  return { state: next, outcome: { kind: 'released', cost } };
}

export type RenewOutcome = { kind: 'renewed'; wage: number; untilSeason: number } | { kind: 'error'; error: MarketError };

/** Extends a contract at the creature's demand. Unhappy creatures refuse to talk. */
export function renew(state: GameState, creatureId: string, years: number, cfg: GameConfig = DEFAULT_CONFIG): Result<RenewOutcome> {
  const loc = locate(state, creatureId);
  if (!loc || !isPlayerTeam(state, loc.team)) return err(state, 'notFound');
  if (loc.creature.condition.morale < 25) return err(state, 'refused');
  const y = clamp(years, cfg.economy.wage.minYears, cfg.economy.wage.maxYears);
  const wage = renewalDemand(state, loc.creature, y, cfg);
  const next = structuredClone(state);
  const c = locate(next, creatureId)!.creature;
  // A renewal made during the season covers the following seasons.
  const from = (c.contract?.untilSeason ?? next.season) >= next.season ? next.season + 1 : next.season;
  c.contract = { wage, untilSeason: from + y - 1 };
  return { state: next, outcome: { kind: 'renewed', wage, untilSeason: c.contract.untilSeason } };
}

export type ScoutOutcome = { kind: 'sent'; weeks: number } | { kind: 'error'; error: MarketError };

export function sendScout(state: GameState, target: 'creature' | 'team', targetId: string, cfg: GameConfig = DEFAULT_CONFIG): Result<ScoutOutcome> {
  const s = cfg.economy.scouting;
  if (state.scouting.missions.length >= s.scouts) return err(state, 'busy');
  if (state.scouting.missions.some((m) => m.targetId === targetId)) return err(state, 'busy');
  const next = structuredClone(state);
  const weeks = target === 'creature' ? s.creatureWeeks : s.teamWeeks;
  next.scouting.missions.push({ id: `sc${next.nextId++}`, target, targetId, weeksLeft: weeks });
  return { state: next, outcome: { kind: 'sent', weeks } };
}

export function recallScout(state: GameState, missionId: string): GameState {
  const next = structuredClone(state);
  next.scouting.missions = next.scouting.missions.filter((m) => m.id !== missionId);
  return next;
}
