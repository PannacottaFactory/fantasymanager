/**
 * Scars: when an injury heals, it may leave a permanent mark (`data/scars.ts`), with `scars.chance[severity]`. Own RNG
 * stream per creature and injury: it never changes a match result or any other draw.
 */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { INJURIES } from '../../data/injuries.ts';
import { SCARS } from '../../data/scars.ts';
import type { Creature, Scar } from '../model.ts';

/** Scars this injury could still leave on this creature (not already carried). */
export function possibleScars(c: Creature, injuryId: string): string[] {
  return Object.values(SCARS)
    .filter((s) => s.from.includes(injuryId) && !c.scars?.some((x) => x.id === s.id))
    .map((s) => s.id);
}

/** Scars an injury can leave (any creature), for the Encyclopedia. */
export function scarsOfInjury(injuryId: string): string[] {
  return Object.values(SCARS).filter((s) => s.from.includes(injuryId)).map((s) => s.id);
}

/** An injury just healed: maybe a scar (mutates the creature). Returns it (null = none). */
export function maybeScar(worldSeed: string, season: number, week: number, c: Creature, injuryId: string, cfg: GameConfig = DEFAULT_CONFIG): Scar | null {
  const sev = INJURIES[injuryId]?.severity ?? 'minor';
  const chance = cfg.scars.chance[sev] ?? 0;
  if (chance <= 0 || (c.scars?.length ?? 0) >= cfg.scars.max) return null;
  const options = possibleScars(c, injuryId);
  if (!options.length) return null;
  const rng = new Rng(deriveSeed(worldSeed, 'scar', season, week, c.id, injuryId));
  if (!rng.chance(chance)) return null;
  const scar: Scar = { id: rng.pick(options), injuryId, s: season, w: week };
  (c.scars ??= []).push(scar);
  return scar;
}
