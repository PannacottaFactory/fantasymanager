/** Values computed from a creature (never stored, so they can't get out of sync). */
import { ATTRIBUTE_KEYS, type AttributeKey } from '../../data/attributes.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { ROLES, ROLE_IDS } from '../../data/roles.ts';
import { SPECIES } from '../../data/species.ts';
import type { AbilityDef, RoleId, SpeciesDef } from '../../data/schema.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { Creature } from '../model.ts';
import { levelOf } from '../progression/levels.ts';

export function getSpecies(creature: Creature): SpeciesDef {
  const s = SPECIES[creature.speciesId];
  if (!s) throw new Error(`Unknown species ${creature.speciesId}`);
  return s;
}

function abilityDef(id: string): AbilityDef {
  const def = ABILITIES[id];
  if (!def) throw new Error(`Unknown ability ${id}`);
  return def;
}

/** Level at which the species' i-th skill unlocks. */
export const skillLevel = (index: number, cfg: GameConfig = DEFAULT_CONFIG) => {
  const lv = cfg.combat.skills.unlockLevels;
  return lv[Math.min(index, lv.length - 1)] ?? 1;
};

/** Level at which a skill of this species unlocks (undefined when the species doesn't have it). */
export function skillUnlockLevel(speciesId: string, abilityId: string, cfg: GameConfig = DEFAULT_CONFIG): number | undefined {
  const i = SPECIES[speciesId]?.skills.indexOf(abilityId) ?? -1;
  return i < 0 ? undefined : skillLevel(i, cfg);
}

/** Skills the creature has unlocked, in unlock order. */
export function unlockedSkills(creature: Creature, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const lv = levelOf(creature, cfg);
  return getSpecies(creature).skills.filter((_, i) => skillLevel(i, cfg) <= lv);
}

/** What the manager may equip: the basic attack(s), then the unlocked skills in unlock order. */
export function skillPool(creature: Creature, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  return [...getSpecies(creature).basic, ...unlockedSkills(creature, cfg)];
}

/** Choice of a creature nobody has set up yet: its basic attack and its latest unlocked skill. */
export function defaultSkills(creature: Creature, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const open = unlockedSkills(creature, cfg);
  return [...getSpecies(creature).basic.slice(0, 1), ...open.slice(-1)].slice(0, cfg.combat.skills.equipped);
}

/**
 * What it takes into a match: the manager's choice among its pool (at most `equipped`, in the order chosen); no choice
 * yet = `defaultSkills`. An empty choice stays empty (the match is then refused, `validateTactic`), but a choice whose
 * skills all became locked (ageing) falls back on the default.
 */
export function equippedSkills(creature: Creature, chosen?: readonly string[], cfg: GameConfig = DEFAULT_CONFIG): string[] {
  if (!chosen) return defaultSkills(creature, cfg);
  const pool = skillPool(creature, cfg);
  const out = [...new Set(chosen)].filter((id) => pool.includes(id)).slice(0, cfg.combat.skills.equipped);
  return out.length || !chosen.length ? out : defaultSkills(creature, cfg);
}

/**
 * Choice after clicking a skill: an equipped one is taken off; another one is added, in place of the one equipped
 * longest ago when the slots are full. Locked skills change nothing.
 */
export function toggleSkill(creature: Creature, chosen: readonly string[] | undefined, abilityId: string, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const current = equippedSkills(creature, chosen, cfg);
  if (current.includes(abilityId)) return current.filter((id) => id !== abilityId);
  if (!skillPool(creature, cfg).includes(abilityId)) return current;
  return [...current, abilityId].slice(-cfg.combat.skills.equipped);
}

/** What it can use in a match: its equipped skills (the basic attack counts as one when chosen). */
export function getAbilities(creature: Creature, chosen?: readonly string[], cfg: GameConfig = DEFAULT_CONFIG): AbilityDef[] {
  return equippedSkills(creature, chosen, cfg).map(abilityDef);
}

export function maxHp(creature: Creature, cfg: GameConfig): number {
  const h = cfg.combat.hp;
  const a = creature.attributes;
  const raw = h.base + a.toughness * h.perToughness + a.strength * h.perStrength;
  return Math.round(raw * h.sizeMult[getSpecies(creature).size]);
}

export function maxStamina(creature: Creature, cfg: GameConfig): number {
  const s = cfg.combat.stamina;
  return Math.round(s.base + creature.attributes.stamina * s.perStamina);
}

/** How well a creature fits a role, on the 1–20 scale. */
export function roleFit(creature: Creature, role: RoleId): number {
  const weights = ROLES[role].fit;
  let total = 0;
  let wsum = 0;
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const w = weights[key] ?? 0;
    total += creature.attributes[key] * w;
    wsum += w;
  }
  return wsum ? total / wsum : 0;
}

/** Best role, slightly favouring the roles natural to the species. */
export function bestRole(creature: Creature): RoleId {
  const natural = getSpecies(creature).roles;
  let best: RoleId = natural[0] ?? 'striker';
  let bestScore = -Infinity;
  for (const r of ROLE_IDS) {
    const score = roleFit(creature, r) + (natural.includes(r) ? 1.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/** Player-facing overall rating 1–100 (an honest summary of visible attributes). */
export function overallRating(creature: Creature): number {
  let sum = 0;
  for (const k of ATTRIBUTE_KEYS) sum += creature.attributes[k];
  const avg = sum / ATTRIBUTE_KEYS.length;
  return Math.max(1, Math.min(100, Math.round(avg * 5)));
}

export function isInjured(creature: Creature): boolean {
  return creature.condition.injuries.some((i) => i.weeksLeft > 0);
}
