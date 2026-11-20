/**
 * Surprises: how often the weaker side wins, by strength gap, and how often a match turns around.
 * Strength = average selection score (overall rating × fatigue) of the five starters, as fielded.
 * One attribute point on every attribute = +5 rating.
 *   npm run sim:upsets -- --matches 3000            random tiers (novice … elite) on each side
 *   npm run sim:upsets -- --league --worlds 4 --seasons 2   real league fixtures on autopilot
 *   --set path=v,…   config variant
 */
import { Rng, deriveSeed } from '../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../data/config/index.ts';
import { simulateMatch } from '../engine/combat/simulate.ts';
import type { MatchResult, MatchSetup } from '../engine/combat/types.ts';
import { applyEvent, initialView, judgesScore } from '../engine/combat/view.ts';
import { renew } from '../engine/economy/actions.ts';
import { cupDue, fixtureSetup, newGame, playMatchday, seasonOver, startNextSeason, teamById } from '../engine/league/season.ts';
import type { GameState } from '../engine/league/types.ts';
import type { Team } from '../engine/model.ts';
import { generateTeam } from '../engine/team/team.ts';
import { matchForecast, sideStrength, winChance } from '../engine/report/forecast.ts';
import { parseArgs } from './args.ts';

const args = parseArgs(process.argv.slice(2));
const league = 'league' in args;
const N = Number(args.matches ?? 3000);
const worlds = Number(args.worlds ?? 4);
const seasons = Number(args.seasons ?? 2);

function withSet(base: GameConfig, spec: unknown): GameConfig {
  if (typeof spec !== 'string' || !spec) return base;
  const cfg = structuredClone(base);
  for (const pair of spec.split(',')) {
    const [path, v] = pair.split('=');
    const keys = path!.split('.');
    let o = cfg as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
    o[keys.at(-1)!] = Number(v);
  }
  return cfg;
}
const cfg = withSet(DEFAULT_CONFIG, args.set);

const strength = (t: Team) => sideStrength(t, cfg);

const BINS = [0, 1, 2, 3.5, 5, 7.5, 10, Infinity];
const binOf = (gap: number) => BINS.findIndex((b, i) => gap >= b && gap < BINS[i + 1]!);
const byBin = BINS.slice(0, -1).map(() => ({ n: 0, upsets: 0, koUpsets: 0 }));
let total = 0;
let upsets = 0;
let leadChanges = 0;
let decided = 0; // matches with a judges' leader at a break
const breaks = [5, 10, 15];
const turned = breaks.map(() => ({ n: 0, flipped: 0, favBehind: 0, favBehindWon: 0, dogBehind: 0, dogBehindWon: 0 }));
let biggestLeadLost = 0;
const shown = Array.from({ length: 5 }, () => ({ n: 0, p: 0, won: 0 }));
const calib = Array.from({ length: 10 }, () => ({ n: 0, p: 0, won: 0 }));
const grace = { matches: 0, n: 0, dog: 0, wonAfter: 0, wonOff: 0, flipped: 0, flippedToDog: 0, byCourage: [0, 0, 0] };
const noGrace: GameConfig = { ...cfg, combat: { ...cfg.combat, grace: { ...cfg.combat.grace, chance: 0 } } };

function record(setup: MatchSetup, r: MatchResult) {
  const s = [strength(setup.teams[0]), strength(setup.teams[1])] as const;
  const gap = Math.abs(s[0] - s[1]);
  const fav = s[0] >= s[1] ? 0 : 1;
  const win = r.outcome.winner;
  total++;
  const p = winChance(s[0] - s[1], cfg);
  const cb = calib[Math.min(9, Math.floor(p * 10))]!;
  cb.n++;
  cb.p += p;
  if (win === 0) cb.won++;
  const bin = byBin[binOf(gap)]!;
  bin.n++;
  if (win !== fav) {
    bin.upsets++;
    if (r.outcome.method === 'ko') bin.koUpsets++;
    if (gap >= 1) upsets++;
  }
  // Touched by grace: how often, for whom, and what it changed (same match replayed without it: own RNG stream).
  const graces = r.events.filter((e) => e.type === 'grace');
  let off: MatchResult | null = null;
  if (graces.length) {
    grace.matches++;
    off = simulateMatch(structuredClone(setup), { cfg: noGrace });
    if (off.outcome.winner !== win) {
      grace.flipped++;
      if (win !== fav) grace.flippedToDog++;
    }
  }
  for (const e of graces) {
    if (e.type !== 'grace') continue;
    const side = r.roster[e.actor]!.side;
    grace.n++;
    if (side !== fav) grace.dog++;
    if (win === side) grace.wonAfter++;
    if (off?.outcome.winner === side) grace.wonOff++;
    const courage = setup.teams[side].creatures.find((c) => c.id === e.actor)?.attributes.courage ?? 10;
    grace.byCourage[courage <= 7 ? 0 : courage <= 13 ? 1 : 2]!++;
  }
  // Leader at each round end (judges' score), lead changes, comebacks from the breaks.
  let v = initialView(r.roster);
  let leader: 0 | 1 | null = null;
  let maxLeadLoser = 0;
  for (const e of r.events) {
    v = applyEvent(v, e);
    if (e.type !== 'roundEnd') continue;
    const j0 = judgesScore(v, 0);
    const j1 = judgesScore(v, 1);
    const lead: 0 | 1 | null = j0 === j1 ? leader : j0 > j1 ? 0 : 1;
    if (leader !== null && lead !== leader) leadChanges++;
    leader = lead;
    const loserLead = win === 0 ? j1 - j0 : j0 - j1;
    if (loserLead > maxLeadLoser) maxLeadLoser = loserLead;
    const k = breaks.indexOf(e.round);
    if (k >= 0 && j0 !== j1 && r.outcome.rounds > e.round) {
      const t = turned[k]!;
      const ahead = j0 > j1 ? 0 : 1;
      t.n++;
      if (ahead !== win) t.flipped++;
      if (ahead !== fav) {
        t.favBehind++;
        if (win === fav) t.favBehindWon++;
      } else {
        t.dogBehind++;
        if (win !== fav) t.dogBehindWon++;
      }
      if (k === 0) decided++;
    }
  }
  if (maxLeadLoser > biggestLeadLost) biggestLeadLost = maxLeadLoser;
}

