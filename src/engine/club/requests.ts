/**
 * Requests of the player's stars: a star left on the bench asks to play, an underpaid one asks for a raise, an
 * ambitious one courted by a bigger stable asks to leave. A few per season, one open at a time; the player answers
 * from the Journal (2–3 choices with known consequences); a promise not kept costs morale (its friends' too).
 * Pure: functions mutate the state they are given (`answerRequest` clones first). Own RNG stream.
 */
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { isInjured } from '../creature/derived.ts';
import { clubOf } from '../economy/finance.ts';
import { canAdd, canLose, transfer } from '../economy/market.ts';
import { askingWage, creatureValue, roundTo } from '../economy/value.ts';
import { divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import type { CreatureRequest, GameState, RequestChoice, RequestKind } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';

const playerTeamOf = (state: GameState) => state.teams.find((t) => t.id === state.playerTeamId)!;

/** The player's stars: its best creatures by aptitude. */
export function starsOf(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): Creature[] {
  return [...playerTeamOf(state).creatures].sort((a, b) => b.ability - a.ability || a.id.localeCompare(b.id)).slice(0, cfg.club.requests.stars);
}

/** Choices offered for a kind of request. */
export const REQUEST_CHOICES: Record<RequestKind, RequestChoice[]> = {
  playtime: ['promise', 'refuse', 'list'],
  raise: ['accept', 'compromise', 'refuse'],
  leave: ['raise', 'sell', 'refuse'],
};

function morale(c: Creature, d: number) {
  c.condition.morale = clamp(Math.round(c.condition.morale + d), 0, 100);
}

/** Friends of a creature in its stable lose morale too; returns their names. */
function friendsSuffer(team: Team, c: Creature, d: number, cfg: GameConfig): string[] {
  if (!d) return [];
  const friends = team.creatures.filter((x) => x.id !== c.id && (x.relations[c.id] ?? 0) >= cfg.club.relations.friend);
  for (const f of friends) morale(f, d);
  return friends.map((f) => f.name);
}

/** After each match of the player: remember who started and who was fit; count starts for promises. */
export function recordLineup(state: GameState, starters: string[], cfg: GameConfig = DEFAULT_CONFIG) {
  const team = playerTeamOf(state);
  const available = team.creatures.filter((c) => !isInjured(c)).map((c) => c.id);
  state.lineups = [...(state.lineups ?? []), { starters, available }].slice(-cfg.club.requests.lineups);
  const p = cfg.club.requests.playtime;
  for (const r of state.requests ?? []) {
    if (r.status !== 'promised' || r.kind !== 'playtime') continue;
    const c = team.creatures.find((x) => x.id === r.creatureId);
    if (!c) {
      r.status = 'answered';
      continue;
    }
    // A match it could not play (injured) does not count against the promise.
    if (!starters.includes(c.id) && !available.includes(c.id)) continue;
    r.seen = (r.seen ?? 0) + 1;
    if (starters.includes(c.id)) r.starts = (r.starts ?? 0) + 1;
    if ((r.starts ?? 0) >= p.need) {
      r.status = 'kept';
      morale(c, p.kept);
      pushMessage(state, { kind: 'requestOutcome', request: 'playtime', creatureId: c.id, name: c.name, outcome: 'kept', friends: [] });
    } else if ((r.seen ?? 0) - (r.starts ?? 0) > p.of - p.need) {
      r.status = 'broken';
      morale(c, p.broken);
      const friends = friendsSuffer(team, c, p.friendsBroken, cfg);
      pushMessage(state, { kind: 'requestOutcome', request: 'playtime', creatureId: c.id, name: c.name, outcome: 'broken', friends });
    }
  }
}

/** Matches and average rating of a creature since the season started. */
function seasonSoFar(state: GameState, c: Creature): { m: number; avg: number } {
  const base = state.recordBase?.[c.id] ?? { m: 0, r: 0 };
  const m = (c.record?.matches ?? 0) - base.m;
  return { m, avg: m > 0 ? ((c.record?.ratingSum ?? 0) - base.r) / m / 10 : 0 };
}

/** Season change: who had a great season, then a fresh baseline for the new one. */
export function seasonRequests(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const q = cfg.club.requests.raise;
  const team = playerTeamOf(state);
  state.greatSeason = team.creatures
    .filter((c) => {
      const s = seasonSoFar(state, c);
      return s.m >= q.seasonMatches && s.avg >= q.seasonRating;
    })
    .map((c) => c.id);
  state.recordBase = Object.fromEntries(team.creatures.map((c) => [c.id, { m: c.record?.matches ?? 0, r: c.record?.ratingSum ?? 0 }]));
}

/** A bigger stable able to pay for this creature (higher division, or same division with a better reputation). */
function suitor(state: GameState, fee: number, cfg: GameConfig): Team | null {
  const me = divisionOf(state, state.playerTeamId);
  const rep = clubOf(state, state.playerTeamId).reputation;
  const candidates = state.teams.filter((t) => {
    if (t.id === state.playerTeamId || !canAdd(t, cfg)) return false;
    const d = divisionOf(state, t.id);
    const club = clubOf(state, t.id);
    return (d < me || (d === me && club.reputation > rep + 5)) && club.balance - cfg.economy.transfers.aiReserve >= fee;
  });
  return candidates.sort((a, b) => clubOf(state, b.id).reputation - clubOf(state, a.id).reputation || a.id.localeCompare(b.id))[0] ?? null;
}

/** What a star could ask for, if anything (deterministic given the state; the weekly roll decides who speaks). */
function reasonOf(state: GameState, c: Creature, cfg: GameConfig, rng: Rng): Omit<CreatureRequest, 'id' | 'season' | 'matchday' | 'until' | 'status'> | null {
  const q = cfg.club.requests;
  if (isInjured(c)) return null;
  // Playing time: fit in most of the last matches, started almost none.
  const recent = (state.lineups ?? []).slice(-q.playtime.window);
  if (recent.length >= q.playtime.window) {
    const fit = recent.filter((l) => l.available.includes(c.id)).length;
    const starts = recent.filter((l) => l.starters.includes(c.id)).length;
    if (fit >= q.playtime.minAvailable && starts <= q.playtime.maxStarts) return { kind: 'playtime', creatureId: c.id, name: c.name };
  }
  // Courted by a bigger stable.
  if (c.hidden.ambition >= q.leave.ambition && canLose(playerTeamOf(state), cfg)) {
    const fee = roundTo(creatureValue(c, cfg) * rng.range(q.leave.feeMin, q.leave.feeMax), cfg.economy.value.round);
    const team = suitor(state, fee, cfg);
    if (team) return { kind: 'leave', creatureId: c.id, name: c.name, fromTeamId: team.id, fee };
  }
  // A great season (or run), or underpaid for what it has become (contracts ending this season go through renewals).
  if (c.contract && c.contract.untilSeason > state.season) {
    const worth = askingWage(c, clubOf(state, state.playerTeamId).reputation, 1, cfg);
    const run = seasonSoFar(state, c);
    const great = (state.greatSeason ?? []).includes(c.id) || (run.m >= q.raise.runMatches && run.avg >= q.raise.runRating);
    if (great || c.contract.wage < worth * q.raise.below) {
      const asked = roundTo(Math.max(worth, c.contract.wage * q.raise.factor), 10);
      return { kind: 'raise', creatureId: c.id, name: c.name, wage: c.contract.wage, asked };
    }
  }
  return null;
}

/**
 * End of a league week: unanswered requests lapse (= refused), then maybe one star speaks up
 * (few per season, spaced out, one open at a time).
 */
export function weeklyRequests(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const q = cfg.club.requests;
  const list = (state.requests ??= []);
  for (const r of list) {
    if (r.status === 'open' && (r.season < state.season || state.matchday > r.until)) {
      applyChoice(state, r, 'refuse', cfg);
      r.status = 'expired';
      pushMessage(state, { kind: 'requestOutcome', request: r.kind, creatureId: r.creatureId, name: r.name, outcome: 'expired', friends: [] });
    }
  }
  const season = list.filter((r) => r.season === state.season);
  if (list.some((r) => r.status === 'open') || season.length >= q.maxPerSeason) return;
  const last = season.reduce((m, r) => Math.max(m, r.matchday), -Infinity);
  if (state.matchday - last < q.gapWeeks) return;
  const rng = new Rng(deriveSeed(state.worldSeed, 'requests', state.season, state.matchday));
  if (!rng.chance(q.chance)) return;
  // Each creature asks at most once a season.
  const asked = new Set(season.map((r) => r.creatureId));
  const reasons = starsOf(state, cfg)
    .filter((c) => !asked.has(c.id))
    .map((c) => reasonOf(state, c, cfg, rng))
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!reasons.length) return;
  const pick = rng.pick(reasons);
  const r: CreatureRequest = { ...pick, id: `rq${state.nextId++}`, season: state.season, matchday: state.matchday, until: state.matchday + q.answerWeeks, status: 'open' };
  list.push(r);
  const from = r.fromTeamId ? state.teams.find((t) => t.id === r.fromTeamId)?.name : undefined;
  pushMessage(state, { kind: 'request', requestId: r.id, request: r.kind, creatureId: r.creatureId, name: r.name, wage: r.wage, asked: r.asked, fee: r.fee, fromTeam: from });
}

