/**
 * Why a match was won or lost, and what to do next time — from the events (and, when known, the line-ups before
 * the match: strength, fatigue, roles). Pure: returns keys and numbers, worded by the UI.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { SPECIES } from '../../data/species.ts';
import type { MatchResult, MatchSetup, Side } from '../combat/types.ts';
import { overallRating } from '../creature/derived.ts';
import type { Creature, Team } from '../model.ts';
import { analyzeMatch } from './analysis.ts';
import { buildReport } from './report.ts';

export type FactorKey =
  | 'stronger' | 'weaker' | 'tired' | 'fresher' | 'typesGood' | 'typesBad' | 'offRole' | 'backline' | 'healers'
  | 'sustain' | 'exhausted' | 'nerves' | 'outdamaged' | 'outdamagedThem' | 'kos' | 'close' | 'turnsLost';

export type TipKey = 'rest' | 'roles' | 'elements' | 'tank' | 'targetHealers' | 'cautious' | 'improve' | 'keepGoing' | 'calm' | 'focus';
export type TipTarget = 'tactics' | 'training' | 'recruit' | 'encyclopedia';

export interface Factor {
  key: FactorKey;
  tone: 'good' | 'bad' | 'info';
  vars: Record<string, string | number>;
  /** How much it weighed on the result (for ordering). */
  weight: number;
}

export interface Tip {
  key: TipKey;
  vars: Record<string, string | number>;
  to: TipTarget | null;
}

