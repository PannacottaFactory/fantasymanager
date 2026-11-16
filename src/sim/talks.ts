/**
 * Team talks (prototype): is one talk best everywhere, and how much does the right talk at the right time give?
 * Paired matches (same squads, same seed), the opponent giving no talk or reading the game too.
 *   npm run sim:talks -- --matches 1500
 *   --set combat.orders.talks.focus.hit=0.06,…   config variant
 */
import { DEFAULT_CONFIG, type GameConfig } from '../data/config/index.ts';
import { Rng, deriveSeed } from '../core/rng.ts';
import type { Combat } from '../engine/combat/combat.ts';
import { aiBreakDecision } from '../engine/combat/decisions.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import type { BreakDecider, Side } from '../engine/combat/types.ts';
import { TALKS, breakSituation, preMatchSituation, readTalk } from '../engine/combat/talks.ts';
import type { Talk, Team } from '../engine/model.ts';
import { cloneTeam, generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(100, Number(args.matches ?? 1500));
const CFG: GameConfig = structuredClone(DEFAULT_CONFIG);
for (const kv of args.set ? args.set.split(',') : []) {
  const [path, value] = kv.split('=');
  const keys = path!.split('.');
  let o = CFG as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  if (!o || !(keys.at(-1)! in o)) throw new Error(`unknown config key ${path}`);
  o[keys.at(-1)!] = Number(value);
}
const t0 = performance.now();

type Policy = { label: string; pre: (own: Team, foe: Team, i: number) => Talk | undefined; brk: (c: Combat, side: Side, i: number) => Talk | undefined };

const preRead = (own: Team, foe: Team): Talk => readTalk(preMatchSituation(own, foe)).talk;
const breakRead = (c: Combat, side: Side): Talk => readTalk(breakSituation(c, side)).talk;

const NONE: Policy = { label: 'no talk', pre: () => undefined, brk: () => undefined };
const fixed = (t: Talk): Policy => ({ label: `always ${t}`, pre: () => t, brk: () => t });
const READ: Policy = { label: 'reads the game', pre: preRead, brk: breakRead };
const RANDOM: Policy = {
  label: 'random talk',
  pre: (_o, _f, i) => TALKS[new Rng(deriveSeed('talk-r', i, 0)).int(0, TALKS.length - 1)],
  brk: (c, side, i) => TALKS[new Rng(deriveSeed('talk-r', i, c.round, side)).int(0, TALKS.length - 1)],
};

const squad = (i: number, pool?: string[]) => generateTeam(new Rng(deriveSeed('talk', i, pool?.join() ?? '')), { quality: 'professional', speciesPool: pool });
const withTalk = (t: Team, talk: Talk | undefined): Team => ({ ...t, tactic: { ...t.tactic, orders: { ...t.tactic.orders, talk } } });
const decider = (p: Policy, i: number): BreakDecider => (c, side) => {
  const d = aiBreakDecision(c, side);
  return { ...d, orders: { ...(d.orders ?? c.sides[side].orders), talk: p.brk(c, side, i) } };
};

interface Scenario {
  label: string;
  own?: (i: number) => Team;
  foe?: (i: number) => Team;
}
const tired = (t: Team) => {
  for (const c of t.creatures) c.condition.fatigue = 50;
  return t;
};
const shaken = (t: Team) => {
  for (const c of t.creatures) c.condition.morale = 20;
  return t;
};
const SCENARIOS: Scenario[] = [
  { label: 'varied opponents' },
  { label: 'our squad tired (fatigue 50)', own: (i) => tired(squad(i)) },
  { label: 'our squad shaken (morale 20)', own: (i) => shaken(squad(i)) },
  { label: 'vs ranged & spells', foe: (i) => squad(i + 100000, ['elf', 'centaur', 'djinn', 'lich', 'naga', 'harpy', 'salamander', 'imp', 'kitsune']) },
  { label: 'vs melee brutes', foe: (i) => squad(i + 100000, ['troll', 'orc', 'minotaur', 'ogre', 'werewolf', 'golem', 'giant-hyena', 'raptor']) },
];

function rate(sc: Scenario, mine: Policy, theirs: Policy): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const ownBase = sc.own ? sc.own(i) : squad(i);
    const foeBase = sc.foe ? sc.foe(i) : squad(i + 100000);
    const a = withTalk(cloneTeam(ownBase, 'a'), mine.pre(ownBase, foeBase, i));
    const b = withTalk(cloneTeam(foeBase, 'b'), theirs.pre(foeBase, ownBase, i));
    const swap = i % 2 === 1;
    const dm = decider(mine, i);
    const dt = decider(theirs, i + 7);
    const r = simulateMatch(
      { seed: deriveSeed('talk-m', i), teams: swap ? [b, a] : [a, b] },
      { deciders: swap ? [dt, dm] : [dm, dt], cfg: CFG },
    );
    if (r.outcome.winner === (swap ? 1 : 0)) wins++;
  }
  return wins / N;
}

const policies = [READ, RANDOM, ...TALKS.map(fixed)];
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
for (const opp of [NONE, READ]) {
  console.log(`\n=== Opponent: ${opp.label} (${N} paired matches; gap in points of win rate vs giving no talk)`);
  console.log(`${'scenario'.padEnd(32)} ${'none'.padStart(6)} ${policies.map((p) => p.label.replace('always ', '').padStart(11)).join('')}`);
  for (const sc of SCENARIOS) {
    const base = rate(sc, NONE, opp);
    const row = policies.map((p) => pct(rate(sc, p, opp) - base).padStart(11)).join('');
    console.log(`${sc.label.padEnd(32)} ${(base * 100).toFixed(1).padStart(6)}${row}`);
  }
}
console.log(`\n${((performance.now() - t0) / 1000).toFixed(0)} s`);
