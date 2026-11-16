import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { applyEvent, initialView, judgesScore } from '../src/engine/combat/view.ts';
import type { MatchEvent } from '../src/engine/combat/types.ts';
import { generateTeam } from '../src/engine/team/team.ts';

describe('judges in the live view', () => {
  it('the live judges score built from the events ends on the engine score (substitutions, healing, KOs)', () => {
    for (let i = 0; i < 40; i++) {
      const rng = new Rng(deriveSeed('judges', i));
      const r = simulateMatch({ seed: i, teams: [generateTeam(rng, { quality: 'professional' }), generateTeam(rng, { quality: 'professional' })] });
      let view = initialView(r.roster);
      for (const e of r.events as MatchEvent[]) view = applyEvent(view, e);
      expect([judgesScore(view, 0), judgesScore(view, 1)]).toEqual(r.outcome.score);
    }
  });
});
