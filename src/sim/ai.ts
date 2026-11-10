/**
 * AI managers and difficulty.
 *  1) The same squad, managed with its identity (style orders, favourite abilities, temperament, reading the
 *     opponent) against itself managed plainly — does the AI's management matter?
 *  2) Each temperament against a plain manager.
 *  3) A full season per difficulty with a plainly managed player stable: final position and points.
 *   npm run sim:ai -- --matches 300 --seasons 6
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { DEFAULT_CONFIG, type DifficultyId, type ManagerId } from '../data/config/index.ts';
import { DIFFICULTY_IDS, MANAGER_IDS, PLAY_STYLES, PLAY_STYLE_IDS } from '../data/config/identity.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { aiPrepare, newGame, playMatchday, playerTeam, seasonOver, standings } from '../engine/league/season.ts';
import type { Team } from '../engine/model.ts';
import { cloneTeam, generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(20, Number(args.matches ?? 300));
const SEASONS = Math.max(1, Number(args.seasons ?? 6));
const cfg = DEFAULT_CONFIG;
const t0 = performance.now();

function styledTeam(i: number, manager?: ManagerId): Team {
  const rng = new Rng(deriveSeed('ai-team', i));
  const style = PLAY_STYLE_IDS[i % PLAY_STYLE_IDS.length]!;
  const team = generateTeam(rng, { quality: 'professional', favoured: { species: PLAY_STYLES[style].species, share: 0.5 } });
  team.identity = { style, manager: manager ?? 'tactician', focus: 0.65 };
  return team;
}

/** Win rate of `smart` (side alternating) against `plain`, both built from the same squad. */
function duel(make: (i: number) => [Team, Team], difficulty: DifficultyId): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const [a, b] = make(i);
    const plain = aiPrepare({ ...b, identity: undefined }, cfg);
    const smart = aiPrepare(a, cfg, difficulty, plain);
    const swap = i % 2 === 1;
    const r = simulateMatch({ seed: deriveSeed('ai-m', i), teams: swap ? [plain, smart] : [smart, plain] });
    if (r.outcome.winner === (swap ? 1 : 0)) wins++;
  }
  return wins / N;
}

const clone = (t: Team): Team => cloneTeam(t, 'b');
// --season-only skips the match duels.
if (!args['season-only']) {
  console.log(`1) Same squad, managed with identity vs plainly (${N} matches each)`);
  for (const d of DIFFICULTY_IDS) {
    const w = duel((i) => {
      const t = styledTeam(i);
      return [t, clone(t)];
    }, d);
    console.log(`   ${d.padEnd(7)} ${(w * 100).toFixed(1)} %`);
  }

  console.log(`\n2) Temperaments vs a plain manager (normal difficulty, same squad)`);
  for (const m of MANAGER_IDS) {
    const w = duel((i) => {
      const t = styledTeam(i, m);
      return [t, clone(t)];
    }, 'normal');
    console.log(`   ${m.padEnd(11)} ${(w * 100).toFixed(1)} %`);
  }
}

console.log(`\n3) One season per difficulty, player stable managed plainly (${SEASONS} worlds each)`);
for (const d of DIFFICULTY_IDS) {
  let pos = 0;
  let pts = 0;
  let money = 0;
  for (let s = 0; s < SEASONS; s++) {
    let g = newGame({ seed: `ai-${s}`, teamName: 'Test', lang: 'en', difficulty: d });
    while (!seasonOver(g)) {
      const me = playerTeam(g);
      g = { ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) };
      g = playMatchday(g);
    }
    const table = standings(g);
    const i = table.findIndex((r) => r.teamId === g.playerTeamId);
    pos += i + 1;
    pts += table[i]!.points;
    money += g.clubs[g.playerTeamId]!.balance;
  }
  console.log(`   ${d.padEnd(7)} position ${(pos / SEASONS).toFixed(1)} / 10 · points ${(pts / SEASONS).toFixed(0)} · treasury ${Math.round(money / SEASONS / 1000)}k`);
}
console.log(`\n${((performance.now() - t0) / 1000).toFixed(1)} s`);
