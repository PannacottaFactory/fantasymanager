/**
 * Season flow (pure): create a world, play a week (league matchday or cup round), move to the next season.
 * Every function returns a NEW GameState; nothing reads the clock or Math.random.
 */
import { checkAmbitions, recordSeason } from '../club/ambitions.ts';
import type { Lang } from '../../core/i18n.ts';
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { simulateMatch } from '../combat/simulate.ts';
import type { MatchResult, MatchSetup, Side } from '../combat/types.ts';
import { isInjured } from '../creature/derived.ts';
import { generateTeamName } from '../creature/names.ts';
import type { Team } from '../model.ts';
import { buildReport } from '../report/report.ts';
import { autoTactic, generateTeam, repairTactic, validateTactic } from '../team/team.ts';
import { applyIdentity, drawIdentities, styleShare } from '../team/identity.ts';
import { levelOf, matchXp } from '../progression/levels.ts';
import { INJURIES } from '../../data/injuries.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import { boardVerdict, newSeasonObjective, teamStrength, weeklyBoard } from '../club/board.ts';
import { injuryWeeksFactor, startingFacilities, weeklyFacilities } from '../club/facilities.ts';
import { seedRelations, weeklyRelations } from '../club/relations.ts';
import { earn, seasonPrizes, ticketRevenue, trimLedgers, weeklyFinances } from '../economy/finance.ts';
import { bury, contractsTurnover, contractWarning, ensureSquads, fillFreeAgents, weeklyMarket, weeklyScouting } from '../economy/market.ts';
import { initEconomy } from '../economy/setup.ts';
import { ageing, initTraining, refreshCoachMarket, releaseYouth, snapshotSeasonStart, trainingReport, weeklyTraining, youthIntake } from '../progression/training.ts';
import { divisionFixtures, divisionOf } from './divisions.ts';
import { pushMessage } from './messages.ts';
import { addNews, divisionTables, isStar, newsFromResults } from './news.ts';
import { matchdayCount, roundRobin } from './schedule.ts';
import { computeStandings } from './standings.ts';
import type { Fixture, FixtureResult, GameState } from './types.ts';
import { championsFrom, cupKey, finishTournamentRound, midweekKey, startTournaments, tournamentFixture, tournamentsAt } from './tournaments.ts';

export interface NewGameOptions {
  seed: string;
  teamName: string;
  lang: Lang;
  /** Default: normal. */
  difficulty?: DifficultyId;
}

/** Generates the stables of every division (the player's stable is the last slot of its division). */
export function generateWorld(seed: string, teamName: string, lang: Lang, cfg: GameConfig = DEFAULT_CONFIG, difficulty: DifficultyId = 'normal') {
  const lc = cfg.league;
  const diff = cfg.identity.difficulties[difficulty];
  const world = new Rng(deriveSeed(seed, 'world'));
  const aiCount = diff.divisions.reduce((n, list) => n + list.length, 0) - 1;
  const identities = drawIdentities(world.fork('identities'), aiCount);
  let nextIdentity = 0;
  const size = lc.squadSize;
  const names = new Set<string>();
  const teams: Team[] = [];
  const divisions: string[][] = [];
  const qualities: Record<string, QualityId> = {};
  let playerId = '';
  diff.divisions.forEach((list, d) => {
    const ids: string[] = [];
    list.forEach((q, i) => {
      const isPlayer = d === lc.playerDivision && i === list.length - 1;
      const quality = (isPlayer ? (diff.playerQuality ?? lc.playerQuality) : q) as QualityId;
      const rng = world.fork(isPlayer ? 'player' : `ai${d}-${i}`);
      const identity = isPlayer ? undefined : identities[nextIdentity++];
      const favoured = identity ? { species: cfg.identity.styles[identity.style].species, share: styleShare(identity, difficulty, cfg) } : undefined;
      const team = generateTeam(rng, { name: isPlayer ? teamName.trim() || undefined : undefined, quality, size, lang, favoured }, cfg);
      if (identity) {
        team.identity = identity;
        team.tactic = applyIdentity(team, team.tactic, difficulty, undefined, cfg);
      }
      for (let k = 0; !isPlayer && names.has(team.name) && k < 50; k++) team.name = generateTeamName(rng, lang);
      // The player keeps their name: an AI stable already called that way (higher division) is renamed.
      const twin = isPlayer ? teams.find((x) => x.name === team.name) : undefined;
      if (twin) {
        const r = world.fork('rename');
        for (let k = 0; (twin.name === team.name || names.has(twin.name)) && k < 50; k++) twin.name = generateTeamName(r, lang);
        names.add(twin.name);
      }
      names.add(team.name);
      seedRelations(team, rng, cfg);
      qualities[team.id] = quality;
      if (isPlayer) playerId = team.id;
      ids.push(team.id);
      teams.push(team);
    });
    divisions.push(ids);
  });
  return { teams, divisions, qualities, playerId };
}

