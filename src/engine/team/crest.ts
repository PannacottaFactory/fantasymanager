/** A stable's crest: chosen by the player, drawn from its id for AI stables (no RNG of the world). */
import { hashString } from '../../core/rng.ts';
import {
  CREST_CHARGES, CREST_CLASSIC_CHARGES, CREST_CLASSIC_COLORS, CREST_CLASSIC_PATTERNS, CREST_COLORS, CREST_EMBLEMS, CREST_PATTERNS, type TeamCrest,
} from '../../data/crest.ts';
import type { Team } from '../model.ts';

/** Light fields get a dark emblem, dark fields a gold or silver one. */
const LIGHT = new Set(['#e8e8e8', '#d4a62a', '#f0e05a', '#c8a77a', '#9cc9ec', '#f2a7b8', '#4fc3c0', '#8bc34a']);

/**
 * The crest drawn from a seed. AI stables use the classic palette (unchanged, so existing saves keep their crests);
 * `full` draws from every colour and pattern (the « random » button of the crest editor).
 */
export function defaultCrest(seed: string, full = false): TeamCrest {
  const h = (k: string) => hashString(`${seed}:crest:${k}`);
  const colors = full ? CREST_COLORS : CREST_CLASSIC_COLORS;
  const patterns = full ? CREST_PATTERNS : CREST_CLASSIC_PATTERNS;
  const c1 = colors[h('c1') % colors.length]!;
  let c2 = colors[h('c2') % colors.length]!;
  if (c2 === c1) c2 = colors[(h('c2') + 5) % colors.length]!;
  const pattern = patterns[h('p') % patterns.length]!;
  let charge = LIGHT.has(c1) && pattern === 'plain' ? CREST_CLASSIC_CHARGES[2]! : CREST_CLASSIC_CHARGES[h('ch') % 2]!;
  // Full palette: one draw in three gives a coloured emblem (never the colour of the field).
  if (full && h('chc') % 3 === 0) {
    const pool = CREST_CHARGES.slice(3).filter((c) => c !== c1 && c !== c2);
    charge = pool[h('chx') % pool.length]!;
  }
  return { emblem: CREST_EMBLEMS[h('e') % CREST_EMBLEMS.length]!, field: [c1, c2], pattern, charge };
}

export const crestOf = (team: Pick<Team, 'id' | 'crest'>): TeamCrest => team.crest ?? defaultCrest(team.id);
