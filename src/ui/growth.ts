/** Progress of the player's creatures between two states (XP, levels, attributes, abilities unlocked). Display only. */
import { ATTRIBUTE_KEYS } from '../data/attributes.ts';
import { DEFAULT_CONFIG } from '../data/config/index.ts';
import { SPECIES } from '../data/species.ts';
import { playerTeam } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import type { Creature } from '../engine/model.ts';
import { levelOf, xpInLevel } from '../engine/progression/levels.ts';
import { skillLevel } from '../engine/creature/derived.ts';

const PER = DEFAULT_CONFIG.training.levels.xpPerLevel;
const totalXp = (c: Creature) => (levelOf(c) - 1) * PER + xpInLevel(c);

interface Growth {
  c: Creature;
  xp: number;
  from: number;
  to: number;
  lv0: number;
  lv1: number;
  attrs: { k: (typeof ATTRIBUTE_KEYS)[number]; d: number }[];
  abilities: string[];
}

/** Creatures that progressed from `before` to `after`, level-ups first. */
export function weekGrowth(before: GameState, after: GameState): Growth[] {
  const was = new Map(playerTeam(before).creatures.map((c) => [c.id, c]));
  const out: Growth[] = [];
  for (const c of playerTeam(after).creatures) {
    const b = was.get(c.id);
    if (!b) continue;
    const lv0 = levelOf(b);
    const lv1 = levelOf(c);
    const xp = totalXp(c) - totalXp(b);
    const attrs = ATTRIBUTE_KEYS.map((k) => ({ k, d: c.attributes[k] - b.attributes[k] })).filter((a) => a.d !== 0);
    const abilities = (SPECIES[c.speciesId]?.skills ?? []).filter((_, i) => {
      const l = skillLevel(i);
      return l > lv0 && l <= lv1;
    });
    if (xp <= 0 && !attrs.length && lv1 <= lv0) continue;
    out.push({ c, xp: Math.max(0, xp), from: xpInLevel(b), to: xpInLevel(c), lv0, lv1, attrs, abilities });
  }
  return out.sort((a, b) => b.lv1 - b.lv0 - (a.lv1 - a.lv0) || b.attrs.length - a.attrs.length || b.xp - a.xp);
}

