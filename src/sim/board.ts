/**
 * The board and the supporters over whole seasons, the player's stable on autopilot: weeks spent in each board mood,
 * ultimatums (met / missed), confidence at the end of the season; supporters' tiers and average ticket multiplier.
 *   npm run sim:board -- --worlds 6 --seasons 2
 */
import { DIFFICULTY_IDS } from '../data/config/identity.ts';
import { moodOf } from '../engine/club/board.ts';
import { fansOf, fansTicketFactor, tierOf } from '../engine/club/fans.ts';
import { registerTournament, registrationState } from '../engine/league/tournaments.ts';
import { aiPrepare, newGame, playerTeam, playMatchday, seasonOver, startNextSeason } from '../engine/league/season.ts';
import type { BoardMood, FansTier } from '../engine/league/types.ts';
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
  const fans: Record<FansTier, number> = { euphoric: 0, enthusiastic: 0, loyal: 0, grumbling: 0, furious: 0 };
  let tickets = 0;
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
        fans[tierOf(fansOf(g).mood)]++;
        tickets += fansTicketFactor(g);
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
    `${d.padEnd(7)} board: ${share} | ultimatums ${(issued / n).toFixed(2)}/season (met ${met}, missed ${missed}) | lowest ${(lows / n).toFixed(0)} · end of season ${(endConf / n).toFixed(0)} | league wins ${Math.round((wins / Math.max(1, played)) * 100)} %`,
  );
  const fansShare = (Object.keys(fans) as FansTier[]).map((k) => `${k} ${Math.round((fans[k] / total) * 100)} %`).join(' · ');
  console.log(`        fans: ${fansShare} | tickets ×${(tickets / total).toFixed(2)} on average`);
}
