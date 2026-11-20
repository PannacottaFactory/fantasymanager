import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { newGame, playMatchday, playerTeam, teamById } from '../src/engine/league/season.ts';
import { forecastBand, matchForecast, upsetOf, winChance } from '../src/engine/report/forecast.ts';

describe('match forecast', () => {
  it('grows with the strength gap, within its bounds', () => {
    const f = DEFAULT_CONFIG.report.forecast;
    expect(winChance(0)).toBeCloseTo(0.5);
    expect(winChance(5)).toBeGreaterThan(winChance(2));
    expect(winChance(-40)).toBe(f.min);
    expect(winChance(40)).toBe(f.max);
    expect(winChance(3) + winChance(-3)).toBeCloseTo(1);
    expect(forecastBand(0.5)).toBe('even');
    expect(forecastBand(0.2)).toBe('heavyUnderdog');
    expect(forecastBand(0.7)).toBe('favourite');
  });

  it('names exploits and slips', () => {
    expect(upsetOf(true, 0.2)).toBe('bigExploit');
    expect(upsetOf(true, 0.35)).toBe('exploit');
    expect(upsetOf(true, 0.5)).toBeNull();
    expect(upsetOf(false, 0.7)).toBe('slip');
    expect(upsetOf(false, 0.3)).toBeNull();
    expect(upsetOf(true, undefined)).toBeNull();
  });

  it('is stored with the player match and its result message', () => {
    let g = newGame({ seed: 'forecast', teamName: 'Test', lang: 'en' });
    for (let i = 0; i < 4 && !(g.matchHistory?.length ?? 0); i++) g = playMatchday(g);
    const rec = g.matchHistory!.at(-1)!;
    expect(rec.forecast).toBeGreaterThan(0);
    expect(rec.forecast).toBeLessThan(1);
    const msg = g.inbox.find((m) => m.kind === 'matchResult' && m.fixtureId === rec.fixtureId);
    expect(msg && msg.kind === 'matchResult' && msg.forecast).toBe(rec.forecast);
    // The forecast reads the opponent through the player's estimates, never changing anything.
    const opp = teamById(g, rec.setup.teams[1].id);
    const before = JSON.stringify(g);
    matchForecast(g, playerTeam(g), opp);
    expect(JSON.stringify(g)).toBe(before);
  });
});
