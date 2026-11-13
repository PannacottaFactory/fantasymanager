import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_CATEGORIES } from '../src/data/attributes.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { newGame, playMatchday, playerTeam } from '../src/engine/league/season.ts';
import { jackpotChance, runSession, sessionPool, sessionsLeft, sessionsPerMatch } from '../src/engine/progression/sessions.ts';
import { programCategory, setPlan } from '../src/engine/progression/training.ts';

const game = () => newGame({ seed: 'sessions', teamName: 'Me', lang: 'en' });

describe('training sessions', () => {
  it('a new game starts with one session; it draws a creature and an attribute of its program', () => {
    let g = game();
    expect(sessionsLeft(g)).toBe(1);
    // Everyone trains combat: the drawn attribute must be a combat one.
    g = setPlan(g, playerTeam(g).creatures.map((c) => c.id), { program: 'combat' });
    const pool = new Set(sessionPool(g).map((c) => c.id));
    const { state, outcome } = runSession(g);
    expect(outcome.kind).toBe('trained');
    if (outcome.kind !== 'trained') return;
    const { creatureId, attr, d, from, category } = outcome.result;
    expect(pool.has(creatureId)).toBe(true);
    expect(category).toBe('combat');
    expect(ATTRIBUTE_CATEGORIES.combat).toContain(attr);
    expect(playerTeam(state).creatures.find((c) => c.id === creatureId)!.attributes[attr]).toBe(from + d);
    // The original state is untouched; the same state always draws the same.
    expect(playerTeam(g).creatures.find((c) => c.id === creatureId)!.attributes[attr]).toBe(from);
    expect(runSession(g).outcome).toEqual(outcome);
    expect(sessionsLeft(state)).toBe(0);
    expect(runSession(state).outcome.kind).toBe('error');
  });

  it('each match played earns sessions, kept up to a few', () => {
    let g = runSession(game()).state;
    expect(sessionsLeft(g)).toBe(0);
    for (let i = 0; i < 8; i++) g = playMatchday(g);
    expect(sessionsLeft(g)).toBeGreaterThanOrEqual(sessionsPerMatch(g, g.playerTeamId));
    expect(sessionsLeft(g)).toBeLessThanOrEqual(DEFAULT_CONFIG.training.sessions.maxStored);
  });

  it('a better coach raises the chance of a +2; by default creatures train what their role needs most', () => {
    const g = game();
    const staff = g.staff[g.playerTeamId]!;
    const low = structuredClone(g);
    low.staff[g.playerTeamId] = { ...staff, combat: { ...staff.combat!, quality: 2 } };
    const high = structuredClone(g);
    high.staff[g.playerTeamId] = { ...staff, combat: { ...staff.combat!, quality: 19 } };
    expect(jackpotChance(high, g.playerTeamId, 'combat')).toBeGreaterThan(jackpotChance(low, g.playerTeamId, 'combat'));
    for (const c of playerTeam(g).creatures) expect(['physical', 'combat', 'mental']).toContain(programCategory(g, c));
  });
});
