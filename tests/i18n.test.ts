import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { ATTRIBUTE_KEYS } from '../src/data/attributes.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { INJURIES } from '../src/data/injuries.ts';
import { SPECIES_IDS } from '../src/data/species.ts';
import { TRAITS } from '../src/data/traits.ts';
import { NAME_CULTURES } from '../src/data/names.ts';
import { FR_ABILITIES, FR_ATTRIBUTES, FR_EFFECTS, FR_INJURIES, FR_SPECIES, FR_SURNAMES, FR_TRAITS } from '../src/data/i18n/fr.ts';
import { COMMENTARY } from '../src/data/text/commentary.ts';
import { COMMENTARY_FR } from '../src/data/text/commentary.fr.ts';
import { ASSISTANT_REMARKS } from '../src/data/text/report.ts';
import { ASSISTANT_REMARKS_FR } from '../src/data/text/report.fr.ts';
import { Commentator } from '../src/engine/commentary/commentator.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { buildReport } from '../src/engine/report/report.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';

/** French contractions/elisions that a template + creature name must never produce. */
const BAD_FRENCH = [/(?<!\p{L})(de|à) (le|les)(?!\p{L})/iu, /(?<!\p{L})(de|que|le|la|ne|se|je) [aeiouyéèêâîô]/iu, /\s[,.]/];

function match(i: number) {
  const rng = new Rng(deriveSeed('i18n', i));
  return simulateMatch({ seed: i, teams: [generateTeam(rng, { lang: 'fr' }), generateTeam(rng, { lang: 'fr' })] });
}

describe('French data', () => {
  it('translates every id', () => {
    for (const id of SPECIES_IDS) expect(FR_SPECIES[id], id).toBeDefined();
    for (const id of Object.keys(ABILITIES)) expect(FR_ABILITIES[id], id).toBeDefined();
    for (const id of Object.keys(EFFECTS)) expect(FR_EFFECTS[id], id).toBeDefined();
    for (const id of Object.keys(TRAITS)) expect(FR_TRAITS[id], id).toBeDefined();
    for (const id of Object.keys(INJURIES)) expect(FR_INJURIES[id], id).toBeDefined();
    for (const k of ATTRIBUTE_KEYS) expect(FR_ATTRIBUTES[k], k).toBeDefined();
    for (const [id, c] of Object.entries(NAME_CULTURES)) {
      if (c.surnames) expect(FR_SURNAMES[id]?.length, id).toBe(c.surnames.length);
    }
  });

  it('ability verbs never end with a preposition needing elision', () => {
    for (const a of Object.values(FR_ABILITIES)) expect(a.verb, a.verb).not.toMatch(/\s(de|à|du|des|au)$/);
  });

  it('has the same commentary keys and tags as English', () => {
    expect(Object.keys(COMMENTARY_FR).sort()).toEqual(Object.keys(COMMENTARY).sort());
    for (const [key, list] of Object.entries(COMMENTARY)) {
      const tagsEn = new Set(list.map((t) => t[0]));
      const tagsFr = new Set(COMMENTARY_FR[key]!.map((t) => t[0]));
      for (const tag of tagsEn) expect(tagsFr.has(tag) || tagsFr.has(''), `${key} [${tag}]`).toBe(true);
    }
    expect(Object.keys(ASSISTANT_REMARKS_FR).sort()).toEqual(Object.keys(ASSISTANT_REMARKS).sort());
  });
});

describe('French commentary & report', () => {
  it('fills every placeholder and stays grammatical', () => {
    for (let i = 0; i < 40; i++) {
      const r = match(i);
      const lines = new Commentator(r.seed, r.roster, [r.teams[0].name, r.teams[1].name], DEFAULT_CONFIG, 'fr').narrateAll(r.events);
      expect(lines.length).toBeGreaterThan(20);
      for (const l of lines) {
        expect(l.text, l.text).not.toMatch(/\{\w+\}|undefined|NaN/);
        for (const re of BAD_FRENCH) expect(l.text, l.text).not.toMatch(re);
      }
      for (const side of [0, 1] as const) {
        const rep = buildReport(r, side, DEFAULT_CONFIG, 'fr');
        for (const t of [rep.headline, ...rep.remarks.map((x) => x.text), ...rep.keyMoments.map((m) => m.text)]) {
          expect(t, t).not.toMatch(/\{\w+\}|undefined|NaN/);
          for (const re of BAD_FRENCH) expect(t, t).not.toMatch(re);
        }
      }
    }
  });

  it('language never changes the match itself', () => {
    const rngA = new Rng('lang-check');
    const rngB = new Rng('lang-check');
    const a = [generateTeam(rngA, { lang: 'en' }), generateTeam(rngA, { lang: 'en' })] as const;
    const b = [generateTeam(rngB, { lang: 'fr' }), generateTeam(rngB, { lang: 'fr' })] as const;
    expect(b[0].creatures.map((c) => c.attributes)).toEqual(a[0].creatures.map((c) => c.attributes));
    const ra = simulateMatch({ seed: 7, teams: [a[0], a[1]] });
    const rb = simulateMatch({ seed: 7, teams: [b[0], b[1]] });
    expect(rb.outcome).toEqual(ra.outcome);
  });

  it('commentary lines carry who acts on whom', () => {
    const r = match(99);
    const lines = new Commentator(r.seed, r.roster, [r.teams[0].name, r.teams[1].name], DEFAULT_CONFIG, 'fr').narrateAll(r.events);
    const attacks = lines.filter((l) => l.kind === 'attack');
    expect(attacks.length).toBeGreaterThan(0);
    for (const l of attacks) {
      expect(r.roster[l.actor!]).toBeDefined();
      expect(r.roster[l.target!]).toBeDefined();
    }
  });
});
