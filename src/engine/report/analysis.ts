/**
 * Post-match analysis, built only from the event log (like the report): where the damage came from, how health
 * evolved, what each period between breaks gave, who fought whom, turns lost, and the assistant's conclusions.
 * Conclusions are data (key + values); the UI words them.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { EFFECTS } from '../../data/effects.ts';
import type { MatchResult, Side, SubstitutionDecision } from '../combat/types.ts';
import type { TeamOrders } from '../model.ts';

export type DamageSource = 'melee' | 'ranged' | 'spell' | 'overTime' | 'thorns';
export const DAMAGE_SOURCES: DamageSource[] = ['melee', 'ranged', 'spell', 'overTime', 'thorns'];

export interface SideAnalysis {
  /** Damage dealt by source. */
  sources: Record<DamageSource, number>;
  /** Damage over time dealt, by effect id. */
  overTimeBy: Record<string, number>;
  total: number;
  /** Health recovered: heals, life drain, regeneration; damage absorbed by shields. */
  healing: number;
  lifesteal: number;
  regeneration: number;
  absorbed: number;
  /** Harmful effects landed on the opponents, by effect id. */
  inflicted: Record<string, number>;
  /** Effects removed from allies by purification. */
  cleansed: number;
  /** Health paid in sacrifices. */
  sacrificed: number;
  /** Where its damage went: back line, healers/casters, the opponent it hit the most. */
  onBackline: number;
  onBackers: number;
  topTargetShare: number;
}

export interface Period {
  from: number;
  to: number;
  /** Damage dealt by each side during the period. */
  dealt: [number, number];
  kos: [number, number];
  /** Decisions taken at the break that opened the period (none for the first). */
  changes: { side: Side; subs: SubstitutionDecision[]; orders?: TeamOrders }[];
}

export interface Duel {
  attacker: string;
  target: string;
  damage: number;
}

export interface LostTurns {
  id: string;
  stunned: number;
  frozen: number;
  hesitated: number;
  rested: number;
}

export type InsightKey =
  | 'dotShare' | 'enemyDot' | 'healersUntouched' | 'healersFocused' | 'breakPaid' | 'breakFailed' | 'turnsLost'
  | 'thornsHurt' | 'spread' | 'enemySustain' | 'backlineHit' | 'cleansed' | 'curses';

export interface Insight {
  tone: 'good' | 'bad' | 'info';
  key: InsightKey;
  vars: Record<string, string | number>;
}

export interface MatchAnalysis {
  sides: [SideAnalysis, SideAnalysis];
  /** Team health (fraction of total, everyone who entered) after each round. */
  health: [number, number][];
  /** Health % of each creature after each round (null when not on the field). */
  creatureHp: Record<string, (number | null)[]>;
  periods: Period[];
  duels: Duel[];
  lostTurns: LostTurns[];
  insights: Insight[];
}

function emptySide(): SideAnalysis {
  return {
    sources: { melee: 0, ranged: 0, spell: 0, overTime: 0, thorns: 0 }, overTimeBy: {}, total: 0, healing: 0, lifesteal: 0,
    regeneration: 0, absorbed: 0, inflicted: {}, cleansed: 0, sacrificed: 0, onBackline: 0, onBackers: 0, topTargetShare: 0,
  };
}

