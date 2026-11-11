import { describe, expect, it } from 'vitest';
import { newGame, playerTeam } from '../src/engine/league/season.ts';
import { renameCreature } from '../src/engine/team/rename.ts';

describe('renaming creatures', () => {
  it('renames the player’s own creatures only, trimmed and capped', () => {
    const g = newGame({ seed: 'rename', teamName: 'Me', lang: 'en' });
    const c = playerTeam(g).creatures[0]!;
    const next = renameCreature(g, c.id, '   Old   Fang  ');
    expect(playerTeam(next).creatures[0]!.name).toBe('Old Fang');
    expect(playerTeam(g).creatures[0]!.name).toBe(c.name);
    expect(renameCreature(g, c.id, '   ')).toBe(g);
    expect(playerTeam(renameCreature(g, c.id, 'x'.repeat(80))).creatures[0]!.name.length).toBe(30);
    const other = g.teams.find((t) => t.id !== g.playerTeamId)!.creatures[0]!;
    expect(renameCreature(g, other.id, 'Mine now')).toBe(g);
  });
});
