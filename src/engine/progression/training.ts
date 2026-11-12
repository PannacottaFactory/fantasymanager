/**
 * Training, coaches, ageing, retirement and youth intake (pure: functions mutate the GameState they
 * are given; callers clone first). All randomness comes from seeded streams.
 */
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { ATTRIBUTE_CATEGORIES, ATTRIBUTE_KEYS, type AttributeCategory, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import type { IntensityId, ProgramId } from '../../data/config/training.ts';
import { ROLES } from '../../data/roles.ts';
import { SPECIES, SPECIES_IDS } from '../../data/species.ts';
import { makeId } from '../../core/ids.ts';
import { ageAbilityFactor, generateCreature } from '../creature/generate.ts';
import { generateName } from '../creature/names.ts';
import { bestRole, getSpecies } from '../creature/derived.ts';
import { clubOf, spend } from '../economy/finance.ts';
import { injuryWeeksFactor, trainingFactor } from '../club/facilities.ts';
import { transfer } from '../economy/market.ts';
import { askingWage, roundTo } from '../economy/value.ts';
import { pushMessage } from '../league/messages.ts';
import { levelOf, unlockLevel, xpPerAbility } from './levels.ts';
import type { Coach, GameState, TrainingPlan } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';

export const DEFAULT_PLAN: TrainingPlan = { program: 'balanced', intensity: 'normal' };

const CATEGORY_OF = {} as Record<AttributeKey, AttributeCategory>;
for (const cat of Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]) for (const k of ATTRIBUTE_CATEGORIES[cat]) CATEGORY_OF[k] = cat;

export function planOf(state: GameState, creatureId: string): TrainingPlan {
  return state.training[creatureId] ?? DEFAULT_PLAN;
}

export type LifeStage = 'young' | 'prime' | 'declining';
export function lifeStage(c: Creature): LifeStage {
  const lc = getSpecies(c).lifeCurve;
  return c.age < lc.peakStart ? 'young' : c.age <= lc.peakEnd ? 'prime' : 'declining';
}

// ——— Coaches ———

export function coachWage(quality: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const c = cfg.training.coaches;
  return roundTo(c.wageBase + quality * quality * c.wagePerQualitySq, 10);
}

export function hireFee(coach: Coach, cfg: GameConfig = DEFAULT_CONFIG): number {
  return coach.wage * cfg.training.coaches.hireWeeks;
}

export function newCoach(state: GameState, rng: Rng, domain: AttributeCategory, quality: number, cfg: GameConfig = DEFAULT_CONFIG): Coach {
  const species = SPECIES[rng.pick(SPECIES_IDS)]!;
  const q = clamp(Math.round(quality), 1, 20);
  return { id: makeId(rng, 'co'), name: generateName(rng, species.nameCulture, state.lang), domain, quality: q, wage: coachWage(q, cfg) };
}

/** Growth multiplier given by a stable's coach in a domain. */
export function coachFactor(state: GameState, teamId: string, domain: AttributeCategory, cfg: GameConfig = DEFAULT_CONFIG): number {
  const c = cfg.training.coaches;
  const coach = state.staff[teamId]?.[domain];
  return coach ? c.base + coach.quality * c.perQuality : c.noCoach;
}

export function refreshCoachMarket(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const domains = Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[];
  state.coachMarket = Array.from({ length: cfg.training.coaches.market }, (_, i) =>
    newCoach(state, rng, domains[i % domains.length]!, rng.normal(9, 4), cfg),
  ).sort((a, b) => a.domain.localeCompare(b.domain) || b.quality - a.quality);
}

/** Staff, plans and youth for a state that has none (new game / migration). Mutates. */
export function initTraining(state: GameState, qualities: Record<string, QualityId>, cfg: GameConfig = DEFAULT_CONFIG) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'staff', state.season));
  state.training = {};
  state.staff = {};
  state.youth = [];
  for (const team of state.teams) initStaff(state, team, qualities[team.id] ?? 'professional', rng, cfg);
  refreshCoachMarket(state, rng, cfg);
}

/** Three coaches for one stable, around the quality of the club. */
export function initStaff(state: GameState, team: Team, quality: QualityId, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const start = cfg.training.coaches.startQuality;
  const mean = start[quality as keyof typeof start] ?? 9;
  const staff: Partial<Record<AttributeCategory, Coach>> = {};
  for (const domain of Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]) staff[domain] = newCoach(state, rng, domain, rng.normal(mean, 2), cfg);
  state.staff[team.id] = staff;
}

