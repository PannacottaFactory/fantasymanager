/**
 * Post-match report: built ONLY from the event log and the roster, so it explains
 * exactly what the simulation did. Seen from one side (the "perspective").
 */
import { avg, clamp, round } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import type { Lang } from '../../core/i18n.ts';
import { fill } from '../../core/text.ts';
import { SPECIES } from '../../data/species.ts';
import { ASSISTANT_REMARKS, HEADLINES, KEY_MOMENT_TEXT, REPORT_WORDS, type RemarkKey } from '../../data/text/report.ts';
import { ASSISTANT_REMARKS_FR, HEADLINES_FR, KEY_MOMENT_TEXT_FR, REPORT_WORDS_FR } from '../../data/text/report.fr.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { MatchEvent, MatchResult, Side } from '../combat/types.ts';
import { abilityText, elementName, speciesName } from '../text/localize.ts';

const TEXTS = {
  en: { remarks: ASSISTANT_REMARKS, moments: KEY_MOMENT_TEXT, headlines: HEADLINES, words: REPORT_WORDS },
  fr: { remarks: ASSISTANT_REMARKS_FR, moments: KEY_MOMENT_TEXT_FR, headlines: HEADLINES_FR, words: REPORT_WORDS_FR },
};

export interface CreatureMatchStats {
  id: string;
  side: Side;
  played: boolean;
  roundsPlayed: number;
  damageDealt: number;
  damageTaken: number;
  attacks: number;
  hits: number;
  crits: number;
  kos: number;
  healing: number;
  intercepts: number;
  guards: number;
  rests: number;
  hesitations: number;
  disobeys: number;
  knockedOut: boolean;
  fled: boolean;
  exhaustedRound: number | null;
  elementMults: number[];
  abilitiesUsed: Record<string, number>;
  finalHpPct: number;
  finalStaminaPct: number;
  rating: number;
}

export interface TeamMatchStats {
  damageDealt: number;
  attacks: number;
  hits: number;
  crits: number;
  kos: number;
  healing: number;
  avgElementMult: number;
  backlineDamageTaken: number;
  damageTaken: number;
  substitutions: number;
}

export interface KeyMoment {
  round: number;
  side: Side | null;
  kind: 'firstBlood' | 'ko' | 'bigHit' | 'flee' | 'enrage' | 'substitution' | 'swing' | 'finalBlow';
  text: string;
  importance: number;
}

export interface Remark {
  tone: 'good' | 'bad' | 'info';
  key: RemarkKey;
  text: string;
}

export interface MatchReport {
  perspective: Side;
  won: boolean;
  headline: string;
  creatures: CreatureMatchStats[];
  teams: [TeamMatchStats, TeamMatchStats];
  keyMoments: KeyMoment[];
  remarks: Remark[];
  /** Per round: perspective team health − opponent health (−1…1). */
  momentum: number[];
  mvp: string | null;
}

function emptyStats(id: string, side: Side): CreatureMatchStats {
  return {
    id, side, played: false, roundsPlayed: 0, damageDealt: 0, damageTaken: 0, attacks: 0, hits: 0, crits: 0, kos: 0,
    healing: 0, intercepts: 0, guards: 0, rests: 0, hesitations: 0, disobeys: 0, knockedOut: false, fled: false,
    exhaustedRound: null, elementMults: [], abilitiesUsed: {}, finalHpPct: 100, finalStaminaPct: 100, rating: 0,
  };
}

function emptyTeam(): TeamMatchStats {
  return { damageDealt: 0, attacks: 0, hits: 0, crits: 0, kos: 0, healing: 0, avgElementMult: 1, backlineDamageTaken: 0, damageTaken: 0, substitutions: 0 };
}

