import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { SPECIES } from '../src/data/species.ts';
import { equippedSkills, getAbilities, toggleSkill, unlockedSkills } from '../src/engine/creature/derived.ts';
import { generateCreature } from '../src/engine/creature/generate.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { aiBreakDecision } from '../src/engine/combat/decisions.ts';
import { elementMultiplier } from '../src/engine/combat/formulas.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { generateTeam, repairTactic, validateTactic } from '../src/engine/team/team.ts';
import type { MatchSetup } from '../src/engine/combat/types.ts';

function setup(seed: string | number, qa: 'novice' | 'professional' | 'elite' = 'professional', qb = qa): MatchSetup {
  const rng = new Rng(deriveSeed('teams', seed));
  return { seed, teams: [generateTeam(rng, { quality: qa }), generateTeam(rng, { quality: qb })] };
}

describe('combat determinism', () => {
  it('same seed and teams → identical event log', () => {
    const a = simulateMatch(setup(1));
    const b = simulateMatch(setup(1));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.outcome).toEqual(b.outcome);
  });

  it('different match seeds → different fights', () => {
    const s = setup(2);
    const a = simulateMatch(s);
    const b = simulateMatch({ ...s, seed: 'another' });
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });

  it('step-by-step with breaks matches simulateMatch', () => {
    const s = setup(3);
    const c = new Combat(s);
    while (c.phase !== 'ended') {
      c.advance();
      if (c.phase === 'break') {
        const d0 = aiBreakDecision(c, 0);
        const d1 = aiBreakDecision(c, 1);
        c.applyBreakDecision(0, d0);
        c.applyBreakDecision(1, d1);
        c.resume();
      }
    }
    expect(JSON.stringify(c.result().events)).toBe(JSON.stringify(simulateMatch(s).events));
  });

  it('replaying recorded decisions reproduces the match', () => {
    const s = setup(8);
    const original = simulateMatch(s);
    const c = new Combat(s);
    while (c.phase !== 'ended') {
      c.advance();
      if (c.phase === 'break') {
        for (const d of original.decisions.filter((x) => x.round === c.round)) c.applyBreakDecision(d.side, d.decision);
        c.resume();
      }
    }
    expect(c.result().outcome).toEqual(original.outcome);
  });
});

