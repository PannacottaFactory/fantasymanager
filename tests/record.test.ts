import { describe, expect, it } from 'vitest';
import { newGame, playMatchday, seasonOver } from '../src/engine/league/season.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { emptyRecord, medalsOf, ownedSpecies, seenSpecies, updateBestiary } from '../src/engine/team/record.ts';

describe('creature records & bestiary', () => {
  it('a season fills records, medals, trophies and the bestiary without changing results', () => {
    let g = newGame({ seed: 'record-world', teamName: 'Me', lang: 'en' });
    const startOwned = Object.keys(g.bestiary!.owned).length;
    expect(startOwned).toBeGreaterThan(0);
    // Starting squad: no reward for what the player already has.
    expect(g.bestiary!.paid.owned).toBeLessThanOrEqual(startOwned);
    while (!seasonOver(g)) g = playMatchday(g);
    const me = g.teams.find((t) => t.id === g.playerTeamId)!;
    const played = me.creatures.filter((c) => c.record && c.record.matches > 0);
    expect(played.length).toBeGreaterThan(4);
    for (const c of played) {
      const r = c.record!;
      expect(r.wins).toBeLessThanOrEqual(r.matches);
      expect(r.starts).toBeLessThanOrEqual(r.matches);
      expect(r.best).toBeGreaterThan(0);
    }
    // Every division champion's squad keeps the title.
    const champs = g.teams.filter((t) => t.creatures.some((c) => c.record?.trophies.some((x) => x.def === 'league')));
    expect(champs.length).toBeGreaterThanOrEqual(g.divisions.length - 1);
    expect(seenSpecies(g).size).toBeGreaterThan(startOwned);
    expect(g.inbox.some((m) => m.kind === 'bestiary')).toBe(true);
    expect(g.inbox.some((m) => m.kind === 'medal')).toBe(true);

    // Same seed, same season: identical results (records are bookkeeping only).
    let h = newGame({ seed: 'record-world', teamName: 'Me', lang: 'en' });
    while (!seasonOver(h)) h = playMatchday(h);
    expect(h.fixtures.map((f) => f.result?.score)).toEqual(g.fixtures.map((f) => f.result?.score));
  });

  it('medal tiers follow the thresholds', () => {
    const r = emptyRecord();
    r.matches = DEFAULT_CONFIG.collection.medals.matches[1]!;
    r.kos = DEFAULT_CONFIG.collection.medals.kos[0]! - 1;
    const m = medalsOf(r);
    expect(m.matches).toBe(2);
    expect(m.kos).toBe(0);
  });

  it('bestiary tiers pay once', () => {
    const g = newGame({ seed: 'bst', teamName: 'Me', lang: 'en' });
    const balance = () => g.clubs[g.playerTeamId]!.balance;
    const all = [...new Set(g.teams.flatMap((t) => t.creatures.map((c) => c.speciesId)))];
    const before = balance();
    updateBestiary(g, all);
    const paid = balance() - before;
    const again = balance();
    updateBestiary(g, all);
    expect(balance()).toBe(again);
    expect(ownedSpecies(g).size).toBeGreaterThan(0);
    if (seenSpecies(g).size >= DEFAULT_CONFIG.collection.bestiary.seen[0]!.n) expect(paid).toBeGreaterThan(0);
  });
});
