/**
 * Levels & experience: the visible face of a creature's progression.
 * Level 1–10 and 0–100 XP within the level map onto the hidden aptitude (1–200), which still drives the
 * attributes: one level = `abilityPerLevel` aptitude points, one aptitude point = xpPerLevel / abilityPerLevel XP.
 * The potential sets each creature's maximum level. Abilities unlock at a level.
 */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { Creature } from '../model.ts';

export function levelOfAbility(ability: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const l = cfg.training.levels;
  return clamp(1 + Math.floor((Math.max(1, ability) - 1) / l.abilityPerLevel), 1, l.max);
}

export const levelOf = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) => levelOfAbility(c.ability, cfg);

/** Highest level this creature can reach (its potential). */
export const maxLevelOf = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) => levelOfAbility(c.potential, cfg);

/** XP gathered within the current level (0 … xpPerLevel − 1). */
export function xpInLevel(c: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  const l = cfg.training.levels;
  const start = (levelOf(c, cfg) - 1) * l.abilityPerLevel + 1;
  const into = c.ability - start + (c.growth?.ability ?? 0);
  return clamp(Math.floor(into * xpPerAbility(cfg)), 0, l.xpPerLevel - 1);
}

export const xpPerAbility = (cfg: GameConfig = DEFAULT_CONFIG) => cfg.training.levels.xpPerLevel / cfg.training.levels.abilityPerLevel;

/** Level at which an ability (declared with an aptitude threshold) unlocks. */
export const unlockLevel = (minAbility: number | undefined, cfg: GameConfig = DEFAULT_CONFIG) => (minAbility ? levelOfAbility(minAbility, cfg) : 1);

export const isUnlocked = (c: Creature, minAbility: number | undefined, cfg: GameConfig = DEFAULT_CONFIG) => levelOf(c, cfg) >= unlockLevel(minAbility, cfg);

/** XP a creature earns from one match (before life stage and the potential ceiling). */
export function matchXp(p: { played: boolean; starter: boolean; rating: number; kos: number; won: boolean }, cfg: GameConfig = DEFAULT_CONFIG): number {
  if (!p.played) return 0;
  const x = cfg.training.xp;
  return x.played + (p.starter ? x.starter : 0) + Math.max(0, p.rating - 5) * x.perRatingPoint + p.kos * x.ko + (p.won ? x.win : 0);
}
