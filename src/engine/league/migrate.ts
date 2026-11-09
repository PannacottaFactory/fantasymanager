/** Upgrade of older saves to the current GameState version (pure apart from mutating the raw save). */
import { DEFAULT_LANG, isLang } from '../../core/i18n.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { simulateMatch } from '../combat/simulate.ts';
import { generateTeamName } from '../creature/names.ts';
import { pickObjective } from '../club/board.ts';
import { startingFacilities } from '../club/facilities.ts';
import { guessQuality, initClub, initEconomy } from '../economy/setup.ts';
import { initStaff, initTraining } from '../progression/training.ts';
import { pushMessage } from './messages.ts';
import { roundRobin } from './schedule.ts';
import { fixtureSetup, generateWorld, startCup } from './season.ts';
import type { GameState } from './types.ts';

function guessQualities(state: GameState, cfg: GameConfig): Record<string, QualityId> {
  const out: Record<string, QualityId> = {};
  for (const t of state.teams) {
    const avg = t.creatures.reduce((sum, c) => sum + c.potential, 0) / Math.max(1, t.creatures.length);
    out[t.id] = guessQuality(avg, cfg);
  }
  return out;
}

/** Phase 4 → 5: the existing league becomes D1; a new D2 is created and its past matchdays simulated. */
function toV4(state: GameState, cfg: GameConfig) {
  const qualities = guessQualities(state, cfg);
  const d1 = state.teams.map((t) => t.id);
  const world = generateWorld(`${state.worldSeed}:d2`, '', state.lang, cfg);
  const lowest = cfg.league.divisions.length - 1;
  const newTeams = world.teams.filter((t) => world.divisions[lowest]!.includes(t.id));
  const names = new Set(state.teams.map((t) => t.name));
  const rng = new Rng(deriveSeed(state.worldSeed, 'migrate', 4));
  state.facilities = {};
  for (const t of state.teams) state.facilities[t.id] = startingFacilities(qualities[t.id] ?? 'professional', cfg);
  for (const t of newTeams) {
    for (let k = 0; names.has(t.name) && k < 50; k++) t.name = generateTeamName(rng, state.lang);
    names.add(t.name);
    const q = world.qualities[t.id] ?? 'regional';
    state.teams.push(t);
    initClub(state, t, q, rng, cfg);
    initStaff(state, t, q, rng, cfg);
    state.facilities[t.id] = startingFacilities(q, cfg);
  }
  const d2 = newTeams.map((t) => t.id);
  state.divisions = [d1, d2];
  for (const f of state.fixtures) f.division = 0;
  const d2Fixtures = roundRobin(new Rng(deriveSeed(state.worldSeed, 'schedule', state.season, 1)), d2, cfg.league.legs, state.season, 1);
  state.fixtures.push(...d2Fixtures);
  // The new division "already played" the weeks that passed.
  for (const f of d2Fixtures) {
    if (f.matchday >= state.matchday) continue;
    const { setup } = fixtureSetup(state, f, cfg);
    const r = simulateMatch(setup, { cfg });
    const kos: [number, number] = [0, 0];
    for (const e of r.events) if (e.type === 'ko') kos[r.roster[e.target]?.side === 0 ? 1 : 0]++;
    f.result = { winner: r.outcome.winner, method: r.outcome.method, rounds: r.outcome.rounds, score: r.outcome.score, kos, seed: r.seed };
  }
  state.news = [];
  state.board = { objective: 'midTable', confidence: cfg.club.board.start };
  state.board.objective = pickObjective(state, cfg);
  state.cup = { round: 0, rounds: 0, alive: [] };
  if (state.matchday <= (cfg.league.cup.after[0] ?? 0)) startCup(state, cfg);
  pushMessage(state, { kind: 'boardObjective', objective: state.board.objective, division: 0 });
}

/** Upgrades any older save to the current version; null if it cannot be read. */
export function migrateGame(raw: unknown, cfg: GameConfig = DEFAULT_CONFIG): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { version: number; lang?: unknown };
  const state = raw as GameState;
  if (s.version === 1) {
    state.lang = isLang(s.lang) ? s.lang : DEFAULT_LANG;
    initEconomy(state, guessQualities(state, cfg), cfg);
    s.version = 2;
  }
  if (s.version === 2) {
    initTraining(state, guessQualities(state, cfg), cfg);
    s.version = 3;
  }
  if (s.version === 3) {
    toV4(state, cfg);
    s.version = 4;
  }
  return s.version === 4 ? state : null;
}