/** League calendar of every division for a season. */
export function seasonFixtures(worldSeed: string, season: number, divisions: string[][], cfg: GameConfig = DEFAULT_CONFIG): Fixture[] {
  return divisions.flatMap((ids, d) => roundRobin(new Rng(deriveSeed(worldSeed, 'schedule', season, d)), ids, cfg.league.legs, season, d));
}

export function newGame(opts: NewGameOptions, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const difficulty = opts.difficulty ?? 'normal';
  const { teams, divisions, qualities, playerId } = generateWorld(opts.seed, opts.teamName, opts.lang, cfg, difficulty);
  const state: GameState = {
    version: 6,
    worldSeed: opts.seed,
    lang: opts.lang,
    season: 1,
    matchday: 1,
    teams,
    playerTeamId: playerId,
    fixtures: seasonFixtures(opts.seed, 1, divisions, cfg),
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
    training: {},
    staff: {},
    coachMarket: [],
    youth: [],
    divisions,
    cup: { round: 0, rounds: 0, alive: [] },
    tournaments: [],
    board: { objective: 'midTable', confidence: cfg.club.board.start },
    facilities: Object.fromEntries(teams.map((t) => [t.id, startingFacilities(qualities[t.id] ?? 'professional', cfg)])),
    news: [],
    difficulty,
  };
  initEconomy(state, qualities, cfg);
  const club = state.clubs[playerId];
  if (club) club.balance = Math.round(club.balance * cfg.identity.difficulties[difficulty].startMoney);
  initTraining(state, qualities, cfg);
  pushMessage(state, { kind: 'welcome', teamName: teamById(state, playerId).name, teams: divisions[divisionOf(state, playerId)]!.length, matchdays: matchdayCount(state.fixtures) });
  newSeasonObjective(state, cfg);
  startCup(state, cfg);
  startTournaments(state, championsFrom(state), cfg);
  snapshotSeasonStart(state, cfg);
  return state;
}

// ——— Queries ———

export const lastMatchday = (state: GameState) => matchdayCount(state.fixtures);
export const playerTeam = (state: GameState) => teamById(state, state.playerTeamId);
export const playerDivision = (state: GameState) => divisionOf(state, state.playerTeamId);

/** A midweek (cup or tournament round) is due before the next league matchday. */
export function cupDue(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): boolean {
  return midweekKey(state, cfg) !== null;
}

export const seasonOver = (state: GameState, cfg: GameConfig = DEFAULT_CONFIG) => state.matchday > lastMatchday(state) && !cupDue(state, cfg);