export type RequestOutcome =
  | { kind: 'done'; choice: RequestChoice }
  | { kind: 'error'; error: 'notFound' | 'closed' | 'squadMin' | 'notAvailable' };

/** Applies a choice to a request (mutates). Returns an error code when it cannot be done. */
function applyChoice(state: GameState, r: CreatureRequest, choice: RequestChoice, cfg: GameConfig): 'done' | 'squadMin' | 'notAvailable' {
  const q = cfg.club.requests;
  const team = playerTeamOf(state);
  const c = team.creatures.find((x) => x.id === r.creatureId);
  if (!c) return 'notAvailable';
  r.choice = choice;
  r.status = 'answered';
  switch (r.kind) {
    case 'playtime':
      if (choice === 'promise') {
        r.status = 'promised';
        r.seen = 0;
        r.starts = 0;
      } else if (choice === 'list') {
        if (!state.forSale.includes(c.id)) state.forSale.push(c.id);
        morale(c, q.playtime.listed);
      } else morale(c, q.playtime.refused);
      break;
    case 'raise':
      if (choice === 'accept' && c.contract) {
        c.contract.wage = r.asked ?? c.contract.wage;
        morale(c, q.raise.accepted);
      } else if (choice === 'compromise' && c.contract) {
        c.contract.wage = roundTo(((r.wage ?? c.contract.wage) + (r.asked ?? c.contract.wage)) / 2, 10);
        morale(c, q.raise.compromise);
      } else {
        morale(c, q.raise.refused);
        friendsSuffer(team, c, q.raise.friendsRefused, cfg);
      }
      break;
    case 'leave': {
      if (choice === 'sell') {
        const buyer = state.teams.find((t) => t.id === r.fromTeamId);
        if (!canLose(team, cfg)) return 'squadMin';
        if (!buyer || !canAdd(buyer, cfg)) return 'notAvailable';
        const fee = r.fee ?? 0;
        transfer(state, c.id, buyer.id, fee, { wage: askingWage(c, clubOf(state, buyer.id).reputation, 2, cfg), years: 2 }, cfg);
        pushMessage(state, { kind: 'transferOut', name: c.name, toTeam: buyer.name, fee });
      } else if (choice === 'raise' && c.contract) {
        c.contract.wage = roundTo(c.contract.wage * q.leave.raiseMult, 10);
        morale(c, q.leave.kept);
      } else {
        morale(c, q.leave.refused);
        friendsSuffer(team, c, q.leave.friendsRefused, cfg);
      }
      break;
    }
  }
  return 'done';
}

/** The player answers a request from the Journal. */
export function answerRequest(state: GameState, requestId: string, choice: RequestChoice, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: RequestOutcome } {
  const r0 = state.requests?.find((r) => r.id === requestId);
  if (!r0) return { state, outcome: { kind: 'error', error: 'notFound' } };
  if (r0.status !== 'open' || !REQUEST_CHOICES[r0.kind].includes(choice)) return { state, outcome: { kind: 'error', error: 'closed' } };
  const next = structuredClone(state);
  const r = next.requests!.find((x) => x.id === requestId)!;
  const res = applyChoice(next, r, choice, cfg);
  if (res !== 'done') return { state, outcome: { kind: 'error', error: res } };
  return { state: next, outcome: { kind: 'done', choice } };
}

/** The open request or running promise of a creature, if any (sheet, squad). */
export function requestOf(state: GameState, creatureId: string): CreatureRequest | undefined {
  return state.requests?.find((r) => r.creatureId === creatureId && (r.status === 'open' || r.status === 'promised'));
}
