import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { cupDue, newGame, playMatchday, playerFixture, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import { registerTournament, registrationState } from '../src/engine/league/tournaments.ts';

const game = (seed = 'tour') => newGame({ seed, teamName: 'Me', lang: 'en' });

describe('pyramid & tournaments', () => {
  it('four divisions of ten; the player starts at the bottom with every tournament drawn', () => {
    const g = game();
    expect(g.divisions.length).toBe(4);
    for (const d of g.divisions) expect(d.length).toBe(10);
    expect(g.divisions[3]).toContain(g.playerTeamId);
    const ids = g.tournaments.map((t) => t.id).sort();
    expect(ids).toEqual(['argent', 'champions', 'division-0', 'division-1', 'division-2', 'division-3', 'marches', 'or', 'preseason'].sort());
    // The pre-season tournament comes first, with the player in it.
    expect(cupDue(g)).toBe(true);
    expect(playerFixture(g)?.tournamentId).toBe('preseason');
  });

  it('registration for an invitational pays the fee and puts the player in the draw', () => {
    const g = game('reg');
    expect(registrationState(g, g.tournaments.find((t) => t.id === 'or')!)).toBe('reputation');
    const fee = DEFAULT_CONFIG.league.tournaments.open.marches.fee;
    const before = g.clubs[g.playerTeamId]!.balance;
    const r = registerTournament(g, 'marches');
    expect(r.outcome.kind).toBe('registered');
    const t = r.state.tournaments.find((x) => x.id === 'marches')!;
    expect(t.entrants).toContain(g.playerTeamId);
    expect(t.entrants.length).toBe(4);
    expect(r.state.clubs[g.playerTeamId]!.balance).toBe(before - fee);
    expect(r.state.fixtures.some((f) => f.tournamentId === 'marches' && (f.home === g.playerTeamId || f.away === g.playerTeamId))).toBe(true);
    expect(registerTournament(r.state, 'marches').outcome).toEqual({ kind: 'error', error: 'registered' });
  });

  it('a season plays every tournament to a winner and logs the player’s trophies', () => {
    let g = registerTournament(game('season'), 'marches').state;
    while (!seasonOver(g)) g = playMatchday(g);
    for (const t of g.tournaments) {
      expect(t.round).toBe(t.rounds);
      expect(t.winner).toBeDefined();
    }
    expect(g.fixtures.every((f) => f.result)).toBe(true);
    const rec = g.career!.at(-1)!;
    const won = g.tournaments.filter((t) => t.winner === g.playerTeamId).map((t) => t.def);
    expect(rec.trophies).toEqual([...(g.cup.winner === g.playerTeamId ? ['shadow'] : []), ...won]);
    const next = startNextSeason(g);
    expect(next.tournaments.find((t) => t.id === 'champions')!.entrants.length).toBe(4);
  }, 60000);
});