export function teamById(state: GameState, id: string): Team {
  const t = state.teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

const involves = (f: Fixture, id: string) => f.home === id || f.away === id;

/** The player's next fixture: in a midweek, its cup or tournament tie (none if it does not play), else the league match. */
export function playerFixture(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): Fixture | undefined {
  const key = midweekKey(state, cfg);
  if (key !== null) {
    if (cupKey(state, cfg) === key) {
      const f = state.fixtures.find((x) => x.competition === 'cup' && x.round === state.cup.round && !x.result && involves(x, state.playerTeamId));
      if (f) return f;
    }
    for (const t of tournamentsAt(state, key)) {
      const f = tournamentFixture(state, t);
      if (f) return f;
    }
    return undefined;
  }
  return state.fixtures.find((f) => !f.competition && f.matchday === state.matchday && involves(f, state.playerTeamId));
}

/** Table of a division (default: the player's). */
export function standings(state: GameState, division = playerDivision(state), cfg: GameConfig = DEFAULT_CONFIG) {
  return computeStandings(state.divisions[division] ?? [], divisionFixtures(state, division), cfg);
}

// ——— Match preparation ———

/**
 * AI manager: rests tired creatures when it can, picks the best available lineup, then applies the stable's
 * identity (orders, favourite abilities, break behaviour) and, if its manager does, reads the opponent.
 */
export function aiPrepare(team: Team, cfg: GameConfig = DEFAULT_CONFIG, difficulty: DifficultyId = 'normal', opponent?: Team): Team {
  const needed = cfg.match.starters + cfg.match.benchSize;
  const restAbove = cfg.identity.difficulties[difficulty].restFatigue;
  const fresh = team.creatures.filter((c) => !isInjured(c) && c.condition.fatigue <= restAbove);
  const pool = fresh.length >= needed ? fresh : team.creatures;
  const tactic = autoTactic(pool, cfg, team.tactic.orders);
  // Without an identity (the player's "pick for me"), keep the current orders.
  return { ...team, tactic: team.identity ? applyIdentity(team, tactic, difficulty, opponent, cfg) : tactic };
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
  const difficulty = state.difficulty ?? 'normal';
  // The player's tactic is fixed first, so AI managers can read it; between two AI stables, each reads the other's usual line-up.
  const base = (id: string) => (id === state.playerTeamId ? playerPrepare(teamById(state, id), cfg) : teamById(state, id));
  const prep = (id: string, oppId: string) => (id === state.playerTeamId ? base(id) : aiPrepare(teamById(state, id), cfg, difficulty, base(oppId)));
  const home = prep(fixture.home, fixture.away);
  const away = prep(fixture.away, fixture.home);
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

// ——— Matches ———

interface MatchEffects {
  injuries: { creatureId: string; injuryId: string; weeks: number }[];
}

/** Applies fatigue, injuries, morale and form from a match to one side's team (mutates `team`). */
function applyMatchEffects(team: Team, result: MatchResult, side: Side, injuryFactor: number, cfg: GameConfig): MatchEffects {
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
      const weeks = Math.max(1, Math.round(inj.weeks * injuryFactor));
      cond.injuries.push({ injuryId: inj.injuryId, weeksLeft: weeks });
      effects.injuries.push({ creatureId: c.id, injuryId: inj.injuryId, weeks });
    }
    if (!pm.played) continue;
    const st = ratings.get(c.id);
    // Experience from the fight (turned into progress by this week's training).
    const g = (c.growth ??= { ability: 0, pool: 0, season: 0 });
    g.matchXp = (g.matchXp ?? 0) + matchXp({ played: true, starter: !!result.roster[c.id]?.starter, rating: st?.rating ?? 5, kos: st?.kos ?? 0, won }, cfg);
    let morale = cond.morale + moraleDelta;
    if (report.mvp === c.id) morale += lc.mvpMorale;
    cond.morale = clamp(Math.round(morale), 0, 100);
    if (st?.played) cond.form = clamp(Math.round(cond.form + (st.rating - 6) * lc.formPerRatingPoint), 1, 20);
  }
  return effects;
}

/**
 * Rare deaths: a creature knocked out in the match that picked up an injury may die of it (mutates).
 * Own RNG stream per creature, so it never changes match results. Returns the dead with their injury.
 */
