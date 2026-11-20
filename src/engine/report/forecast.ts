/**
 * The assistant's forecast before a match, from what the player can see: own starters exactly, the opponent's through
 * the estimated overall rating (`overallRange`, middle of the range), both discounted by pre-match fatigue.
 * Display only: it never changes a match.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { overallRating } from '../creature/derived.ts';
import { knowledgeOf, overallRange } from '../economy/scouting.ts';
import type { GameState } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';

export type ForecastBand = 'heavyFavourite' | 'favourite' | 'even' | 'underdog' | 'heavyUnderdog';
export type Upset = 'bigExploit' | 'exploit' | 'slip';

export interface Forecast {
  /** Strength of each side (starters' average rating × fatigue). */
  mine: number;
  theirs: number;
  /** Player's chance of winning, 0–1. */
  win: number;
  band: ForecastBand;
  /** The opponent is little known: the estimate is rough. */
  unsure: boolean;
}

function starters(team: Team): Creature[] {
  const ids = new Set(team.tactic.lineup.map((s) => s.creatureId));
  return team.creatures.filter((c) => ids.has(c.id));
}

function strength(cs: Creature[], rate: (c: Creature) => number, cfg: GameConfig): number {
  if (!cs.length) return 0;
  // Weighting the species by its price multiplier (its own power beyond the attributes) did not sharpen it (sim:upsets).
  return cs.reduce((s, c) => s + rate(c) * (1 - (c.condition.fatigue / 100) * cfg.report.forecast.fatigue), 0) / cs.length;
}

/** Strength of a side as it enters the arena (true ratings): for the sims. */
export function sideStrength(team: Team, cfg: GameConfig = DEFAULT_CONFIG): number {
  return strength(starters(team), overallRating, cfg);
}

export function winChance(gap: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const f = cfg.report.forecast;
  return Math.min(f.max, Math.max(f.min, 1 / (1 + Math.exp(-f.slope * gap))));
}

export function forecastBand(win: number, cfg: GameConfig = DEFAULT_CONFIG): ForecastBand {
  const f = cfg.report.forecast;
  if (win <= f.heavy) return 'heavyUnderdog';
  if (win <= f.underdog) return 'underdog';
  if (win >= 1 - f.heavy) return 'heavyFavourite';
  if (win >= 1 - f.underdog) return 'favourite';
  return 'even';
}

/** Forecast of the player's team (`mine`) against `opp`, both as they will enter the arena. */
export function matchForecast(state: GameState, mine: Team, opp: Team, cfg: GameConfig = DEFAULT_CONFIG): Forecast {
  const theirs = starters(opp);
  const known = theirs.map((c) => knowledgeOf(state, c.id, cfg));
  const estimate = (c: Creature) => {
    const r = overallRange(c, knowledgeOf(state, c.id, cfg), cfg);
    return (r.low + r.high) / 2;
  };
  const a = strength(starters(mine), overallRating, cfg);
  const b = strength(theirs, estimate, cfg);
  const win = winChance(a - b, cfg);
  const avgKnown = known.length ? known.reduce((s, k) => s + k, 0) / known.length : 0;
  return { mine: a, theirs: b, win, band: forecastBand(win, cfg), unsure: avgKnown < cfg.report.forecast.unsureKnowledge };
}

/** What a result means against the forecast: an exploit (won as the underdog) or a slip (lost as the favourite). */
export function upsetOf(won: boolean, win: number | undefined, cfg: GameConfig = DEFAULT_CONFIG): Upset | null {
  if (win === undefined) return null;
  const f = cfg.report.forecast;
  if (won && win <= f.heavy) return 'bigExploit';
  if (won && win <= f.underdog) return 'exploit';
  if (!won && win >= 1 - f.underdog) return 'slip';
  return null;
}
