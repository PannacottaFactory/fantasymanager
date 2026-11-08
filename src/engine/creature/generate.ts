import { clamp, lerp } from '../../core/math.ts';
import { makeId } from '../../core/ids.ts';
import type { Rng } from '../../core/rng.ts';
import { ATTRIBUTE_CATEGORIES, type AttributeCategory, type Attributes } from '../../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { SPECIES, SPECIES_IDS } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { SpeciesDef } from '../../data/schema.ts';
import type { Creature, HiddenAttributes } from '../model.ts';
import { generateName } from './names.ts';

export interface GenerateCreatureOptions {
  speciesId?: string;
  quality?: QualityId;
  /** Overrides the drawn potential (1–200). */
  potential?: number;
  age?: number;
  stableId?: string | null;
}

/** Fraction of potential a creature of this species shows at this age. */
export function ageAbilityFactor(species: SpeciesDef, age: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const { minAge, peakStart, peakEnd, declineRate } = species.lifeCurve;
  const start = cfg.generation.abilityAtMinAge;
  if (age < peakStart) {
    const t = clamp((age - minAge) / Math.max(1, peakStart - minAge), 0, 1);
    return lerp(start, 1, t);
  }
  if (age <= peakEnd) return 1;
  return Math.max(0.3, 1 - declineRate * (age - peakEnd));
}

function pickSpecies(rng: Rng): SpeciesDef {
  const id = rng.weighted(SPECIES_IDS, (id) => SPECIES[id]!.rarity);
  return SPECIES[id]!;
}

function generateAttributes(rng: Rng, species: SpeciesDef, ability: number, cfg: GameConfig): Attributes {
  const g = cfg.generation;
  const f = clamp(ability / g.maxAbility, 0, 1);
  const out = {} as Attributes;
  for (const cat of Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]) {
    const sd = g.attributeSd[cat];
    for (const key of ATTRIBUTE_CATEGORIES[cat]) {
      const [lo, hi] = species.attributes[key];
      const t = cat === 'mental' ? f * g.mentalAbilityWeight + 0.5 * (1 - g.mentalAbilityWeight) : f;
      out[key] = clamp(Math.round(rng.normal(lerp(lo, hi, t), sd)), 1, 20);
    }
  }
  return out;
}

function generateHidden(rng: Rng, cfg: GameConfig): HiddenAttributes {
  const { mean, sd } = cfg.generation.hidden;
  const v = () => clamp(Math.round(rng.normal(mean, sd)), 1, 20);
  return {
    professionalism: v(),
    ambition: v(),
    loyalty: v(),
    temperament: v(),
    injuryProneness: v(),
    consistency: v(),
  };
}

export function generateTraits(rng: Rng, species: SpeciesDef, cfg: GameConfig): string[] {
  const weights = cfg.generation.traitCountWeights;
  const count = rng.weighted([0, 1, 2, 3], (n) => weights[n] ?? 0);
  const chosen: string[] = [];
  const all = Object.keys(TRAITS);
  for (let i = 0; i < count; i++) {
    const available = all.filter(
      (t) =>
        !chosen.includes(t) &&
        !chosen.some((c) => TRAITS[c]!.excludes?.includes(t) || TRAITS[t]!.excludes?.includes(c)),
    );
    if (!available.length) break;
    chosen.push(rng.weighted(available, (t) => species.traitWeights?.[t] ?? 1));
  }
  return chosen;
}

export function generateCreature(
  rng: Rng,
  opts: GenerateCreatureOptions = {},
  cfg: GameConfig = DEFAULT_CONFIG,
): Creature {
  const g = cfg.generation;
  const species = opts.speciesId ? SPECIES[opts.speciesId] : pickSpecies(rng);
  if (!species) throw new Error(`Unknown species ${opts.speciesId}`);
  const quality = g.qualities[opts.quality ?? 'professional'];
  const potential = clamp(
    Math.round(opts.potential ?? rng.normal(quality.potentialMean, quality.potentialSd)),
    g.minAbility,
    g.maxAbility,
  );
  const lc = species.lifeCurve;
  const age = opts.age ?? rng.int(lc.minAge, Math.round(lc.minAge + (lc.maxAge - lc.minAge) * g.ageSpanMax));
  const ability = clamp(Math.round(potential * ageAbilityFactor(species, age, cfg)), g.minAbility, potential);
  const c = g.condition;
  return {
    id: makeId(rng, 'cr'),
    name: generateName(rng, species.nameCulture),
    speciesId: species.id,
    age,
    attributes: generateAttributes(rng, species, ability, cfg),
    hidden: generateHidden(rng, cfg),
    ability,
    potential,
    traits: generateTraits(rng, species, cfg),
    condition: {
      fatigue: 0,
      form: clamp(Math.round(rng.normal(c.formMean, c.formSd)), 1, 20),
      morale: clamp(Math.round(rng.normal(c.moraleMean, c.moraleSd)), 0, 100),
      injuries: [],
    },
    relations: {},
    stableId: opts.stableId ?? null,
  };
}
