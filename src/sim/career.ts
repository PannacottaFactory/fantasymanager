/**
 * Career mode over whole seasons, the manager on autopilot (AI line-ups, free points and sessions used, best
 * contracts renewed, enters the invitationals it can): how often
 * the board sacks the manager (ultimatum / end-of-season verdict), job offers per season by kind, manager reputation
 * and division over time. Sacked: takes the first rescue offer. `--policy climb` also accepts every offer from a
 * bigger stable (default `stay`: turns them down).
 *   npm run sim:career -- --worlds 8 --seasons 4 --policy stay
 */
import { DIFFICULTY_IDS } from '../data/config/identity.ts';
import { acceptJob } from '../engine/club/career.ts';
import { renew } from '../engine/economy/actions.ts';
import { runSession, sessionState } from '../engine/progression/sessions.ts';
import { placeHeldPoints } from '../engine/progression/training.ts';
import { clubOf } from '../engine/economy/finance.ts';
import { divisionOf } from '../engine/league/divisions.ts';
import { registerTournament, registrationState } from '../engine/league/tournaments.ts';
import { aiPrepare, newGame, playerTeam, playMatchday, seasonOver, startNextSeason } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const WORLDS = Number(args.worlds ?? 8);
const SEASONS = Number(args.seasons ?? 4);
const POLICY = String(args.policy ?? 'stay');
const only = args.difficulty ? [String(args.difficulty)] : DIFFICULTY_IDS;

/** What a plain player does without thinking: AI line-up, free points placed, sessions spent, the best renewed. */
function autopilot(g: GameState): GameState {
  const me = playerTeam(g);
  g = structuredClone({ ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) });
  placeHeldPoints(g, playerTeam(g));
  while (sessionState(g).available > 0) {
    const r = runSession(g);
    if (r.state === g) break;
    g = r.state;
  }
  return g;
}

function renewBest(g: GameState): GameState {
  for (const c of [...playerTeam(g).creatures].sort((a, b) => b.ability - a.ability).slice(0, 9)) if (c.contract && c.contract.untilSeason <= g.season) g = renew(g, c.id, 2).state;
  return g;
}

/** Takes a pending offer when the policy says so (sacked: the first rescue offer). */
function answerOffers(g: GameState): { g: GameState; moved: boolean } {
  const m = g.manager!;
  if (m.unemployed) return { g: acceptJob(g, m.offers[0]!.id).state, moved: true };
  if (POLICY !== 'climb' || !m.offers.length) return { g, moved: false };
  const best = [...m.offers].sort((a, b) => clubOf(g, b.teamId).reputation - clubOf(g, a.teamId).reputation)[0]!;
  return { g: acceptJob(g, best.id).state, moved: true };
}

for (const d of only) {
  let ultimatumSacks = 0;
  let verdictSacks = 0;
  let firstSackSeason = 0;
  let sackedWorlds = 0;
  let ultimatums = 0;
  const offers: Record<string, number> = { poach: 0, vacancy: 0, rescue: 0 };
  let moves = 0;
  const repBySeason: number[] = Array(SEASONS).fill(0);
  const divBySeason: number[] = Array(SEASONS).fill(0);
  for (let w = 0; w < WORLDS; w++) {
    let g = newGame({ seed: `career-${w}`, teamName: 'Test', lang: 'en', difficulty: d as never, career: true });
    let first = 0;
    for (let s = 0; s < SEASONS; s++) {
      if (s > 0) {
        g = startNextSeason(renewBest(g));
        ({ g } = answerOffers(g));
      }
      while (!seasonOver(g)) {
        g = autopilot(g);
        for (const tour of g.tournaments) if (registrationState(g, tour) === 'ok') g = registerTournament(g, tour.id).state;
        const seen = new Set(g.inbox.map((x) => x.id));
        g = playMatchday(g);
        for (const x of g.inbox) {
          if (seen.has(x.id)) continue;
          if (x.kind === 'ultimatum') ultimatums++;
          if (x.kind === 'jobOffer') offers[x.reason] = (offers[x.reason] ?? 0) + 1;
          if (x.kind === 'sacked') {
            if (x.reason === 'ultimatum') ultimatumSacks++;
            else verdictSacks++;
            if (!first) first = g.season;
          }
        }
        const r = answerOffers(g);
        g = r.g;
        if (r.moved) moves++;
      }
      // Sacked at the end of the season: takes a job before the next one.
      if (g.manager!.unemployed) {
        ({ g } = answerOffers(g));
        moves++;
      }
      repBySeason[s]! += g.manager!.reputation;
      divBySeason[s]! += divisionOf(g, g.playerTeamId) + 1;
    }
    if (first) {
      sackedWorlds++;
      firstSackSeason += first;
    }
  }
  const n = WORLDS * SEASONS;
  const sacks = ultimatumSacks + verdictSacks;
  console.log(
    `${d.padEnd(7)} sacked ${(sacks / n).toFixed(2)}/season (ultimatum ${ultimatumSacks}, verdict ${verdictSacks}) · ${sackedWorlds}/${WORLDS} careers sacked at least once` +
      (sackedWorlds ? `, first in season ${(firstSackSeason / sackedWorlds).toFixed(1)}` : '') +
      ` | ultimatums ${(ultimatums / n).toFixed(2)}/season`,
  );
  console.log(`        offers per season: ${Object.entries(offers).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(' · ')} | moves ${moves}`);
  console.log(
    `        reputation by season: ${repBySeason.map((r) => (r / WORLDS).toFixed(0)).join(' → ')} | division: ${divBySeason.map((x) => `D${(x / WORLDS).toFixed(1)}`).join(' → ')}`,
  );
}