export function buildReport(result: MatchResult, perspective: Side, cfg: GameConfig = DEFAULT_CONFIG, lang: Lang = 'en'): MatchReport {
  const { roster, events, outcome } = result;
  const T = TEXTS[lang];
  const KEY_MOMENT_TEXT = T.moments;
  const stats = new Map<string, CreatureMatchStats>();
  for (const r of Object.values(roster)) stats.set(r.id, emptyStats(r.id, r.side));
  const st = (id: string) => stats.get(id)!;
  const teams: [TeamMatchStats, TeamMatchStats] = [emptyTeam(), emptyTeam()];
  const elementMultsBySide: [number[], number[]] = [[], []];
  const name = (id: string | undefined) => (id ? (roster[id]?.name ?? '?') : '?');
  const momentum: number[] = [];
  const moments: KeyMoment[] = [];
  const rng = new Rng(deriveSeed(result.seed, 'report', perspective));
  const pickText = (variants: string[], vars: Record<string, string | number | undefined>) => fill(rng.pick(variants), vars);
  const lineOf = new Map<string, string>(Object.values(roster).map((r) => [r.id, r.line]));
  let firstKo = true;
  let prevMomentum = 0;

  for (const e of events) {
    switch (e.type) {
      case 'attack': {
        const a = st(e.actor);
        a.attacks++;
        a.abilitiesUsed[e.ability] = (a.abilitiesUsed[e.ability] ?? 0) + 1;
        teams[a.side].attacks++;
        if (e.interceptedFrom) st(e.target).intercepts++;
        if (!e.hit) break;
        a.hits++;
        a.damageDealt += e.damage;
        a.elementMults.push(e.elementMult);
        elementMultsBySide[a.side].push(e.elementMult);
        if (e.crit) {
          a.crits++;
          teams[a.side].crits++;
        }
        teams[a.side].hits++;
        teams[a.side].damageDealt += e.damage;
        if (e.healed) a.healing += e.healed;
        const t = st(e.target);
        t.damageTaken += e.damage;
        teams[t.side].damageTaken += e.damage;
        if (lineOf.get(e.target) === 'back') teams[t.side].backlineDamageTaken += e.damage;
        const maxHp = roster[e.target]?.maxHp ?? 1;
        if (e.damage >= maxHp * cfg.report.keyMoments.bigHitFraction) {
          moments.push({
            round: e.round, side: a.side, kind: 'bigHit', importance: 2 + e.damage / maxHp,
            text: pickText(KEY_MOMENT_TEXT.bigHit, { actor: name(e.actor), target: name(e.target), ability: abilityText(e.ability, lang).name, n: e.damage }),
          });
        }
        break;
      }
      case 'heal': {
        st(e.actor).healing += e.amount;
        teams[st(e.actor).side].healing += e.amount;
        st(e.actor).abilitiesUsed[e.ability] = (st(e.actor).abilitiesUsed[e.ability] ?? 0) + 1;
        break;
      }
      case 'buff':
      case 'debuff':
        // (a 'cleanse' always follows the heal/buff of the same ability, already counted)
        st(e.actor).abilitiesUsed[e.ability] = (st(e.actor).abilitiesUsed[e.ability] ?? 0) + 1;
        break;
      case 'thorns': {
        st(e.actor).damageDealt += e.amount;
        st(e.target).damageTaken += e.amount;
        teams[st(e.actor).side].damageDealt += e.amount;
        teams[st(e.target).side].damageTaken += e.amount;
        break;
      }
      case 'effectTick': {
        if (e.amount < 0) {
          const t = st(e.target);
          t.damageTaken += -e.amount;
          teams[t.side].damageTaken += -e.amount;
          teams[t.side === 0 ? 1 : 0].damageDealt += -e.amount;
        }
        break;
      }
      case 'guard':
        st(e.actor).guards++;
        break;
      case 'rest':
        st(e.actor).rests++;
        break;
      case 'hesitate':
        st(e.actor).hesitations++;
        break;
      case 'disobey':
        st(e.actor).disobeys++;
        break;
      case 'exhausted':
        st(e.actor).exhaustedRound ??= e.round;
        break;
      case 'flee':
        st(e.actor).fled = true;
        moments.push({ round: e.round, side: roster[e.actor]!.side, kind: 'flee', importance: 3, text: pickText(KEY_MOMENT_TEXT.flee, { actor: name(e.actor) }) });
        break;
      case 'enrage':
        moments.push({ round: e.round, side: roster[e.actor]!.side, kind: 'enrage', importance: 1.5, text: pickText(KEY_MOMENT_TEXT.enrage, { actor: name(e.actor) }) });
        break;
      case 'ko': {
        const t = st(e.target);
        t.knockedOut = true;
        if (e.by) {
          st(e.by).kos++;
          teams[st(e.by).side].kos++;
        } else teams[t.side === 0 ? 1 : 0].kos++;
        const bySide = e.by ? st(e.by).side : t.side === 0 ? 1 : 0;
        if (firstKo) {
          firstKo = false;
          moments.push({ round: e.round, side: bySide, kind: 'firstBlood', importance: 3, text: pickText(KEY_MOMENT_TEXT.firstBlood, { actor: name(e.by), target: name(e.target) }) });
        } else {
          moments.push({
            round: e.round, side: bySide, kind: 'ko', importance: 2.5,
            text: e.by ? pickText(KEY_MOMENT_TEXT.ko, { actor: name(e.by), target: name(e.target) }) : pickText(KEY_MOMENT_TEXT.koEffect, { target: name(e.target), effect: T.words.theirWounds }),
          });
        }
        break;
      }
      case 'substitution':
        teams[e.side].substitutions++;
        lineOf.set(e.inId, lineOf.get(e.outId) ?? 'front');
        moments.push({ round: e.round, side: e.side, kind: 'substitution', importance: 1, text: pickText(KEY_MOMENT_TEXT.substitution, { inName: name(e.inId), outName: name(e.outId) }) });
        break;
      case 'roundEnd': {
        const health: [number, number] = [0, 0];
        const counts: [number, number] = [0, 0];
        for (const s of e.snapshot) {
          const r = roster[s.id]!;
          lineOf.set(s.id, s.line);
          const cs = st(s.id);
          if (s.state !== 'bench') {
            cs.played = true;
            if (s.state === 'active') cs.roundsPlayed++;
            cs.finalHpPct = Math.round((100 * s.hp) / r.maxHp);
            cs.finalStaminaPct = Math.round((100 * s.stamina) / r.maxStamina);
          }
          if (s.state === 'bench' || s.state === 'withdrawn') continue;
          if (s.state === 'ko' || s.state === 'fled') {
            // A downed creature that was replaced no longer counts.
            if (events.some((x) => x.type === 'substitution' && x.outId === s.id && x.round < e.round)) continue;
          }
          health[r.side] += s.state === 'active' ? s.hp / r.maxHp : 0;
          counts[r.side]++;
        }
        const h0 = counts[0] ? health[0] / counts[0] : 0;
        const h1 = counts[1] ? health[1] / counts[1] : 0;
        const m = perspective === 0 ? h0 - h1 : h1 - h0;
        momentum.push(round(m, 3));
        if (Math.abs(m - prevMomentum) >= cfg.report.keyMoments.swingThreshold && Math.sign(m) !== Math.sign(prevMomentum) && e.round > 1) {
          const side: Side = m > 0 ? perspective : perspective === 0 ? 1 : 0;
          moments.push({ round: e.round, side, kind: 'swing', importance: 2, text: pickText(KEY_MOMENT_TEXT.swing, { team: result.teams[side].name }) });
        }
        prevMomentum = m;
        break;
      }
      case 'matchEnd': {
        const lastKo = [...events].reverse().find((x): x is Extract<MatchEvent, { type: 'ko' }> => x.type === 'ko');
        if (e.method === 'ko' && lastKo?.by) {
          moments.push({ round: e.round, side: e.winner, kind: 'finalBlow', importance: 4, text: pickText(KEY_MOMENT_TEXT.finalBlow, { actor: name(lastKo.by) }) });
        }
        break;
      }
      default:
        break;
    }
  }
  teams[0].avgElementMult = round(avg(elementMultsBySide[0]) || 1, 2);
  teams[1].avgElementMult = round(avg(elementMultsBySide[1]) || 1, 2);

  // ——— Ratings ———
  const rc = cfg.report.rating;
  const played = [...stats.values()].filter((s) => s.played);
  const avgDmg = avg(played.map((s) => s.damageDealt)) || 1;
  const avgTaken = avg(played.map((s) => s.damageTaken)) || 1;
  const avgHeal = avg(played.filter((s) => s.healing > 0).map((s) => s.healing)) || 1;
  for (const s of played) {
    let r = rc.base;
    r += clamp((s.damageDealt / avgDmg - 1) * rc.damageWeight, -rc.damageCap, rc.damageCap);
    r += s.kos * rc.perKo;
    if (s.healing > 0) r += clamp((s.healing / avgHeal) * rc.healWeight * 0.8, 0, 2);
    r += s.intercepts * rc.perIntercept;
    if (roster[s.id]?.role === 'tank') r += clamp((s.damageTaken / avgTaken - 1) * rc.tankSoakWeight, -0.5, 1);
    if (s.attacks >= 3) r += (s.hits / s.attacks - 0.7) * rc.accuracyWeight;
    if (s.knockedOut) r += rc.knockedOut;
    if (s.fled) r += rc.fled;
    r += s.hesitations * rc.perHesitation + s.disobeys * rc.perDisobey;
    if (s.side === outcome.winner) r += rc.winBonus;
    if (s.roundsPlayed < rc.minRounds) r = (r + rc.base) / 2;
    s.rating = round(clamp(r, rc.min, rc.max), 1);
  }

  // ——— Key moments: keep the most important, in chronological order ———
  const keyMoments = moments
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.importance - a.m.importance || a.i - b.i)
    .slice(0, cfg.report.keyMoments.max)
    .sort((a, b) => a.m.round - b.m.round || a.i - b.i)
    .map((x) => x.m);

  // ——— Assistant remarks ———
  const remarks = buildRemarks(result, perspective, stats, teams, cfg, lang, (key, vars) => fill(rng.pick(T.remarks[key]), vars));

  const ours = played.filter((s) => s.side === perspective).sort((a, b) => b.rating - a.rating);
  const won = outcome.winner === perspective;
  const us = result.teams[perspective].name;
  const them = result.teams[perspective === 0 ? 1 : 0].name;
  const score = `${outcome.score[perspective]}–${outcome.score[perspective === 0 ? 1 : 0]}`;
  const h = T.headlines;
  const headline = fill(outcome.method === 'ko' ? (won ? h.koWin : h.koLoss) : won ? h.pointsWin : h.pointsLoss, {
    us,
    them,
    round: outcome.rounds,
    score,
  });

  return {
    perspective,
    won,
    headline,
    creatures: [...stats.values()],
    teams,
    keyMoments,
    remarks,
    momentum,
    mvp: played.slice().sort((a, b) => b.rating - a.rating)[0]?.id ?? ours[0]?.id ?? null,
  };
}

