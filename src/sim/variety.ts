/**
 * Variety of play: does a creature use its whole kit, or the same blow all match long? For each species, a creature
 * with every skill unlocked (each pair of its kit, basic attack included, equipped in turn) replaces one starter of a professional team. Prints, per species,
 * the share of its actions taken by its most used one, and per ability the uses per match and the « pick rate when
 * ready » (uses / actions taken while it was off cooldown): a strong ability is picked most times it is ready; one
 * picked < 25 % of the time it is ready is not worth its turn (the creature would rather hit).
 *   npm run sim:variety -- --matches 200 [--only troll,orc] [--abilities] [--set combat.ai.x=v,…]
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
const N = Math.max(10, Number(args.matches ?? 200));
const only = args.only?.split(',');

const CFG: GameConfig = structuredClone(DEFAULT_CONFIG);
for (const kv of args.set ? args.set.split(',') : []) {
  const [path, value] = kv.split('=');
  const keys = path!.split('.');
  let o = CFG as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  if (!o || !(keys.at(-1)! in o)) throw new Error(`unknown config key ${path}`);
  o[keys.at(-1)!] = Number(value);
}

interface AbStat { uses: number; ready: number }
interface SpStat { actions: number; rests: number; guards: number; abs: Record<string, AbStat> }
const stats: Record<string, SpStat> = {};

const species = SPECIES_IDS.filter((s) => !only || only.includes(s));
const t0 = performance.now();
for (const sid of species) {
  const sp = SPECIES[sid]!;
  const st: SpStat = (stats[sid] = { actions: 0, rests: 0, guards: 0, abs: {} });
  // Every pair of skills in turn (all unlocked), so each skill is seen equipped as often.
  const kit = [...sp.basic, ...sp.skills];
  const pairs = kit.flatMap((x, i) => kit.slice(i + 1).map((y) => [x, y]));
  for (let i = 0; i < N; i++) {
    const rng = new Rng(deriveSeed('variety', i));
    const a = generateTeam(rng, { quality: 'professional' });
    const b = generateTeam(rng, { quality: 'professional' });
    const slot = a.tactic.lineup[i % a.tactic.lineup.length]!;
    const fresh = generateCreature(new Rng(deriveSeed('variety-c', sid, i)), { speciesId: sid, potential: 130, age: sp.lifeCurve.peakStart });
    fresh.ability = fresh.potential;
    a.creatures = a.creatures.map((c) => (c.id === slot.creatureId ? fresh : c));
    const role = bestRole(fresh);
    const pair = pairs[i % pairs.length]!;
    a.tactic = { ...a.tactic, lineup: a.tactic.lineup.map((s) => (s.creatureId === slot.creatureId ? { ...s, creatureId: fresh.id, role, line: ROLES[role].defaultLine } : s)), skills: { ...(a.tactic.skills ?? {}), [fresh.id]: pair } };
    const r = simulateMatch({ seed: deriveSeed('variety-m', i), teams: [a, b] }, { cfg: CFG });
    // Round from which each ability is ready again.
    const readyAt: Record<string, number> = {};
    const act = (round: number, used: string | null) => {
      st.actions++;
      for (const id of pair) {
        if ((readyAt[id] ?? 0) > round) continue;
        const s = (st.abs[id] ??= { uses: 0, ready: 0 });
        s.ready++;
        if (used === id) s.uses++;
      }
    };
    for (const e of r.events) {
      if (e.type === 'spend' && e.actor === fresh.id) {
        if (e.ability === null) {
          st.guards++;
          act(e.round, null);
        } else {
          act(e.round, e.ability);
          if (e.cooldown > 0) readyAt[e.ability] = e.round + e.cooldown + 1;
        }
      } else if (e.type === 'rest' && e.actor === fresh.id) {
        st.rests++;
        act(e.round, null);
      }
    }
  }
}

console.log(`${species.length} species × ${N} matches in ${((performance.now() - t0) / 1000).toFixed(0)} s (every ability unlocked)\n`);
const rows = species.map((sid) => {
  const st = stats[sid]!;
  const uses = Object.entries(st.abs).map(([id, s]) => ({ id, ...s })).sort((x, y) => y.uses - x.uses);
  const top = uses[0];
  return { sid, st, uses, top: top ? top.uses / Math.max(1, st.actions) : 0 };
}).sort((x, y) => y.top - x.top);

console.log('species            top    actions/match  rest  guard   abilities: uses/match (pick rate when ready)');
for (const { sid, st, uses, top } of rows) {
  const per = (n: number) => (n / N).toFixed(1);
  const list = [...SPECIES[sid]!.basic, ...SPECIES[sid]!.skills].map((id) => {
    const s = st.abs[id] ?? { uses: 0, ready: 0 };
    const rate = s.ready ? s.uses / s.ready : 0;
    const cd = ABILITIES[id]!.cooldown;
    return `${id}${cd ? `·cd${cd}` : ''} ${per(s.uses)} (${(100 * rate).toFixed(0)}%)${cd && rate < 0.25 ? '!' : ''}`;
  });
  console.log(`${SPECIES[sid]!.name.padEnd(18)} ${(100 * top).toFixed(0).padStart(3)} %  ${per(st.actions).padStart(6)}       ${(100 * st.rests / Math.max(1, st.actions)).toFixed(0).padStart(3)}% ${(100 * st.guards / Math.max(1, st.actions)).toFixed(0).padStart(4)}%   ${list.join(' | ')}`);
  void uses;
}
const avg = rows.reduce((s, r) => s + r.top, 0) / Math.max(1, rows.length);
console.log(`\naverage top share ${(100 * avg).toFixed(0)} % · species above 70 %: ${rows.filter((r) => r.top > 0.7).length} / ${rows.length}`);

if (args.abilities) {
  // Abilities with a cooldown picked least often when ready.
  const all: { id: string; sid: string; rate: number; uses: number }[] = [];
  for (const { sid, st } of rows) for (const [id, s] of Object.entries(st.abs)) if (ABILITIES[id]!.cooldown > 0) all.push({ id, sid, rate: s.ready ? s.uses / s.ready : 0, uses: s.uses / N });
  console.log('\nLeast picked when ready (cooldown abilities):');
  for (const x of all.sort((p, q) => p.rate - q.rate).slice(0, 40)) console.log(`  ${x.id.padEnd(22)} ${ABILITIES[x.id]!.kind.padEnd(7)} ${(100 * x.rate).toFixed(0).padStart(3)} %  ${x.uses.toFixed(2)}/match  ${x.sid}`);
}
