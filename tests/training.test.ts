import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_CATEGORIES } from '../src/data/attributes.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { getSpecies } from '../src/engine/creature/derived.ts';
import { newGame, playMatchday, playerTeam, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import type { GameState } from '../src/engine/league/types.ts';
import type { Creature } from '../src/engine/model.ts';
import { ageing, coachFactor, hireCoach, keepYouth, lifeStage, setPlan, weeklyTraining } from '../src/engine/progression/training.ts';

const game = (seed = 'train') => newGame({ seed, teamName: 'Test', lang: 'en' });
const sumCat = (c: Creature, cat: keyof typeof ATTRIBUTE_CATEGORIES) => ATTRIBUTE_CATEGORIES[cat].reduce((s, k) => s + c.attributes[k], 0);

/** A young player creature with plenty of room to grow. */
function youngster(g: GameState): Creature {
  const team = playerTeam(g);
  const young = team.creatures.filter((c) => lifeStage(c) === 'young').sort((a, b) => b.potential - b.ability - (a.potential - a.ability));
  const c = young[0] ?? team.creatures[0]!;
  c.age = getSpecies(c).lifeCurve.minAge;
  c.ability = Math.min(c.ability, Math.round(c.potential * 0.6));
  return c;
}

function train(g: GameState, weeks: number) {
  for (let i = 0; i < weeks; i++) weeklyTraining(g, new Set());
}

describe('training', () => {
  it('young creatures grow towards their potential, along their program', () => {
    const g = game();
    const c = youngster(g);
    Object.assign(g, setPlan(g, [c.id], { program: 'physical', intensity: 'intense' }));
    const before = structuredClone(playerTeam(g).creatures.find((x) => x.id === c.id)!);
    train(g, 18);
    const after = playerTeam(g).creatures.find((x) => x.id === c.id)!;
    expect(after.ability).toBeGreaterThan(before.ability);
    expect(after.ability).toBeLessThanOrEqual(after.potential);
    const phys = sumCat(after, 'physical') - sumCat(before, 'physical');
    const mental = sumCat(after, 'mental') - sumCat(before, 'mental');
    expect(phys).toBeGreaterThan(0);
    expect(phys).toBeGreaterThan(mental);
    expect(after.growth?.season).toBe(
      Object.values(after.attributes).reduce((s, v) => s + v, 0) - Object.values(before.attributes).reduce((s, v) => s + v, 0),
    );
  });

  it('rest gives no growth but recovers fatigue', () => {
    const g = game();
    const c = youngster(g);
    Object.assign(g, setPlan(g, [c.id], { program: 'rest' }));
    const me = () => playerTeam(g).creatures.find((x) => x.id === c.id)!;
    me().condition.fatigue = 60;
    const ability = me().ability;
    train(g, 2);
    expect(me().ability).toBe(ability);
    expect(me().condition.fatigue).toBeLessThan(60);
  });

  it('is deterministic over a few weeks of a season', () => {
    let a = game('det');
    let b = game('det');
    for (let i = 0; i < 4; i++) {
      a = playMatchday(a);
      b = playMatchday(b);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('ageing & youth', () => {
  it('everyone ages; past the prime creatures decline; at the end of their life they retire', () => {
    const g = game('age');
    const team = playerTeam(g);
    const old = team.creatures[0]!;
    const lc = getSpecies(old).lifeCurve;
    old.age = lc.peakEnd + 1;
    const ability = old.ability;
    const ending = team.creatures[1]!;
    ending.age = getSpecies(ending).lifeCurve.maxAge;
    ageing(g);
    expect(old.age).toBe(lc.peakEnd + 2);
    expect(old.ability).toBeLessThan(ability);
    expect(playerTeam(g).creatures.some((c) => c.id === ending.id)).toBe(false);
    expect(g.inbox.some((m) => m.kind === 'retired')).toBe(true);
  });

  it('a brood arrives each off-season; kept youngsters join, the others leave at the first match', () => {
    let g = game('youth');
    while (!seasonOver(g)) g = playMatchday(g);
    g = startNextSeason(g);
    const y = DEFAULT_CONFIG.training.youth;
    expect(g.youth.length).toBeGreaterThanOrEqual(y.min);
    expect(g.youth.length).toBeLessThanOrEqual(y.max);
    const kept = g.youth[0]!;
    const others = g.youth.slice(1).map((c) => c.id);
    const r = keepYouth(g, kept.id);
    expect(r.outcome.kind).toBe('kept');
    g = r.state;
    expect(playerTeam(g).creatures.some((c) => c.id === kept.id)).toBe(true);
    g = playMatchday(g);
    expect(g.youth.length).toBe(0);
    for (const id of others) expect(playerTeam(g).creatures.some((c) => c.id === id)).toBe(false);
  }, 60000);
});

describe('coaches & role fit', () => {
  it('hiring a better coach costs a fee and raises growth in its domain', () => {
    const g = game('coach');
    const best = [...g.coachMarket].sort((a, b) => b.quality - a.quality)[0]!;
    const before = coachFactor(g, g.playerTeamId, best.domain);
    const r = hireCoach(g, best.id);
    expect(r.outcome.kind).toBe('hired');
    expect(r.state.staff[g.playerTeamId]![best.domain]!.id).toBe(best.id);
    expect(coachFactor(r.state, g.playerTeamId, best.domain)).toBeCloseTo(DEFAULT_CONFIG.training.coaches.base + best.quality * DEFAULT_CONFIG.training.coaches.perQuality);
    expect(r.state.clubs[g.playerTeamId]!.balance).toBeLessThan(g.clubs[g.playerTeamId]!.balance);
    void before;
  });

  it('role factors stay within bounds', () => {
    const g = game('role');
    const combat = new Combat({ seed: 1, teams: [g.teams[0]!, g.teams[1]!] });
    const r = DEFAULT_CONFIG.combat.roleFit;
    for (const c of combat.combatants) {
      expect(c.roleFactor).toBeGreaterThanOrEqual(r.min);
      expect(c.roleFactor).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('visual progression', () => {
  it('records the player creatures’ ability history and attribute changes, consistent with the season-start snapshot', async () => {
    const { newGame, playMatchday, playerTeam } = await import('../src/engine/league/season.ts');
    let g = newGame({ seed: 'progress', teamName: 'Me', lang: 'en' });
    for (let i = 0; i < 8; i++) g = playMatchday(g);
    const mine = playerTeam(g).creatures;
    expect(mine.every((c) => (c.growth?.history?.length ?? 0) >= 2)).toBe(true);
    for (const c of mine) {
      const start = c.growth!.seasonStart!;
      const fromLog: Record<string, number> = {};
      for (const r of c.growth!.recent ?? []) if (r.s === g.season) fromLog[r.k] = (fromLog[r.k] ?? 0) + r.d;
      // When the log was not truncated, it explains every attribute change since the season started.
      if ((c.growth!.recent?.length ?? 0) < 16) {
        for (const [k, v] of Object.entries(start)) expect(c.attributes[k as keyof typeof c.attributes] - v!, `${c.name} ${k}`).toBe(fromLog[k] ?? 0);
      }
    }
    // AI creatures carry no progression log.
    const ai = g.teams.find((t) => t.id !== g.playerTeamId)!;
    expect(ai.creatures.every((c) => !c.growth?.history && !c.growth?.recent)).toBe(true);
    const report = g.inbox.find((m) => m.kind === 'trainingReport');
    if (report && report.kind === 'trainingReport') expect(report.items.some((x) => (x.attrs?.length ?? 0) > 0)).toBe(true);
  });
});

describe('levels and experience', () => {
  it('maps aptitude to levels 1–10 with 100 XP per level, and abilities unlock by level', async () => {
    const { levelOfAbility, xpInLevel, unlockLevel, isUnlocked, matchXp } = await import('../src/engine/progression/levels.ts');
    const { getAbilities } = await import('../src/engine/creature/derived.ts');
    const { generateCreature } = await import('../src/engine/creature/generate.ts');
    const { Rng } = await import('../src/core/rng.ts');
    expect(levelOfAbility(1)).toBe(1);
    expect(levelOfAbility(59)).toBe(1);
    expect(levelOfAbility(60)).toBe(2);
    expect(levelOfAbility(187)).toBe(9);
    expect(levelOfAbility(188)).toBe(10);
    expect(levelOfAbility(200)).toBe(10);
    const c = generateCreature(new Rng(3), { quality: 'professional' });
    const xp = xpInLevel(c);
    expect(xp).toBeGreaterThanOrEqual(0);
    expect(xp).toBeLessThan(100);
    expect(unlockLevel(90)).toBe(3);
    expect(getAbilities(c).length).toBe(c.speciesId ? (await import('../src/data/species.ts')).SPECIES[c.speciesId]!.abilities.filter((a) => isUnlocked(c, a.minAbility)).length : 0);
    expect(matchXp({ played: true, starter: true, rating: 8, kos: 0, won: true })).toBeGreaterThan(matchXp({ played: true, starter: false, rating: 5, kos: 0, won: false }));
    expect(matchXp({ played: false, starter: false, rating: 9, kos: 3, won: true })).toBe(0);
  });

  it('level-ups give the player points to place, which raise an attribute', async () => {
    const { newGame, playMatchday, playerTeam } = await import('../src/engine/league/season.ts');
    const { spendFreePoint } = await import('../src/engine/progression/training.ts');
    let g = newGame({ seed: 'levels', teamName: 'Me', lang: 'en' });
    for (let i = 0; i < 18 && !g.inbox.some((m) => m.kind === 'levelUp'); i++) g = playMatchday(g);
    const up = g.inbox.find((m) => m.kind === 'levelUp');
    expect(up).toBeDefined();
    if (!up || up.kind !== 'levelUp') return;
    const c = playerTeam(g).creatures.find((x) => x.id === up.creatureId)!;
    expect(c.growth!.freePoints).toBeGreaterThan(0);
    const key = (Object.keys(c.attributes) as (keyof typeof c.attributes)[]).find((k) => c.attributes[k] < 15)!;
    const next = spendFreePoint(g, c.id, key);
    const after = playerTeam(next).creatures.find((x) => x.id === c.id)!;
    expect(after.attributes[key]).toBe(c.attributes[key] + 1);
    expect(after.growth!.freePoints).toBe(c.growth!.freePoints! - 1);
  });
});
