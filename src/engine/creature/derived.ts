/** Values computed from a creature (never stored, so they can't get out of sync). */
import { ATTRIBUTE_KEYS, type AttributeKey } from '../../data/attributes.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { ROLES, ROLE_IDS } from '../../data/roles.ts';
import { SPECIES } from '../../data/species.ts';
import type { AbilityDef, RoleId, SpeciesDef } from '../../data/schema.ts';
import type { GameConfig } from '../../data/config/index.ts';
import type { Creature } from '../model.ts';

export function getSpecies(creature: Creature): SpeciesDef {
  const s = SPECIES[creature.speciesId];
  if (!s) throw new Error(`Unknown species ${creature.speciesId}`);
  return s;
}

export function getAbilities(creature: Creature): AbilityDef[] {
  return getSpecies(creature)
    .abilities.filter((a) => (a.minAbility ?? 0) <= creature.ability)
    .map((a) => {
      const def = ABILITIES[a.id];
      if (!def) throw new Error(`Unknown ability ${a.id}`);
      return def;
    });
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