export function analyzeMatch(result: MatchResult, perspective: Side = 0, cfg: GameConfig = DEFAULT_CONFIG): MatchAnalysis {
  const { roster, events } = result;
  const sideOf = (id: string | undefined): Side | undefined => (id ? roster[id]?.side : undefined);
  const sides: [SideAnalysis, SideAnalysis] = [emptySide(), emptySide()];
  const breaks = cfg.match.breakRounds;
  const bounds = [0, ...breaks, cfg.match.maxRounds];
  const periods: Period[] = bounds.slice(0, -1).map((b, i) => ({ from: b + 1, to: bounds[i + 1]!, dealt: [0, 0], kos: [0, 0], changes: [] }));
  const periodOf = (round: number) => Math.max(0, periods.findIndex((p) => round >= p.from && round <= p.to));
  const duels = new Map<string, number>();
  const byTarget: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  const lost = new Map<string, LostTurns>();
  const lt = (id: string) => {
    let x = lost.get(id);
    if (!x) lost.set(id, (x = { id, stunned: 0, frozen: 0, hesitated: 0, rested: 0 }));
    return x;
  };
  // Current line of each creature (break decisions can move them).
  const line = new Map(Object.values(roster).map((r) => [r.id, r.line]));
  const isBacker = (id: string) => roster[id]?.role === 'support' || roster[id]?.role === 'caster';
  const maxHp = Object.fromEntries(Object.values(roster).map((r) => [r.id, r.maxHp]));
  const entered = new Set(Object.values(roster).filter((r) => r.starter).map((r) => r.id));
  const health: [number, number][] = [];
  const creatureHp: Record<string, (number | null)[]> = Object.fromEntries(Object.keys(roster).map((id) => [id, []]));

  const dealt = (side: Side, target: string, amount: number, round: number) => {
    const s = sides[side];
    s.total += amount;
    if (line.get(target) === 'back') s.onBackline += amount;
    if (isBacker(target)) s.onBackers += amount;
    byTarget[side].set(target, (byTarget[side].get(target) ?? 0) + amount);
    periods[periodOf(round)]!.dealt[side] += amount;
  };

  for (const e of events) {
    switch (e.type) {
      case 'attack': {
        const side = sideOf(e.actor);
        if (side === undefined) break;
        if (e.absorbed) sides[side === 0 ? 1 : 0].absorbed += e.absorbed;
        if (!e.hit || e.damage <= 0) break;
        sides[side].sources[e.kind] += e.damage;
        dealt(side, e.target, e.damage, e.round);
        duels.set(`${e.actor}|${e.target}`, (duels.get(`${e.actor}|${e.target}`) ?? 0) + e.damage);
        if (e.healed) sides[side].lifesteal += e.healed;
        break;
      }
      case 'thorns': {
        const side = sideOf(e.actor);
        if (side === undefined) break;
        sides[side].sources.thorns += e.amount;
        dealt(side, e.target, e.amount, e.round);
        duels.set(`${e.actor}|${e.target}`, (duels.get(`${e.actor}|${e.target}`) ?? 0) + e.amount);
        break;
      }
      case 'effectTick': {
        const victim = sideOf(e.target);
        if (victim === undefined) break;
        if (e.amount < 0) {
          const side: Side = victim === 0 ? 1 : 0;
          sides[side].sources.overTime += -e.amount;
          sides[side].overTimeBy[e.effect] = (sides[side].overTimeBy[e.effect] ?? 0) - e.amount;
          dealt(side, e.target, -e.amount, e.round);
        } else sides[victim].regeneration += e.amount;
        break;
      }
      case 'heal': {
        const side = sideOf(e.actor);
        if (side !== undefined) sides[side].healing += e.amount;
        break;
      }
      case 'effectApplied': {
        const victim = sideOf(e.target);
        const def = EFFECTS[e.effect];
        if (victim === undefined || !def || def.beneficial) break;
        const side: Side = victim === 0 ? 1 : 0;
        sides[side].inflicted[e.effect] = (sides[side].inflicted[e.effect] ?? 0) + 1;
        break;
      }
      case 'cleanse': {
        const side = sideOf(e.actor);
        if (side !== undefined) sides[side].cleansed += e.removed.length;
        break;
      }
      case 'sacrifice': {
        const side = sideOf(e.actor);
        if (side !== undefined) sides[side].sacrificed += e.amount;
        break;
      }
      case 'stunned':
        if (e.effect === 'frozen') lt(e.actor).frozen++;
        else lt(e.actor).stunned++;
        break;
      case 'hesitate':
        lt(e.actor).hesitated++;
        break;
      case 'rest':
        lt(e.actor).rested++;
        break;
      case 'ko': {
        const by = sideOf(e.by);
        const victim = sideOf(e.target);
        const side = by ?? (victim === undefined ? undefined : victim === 0 ? 1 : 0);
        if (side !== undefined) periods[periodOf(e.round)]!.kos[side]++;
        break;
      }
      case 'substitution':
        entered.add(e.inId);
        line.set(e.inId, line.get(e.outId) ?? 'front');
        break;
      case 'roundEnd': {
        const tot: [number, number] = [0, 0];
        const max: [number, number] = [0, 0];
        const onField = new Set(e.snapshot.filter((s) => s.state === 'active').map((s) => s.id));
        for (const s of e.snapshot) {
          line.set(s.id, s.line);
          const r = roster[s.id];
          if (!r) continue;
          creatureHp[s.id]!.push(onField.has(s.id) ? Math.round((100 * s.hp) / Math.max(1, maxHp[s.id]!)) : null);
          if (!entered.has(s.id)) continue;
          max[r.side] += r.maxHp;
          if (s.state === 'active') tot[r.side] += s.hp;
        }
        if (health.length < e.round) health.push([max[0] ? tot[0] / max[0] : 0, max[1] ? tot[1] / max[1] : 0]);
        break;
      }
      default:
        break;
    }
  }

  // Decisions taken at each break open the next period.
  for (const d of result.decisions) {
    const idx = periods.findIndex((p) => p.from === d.round + 1);
    if (idx < 0) continue;
    periods[idx]!.changes.push({ side: d.side, subs: d.decision.substitutions ?? [], orders: d.decision.orders });
  }
  const played = periods.filter((p) => p.from <= result.outcome.rounds);

  for (const side of [0, 1] as Side[]) {
    const s = sides[side];
    const top = Math.max(0, ...byTarget[side].values());
    s.topTargetShare = s.total ? top / s.total : 0;
  }

  const duelList = [...duels.entries()]
    .map(([k, damage]) => {
      const [attacker, target] = k.split('|') as [string, string];
      return { attacker, target, damage };
    })
    .sort((a, b) => b.damage - a.damage);

  const lostTurns = [...lost.values()].sort((a, b) => b.stunned + b.frozen + b.hesitated - (a.stunned + a.frozen + a.hesitated));

  return {
    sides,
    health,
    creatureHp,
    periods: played,
    duels: duelList,
    lostTurns,
    insights: buildInsights(result, perspective, sides, played, lostTurns),
  };
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

function buildInsights(result: MatchResult, me: Side, sides: [SideAnalysis, SideAnalysis], periods: Period[], lostTurns: LostTurns[]): Insight[] {
  const them: Side = me === 0 ? 1 : 0;
  const mine = sides[me];
  const theirs = sides[them];
  const out: Insight[] = [];
  const topEffect = (s: SideAnalysis) => Object.entries(s.overTimeBy).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  // Damage over time.
  const dot = pct(mine.sources.overTime, mine.total);
  if (dot >= 15) out.push({ tone: 'good', key: 'dotShare', vars: { pct: dot, effect: topEffect(mine) } });
  const enemyDot = pct(theirs.sources.overTime, theirs.total);
  if (enemyDot >= 20) out.push({ tone: 'bad', key: 'enemyDot', vars: { pct: enemyDot, effect: topEffect(theirs) } });

  // Their healers.
  const theirSustain = theirs.healing + theirs.lifesteal + theirs.regeneration;
  if (theirs.healing >= 50 && pct(mine.onBackers, mine.total) < 15) out.push({ tone: 'bad', key: 'healersUntouched', vars: { n: theirs.healing } });
  else if (theirSustain >= 80) out.push({ tone: 'bad', key: 'enemySustain', vars: { n: theirSustain } });
  // Our healers under fire.
  const onOurBackers = pct(theirs.onBackers, theirs.total);
  if (onOurBackers >= 35) out.push({ tone: 'info', key: 'healersFocused', vars: { pct: onOurBackers } });
  const onOurBack = pct(theirs.onBackline, theirs.total);
  if (onOurBack >= 45) out.push({ tone: 'bad', key: 'backlineHit', vars: { pct: onOurBack } });

  // Breaks: did our changes turn a period around? Only clear reversals count, and only the most telling one.
  let swing: Insight | null = null;
  let best = 0;
  for (let i = 1; i < periods.length; i++) {
    const p = periods[i]!;
    const ours = p.changes.find((c) => c.side === me && (c.subs.length || c.orders));
    if (!ours || p.to - p.from < 2) continue;
    const before = periods[i - 1]!;
    const netBefore = before.dealt[me] - before.dealt[them];
    const netAfter = p.dealt[me] - p.dealt[them];
    const scale = Math.max(1, p.dealt[me] + p.dealt[them]);
    const change = netAfter - netBefore;
    // A losing period turned into a clearly won one (or the reverse), by at least 30 % of the period's damage.
    if (netBefore < 0 && netAfter > 0 && change / scale >= 0.3 && change > best) {
      best = change;
      swing = { tone: 'good', key: 'breakPaid', vars: { n: i, net: netAfter } };
    } else if (netBefore > 0 && netAfter < 0 && -change / scale >= 0.3 && -change > best) {
      best = -change;
      swing = { tone: 'bad', key: 'breakFailed', vars: { n: i, net: -netAfter } };
    }
  }
  if (swing) out.push(swing);

  // Turns lost by our creatures.
  const ours = lostTurns.filter((l) => result.roster[l.id]?.side === me);
  const turns = ours.reduce((s, l) => s + l.stunned + l.frozen + l.hesitated, 0);
  if (turns >= 4) out.push({ tone: 'bad', key: 'turnsLost', vars: { n: turns } });

  // Thorns.
  if (theirs.sources.thorns >= 30) out.push({ tone: 'bad', key: 'thornsHurt', vars: { n: theirs.sources.thorns } });

  // Spread damage without a KO.
  const myKos = periods.reduce((s, p) => s + p.kos[me], 0);
  if (mine.total > 0 && mine.topTargetShare < 0.25 && myKos === 0) out.push({ tone: 'info', key: 'spread', vars: { pct: Math.round(mine.topTargetShare * 100) } });

  // Purification and curses.
  if (mine.cleansed >= 4) out.push({ tone: 'good', key: 'cleansed', vars: { n: mine.cleansed } });
  const curses = Object.entries(theirs.inflicted).filter(([id]) => EFFECTS[id]?.curse).reduce((s, [, n]) => s + n, 0);
  if (curses >= 4) out.push({ tone: 'info', key: 'curses', vars: { n: curses } });

  return out.slice(0, 7);
}