describe('combat rules', () => {
  it('always ends within the round limit with a valid outcome', () => {
    for (let i = 0; i < 60; i++) {
      const r = simulateMatch(setup(`end${i}`));
      expect(r.outcome.rounds).toBeLessThanOrEqual(DEFAULT_CONFIG.match.maxRounds);
      expect([0, 1]).toContain(r.outcome.winner);
      expect(r.events.at(-1)!.type).toBe('matchEnd');
      if (r.outcome.method === 'ko') {
        const last = r.events.filter((e) => e.type === 'roundEnd').at(-1)!;
        if (last.type !== 'roundEnd') throw new Error('no roundEnd');
        const loser = r.outcome.winner === 0 ? 1 : 0;
        const standing = last.snapshot.filter((s) => s.state === 'active' && r.roster[s.id]!.side === loser);
        expect(standing).toEqual([]);
      }
    }
  });

  it('HP and stamina stay within bounds', () => {
    for (let i = 0; i < 30; i++) {
      const r = simulateMatch(setup(`hp${i}`));
      for (const e of r.events) {
        if (e.type !== 'roundEnd') continue;
        for (const s of e.snapshot) {
          expect(s.hp).toBeGreaterThanOrEqual(0);
          expect(s.hp).toBeLessThanOrEqual(r.roster[s.id]!.maxHp);
          expect(s.stamina).toBeGreaterThanOrEqual(0);
          expect(s.stamina).toBeLessThanOrEqual(r.roster[s.id]!.maxStamina);
        }
      }
    }
  });

  it('a much stronger team wins most of the time', () => {
    let wins = 0;
    for (let i = 0; i < 80; i++) if (simulateMatch(setup(`str${i}`, 'elite', 'novice')).outcome.winner === 0) wins++;
    expect(wins / 80).toBeGreaterThan(0.9);
  });

  it('no structural side advantage', () => {
    let wins0 = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const s = setup(`side${i}`);
      if (simulateMatch(s).outcome.winner === 0) wins0++;
      if (simulateMatch({ ...s, teams: [s.teams[1], s.teams[0]] }).outcome.winner === 0) wins0++;
    }
    expect(wins0 / (2 * n)).toBeGreaterThan(0.45);
    expect(wins0 / (2 * n)).toBeLessThan(0.55);
  });

  it('enforces substitution limits and bench rules', () => {
    // A match where at least 4 creatures still stand at the first break.
    let c = new Combat(setup(4));
    c.advance();
    for (let s = 5; c.active(0).length < 4 || c.bench(0).length < 3; s++) {
      c = new Combat(setup(s));
      c.advance();
    }
    expect(c.phase).toBe('break');
    const bench = c.bench(0);
    const field = c.active(0);
    const standing = field.length;
    // Bringing on a creature that is not on the bench is refused.
    expect(c.applyBreakDecision(0, { substitutions: [{ outId: field[0]!.id, inId: field[1]!.id }] }).length).toBe(1);
    const errs = c.applyBreakDecision(0, {
      substitutions: [...bench.map((b, i) => ({ outId: field[i]!.id, inId: b.id })), { outId: field[3]!.id, inId: bench[0]!.id }],
    });
    expect(c.sides[0].subsUsed).toBe(DEFAULT_CONFIG.match.maxSubstitutions);
    expect(errs.length).toBeGreaterThan(0);
    expect(c.active(0).length).toBe(standing);
  });

  it('a substitute can come on in another role, line and order, and replays keep it', () => {
    const s = setup(6);
    const c = new Combat(s);
    c.advance();
    const out = c.active(0)[0]!;
    const inc = c.bench(0)[0]!;
    const role = inc.role === 'tank' ? 'caster' : 'tank';
    const line = out.line === 'front' ? 'back' : 'front';
    const stance = inc.stance === 'allOut' ? 'conserve' : 'allOut';
    const factor = inc.roleFactor;
    expect(c.applyBreakDecision(0, { substitutions: [{ outId: out.id, inId: inc.id, role, line, stance }] })).toEqual([]);
    expect(inc.role).toBe(role);
    expect(inc.line).toBe(line);
    expect(inc.stance).toBe(stance);
    expect(c.getRoster()[inc.id]!.role).toBe(role);
    expect(inc.roleFactor).not.toBe(factor);
    c.resume();
    while (c.phase !== 'ended') {
      c.advance();
      if (c.phase === 'break') c.resume();
    }
    const r = c.result();
    const again = new Combat(s);
    while (again.phase !== 'ended') {
      again.advance();
      if (again.phase === 'break') {
        for (const d of r.decisions.filter((x) => x.round === again.round)) again.applyBreakDecision(d.side, d.decision);
        again.resume();
      }
    }
    expect(JSON.stringify(again.result().events)).toBe(JSON.stringify(r.events));
  });

  it('cannot advance during a break', () => {
    const c = new Combat(setup(5));
    c.advance();
    expect(() => c.advance()).toThrow();
  });

  it('element chart applies', () => {
    const e = DEFAULT_CONFIG.elements;
    expect(elementMultiplier('water', ['fire'], DEFAULT_CONFIG)).toBe(e.strongMult);
    expect(elementMultiplier('fire', ['water'], DEFAULT_CONFIG)).toBe(e.weakMult);
    expect(elementMultiplier('physical', ['fire'], DEFAULT_CONFIG)).toBe(1);
    expect(elementMultiplier('water', ['fire', 'earth'], DEFAULT_CONFIG)).toBe(e.maxMult);
  });

  it('creatures get exhausted in some matches', () => {
    let exhausted = 0;
    for (let i = 0; i < 40; i++) exhausted += simulateMatch(setup(`ex${i}`)).events.filter((e) => e.type === 'exhausted').length;
    expect(exhausted).toBeGreaterThan(0);
  });

  it('pre-match fatigue lowers starting stamina', () => {
    const s = setup(6);
    const fresh = new Combat(s).active(0)[0]!;
    const tiredTeam = structuredClone(s.teams[0]);
    for (const c of tiredTeam.creatures) c.condition.fatigue = 100;
    const tired = new Combat({ ...s, teams: [tiredTeam, s.teams[1]] }).active(0)[0]!;
    expect(tired.stamina).toBeLessThan(fresh.stamina);
  });

  it('accepts config variants (balancing hook)', () => {
    const cfg = structuredClone(DEFAULT_CONFIG);
    cfg.match.maxRounds = 3;
    cfg.match.breakRounds = [];
    const r = simulateMatch(setup(7), { cfg });
    expect(r.outcome.rounds).toBeLessThanOrEqual(3);
  });
});

