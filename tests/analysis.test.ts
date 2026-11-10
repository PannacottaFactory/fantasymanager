import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { analyzeMatch, DAMAGE_SOURCES } from '../src/engine/report/analysis.ts';
import { buildReport } from '../src/engine/report/report.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import { ANA_DICTS } from '../src/ui/i18n/analysis.ts';
import { useSettings } from '../src/ui/i18n/index.ts';
import * as Ana from '../src/ui/screens/arena/AnalysisPanel.tsx';

function match(i: number, pool?: string[]) {
  const rng = new Rng(deriveSeed('ana', i));
  return simulateMatch({ seed: i, teams: [generateTeam(rng, { quality: 'professional', speciesPool: pool }), generateTeam(rng, { quality: 'professional' })] });
}

describe('post-match analysis', () => {
  it('damage by source adds up to what the report counts', () => {
    for (let i = 0; i < 6; i++) {
      const r = match(i, i % 2 ? ['giant-spider', 'bramble-horror', 'hellhound', 'unicorn'] : undefined);
      const an = analyzeMatch(r, 0);
      const rep = buildReport(r, 0);
      for (const side of [0, 1] as const) {
        const s = an.sides[side];
        expect(DAMAGE_SOURCES.reduce((x, k) => x + s.sources[k], 0)).toBe(s.total);
        expect(s.total).toBe(rep.teams[side].damageDealt);
        expect(an.periods.reduce((x, p) => x + p.dealt[side], 0)).toBe(s.total);
      }
      expect(an.health.length).toBe(r.outcome.rounds);
    }
  });

  it('conclusions and labels exist in both languages with the same placeholders', () => {
    const holes = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [k, v] of Object.entries(ANA_DICTS.en)) expect(holes(ANA_DICTS.fr[k as keyof typeof ANA_DICTS.fr]), k).toEqual(holes(v));
  });

  it('every tab renders in both languages', () => {
    for (const lang of ['en', 'fr'] as const) {
      useSettings.setState({ lang });
      for (let i = 0; i < 4; i++) {
        const result = match(10 + i, i % 2 ? ['winter-wolf', 'hag', 'raptor'] : undefined);
        const analysis = analyzeMatch(result, 0);
        for (const C of [Ana.Summary, Ana.Sources, Ana.Flow, Ana.Periods, Ana.Duels, Ana.Turns]) {
          const html = renderToString(createElement(C as (p: object) => ReturnType<typeof createElement>, { analysis, result }));
          expect(html).not.toMatch(/\{\w+\}|undefined|NaN/);
        }
      }
    }
  });
});

