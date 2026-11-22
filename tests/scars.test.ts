import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from '../src/data/attributes.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { FR_SCARS } from '../src/data/i18n/fr.ts';
import { INJURIES } from '../src/data/injuries.ts';
import { SCARS } from '../src/data/scars.ts';
import { effectiveAttributes } from '../src/engine/combat/combat.ts';
import { newGame, playMatchday, seasonOver } from '../src/engine/league/season.ts';
import type { Creature } from '../src/engine/model.ts';
import { maybeScar, possibleScars } from '../src/engine/progression/scars.ts';

const sc = DEFAULT_CONFIG.scars;
const someCreature = (): Creature => structuredClone(newGame({ seed: 'scars', teamName: 'X', lang: 'en' }).teams[0]!.creatures[0]!);

describe('scars: data', () => {
  it('every scar comes from real injuries, has a malus and a counterpart, and a French text', () => {
    for (const s of Object.values(SCARS)) {
      expect(s.from.length, s.id).toBeGreaterThan(0);
      for (const i of s.from) expect(INJURIES[i], `${s.id} ← ${i}`).toBeDefined();
      const mods = Object.entries(s.attrMods);
      for (const [k] of mods) expect(ATTRIBUTE_KEYS as readonly string[], s.id).toContain(k);
      expect(mods.some(([, v]) => v! < 0), s.id).toBe(true);
      expect(mods.some(([, v]) => v! > 0), s.id).toBe(true);
      expect(FR_SCARS[s.id], s.id).toBeDefined();
    }
  });

  it('every injury that can scar has at least one scar to leave', () => {
    for (const inj of Object.values(INJURIES)) {
      if (sc.chance[inj.severity] > 0) expect(possibleScars({ scars: [] } as unknown as Creature, inj.id).length, inj.id).toBeGreaterThan(0);
    }
  });
});

describe('scars: when an injury heals', () => {
  it('a career-ending injury always leaves one of its scars, a minor one never does', () => {
    const c = someCreature();
    expect(maybeScar('w', 1, 3, c, 'bruises')).toBeNull();
    const s = maybeScar('w', 1, 3, c, 'crippling-wound');
    expect(s).not.toBeNull();
    expect(SCARS[s!.id]!.from).toContain('crippling-wound');
    expect(c.scars).toEqual([s]);
  });

  it('is deterministic, never repeats a scar and stops at the maximum', () => {
    const a = someCreature();
    const b = someCreature();
    expect(maybeScar('w', 2, 5, a, 'crippling-wound')).toEqual(maybeScar('w', 2, 5, b, 'crippling-wound'));
    const c = someCreature();
    for (let w = 0; w < 20; w++) maybeScar('w', 1, w, c, 'crippling-wound');
    const ids = (c.scars ?? []).map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(sc.max);
  });

  it('roughly matches the chance by severity', () => {
    let n = 0;
    for (let i = 0; i < 2000; i++) if (maybeScar('w', 1, i, someCreatureCached(), 'broken-limb')) n++;
    expect(n / 2000).toBeGreaterThan(sc.chance.severe - 0.05);
    expect(n / 2000).toBeLessThan(sc.chance.severe + 0.05);
  });

  it('changes the attributes used in combat', () => {
    const c = someCreature();
    c.traits = [];
    c.attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 10])) as Creature['attributes'];
    c.scars = [{ id: 'maimed', injuryId: 'crippling-wound', s: 1, w: 1 }];
    const a = effectiveAttributes(c);
    expect(a.strength).toBe(8);
    expect(a.speed).toBe(8);
    expect(a.determination).toBe(12);
  });
});

describe('scars: in a season', () => {
  it('scars appear over a season and the player is told about them', () => {
    let g = newGame({ seed: 'scar-season', teamName: 'X', lang: 'en' });
    let guard = 0;
    while (!seasonOver(g) && guard++ < 80) g = playMatchday(g);
    const scarred = g.teams.flatMap((t) => t.creatures).filter((c) => c.scars?.length);
    expect(scarred.length).toBeGreaterThan(0);
    for (const c of scarred) for (const s of c.scars!) expect(SCARS[s.id]!.from).toContain(s.injuryId);
    const mine = g.teams.find((t) => t.id === g.playerTeamId)!.creatures;
    for (const m of g.inbox) {
      if (m.kind !== 'scar') continue;
      const c = mine.find((x) => x.id === m.creatureId);
      if (c) expect(c.scars?.some((s) => s.id === m.scarId && s.injuryId === m.injuryId)).toBe(true);
    }  });
});

let cached: Creature | null = null;
/** A fresh copy each time (scars accumulate otherwise), without rebuilding a world. */
function someCreatureCached(): Creature {
  cached ??= someCreature();
  return structuredClone({ ...cached, scars: [] });
}
