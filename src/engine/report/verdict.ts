/**
 * Why a match was won or lost, and what to do next time — from the events and, when known, the line-ups before the
 * match (strength, fatigue, morale, roles, lines, bench, orders). Pure: returns keys and values, worded by the UI.
 * Every reason weighs how much it mattered; the tips follow the heaviest reasons and are kept varied.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { SPECIES } from '../../data/species.ts';
import type { MatchResult, MatchSetup, Side } from '../combat/types.ts';
import { isInjured, overallRating } from '../creature/derived.ts';
import type { Aggression, Creature, Team } from '../model.ts';
import { analyzeMatch } from './analysis.ts';
import { buildReport } from './report.ts';

export type FactorKey =
  // before the match
  | 'weaker' | 'stronger' | 'tired' | 'fresher' | 'offRole' | 'benchBetter' | 'thinFront' | 'noHealer' | 'gloomy' | 'confident'
  | 'approachWon' | 'approachLost'
  // during the match
  | 'typesGood' | 'typesBad' | 'theirTypes' | 'outdamaged' | 'outdamagedThem' | 'kos' | 'theirStar' | 'ourStar' | 'weakLink'
  | 'misses' | 'crits' | 'dotGood' | 'dotBad' | 'cleansed' | 'breakPaid' | 'breakFailed' | 'unusedSubs' | 'controlled'
  | 'thorns' | 'spread' | 'backline' | 'healers' | 'sustain' | 'exhausted' | 'nerves' | 'disobey' | 'guarded' | 'healed'
  | 'close' | 'quick';

export type TipKey =
  | 'rest' | 'roles' | 'benchBetter' | 'frontLine' | 'healer' | 'morale' | 'counterApproach' | 'elements' | 'stopStar'
  | 'replaceWeak' | 'accuracy' | 'cleanseDot' | 'watchLive' | 'useSubs' | 'antiControl' | 'thornsRanged' | 'focus' | 'tank'
  | 'targetHealers' | 'cautious' | 'calm' | 'discipline' | 'improve' | 'keepGoing' | 'favourites';

export type TipTarget = 'tactics' | 'training' | 'recruit' | 'encyclopedia';
type Tone = 'good' | 'bad' | 'info';
type Vars = Record<string, string | number>;

export interface Factor {
  key: FactorKey;
  tone: Tone;
  vars: Vars;
  /** How much it weighed on the result (for ordering). */
  weight: number;
}

export interface Tip {
  key: TipKey;
  vars: Vars;
  to: TipTarget | null;
  weight: number;
}