// ——— Weekly training ———

/** Weight of each attribute for a program (role programs follow the role-fit weights). */
function programWeights(c: Creature, team: Team | undefined, program: ProgramId, cfg: GameConfig): Record<AttributeKey, number> {
  const out = {} as Record<AttributeKey, number>;
  if (program === 'role') {
    const slot = team?.tactic.lineup.find((s) => s.creatureId === c.id);
    const fit = ROLES[slot?.role ?? bestRole(c)].fit as Partial<Record<AttributeKey, number>>;
    for (const k of ATTRIBUTE_KEYS) out[k] = 0.25 + (fit[k] ?? 0);
    return out;
  }
  const w = cfg.training.programs[program === 'rest' ? 'balanced' : program];
  for (const k of ATTRIBUTE_KEYS) out[k] = w[CATEGORY_OF[k]];
  return out;
}

/** Upper bound of an attribute for this creature (its species range at full potential + headroom). */
function attributeCap(c: Creature, key: AttributeKey, cfg: GameConfig): number {
  const [lo, hi] = getSpecies(c).attributes[key];
  return clamp(Math.round(lo + (hi - lo) * (c.potential / 200)) + cfg.training.attributeHeadroom, 1, 20);
}

/** Expected attribute points per ability point (same mapping as generation). */
function slope(c: Creature, key: AttributeKey, cfg: GameConfig): number {
  const [lo, hi] = getSpecies(c).attributes[key];
  const s = (hi - lo) / cfg.generation.maxAbility;
  return CATEGORY_OF[key] === 'mental' ? s * cfg.generation.mentalAbilityWeight : s;
}

function growthOf(c: Creature) {
  return (c.growth ??= { ability: 0, pool: 0, season: 0 });
}

/**
 * Ability change turned into whole attribute points: gains (or losses) pile up in one pool and each
 * full point goes to an attribute drawn by weight, so progress shows up regularly. Returns points changed.
 */
function shiftAbility(
  c: Creature,
  amount: number,
  weights: Record<AttributeKey, number>,
  rng: Rng,
  cfg: GameConfig,
  log?: (k: AttributeKey, d: number) => void,
): number {
  if (!amount) return 0;
  const g = growthOf(c);
  const next = c.ability + g.ability + amount;
  c.ability = clamp(Math.floor(next), cfg.generation.minAbility, cfg.generation.maxAbility);
  g.ability = next - Math.floor(next);
  let total = 0;
  for (const k of ATTRIBUTE_KEYS) total += slope(c, k, cfg);
  g.pool = (g.pool ?? 0) + amount * total;
  let whole = 0;
  while (g.pool >= 1) {
    const open = ATTRIBUTE_KEYS.filter((k) => c.attributes[k] < attributeCap(c, k, cfg) && weights[k] > 0);
    if (!open.length) {
      g.pool = 0;
      break;
    }
    const k = rng.weighted(open, (x) => weights[x] * slope(c, x, cfg));
    c.attributes[k]++;
    g.pool -= 1;
    whole++;
    log?.(k, 1);
  }
  while (g.pool <= -1) {
    const open = ATTRIBUTE_KEYS.filter((k) => c.attributes[k] > 1);
    if (!open.length) {
      g.pool = 0;
      break;
    }
    const k = rng.weighted(open, (x) => weights[x] * slope(c, x, cfg));
    c.attributes[k]--;
    g.pool += 1;
    whole--;
    log?.(k, -1);
  }
  g.season += whole;
  return whole;
}

/** Records an attribute change of one of the player's creatures (kept short). */
function progressLogger(c: Creature, season: number, matchday: number, cfg: GameConfig) {
  return (k: AttributeKey, d: number) => {
    const g = growthOf(c);
    const recent = (g.recent ??= []);
    recent.push({ k, d, s: season, w: matchday });
    if (recent.length > cfg.training.progressLog.recent) recent.splice(0, recent.length - cfg.training.progressLog.recent);
  };
}

/** Notes the ability of one of the player's creatures this week (kept short). */
function recordAbility(c: Creature, season: number, matchday: number, cfg: GameConfig) {
  const g = growthOf(c);
  const h = (g.history ??= []);
  const last = h[h.length - 1];
  if (last && last[0] === season && last[1] === matchday) last[2] = c.ability;
  else h.push([season, matchday, c.ability]);
  if (h.length > cfg.training.progressLog.history) h.splice(0, h.length - cfg.training.progressLog.history);
}

