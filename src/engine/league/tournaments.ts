/**
 * Knockout tournaments besides the Shadow Cup: a pre-season friendly, a cup per division, the Champions Cup (best four
 * of the top division) and invitationals (minimum reputation + entry fee). Each round is played in a midweek given by
 * its key (`cfg.league.tournaments`); rounds sharing a key are played the same week. Pure, mutating helpers.
 */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { teamStrength } from '../club/board.ts';
import { clubOf, earn, spend, ticketRevenue } from '../economy/finance.ts';
import type { Team } from '../model.ts';
import { divisionOf } from './divisions.ts';
import { pushMessage } from './messages.ts';
import { awardTrophy } from '../team/record.ts';
import { addNews } from './news.ts';
import type { Fixture, GameState, Tournament } from './types.ts';

export type OpenId = keyof GameConfig['league']['tournaments']['open'];
export const OPEN_IDS = ['marches', 'argent', 'or'] as const satisfies readonly OpenId[];

interface Def {
  keys: readonly number[];
  prize: readonly number[];
  size?: number;
  fee?: number;
  minRep?: number;
  scaled?: boolean;
}

export function tournamentDef(t: Pick<Tournament, 'kind' | 'def'>, cfg: GameConfig = DEFAULT_CONFIG): Def {
  const c = cfg.league.tournaments;
  if (t.kind === 'open') return c.open[t.def as OpenId];
  return c[t.kind];
}

const team = (state: GameState, id: string): Team => state.teams.find((t) => t.id === id)!;
const involves = (f: Fixture, id: string) => f.home === id || f.away === id;

/** Prize for winning round `round` of a tournament. */
export function tournamentPrize(_state: GameState, t: Tournament, round: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const def = tournamentDef(t, cfg);
  // Prizes are listed up to the final (the last one is the trophy); extra early rounds get the first prize.
  const amount = def.prize[Math.max(0, def.prize.length - (t.rounds - round))] ?? 0;
  const scale = def.scaled ? (cfg.league.divisionMoney[t.division ?? 0] ?? 1) : 1;
  return Math.round((amount * scale) / 50) * 50;
}

/** Number of rounds for n entrants: a preliminary round when n is not a power of two. */
function roundsFor(n: number): number {
  if (n < 2) return 0;
  const p = 2 ** Math.floor(Math.log2(n));
  return (n > p ? 1 : 0) + Math.log2(p);
}

/** Seeding: higher division first, then stronger. */
function ranked(state: GameState, ids: string[]): string[] {
  return [...ids].sort((a, b) => divisionOf(state, a) - divisionOf(state, b) || teamStrength(team(state, b)) - teamStrength(team(state, a)) || a.localeCompare(b));
}

/** Draws the fixtures of the tournament's current round. */
function drawRound(state: GameState, t: Tournament, cfg: GameConfig) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'tournament', t.id, state.season, t.round));
  let entrants = t.alive;
  if (t.round === 0) {
    const n = t.alive.length;
    const p = 2 ** Math.floor(Math.log2(n));
    if (n > p) entrants = ranked(state, t.alive).slice(n - 2 * (n - p));
  }
  const drawn = rng.shuffle([...entrants]);
  const key = t.keys[t.round] ?? 0;
  for (let i = 0; i + 1 < drawn.length; i += 2) {
    const f: Fixture = { id: `s${state.season}-${t.id}-${t.round}-${i / 2}`, matchday: Math.floor(key), home: drawn[i]!, away: drawn[i + 1]!, competition: 'tournament', tournamentId: t.id, round: t.round };
    state.fixtures.push(f);
    if (involves(f, state.playerTeamId)) {
      const home = f.home === state.playerTeamId;
      pushMessage(state, { kind: 'cupDraw', round: t.round, opponent: team(state, home ? f.away : f.home).name, home, tournament: t.id, rounds: t.rounds });
    }
  }
  void cfg;
}

