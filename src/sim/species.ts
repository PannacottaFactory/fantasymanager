/**
 * Species strength at equal potential: in professional teams, one starter is replaced by a creature of the
 * tested species (same potential, at its prime) and its win rate is measured. Prints a suggested value
 * multiplier per species (strong species should cost more).
 *   npm run sim:species -- --matches 300
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { SPECIES, SPECIES_IDS } from '../data/species.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { bestRole } from '../engine/creature/derived.ts';
import { generateCreature } from '../engine/creature/generate.ts';
import { ROLES } from '../data/roles.ts';
import { generateTeam } from '../engine/team/team.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const N = Math.max(20, Number(args.matches ?? 300));

const results: { id: string; win: number }[] = [];
const t0 = performance.now();
for (const id of SPECIES_IDS) {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const rng = new Rng(deriveSeed('species', i));
    const a = generateTeam(rng, { quality: 'professional' });
    const b = generateTeam(rng, { quality: 'professional' });
    // Replace one starter (rotating slot) by a creature of the tested species with the same potential.
    const slot = a.tactic.lineup[i % a.tactic.lineup.length]!;
    const old = a.creatures.find((c) => c.id === slot.creatureId)!;
    const sp = SPECIES[id]!;
    const fresh = generateCreature(new Rng(deriveSeed('species-c', id, i)), { speciesId: id, potential: old.potential, age: sp.lifeCurve.peakStart });
    fresh.ability = fresh.potential;
    a.creatures = a.creatures.map((c) => (c.id === old.id ? fresh : c));
    const role = bestRole(fresh);
    a.tactic = {
      ...a.tactic,
      lineup: a.tactic.lineup.map((s) => (s.creatureId === old.id ? { ...s, creatureId: fresh.id, role, line: ROLES[role].defaultLine } : s)),
    };
    const r = simulateMatch({ seed: deriveSeed('species-m', i), teams: [a, b] });
    if (r.outcome.winner === 0) wins++;
  }
  results.push({ id, win: wins / N });
}
const mean = results.reduce((s, r) => s + r.win, 0) / results.length;
console.log(`${N} matches per species in ${((performance.now() - t0) / 1000).toFixed(1)} s — mean win ${(mean * 100).toFixed(1)} %\n`);
console.log('species          win%   current ×   suggested ×');
for (const r of results.sort((x, y) => y.win - x.win)) {
  // ±10 points of win rate ≈ ±40 % of value.
  const suggested = Math.max(0.6, Math.min(1.6, 1 + (r.win - mean) * 4));
  console.log(`${r.id.padEnd(15)} ${(r.win * 100).toFixed(1).padStart(5)}   ${(SPECIES[r.id]!.valueMult ?? 1).toFixed(2).padStart(9)}   ${suggested.toFixed(2).padStart(11)}`);
}
