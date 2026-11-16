/**
 * Fatigue spiral: the player's stable over a season with three ways of managing it — always the best five (no
 * rotation), the assistant's rotation (rests tired creatures), the rotation + every starter pacing itself.
 * Prints the starters' fatigue before each match, the share of tired starters, points per league match, final place.
 *   npm run sim:fatigue -- --worlds 6
 */
import { DEFAULT_CONFIG, type GameConfig } from '../data/config/index.ts';
import { aiPrepare, newGame, playMatchday, playerTeam, seasonOver, standings, playerDivision } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import type { Team } from '../engine/model.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const worlds = Math.max(1, Number(args.worlds ?? 6));

const noRotation: GameConfig = structuredClone(DEFAULT_CONFIG);
noRotation.league.ai.fatigueWeight = 0;
for (const d of Object.values(noRotation.identity.difficulties)) d.restFatigue = 101;

type Policy = { label: string; prep: (t: Team) => Team };
const pace = (t: Team): Team => ({ ...t, tactic: { ...t.tactic, lineup: t.tactic.lineup.map((s) => ({ ...s, stance: 'conserve' })) } });
const POLICIES: Policy[] = [
  { label: 'no rotation (best five)', prep: (t) => aiPrepare(t, noRotation) },
  { label: 'assistant rotation', prep: (t) => aiPrepare(t) },
  { label: 'rotation + pace yourself', prep: (t) => pace(aiPrepare(t)) },
];

console.log(`${worlds} worlds × 1 season — player's starters before each match`);
console.log('policy                      fatigue  ≥50    ≥70   | pts/league match  place');
for (const p of POLICIES) {
  const fat: number[] = [];
  let pts = 0;
  let games = 0;
  let place = 0;
  for (let w = 0; w < worlds; w++) {
    let g: GameState = newGame({ seed: `fat-${w}`, teamName: '', lang: 'en' });
    while (!seasonOver(g)) {
      const me = playerTeam(g);
      g = { ...g, teams: g.teams.map((t) => (t.id === me.id ? p.prep(t) : t)) };
      const t = playerTeam(g);
      for (const s of t.tactic.lineup) fat.push(t.creatures.find((c) => c.id === s.creatureId)!.condition.fatigue);
      g = playMatchday(g);
    }
    const rows = standings(g, playerDivision(g));
    const i = rows.findIndex((r) => r.teamId === g.playerTeamId);
    pts += rows[i]!.points;
    games += rows[i]!.played;
    place += i + 1;
  }
  const avg = fat.reduce((a, b) => a + b, 0) / fat.length;
  const share = (k: number) => `${((100 * fat.filter((f) => f >= k).length) / fat.length).toFixed(0).padStart(3)} %`;
  console.log(`${p.label.padEnd(27)} ${avg.toFixed(0).padStart(5)}  ${share(50)}  ${share(70)}  | ${(pts / games).toFixed(2).padStart(9)}        ${(place / worlds).toFixed(1)}`);
}