function fatalities(state: GameState, team: Team, result: MatchResult, fx: MatchEffects, injuryFactor: number, cfg: GameConfig) {
  const d = cfg.league.death;
  const kod = new Set(result.events.flatMap((e) => (e.type === 'ko' ? [e.target] : [])));
  const dead: { id: string; name: string; speciesId: string; age: number; level: number; injuryId: string; friends: string[] }[] = [];
  for (const inj of fx.injuries) {
    if (!kod.has(inj.creatureId) || dead.some((x) => x.id === inj.creatureId)) continue;
    const chance = (d.chance[INJURIES[inj.injuryId]?.severity ?? 'minor'] ?? 0) * injuryFactor;
    if (chance <= 0) continue;
    const rng = new Rng(deriveSeed(state.worldSeed, 'death', state.season, state.matchday, inj.creatureId, inj.injuryId));
    if (!rng.chance(chance)) continue;
    const c = team.creatures.find((x) => x.id === inj.creatureId);
    if (!c) continue;
    dead.push({ id: c.id, name: c.name, speciesId: c.speciesId, age: c.age, level: levelOf(c, cfg), injuryId: inj.injuryId, friends: [] });
  }
  for (const x of dead) {
    x.friends = bury(state, team, x.id, cfg);
    for (const c of team.creatures) c.condition.morale = clamp(c.condition.morale + d.teamMorale, 0, 100);
    addNews(state, { kind: 'death', name: x.name, team: team.name }, cfg);
  }
  return dead;
}

/** One week passes for a team: injuries heal (mutates). Returns the healed creatures' ids. */
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

/** Rest between matches: fatigue recovers (`share` of a full week), morale and form drift to normal. */
function rest(team: Team, share: number, cfg: GameConfig) {
  const w = cfg.league.week;
  for (const c of team.creatures) {
    const cond = c.condition;
    cond.fatigue = clamp(Math.round(cond.fatigue - (w.fatigueRecovery + c.attributes.recovery * w.fatigueRecoveryPerAttr) * share), 0, 100);
    cond.morale = clamp(Math.round(cond.morale + (w.moraleBaseline - cond.morale) * w.moraleDrift * share), 0, 100);
    cond.form = clamp(Math.round(cond.form + (10 - cond.form) * w.formDrift * share), 1, 20);
  }
}

interface Played {
  fixture: Fixture;
  result: MatchResult;
}

/** Plays fixtures (the player's one may have been played live) and applies their effects. */
function playFixtures(next: GameState, fixtures: Fixture[], playerMatch: MatchResult | null, cfg: GameConfig): Played[] {
  const played: (Played & { swapped: boolean })[] = [];
  for (const f of fixtures) {
    const { setup, swapped } = fixtureSetup(next, f, cfg);
    const mine = involves(f, next.playerTeamId);
    // Snapshot the teams before the match changes them (fatigue, morale…), to replay it later.
    const snapshot = mine ? structuredClone(setup) : null;
    const result = mine && playerMatch ? playerMatch : simulateMatch(setup, { cfg });
    if (snapshot) {
      const history = (next.matchHistory ??= []);
      history.push({ fixtureId: f.id, season: next.season, matchday: f.matchday, setup: snapshot, decisions: result.decisions });
      if (history.length > cfg.league.replayHistory) history.splice(0, history.length - cfg.league.replayHistory);
    }
    played.push({ fixture: f, result, swapped });
  }
  const starters = new Map<string, string[]>();
  for (const { fixture, result, swapped } of played) {
    fixture.result = toFixtureResult(result, swapped);
    const sideOf = (teamId: string): Side => (result.teams[0].id === teamId ? 0 : 1);
    for (const teamId of [fixture.home, fixture.away]) {
      const team = next.teams.find((t) => t.id === teamId)!;
      const side = sideOf(teamId);
      starters.set(teamId, Object.values(result.roster).filter((r) => r.side === side && r.starter).map((r) => r.id));
      const injuryFactor = injuryWeeksFactor(next, teamId, cfg);
      const fx = applyMatchEffects(team, result, side, injuryFactor, cfg);
      for (const inj of fx.injuries) {
        const c = team.creatures.find((x) => x.id === inj.creatureId)!;
        if (inj.weeks >= cfg.club.news.starInjuryWeeks && isStar(next, c.id)) addNews(next, { kind: 'starInjury', name: c.name, team: team.name, weeks: inj.weeks }, cfg);
      }
      const dead = fatalities(next, team, result, fx, injuryFactor, cfg);
      fx.injuries = fx.injuries.filter((i) => !dead.some((x) => x.id === i.creatureId));
      if (teamId !== next.playerTeamId) {
        team.tactic = aiPrepare(team, cfg, next.difficulty ?? 'normal').tactic;
        continue;
      }
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
      for (const x of dead) {
        pushMessage(next, { kind: 'death', creatureId: x.id, name: x.name, speciesId: x.speciesId, injuryId: x.injuryId, opponent: opp.name, friends: x.friends });
        (next.fallen ??= []).push({ id: x.id, name: x.name, speciesId: x.speciesId, age: x.age, level: x.level, season: next.season, matchday: next.matchday, opponent: opp.name, injuryId: x.injuryId });
      }
      for (const inj of fx.injuries) {
        pushMessage(next, { kind: 'injury', creatureId: inj.creatureId, name: team.creatures.find((c) => c.id === inj.creatureId)!.name, injuryId: inj.injuryId, weeks: inj.weeks });
      }
      next.lastMatch = { fixtureId: fixture.id, result };
    }
  }
  weeklyRelations(next, starters, cfg);
  weeklyBoard(next, played.map((p) => p.fixture), cfg);
  return played;
}