function create(state: GameState, base: Omit<Tournament, 'round' | 'rounds' | 'alive'>, cfg: GameConfig): Tournament | null {
  const def = tournamentDef(base, cfg);
  const rounds = roundsFor(base.entrants.length);
  if (rounds === 0) return null;
  const t: Tournament = { ...base, keys: def.keys.slice(-rounds), round: 0, rounds, alive: [...base.entrants] };
  state.tournaments.push(t);
  drawRound(state, t, cfg);
  return t;
}

/** Stables of the open tournament: reputation at least the minimum, closest to a bit above it. */
function openEntrants(state: GameState, def: Def, exclude: string): string[] {
  const min = def.minRep ?? 0;
  const target = min + 15;
  return state.teams
    .filter((x) => x.id !== exclude && clubOf(state, x.id).reputation >= min)
    .sort((a, b) => Math.abs(clubOf(state, a.id).reputation - target) - Math.abs(clubOf(state, b.id).reputation - target) || a.id.localeCompare(b.id))
    .slice(0, def.size ?? 4)
    .map((x) => x.id);
}

/**
 * The season's tournaments (mutates): `championsEntrants` = the best four of the top division last season
 * (or the strongest ones in a new game).
 */
export function startTournaments(state: GameState, championsEntrants: string[], cfg: GameConfig = DEFAULT_CONFIG) {
  state.tournaments = [];
  const me = state.playerTeamId;
  const myDiv = divisionOf(state, me);
  const c = cfg.league.tournaments;
  // Pre-season: the player and the three stables of its division closest in strength.
  const mine = teamStrength(team(state, me));
  const near = state.divisions[myDiv]!
    .filter((id) => id !== me)
    .sort((a, b) => Math.abs(teamStrength(team(state, a)) - mine) - Math.abs(teamStrength(team(state, b)) - mine) || a.localeCompare(b))
    .slice(0, c.preseason.size - 1);
  create(state, { id: 'preseason', kind: 'preseason', def: 'preseason', division: myDiv, keys: [], entrants: [me, ...near] }, cfg);
  state.divisions.forEach((ids, d) => create(state, { id: `division-${d}`, kind: 'division', def: 'division', division: d, keys: [], entrants: [...ids] }, cfg));
  const champs = create(state, { id: 'champions', kind: 'champions', def: 'champions', division: 0, keys: [], entrants: championsEntrants.slice(0, c.champions.size) }, cfg);
  if (champs?.entrants.includes(me)) pushMessage(state, { kind: 'championsQualified' });
  const rep = clubOf(state, me).reputation;
  for (const id of OPEN_IDS) {
    const def = c.open[id];
    const t = create(state, { id, kind: 'open', def: id, keys: [], entrants: openEntrants(state, def, me) }, cfg);
    if (t && rep >= def.minRep) pushMessage(state, { kind: 'tournamentInvite', tournament: id, fee: def.fee });
  }
}

/** The best four of the top division, by its final table (or by strength before any match). */
export function championsFrom(state: GameState, table?: { teamId: string }[]): string[] {
  if (table?.length) return table.slice(0, 4).map((r) => r.teamId);
  return ranked(state, state.divisions[0] ?? []).slice(0, 4);
}

// ——— Calendar ———

/** Key of the Shadow Cup's next round, if any. */
export function cupKey(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): number | null {
  const c = state.cup;
  return c.round < c.rounds ? (cfg.league.cup.after[c.round] ?? null) : null;
}

const nextKey = (t: Tournament) => (t.round < t.rounds ? (t.keys[t.round] ?? null) : null);

/** Earliest midweek due before the next league matchday (cup and tournament rounds), or null. */
export function midweekKey(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): number | null {
  const keys = [cupKey(state, cfg), ...(state.tournaments ?? []).map(nextKey)].filter((k): k is number => k !== null && state.matchday > k);
  return keys.length ? Math.min(...keys) : null;
}

/** Tournaments whose current round is played at this key. */
export const tournamentsAt = (state: GameState, key: number) => (state.tournaments ?? []).filter((t) => nextKey(t) === key);

