/**
 * Plays one match in the terminal with full commentary and the post-match report.
 *   npm run sim:match -- --seed 1234 --a professional --b regional [--quiet]
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import type { QualityId } from '../data/config/index.ts';
import { SPECIES } from '../data/species.ts';
import { ROLES } from '../data/roles.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import { Commentator } from '../engine/commentary/commentator.ts';
import { buildReport } from '../engine/report/report.ts';
import { generateTeam } from '../engine/team/team.ts';
import { overallRating } from '../engine/creature/derived.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const seed = args.seed ?? String(Math.floor(performance.now() * 1000) % 1_000_000);
const rng = new Rng(deriveSeed(seed, 'teams'));
const a = generateTeam(rng, { quality: (args.a ?? 'professional') as QualityId });
const b = generateTeam(rng, { quality: (args.b ?? 'professional') as QualityId });

for (const team of [a, b]) {
  console.log(`\n== ${team.name} ==`);
  for (const slot of team.tactic.lineup) {
    const c = team.creatures.find((x) => x.id === slot.creatureId)!;
    console.log(`  ${c.name.padEnd(28)} ${SPECIES[c.speciesId]!.name.padEnd(12)} ${ROLES[slot.role].name.padEnd(11)} ${slot.line.padEnd(5)} OVR ${overallRating(c)}  ${c.traits.join(', ')}`);
  }
  console.log(`  bench: ${team.tactic.bench.map((id) => team.creatures.find((x) => x.id === id)!.name).join(', ')}`);
}

const result = simulateMatch({ seed, teams: [a, b] });
if (!args.quiet) {
  const commentator = new Commentator(result.seed, result.roster, [a.name, b.name]);
  console.log('');
  for (const line of commentator.narrateAll(result.events)) {
    const mark = line.importance === 2 ? '!!' : line.importance === 1 ? ' -' : '  ';
    console.log(`[R${String(line.round).padStart(2)}] ${mark} ${line.text}`);
  }
}

const report = buildReport(result, 0);
console.log(`\n== REPORT (${a.name}) — seed ${seed} ==`);
console.log(report.headline);
console.log('\nRatings:');
for (const c of report.creatures.filter((x) => x.played).sort((x, y) => x.side - y.side || y.rating - x.rating)) {
  const r = result.roster[c.id]!;
  console.log(
    `  ${c.side === 0 ? 'A' : 'B'} ${r.name.padEnd(28)} ${c.rating.toFixed(1)}  dmg ${String(c.damageDealt).padStart(4)}  taken ${String(c.damageTaken).padStart(4)}  hits ${c.hits}/${c.attacks}  KOs ${c.kos}${c.knockedOut ? '  (KO)' : ''}${c.exhaustedRound ? `  exhausted R${c.exhaustedRound}` : ''}`,
  );
}
console.log('\nKey moments:');
for (const m of report.keyMoments) console.log(`  R${m.round}: ${m.text}`);
console.log('\nAssistant:');
for (const r of report.remarks) console.log(`  [${r.tone}] ${r.text}`);
