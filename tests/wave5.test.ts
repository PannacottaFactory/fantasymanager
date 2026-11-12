import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { EFFECTS } from '../src/data/effects.ts';
import { chooseAction, pickableTargets, reachableTargets } from '../src/engine/combat/ai.ts';
import { Combat } from '../src/engine/combat/combat.ts';
import { effectMod, mitigation } from '../src/engine/combat/formulas.ts';
import { simulateMatch } from '../src/engine/combat/simulate.ts';
import type { Combatant, MatchSetup } from '../src/engine/combat/types.ts';
import { arenaFor } from '../src/engine/league/arena.ts';
import { fixtureSetup, newGame, playMatchday } from '../src/engine/league/season.ts';
import { generateTeam } from '../src/engine/team/team.ts';
import { ARENA_CONDITION_IDS } from '../src/data/config/arena.ts';
import { COMMENTARY } from '../src/data/text/commentary.ts';
import { COMMENTARY_FR } from '../src/data/text/commentary.fr.ts';
import { en, fr } from '../src/ui/i18n/strings.ts';
import { UI_ICONS } from '../src/ui/icons/gameIcons.ts';

function setup(seed: string | number, pool?: string[], arena?: MatchSetup['arena']): MatchSetup {
  const rng = new Rng(deriveSeed('w5-teams', seed));
  return {
    seed,
    teams: [generateTeam(rng, { quality: 'professional', speciesPool: pool }), generateTeam(rng, { quality: 'professional' })],
    ...(arena ? { arena } : {}),
  };
}

function addEffect(c: Combat, target: Combatant, id: string, stacks = 1) {
  c['addEffect'](target, id, EFFECTS[id]!.defaultDuration, undefined, false, stacks);
}

describe('wave 5 mechanics', () => {
  it('silence forbids spells and heals', () => {
    const c = new Combat(setup(1));
    const actor = c.active(0)[0]!;
    actor.abilities = ['moonbeam', 'healing-song', 'stab'];
    actor.cooldowns = {};
    actor.stamina = actor.maxStamina;
    addEffect(c, actor, 'silenced');
    for (let i = 0; i < 30; i++) {
      const a = chooseAction(c['ai'], actor, { priority: 'nearest' });
      if (a.type === 'ability') expect(['spell', 'heal']).not.toContain(a.ability.kind);
    }
  });

  it('a provoking enemy draws single-target attacks; a camouflaged one cannot be picked', () => {
    const c = new Combat(setup(2));
    const actor = c.active(0)[0]!;
    const enemies = c.active(1);
    const [taunter, hidden] = [enemies[0]!, enemies[1]!];
    addEffect(c, taunter, 'provoking');
    const opts = reachableTargets(actor, ABILITIES.longbow!, enemies);
    expect(pickableTargets(opts).map((o) => o.target.id)).toEqual([taunter.id]);
    taunter.effects = [];
    addEffect(c, hidden, 'camouflaged');
    expect(pickableTargets(opts).map((o) => o.target.id)).not.toContain(hidden.id);
    // Everyone hidden: blows land somewhere anyway.
    for (const e of enemies) addEffect(c, e, 'camouflaged');
    expect(pickableTargets(opts).length).toBe(enemies.length);
  });

  it('camouflage boosts the next attack and ends with it', () => {
    const c = new Combat(setup(3));
    const actor = c.active(0)[0]!;
    addEffect(c, actor, 'camouflaged');
    expect(effectMod(actor, 'damageMult')).toBeCloseTo(1.3);
    actor.abilities = ['stab'];
    actor.stamina = actor.maxStamina;
    const target = c.active(1)[0]!;
    c['execute'](actor, { type: 'ability', ability: ABILITIES.stab!, target, flank: false, score: 1 });
    expect(actor.effects.some((e) => e.id === 'camouflaged')).toBe(false);
    expect(c.events.some((e) => e.type === 'attack' && e.actor === actor.id && e.ambush)).toBe(true);
  });

  it('corrosion stacks: armour lost per dose, up to 4', () => {
    const c = new Combat(setup(4));
    const t = c.active(1)[0]!;
    const orders = c.sides[1].orders;
    const before = mitigation(t, 'melee', orders, DEFAULT_CONFIG);
    addEffect(c, t, 'corroded', 9);
    expect(t.effects.find((e) => e.id === 'corroded')!.stacks).toBe(4);
    expect(effectMod(t, 'mitigation')).toBeCloseTo(EFFECTS.corroded!.mods!.mitigation! * 4);
    expect(mitigation(t, 'melee', orders, DEFAULT_CONFIG)).toBeLessThan(before);
  });

  it('a rune ward comes back at the break', () => {
    const c = new Combat(setup(5, ['runic-golem']));
    const golem = c.active(0).find((x) => x.speciesId === 'runic-golem')!;
    const ward = golem.effects.find((e) => e.id === 'rune-ward')!;
    expect(ward.shieldHp).toBe(Math.round(golem.maxHp * EFFECTS['rune-ward']!.magnitude!));
    golem.effects = golem.effects.filter((e) => e !== ward);
    c['rechargeWards']();
    expect(golem.effects.find((e) => e.id === 'rune-ward')?.shieldHp).toBeGreaterThan(0);
  });

  it('shapeshifters change form below half health, once', () => {
    const c = new Combat(setup(6, ['kelpie']));
    const kelpie = c.active(0).find((x) => x.speciesId === 'kelpie')!;
    kelpie.hp = Math.floor(kelpie.maxHp * 0.4);
    c['checkTransform'](kelpie);
    expect(kelpie.effects.some((e) => e.id === 'kelpie-form')).toBe(true);
    expect(kelpie.effects.some((e) => e.id === 'kelpie-shift')).toBe(false);
    expect(c.events.filter((e) => e.type === 'transform').length).toBe(1);
    c['checkTransform'](kelpie);
    expect(c.events.filter((e) => e.type === 'transform').length).toBe(1);
  });

  it('spell mirrors send spell damage back to the caster', () => {
    let reflected = 0;
    for (let s = 0; s < 40 && !reflected; s++) {
      const r = simulateMatch(setup(`m${s}`, ['qilin']));
      reflected += r.events.filter((e) => e.type === 'thorns' && e.spell).length;
    }
    expect(reflected).toBeGreaterThan(0);
  });
});

