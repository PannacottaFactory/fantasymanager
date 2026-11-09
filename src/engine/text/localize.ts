/**
 * Localized names & descriptions of static game data. English lives in the declarations themselves
 * (src/data/*.ts), other languages in src/data/i18n. Unknown ids fall back to the id.
 */
import type { Lang } from '../../core/i18n.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { ATTRIBUTE_INFO, CATEGORY_LABELS, type AttributeCategory, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { EFFECTS } from '../../data/effects.ts';
import { ELEMENTS } from '../../data/elements.ts';
import { INJURIES } from '../../data/injuries.ts';
import { ROLES } from '../../data/roles.ts';
import { SPECIES } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { AbilityKind, ElementId, RoleId, SizeClass } from '../../data/schema.ts';
import {
  FR_ABILITIES, FR_ABILITY_KINDS, FR_ATTRIBUTES, FR_CATEGORIES, FR_EFFECTS, FR_ELEMENTS, FR_INJURIES, FR_QUALITIES,
  FR_ROLES, FR_SIZES, FR_SPECIES, FR_TRAITS, type SpeciesText,
} from '../../data/i18n/fr.ts';

const EN_ROLE_SHORT: Record<RoleId, string> = { tank: 'TNK', striker: 'STR', support: 'SUP', caster: 'CST', skirmisher: 'SKR' };

export function speciesText(id: string, lang: Lang): SpeciesText {
  if (lang === 'fr' && FR_SPECIES[id]) return FR_SPECIES[id];
  const s = SPECIES[id];
  if (!s) return { name: id, plural: id, description: '', the: id, fem: false };
  return { name: s.name, plural: s.plural, description: s.description, the: `the ${s.name.toLowerCase()}`, fem: false };
}

export const speciesName = (id: string, lang: Lang) => speciesText(id, lang).name;

export function abilityText(id: string, lang: Lang): { name: string; verb: string; description: string } {
  if (lang === 'fr' && FR_ABILITIES[id]) return FR_ABILITIES[id];
  const a = ABILITIES[id];
  return a ? { name: a.name, verb: a.verb, description: a.description } : { name: id, verb: id, description: '' };
}

export function effectText(id: string, lang: Lang): { name: string; noun: string; description: string } {
  if (lang === 'fr' && FR_EFFECTS[id]) return FR_EFFECTS[id];
  const e = EFFECTS[id];
  return e ? { name: e.name, noun: e.name.toLowerCase(), description: e.description } : { name: id, noun: id, description: '' };
}

export function traitText(id: string, lang: Lang): { name: string; description: string } {
  if (lang === 'fr' && FR_TRAITS[id]) return FR_TRAITS[id];
  const t = TRAITS[id];
  return t ? { name: t.name, description: t.description } : { name: id, description: '' };
}

/** `name` reads inside a sentence ("a deep gash" / "une entaille profonde"); `short` is a label. */
export function injuryText(id: string, lang: Lang): { name: string; short: string } {
  if (lang === 'fr' && FR_INJURIES[id]) return FR_INJURIES[id];
  const i = INJURIES[id];
  if (!i) return { name: id, short: id };
  return { name: i.name.toLowerCase(), short: i.name };
}

export function elementName(id: ElementId, lang: Lang): string {
  return lang === 'fr' ? FR_ELEMENTS[id] : ELEMENTS[id].name;
}

export function roleText(id: RoleId, lang: Lang): { name: string; short: string; description: string } {
  if (lang === 'fr') return FR_ROLES[id];
  const r = ROLES[id];
  return { name: r.name, short: EN_ROLE_SHORT[id], description: r.description };
}

export function attributeText(key: AttributeKey, lang: Lang): { name: string; short: string; description: string } {
  return lang === 'fr' ? FR_ATTRIBUTES[key] : ATTRIBUTE_INFO[key];
}

export function categoryName(cat: AttributeCategory, lang: Lang): string {
  return lang === 'fr' ? FR_CATEGORIES[cat] : CATEGORY_LABELS[cat];
}

export function qualityName(id: string, lang: Lang): string {
  if (lang === 'fr' && FR_QUALITIES[id]) return FR_QUALITIES[id];
  return (DEFAULT_CONFIG.generation.qualities as Record<string, { label: string }>)[id]?.label ?? id;
}

export function sizeName(size: SizeClass, lang: Lang): string {
  return lang === 'fr' ? FR_SIZES[size] : size;
}

export function abilityKindName(kind: AbilityKind, lang: Lang): string {
  return lang === 'fr' ? FR_ABILITY_KINDS[kind] : kind;
}