export interface Verdict {
  won: boolean;
  /** The main reasons for the result (at most 4). */
  factors: Factor[];
  /** One point the other way: a weakness despite a win, a strength despite a loss. */
  counterpoint: Factor | null;
  tips: Tip[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

function starters(team: Team): Creature[] {
  return team.tactic.lineup.flatMap((s) => team.creatures.find((c) => c.id === s.creatureId) ?? []);
}

/** The approach that has the upper hand over `a`. */
function counterTo(a: Aggression, cfg: GameConfig): Aggression {
  const beats = cfg.combat.orders.ascendancy.beats;
  return (Object.keys(beats) as Aggression[]).find((k) => beats[k] === a) ?? 'balanced';
}

export function explainMatch(result: MatchResult, side: Side, setup?: MatchSetup, cfg: GameConfig = DEFAULT_CONFIG): Verdict {
  const opp: Side = side === 0 ? 1 : 0;
  const won = result.outcome.winner === side;
  const report = buildReport(result, side, cfg);
  const analysis = analyzeMatch(result, side, cfg);
  const rc = cfg.report.remarks;
  const factors: Factor[] = [];
  const tips: Tip[] = [];
  const name = (id: string) => result.roster[id]!.name;
  const names = (ids: string[]) => ids.map(name).join(', ');
  const add = (key: FactorKey, tone: Tone, weight: number, vars: Vars = {}) => factors.push({ key, tone, vars, weight });
  const tip = (key: TipKey, weight: number, to: TipTarget | null, vars: Vars = {}) => tips.push({ key, vars, to, weight });

  const mine = report.teams[side];
  const theirs = report.teams[opp];
  const ours = report.creatures.filter((c) => c.side === side && c.played);
  const them = report.creatures.filter((c) => c.side === opp && c.played);

  // ——— Before the match ———
  if (setup) {
    const team = setup.teams[side];
    const foe = setup.teams[opp];
    const ourStart = starters(team);
    const theirStart = starters(foe);
    const gap = Math.round(avg(ourStart.map((c) => overallRating(c))) - avg(theirStart.map((c) => overallRating(c))));
    if (gap <= -3) {
      add('weaker', 'bad', -gap * 2, { n: -gap });
      tip('improve', -gap, 'recruit', { n: -gap });
    }
    if (gap >= 3) add('stronger', 'good', gap * 2, { n: gap });

    const fatigue = Math.round(avg(ourStart.map((c) => c.condition.fatigue)));
    const theirFatigue = Math.round(avg(theirStart.map((c) => c.condition.fatigue)));
    const tired = ourStart.filter((c) => c.condition.fatigue >= 45);
    if (fatigue >= 25 && fatigue >= theirFatigue + 8) add('tired', 'bad', (fatigue - theirFatigue) / 2, { pct: fatigue, them: theirFatigue });
    else if (theirFatigue >= 25 && theirFatigue >= fatigue + 8) add('fresher', 'good', (theirFatigue - fatigue) / 2, { pct: fatigue, them: theirFatigue });
    if (tired.length) tip('rest', 1 + tired.reduce((sum, c) => sum + (c.condition.fatigue - 40) / 8, 0), 'tactics', { names: tired.map((c) => c.name).join(', ') });

    const morale = Math.round(avg(ourStart.map((c) => c.condition.morale)));
    if (morale < 45) {
      add('gloomy', 'bad', (50 - morale) / 3, { n: morale });
      tip('morale', 3, 'tactics');
    } else if (morale >= 72) add('confident', 'good', (morale - 60) / 4, { n: morale });

    const off = team.tactic.lineup.filter((s) => {
      const c = team.creatures.find((x) => x.id === s.creatureId);
      return c && !SPECIES[c.speciesId]?.roles.includes(s.role);
    });
    if (off.length) {
      add('offRole', 'bad', 3 * off.length, { names: names(off.map((s) => s.creatureId)) });
      tip('roles', 3 * off.length + 2, 'tactics', { names: names(off.map((s) => s.creatureId)) });
    }

    // A clearly better creature left on the bench.
    const benchIds = new Set([...team.tactic.lineup.map((s) => s.creatureId)]);
    const bench = team.creatures.filter((c) => !benchIds.has(c.id) && !isInjured(c) && c.condition.fatigue < 50);
    const bestBench = bench.sort((a, b) => overallRating(b) - overallRating(a))[0];
    const worstStarter = ourStart.slice().sort((a, b) => overallRating(a) - overallRating(b))[0];
    if (bestBench && worstStarter && overallRating(bestBench) >= overallRating(worstStarter) + 8) {
      const vars = { bench: bestBench.name, a: overallRating(bestBench), starter: worstStarter.name, b: overallRating(worstStarter) };
      if (!won) add('benchBetter', 'bad', 3, vars);
      tip('benchBetter', 2 + (overallRating(bestBench) - overallRating(worstStarter) - 8) / 2, 'tactics', vars);
    }

    const front = team.tactic.lineup.filter((s) => s.line === 'front').length;
    if (front < cfg.combat.cover.minFront) {
      add('thinFront', 'bad', 3, { n: front });
      tip('frontLine', 5, 'tactics', { n: cfg.combat.cover.minFront });
    }
    if (!team.tactic.lineup.some((s) => s.role === 'support') && mine.healing < 20 && theirs.damageDealt > mine.damageDealt) {
      add('noHealer', 'info', 2);
      tip('healer', 3, 'tactics');
    }

    const a = team.tactic.orders.aggression;
    const b = foe.tactic.orders.aggression;
    const beats = cfg.combat.orders.ascendancy.beats;
    const bonus = Math.round(cfg.combat.orders.ascendancy.bonus * 100);
    if (beats[a] === b) add('approachWon', 'good', 1.5, { ours: a, theirs: b, pct: bonus });
    else if (beats[b] === a) {
      add('approachLost', 'bad', 2, { ours: a, theirs: b, pct: bonus });
      tip('counterApproach', 4, 'tactics', { theirs: b, counter: counterTo(b, cfg) });
    }
    if (!Object.keys(team.tactic.favorites ?? {}).length && won === false) tip('favourites', 1, 'tactics');
  }

  // ——— During the match ———
  if (mine.avgElementMult <= rc.typeDisadvantage) {
    add('typesBad', 'bad', 5, { mult: round2(mine.avgElementMult) });
    tip('elements', 5, 'encyclopedia');
  } else if (mine.avgElementMult >= rc.typeAdvantage) add('typesGood', 'good', 5, { mult: round2(mine.avgElementMult) });
  if (theirs.avgElementMult >= rc.typeAdvantage) {
    add('theirTypes', 'bad', 4, { mult: round2(theirs.avgElementMult) });
    tip('elements', 4, 'encyclopedia');
  }

  const ratio = theirs.damageDealt ? mine.damageDealt / theirs.damageDealt : 2;
  if (ratio >= 1.3) add('outdamagedThem', 'good', Math.min(8, (ratio - 1) * 6), { a: mine.damageDealt, b: theirs.damageDealt });
  if (ratio <= 0.77) add('outdamaged', 'bad', Math.min(8, (1 / ratio - 1) * 6), { a: mine.damageDealt, b: theirs.damageDealt });
  if (Math.abs(mine.kos - theirs.kos) >= 2) add('kos', mine.kos > theirs.kos ? 'good' : 'bad', 1.5 * Math.abs(mine.kos - theirs.kos), { a: mine.kos, b: theirs.kos });

  // Stand-out creatures.
  const theirTop = them.slice().sort((x, y) => y.damageDealt - x.damageDealt)[0];
  if (theirTop && theirs.damageDealt > 0 && theirTop.damageDealt / theirs.damageDealt >= 0.33 && theirTop.damageDealt >= 80) {
    const vars = { name: name(theirTop.id), dmg: theirTop.damageDealt, kos: theirTop.kos, pct: Math.round((100 * theirTop.damageDealt) / theirs.damageDealt) };
    add('theirStar', 'bad', 4 + vars.pct / 15, vars);
    tip('stopStar', 4 + vars.pct / 15, 'tactics', { name: vars.name });
  }
  const best = ours.slice().sort((x, y) => y.rating - x.rating)[0];
  if (best && best.rating >= 7.5) add('ourStar', 'good', 3 + (best.rating - 7) * 2, { name: name(best.id), rating: best.rating.toFixed(1), dmg: best.damageDealt, heal: best.healing });
  const weak = ours.filter((c) => c.roundsPlayed >= 5 && c.rating <= 5).sort((x, y) => x.rating - y.rating)[0];
  if (weak) {
    add('weakLink', 'bad', 2 + (5.5 - weak.rating) * 2, { name: name(weak.id), rating: weak.rating.toFixed(1) });
    tip('replaceWeak', 3, 'tactics', { name: name(weak.id) });
  }

  // Accuracy and critical hits.
  if (mine.attacks >= 20) {
    const acc = Math.round((100 * mine.hits) / mine.attacks);
    if (acc < 62) {
      add('misses', 'bad', (65 - acc) / 3, { pct: acc });
      tip('accuracy', 2, 'training');
    }
  }
  if (mine.crits >= 5 && mine.crits > theirs.crits + 2) add('crits', 'good', 2, { n: mine.crits });

  // Analysis insights.
  for (const ins of analysis.insights) {
    const v = ins.vars;
    switch (ins.key) {
      case 'dotShare':
        add('dotGood', 'good', 3, { pct: v.pct!, effect: v.effect! });
        break;
      case 'enemyDot':
        add('dotBad', 'bad', 4, { pct: v.pct!, effect: v.effect! });
        tip('cleanseDot', 4, 'recruit', { effect: v.effect! });
        break;
      case 'cleansed':
        add('cleansed', 'good', 2, { n: v.n! });
        break;
      case 'breakPaid':
        add('breakPaid', 'good', 4, { n: v.n! });
        break;
      case 'breakFailed':
        add('breakFailed', 'bad', 4, { n: v.n! });
        tip('watchLive', 3, null);
        break;
      case 'turnsLost':
        add('controlled', 'bad', 3, { n: v.n! });
        tip('antiControl', 3, 'recruit');
        break;
      case 'thornsHurt':
        add('thorns', 'bad', 3, { n: v.n! });
        tip('thornsRanged', 3, 'tactics');
        break;
      case 'spread':
        add('spread', 'info', 2, { pct: v.pct! });
        tip('focus', 3, 'tactics');
        break;
      case 'backlineHit':
        add('backline', 'bad', 5, { pct: v.pct! });
        tip('tank', 5, 'tactics');
        break;
      case 'healersUntouched':
        add('healers', 'bad', 5, { n: v.n! });
        tip('targetHealers', 5, 'tactics');
        break;
      case 'enemySustain':
        add('sustain', 'bad', 3, { n: v.n! });
        tip('focus', 3, 'tactics');
        break;
      default:
        break;
    }
  }

  // Stamina, nerves, discipline.
  const exhausted = ours.filter((c) => c.exhaustedRound !== null && c.exhaustedRound <= rc.exhaustedEarlyRound);
  if (exhausted.length >= 2) {
    add('exhausted', 'bad', 2 * exhausted.length, { names: names(exhausted.map((c) => c.id)) });
    tip('cautious', 2 * exhausted.length, 'tactics');
  }
  const nervous = ours.filter((c) => c.fled || c.hesitations >= 2);
  if (nervous.length) {
    add('nerves', 'bad', 3 * nervous.length, { names: names(nervous.map((c) => c.id)) });
    tip('calm', 3 * nervous.length, 'tactics', { names: names(nervous.map((c) => c.id)) });
  }
  const unruly = ours.filter((c) => c.disobeys >= rc.disobeyCount);
  if (unruly.length) {
    add('disobey', 'bad', 2 * unruly.length, { names: names(unruly.map((c) => c.id)) });
    tip('discipline', 2, 'training', { names: names(unruly.map((c) => c.id)) });
  }
  const guard = ours.slice().sort((x, y) => y.intercepts - x.intercepts)[0];
  if (guard && guard.intercepts >= 4) add('guarded', 'good', 2 + guard.intercepts / 3, { name: name(guard.id), n: guard.intercepts });
  if (mine.healing >= 80) add('healed', 'good', 2 + mine.healing / 80, { n: mine.healing });

  // Substitutions left unused while someone was down or exhausted.
  const subsLeft = cfg.match.maxSubstitutions - mine.substitutions;
  const benchLeft = Object.values(result.roster).filter((r) => r.side === side && !r.starter && !report.creatures.find((c) => c.id === r.id)?.played).length;
  const needed = ours.some((c) => c.knockedOut || (c.exhaustedRound !== null && c.exhaustedRound < result.outcome.rounds - 2));
  if (!won && subsLeft > 0 && benchLeft > 0 && needed && result.outcome.rounds > cfg.match.breakRounds[0]!) {
    add('unusedSubs', 'bad', 3, { n: Math.min(subsLeft, benchLeft) });
    tip('useSubs', 4, null);
  }

  const o = result.outcome;
  if (o.method === 'points' && Math.abs(o.score[0] - o.score[1]) <= rc.closePointsMargin) add('close', 'info', 4, { a: o.score[side], b: o.score[opp] });
  if (won && o.method === 'ko' && o.rounds <= 8) add('quick', 'good', 4, { n: o.rounds });

  // ——— Choosing what to show ———
  const wanted: Tone = won ? 'good' : 'bad';
  const other: Tone = won ? 'bad' : 'good';
  const byWeight = (a: Factor, b: Factor) => b.weight - a.weight;
  const main = factors.filter((f) => f.tone === wanted).sort(byWeight);
  const extra = factors.filter((f) => f.tone === 'info').sort(byWeight);
  const shown = [...main, ...extra].slice(0, 4);
  const counterpoint = factors.filter((f) => f.tone === other).sort(byWeight)[0] ?? null;

  // Tips: heaviest first, one per kind, at most three.
  const picked: Tip[] = [];
  for (const t of tips.sort((a, b) => b.weight - a.weight)) {
    if (picked.some((p) => p.key === t.key)) continue;
    picked.push(t);
    if (picked.length === 3) break;
  }
  if (!picked.length) picked.push({ key: won ? 'keepGoing' : 'improve', vars: { n: 0 }, to: won ? null : 'training', weight: 0 });
  return { won, factors: shown, counterpoint, tips: picked };
}
