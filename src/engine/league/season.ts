/**
 * Season flow (pure): create a world, play a matchday, move to the next season.
 * Every function returns a NEW GameState; nothing reads the clock or Math.random.
 */
import type { Lang } from '../../core/i18n.ts';
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { simulateMatch } from '../combat/simulate.ts';
import type { MatchResult, MatchSetup, Side } from '../combat/types.ts';
import { isInjured } from '../creature/derived.ts';
import { generateTeamName } from '../creature/names.ts';
import type { Team } from '../model.ts';
import { buildReport } from '../report/report.ts';
import { autoTactic, generateTeam, repairTactic, validateTactic } from '../team/team.ts';
import { matchdayCount, roundRobin } from './schedule.ts';
import { computeStandings } from './standings.ts';
import { seasonPrizes, trimLedgers, weeklyFinances } from '../economy/finance.ts';
import { contractsTurnover, contractWarning, ensureSquads, fillFreeAgents, weeklyMarket, weeklyScouting } from '../economy/market.ts';
import { initEconomy } from '../economy/setup.ts';
import type { QualityId } from '../../data/config/index.ts';
import { pushMessage } from './messages.ts';
import type { Fixture, FixtureResult, GameState } from './types.ts';

export interface NewGameOptions {
  seed: string;
  teamName: string;
  lang: Lang;
}


export function newGame(opts: NewGameOptions, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const lc = cfg.league;
  const world = new Rng(deriveSeed(opts.seed, 'world'));
  const size = lc.squadSize;
  const player = generateTeam(world.fork('player'), { name: opts.teamName.trim() || undefined, quality: lc.playerQuality, size, lang: opts.lang }, cfg);
  const names = new Set([player.name]);
  const ai: Team[] = [];
  const qualities: Record<string, QualityId> = { [player.id]: lc.playerQuality };
  lc.aiQualities.slice(0, lc.teams - 1).forEach((quality, i) => {
    const rng = world.fork(`ai${i}`);
    const team = generateTeam(rng, { quality, size, lang: opts.lang }, cfg);
    // Unique stable names.
    for (let k = 0; names.has(team.name) && k < 50; k++) team.name = generateTeamName(rng, opts.lang);
    names.add(team.name);
    qualities[team.id] = quality;
    ai.push(team);
  });
  const teams = [player, ...ai];
  const fixtures = roundRobin(new Rng(deriveSeed(opts.seed, 'schedule', 1)), teams.map((t) => t.id), lc.legs, 1);
  const state: GameState = {
    version: 2,
    worldSeed: opts.seed,
    lang: opts.lang,
    season: 1,
    matchday: 1,
    teams,
    playerTeamId: player.id,
    fixtures,
    inbox: [],
    lastMatch: null,
    nextMessageId: 1,
    clubs: {},
    freeAgents: [],
    scouting: { knowledge: {}, missions: [] },
    offers: [],
    bids: {},
    forSale: [],
    nextId: 1,
  };
  initEconomy(state, qualities, cfg);
  pushMessage(state, { kind: 'welcome', teamName: player.name, teams: teams.length, matchdays: matchdayCount(fixtures) });
  return state;
}

// ——— Queries ———

export const lastMatchday = (state: GameState) => matchdayCount(state.fixtures);
export const seasonOver = (state: GameState) => state.matchday > lastMatchday(state);
export const playerTeam = (state: GameState) => teamById(state, state.playerTeamId);