describe('equipped skills', () => {
  it('a creature fights with exactly its equipped skills (the basic attack only when chosen)', () => {
    const s = setup('skills');
    const team = s.teams[0];
    const c = team.creatures.find((x) => unlockedSkills(x).length >= 3)!;
    expect(c).toBeDefined();
    const open = unlockedSkills(c);
    const basic = SPECIES[c.speciesId]!.basic;
    const pick = [open[0]!, open[1]!];
    const kit = (skills: string[] | undefined) =>
      new Combat({ ...s, teams: [{ ...team, tactic: { ...team.tactic, skills: skills ? { [c.id]: skills } : {} } }, s.teams[1]] }).getRoster()[c.id]!.abilities;
    expect(kit([...pick, 'not-an-ability'])).toEqual(pick);
    expect(kit([basic[0]!, open[2]!])).toEqual([basic[0], open[2]]);
    // Not set up yet: its basic attack and its latest unlocked skill.
    expect(kit(undefined)).toEqual([basic[0], open[open.length - 1]]);
  });

  it('a skill that is not equipped is never used', () => {
    for (let i = 0; i < 10; i++) {
      const s = setup(`skills-${i}`);
      const r = simulateMatch(s);
      const roster = new Combat(s).getRoster();
      for (const e of r.events) if (e.type === 'spend' && e.ability) expect(roster[e.actor]!.abilities).toContain(e.ability);
    }
  });

  it('a creature without its basic attack still fights (it rests when nothing is ready)', () => {
    const s = setup('no-basic');
    const team = s.teams[0];
    const skills = Object.fromEntries(team.creatures.map((c) => [c.id, unlockedSkills(c).slice(-2)]));
    const r = simulateMatch({ ...s, teams: [{ ...team, tactic: { ...team.tactic, skills } }, s.teams[1]] });
    expect(r.outcome.rounds).toBeGreaterThan(0);
  });

  it('clicking toggles a skill: on, off, replaces the oldest when full; locked ones do nothing', () => {
    const c = generateCreature(new Rng(9), { speciesId: 'orc', potential: 180 });
    c.ability = 180;
    const [a, b, d] = SPECIES.orc!.skills;
    const basic = SPECIES.orc!.basic[0]!;
    expect(toggleSkill(c, [a!, b!], d!)).toEqual([b, d]);
    expect(toggleSkill(c, [a!, b!], a!)).toEqual([b]);
    expect(toggleSkill(c, [b!], b!)).toEqual([]);
    expect(toggleSkill(c, [], basic)).toEqual([basic]);
    // An empty choice stays empty (the match is refused) …
    expect(equippedSkills(c, [])).toEqual([]);
    const young = generateCreature(new Rng(9), { speciesId: 'orc', potential: 45 });
    young.ability = 30; // level 1: one skill
    expect(unlockedSkills(young)).toEqual([a]);
    expect(toggleSkill(young, [basic], SPECIES.orc!.skills[4]!)).toEqual([basic]);
    expect(getAbilities(young).map((x) => x.id)).toEqual([basic, a]);
    // … but a choice whose skills all got locked falls back on the default.
    expect(equippedSkills(young, [d!])).toEqual([basic, a]);
  });

  it('a creature that may fight without any skill blocks the match; the assistant gives it the default', () => {
    const s = setup('no-skill');
    const team = s.teams[0];
    const id = team.tactic.lineup[0]!.creatureId;
    const bad = { ...team, tactic: { ...team.tactic, skills: { [id]: [] } } };
    expect(validateTactic(bad)).toContainEqual({ code: 'noSkill', id });
    const fixed = repairTactic(bad);
    expect(validateTactic(fixed).some((i) => i.code === 'noSkill')).toBe(false);
  });

  it('the assistant fixes an over-filled editor: extra starters go to the bench, repeats leave', () => {
    const team = setup('over').teams[0];
    const t = team.tactic;
    const extra = t.bench[0]!;
    const over = {
      ...team,
      tactic: { ...t, lineup: [...t.lineup, { ...t.lineup[0]!, creatureId: extra }], bench: [...t.bench, t.bench[1]!, ...team.creatures.map((c) => c.id)] },
    };
    expect(validateTactic(over).length).toBeGreaterThan(0);
    const fixed = repairTactic(over);
    expect(validateTactic(fixed)).toEqual([]);
    expect(fixed.tactic.bench[0]).toBe(extra);
  });

  it('spend events keep the stamina gauge consistent', () => {
    const r = simulateMatch(setup('spend'));
    const spends = r.events.filter((e) => e.type === 'spend');
    expect(spends.length).toBeGreaterThan(20);
    for (const e of spends) if (e.type === 'spend') expect(e.stamina).toBeGreaterThanOrEqual(0);
  });
});

describe('bonds between stablemates', () => {
  it('a friend knocked out makes the other « avenging », with a commentary line naming both', async () => {
    const { Commentator } = await import('../src/engine/commentary/commentator.ts');
    let found = false;
    for (let s = 0; s < 40 && !found; s++) {
      const setup0 = setup(`bonds${s}`, 'novice', 'elite');
      // Everyone on our side is friends with everyone.
      const team = setup0.teams[0];
      for (const a of team.creatures) for (const b of team.creatures) if (a.id !== b.id) a.relations = { ...a.relations, [b.id]: 100 };
      const r = simulateMatch(setup0);
      const e = r.events.find((x) => x.type === 'enrage' && x.reason === 'friendKo');
      if (!e) continue;
      found = true;
      for (const lang of ['en', 'fr'] as const) {
        const lines = new Commentator(r.seed, r.roster, [r.teams[0].name, r.teams[1].name], DEFAULT_CONFIG, lang).narrateAll(r.events);
        for (const l of lines) expect(l.text).not.toMatch(/\{[a-zA-Z]+\}/);
      }
    }
    expect(found).toBe(true);
  });
});
