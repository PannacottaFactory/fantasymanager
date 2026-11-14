/**
 * The board over whole seasons, the player's stable on autopilot: weeks spent in each mood, ultimatums (met / missed),
 * confidence at the end of the season, per difficulty.
 *   npm run sim:board -- --worlds 6 --seasons 2
 */
import { DIFFICULTY_IDS } from '../data/config/identity.ts';
import { moodOf } from '../engine/club/board.ts';
import { registerTournament, registrationState } from '../engine/league/tournaments.ts';
import { aiPrepare, newGame, playerTeam, playMatchday, seasonOver, startNextSeason } from '../engine/league/season.ts';
import type { BoardMood } from '../engine/league/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const WORLDS = Number(args.worlds ?? 6);
const SEASONS = Number(args.seasons ?? 2);

for (const d of DIFFICULTY_IDS) {
  const weeks: Record<BoardMood, number> = { delighted: 0, content: 0, uneasy: 0, angry: 0 };
  let issued = 0;
  let met = 0;
  let missed = 0;
  let endConf = 0;
  let lows = 0;
  let wins = 0;
  let played = 0;
  for (let w = 0; w < WORLDS; w++) {
    let g = newGame({ seed: `board-${w}`, teamName: 'Test', lang: 'en', difficulty: d });
    for (let s = 0; s < SEASONS; s++) {
      if (s > 0) g = startNextSeason(g);
      let low = 100;
      while (!seasonOver(g)) {
        const me = playerTeam(g);
        g = { ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) };
        for (const tour of g.tournaments) if (registrationState(g, tour) === 'ok') g = registerTournament(g, tour.id).state;
        const seen = new Set(g.inbox.map((m) => m.id));
        g = playMatchday(g);
        for (const m of g.inbox) {
          if (seen.has(m.id)) continue;
          if (m.kind === 'ultimatum') issued++;
          if (m.kind === 'ultimatumOver') {
            if (m.met) met++;
            else missed++;
          }
        }
        weeks[moodOf(g.board.confidence)]++;
        low = Math.min(low, g.board.confidence);
      }
      lows += low;
      endConf += g.board.confidence;
      for (const f of g.fixtures) {
        if (f.competition || !f.result) continue;
        const side = f.home === g.playerTeamId ? 0 : f.away === g.playerTeamId ? 1 : -1;
        if (side < 0) continue;
        played++;
        if (f.result.winner === side) wins++;
      }
    }
  }
  const n = WORLDS * SEASONS;
  const total = Object.values(weeks).reduce((a, b) => a + b, 0);
  const share = (Object.keys(weeks) as BoardMood[]).map((k) => `${k} ${Math.round((weeks[k] / total) * 100)} %`).join(' · ');
  console.log(
    `${d.padEnd(7)} ${share} | ultimatums ${(issued / n).toFixed(2)}/season (met ${met}, missed ${missed}) | lowest ${(lows / n).toFixed(0)} · end of season ${(endConf / n).toFixed(0)} | league wins ${Math.round((wins / Math.max(1, played)) * 100)} %`,
  );
}
