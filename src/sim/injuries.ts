/**
 * How many creatures are injured: per stable and per week (average, share of weeks with 3+ / 4+ out), new injuries per
 * match, squad size, weeks out per injury — over a few worlds and seasons on autopilot.
 *   npm run sim:injuries -- --worlds 6 --seasons 2
 */
import { isInjured } from '../engine/creature/derived.ts';
import { aiPrepare, newGame, playMatchday, playerTeam, seasonOver, startNextSeason } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const worlds = Math.max(1, Number(args.worlds ?? 6));
const seasons = Math.max(1, Number(args.seasons ?? 2));

let samples = 0;
let injured = 0;
let squad = 0;
const hist = new Map<number, number>();
let playerSamples = 0;
let playerInjured = 0;
let newInjuries = 0;
let weeksOut = 0;
let matches = 0;
for (let w = 0; w < worlds; w++) {
  let g: GameState = newGame({ seed: `inj-${w}`, teamName: '', lang: 'en' });
  for (let s = 0; s < seasons; s++) {
    if (s > 0) g = startNextSeason(g);
    while (!seasonOver(g)) {
      const me = playerTeam(g);
      g = { ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) };
      const before = new Map(g.teams.flatMap((t) => t.creatures.map((c) => [c.id, c.condition.injuries.length])));
      const played = g.fixtures.filter((f) => f.result).length;
      g = playMatchday(g);
      matches += g.fixtures.filter((f) => f.result).length - played;
      for (const t of g.teams) {
        const n = t.creatures.filter(isInjured).length;
        samples++;
        injured += n;
        squad += t.creatures.length;
        hist.set(n, (hist.get(n) ?? 0) + 1);
        if (t.id === g.playerTeamId) {
          playerSamples++;
          playerInjured += n;
        }
        for (const c of t.creatures) {
          const fresh = c.condition.injuries.slice(before.get(c.id) ?? 0);
          newInjuries += fresh.length;
          for (const i of fresh) weeksOut += i.weeksLeft;
        }
      }
    }
  }
}
const at = (k: number) => [...hist].filter(([n]) => n >= k).reduce((a, [, v]) => a + v, 0) / samples;
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
console.log(`${worlds} worlds × ${seasons} seasons, every stable, sampled after each week`);
console.log(`squad size            ${(squad / samples).toFixed(1)}`);
console.log(`injured per stable    ${(injured / samples).toFixed(2)}  (player ${(playerInjured / playerSamples).toFixed(2)})`);
console.log(`weeks with 2+ / 3+ / 4+ / 5+ out   ${pct(at(2))} / ${pct(at(3))} / ${pct(at(4))} / ${pct(at(5))}`);
console.log(`new injuries per match (both sides) ${(newInjuries / Math.max(1, matches)).toFixed(2)}, ${(weeksOut / Math.max(1, newInjuries)).toFixed(1)} weeks out on average`);
