import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { PLAY_STYLES } from '../src/data/config/identity.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { aiBreakDecision } from '../src/engine/combat/decisions.ts';
import { aiPrepare, newGame, playMatchday } from '../src/engine/league/season.ts';
import { migrateGame } from '../src/engine/league/migrate.ts';
import { counterTarget } from '../src/engine/team/identity.ts';
import { SPECIES } from '../src/data/species.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { ascendancyMult, counterApproach, coverMult, roleDamageFactor } from '../src/engine/combat/formulas.ts';

describe('AI stable identities', () => {
  it('style data only names existing species and abilities', () => {
    for (const [id, s] of Object.entries(PLAY_STYLES)) {
      for (const sp of s.species) expect(SPECIES[sp], `${id}: ${sp}`).toBeDefined();
      for (const ab of s.abilities) expect(ABILITIES[ab], `${id}: ${ab}`).toBeDefined();
    }
  });

  it('every AI stable gets a style and a manager, with varied styles; the player none', () => {
    const g = newGame({ seed: 'identities', teamName: 'Me', lang: 'en' });
    const ai = g.teams.filter((t) => t.id !== g.playerTeamId);
    expect(ai.every((t) => t.identity)).toBe(true);
    expect(g.teams.find((t) => t.id === g.playerTeamId)!.identity).toBeUndefined();
    expect(new Set(ai.map((t) => t.identity!.style)).size).toBeGreaterThanOrEqual(15);
    expect(new Set(ai.map((t) => t.identity!.manager)).size).toBe(5);
    // Squads lean towards their style.
    const share = ai.map((t) => t.creatures.filter((c) => PLAY_STYLES[t.identity!.style].species.includes(c.speciesId)).length / t.creatures.length);
    expect(share.reduce((s, x) => s + x, 0) / share.length).toBeGreaterThan(0.3);
  });

  it('the difficulty changes the second division and the starting money', () => {
    const easy = newGame({ seed: 'diff', teamName: 'Me', lang: 'en', difficulty: 'easy' });
    const hard = newGame({ seed: 'diff', teamName: 'Me', lang: 'en', difficulty: 'hard' });
    expect(easy.difficulty).toBe('easy');
    expect(hard.clubs[hard.playerTeamId]!.balance).toBeLessThan(easy.clubs[easy.playerTeamId]!.balance);
    const avg = (g: typeof easy) => {
      const ids = g.divisions[1]!.filter((id) => id !== g.playerTeamId);
      const teams = g.teams.filter((t) => ids.includes(t.id));
      return teams.reduce((s, t) => s + t.creatures.reduce((x, c) => x + c.potential, 0) / t.creatures.length, 0) / teams.length;
    };
    expect(avg(hard)).toBeGreaterThan(avg(easy));
  });

  it('a manager who reads the game hunts the healers of a support-heavy line-up', () => {
    expect(counterTarget([{ role: 'support', ability: 100 }, { role: 'caster', ability: 100 }, { role: 'tank', ability: 100 }])).toBe('casters');
    expect(counterTarget([{ role: 'tank', ability: 160 }, { role: 'striker', ability: 100 }])).toBe('strongest');
    expect(counterTarget([{ role: 'tank', ability: 100 }, { role: 'striker', ability: 100 }])).toBe('weakest');
  });

  it('prepared AI tactics carry the manager style, which the break decisions use', () => {
    const g = newGame({ seed: 'manager', teamName: 'Me', lang: 'en', difficulty: 'hard' });
    const [a, b] = g.teams.filter((t) => t.id !== g.playerTeamId);
    const pa = aiPrepare(a!, DEFAULT_CONFIG, 'hard', b);
    const pb = aiPrepare(b!, DEFAULT_CONFIG, 'hard', a);
    expect(pa.tactic.ai?.reads).toBe(true);
    const m = DEFAULT_CONFIG.identity.managers[a!.identity!.manager];
    expect(pa.tactic.ai?.tiredBelow).toBe(m.tiredBelow);
    const c = new Combat({ seed: 1, teams: [pa, pb] });
    while (c.phase === 'running') c.advance();
    if (c.phase === 'break') expect(aiBreakDecision(c, 0).orders?.target).toBeDefined();
  });

  it('a phase-5 save (version 4) gains identities and the normal difficulty', () => {
    let g = newGame({ seed: 'old', teamName: 'Me', lang: 'en' });
    g = playMatchday(g);
    const raw = structuredClone(g) as unknown as Record<string, unknown>;
    raw.version = 4;
    delete raw.difficulty;
    for (const t of raw.teams as { identity?: unknown }[]) delete t.identity;
    const m = migrateGame(raw)!;
    expect(m.version).toBe(5);
    expect(m.difficulty).toBe('normal');
    expect(m.teams.filter((t) => t.id !== m.playerTeamId).every((t) => t.identity)).toBe(true);
    expect(playMatchday(m).matchday).toBe(m.matchday + 1);
  });
});

