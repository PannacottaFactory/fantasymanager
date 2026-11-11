/**
 * Long-run balance report: plays many seasons (the player's stable on autopilot) and prints the drift of
 * the economy, creature quality, ages, fatigue and injuries season by season.
 *   npm run sim:balance -- --seed 1 --seasons 10
 */
import { renew } from '../engine/economy/actions.ts';
import { isInjured } from '../engine/creature/derived.ts';
import { aiPrepare, newGame, playMatchday, playerTeam, seasonOver, startNextSeason, teamById } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const seed = String(args.seed ?? 'balance');
const seasons = Math.max(1, Number(args.seasons ?? 10));

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};
const k = (v: number) => `${(v / 1000).toFixed(0)}k`;

/** The player's stable managed like an AI one: best lineup, renew the useful, keep the promising. */
function autopilot(g: GameState): GameState {
  const me = playerTeam(g);
  g = { ...g, teams: g.teams.map((t) => (t.id === me.id ? aiPrepare(t) : t)) };
  return g;
}

console.log(`Balance report — seed "${seed}", ${seasons} seasons\n`);
console.log(
  'Season | ability pot   age | fatigue@match inj/wk | KO%  | treasury D1 min/med/max   D2 min/med/max  <0 | rep D1 / D2 | squad | moves',
);
const t0 = performance.now();
let g = newGame({ seed, teamName: '', lang: 'en' });
for (let s = 0; s < seasons; s++) {
  if (s > 0) {
    const me = playerTeam(g);
    for (const c of [...me.creatures].sort((a, b) => b.ability - a.ability).slice(0, 9)) if (c.contract && c.contract.untilSeason <= g.season) g = renew(g, c.id, 2).state;
    g = startNextSeason(g);
  }
  const fatigue: number[] = [];
  let injuredWeeks = 0;
  let weeks = 0;
  while (!seasonOver(g)) {
    g = autopilot(g);
    for (const t of g.teams) for (const sl of t.tactic.lineup) fatigue.push(t.creatures.find((c) => c.id === sl.creatureId)?.condition.fatigue ?? 0);
    g = playMatchday(g);
    weeks++;
    injuredWeeks += g.teams.reduce((n, t) => n + t.creatures.filter(isInjured).length, 0);
  }
  const all = g.teams.flatMap((t) => t.creatures);
  const league = g.fixtures.filter((f) => f.competition !== 'cup' && f.result);
  const ko = league.filter((f) => f.result!.method === 'ko').length / Math.max(1, league.length);
  const money = (d: number) => g.divisions[d]!.map((id) => g.clubs[id]!.balance);
  const rep = (d: number) => avg(g.divisions[d]!.map((id) => g.clubs[id]!.reputation));
  const negative = Object.values(g.clubs).filter((c) => c.balance < 0).length;
  const moves = g.inbox.filter((m) => m.kind === 'marketNews' && m.season === g.season).reduce((n, m) => n + (m.kind === 'marketNews' ? m.moves.length : 0), 0);
  const d1 = money(0);
  const d2 = money(1);
  console.log(
    `${String(g.season).padStart(6)} | ${avg(all.map((c) => c.ability)).toFixed(0).padStart(7)} ${avg(all.map((c) => c.potential)).toFixed(0).padStart(4)} ${avg(all.map((c) => c.age)).toFixed(0).padStart(5)} |` +
      ` ${avg(fatigue).toFixed(0).padStart(13)} ${(injuredWeeks / g.teams.length / weeks).toFixed(2).padStart(6)} | ${(ko * 100).toFixed(0).padStart(3)}% |` +
      ` ${k(pct(d1, 0)).padStart(7)} ${k(pct(d1, 0.5)).padStart(5)} ${k(pct(d1, 0.99)).padStart(5)}   ${k(pct(d2, 0)).padStart(7)} ${k(pct(d2, 0.5)).padStart(5)} ${k(pct(d2, 0.99)).padStart(5)} ${String(negative).padStart(3)} |` +
      ` ${rep(0).toFixed(0).padStart(5)} / ${rep(1).toFixed(0).padStart(2)} | ${avg(g.teams.map((t) => t.creatures.length)).toFixed(1).padStart(5)} | ${String(moves).padStart(5)}`,
  );
}
const champions = g.news.filter((n) => n.kind === 'champion').map((n) => (n.kind === 'champion' ? n.team : ''));
console.log(`\nLast champions: ${champions.slice(-4).join(', ')} · player: ${teamById(g, g.playerTeamId).name}`);
console.log(`${seasons} seasons in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
