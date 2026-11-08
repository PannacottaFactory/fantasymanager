/**
 * Headless balancing batch: simulates many matches and prints aggregate statistics.
 *   npm run sim:batch -- --matches 500 --a professional --b professional --seed 42
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { DEFAULT_CONFIG, type QualityId } from '../data/config/index.ts';
import { SPECIES } from '../data/species.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { generateTeam } from '../engine/team/team.ts';
import { buildReport } from '../engine/report/report.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const matches = Number(args.matches ?? 300);
const qa = (args.a ?? 'professional') as QualityId;
const qb = (args.b ?? qa) as QualityId;
const seed = String(args.seed ?? 'batch');

let rounds = 0;
let kos = 0;
let winsA = 0;
const counts: Record<string, number> = {};
const species: Record<string, { played: number; rating: number; wins: number }> = {};
let injuries = 0;

const t0 = performance.now();
for (let i = 0; i < matches; i++) {
  const rng = new Rng(deriveSeed(seed, i));
  const a = generateTeam(rng, { quality: qa });
  const b = generateTeam(rng, { quality: qb });
  const res = simulateMatch({ seed: deriveSeed(seed, 'match', i), teams: [a, b] });
  rounds += res.outcome.rounds;
  if (res.outcome.method === 'ko') kos++;
  if (res.outcome.winner === 0) winsA++;
  for (const e of res.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  injuries += res.postMatch.reduce((s, p) => s + p.injuries.length, 0);
  const report = buildReport(res, 0, DEFAULT_CONFIG);
  for (const cr of report.creatures) {
    if (!cr.played) continue;
    const sp = (species[res.roster[cr.id]!.speciesId] ??= { played: 0, rating: 0, wins: 0 });
    sp.played++;
    sp.rating += cr.rating;
    if (res.outcome.winner === res.roster[cr.id]!.side) sp.wins++;
  }
}
const ms = performance.now() - t0;

const pct = (n: number) => `${((100 * n) / matches).toFixed(1)}%`;
console.log(`\n${matches} matches  (${qa} vs ${qb})  in ${ms.toFixed(0)} ms  (${(ms / matches).toFixed(2)} ms/match)`);
console.log(`avg rounds ${(rounds / matches).toFixed(1)} | KO finishes ${pct(kos)} | side A wins ${pct(winsA)} | injuries/match ${(injuries / matches).toFixed(2)}`);
console.log('\nEvents per match:');
for (const [k, v] of Object.entries(counts).sort((x, y) => y[1] - x[1])) console.log(`  ${k.padEnd(14)} ${(v / matches).toFixed(2)}`);
console.log('\nSpecies (appearances, avg rating, win%):');
for (const [id, s] of Object.entries(species).sort((x, y) => y[1].rating / y[1].played - x[1].rating / x[1].played)) {
  console.log(`  ${SPECIES[id]!.name.padEnd(14)} ${String(s.played).padStart(5)}  ${(s.rating / s.played).toFixed(2)}  ${((100 * s.wins) / s.played).toFixed(1)}%`);
}