export function teamById(state: GameState, id: string): Team {
  const t = state.teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

export function playerFixture(state: GameState, matchday = state.matchday): Fixture | undefined {
  return state.fixtures.find((f) => f.matchday === matchday && (f.home === state.playerTeamId || f.away === state.playerTeamId));
}

export function standings(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  return computeStandings(state.teams.map((t) => t.id), state.fixtures, cfg);
}

// ——— Match preparation ———

/** AI manager: rests tired creatures when it can, then picks the best available lineup. */
export function aiPrepare(team: Team, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const needed = cfg.match.starters + cfg.match.benchSize;
  const fresh = team.creatures.filter((c) => !isInjured(c) && c.condition.fatigue <= cfg.league.ai.restFatigue);
  const pool = fresh.length >= needed ? fresh : team.creatures;
  return { ...team, tactic: autoTactic(pool, cfg, team.tactic.orders) };
}

/** Player's tactic as it will be used: the assistant repairs it if it is not valid for a league match. */
export function playerPrepare(team: Team, cfg: GameConfig = DEFAULT_CONFIG): Team {
  return validateTactic(team, cfg, true).length ? repairTactic(team, cfg) : team;
}

export function fixtureSeed(state: GameState, fixture: Fixture): number {
  return deriveSeed(state.worldSeed, 'match', fixture.id);
}

/** Match setup for a fixture. When the player is involved, their team is side 0 (`swapped` if they play away). */
export function fixtureSetup(state: GameState, fixture: Fixture, cfg: GameConfig = DEFAULT_CONFIG): { setup: MatchSetup; swapped: boolean } {
  const prep = (id: string) => (id === state.playerTeamId ? playerPrepare(teamById(state, id), cfg) : aiPrepare(teamById(state, id), cfg));
  const home = prep(fixture.home);
  const away = prep(fixture.away);
  const swapped = fixture.away === state.playerTeamId;
  return { setup: { seed: fixtureSeed(state, fixture), teams: swapped ? [away, home] : [home, away] }, swapped };
}

function toFixtureResult(result: MatchResult, swapped: boolean): FixtureResult {
  const kos: [number, number] = [0, 0];
  for (const e of result.events) {
    if (e.type !== 'ko') continue;
    const victim = result.roster[e.target];
    if (victim) kos[victim.side === 0 ? 1 : 0]++;
  }
  const o = result.outcome;
  const flip = <T>(p: [T, T]): [T, T] => (swapped ? [p[1], p[0]] : p);
  return {
    winner: (swapped ? (o.winner === 0 ? 1 : 0) : o.winner) as Side,
    method: o.method,
    rounds: o.rounds,
    score: flip(o.score),
    kos: flip(kos),
    seed: result.seed,
  };
}

// ——— Matchday ———

interface MatchEffects {
  injuries: { creatureId: string; injuryId: string; weeks: number }[];
}

/** Applies fatigue, injuries, morale and form from a match to one side's team (mutates `team`). */
function applyMatchEffects(team: Team, result: MatchResult, side: Side, cfg: GameConfig): MatchEffects {
  const lc = cfg.league.afterMatch;
  const report = buildReport(result, side, cfg);
  const ratings = new Map(report.creatures.map((c) => [c.id, c]));
  const o = result.outcome;
  const won = o.winner === side;
  const moraleDelta = won ? (o.method === 'ko' ? lc.morale.koWin : lc.morale.pointsWin) : o.method === 'ko' ? lc.morale.koLoss : lc.morale.pointsLoss;
  const effects: MatchEffects = { injuries: [] };
  for (const pm of result.postMatch) {
    if (result.roster[pm.creatureId]?.side !== side) continue;
    const c = team.creatures.find((x) => x.id === pm.creatureId);
    if (!c) continue;
    const cond = c.condition;
    cond.fatigue = clamp(Math.round(cond.fatigue + pm.fatigueGained), 0, 100);
    for (const inj of pm.injuries) {
      cond.injuries.push({ injuryId: inj.injuryId, weeksLeft: inj.weeks });
      effects.injuries.push({ creatureId: c.id, ...inj });
    }
    if (!pm.played) continue;
    const st = ratings.get(c.id);
    let morale = cond.morale + moraleDelta;
    if (report.mvp === c.id) morale += lc.mvpMorale;
    cond.morale = clamp(Math.round(morale), 0, 100);
    if (st?.played) cond.form = clamp(Math.round(cond.form + (st.rating - 6) * lc.formPerRatingPoint), 1, 20);
  }
  return effects;
}

/** One week passes for a team: injuries heal, fatigue recovers, morale and form drift to normal (mutates). */
function weeklyRecovery(team: Team): string[] {
  const healed: string[] = [];
  for (const c of team.creatures) {
    const cond = c.condition;
    const wasInjured = cond.injuries.length > 0;
    cond.injuries = cond.injuries.map((i) => ({ ...i, weeksLeft: i.weeksLeft - 1 })).filter((i) => i.weeksLeft > 0);
    if (wasInjured && cond.injuries.length === 0) healed.push(c.id);
  }
  return healed;
}

function weeklyRest(team: Team, cfg: GameConfig) {
  const w = cfg.league.week;
  for (const c of team.creatures) {
    const cond = c.condition;
    cond.fatigue = clamp(Math.round(cond.fatigue - (w.fatigueRecovery + c.attributes.recovery * w.fatigueRecoveryPerAttr)), 0, 100);
    cond.morale = clamp(Math.round(cond.morale + (w.moraleBaseline - cond.morale) * w.moraleDrift), 0, 100);
    cond.form = clamp(Math.round(cond.form + (10 - cond.form) * w.formDrift), 1, 20);
  }
}

/**
 * Plays every fixture of the current matchday. `playerMatch` is the player's match when it was
 * played live (player = side 0); otherwise it is simulated with the assistant handling the breaks.
 *
 * Order within the week: existing injuries tick down → match effects (fatigue, new injuries,
 * morale, form) → a week of rest. So a 1-week injury makes a creature miss exactly one matchday.
 */
export function playMatchday(state: GameState, playerMatch: MatchResult | null = null, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  if (seasonOver(state)) return state;
  const next: GameState = structuredClone(state);
  const fixtures = next.fixtures.filter((f) => f.matchday === next.matchday && !f.result);
  const played: { fixture: Fixture; result: MatchResult; swapped: boolean }[] = [];
  for (const f of fixtures) {
    const { setup, swapped } = fixtureSetup(next, f, cfg);
    const isPlayer = f.home === next.playerTeamId || f.away === next.playerTeamId;
    const result = isPlayer && playerMatch ? playerMatch : simulateMatch(setup, { cfg });
    played.push({ fixture: f, result, swapped });
  }

  // 1. Existing injuries heal.
  for (const team of next.teams) {
    const healed = weeklyRecovery(team);
    if (team.id === next.playerTeamId) {
      for (const id of healed) pushMessage(next, { kind: 'recovered', creatureId: id, name: team.creatures.find((c) => c.id === id)!.name });
    }
  }

  // 2. Results & match effects.
  for (const { fixture, result, swapped } of played) {
    fixture.result = toFixtureResult(result, swapped);
    // Side of each team inside `result`.
    const sideOf = (teamId: string): Side => (result.teams[0].id === teamId ? 0 : 1);
    for (const teamId of [fixture.home, fixture.away]) {
      const team = next.teams.find((t) => t.id === teamId)!;
      const side = sideOf(teamId);
      const fx = applyMatchEffects(team, result, side, cfg);
      // AI stables keep their lineup fresh for next week.
      if (teamId !== next.playerTeamId) team.tactic = aiPrepare(team, cfg).tactic;
      if (teamId === next.playerTeamId) {
        const opp = result.teams[side === 0 ? 1 : 0];
        const o = result.outcome;
        pushMessage(next, {
          kind: 'matchResult',
          opponent: opp.name,
          won: o.winner === side,
          method: o.method,
          score: [o.score[side], o.score[side === 0 ? 1 : 0]],
          rounds: o.rounds,
          fixtureId: fixture.id,
        });
        for (const inj of fx.injuries) {
          pushMessage(next, { kind: 'injury', creatureId: inj.creatureId, name: team.creatures.find((c) => c.id === inj.creatureId)!.name, injuryId: inj.injuryId, weeks: inj.weeks });
        }
        next.lastMatch = { fixtureId: fixture.id, result };
      }
    }
  }

  // 3. A week of rest.
  for (const team of next.teams) weeklyRest(team, cfg);
  const tired = playerTeam(next).creatures.filter((c) => c.condition.fatigue >= 50 && !isInjured(c));
  if (tired.length) pushMessage(next, { kind: 'tired', names: tired.map((c) => c.name) });

  // 4. Money, scouts and the transfer market.
  weeklyFinances(next, played.map((p) => p.fixture), cfg);
  const seen: string[] = [];
  for (const { result, fixture } of played) {
    if (fixture.home !== next.playerTeamId && fixture.away !== next.playerTeamId) continue;
    const mySide = result.teams[0].id === next.playerTeamId ? 0 : 1;
    for (const pm of result.postMatch) if (pm.played && result.roster[pm.creatureId]?.side !== mySide) seen.push(pm.creatureId);
  }
  weeklyScouting(next, seen, cfg);
  weeklyMarket(next, cfg);
  contractWarning(next, cfg);

  next.matchday++;
  if (seasonOver(next)) {
    seasonPrizes(next, cfg);
    const table = standings(next, cfg);
    const pos = table.findIndex((r) => r.teamId === next.playerTeamId) + 1;
    pushMessage(next, { kind: 'seasonEnd', position: pos, champion: teamById(next, table[0]!.teamId).name, points: table[pos - 1]!.points });
  }
  return next;
}

/** New calendar for the next season (ageing, contracts and youth arrive in later phases). */
export function startNextSeason(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const next: GameState = structuredClone(state);
  next.season++;
  next.matchday = 1;
  next.fixtures = roundRobin(new Rng(deriveSeed(next.worldSeed, 'schedule', next.season)), next.teams.map((t) => t.id), cfg.league.legs, next.season);
  next.lastMatch = null;
  const rng = new Rng(deriveSeed(next.worldSeed, 'offseason', next.season));
  contractsTurnover(next, rng, cfg);
  fillFreeAgents(next, rng, cfg);
  ensureSquads(next, rng, cfg);
  trimLedgers(next);
  next.offers = [];
  next.bids = {};
  for (const team of next.teams) {
    for (const c of team.creatures) c.condition.fatigue = 0;
    if (team.id !== next.playerTeamId) team.tactic = aiPrepare(team, cfg).tactic;
  }
  pushMessage(next, { kind: 'newSeason' });
  return next;
}