const t0 = performance.now();
if (!league) {
  const tiers: QualityId[] = ['novice', 'regional', 'professional', 'elite'];
  for (let i = 0; i < N; i++) {
    const rng = new Rng(deriveSeed('upsets', i));
    const a = generateTeam(rng, { quality: tiers[rng.int(0, tiers.length - 1)]! }, cfg);
    const b = generateTeam(rng, { quality: tiers[rng.int(0, tiers.length - 1)]! }, cfg);
    const setup: MatchSetup = { seed: deriveSeed('upsets', 'm', i), teams: [a, b] };
    record(setup, simulateMatch(setup, { cfg }));
  }
} else {
  for (let w = 0; w < worlds; w++) {
    let g: GameState = newGame({ seed: `upsets-${w}`, teamName: '', lang: 'en' }, cfg);
    for (let s = 0; s < seasons; s++) {
      if (s > 0) {
        const mine = teamById(g, g.playerTeamId).creatures.filter((c) => c.contract && c.contract.untilSeason < g.season + 1);
        for (const c of mine.sort((a, b) => b.ability - a.ability).slice(0, 8)) g = renew(g, c.id, 2).state;
        g = startNextSeason(g, cfg);
      }
      while (!seasonOver(g, cfg)) {
        if (!cupDue(g, cfg)) {
          // The same setups the league is about to play (fatigue, line-ups, arena), measured before the week runs.
          for (const f of g.fixtures.filter((x) => !x.competition && x.matchday === g.matchday && !x.result)) {
            const { setup } = fixtureSetup(g, f, cfg);
            const r = simulateMatch(structuredClone(setup), { cfg });
            record(setup, r);
            if (f.home === g.playerTeamId || f.away === g.playerTeamId) {
              // What the player is shown (own side exact, theirs estimated): the player is side 0.
              const p = matchForecast(g, setup.teams[0], setup.teams[1], cfg).win;
              const c = shown[Math.min(4, Math.floor(p * 5))]!;
              c.n++;
              c.p += p;
              if (r.outcome.winner === 0) c.won++;
            }
          }
        }
        g = playMatchday(g, null, cfg);
      }
    }
  }
}
const ms = performance.now() - t0;

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—').padStart(7);
console.log(`\n${total} matches (${league ? `league, ${worlds} worlds × ${seasons} seasons` : 'random tiers'}) in ${(ms / 1000).toFixed(1)} s`);
console.log('Strength = starters’ average rating × fatigue (+5 = one point on every attribute)\n');
console.log('Gap          matches   weaker wins   (by KO)');
byBin.forEach((b, i) => {
  if (!b.n) return;
  const label = `${BINS[i]}–${BINS[i + 1] === Infinity ? '…' : BINS[i + 1]}`.padEnd(10);
  console.log(`${label} ${String(b.n).padStart(8)}   ${pct(b.upsets, b.n)}     ${pct(b.koUpsets, b.upsets)}`);
});
console.log(`\nUpsets (gap ≥ 1): ${pct(upsets, total - byBin[0]!.n)} of the matches with a favourite`);
console.log(`Lead changes per match (judges' score, round ends): ${(leadChanges / total).toFixed(2)}`);
console.log(`Biggest judges' lead turned around: ${biggestLeadLost} points`);
console.log('\nAt the break   leader loses   favourite behind → wins   underdog behind → wins');
breaks.forEach((r, k) => {
  const t = turned[k]!;
  console.log(`after ${String(r).padEnd(8)} ${pct(t.flipped, t.n)}      ${pct(t.favBehindWon, t.favBehind)} (${t.favBehind})        ${pct(t.dogBehindWon, t.dogBehind)} (${t.dogBehind})`);
});
console.log(
  `\nTouched by grace: in ${pct(grace.matches, total)} of the matches · ${grace.n} times, ${pct(grace.dog, grace.n)} to the weaker side · ` +
    `side touched won ${pct(grace.wonAfter, grace.n)} (without it ${pct(grace.wonOff, grace.n)}) · result changed by it ${pct(grace.flipped, total)} of all matches (${pct(grace.flippedToDog, grace.flipped)} for the weaker side) · ` +
    `courage ≤7 / 8–13 / ≥14: ${grace.byCourage.join(' / ')}`,
);
console.log('\nForecast calibration (cfg.report.forecast, true strengths): predicted → actual');
for (const c of calib) if (c.n) console.log(`  ${pct(c.p, c.n)} → ${pct(c.won, c.n)}  (${c.n})`);
if (league) {
  console.log('\nForecast shown to the player (estimates): predicted → actual');
  for (const c of shown) if (c.n) console.log(`  ${pct(c.p, c.n)} → ${pct(c.won, c.n)}  (${c.n})`);
}
void decided;
