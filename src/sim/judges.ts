/**
 * Are the judges fair? Over many matches decided on points: who the rule favours (more total health, healers,
 * substitutions) and whether bringing on a big fresh creature at the last break dilutes the opponent's score.
 *   npm run sim:judges -- --matches 4000
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { aiBreakDecision } from '../engine/combat/decisions.ts';
import type { BreakDecider, MatchEvent, MatchResult } from '../engine/combat/types.ts';
import { applyEvent, initialView, type MatchView } from '../engine/combat/view.ts';
import { generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(200, Number(args.matches ?? 4000));
const pct = (a: number, b: number) => `${b ? ((100 * a) / b).toFixed(1) : '—'} %`;

function finalView(r: MatchResult): MatchView {
  let v = initialView(r.roster);
  for (const e of r.events as MatchEvent[]) v = applyEvent(v, e);
  return v;
}
const entered = (v: MatchView, side: 0 | 1) => Object.values(v.creatures).filter((c) => c.side === side && c.state !== 'bench');

let points = 0;
let hpWins = 0;
let healWins = 0;
let healGames = 0;
let subsWins = 0;
let subsGames = 0;
for (let i = 0; i < N; i++) {
  const rng = new Rng(deriveSeed('judges-sim', i));
  const r = simulateMatch({ seed: i, teams: [generateTeam(rng, { quality: 'professional' }), generateTeam(rng, { quality: 'professional' })] });
  if (r.outcome.method !== 'points') continue;
  points++;
  const v = finalView(r);
  const w = r.outcome.winner;
  const hp = ([0, 1] as const).map((s) => entered(v, s).reduce((a, c) => a + c.maxHp, 0));
  if (hp[0] !== hp[1] && (hp[0]! > hp[1]! ? 0 : 1) === w) hpWins++;
  const heals = ([0, 1] as const).map((s) => (r.events as MatchEvent[]).filter((e) => e.type === 'heal' && r.roster[e.actor]?.side === s).reduce((a, e) => a + (e.type === 'heal' ? e.amount : 0), 0));
  if (heals[0]! !== heals[1]! && Math.abs(heals[0]! - heals[1]!) > 40) {
    healGames++;
    if ((heals[0]! > heals[1]! ? 0 : 1) === w) healWins++;
  }
  const subs = ([0, 1] as const).map((s) => (r.events as MatchEvent[]).filter((e) => e.type === 'substitution' && e.side === s).length);
  if (subs[0] !== subs[1]) {
    subsGames++;
    if ((subs[0]! > subs[1]! ? 0 : 1) === w) subsWins++;
  }
}
console.log(`${N} professional matches, ${points} decided on points\n`);
console.log(`Points won by the side with more total health in the arena       ${pct(hpWins, points)}`);
console.log(`Points won by the side that healed clearly more (${healGames} matches)     ${pct(healWins, healGames)}`);
console.log(`Points won by the side that made more substitutions (${subsGames})     ${pct(subsWins, subsGames)}`);

// Dilution: at the last break, bring on the bench creature with the most health for the healthiest starter.
const dilute: BreakDecider = (c, side) => {
  const d = aiBreakDecision(c, side);
  if (c.round < 15) return d;
  const mine = c.combatants.filter((x) => x.side === side);
  const bench = mine.filter((x) => x.state === 'bench').sort((a, b) => b.maxHp - a.maxHp)[0];
  const out = mine.filter((x) => x.state === 'active').sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0];
  if (!bench || !out || (d.substitutions ?? []).some((s) => s.inId === bench.id)) return d;
  return { ...d, substitutions: [...(d.substitutions ?? []).slice(0, 2), { outId: out.id, inId: bench.id }] };
};
let w0 = 0;
let w1 = 0;
for (let i = 0; i < Math.min(N, 2000); i++) {
  const rng = new Rng(deriveSeed('judges-sim', i));
  const teams = [generateTeam(rng, { quality: 'professional' }), generateTeam(rng, { quality: 'professional' })] as const;
  const base = simulateMatch({ seed: i, teams: [structuredClone(teams[0]), structuredClone(teams[1])] });
  const trick = simulateMatch({ seed: i, teams: [structuredClone(teams[0]), structuredClone(teams[1])] }, { deciders: [dilute, undefined] });
  if (base.outcome.winner === 0) w0++;
  if (trick.outcome.winner === 0) w1++;
}
const M = Math.min(N, 2000);
console.log(`\nLast-break trick (bring on the biggest bench creature for the healthiest starter): ${pct(w0, M)} → ${pct(w1, M)}`);
