/**
 * What each ability is worth: a creature of a species that has it (ability unlocked) replaces one starter of a
 * professional team; the same matches are played with and without that ability. Prints, per ability, how often the
 * combat AI uses it and the win rate it adds (paired: same seeds, same teams). Nothing should be useless: an ability
 * the AI never picks, or one that loses matches, needs a rework.
 *   npm run sim:abilities -- --matches 500 [--only a,b] [--part 1/4] [--json] [--set combat.ai.debuffWeight=0.8,…]
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { ABILITIES } from '../data/abilities.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../data/config/index.ts';
import { SPECIES, SPECIES_IDS } from '../data/species.ts';
import { ROLES } from '../data/roles.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { bestRole } from '../engine/creature/derived.ts';
import { generateCreature } from '../engine/creature/generate.ts';
import { generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(20, Number(args.matches ?? 500));
const only = args.only?.split(',');
const [part, parts] = (args.part ?? '1/1').split('/').map(Number) as [number, number];

/** `--set a.b.c=v,…`: config variant used by every match (e.g. combat.ai.debuffWeight=0.8). */
const CFG: GameConfig = structuredClone(DEFAULT_CONFIG);
for (const kv of args.set ? args.set.split(',') : []) {
  const [path, value] = kv.split('=');
  const keys = path!.split('.');
  let o = CFG as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  if (!o || !(keys.at(-1)! in o)) throw new Error(`unknown config key ${path}`);
  o[keys.at(-1)!] = Number(value);
}

const owners = new Map<string, string[]>();
for (const sid of SPECIES_IDS) for (const a of SPECIES[sid]!.abilities) owners.set(a.id, [...(owners.get(a.id) ?? []), sid]);
const ids = [...owners.keys()].filter((id) => !only || only.includes(id)).sort().filter((_, i) => i % parts === part - 1);

interface Row { id: string; kind: string; species: string; uses: number; withWin: number; withoutWin: number; delta: number }
const rows: Row[] = [];

/** Win rate of side 0 and the uses of the ability by the tested creature, over N matches. */
function run(abilityId: string, keep: boolean): { win: number; uses: number } {
  let wins = 0;
  let uses = 0;
  const list = owners.get(abilityId)!;
  for (let i = 0; i < N; i++) {
    const sid = list[i % list.length]!;
    const sp = SPECIES[sid]!;
    const ref = sp.abilities.find((a) => a.id === abilityId)!;
    const saved = sp.abilities;
    try {
      // Same creature, role and line in both arms (chosen with the full kit); only the fight goes without the ability.
      const rng = new Rng(deriveSeed('abilities', i));
      const a = generateTeam(rng, { quality: 'professional' });
      const b = generateTeam(rng, { quality: 'professional' });
      const slot = a.tactic.lineup[i % a.tactic.lineup.length]!;
      const old = a.creatures.find((c) => c.id === slot.creatureId)!;
      const potential = Math.max(old.potential, (ref.minAbility ?? 0) + 5);
      const fresh = generateCreature(new Rng(deriveSeed('abilities-c', sid, i)), { speciesId: sid, potential, age: sp.lifeCurve.peakStart });
      fresh.ability = fresh.potential;
      a.creatures = a.creatures.map((c) => (c.id === old.id ? fresh : c));
      const role = bestRole(fresh);
      a.tactic = { ...a.tactic, lineup: a.tactic.lineup.map((s) => (s.creatureId === old.id ? { ...s, creatureId: fresh.id, role, line: ROLES[role].defaultLine } : s)) };
      if (!keep) sp.abilities = saved.filter((x) => x.id !== abilityId);
      const r = simulateMatch({ seed: deriveSeed('abilities-m', i), teams: [a, b] }, { cfg: CFG });
      if (r.outcome.winner === 0) wins++;
      for (const e of r.events) if (e.type === 'spend' && e.actor === fresh.id && e.ability === abilityId) uses++;
    } finally {
      sp.abilities = saved;
    }
  }
  return { win: wins / N, uses: uses / N };
}

const t0 = performance.now();
for (const id of ids) {
  const w = run(id, true);
  const wo = run(id, false);
  const row: Row = { id, kind: ABILITIES[id]!.kind, species: owners.get(id)!.join(','), uses: w.uses, withWin: w.win, withoutWin: wo.win, delta: w.win - wo.win };
  rows.push(row);
  if (args.json) console.log(JSON.stringify(row));
}
if (!args.json) {
  console.log(`${ids.length} abilities × ${N} paired matches in ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
  console.log('ability                kind     uses/match   win with  without   added   species');
  for (const r of rows.sort((x, y) => x.delta - y.delta)) {
    const flag = r.uses < 0.15 ? '  ← rarely used' : r.delta <= -0.01 ? '  ← costs matches' : '';
    console.log(`${r.id.padEnd(22)} ${r.kind.padEnd(8)} ${r.uses.toFixed(2).padStart(6)}      ${(100 * r.withWin).toFixed(1).padStart(5)} %  ${(100 * r.withoutWin).toFixed(1).padStart(5)} %  ${(100 * r.delta >= 0 ? '+' : '') + (100 * r.delta).toFixed(1).padStart(4)}   ${r.species}${flag}`);
  }
}
