/**
 * Simulates a full league season headless and prints the final table.
 *   npm run sim:season -- --seed 42 [--lang en]
 */
import { isLang } from '../core/i18n.ts';
import { isInjured } from '../engine/creature/derived.ts';
import { newGame, playMatchday, seasonOver, standings, teamById } from '../engine/league/season.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const seed = String(args.seed ?? 'season');
const lang = isLang(args.lang) ? args.lang : 'fr';

const t0 = performance.now();
let g = newGame({ seed, teamName: '', lang });
let injuries = 0;
while (!seasonOver(g)) {
  g = playMatchday(g);
  injuries += g.teams.reduce((s, t) => s + t.creatures.filter(isInjured).length, 0);
}
const ms = performance.now() - t0;

console.log(`Season simulated in ${Math.round(ms)} ms (seed "${seed}")\n`);
console.log(' #  Team                          Pl  KO-W  P-W  P-L  KO-L  Pts   Score±   Avg fatigue');
standings(g).forEach((r, i) => {
  const t = teamById(g, r.teamId);
  const fatigue = Math.round(t.creatures.reduce((s, c) => s + c.condition.fatigue, 0) / t.creatures.length);
  const mark = r.teamId === g.playerTeamId ? '*' : ' ';
  console.log(
    `${String(i + 1).padStart(2)}${mark} ${t.name.padEnd(30)}${String(r.played).padStart(3)}${String(r.koWins).padStart(6)}${String(r.pointsWins).padStart(5)}` +
      `${String(r.pointsLosses).padStart(5)}${String(r.koLosses).padStart(6)}${String(r.points).padStart(5)}${String(r.scoreFor - r.scoreAgainst).padStart(9)}${String(fatigue).padStart(10)}`,
  );
});
console.log(`\nInjured creature-weeks over the season: ${injuries}`);