/** Plays the week: a cup round when one is due, otherwise the league matchday. */
export function playWeek(state: GameState, playerMatch: MatchResult | null = null, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  return cupDue(state, cfg) ? playCupRound(state, playerMatch, cfg) : playMatchday(state, playerMatch, cfg);
}

/**
 * Plays every league fixture of the current matchday, in every division.
 *
 * Order within the week: existing injuries tick down → match effects (fatigue, new injuries,
 * morale, form, relations, board) → a week of rest → training → money, scouts, market, facilities.
 */
export function playMatchday(state: GameState, playerMatch: MatchResult | null = null, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  if (seasonOver(state, cfg)) return state;
  // A cup week comes first when one is due.
  if (cupDue(state, cfg)) return playCupRound(state, playerMatch, cfg);
  const next: GameState = structuredClone(state);
  // Youngsters not kept before the first match leave.
  releaseYouth(next);
  const before = divisionTables(next, cfg);
  const fixtures = next.fixtures.filter((f) => !f.competition && f.matchday === next.matchday && !f.result);

  // 1. Existing injuries heal.
  for (const team of next.teams) {
    const healed = weeklyRecovery(team);
    if (team.id === next.playerTeamId) {
      for (const id of healed) pushMessage(next, { kind: 'recovered', creatureId: id, name: team.creatures.find((c) => c.id === id)!.name });
    }
  }

  // 2. Results & match effects.
  const played = playFixtures(next, fixtures, playerMatch, cfg);
  newsFromResults(next, played, before, cfg);

  // 3. A week of rest.
  for (const team of next.teams) rest(team, 1, cfg);
  const tired = playerTeam(next).creatures.filter((c) => c.condition.fatigue >= 50 && !isInjured(c));
  if (tired.length) pushMessage(next, { kind: 'tired', names: tired.map((c) => c.name) });

  // 4. Training.
  const playedIds = new Set(played.flatMap(({ result }) => result.postMatch.filter((pm) => pm.played).map((pm) => pm.creatureId)));
  weeklyTraining(next, playedIds, cfg);
  trainingReport(next, cfg);

  // 5. Money, scouts, the transfer market, facilities.
  weeklyFinances(next, played.map((p) => p.fixture), cfg);
  const seen: string[] = [];
  for (const { result, fixture } of played) {
    if (!involves(fixture, next.playerTeamId)) continue;
    const mySide = result.teams[0].id === next.playerTeamId ? 0 : 1;
    for (const pm of result.postMatch) if (pm.played && result.roster[pm.creatureId]?.side !== mySide) seen.push(pm.creatureId);
  }
  weeklyScouting(next, seen, cfg);
  weeklyMarket(next, cfg);
  weeklyFacilities(next, cfg);
  contractWarning(next, cfg);

  next.matchday++;
  if (next.matchday > lastMatchday(next)) endOfLeague(next, cfg);
  checkAmbitions(next, cfg);
  return next;
}