/** Start-of-season snapshot of the player's creatures (attribute arrows are measured from it). */
export function snapshotSeasonStart(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const team = state.teams.find((x) => x.id === state.playerTeamId);
  for (const c of team?.creatures ?? []) {
    growthOf(c).seasonStart = { ...c.attributes };
    recordAbility(c, state.season, 0, cfg);
  }
}

/**
 * One week of training for every stable (match XP was stored by the match effects).
 * Returns the player's training injuries (already applied).
 */
export function weeklyTraining(state: GameState, _played: Set<string>, cfg: GameConfig = DEFAULT_CONFIG) {
  const t = cfg.training;
  const rng = new Rng(deriveSeed(state.worldSeed, 'training', state.season, state.matchday));
  for (const team of state.teams) {
    const isPlayer = team.id === state.playerTeamId;
    for (const c of team.creatures) {
      const plan = isPlayer ? planOf(state, c.id) : DEFAULT_PLAN;
      const injured = c.condition.injuries.some((i) => i.weeksLeft > 0);
      const g = growthOf(c);
      const fromMatch = g.matchXp ?? 0;
      g.matchXp = 0;
      const resting = plan.program === 'rest' || injured;
      if (plan.program === 'rest') c.condition.fatigue = clamp(c.condition.fatigue - t.restRecovery, 0, 100);
      if (resting && !fromMatch) continue;
      if (isPlayer) g.seasonStart ??= { ...c.attributes };
      const intensity = t.intensity[(resting ? 'normal' : plan.intensity) as IntensityId];
      if (!resting) {
        c.condition.fatigue = clamp(c.condition.fatigue + intensity.fatigue, 0, 100);
        c.condition.morale = clamp(c.condition.morale + intensity.morale, 0, 100);
      }
      const stage = lifeStage(c);
      const gap = c.potential - c.ability;
      if (gap > 0 && t.stage[stage] > 0) {
        const prof = t.professionalism.base + (c.hidden.professionalism / 20) * t.professionalism.range;
        const avgCoach = (['physical', 'combat', 'mental'] as AttributeCategory[]).reduce((s, d) => s + coachFactor(state, team.id, d, cfg), 0) / 3;
        // Training XP (none while resting or injured) + match XP, both slowed by age, up to the potential.
        const training = resting ? 0 : Math.max(t.minWeekly, gap * t.gapRate) * prof * intensity.growth * avgCoach * trainingFactor(state, team.id, cfg) * t.xp.trainingShare;
        const matches = fromMatch / xpPerAbility(cfg);
        const gain = Math.min(gap, (training + matches) * t.stage[stage]);
        const weights = programWeights(c, team, resting ? 'balanced' : plan.program, cfg);
        // Coaches: each attribute grows with the coach of its domain.
        for (const k of ATTRIBUTE_KEYS) weights[k] *= coachFactor(state, team.id, CATEGORY_OF[k], cfg);
        const log = isPlayer ? progressLogger(c, state.season, state.matchday, cfg) : undefined;
        const before = levelOf(c, cfg);
        shiftAbility(c, gain, weights, rng, cfg, log);
        const after = levelOf(c, cfg);
        if (after > before) levelUp(state, c, before, after, isPlayer, weights, rng, cfg);
      }
      if (isPlayer) recordAbility(c, state.season, state.matchday, cfg);
      if (resting) continue;
      // Hard training can hurt.
      if (intensity.injury > 0 && rng.chance(intensity.injury * (c.hidden.injuryProneness / 10))) {
        const weeks = Math.max(1, Math.round(rng.int(1, 3) * injuryWeeksFactor(state, team.id, cfg)));
        c.condition.injuries.push({ injuryId: 'sprained-limb', weeksLeft: weeks });
        if (isPlayer) pushMessage(state, { kind: 'injury', creatureId: c.id, name: c.name, injuryId: 'sprained-limb', weeks });
      }
    }
  }
}

/**
 * A creature gained one or more levels: abilities may unlock; the player gets a point to place by hand per level,
 * AI stables place theirs straight away (by their program).
 */
