/**
 * What traits change outside the arena: training progress, ambition (wage demands, being courted, choosing a stable),
 * loyalty (asking to leave) and how much morale moves after a match. A creature without such traits gets the neutral
 * value (×1, +0), so nothing changes for it.
 */
import { TRAITS } from '../../data/traits.ts';
import type { Creature } from '../model.ts';

/** Training progress × (lazy, quick learner, professional…). */
export function traitTrainingMult(c: Creature): number {
  let m = 1;
  for (const t of c.traits) m *= TRAITS[t]?.training?.gainMult ?? 1;
  return m;
}

/** Ambition with its traits (hidden ambition + `ambitionMod`). */
export function ambitionOf(c: Creature): number {
  let a = c.hidden.ambition;
  for (const t of c.traits) a += TRAITS[t]?.personality?.ambitionMod ?? 0;
  return a;
}

/** How much the creature wants to leave for a bigger stable: its ambition, less what its traits add to loyalty. */
export function leaveDrive(c: Creature): number {
  let d = ambitionOf(c);
  for (const t of c.traits) d -= TRAITS[t]?.personality?.loyaltyMod ?? 0;
  return d;
}

/** After-match morale swings × (hothead…). */
export function moraleVolatility(c: Creature): number {
  let m = 1;
  for (const t of c.traits) m *= TRAITS[t]?.personality?.moraleVolatility ?? 1;
  return m;
}
