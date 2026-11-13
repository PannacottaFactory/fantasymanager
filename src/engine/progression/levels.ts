/**
 * Levels & experience: the visible face of a creature's progression.
 * Level 1–10 and 0–100 XP within the level map onto the hidden aptitude (1–200), which still drives the
 * attributes: level 1 below `base + abilityPerLevel`, then one level = `abilityPerLevel` aptitude points, one aptitude point = xpPerLevel / abilityPerLevel XP.
 * The potential sets each creature's maximum level. Abilities unlock at a level.
 */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { Creature } from '../model.ts';

export function levelOfAbility(ability: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const st = cfg.training.levels.steps;
  let lv = 1;
  for (let i = 1; i < st.length; i++) if (ability >= st[i]!) lv = i + 1;
  return clamp(lv, 1, cfg.training.levels.max);
}

export const levelOf = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) => levelOfAbility(c.ability, cfg);

/**
 * The potential is the maximum level, so a creature never sits at that level below its potential. A new creature
 * whose aptitude and potential fall in the same level is settled to the nearest of the two coherent states: already
 * trained to its potential (potential = aptitude), or one full level still to gain (potential = start of the next
 * level). `cap` bounds the potential (the next level is skipped if it goes past it).
 */
export function alignPotential(ability: number, potential: number, cfg: GameConfig = DEFAULT_CONFIG, cap = cfg.generation.maxAbility): number {
  const lv = levelOfAbility(ability, cfg);
  if (ability >= potential || levelOfAbility(potential, cfg) > lv) return potential;
  const next = cfg.training.levels.steps[lv];
  if (next === undefined || next > cap) return ability;
  return potential - ability < next - potential ? ability : next;
}

/** Highest level this creature can reach (its potential). */
export const maxLevelOf = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) => levelOfAbility(c.potential, cfg);

/** Aptitude span of a level: [start, end). */
function levelSpan(lv: number, cfg: GameConfig): [number, number] {
  const l = cfg.training.levels;
  return [l.steps[lv - 1] ?? 0, l.steps[lv] ?? l.top];
}

/** XP within the level for an aptitude (0 … xpPerLevel − 1). */
export function xpOfAbility(ability: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const l = cfg.training.levels;
  const [a, b] = levelSpan(levelOfAbility(ability, cfg), cfg);
  return clamp(Math.floor(((ability - a) / Math.max(1, b - a)) * l.xpPerLevel), 0, l.xpPerLevel - 1);
}

/** XP gathered within the current level (0 … xpPerLevel − 1). */
export const xpInLevel = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) => xpOfAbility(c.ability + (c.growth?.ability ?? 0), cfg);

/** XP counted from level 1 (to show how much XP an aptitude gain is worth). */
export const totalXpOfAbility = (ability: number, cfg: GameConfig = DEFAULT_CONFIG) => (levelOfAbility(ability, cfg) - 1) * cfg.training.levels.xpPerLevel + xpOfAbility(ability, cfg);

/** Match XP per aptitude point (conversion used by the weekly training). */
export const xpPerAbility = (cfg: GameConfig = DEFAULT_CONFIG) => cfg.training.levels.xpPerAbility;

/** Level at which an ability (declared with an aptitude threshold) unlocks. */
export const unlockLevel = (minAbility: number | undefined, cfg: GameConfig = DEFAULT_CONFIG) => (minAbility ? levelOfAbility(minAbility, cfg) : 1);

export const isUnlocked = (c: Creature, minAbility: number | undefined, cfg: GameConfig = DEFAULT_CONFIG) => levelOf(c, cfg) >= unlockLevel(minAbility, cfg);

/** XP a creature earns from one match (before life stage and the potential ceiling). */
export function matchXp(p: { played: boolean; starter: boolean; rating: number; kos: number; won: boolean }, cfg: GameConfig = DEFAULT_CONFIG): number {
  if (!p.played) return 0;
  const x = cfg.training.xp;
  return x.played + (p.starter ? x.starter : 0) + Math.max(0, p.rating - 5) * x.perRatingPoint + p.kos * x.ko + (p.won ? x.win : 0);
}
