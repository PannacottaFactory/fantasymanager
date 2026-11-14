/** Market value and wage demands of creatures (pure). */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { getSpecies } from '../creature/derived.ts';
import type { Creature } from '../model.ts';

export const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

/** True market value in gold pieces (the player only ever sees an estimate for other stables' creatures). */
export function creatureValue(c: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  const v = cfg.economy.value;
  const sp = getSpecies(c);
  const lc = sp.lifeCurve;
  let f = Math.pow(c.ability / 100, v.exponent);
  if (c.age <= lc.peakEnd) f *= 1 + (Math.max(0, c.potential - c.ability) / 100) * v.potentialWeight;
  else f *= Math.max(v.minAgeFactor, 1 - v.declinePerYear * (c.age - lc.peakEnd));
  f *= 1 + (10 - sp.rarity) * v.rarityWeight;
  // Real combat strength of the species at equal ability (calibrated by sim:species).
  f *= sp.valueMult ?? 1;
  // The market's interest in a gem the world has noticed.
  f *= c.hype ?? 1;
  return roundTo(v.base * f, v.round);
}

/** Weekly wage a creature asks to sign with a club of this reputation, for a contract of `years` seasons. */
export function askingWage(c: Creature, reputation: number, years = 1, cfg: GameConfig = DEFAULT_CONFIG): number {
  const w = cfg.economy.wage;
  let wage = creatureValue(c, cfg) * w.perValue + w.base;
  wage *= 1 + (c.hidden.ambition - 10) * w.ambitionWeight;
  wage *= 1 + Math.max(0, w.referenceReputation - reputation) / w.reputationDivisor;
  wage *= 1 + (clamp(years, w.minYears, w.maxYears) - 1) * w.perExtraYear;
  return roundTo(wage, 10);
}

/** Weekly cost of a creature for its stable: wage + species upkeep. */
export function weeklyCost(c: Creature): { wage: number; upkeep: number } {
  return { wage: c.contract?.wage ?? 0, upkeep: getSpecies(c).upkeep };
}
