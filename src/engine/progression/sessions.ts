/**
 * Training sessions: every match a stable plays earns it sessions (more with a better training ground, kept up to a
 * few). The player spends one with « train a creature »: a creature of the squad is drawn, then one attribute of its
 * program (physical, combat or mental), which goes up (+1, or +2 with a chance that grows with the coach of that
 * category). Every draw is fixed by the world seed and the session number (the UI shows it as two roulettes).
 * AI stables spend theirs right after their matches. Pure functions; `runSession` returns a new state.
 */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { ATTRIBUTE_CATEGORIES, type AttributeCategory, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { isInjured } from '../creature/derived.ts';
import { facilityLevel } from '../club/facilities.ts';
import type { GameState } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';
import { attributeCeiling, defaultProgram, programCategory, progressLogger } from './training.ts';

export interface SessionResult {
  creatureId: string;
  /** The program's category the attribute was drawn from. */
  category: AttributeCategory;
  attr: AttributeKey;
  /** +1, or +2 on a jackpot. */
  d: number;
  /** Value before the session. */
  from: number;
}

/** The player's sessions: available now, spent so far (seeds the draws), latest results. */
export interface SessionState {
  available: number;
  total: number;
  recent: SessionResult[];
}

/** Chance of an extra session after a match (its training ground). */
export function extraSessionChance(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG): number {
  const c = cfg.training.sessions.extraChance;
  return c[facilityLevel(state, teamId, 'training')] ?? c[c.length - 1]!;
}

/** Sessions a stable earns for one match: the base one, plus an extra one by chance (own stream, never alters results). */
export function sessionsPerMatch(state: GameState, teamId: string, matchKey: string, cfg: GameConfig = DEFAULT_CONFIG): number {
  const extra = new Rng(deriveSeed(state.worldSeed, 'extraSession', state.season, matchKey, teamId)).chance(extraSessionChance(state, teamId, cfg));
  return cfg.training.sessions.base + (extra ? 1 : 0);
}

/** The player's session state (a new game, or an older save, starts with one session). */
export function sessionState(state: GameState): SessionState {
  const s = state.sessions as Partial<SessionState> | undefined;
  return { available: typeof s?.available === 'number' ? s.available : 1, total: s?.total ?? 0, recent: s?.recent ?? [] };
}

export const sessionsLeft = (state: GameState) => sessionState(state).available;

/** Chance of a +2 in a category: grows with the quality of that category's coach. */
export function jackpotChance(state: GameState, teamId: string, category: AttributeCategory, cfg: GameConfig = DEFAULT_CONFIG): number {
  const j = cfg.training.sessions.jackpot;
  return j.base + (state.staff[teamId]?.[category]?.quality ?? 0) * j.perQuality;
}

/** Attributes of a category this creature can still raise. */
export function sessionTargets(c: Creature, category: AttributeCategory, cfg: GameConfig = DEFAULT_CONFIG): AttributeKey[] {
  return ATTRIBUTE_CATEGORIES[category].filter((k) => c.attributes[k] < attributeCeiling(c, k, cfg));
}

/** The player's creatures a session can draw (healthy, room to grow in their program; not the last one trained). */
export function sessionPool(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): Creature[] {
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const all = (team?.creatures ?? []).filter((c) => !isInjured(c) && sessionTargets(c, programCategory(state, c), cfg).length > 0);
  const last = sessionState(state).recent.at(-1)?.creatureId;
  const pool = all.filter((c) => c.id !== last);
  return pool.length ? pool : all;
}

function draw(state: GameState, rng: Rng, pool: Creature[], teamId: string, categoryOf: (c: Creature) => AttributeCategory, cfg: GameConfig) {
  if (!pool.length) return null;
  const c = rng.pick(pool);
  const category = categoryOf(c);
  const attr = rng.pick(sessionTargets(c, category, cfg));
  const d = rng.chance(jackpotChance(state, teamId, category, cfg)) && c.attributes[attr] + 2 <= attributeCeiling(c, attr, cfg) ? 2 : 1;
  return { c, category, attr, d };
}

export type SessionError = 'noSessionLeft' | 'nobody';

/** The player spends a session: draws the creature and an attribute of its program, raises it. */
export function runSession(
  state: GameState,
  cfg: GameConfig = DEFAULT_CONFIG,
): { state: GameState; outcome: { kind: 'trained'; result: SessionResult } | { kind: 'error'; error: SessionError } } {
  const s = sessionState(state);
  if (s.available <= 0) return { state, outcome: { kind: 'error', error: 'noSessionLeft' } };
  const rng = new Rng(deriveSeed(state.worldSeed, 'session', s.total));
  const pick = draw(state, rng, sessionPool(state, cfg), state.playerTeamId, (c) => programCategory(state, c), cfg);
  if (!pick) return { state, outcome: { kind: 'error', error: 'nobody' } };
  const next = structuredClone(state);
  const c = next.teams.find((t) => t.id === next.playerTeamId)!.creatures.find((x) => x.id === pick.c.id)!;
  const result: SessionResult = { creatureId: c.id, category: pick.category, attr: pick.attr, d: pick.d, from: c.attributes[pick.attr] };
  raise(c, pick.attr, pick.d, next, cfg, true);
  next.sessions = { available: s.available - 1, total: s.total + 1, recent: [...s.recent, result].slice(-6) };
  return { state: next, outcome: { kind: 'trained', result } };
}

function raise(c: Creature, attr: AttributeKey, d: number, state: GameState, cfg: GameConfig, isPlayer: boolean) {
  c.attributes[attr] += d;
  const g = (c.growth ??= { ability: 0, pool: 0, season: 0 });
  g.season += d;
  if (isPlayer) {
    g.seasonStart ??= { ...c.attributes, [attr]: c.attributes[attr] - d };
    const log = progressLogger(c, state.season, state.matchday, cfg);
    for (let i = 0; i < d; i++) log(attr, 1);
  }
}

/**
 * A stable played a match: the player earns sessions (kept up to `maxStored`); an AI stable spends its own at once
 * (random healthy creature, an attribute of the category its role needs most).
 */
export function afterMatchSessions(state: GameState, team: Team, matchKey: string, cfg: GameConfig = DEFAULT_CONFIG) {
  const n = sessionsPerMatch(state, team.id, matchKey, cfg);
  if (team.id === state.playerTeamId) {
    const s = sessionState(state);
    state.sessions = { ...s, available: Math.min(cfg.training.sessions.maxStored, s.available + n) };
    return;
  }
  const rng = new Rng(deriveSeed(state.worldSeed, 'aiSession', state.season, matchKey, team.id));
  const trained = new Set<string>();
  const categoryOf = (c: Creature) => defaultProgram(c, team);
  for (let i = 0; i < n; i++) {
    const pool = team.creatures.filter((c) => !isInjured(c) && !trained.has(c.id) && sessionTargets(c, categoryOf(c), cfg).length > 0);
    const pick = draw(state, rng, pool, team.id, categoryOf, cfg);
    if (!pick) break;
    trained.add(pick.c.id);
    raise(pick.c, pick.attr, pick.d, state, cfg, false);
  }
}