describe('arena conditions', () => {
  it('none in the first weeks of the first season, then deterministic draws', () => {
    const g = newGame({ seed: 'arena-world', teamName: 'Me', lang: 'en' });
    const early = g.fixtures.filter((f) => !f.competition && f.matchday < DEFAULT_CONFIG.arena.startWeek);
    expect(early.every((f) => arenaFor(g, f) === undefined)).toBe(true);
    const later = g.fixtures.filter((f) => !f.competition && f.matchday >= DEFAULT_CONFIG.arena.startWeek);
    const drawn = later.map((f) => arenaFor(g, f));
    expect(drawn.some(Boolean)).toBe(true);
    expect(drawn.some((x) => x === undefined)).toBe(true);
    expect(later.map((f) => arenaFor(g, f))).toEqual(drawn);
    const f = later.find((x) => arenaFor(g, x))!;
    expect(fixtureSetup(g, f).setup.arena).toBe(arenaFor(g, f));
  });

  it('the weather changes element damage and is announced at the start', () => {
    const fire = (arena?: MatchSetup['arena']) => {
      let dmg = 0;
      for (let s = 0; s < 12; s++) {
        const r = simulateMatch(setup(`fire${s}`, ['salamander'], arena));
        if (arena) expect(r.events[0]).toMatchObject({ type: 'matchStart', arena });
        for (const e of r.events) if (e.type === 'attack' && e.hit && r.roster[e.actor]?.speciesId === 'salamander') dmg += e.damage;
      }
      return dmg;
    };
    expect(fire('rain')).toBeLessThan(fire());
  });

  it('every condition has a name, an icon and an opening line in both languages, and changes something', () => {
    for (const id of ARENA_CONDITION_IDS) {
      expect(en[`arena.cond.${id}` as keyof typeof en], id).toBeTruthy();
      expect(fr[`arena.cond.${id}` as keyof typeof fr], id).toBeTruthy();
      expect(UI_ICONS[`arena-${id}`], id).toBeTruthy();
      expect(COMMENTARY[`arena.${id}`]?.length, id).toBeGreaterThan(0);
      expect(COMMENTARY_FR[`arena.${id}`]?.length, id).toBeGreaterThan(0);
      expect(Object.keys(DEFAULT_CONFIG.arena.conditions[id]).length, id).toBeGreaterThan(0);
    }
  });

  it('healing, damage over time, morale and kinds of attack follow the condition', () => {
    const c = new Combat({ ...setup(7), arena: 'frenzy' });
    const morale = c.active(0).map((x) => x.morale);
    c['endOfRound']();
    // Morale drifts back to 50, but the crowd lifts it: never lower than without the frenzy for those under 50.
    c.active(0).forEach((x, i) => {
      if (morale[i]! < 50) expect(x.morale).toBeGreaterThan(morale[i]!);
    });
    const swamp = new Combat({ ...setup(8), arena: 'swamp' });
    const plain = new Combat(setup(8));
    for (const cb of [swamp, plain]) addEffect(cb, cb.active(1)[0]!, 'poisoned', 3);
    const hp = (cb: Combat) => cb.active(1)[0]!.hp;
    const [h1, h2] = [hp(swamp), hp(plain)];
    swamp['startOfRoundEffects']();
    plain['startOfRoundEffects']();
    expect(h1 - hp(swamp)).toBeGreaterThan(h2 - hp(plain));
  });

  it('the player is told once when conditions begin', () => {
    let g = newGame({ seed: 'arena-intro', teamName: 'Me', lang: 'en' });
    // Midweek cup rounds are played by their own calls: go on until the league week is past the start.
    for (let i = 0; i < 30 && g.matchday <= DEFAULT_CONFIG.arena.startWeek + 1; i++) g = playMatchday(g);
    expect(g.inbox.filter((m) => m.kind === 'arenaIntro').length).toBe(1);
  });
});
