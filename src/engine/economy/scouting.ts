/**
 * Imperfect information: what the player knows about creatures outside their stable.
 * Attributes are shown as ranges that always contain the true value and narrow as knowledge grows.
 * The error of each estimate is a fixed, per-creature offset (no RNG draw), so the range never jumps around.
 */
import { levelOfAbility } from '../progression/levels.ts';
import { clamp } from '../../core/math.ts';
import { hashString } from '../../core/rng.ts';
import { ATTRIBUTE_KEYS, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { overallRating } from '../creature/derived.ts';
import type { GameState } from '../league/types.ts';
import type { Creature } from '../model.ts';
import { creatureValue, roundTo } from './value.ts';

/** Stable pseudo-random number in [−1, 1] for a creature and a key. */
export function noise(creatureId: string, key: string): number {
  return ((hashString(`${creatureId}:${key}`) % 2001) - 1000) / 1000;
}

export function isOwn(state: GameState, creatureId: string): boolean {
  return state.teams.some((t) => t.id === state.playerTeamId && t.creatures.some((c) => c.id === creatureId));
}

/** 0–100: how well the player knows a creature (100 for their own). */
export function knowledgeOf(state: GameState, creatureId: string, cfg: GameConfig = DEFAULT_CONFIG): number {
  if (isOwn(state, creatureId)) return 100;
  const k = state.scouting.knowledge[creatureId];
  if (k !== undefined) return k;
  const free = state.freeAgents.some((c) => c.id === creatureId);
  return free ? cfg.economy.scouting.freeAgentBaseline : cfg.economy.scouting.leagueBaseline;
}

export interface Range {
  low: number;
  high: number;
  /** Exact when low === high. */
  exact: boolean;
}

/** Range for a 1–20 attribute. */
export function attributeRange(c: Creature, key: AttributeKey, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): Range {
  const hw = Math.round(cfg.economy.scouting.maxSpread * (1 - knowledge / 100));
  const v = c.attributes[key];
  if (hw <= 0) return { low: v, high: v, exact: true };
  const centre = v + Math.round(noise(c.id, key) * hw * 0.6);
  const low = clamp(Math.min(v, centre - hw), 1, 20);
  const high = clamp(Math.max(v, centre + hw), 1, 20);
  return { low, high, exact: low === high };
}

/** Range for the overall rating (1–100). */
export function overallRange(c: Creature, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): Range {
  const hw = Math.round(cfg.economy.scouting.maxSpread * 2.5 * (1 - knowledge / 100));
  const v = overallRating(c);
  if (hw <= 0) return { low: v, high: v, exact: true };
  const centre = v + Math.round(noise(c.id, 'ovr') * hw * 0.6);
  return { low: clamp(Math.min(v, centre - hw), 1, 100), high: clamp(Math.max(v, centre + hw), 1, 100), exact: false };
}

/** Estimated potential on a 0.5–5 star scale. */
export function potentialStars(c: Creature, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const err = noise(c.id, 'pot') * cfg.economy.scouting.potentialError * (1 - knowledge / 100);
  const est = clamp(c.potential + err, 10, 200);
  return clamp(Math.round((est / 200) * 10) / 2, 0.5, 5);
}

/** Estimated potential as the highest level the creature can reach (1–10; exact for own creatures). */
export function potentialLevel(c: Creature, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const err = noise(c.id, 'pot') * cfg.economy.scouting.potentialError * (1 - knowledge / 100);
  return levelOfAbility(clamp(c.potential + err, 10, 200), cfg);
}

/** Estimated value (exact for well-known creatures). */
export function estimatedValue(c: Creature, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const v = creatureValue(c, cfg);
  const err = noise(c.id, 'val') * 0.45 * (1 - knowledge / 100);
  return roundTo(v * (1 + err), cfg.economy.value.round);
}

/** Traits are only known once the creature has been watched enough. */
export const traitsKnown = (knowledge: number) => knowledge >= 40;

export function allAttributeRanges(c: Creature, knowledge: number, cfg: GameConfig = DEFAULT_CONFIG): Record<AttributeKey, Range> {
  const out = {} as Record<AttributeKey, Range>;
  for (const k of ATTRIBUTE_KEYS) out[k] = attributeRange(c, k, knowledge, cfg);
  return out;
}

/** Raises knowledge of a creature (never lowers it). Mutates. */
export function learn(state: GameState, creatureId: string, to: number, cfg: GameConfig = DEFAULT_CONFIG) {
  const cur = knowledgeOf(state, creatureId, cfg);
  if (to > cur) state.scouting.knowledge[creatureId] = Math.round(to);
}