function levelUp(state: GameState, c: Creature, before: number, after: number, isPlayer: boolean, weights: Record<AttributeKey, number>, rng: Rng, cfg: GameConfig) {
  const g = growthOf(c);
  if (isPlayer) {
    g.freePoints = (g.freePoints ?? 0) + (after - before);
    pushMessage(state, { kind: 'levelUp', creatureId: c.id, name: c.name, level: after, points: g.freePoints });
    for (const a of getSpecies(c).abilities) {
      const at = unlockLevel(a.minAbility, cfg);
      if (at > before && at <= after) pushMessage(state, { kind: 'abilityUnlocked', creatureId: c.id, name: c.name, abilityId: a.id, ability: at });
    }
    return;
  }
  for (let i = before; i < after; i++) {
    const open = ATTRIBUTE_KEYS.filter((k) => c.attributes[k] < attributeCap(c, k, cfg) && weights[k] > 0);
    if (open.length) c.attributes[rng.weighted(open, (k) => weights[k])]++;
  }
}

/** Places one of the player's free attribute points (only below the species cap). */
export function spendFreePoint(state: GameState, creatureId: string, key: AttributeKey, cfg: GameConfig = DEFAULT_CONFIG): GameState {
  const next = structuredClone(state);
  const team = next.teams.find((t) => t.id === next.playerTeamId)!;
  const c = team.creatures.find((x) => x.id === creatureId);
  if (!c?.growth?.freePoints || c.attributes[key] >= attributeCap(c, key, cfg)) return state;
  c.attributes[key]++;
  c.growth.freePoints--;
  progressLogger(c, next.season, next.matchday, cfg)(key, 1);
  return next;
}

/** Highest value an attribute of this creature can reach (species range at full potential, + headroom). */
export function attributeCeiling(c: Creature, key: AttributeKey, cfg: GameConfig = DEFAULT_CONFIG): number {
  return attributeCap(c, key, cfg);
}

/** Every few weeks, the player's biggest improvers. */
export function trainingReport(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  if (state.matchday % cfg.training.reportEvery !== 0) return;
  const team = state.teams.find((x) => x.id === state.playerTeamId)!;
  const since = state.matchday - cfg.training.reportEvery;
  const items = team.creatures
    .map((c) => {
      // What moved since the last report: attribute points and aptitude.
      const moved: Partial<Record<AttributeKey, number>> = {};
      for (const r of c.growth?.recent ?? []) if (r.s === state.season && r.w > since) moved[r.k] = (moved[r.k] ?? 0) + r.d;
      const attrs = (Object.entries(moved) as [AttributeKey, number][]).filter(([, d]) => d !== 0).map(([k, d]) => ({ k, d }));
      const gain = attrs.reduce((s, a) => s + a.d, 0);
      const hist = c.growth?.history ?? [];
      const start = [...hist].reverse().find((h) => h[0] < state.season || (h[0] === state.season && h[1] <= since));
      return { creatureId: c.id, name: c.name, gain, attrs, abilityFrom: start?.[2] ?? c.ability, abilityTo: c.ability };
    })
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);
  if (items.length) pushMessage(state, { kind: 'trainingReport', items, weeks: cfg.training.reportEvery });
}

// ——— Season change: ageing, retirement, youth ———

/** Everyone gets a year older: decline past the prime, retirement at the end of the life span. */
export function ageing(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'ageing', state.season));
  const retired: string[] = [];
  const decline = cfg.training.ageing.declineWeights;
  const pools: { team: Team | null; creatures: Creature[] }[] = [...state.teams.map((t) => ({ team: t, creatures: t.creatures })), { team: null, creatures: state.freeAgents }];
  for (const { team, creatures } of pools) {
    for (const c of [...creatures]) {
      c.age++;
      if (c.growth) c.growth.season = 0;
      const lc = getSpecies(c).lifeCurve;
      if (c.age > lc.maxAge) {
        if (team?.id === state.playerTeamId) retired.push(c.name);
        if (team) transfer(state, c.id, null, 0, null, cfg);
        state.freeAgents = state.freeAgents.filter((x) => x.id !== c.id);
        continue;
      }
      if (c.age > lc.peakEnd) {
        const loss = c.potential * lc.declineRate;
        const weights = {} as Record<AttributeKey, number>;
        for (const k of ATTRIBUTE_KEYS) weights[k] = decline[CATEGORY_OF[k]];
        const log = team?.id === state.playerTeamId ? progressLogger(c, state.season, 0, cfg) : undefined;
        shiftAbility(c, -Math.min(loss, c.ability - cfg.generation.minAbility), weights, rng, cfg, log);
      }
    }
  }
  if (retired.length) pushMessage(state, { kind: 'retired', names: retired });
}

