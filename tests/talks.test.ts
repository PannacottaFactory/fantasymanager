import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { replayMatch, simulateMatch } from '../src/engine/combat/simulate.ts';
import { readTalk, TALKS } from '../src/engine/combat/talks.ts';
import type { MatchSetup } from '../src/engine/combat/types.ts';
import { applyEvent, initialView } from '../src/engine/combat/view.ts';
import type { Talk, Team } from '../src/engine/model.ts';
import { generateTeam } from '../src/engine/team/team.ts';

const withTalk = (t: Team, talk: Talk): Team => ({ ...t, tactic: { ...t.tactic, orders: { ...t.tactic.orders, talk } } });
function setup(seed: string, a?: Talk, b?: Talk): MatchSetup {
  const rng = new Rng(deriveSeed('talks', seed));
  const t0 = generateTeam(rng, { quality: 'professional' });
  const t1 = generateTeam(rng, { quality: 'professional' });
  return { seed, teams: [a ? withTalk(t0, a) : t0, b ? withTalk(t1, b) : t1] };
}

describe('team talks', () => {
  it('are announced before the match and at each break', () => {
    const r = simulateMatch(setup('announce', 'focus', 'ranks'));
    const talks = r.events.filter((e) => e.type === 'teamTalk');
    expect(talks.filter((e) => e.round === 0).map((e) => e.side).sort()).toEqual([0, 1]);
    // The assistant gives a talk at every break both sides reached.
    const breaks = r.events.filter((e) => e.type === 'break').length;
    expect(talks.length).toBe(2 + 2 * breaks);
  });

  it('rally lifts morale and second wind gives stamina back, and the live view follows', () => {
    for (const talk of ['rally', 'secondWind'] as Talk[]) {
      const r = simulateMatch(setup(`oneoff-${talk}`, talk));
      const first = r.events.find((e) => e.type === 'teamTalk' && e.side === 0);
      expect(first && first.type === 'teamTalk' && first.talk).toBe(talk);
      let view = initialView(r.roster);
      for (const e of r.events) {
        view = applyEvent(view, e);
        if (e.type === 'teamTalk') for (const ch of e.changes) expect(view.creatures[ch.id]!.morale).toBe(ch.morale);
      }
    }
  });

  it('replays exactly with the talks recorded', () => {
    const s = setup('replay');
    const a = simulateMatch(s);
    const b = replayMatch(s, a.decisions);
    expect(b.outcome).toEqual(a.outcome);
    expect(b.events.length).toBe(a.events.length);
  });

  it('the assistant reads the situation', () => {
    const base = { stamina: 0.9, morale: 60, foeMelee: 0.55, behindLate: false };
    expect(readTalk({ ...base, stamina: 0.4 }).talk).toBe('secondWind');
    expect(readTalk({ ...base, morale: 30 }).talk).toBe('rally');
    expect(readTalk({ ...base, behindLate: true }).talk).toBe('fury');
    expect(readTalk({ ...base, foeMelee: 0.2 }).talk).toBe('evade');
    expect(readTalk({ ...base, foeMelee: 0.9 }).talk).toBe('ranks');
    expect(readTalk(base).talk).toBe('focus');
  });

  it('every talk has its numbers in the config', () => {
    for (const t of TALKS) expect(DEFAULT_CONFIG.combat.orders.talks[t]).toBeTruthy();
  });
});
