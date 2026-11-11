/** A stable's crest: chosen by the player, drawn from its id for AI stables (no RNG of the world). */
import { hashString } from '../../core/rng.ts';
import { CREST_CHARGES, CREST_COLORS, CREST_EMBLEMS, CREST_PATTERNS, type TeamCrest } from '../../data/crest.ts';
import type { Team } from '../model.ts';

/** Light fields get a dark emblem, dark fields a gold or silver one. */
const LIGHT = new Set(['#e8e8e8', '#d4a62a']);

export function defaultCrest(seed: string): TeamCrest {
  const h = (k: string) => hashString(`${seed}:crest:${k}`);
  const c1 = CREST_COLORS[h('c1') % CREST_COLORS.length]!;
  let c2 = CREST_COLORS[h('c2') % CREST_COLORS.length]!;
  if (c2 === c1) c2 = CREST_COLORS[(h('c2') + 5) % CREST_COLORS.length]!;
  const pattern = CREST_PATTERNS[h('p') % CREST_PATTERNS.length]!;
  const charge = LIGHT.has(c1) && pattern === 'plain' ? CREST_CHARGES[2]! : CREST_CHARGES[h('ch') % 2]!;
  return { emblem: CREST_EMBLEMS[h('e') % CREST_EMBLEMS.length]!, field: [c1, c2], pattern, charge };
}

export const crestOf = (team: Pick<Team, 'id' | 'crest'>): TeamCrest => team.crest ?? defaultCrest(team.id);
