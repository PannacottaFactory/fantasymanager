import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { SPECIES } from '../src/data/species.ts';
import { chooseAction, pickableTargets, reachableTargets } from '../src/engine/combat/ai.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import { applyEvent, initialView } from '../src/engine/combat/view.ts';
import { Commentator } from '../src/engine/commentary/commentator.ts';
import type { Combatant, MatchEvent, MatchSetup } from '../src/engine/combat/types.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import { SPECIES_ICONS } from '../src/ui/icons/gameIcons.ts';

const WAVE6 = [
  'dwarf', 'gnome', 'siren', 'valkyrie', 'locust-swarm', 'rat-swarm', 'pixie', 'doppelganger', 'thunderbird', 'mimic',
  'rakshasa', 'lamassu', 'sandworm', 'sea-serpent', 'ettin', 'mandrake', 'giant-moth', 'poltergeist', 'sun-lion', 'jackal-warden',
];

function setup(seed: string | number, pool?: string[], pool2?: string[]): MatchSetup {
  const rng = new Rng(deriveSeed('w6-teams', seed));
  return {
    seed,
    teams: [generateTeam(rng, { quality: 'professional', speciesPool: pool }), generateTeam(rng, { quality: 'professional', speciesPool: pool2 })],
  };
}

function addEffect(c: Combat, target: Combatant, id: string, stacks = 1) {
  c['addEffect'](target, id, EFFECTS[id]!.defaultDuration, undefined, false, stacks);
}

function strike(c: Combat, actor: Combatant, ability: string, target: Combatant) {
  actor.stamina = actor.maxStamina;
  c['execute'](actor, { type: 'ability', ability: ABILITIES[ability]!, target, flank: false, score: 1 });
}

describe('wave 6 species', () => {
  it('twenty new species, each with a basic attack, five known skills and an icon', () => {
    for (const id of WAVE6) {
      const sp = SPECIES[id]!;
      expect(sp, id).toBeDefined();
      expect(sp.skills.length).toBe(5);
      for (const a of [...sp.basic, ...sp.skills]) expect(ABILITIES[a], `${id}: ${a}`).toBeDefined();
      for (const p of sp.passives ?? []) expect(EFFECTS[p], `${id}: ${p}`).toBeDefined();
      expect(SPECIES_ICONS[id], id).toBeDefined();
    }
  });

  it('matches between the new species end, and every event is narrated without a placeholder left', () => {
    for (let i = 0; i < 12; i++) {
      const s = setup(`mix-${i}`, WAVE6, WAVE6);
      const r = simulateMatch(s);
      expect(r.outcome.rounds).toBeGreaterThan(0);
      for (const lang of ['en', 'fr'] as const) {
        const lines = new Commentator(r.seed, r.roster, [s.teams[0].name, s.teams[1].name], undefined, lang).narrateAll(r.events);
        for (const l of lines) expect(l.text, l.text).not.toMatch(/\{\w+\}/);
      }
      // The view rebuilt from events agrees with the engine at the end.
      let view = initialView(r.roster);
      for (const e of r.events) view = applyEvent(view, e);
      expect(view.ended).toBe(true);
    }
  });
});

