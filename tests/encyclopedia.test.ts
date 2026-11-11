import { describe, expect, it } from 'vitest';
import { ENC_DICTS } from '../src/ui/i18n/encyclopedia.ts';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ABILITIES } from '../src/data/abilities.ts';
import { ATTRIBUTE_KEYS } from '../src/data/attributes.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { INJURIES } from '../src/data/injuries.ts';
import { ROLES } from '../src/data/roles.ts';
import { SPECIES_IDS } from '../src/data/species.ts';
import { TRAITS } from '../src/data/traits.ts';
import { useSettings } from '../src/ui/i18n/index.ts';
import * as Enc from '../src/ui/screens/EncyclopediaScreen.tsx';

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('encyclopedia texts', () => {
  it('French and English use the same placeholders', () => {
    for (const [k, v] of Object.entries(ENC_DICTS.en)) {
      expect(holes(ENC_DICTS.fr[k as keyof typeof ENC_DICTS.fr]), k).toEqual(holes(v));
    }
  });
});


describe('encyclopedia pages', () => {
  it('every entry renders in both languages with every number filled in', () => {
    const go = () => {};
    for (const lang of ['en', 'fr'] as const) {
      useSettings.setState({ lang });
      const pages = [
        ...SPECIES_IDS.map((id) => createElement(Enc.SpeciesEntry, { id, go })),
        ...Object.keys(ABILITIES).map((id) => createElement(Enc.AbilityEntry, { id, go })),
        ...Object.keys(EFFECTS).map((id) => createElement(Enc.EffectEntry, { id, go })),
        ...Object.keys(TRAITS).map((id) => createElement(Enc.TraitEntry, { id, go })),
        ...(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((id) => createElement(Enc.RoleEntry, { id, go })),
        ...ATTRIBUTE_KEYS.map((id) => createElement(Enc.AttributeEntry, { id })),
        ...Object.keys(INJURIES).map((id) => createElement(Enc.InjuryEntry, { id })),
        ...Enc.RULES.map((id) => createElement(Enc.RuleEntry, { id })),
        createElement(Enc.ElementsChart),
      ];
      for (const p of pages) {
        const html = renderToString(p);
        expect(html, html.slice(0, 120)).not.toMatch(/\{\w+\}|undefined|NaN/);
      }
    }
  }, 30000);
});
