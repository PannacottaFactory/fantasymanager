import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { sendScout } from '../src/engine/economy/actions.ts';
import { locate, weeklyScouting } from '../src/engine/economy/market.ts';
import { knowledgeOf, scoutVerdict } from '../src/engine/economy/scouting.ts';
import { creatureValue } from '../src/engine/economy/value.ts';
import { newGame, playerTeam, playMatchday } from '../src/engine/league/season.ts';
import type { GameState } from '../src/engine/league/types.ts';

const S = DEFAULT_CONFIG.economy.scouting;
const game = (seed = 'scouts') => newGame({ seed, teamName: 'Test', lang: 'en' });
const aiCreature = (g: GameState) => g.teams.find((t) => t.id !== g.playerTeamId)!.creatures[0]!;

describe('scouts', () => {
  it('refuses a scout on an own creature or one already well known, and when every scout is out', () => {
    const g = game();
    expect(sendScout(g, 'creature', playerTeam(g).creatures[0]!.id).outcome).toEqual({ kind: 'error', error: 'notFound' });
    const c = aiCreature(g);
    const known = structuredClone(g);
    known.scouting.knowledge[c.id] = S.creatureKnowledge;
    expect(sendScout(known, 'creature', c.id).outcome).toEqual({ kind: 'error', error: 'known' });
    let busy = g;
    const others = g.teams.filter((t) => t.id !== g.playerTeamId).flatMap((t) => t.creatures);
    for (let i = 0; i < S.scouts; i++) busy = sendScout(busy, 'creature', others[i]!.id).state;
    expect(busy.scouting.missions).toHaveLength(S.scouts);
    expect(sendScout(busy, 'creature', others[S.scouts]!.id).outcome).toEqual({ kind: 'error', error: 'busy' });
  });

  it('the report carries the knowledge before and a verdict from the estimates', () => {
    let g = game();
    const c = aiCreature(g);
    g = sendScout(g, 'creature', c.id).state;
    const md = g.matchday;
    while (g.matchday < md + S.creatureWeeks) g = playMatchday(g);
    const m = g.inbox.find((x) => x.kind === 'scoutReport' && x.targetId === c.id);
    expect(m?.kind).toBe('scoutReport');
    if (m?.kind !== 'scoutReport') return;
    expect(m.before).toBeLessThan(knowledgeOf(g, c.id));
    expect(['gem', 'star', 'good', 'below']).toContain(m.verdict);
    expect(m.verdict).toBe(scoutVerdict(g, locate(g, c.id)!.creature, knowledgeOf(g, c.id)));
  });

  it('verdicts: a creature far above the squad is at least a star; one far below is below', () => {
    const g = game();
    const c = structuredClone(aiCreature(g));
    expect(['gem', 'star']).toContain(scoutVerdict(g, { ...c, ability: 150, potential: 195, age: 3 }, 90));
    expect(scoutVerdict(g, { ...c, ability: 20, potential: 22 }, 90)).toBe('below');
  });

  it('a gem stays quiet for a few weeks, then the world notices it (price up), then forgets it', () => {
    const g = game();
    const c = aiCreature(g);
    const base = creatureValue(c);
    g.scouting.gems = [{ creatureId: c.id, phase: 'quiet', weeksLeft: S.gem.quietWeeks }];
    for (let i = 0; i < S.gem.quietWeeks - 1; i++) weeklyScouting(g, []);
    expect(locate(g, c.id)!.creature.hype).toBeUndefined();
    weeklyScouting(g, []);
    const hyped = locate(g, c.id)!.creature;
    expect(hyped.hype).toBe(S.gem.hype);
    expect(creatureValue(hyped)).toBeGreaterThan(base);
    expect(g.inbox.some((m) => m.kind === 'gemNoticed' && m.creatureId === c.id)).toBe(true);
    for (let i = 0; i < S.gem.hypeWeeks; i++) weeklyScouting(g, []);
    expect(locate(g, c.id)!.creature.hype).toBeUndefined();
    expect(g.scouting.gems).toHaveLength(0);
  });

  it('a gem signed during its quiet weeks is never hyped', () => {
    const g = game();
    const mine = playerTeam(g).creatures[0]!;
    g.scouting.gems = [{ creatureId: mine.id, phase: 'quiet', weeksLeft: 1 }];
    weeklyScouting(g, []);
    expect(mine.hype).toBeUndefined();
    expect(g.scouting.gems).toHaveLength(0);
  });
});