/** The player's next match in a tournament, if any (when its round comes, or later). */
export function tournamentFixture(state: GameState, t: Tournament): Fixture | undefined {
  return state.fixtures.find((f) => f.tournamentId === t.id && f.round === t.round && !f.result && involves(f, state.playerTeamId));
}

// ——— Playing ———

/** After a round's fixtures were played: prizes, tickets, eliminations, then the next draw or the winner (mutates). */
export function finishTournamentRound(state: GameState, t: Tournament, played: Fixture[], cfg: GameConfig = DEFAULT_CONFIG) {
  const prize = tournamentPrize(state, t, t.round, cfg);
  for (const f of played) {
    const r = f.result!;
    const winner = r.winner === 0 ? f.home : f.away;
    const loser = r.winner === 0 ? f.away : f.home;
    earn(state, f.home, 'tickets', Math.round(ticketRevenue(state, f.home, f.away, cfg) * 0.5));
    earn(state, winner, 'prizes', prize);
    t.alive = t.alive.filter((id) => id !== loser);
    if (loser === state.playerTeamId) pushMessage(state, { kind: 'cupOut', round: t.round, by: team(state, winner).name, tournament: t.id, rounds: t.rounds });
  }
  t.round++;
  if (t.round >= t.rounds) {
    const winner = t.alive[0];
    if (!winner) return;
    t.winner = winner;
    awardTrophy(state, winner, { def: t.def, tournament: t.id, division: t.division }, cfg);
    if (t.kind !== 'preseason') addNews(state, { kind: 'cupWinner', team: team(state, winner).name, tournament: t.id }, cfg);
    if (winner === state.playerTeamId) pushMessage(state, { kind: 'cupWon', prize, tournament: t.id });
  } else drawRound(state, t, cfg);
}

// ——— Registration (invitationals) ———

export type RegisterError = 'notOpen' | 'closed' | 'registered' | 'reputation' | 'money';

/** Can the player register for this tournament now? */
export function registrationState(state: GameState, t: Tournament, cfg: GameConfig = DEFAULT_CONFIG): 'ok' | RegisterError {
  if (t.kind !== 'open') return 'notOpen';
  if (t.registered || t.entrants.includes(state.playerTeamId)) return 'registered';
  const def = tournamentDef(t, cfg);
  if (t.round > 0 || state.matchday > (t.keys[0] ?? 0)) return 'closed';
  if (clubOf(state, state.playerTeamId).reputation < (def.minRep ?? 0)) return 'reputation';
  if (clubOf(state, state.playerTeamId).balance < (def.fee ?? 0)) return 'money';
  return 'ok';
}

/** Pays the fee and takes the place of the least famous entrant (in the draw too). */
export function registerTournament(state: GameState, id: string, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: { kind: 'registered'; fee: number } | { kind: 'error'; error: RegisterError } } {
  const t0 = state.tournaments.find((x) => x.id === id);
  if (!t0) return { state, outcome: { kind: 'error', error: 'notOpen' } };
  const why = registrationState(state, t0, cfg);
  if (why !== 'ok') return { state, outcome: { kind: 'error', error: why } };
  const next: GameState = structuredClone(state);
  const t = next.tournaments.find((x) => x.id === id)!;
  const me = next.playerTeamId;
  const out = [...t.entrants].sort((a, b) => clubOf(next, a).reputation - clubOf(next, b).reputation || a.localeCompare(b))[0]!;
  const swap = (ids: string[]) => ids.map((x) => (x === out ? me : x));
  t.entrants = swap(t.entrants);
  t.alive = swap(t.alive);
  t.registered = true;
  for (const f of next.fixtures) {
    if (f.tournamentId !== t.id || f.round !== 0) continue;
    if (f.home === out) f.home = me;
    if (f.away === out) f.away = me;
    if (involves(f, me)) pushMessage(next, { kind: 'cupDraw', round: 0, opponent: team(next, f.home === me ? f.away : f.home).name, home: f.home === me, tournament: t.id, rounds: t.rounds });
  }
  const fee = tournamentDef(t, cfg).fee ?? 0;
  spend(next, me, 'fees', fee);
  return { state: next, outcome: { kind: 'registered', fee } };
}
