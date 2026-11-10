/**
 * Play styles head to head: teams built around one style (poison, frost, curses…) against each other and
 * against mixed teams, at equal potential (creatures at their prime). Checks that every style is viable and
 * that the counters work. Styles are a design tool only — the game never names them.
 *   npm run sim:archetypes -- --matches 200
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { SPECIES, SPECIES_IDS } from '../data/species.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { generateCreature } from '../engine/creature/generate.ts';
import { autoTactic } from '../engine/team/team.ts';
import type { Team } from '../engine/model.ts';
import { EFFECTS } from '../data/effects.ts';
import type { MatchResult, Side } from '../engine/combat/types.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(10, Number(args.matches ?? 200));

/** 5 starters + 3 bench per style (autoTactic picks the lineup). */
const STYLES: Record<string, string[]> = {
  mixed: [],
  poison: ['giant-spider', 'giant-scorpion', 'myconid', 'basilisk', 'wyvern', 'giant-spider', 'giant-scorpion', 'myconid'],
  frost: ['frost-giant', 'winter-wolf', 'frost-wraith', 'wendigo', 'winter-wolf', 'frost-wraith', 'frost-giant', 'winter-wolf'],
  curse: ['hag', 'lich', 'hag', 'troll', 'orc', 'lich', 'hag', 'troll'],
  purify: ['unicorn', 'unicorn', 'golem', 'elf', 'orc', 'unicorn', 'troll', 'centaur'],
  fortress: ['golem', 'troll', 'treant', 'naga', 'crystal-golem', 'dryad', 'golem', 'troll'],
};

for (const list of Object.values(STYLES)) for (const id of list) if (!SPECIES[id]) throw new Error(`Unknown species ${id}`);

function buildTeam(style: string, seed: number): Team {
  const rng = new Rng(seed);
  const list = STYLES[style]!;
  const creatures = Array.from({ length: 8 }, (_, i) => {
    const speciesId = list[i] ?? rng.pick(SPECIES_IDS);
    const sp = SPECIES[speciesId]!;
    const c = generateCreature(rng, { speciesId, potential: Math.round(rng.normal(115, 20)), age: sp.lifeCurve.peakStart });
    c.ability = c.potential;
    return c;
  });
  return { id: `tm-${style}-${seed}`, name: style, creatures, tactic: autoTactic(creatures) };
}

interface Detail { matches: number; dmg: number; dot: number; freezes: number; curses: number; cleansed: number; maxPoison: number; abilities: Record<string, number> }
const details: Record<string, Detail> = {};

/** What a style actually did in a match (side = its side). */
function collect(style: string, r: MatchResult, side: Side) {
  const d = (details[style] ??= { matches: 0, dmg: 0, dot: 0, freezes: 0, curses: 0, cleansed: 0, maxPoison: 0, abilities: {} });
  d.matches++;
  const mine = (id: string | undefined) => id !== undefined && r.roster[id]?.side === side;
  for (const e of r.events) {
    if (e.type === 'attack' && e.hit && mine(e.actor)) d.dmg += e.damage;
    if (e.type === 'effectTick' && e.amount < 0 && !mine(e.target)) { d.dmg -= e.amount; d.dot -= e.amount; }
    if (e.type === 'effectApplied' && !mine(e.target)) {
      if (e.effect === 'frozen') d.freezes++;
      if (EFFECTS[e.effect]?.curse) d.curses++;
      if (e.effect === 'poisoned') d.maxPoison = Math.max(d.maxPoison, e.stacks ?? 1);
    }
    if (e.type === 'cleanse' && mine(e.actor)) d.cleansed += e.removed.length;
    if (e.type === 'spend' && e.ability && mine(e.actor)) d.abilities[e.ability] = (d.abilities[e.ability] ?? 0) + 1;
  }
}

const names = Object.keys(STYLES);
const t0 = performance.now();
const win: Record<string, Record<string, number>> = {};
const ko: Record<string, number> = {};
const rounds: Record<string, number> = {};
const played: Record<string, number> = {};
for (const a of names) {
  win[a] = {};
  for (const b of names) {
    if (a === b) continue;
    let w = 0;
    for (let i = 0; i < N; i++) {
      const ta = buildTeam(a, deriveSeed('arch', a, b, i, 'a'));
      const tb = buildTeam(b, deriveSeed('arch', a, b, i, 'b'));
      // Alternate sides so side 0 has no edge.
      const swap = i % 2 === 1;
      const r = simulateMatch({ seed: deriveSeed('arch-m', a, b, i), teams: swap ? [tb, ta] : [ta, tb] });
      const aWon = r.outcome.winner === (swap ? 1 : 0);
      if (args.detail) collect(a, r, swap ? 1 : 0);
      if (aWon) w++;
      ko[a] = (ko[a] ?? 0) + (r.outcome.method === 'ko' ? 1 : 0);
      rounds[a] = (rounds[a] ?? 0) + r.outcome.rounds;
      played[a] = (played[a] ?? 0) + 1;
    }
    win[a]![b] = w / N;
  }
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(6);
console.log(`${N} matches per pairing in ${((performance.now() - t0) / 1000).toFixed(1)} s (row = win rate against column)\n`);
console.log(''.padEnd(10) + names.map((n) => n.padStart(9)).join('') + '     avg    KO%  rounds');
for (const a of names) {
  const cells = names.map((b) => (a === b ? '—'.padStart(9) : pct(win[a]![b]!).padStart(9)));
  const others = names.filter((b) => b !== a).map((b) => win[a]![b]!);
  const avg = others.reduce((s, x) => s + x, 0) / others.length;
  console.log(a.padEnd(10) + cells.join('') + pct(avg).padStart(8) + pct(ko[a]! / played[a]!).padStart(7) + (rounds[a]! / played[a]!).toFixed(1).padStart(8));
}

if (args.detail) {
  console.log('\nstyle      dot share  freezes/m  curses/m  cleansed/m  max poison  — most used abilities');
  for (const a of names) {
    const d = details[a]!;
    const top = Object.entries(d.abilities).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${(v / d.matches).toFixed(1)}`).join(', ');
    console.log(
      a.padEnd(10) + pct(d.dot / Math.max(1, d.dmg)).padStart(10) + (d.freezes / d.matches).toFixed(1).padStart(11) + (d.curses / d.matches).toFixed(1).padStart(10) +
        (d.cleansed / d.matches).toFixed(1).padStart(12) + String(d.maxPoison).padStart(12) + '  — ' + top,
    );
  }
}