describe('levers', () => {
  it('stables differ in how much they stick to their style', () => {
    const g = newGame({ seed: 'focus', teamName: 'Me', lang: 'en' });
    const focus = new Set(g.teams.filter((t) => t.identity).map((t) => t.identity!.focus));
    expect(focus.size).toBeGreaterThanOrEqual(3);
  });

  it('cover protects the back line from ranged attacks while two creatures hold the front', () => {
    const cfg = DEFAULT_CONFIG;
    const back = { line: 'back' } as Parameters<typeof coverMult>[1];
    expect(coverMult('ranged', back, 2, cfg)).toBeCloseTo(1 - cfg.combat.cover.reduction);
    expect(coverMult('spell', back, 1, cfg)).toBe(1);
    expect(coverMult('melee', back, 3, cfg)).toBe(1);
  });

  it('a creature outside its natural roles deals less damage', () => {
    const g = newGame({ seed: 'roles', teamName: 'Me', lang: 'en' });
    const t = g.teams[0]!;
    const c = new Combat({ seed: 1, teams: [t, g.teams[1]!] });
    const a = c.active(0)[0]!;
    const natural = roleDamageFactor({ ...a, naturalRole: true }, 'melee', DEFAULT_CONFIG);
    expect(roleDamageFactor({ ...a, naturalRole: false }, 'melee', DEFAULT_CONFIG)).toBeCloseTo(natural * DEFAULT_CONFIG.combat.roleFit.offRole);
  });

  it('break decisions come back to the starting orders, not to "balanced"', () => {
    const g = newGame({ seed: 'orders', teamName: 'Me', lang: 'en' });
    const [a, b] = [g.teams[0]!, g.teams[1]!];
    const mine = { ...a, tactic: { ...a.tactic, orders: { aggression: 'cautious' as const, target: 'weakest' as const, risk: 'low' as const }, ai: undefined } };
    const c = new Combat({ seed: 3, teams: [mine, b] });
    c.advance();
    const d = aiBreakDecision(c, 0);
    if (d.orders && d.orders.aggression === mine.tactic.orders.aggression) expect(d.orders.target).toBe('weakest');
    expect(c.sides[0].baseOrders.aggression).toBe('cautious');
  });
});

describe('ascendancy between approaches', () => {
  it('cautious thwarts aggressive, aggressive overwhelms balanced, balanced wears down cautious', () => {
    const cfg = DEFAULT_CONFIG;
    const o = (aggression: 'cautious' | 'balanced' | 'aggressive') => ({ aggression, target: 'nearest' as const, risk: 'normal' as const });
    expect(ascendancyMult(o('cautious'), o('aggressive'), cfg)).toBeCloseTo(1 + cfg.combat.orders.ascendancy.bonus);
    expect(ascendancyMult(o('aggressive'), o('balanced'), cfg)).toBeGreaterThan(1);
    expect(ascendancyMult(o('balanced'), o('cautious'), cfg)).toBeGreaterThan(1);
    expect(ascendancyMult(o('aggressive'), o('cautious'), cfg)).toBe(1);
    expect(counterApproach('aggressive', cfg)).toBe('cautious');
    expect(counterApproach('balanced', cfg)).toBe('aggressive');
  });

  it('a reading manager picks the approach that has the upper hand on the opponent', () => {
    const g = newGame({ seed: 'asc', teamName: 'Me', lang: 'en', difficulty: 'hard' });
    const me = g.teams.find((t) => t.id === g.playerTeamId)!;
    const ai = g.teams.find((t) => t.id !== g.playerTeamId)!;
    const mine = { ...me, tactic: { ...me.tactic, orders: { ...me.tactic.orders, aggression: 'aggressive' as const } } };
    expect(aiPrepare(ai, DEFAULT_CONFIG, 'hard', mine).tactic.orders.aggression).toBe('cautious');
  });

  it('duplicate creature ids in one match are refused', () => {
    const g = newGame({ seed: 'dup', teamName: 'Me', lang: 'en' });
    const t = g.teams[0]!;
    expect(() => new Combat({ seed: 1, teams: [t, structuredClone(t)] })).toThrow(/Duplicate/);
  });
});