describe('wave 6 mechanics', () => {
  it('undying: the health cannot drop below 1', () => {
    const c = new Combat(setup(1));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'last-stand');
    t.hp = 3;
    const a = c.active(0)[0]!;
    for (let i = 0; i < 6 && t.hp > 0; i++) strike(c, a, 'crushing-blow', t);
    expect(t.state).toBe('active');
    expect(t.hp).toBeGreaterThanOrEqual(1);
    expect(c.events.some((e) => e.type === 'attack' && e.undying)).toBe(true);
  });

  it('charm: the charmed creature attacks one of its own allies on its turn, then comes to its senses', () => {
    const c = new Combat(setup(2));
    const actor = c.active(0)[0]!;
    addEffect(c, actor, 'charmed');
    actor.stamina = actor.maxStamina;
    actor.cooldowns = {};
    c['takeTurn'](actor);
    const hit = c.events.filter((e) => e.type === 'attack' && e.actor === actor.id);
    expect(hit.length).toBeGreaterThan(0);
    for (const e of hit) if (e.type === 'attack') expect(c.get(e.target).side).toBe(actor.side);
    expect(actor.effects.some((e) => e.id === 'charmed')).toBe(false);
  });

  it('swarm: less from single blows, more from area attacks', () => {
    const c = new Combat(setup(3));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'swarm-body');
    expect(EFFECTS['swarm-body']!.mods!.singleTaken).toBeLessThan(1);
    expect(EFFECTS['swarm-body']!.mods!.areaTaken).toBeGreaterThan(1);
  });

  it('time bomb: goes off when its count runs out, purifying defuses it', () => {
    const c = new Combat(setup(4));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'ticking-bomb');
    const hp = t.hp;
    for (let i = 0; i < 3; i++) c['endOfRound']();
    const blast = c.events.find((e) => e.type === 'effectTick' && e.effect === 'ticking-bomb');
    expect(blast).toBeDefined();
    expect(t.hp).toBe(hp - Math.round(t.maxHp * EFFECTS['ticking-bomb']!.detonate!));
    const u = c.active(1)[1]!;
    addEffect(c, u, 'ticking-bomb');
    c['cleanse'](c.active(1)[2]!, ABILITIES.embalm!, u);
    expect(u.effects.some((e) => e.id === 'ticking-bomb')).toBe(false);
  });

  it('mirror images: each takes one single-target blow; area attacks ignore them', () => {
    const c = new Combat(setup(5));
    const t = c.active(1)[0]!;
    addEffect(c, t, 'mirror-images', 2);
    const a = c.active(0)[0]!;
    const hp = t.hp;
    strike(c, a, 'stab', t);
    strike(c, a, 'stab', t);
    expect(t.hp).toBe(hp);
    expect(t.effects.some((e) => e.id === 'mirror-images')).toBe(false);
    expect(c.events.filter((e) => e.type === 'attack' && e.decoy).length).toBe(2);
  });

  it('chain: the blow leaps to other enemies, weaker each time', () => {
    const c = new Combat(setup(6));
    const a = c.active(0)[0]!;
    strike(c, a, 'forked-lightning', c.active(1)[0]!);
    const leaps = c.events.filter((e) => e.type === 'attack' && e.actor === a.id && e.chain);
    expect(leaps.length).toBe(2);
    expect(new Set(leaps.map((e) => (e.type === 'attack' ? e.target : ''))).size).toBe(2);
  });

  it('dispel removes beneficial effects; steal hands them over', () => {
    const c = new Combat(setup(7));
    const a = c.active(0)[0]!;
    const t = c.active(1)[0]!;
    addEffect(c, t, 'fortified');
    addEffect(c, t, 'rallied');
    a.abilities = ['steal-form'];
    for (let i = 0; i < 8 && t.effects.some((e) => e.id === 'fortified'); i++) strike(c, a, 'steal-form', t);
    const d = c.events.find((e) => e.type === 'dispel');
    expect(d).toBeDefined();
    expect(t.effects.some((e) => e.id === 'fortified' || e.id === 'rallied')).toBe(false);
    expect(a.effects.some((e) => e.id === 'fortified')).toBe(true);
  });

  it('riposte: a creature on guard strikes back at melee attackers', () => {
    const c = new Combat(setup(8));
    const t = c.active(1)[0]!;
    const a = c.active(0)[0]!;
    for (const g of c.active(1)) g.role = 'striker'; // no guard intercepts the blow
    t.effects.push({ id: 'parrying', remaining: 99 });
    EFFECTS.parrying!.mods!.riposte = 1;
    try {
      strike(c, a, 'stab', t);
      expect(c.events.some((e) => e.type === 'attack' && e.riposte && e.actor === t.id && e.target === a.id)).toBe(true);
      // One riposte per action, never a riposte to a riposte.
      expect(c.events.filter((e) => e.type === 'attack' && e.riposte).length).toBe(1);
    } finally {
      EFFECTS.parrying!.mods!.riposte = 0.65;
    }
  });

  it('burrowed: out of reach of single-target and area attacks', () => {
    const c = new Combat(setup(9));
    const a = c.active(0)[0]!;
    const enemies = c.active(1);
    const worm = enemies[0]!;
    addEffect(c, worm, 'burrowed');
    expect(pickableTargets(reachableTargets(a, ABILITIES.longbow!, enemies)).map((o) => o.target.id)).not.toContain(worm.id);
    const hp = worm.hp;
    strike(c, a, 'tidal-wave', enemies[1]!);
    expect(worm.hp).toBe(hp);
  });

  it('raise: a fallen ally gets back up before the break, not after', () => {
    const c = new Combat(setup(10));
    const healer = c.active(0)[0]!;
    const fallen = c.active(0)[1]!;
    c.round = 3;
    c['knockOut'](fallen);
    expect(fallen.state).toBe('ko');
    expect(c.canRaise(fallen, 0)).toBe(true);
    healer.abilities = ['raise-the-fallen'];
    healer.cooldowns = {};
    healer.stamina = healer.maxStamina;
    const action = chooseAction(c['ai'], healer, { priority: 'nearest', deterministic: true });
    expect(action.type === 'ability' && action.target?.id).toBe(fallen.id);
    c['execute'](healer, action);
    expect(fallen.state).toBe('active');
    expect(fallen.hp).toBe(Math.round(fallen.maxHp * ABILITIES['raise-the-fallen']!.raise!));
    const ev = c.events.find((e): e is Extract<MatchEvent, { type: 'revive' }> => e.type === 'revive' && e.target === fallen.id);
    expect(ev?.by).toBe(healer.id);
    // KO'd before the last break: carried off, beyond reach.
    const other = c.active(0)[2]!;
    c['knockOut'](other);
    c.round = 7;
    expect(c.canRaise(other, 0)).toBe(false);
  });

  it('two heads: stuns land half as often', () => {
    let plain = 0;
    let steady = 0;
    for (let i = 0; i < 400; i++) {
      const c = new Combat(setup(`st-${i % 4}`));
      const a = c.active(0)[0]!;
      const t = c.active(1)[0]!;
      if (i % 2) addEffect(c, t, 'two-heads');
      c['applyAbilityEffects'](a, ABILITIES.riddle!, t, 'target');
      const stunned = t.effects.some((e) => e.id === 'stunned');
      if (i % 2) steady += Number(stunned);
      else plain += Number(stunned);
    }
    expect(steady).toBeLessThan(plain * 0.7);
  });
});