/** Last league matchday played: prizes, champions, the board's verdict. */
function endOfLeague(next: GameState, cfg: GameConfig) {
  seasonPrizes(next, cfg);
  const tables = divisionTables(next, cfg);
  tables.forEach((table, d) => addNews(next, { kind: 'champion', team: teamById(next, table[0]!.teamId).name, division: d }, cfg));
  const div = playerDivision(next);
  const table = tables[div]!;
  const pos = table.findIndex((r) => r.teamId === next.playerTeamId) + 1;
  pushMessage(next, { kind: 'seasonEnd', position: pos, champion: teamById(next, table[0]!.teamId).name, points: table[pos - 1]!.points });
  const me = next.playerTeamId;
  const trophies = [...(next.cup.winner === me ? ['shadow'] : []), ...next.tournaments.filter((t) => t.winner === me).map((t) => t.def)];
  recordSeason(next, div, pos, table[pos - 1]!.points, trophies);
  boardVerdict(next, cfg);
}

// ——— Cup ———

/** Cup draw of the season: the strongest stables enter in round 2, the others play a preliminary round. */
export function startCup(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const all = state.teams.map((t) => t.id);
  const byes = Math.min(cfg.league.cup.byes, all.length);
  // Rounds after the preliminary one: log2 of (byes + winners of the preliminary).
  const prelim = all.length - byes;
  const afterPrelim = byes + prelim / 2;
  const rounds = (prelim > 0 ? 1 : 0) + Math.round(Math.log2(afterPrelim));
  state.cup = { round: 0, rounds, alive: all };
  drawCupRound(state, cfg);
}

function drawCupRound(state: GameState, cfg: GameConfig) {
  const c = state.cup;
  const rng = new Rng(deriveSeed(state.worldSeed, 'cup', state.season, c.round));
  let entrants = c.alive;
  if (c.round === 0) {
    const byes = Math.min(cfg.league.cup.byes, c.alive.length);
    const ranked = [...c.alive].sort(
      (a, b) => divisionOf(state, a) - divisionOf(state, b) || teamStrength(teamById(state, b)) - teamStrength(teamById(state, a)) || a.localeCompare(b),
    );
    entrants = ranked.slice(byes);
  }
  const drawn = rng.shuffle(entrants);
  const matchday = cfg.league.cup.after[c.round] ?? 0;
  for (let i = 0; i + 1 < drawn.length; i += 2) {
    const f: Fixture = { id: `s${state.season}-cup${c.round}-${i / 2}`, matchday, home: drawn[i]!, away: drawn[i + 1]!, competition: 'cup', round: c.round };
    state.fixtures.push(f);
    if (involves(f, state.playerTeamId)) {
      const home = f.home === state.playerTeamId;
      pushMessage(state, { kind: 'cupDraw', round: c.round, opponent: teamById(state, home ? f.away : f.home).name, home });
    }
  }
}