/**
 * Young prospects every off-season (2–4 per stable): AI stables sign the promising ones they have room for, the others
 * — and the player's share — join the free-agent market, where the player can sign them like anyone else.
 */
export function youthIntake(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const y = cfg.training.youth;
  const onMarket: string[] = [];
  for (const team of state.teams) {
    const rep = clubOf(state, team.id).reputation;
    const count = rng.int(y.min, y.max);
    const kids: Creature[] = [];
    for (let i = 0; i < count; i++) {
      const species = SPECIES[rng.weighted(SPECIES_IDS, (id) => SPECIES[id]!.rarity)]!;
      const potential = clamp(Math.round(rng.normal(y.potentialBase + rep * y.potentialPerReputation, y.potentialSd)), 40, 200);
      const c = generateCreature(rng, { speciesId: species.id, potential, age: species.lifeCurve.minAge, stableId: null, lang: state.lang }, cfg);
      c.ability = clamp(Math.round(potential * ageAbilityFactor(species, c.age, cfg)), cfg.generation.minAbility, potential);
      kids.push(c);
    }
    if (team.id === state.playerTeamId) {
      state.freeAgents.push(...kids);
      onMarket.push(...kids.map((k) => k.name));
      continue;
    }
    const bar = [...team.creatures].sort((a, b) => b.potential - a.potential)[7]?.potential ?? 0;
    for (const k of kids.sort((a, b) => b.potential - a.potential)) {
      state.freeAgents.push(k);
      if (team.creatures.length >= cfg.economy.club.maxSquad - 1 || k.potential <= bar) {
        onMarket.push(k.name);
        continue;
      }
      transfer(state, k.id, team.id, 0, { wage: youthWage(k, rep, cfg), years: y.years }, cfg);
    }
  }
  if (onMarket.length) pushMessage(state, { kind: 'youthIntake', names: onMarket.slice(0, 6), count: onMarket.length });
}

export function youthWage(c: Creature, reputation: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  return roundTo(Math.max(30, askingWage(c, reputation, cfg.training.youth.years, cfg) * cfg.training.youth.wageFactor), 10);
}

/** Youngsters the player did not keep go to the free agent pool when the season starts. */
export function releaseYouth(state: GameState) {
  if (!state.youth.length) return;
  pushMessage(state, { kind: 'youthReleased', names: state.youth.map((c) => c.name) });
  state.freeAgents.push(...state.youth);
  state.youth = [];
}

// ——— Player actions ———

export type TrainingError = 'notFound' | 'squadFull' | 'noMoney' | 'taken';

export function setPlan(state: GameState, creatureIds: string[], plan: Partial<TrainingPlan>): GameState {
  const next = structuredClone(state);
  for (const id of creatureIds) next.training[id] = { ...planOf(next, id), ...plan };
  return next;
}

export function hireCoach(state: GameState, coachId: string, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: { kind: 'hired'; fee: number } | { kind: 'error'; error: TrainingError } } {
  const coach = state.coachMarket.find((c) => c.id === coachId);
  if (!coach) return { state, outcome: { kind: 'error', error: 'notFound' } };
  const fee = hireFee(coach, cfg);
  if (clubOf(state, state.playerTeamId).balance < fee) return { state, outcome: { kind: 'error', error: 'noMoney' } };
  const next = structuredClone(state);
  const staff = (next.staff[next.playerTeamId] ??= {});
  const previous = staff[coach.domain];
  next.coachMarket = next.coachMarket.filter((c) => c.id !== coachId);
  if (previous) next.coachMarket.push(previous);
  staff[coach.domain] = coach;
  spend(next, next.playerTeamId, 'staff', fee);
  pushMessage(next, { kind: 'coachHired', name: coach.name, domain: coach.domain, quality: coach.quality });
  return { state: next, outcome: { kind: 'hired', fee } };
}

export function fireCoach(state: GameState, domain: AttributeCategory): GameState {
  const next = structuredClone(state);
  const staff = next.staff[next.playerTeamId];
  const coach = staff?.[domain];
  if (!staff || !coach) return state;
  delete staff[domain];
  next.coachMarket.push(coach);
  return next;
}

/** Weekly wages of a stable's coaches. */
export function staffBill(state: GameState, teamId: string): number {
  return Object.values(state.staff[teamId] ?? {}).reduce((s, c) => s + (c?.wage ?? 0), 0);
}
