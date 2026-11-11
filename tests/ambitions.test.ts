import { describe, expect, it } from 'vitest';
import { AMBITION_IDS } from '../src/engine/club/ambitions.ts';
import { newGame, playMatchday, playerTeam, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import { dropOnCreature, dropOnto, insertInGroup, moveToZone, zoneOf } from '../src/engine/team/edit.ts';
import { managerName } from '../src/engine/team/identity.ts';

describe('ambitions', () => {
  it('logs the season, reaches ambitions once each and tells the player', () => {
    let g = newGame({ seed: 'amb', teamName: 'Test', lang: 'en' });
    while (!seasonOver(g)) g = playMatchday(g);
    expect(g.career).toHaveLength(1);
    expect(g.career![0]!.season).toBe(1);
    g = startNextSeason(g);
    const done = Object.keys(g.ambitions ?? {});
    for (const id of done) expect(AMBITION_IDS).toContain(id);
    const msgs = g.inbox.filter((m) => m.kind === 'ambition');
    expect(msgs.length).toBe(done.length);
    // A season of matches almost surely brings a first win.
    expect(done).toContain('firstWin');
  }, 30000);
});

describe('line-up board', () => {
  const g = newGame({ seed: 'board', teamName: 'Test', lang: 'en' });
  const team = playerTeam(g);
  const starter = team.tactic.lineup[0]!.creatureId;
  const bench = team.tactic.bench[0]!;
  const reserve = team.creatures.find((c) => zoneOf(team, c.id) === 'reserve')!.id;

  it('moves between lines and to the reserve', () => {
    const other = zoneOf(team, starter) === 'front' ? 'back' : 'front';
    expect(zoneOf(moveToZone(team, starter, other), starter)).toBe(other);
    expect(zoneOf(moveToZone(team, bench, 'reserve'), bench)).toBe('reserve');
    // Five starters already: a reserve cannot join the lines without a swap.
    expect(moveToZone(team, reserve, 'front')).toBe(team);
  });

  it('swaps places when dropped on another creature', () => {
    const t = dropOnCreature(team, reserve, starter);
    expect(zoneOf(t, starter)).toBe('reserve');
    expect(zoneOf(t, reserve)).toBe(zoneOf(team, starter));
    expect(t.tactic.lineup).toHaveLength(team.tactic.lineup.length);
  });

  it('inserts between two creatures of a group, even over the limit', () => {
    const b0 = team.tactic.bench[0]!;
    const t = insertInGroup(team, reserve, 'bench', b0, false);
    expect(t.tactic.bench[0]).toBe(reserve);
    expect(t.tactic.bench[1]).toBe(b0);
    expect(t.tactic.bench).toHaveLength(team.tactic.bench.length + 1);
    const s1 = team.tactic.lineup[1]!;
    const u = insertInGroup(team, bench, 'starter', s1.creatureId, true);
    expect(u.tactic.lineup[2]!.creatureId).toBe(bench);
    expect(u.tactic.lineup[2]!.line).toBe(s1.line);
  });

  it('takes a free place in the group, otherwise swaps (table drag and drop)', () => {
    const roomy = moveToZone(team, bench, 'reserve');
    const t = dropOnto(roomy, reserve, team.tactic.bench[1]!);
    expect(zoneOf(t, reserve)).toBe('bench');
    expect(zoneOf(t, team.tactic.bench[1]!)).toBe('bench');
    const full = dropOnto(team, reserve, starter);
    expect(zoneOf(full, starter)).toBe('reserve');
  });
});

it('gives each AI manager a fixed name', () => {
  expect(managerName({ id: 'team-3' })).toBe(managerName({ id: 'team-3' }));
  expect(managerName({ id: 'team-3' })).toMatch(/^\S+ \S+$/);
});