export interface Verdict {
  won: boolean;
  factors: Factor[];
  tips: Tip[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function starters(team: Team): Creature[] {
  return team.tactic.lineup.flatMap((s) => team.creatures.find((c) => c.id === s.creatureId) ?? []);
}

export function explainMatch(result: MatchResult, side: Side, setup?: MatchSetup, cfg: GameConfig = DEFAULT_CONFIG): Verdict {
  const opp: Side = side === 0 ? 1 : 0;
  const won = result.outcome.winner === side;
  const report = buildReport(result, side, cfg);
  const analysis = analyzeMatch(result, side, cfg);
  const rc = cfg.report.remarks;
  const factors: Factor[] = [];
  const tips: Tip[] = [];
  const names = (ids: string[]) => ids.map((id) => result.roster[id]!.name).join(', ');

  // ——— From the line-ups before the match ———
  if (setup) {
    const ours = starters(setup.teams[side]);
    const theirs = starters(setup.teams[opp]);
    const gap = Math.round(avg(ours.map((c) => overallRating(c))) - avg(theirs.map((c) => overallRating(c))));
    if (gap <= -3) factors.push({ key: 'weaker', tone: 'bad', vars: { n: -gap }, weight: -gap * 2 });
    if (gap >= 3) factors.push({ key: 'stronger', tone: 'good', vars: { n: gap }, weight: gap * 2 });

    const fatigue = Math.round(avg(ours.map((c) => c.condition.fatigue)));
    const theirFatigue = Math.round(avg(theirs.map((c) => c.condition.fatigue)));
    const tired = ours.filter((c) => c.condition.fatigue >= 40);
    if (fatigue >= 25 && fatigue >= theirFatigue + 8) {
      factors.push({ key: 'tired', tone: 'bad', vars: { pct: fatigue, them: theirFatigue }, weight: (fatigue - theirFatigue) / 2 });
    } else if (theirFatigue >= 25 && theirFatigue >= fatigue + 8) {
      factors.push({ key: 'fresher', tone: 'good', vars: { pct: fatigue, them: theirFatigue }, weight: (theirFatigue - fatigue) / 2 });
    }
    if (tired.length) tips.push({ key: 'rest', vars: { names: tired.map((c) => c.name).join(', ') }, to: 'tactics' });

    const off = setup.teams[side].tactic.lineup.filter((s) => {
      const c = setup.teams[side].creatures.find((x) => x.id === s.creatureId);
      return c && !SPECIES[c.speciesId]?.roles.includes(s.role);
    });
    if (off.length) {
      factors.push({ key: 'offRole', tone: 'bad', vars: { names: names(off.map((s) => s.creatureId)), n: off.length }, weight: 3 * off.length });
      tips.push({ key: 'roles', vars: { names: names(off.map((s) => s.creatureId)) }, to: 'tactics' });
    }
    if (gap <= -3) tips.push({ key: 'improve', vars: { n: -gap }, to: 'recruit' });
  }

  // ——— From the fight ———
  const mine = report.teams[side];
  const theirs = report.teams[opp];
  if (mine.avgElementMult <= rc.typeDisadvantage) {
    factors.push({ key: 'typesBad', tone: 'bad', vars: { mult: Math.round(mine.avgElementMult * 100) / 100 }, weight: 5 });
    tips.push({ key: 'elements', vars: {}, to: 'encyclopedia' });
  } else if (mine.avgElementMult >= rc.typeAdvantage) {
    factors.push({ key: 'typesGood', tone: 'good', vars: { mult: Math.round(mine.avgElementMult * 100) / 100 }, weight: 5 });
  }

  const ratio = theirs.damageDealt ? mine.damageDealt / theirs.damageDealt : 2;
  if (ratio >= 1.3) factors.push({ key: 'outdamagedThem', tone: 'good', vars: { a: mine.damageDealt, b: theirs.damageDealt }, weight: Math.min(8, (ratio - 1) * 6) });
  if (ratio <= 0.77) factors.push({ key: 'outdamaged', tone: 'bad', vars: { a: mine.damageDealt, b: theirs.damageDealt }, weight: Math.min(8, (1 / ratio - 1) * 6) });
  if (mine.kos !== theirs.kos && Math.abs(mine.kos - theirs.kos) >= 2) {
    factors.push({ key: 'kos', tone: mine.kos > theirs.kos ? 'good' : 'bad', vars: { a: mine.kos, b: theirs.kos }, weight: 2 * Math.abs(mine.kos - theirs.kos) });
  }

  for (const ins of analysis.insights) {
    if (ins.key === 'backlineHit') {
      factors.push({ key: 'backline', tone: 'bad', vars: { pct: ins.vars.pct! }, weight: 5 });
      tips.push({ key: 'tank', vars: {}, to: 'tactics' });
    } else if (ins.key === 'healersUntouched') {
      factors.push({ key: 'healers', tone: 'bad', vars: { n: ins.vars.n! }, weight: 5 });
      tips.push({ key: 'targetHealers', vars: {}, to: 'tactics' });
    } else if (ins.key === 'enemySustain') {
      factors.push({ key: 'sustain', tone: 'bad', vars: { n: ins.vars.n! }, weight: 3 });
      tips.push({ key: 'focus', vars: {}, to: 'tactics' });
    } else if (ins.key === 'turnsLost') {
      factors.push({ key: 'turnsLost', tone: 'bad', vars: { n: ins.vars.n! }, weight: 3 });
    }
  }

  const ours = report.creatures.filter((c) => c.side === side && c.played);
  const exhausted = ours.filter((c) => c.exhaustedRound !== null && c.exhaustedRound <= rc.exhaustedEarlyRound);
  if (exhausted.length >= 2) {
    factors.push({ key: 'exhausted', tone: 'bad', vars: { names: names(exhausted.map((c) => c.id)), n: exhausted.length }, weight: 2 * exhausted.length });
    tips.push({ key: 'cautious', vars: {}, to: 'tactics' });
  }
  const nervous = ours.filter((c) => c.fled || c.hesitations >= 2);
  if (nervous.length) {
    factors.push({ key: 'nerves', tone: 'bad', vars: { names: names(nervous.map((c) => c.id)) }, weight: 3 * nervous.length });
    tips.push({ key: 'calm', vars: { names: names(nervous.map((c) => c.id)) }, to: 'tactics' });
  }

  const o = result.outcome;
  if (o.method === 'points' && Math.abs(o.score[0] - o.score[1]) <= rc.closePointsMargin) {
    factors.push({ key: 'close', tone: 'info', vars: { a: o.score[side], b: o.score[opp] }, weight: 4 });
  }

  // The reasons that explain the result come first; at most three.
  const wanted = won ? 'good' : 'bad';
  const sorted = factors.slice().sort((a, b) => Number(b.tone === wanted) - Number(a.tone === wanted) || b.weight - a.weight);
  const shown = sorted.slice(0, 3);

  const uniq = tips.filter((t, i) => tips.findIndex((x) => x.key === t.key) === i).slice(0, 3);
  if (!uniq.length) uniq.push({ key: won ? 'keepGoing' : 'improve', vars: { n: 0 }, to: won ? null : 'training' });
  return { won, factors: shown, tips: uniq };
}