/** Plays the midweek that is due: the cup round and/or tournament rounds (half a week of rest, no wages or training). */
export function playCupRound(state: GameState, playerMatch: MatchResult | null = null, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const key = midweekKey(state, cfg);
  if (key === null) return state;
  const next: GameState = structuredClone(state);
  releaseYouth(next);
  const cupNow = cupKey(next, cfg) === key;
  const round = next.cup.round;
  const tours = tournamentsAt(next, key);
  const before = divisionTables(next, cfg);
  const fixtures = [
    ...(cupNow ? next.fixtures.filter((f) => f.competition === 'cup' && f.round === round && !f.result) : []),
    ...tours.flatMap((t) => next.fixtures.filter((f) => f.tournamentId === t.id && f.round === t.round && !f.result)),
  ];
  const played = playFixtures(next, fixtures, playerMatch, cfg);
  newsFromResults(next, played, before, cfg);
  for (const team of next.teams) rest(team, 0.5, cfg);

  if (cupNow) {
    const prize = cfg.league.cup.prize[round] ?? 0;
    for (const { fixture: f } of played) {
      if (f.competition !== 'cup') continue;
      const r = f.result!;
      const winner = r.winner === 0 ? f.home : f.away;
      const loser = r.winner === 0 ? f.away : f.home;
      earn(next, f.home, 'tickets', ticketRevenue(next, f.home, f.away, cfg));
      earn(next, winner, 'prizes', prize);
      next.cup.alive = next.cup.alive.filter((id) => id !== loser);
      if (loser === next.playerTeamId) pushMessage(next, { kind: 'cupOut', round, by: teamById(next, winner).name });
    }
    next.cup.round++;
    if (next.cup.round >= next.cup.rounds) {
      const winner = next.cup.alive[0];
      if (winner) {
        next.cup.winner = winner;
        addNews(next, { kind: 'cupWinner', team: teamById(next, winner).name }, cfg);
        if (winner === next.playerTeamId) pushMessage(next, { kind: 'cupWon', prize });
      }
    } else drawCupRound(next, cfg);
  }
  for (const t of tours) finishTournamentRound(next, t, played.filter((p) => p.fixture.tournamentId === t.id).map((p) => p.fixture), cfg);
  checkAmbitions(next, cfg);
  return next;
}

// ——— Season change ———

/** Promotion & relegation between consecutive divisions (by the final tables). Mutates. */
function promoteAndRelegate(next: GameState, cfg: GameConfig) {
  const n = cfg.league.promoted;
  const tables = divisionTables(next, cfg);
  for (let d = 0; d + 1 < next.divisions.length; d++) {
    const down = tables[d]!.slice(-n).map((r) => r.teamId);
    const up = tables[d + 1]!.slice(0, n).map((r) => r.teamId);
    next.divisions[d] = next.divisions[d]!.filter((id) => !down.includes(id)).concat(up);
    next.divisions[d + 1] = next.divisions[d + 1]!.filter((id) => !up.includes(id)).concat(down);
    addNews(next, { kind: 'promotion', teams: up.map((id) => teamById(next, id).name), division: d }, cfg);
    addNews(next, { kind: 'relegation', teams: down.map((id) => teamById(next, id).name), division: d + 1 }, cfg);
    if (up.includes(next.playerTeamId)) pushMessage(next, { kind: 'promoted', division: d });
    if (down.includes(next.playerTeamId)) pushMessage(next, { kind: 'relegated', division: d + 1 });
  }
}

/** New season: promotions, ageing, contracts, youth, a new calendar and cup, a new board objective. */
export function startNextSeason(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const next: GameState = structuredClone(state);
  // The Champions Cup takes the best four of the top division, before promotions.
  const champions = championsFrom(next, divisionTables(next, cfg)[0]);
  promoteAndRelegate(next, cfg);
  next.season++;
  next.matchday = 1;
  next.fixtures = seasonFixtures(next.worldSeed, next.season, next.divisions, cfg);
  next.lastMatch = null;
  const rng = new Rng(deriveSeed(next.worldSeed, 'offseason', next.season));
  ageing(next, cfg);
  contractsTurnover(next, rng, cfg);
  youthIntake(next, rng, cfg);
  refreshCoachMarket(next, rng, cfg);
  fillFreeAgents(next, rng, cfg);
  ensureSquads(next, rng, cfg);
  trimLedgers(next);
  next.offers = [];
  next.bids = {};
  for (const team of next.teams) {
    for (const c of team.creatures) c.condition.fatigue = 0;
    if (team.id !== next.playerTeamId) team.tactic = aiPrepare(team, cfg, next.difficulty ?? 'normal').tactic;
  }
  startCup(next, cfg);
  startTournaments(next, champions, cfg);
  snapshotSeasonStart(next, cfg);
  pushMessage(next, { kind: 'newSeason' });
  newSeasonObjective(next, cfg);
  checkAmbitions(next, cfg);
  return next;
}
