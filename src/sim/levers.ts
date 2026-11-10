/**
 * How much each manager decision weighs: the same squad with one change against itself unchanged.
 * Goal: good calls ≈ +8–15 points of win rate, gross mistakes ≈ −20 or worse.
 *   npm run sim:levers -- --matches 400
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { aiBreakDecision } from '../engine/combat/decisions.ts';
import type { BreakDecider } from '../engine/combat/types.ts';
import { cloneTeam, generateTeam } from '../engine/team/team.ts';
import type { Team, TeamOrders } from '../engine/model.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(40, Number(args.matches ?? 400));
const t0 = performance.now();

type Mod = (t: Team) => Team;
interface Lever {
  label: string;
  mod?: Mod;
  /** Opponent squad (default: the same squad). */
  opponent?: (i: number) => Team;
  decider?: BreakDecider;
  opponentDecider?: BreakDecider;
}

const squad = (i: number, pool?: string[]) => generateTeam(new Rng(deriveSeed('lever', i, pool?.join() ?? '')), { quality: 'professional', speciesPool: pool });
const orders = (p: Partial<TeamOrders>): Mod => (t) => ({ ...t, tactic: { ...t.tactic, orders: { ...t.tactic.orders, ...p } } });
const lineup = (f: (s: Team['tactic']['lineup'][number], k: number, all: Team['tactic']['lineup']) => Team['tactic']['lineup'][number]): Mod => (t) => ({
  ...t,
  tactic: { ...t.tactic, lineup: t.tactic.lineup.map(f) },
});
const noBreaks: BreakDecider = () => ({});
const subsOnly: BreakDecider = (c, side) => ({ substitutions: aiBreakDecision(c, side).substitutions });
const lastPeriodAllOut: BreakDecider = (c, side) => {
  const d = aiBreakDecision(c, side);
  return c.round >= 15 ? { ...d, orders: { ...c.sides[side].orders, aggression: 'aggressive', risk: 'high' } } : d;
};

const LEVERS: Lever[] = [
  { label: 'target: weakest', mod: orders({ target: 'weakest' }) },
  { label: 'target: casters (vs healers)', mod: orders({ target: 'casters' }), opponent: (i) => squad(i, ['elf', 'dryad', 'naga', 'unicorn', 'treant', 'troll', 'golem', 'orc']) },
  { label: 'target: casters (vs brutes)', mod: orders({ target: 'casters' }), opponent: (i) => squad(i, ['troll', 'orc', 'minotaur', 'golem', 'ogre', 'werewolf']) },
  { label: 'aggressive all match', mod: orders({ aggression: 'aggressive' }) },
  { label: 'cautious vs an aggressive opponent', mod: orders({ aggression: 'cautious' }), opponent: (i) => orders({ aggression: 'aggressive' })(squad(i + 100000)) },
  { label: 'aggressive vs a cautious opponent', mod: orders({ aggression: 'aggressive' }), opponent: (i) => orders({ aggression: 'cautious' })(squad(i + 100000)) },
  { label: 'balanced vs a cautious opponent', mod: orders({ aggression: 'balanced' }), opponent: (i) => orders({ aggression: 'cautious' })(squad(i + 100000)) },
  { label: 'cautious all match', mod: orders({ aggression: 'cautious' }) },
  { label: 'all-out in the last period', decider: lastPeriodAllOut },
  { label: 'no break decisions (vs AI)', decider: noBreaks },
  { label: 'orders never adapted to the score', decider: subsOnly },
  { label: 'all in the back line', mod: lineup((s) => ({ ...s, line: 'back' })) },
  { label: 'all in the front line', mod: lineup((s) => ({ ...s, line: 'front' })) },
  { label: 'roles rotated (wrong roles)', mod: lineup((s, k, all) => ({ ...s, role: all[(k + 1) % all.length]!.role })) },
  {
    label: '3 best starters benched',
    mod: (t) => {
      const lu = [...t.tactic.lineup];
      const bench = [...t.tactic.bench];
      for (let k = 0; k < 3 && k < bench.length; k++) {
        const out = lu[k]!;
        lu[k] = { ...out, creatureId: bench[k]! };
        bench[k] = out.creatureId;
      }
      return { ...t, tactic: { ...t.tactic, lineup: lu, bench } };
    },
  },
  {
    label: 'tired squad (fatigue 60)',
    mod: (t) => {
      for (const c of t.creatures) c.condition.fatigue = 60;
      return t;
    },
  },
];

console.log(`${N} matches per lever against varied opponents of the same level: win rate without → with the change (gap)
`);
/** Same squad, same opponent, same seed — once unchanged, once with the lever. */
function rate(lever: Lever, changed: boolean): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const base = squad(i);
    const a = changed && lever.mod ? lever.mod(cloneTeam(base, 'a')) : cloneTeam(base, 'a');
    const b = lever.opponent ? lever.opponent(i) : squad(i + 100000);
    const swap = i % 2 === 1;
    const mine = changed ? lever.decider : undefined;
    const deciders: [BreakDecider?, BreakDecider?] = swap ? [lever.opponentDecider, mine] : [mine, lever.opponentDecider];
    const r = simulateMatch({ seed: deriveSeed('lever-m', i), teams: swap ? [b, a] : [a, b] }, { deciders });
    if (r.outcome.winner === (swap ? 1 : 0)) wins++;
  }
  return wins / N;
}
const base = rate({ label: '' }, false);
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
console.log(`${'unchanged'.padEnd(34)} ${pct(base)}`);
for (const lever of LEVERS) {
  const before = lever.opponent ? rate(lever, false) : base;
  const after = rate(lever, true);
  const gap = (after - before) * 100;
  console.log(`${lever.label.padEnd(34)} ${pct(before)} → ${pct(after)}  (${gap >= 0 ? '+' : ''}${gap.toFixed(1)})`);
}
console.log(`
${((performance.now() - t0) / 1000).toFixed(1)} s`);
