/**
 * Weight of the training ground: the same worlds played with the player's training ground forced to each level
 * (0–3), the stable on autopilot (AI line-ups, free points placed, every session spent, best contracts renewed).
 * Reports sessions earned, attribute points gained by the squad (sessions vs the rest), league points and position.
 *   npm run sim:facility -- --worlds 8 --seasons 2
 */
import { renew } from '../engine/economy/actions.ts';
import { divisionOf } from '../engine/league/divisions.ts';
import { aiPrepare, newGame, playerTeam, playMatchday, seasonOver, standings, startNextSeason } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import { runSession, sessionState } from '../engine/progression/sessions.ts';
import { placeHeldPoints } from '../engine/progression/training.ts';
import type { Creature } from '../engine/model.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const WORLDS = Number(args.worlds ?? 8);
const SEASONS = Number(args.seasons ?? 2);
const LEVELS = [0, 1, 2, 3];

const attrSum = (c: Creature) => Object.values(c.attributes).reduce((a, b) => a + b, 0);

console.log(`Training ground: ${WORLDS} worlds × ${SEASONS} seasons per level (difficulty normal, autopilot)\n`);
console.log('level | sessions/season | session pts/season | attr pts gained/season (squad) | league pts/season | position');
for (const level of LEVELS) {
  let sessions = 0;
  let sessionPts = 0;
  let gained = 0;
  let points = 0;
  let pos = 0;
  for (let w = 0; w < WORLDS; w++) {
    let g: GameState = newGame({ seed: `facility-${w}`, teamName: 'Test', lang: 'en' });
    g.facilities[g.playerTeamId]!.training = { level, building: null };
    for (let s = 0; s < SEASONS; s++) {
      if (s > 0) {
        for (const c of [...playerTeam(g).creatures].sort((a, b) => b.ability - a.ability).slice(0, 9)) if (c.contract && c.contract.untilSeason <= g.season) g = renew(g, c.id, 2).state;
        g = startNextSeason(g);
      }
      const start = new Map(playerTeam(g).creatures.map((c) => [c.id, attrSum(c)]));
      while (!seasonOver(g)) {
        const me = playerTeam(g);
        g = structuredClone({ ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) });
        placeHeldPoints(g, playerTeam(g));
        while (sessionState(g).available > 0) {
          const r = runSession(g);
          if (r.state === g || r.outcome.kind !== 'trained') break;
          sessions++;
          sessionPts += r.outcome.result.d;
          g = r.state;
        }
        g = playMatchday(g);
      }
      placeHeldPoints(g, playerTeam(g));
      for (const c of playerTeam(g).creatures) {
        const before = start.get(c.id);
        if (before !== undefined) gained += attrSum(c) - before;
      }
      const table = standings(g, divisionOf(g, g.playerTeamId));
      const i = table.findIndex((r) => r.teamId === g.playerTeamId);
      points += table[i]!.points;
      pos += i + 1;
    }
  }
  const n = WORLDS * SEASONS;
  console.log(
    `  ${level}   | ${(sessions / n).toFixed(1).padStart(15)} | ${(sessionPts / n).toFixed(1).padStart(17)} | ${(gained / n).toFixed(1).padStart(30)} | ${(points / n).toFixed(1).padStart(17)} | ${(pos / n).toFixed(2)}`,
  );
}
