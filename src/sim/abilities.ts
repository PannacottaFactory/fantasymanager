/**
 * What each skill (the basic attack included) is worth, per species: a creature of that species (every skill unlocked) replaces one starter of a
 * professional team. Paired arms on the same seeds and teams: equipped with the skill and a partner (another one of
 * its kit, in turn), against the partner alone. Prints how often the combat AI uses it and the win rate it adds
 * as the second skill, and its place among the species' six (win rate with it equipped). Nothing should be useless:
 * a skill the AI never picks, or one that loses matches, needs a rework.
 *   npm run sim:abilities -- --matches 300 [--only a,b] [--part 1/4] [--json] [--set combat.ai.debuffWeight=0.8,…] [--weight 2]
 * `--only` takes species or ability ids. `--weight w`: the tested skill's `aiWeight` is set to w for the run; `--wmult m` multiplies its current one.
 */
import { readFileSync } from 'node:fs';
import { Rng, deriveSeed } from '../core/rng.ts';
import type { AbilityDef } from '../data/schema.ts';
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
const weight = args.weight !== undefined ? Number(args.weight) : undefined;
const wmult = args.wmult !== undefined ? Number(args.wmult) : undefined;

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

/**
 * `--override file.json`: ability variants to try without editing the data, `{ id: { power?, staminaCost?, cooldown?,
 * aiWeight?, chances?: number[], durations?: number[] } }` (chances / durations per effect, in order).
 */
if (args.override) {
  const patch = JSON.parse(readFileSync(args.override, 'utf8')) as Record<string, Partial<AbilityDef> & { chances?: number[]; durations?: (number | undefined)[] }>;
  for (const [id, p] of Object.entries(patch)) {
    const a = ABILITIES[id];
    if (!a) throw new Error(`unknown ability ${id}`);
    const { chances, durations, ...rest } = p;
    Object.assign(a, rest);
    if (chances || durations) a.effects = a.effects?.map((e, i) => ({ ...e, chance: chances?.[i] ?? e.chance, duration: durations?.[i] ?? e.duration }));
  }
}

interface Job { sid: string; id: string }
const kitOf = (sid: string) => [...SPECIES[sid]!.basic, ...SPECIES[sid]!.skills];
const jobs: Job[] = SPECIES_IDS.flatMap((sid) => kitOf(sid).map((id) => ({ sid, id })))
  .filter((j) => !only || only.includes(j.id) || only.includes(j.sid))
  .filter((_, i) => i % parts === part - 1);

interface Row { id: string; kind: string; species: string; uses: number; withWin: number; withoutWin: number; delta: number }
const rows: Row[] = [];
const TOP_LEVEL = Math.max(...CFG.combat.skills.unlockLevels);

/** Win rate of side 0 and the uses of the skill by the tested creature, over N matches. */
function run({ sid, id: abilityId }: Job, keep: boolean): { win: number; uses: number } {
  let wins = 0;
  let uses = 0;
  const sp = SPECIES[sid]!;
  const partners = kitOf(sid).filter((x) => x !== abilityId);
  for (let i = 0; i < N; i++) {
    // Same creature, role, line and partner skill in both arms; only the tested skill is left out.
    const rng = new Rng(deriveSeed('abilities', i));
    const a = generateTeam(rng, { quality: 'professional' });
    const b = generateTeam(rng, { quality: 'professional' });
    const slot = a.tactic.lineup[i % a.tactic.lineup.length]!;
    const old = a.creatures.find((c) => c.id === slot.creatureId)!;
    const potential = Math.max(old.potential, (CFG.training.levels.steps[TOP_LEVEL - 1] ?? 120) + 5);
    const fresh = generateCreature(new Rng(deriveSeed('abilities-c', sid, i)), { speciesId: sid, potential, age: sp.lifeCurve.peakStart });
    fresh.ability = fresh.potential;
    const partner = partners[i % partners.length]!;
    a.creatures = a.creatures.map((c) => (c.id === old.id ? fresh : c));
    const role = bestRole(fresh);
    a.tactic = { ...a.tactic, lineup: a.tactic.lineup.map((s) => (s.creatureId === old.id ? { ...s, creatureId: fresh.id, role, line: ROLES[role].defaultLine } : s)), skills: { ...(a.tactic.skills ?? {}), [fresh.id]: keep ? [abilityId, partner] : [partner] } };
    const r = simulateMatch({ seed: deriveSeed('abilities-m', i), teams: [a, b] }, { cfg: CFG });
    if (r.outcome.winner === 0) wins++;
    for (const e of r.events) if (e.type === 'spend' && e.actor === fresh.id && e.ability === abilityId) uses++;
  }
  return { win: wins / N, uses: uses / N };
}

const t0 = performance.now();
for (const job of jobs) {
  const { id } = job;
  const def = ABILITIES[id]!;
  const savedWeight = def.aiWeight;
  if (weight !== undefined) def.aiWeight = weight;
  if (wmult !== undefined) def.aiWeight = (savedWeight ?? 1) * wmult;
  const w = run(job, true);
  def.aiWeight = savedWeight;
  const wo = run(job, false);
  const row: Row = { id, kind: ABILITIES[id]!.kind, species: job.sid, uses: w.uses, withWin: w.win, withoutWin: wo.win, delta: w.win - wo.win };
  rows.push(row);
  if (args.json) console.log(JSON.stringify(row));
}
if (!args.json) {
  console.log(`${jobs.length} skills × ${N} paired matches in ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
  // Place among the species' skills tested here (1 = the best one to equip).
  const rank = (r: Row) => rows.filter((x) => x.species === r.species && x.withWin > r.withWin).length + 1;
  console.log('skill                  kind     uses/match   win with  without   added   rank  species');
  for (const r of [...rows].sort((x, y) => x.delta - y.delta)) {
    const flag = r.uses < 0.15 ? '  ← rarely used' : r.delta <= -0.01 ? '  ← costs matches' : '';
    console.log(`${r.id.padEnd(22)} ${r.kind.padEnd(8)} ${r.uses.toFixed(2).padStart(6)}      ${(100 * r.withWin).toFixed(1).padStart(5)} %  ${(100 * r.withoutWin).toFixed(1).padStart(5)} %  ${(100 * r.delta >= 0 ? '+' : '') + (100 * r.delta).toFixed(1).padStart(4)}   ${String(rank(r)).padStart(3)}   ${r.species}${flag}`);
  }
  const avg = rows.reduce((t, r) => t + r.delta, 0) / Math.max(1, rows.length);
  console.log(`\naverage added ${(100 * avg).toFixed(2)} points · rarely used ${rows.filter((r) => r.uses < 0.15).length} · costing matches ${rows.filter((r) => r.delta <= -0.01).length} / ${rows.length}`);
}
