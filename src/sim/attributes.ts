/**
 * What attribute points are worth in the arena: the same squad with a few points more against itself unchanged, against
 * varied opponents of the same level (paired: same opponent, same seed, with and without the points).
 *   npm run sim:attributes -- --matches 1000            (add --quick to skip the per-attribute ranking)
 *   --only speed,courage      only the ranking, for these attributes
 *   --set combat.initiative.noise=3,combat.morale.performanceSwing=0.12   config variant (both sides)
 * Sections: one level (2 points) on one / every starter, five levels on one creature, +1 in one attribute for every
 * starter (ranking of the 21 attributes), and the health given by strength (perStrength 1 / 2 / 3).
 */
import { ATTRIBUTE_KEYS, type AttributeKey } from '../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../data/config/index.ts';
import { Rng, deriveSeed } from '../core/rng.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import type { RoleId } from '../data/schema.ts';
import type { Team } from '../engine/model.ts';
import { cloneTeam, generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(100, Number(args.matches ?? 1000));
const quick = !!args.quick;
/** `--points n`: points per attribute in the ranking (more points = clearer signal, default 1). */
const PTS = Math.max(1, Number(args.points ?? 1));
const only = args.only ? (args.only.split(',') as AttributeKey[]) : null;
/** `--set a.b.c=v,…`: config variant used by every match. */
const CFG: GameConfig = structuredClone(DEFAULT_CONFIG);
const sets = args.set ? args.set.split(',') : [];
for (const kv of sets) {
  const [path, value] = kv.split('=');
  const keys = path!.split('.');
  let o = CFG as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  if (!o || !(keys.at(-1)! in o)) throw new Error(`unknown config key ${path}`);
  o[keys.at(-1)!] = Number(value);
}
const t0 = performance.now();

const squad = (i: number) => generateTeam(new Rng(deriveSeed('attr', i)), { quality: 'professional' });
type Mod = (t: Team) => Team;

/** Where a sensible manager puts a role's points (the role's two heaviest attributes, alternately). */
const ROLE_POINTS: Record<RoleId, AttributeKey[]> = {
  striker: ['strength', 'attack'],
  tank: ['toughness', 'defense'],
  caster: ['magic', 'focus'],
  support: ['magic', 'focus'],
  skirmisher: ['speed', 'agility'],
};

function addPoints(t: Team, slot: number | 'all', n: number, key?: AttributeKey): Team {
  const slots = slot === 'all' ? t.tactic.lineup : [t.tactic.lineup[slot]!];
  for (const s of slots) {
    const c = t.creatures.find((x) => x.id === s.creatureId)!;
    const keys = key ? [key] : ROLE_POINTS[s.role];
    for (let k = 0; k < n; k++) {
      // Next key below the 20 cap (skip a capped one).
      for (let j = 0; j < keys.length; j++) {
        const a = keys[(k + j) % keys.length]!;
        if (c.attributes[a] < 20) {
          c.attributes[a]++;
          break;
        }
      }
    }
  }
  return t;
}

/** Index of the starter with the highest / lowest attribute sum. */
function starterBy(t: Team, best: boolean): number {
  const sums = t.tactic.lineup.map((s) => {
    const c = t.creatures.find((x) => x.id === s.creatureId)!;
    return ATTRIBUTE_KEYS.reduce((acc, k) => acc + c.attributes[k], 0);
  });
  const target = best ? Math.max(...sums) : Math.min(...sums);
  return sums.indexOf(target);
}

interface Out {
  base: number;
  changed: number;
  /** Standard error of the paired gap (discordant pairs). */
  se: number;
  ko: number;
  rounds: number;
}

function measure(mod: Mod, cfg: GameConfig = CFG): Out {
  let w0 = 0;
  let w1 = 0;
  let disc = 0;
  let ko = 0;
  let rounds = 0;
  for (let i = 0; i < N; i++) {
    const base = squad(i);
    const b = squad(i + 100000);
    const swap = i % 2 === 1;
    const seed = deriveSeed('attr-m', i);
    const play = (a: Team) => {
      const r = simulateMatch({ seed, teams: swap ? [cloneTeam(b, 'b'), a] : [a, cloneTeam(b, 'b')] }, { cfg });
      return {
        won: r.outcome.winner === (swap ? 1 : 0),
        ko: r.outcome.method === 'ko',
        rounds: r.outcome.rounds,
      };
    };
    const r0 = play(cloneTeam(base, 'a'));
    const r1 = play(mod(cloneTeam(base, 'a')));
    if (r0.won) w0++;
    if (r1.won) w1++;
    if (r0.won !== r1.won) disc++;
    if (r0.ko) ko++;
    rounds += r0.rounds;
  }
  return {
    base: w0 / N,
    changed: w1 / N,
    se: Math.sqrt(disc) / N,
    ko: ko / N,
    rounds: rounds / N,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const gapText = (o: Out) => {
  const g = (o.changed - o.base) * 100;
  return `${pct(o.base)} → ${pct(o.changed)}  (${g >= 0 ? '+' : ''}${g.toFixed(1)} ± ${(o.se * 100 * 1.96).toFixed(1)})`;
};
const line = (label: string, o: Out) => console.log(`${label.padEnd(46)} ${gapText(o)}`);

console.log(`${N} paired matches per line, professional squads against varied opponents of the same level.
Win rate without → with the points (gap in points of win rate ± 95 % margin).
`);

if (sets.length)
  console.log(`Config: ${sets.join(', ')}
`);
if (!only) {
  console.log('— Levels (points placed by role: striker strength/attack, tank toughness/defense, caster & support magic/focus, skirmisher speed/agility)');
  const first = measure((t) => addPoints(t, starterBy(t, true), 2));
  console.log(`(unchanged match: KO ${pct(first.ko)}, ${first.rounds.toFixed(1)} rounds on average)`);
  line('1 level (+2) on the best starter', first);
  line(
    '1 level (+2) on the weakest starter',
    measure((t) => addPoints(t, starterBy(t, false), 2)),
  );
  line(
    '1 level (+2) on every starter',
    measure((t) => addPoints(t, 'all', 2)),
  );
  line(
    '5 levels (+10) on the best starter',
    measure((t) => addPoints(t, starterBy(t, true), 10)),
  );
  line(
    '5 levels (+10) on every starter',
    measure((t) => addPoints(t, 'all', 10)),
  );

  console.log('\n— Strength and health (+2 strength on every starter; KO rate of the unchanged match)');
  for (const per of [1, 2, 3]) {
    const cfg: GameConfig = {
      ...CFG,
      combat: { ...CFG.combat, hp: { ...CFG.combat.hp, perStrength: per } },
    };
    const o = measure((t) => addPoints(t, 'all', 2, 'strength'), cfg);
    line(`perStrength ${per} (KO ${pct(o.ko)})`, o);
  }
}

if (!quick || only) {
  console.log(`\n— +${PTS} in one attribute for every starter (best first)`);
  const rows = (only ?? ATTRIBUTE_KEYS).map((k) => ({
    k,
    o: measure((t) => addPoints(t, 'all', PTS, k)),
  }));
  rows.sort((a, b) => b.o.changed - b.o.base - (a.o.changed - a.o.base));
  for (const r of rows) line(r.k, r.o);
  console.log(`(unchanged match: KO ${pct(rows[0]!.o.ko)}, ${rows[0]!.o.rounds.toFixed(1)} rounds on average)`);
}

console.log(`\n${((performance.now() - t0) / 1000).toFixed(1)} s`);