function buildRemarks(
  result: MatchResult,
  side: Side,
  stats: Map<string, CreatureMatchStats>,
  teams: [TeamMatchStats, TeamMatchStats],
  cfg: GameConfig,
  lang: Lang,
  text: (key: RemarkKey, vars: Record<string, string | number | undefined>) => string,
): Remark[] {
  const rc = cfg.report.remarks;
  const out: Remark[] = [];
  const opp: Side = side === 0 ? 1 : 0;
  const roster = result.roster;
  const words = TEXTS[lang].words;
  const dec = (n: number, digits: number) => (lang === 'fr' ? n.toFixed(digits).replace('.', ',') : n.toFixed(digits));
  const ours = [...stats.values()].filter((s) => s.side === side && s.played);
  const vars = (id: string) => ({ name: roster[id]!.name, species: speciesName(roster[id]!.speciesId, lang).toLowerCase() });
  const enemyElements = [...new Set(Object.values(roster).filter((r) => r.side === opp).flatMap((r) => SPECIES[r.speciesId]?.elements ?? []))]
    .map((e) => elementName(e, lang).toLowerCase())
    .join('/');

  const sorted = ours.slice().sort((a, b) => b.rating - a.rating);
  const best = sorted[0];
  if (best && best.rating >= 7) out.push({ tone: 'good', key: 'mvp', text: text('mvp', { ...vars(best.id), rating: dec(best.rating, 1) }) });

  for (const s of ours) {
    if (s.fled) out.push({ tone: 'bad', key: 'fled', text: text('fled', vars(s.id)) });
    else if (s.hesitations >= 2) out.push({ tone: 'bad', key: 'moraleBreak', text: text('moraleBreak', vars(s.id)) });
  }
  const exhausted = ours.filter((s) => s.exhaustedRound !== null && s.exhaustedRound <= rc.exhaustedEarlyRound).sort((a, b) => a.exhaustedRound! - b.exhaustedRound!);
  for (const s of exhausted.slice(0, 2)) out.push({ tone: 'bad', key: 'exhaustedEarly', text: text('exhaustedEarly', { ...vars(s.id), round: s.exhaustedRound! }) });

  const avgMult = teams[side].avgElementMult;
  if (avgMult <= rc.typeDisadvantage) out.push({ tone: 'bad', key: 'typeDisadvantage', text: text('typeDisadvantage', { mult: dec(avgMult, 2), enemyElements }) });
  else if (avgMult >= rc.typeAdvantage) out.push({ tone: 'good', key: 'typeAdvantage', text: text('typeAdvantage', { mult: dec(avgMult, 2), enemyElements }) });

  const backShare = teams[side].damageTaken ? teams[side].backlineDamageTaken / teams[side].damageTaken : 0;
  if (backShare >= rc.backlineDamageShare) out.push({ tone: 'bad', key: 'backlineExposed', text: text('backlineExposed', { pct: Math.round(backShare * 100) }) });

  for (const s of ours) {
    if (s.disobeys >= rc.disobeyCount) out.push({ tone: 'bad', key: 'disobedient', text: text('disobedient', { ...vars(s.id), n: s.disobeys }) });
  }
  const inaccurate = ours.filter((s) => s.attacks >= rc.minAttacksForAccuracy && s.hits / s.attacks < rc.lowAccuracy);
  for (const s of inaccurate.slice(0, 1)) out.push({ tone: 'bad', key: 'lowAccuracy', text: text('lowAccuracy', { ...vars(s.id), pct: Math.round((100 * s.hits) / s.attacks) }) });

  const subsUsed = teams[side].substitutions;
  const subsLeft = cfg.match.maxSubstitutions - subsUsed;
  const benchLeft = Object.values(roster).filter((r) => r.side === side && !r.starter && !stats.get(r.id)!.played).length;
  const needed = ours.some((s) => s.knockedOut || (s.exhaustedRound !== null && s.exhaustedRound < result.outcome.rounds - 2));
  if (subsLeft > 0 && benchLeft > 0 && needed && result.outcome.rounds > cfg.match.breakRounds[0]!) {
    out.push({ tone: 'info', key: 'unusedSubs', text: text('unusedSubs', { subs: countWord(Math.min(subsLeft, benchLeft), words.substitution, words.substitutions) }) });
  }
  if (teams[side].healing >= 60) out.push({ tone: 'good', key: 'healing', text: text('healing', { n: teams[side].healing }) });

  const o = result.outcome;
  if (o.method === 'points' && Math.abs(o.score[0] - o.score[1]) <= rc.closePointsMargin) {
    out.push({ tone: 'info', key: 'closePoints', text: text('closePoints', { score: `${o.score[side]}–${o.score[opp]}` }) });
  }
  const worst = sorted[sorted.length - 1];
  if (worst && worst !== best && worst.rating <= 5) out.push({ tone: 'bad', key: 'worst', text: text('worst', { ...vars(worst.id), rating: dec(worst.rating, 1) }) });
  if (o.winner !== side && o.method === 'ko' && teams[opp].damageDealt > teams[side].damageDealt * 1.8) {
    out.push({ tone: 'info', key: 'outmatched', text: text('outmatched', {}) });
  }

  // Bad news first (that's what the manager can act on), capped.
  const order = { bad: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, rc.maxRemarks);
}

function countWord(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
