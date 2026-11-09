/**
 * Simulates full league seasons headless and prints the final table with each stable's finances.
 *   npm run sim:season -- --seed 42 [--seasons 3] [--lang en]
 */
import { isLang } from '../core/i18n.ts';
import { isInjured } from '../engine/creature/derived.ts';
import { renew } from '../engine/economy/actions.ts';
import { creatureValue } from '../engine/economy/value.ts';
import { newGame, playMatchday, seasonOver, standings, startNextSeason, teamById } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const seed = String(args.seed ?? 'season');
const lang = isLang(args.lang) ? args.lang : 'fr';
const seasons = Math.max(1, Number(args.seasons ?? 1));

const k = (v: number) => `${(v / 1000).toFixed(1)}k`;

function print(g: GameState, start: Record<string, number>, injuries: number) {
  console.log(`\n——— Season ${g.season} ———`);
  console.log(' #  Team                          Pts  KO-W  P-W  P-L  KO-L  Fat  Sq   Wages/wk   Treasury (start → end)   Rep');
  standings(g).forEach((r, i) => {
    const t = teamById(g, r.teamId);
    const club = g.clubs[t.id]!;
    const fatigue = Math.round(t.creatures.reduce((s, c) => s + c.condition.fatigue, 0) / t.creatures.length);
    const wages = t.creatures.reduce((s, c) => s + (c.contract?.wage ?? 0), 0);
    const mark = r.teamId === g.playerTeamId ? '*' : ' ';
    console.log(
      `${String(i + 1).padStart(2)}${mark} ${t.name.padEnd(30)}${String(r.points).padStart(3)}${String(r.koWins).padStart(6)}${String(r.pointsWins).padStart(5)}` +
        `${String(r.pointsLosses).padStart(5)}${String(r.koLosses).padStart(6)}${String(fatigue).padStart(5)}${String(t.creatures.length).padStart(4)}` +
        `${String(wages).padStart(11)}   ${k(start[t.id]!).padStart(7)} → ${k(club.balance).padEnd(12)}${String(club.reputation).padStart(6)}`,
    );
  });
  const moves = g.inbox.filter((m) => m.kind === 'marketNews' && m.season === g.season).reduce((s, m) => s + (m.kind === 'marketNews' ? m.moves.length : 0), 0);
  const offers = g.inbox.filter((m) => m.kind === 'offerReceived' && m.season === g.season).length;
  const values = g.teams.flatMap((t) => t.creatures.map((c) => creatureValue(c)));
  console.log(
    `Injured creature-weeks: ${injuries} · AI transfers: ${moves} · offers to player: ${offers} · free agents: ${g.freeAgents.length}` +
      ` · creature value avg ${k(values.reduce((a, b) => a + b, 0) / values.length)} (max ${k(Math.max(...values))})`,
  );
}

const t0 = performance.now();
let g = newGame({ seed, teamName: '', lang });
for (let s = 0; s < seasons; s++) {
  if (s > 0) {
    // A manager would extend the contracts of the creatures worth keeping.
    const mine = teamById(g, g.playerTeamId).creatures.filter((c) => c.contract && c.contract.untilSeason < g.season + 1);
    for (const c of mine.sort((a, b) => b.ability - a.ability).slice(0, 8)) g = renew(g, c.id, 2).state;
    g = startNextSeason(g);
  }
  const start = Object.fromEntries(Object.entries(g.clubs).map(([id, c]) => [id, c.balance]));
  let injuries = 0;
  while (!seasonOver(g)) {
    g = playMatchday(g);
    injuries += g.teams.reduce((sum, t) => sum + t.creatures.filter(isInjured).length, 0);
  }
  print(g, start, injuries);
}
console.log(`\n${seasons} season(s) simulated in ${Math.round(performance.now() - t0)} ms (seed "${seed}")`);
