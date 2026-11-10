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
import { injuryWeeksFactor, nurseryBonus, trainingFactor } from '../club/facilities.ts';
import { transfer } from '../economy/market.ts';
import { askingWage, roundTo } from '../economy/value.ts';
import { pushMessage } from '../league/messages.ts';
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
 * One week of training for every stable. `played` = creatures who fought this week.
 * Returns the player's training injuries (already applied).
 */
export function weeklyTraining(state: GameState, played: Set<string>, cfg: GameConfig = DEFAULT_CONFIG) {
  const t = cfg.training;
  const rng = new Rng(deriveSeed(state.worldSeed, 'training', state.season, state.matchday));
  for (const team of state.teams) {
    const isPlayer = team.id === state.playerTeamId;
    for (const c of team.creatures) {
      const plan = isPlayer ? planOf(state, c.id) : DEFAULT_PLAN;
      const injured = c.condition.injuries.some((i) => i.weeksLeft > 0);
      if (plan.program === 'rest' || injured) {
        if (plan.program === 'rest') c.condition.fatigue = clamp(c.condition.fatigue - t.restRecovery, 0, 100);
        continue;
      }
      if (isPlayer) growthOf(c).seasonStart ??= { ...c.attributes };
      const intensity = t.intensity[plan.intensity as IntensityId];
      c.condition.fatigue = clamp(c.condition.fatigue + intensity.fatigue, 0, 100);
      const stage = lifeStage(c);
      const gap = c.potential - c.ability;
      if (gap > 0 && t.stage[stage] > 0) {
        const prof = t.professionalism.base + (c.hidden.professionalism / 20) * t.professionalism.range;
        let gain = Math.max(t.minWeekly, gap * t.gapRate) * t.stage[stage] * prof * intensity.growth;
        if (played.has(c.id)) gain *= 1 + t.playedBonus;
        const weights = programWeights(c, team, plan.program, cfg);
        // Coaches: each attribute grows with the coach of its domain.
        for (const k of ATTRIBUTE_KEYS) weights[k] *= coachFactor(state, team.id, CATEGORY_OF[k], cfg);
        const avgCoach = (['physical', 'combat', 'mental'] as AttributeCategory[]).reduce((s, d) => s + coachFactor(state, team.id, d, cfg), 0) / 3;
        const log = isPlayer ? progressLogger(c, state.season, state.matchday, cfg) : undefined;
        shiftAbility(c, Math.min(gap, gain * avgCoach * trainingFactor(state, team.id, cfg)), weights, rng, cfg, log);
      }
      if (isPlayer) recordAbility(c, state.season, state.matchday, cfg);
      // Hard training can hurt.
      if (intensity.injury > 0 && rng.chance(intensity.injury * (c.hidden.injuryProneness / 10))) {
        const weeks = Math.max(1, Math.round(rng.int(1, 3) * injuryWeeksFactor(state, team.id, cfg)));
        c.condition.injuries.push({ injuryId: 'sprained-limb', weeksLeft: weeks });
        if (isPlayer) pushMessage(state, { kind: 'injury', creatureId: c.id, name: c.name, injuryId: 'sprained-limb', weeks });
      }
    }
  }
}

/** Every few weeks, the player's biggest improvers. */
export function trainingReport(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  if (state.matchday % cfg.training.reportEvery !== 0) return;
  const team = state.teams.find((x) => x.id === state.playerTeamId)!;
  const since = state.matchday - cfg.training.reportEvery;
  const items = team.creatures
    .map((c) => {
      // Attributes that moved since the last report.
      const moved: Partial<Record<AttributeKey, number>> = {};
      for (const r of c.growth?.recent ?? []) if (r.s === state.season && r.w > since) moved[r.k] = (moved[r.k] ?? 0) + r.d;
      const attrs = (Object.entries(moved) as [AttributeKey, number][]).filter(([, d]) => d !== 0).map(([k, d]) => ({ k, d }));
      return { creatureId: c.id, name: c.name, gain: c.growth?.season ?? 0, attrs };
    })
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 5);
  if (items.length) pushMessage(state, { kind: 'trainingReport', items });
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

/** Youngsters for every stable: the player chooses; AI stables keep the promising ones they have room for. */
export function youthIntake(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const y = cfg.training.youth;
  for (const team of state.teams) {
    const rep = clubOf(state, team.id).reputation;
    const nursery = nurseryBonus(state, team.id, cfg);
    const count = rng.int(y.min, y.max) + nursery.extra;
    const kids: Creature[] = [];
    for (let i = 0; i < count; i++) {
      const species = SPECIES[rng.weighted(SPECIES_IDS, (id) => SPECIES[id]!.rarity)]!;
      const potential = clamp(Math.round(rng.normal(y.potentialBase + rep * y.potentialPerReputation + nursery.potential, y.potentialSd)), 40, 200);
      const c = generateCreature(rng, { speciesId: species.id, potential, age: species.lifeCurve.minAge, stableId: null, lang: state.lang }, cfg);
      c.ability = clamp(Math.round(potential * ageAbilityFactor(species, c.age, cfg)), cfg.generation.minAbility, potential);
      kids.push(c);
    }
    if (team.id === state.playerTeamId) {
      state.youth = kids;
      pushMessage(state, { kind: 'youthIntake', names: kids.map((k) => k.name) });
      continue;
    }
    const bar = [...team.creatures].sort((a, b) => b.potential - a.potential)[7]?.potential ?? 0;
    for (const k of kids.sort((a, b) => b.potential - a.potential)) {
      if (team.creatures.length >= cfg.economy.club.maxSquad - 1 || k.potential <= bar) {
        state.freeAgents.push(k);
        continue;
      }
      state.freeAgents.push(k);
      transfer(state, k.id, team.id, 0, { wage: youthWage(k, rep, cfg), years: y.years }, cfg);
    }
  }
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

export function keepYouth(state: GameState, creatureId: string, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: { kind: 'kept'; wage: number } | { kind: 'error'; error: TrainingError } } {
  const kid = state.youth.find((c) => c.id === creatureId);
  if (!kid) return { state, outcome: { kind: 'error', error: 'notFound' } };
  const team = state.teams.find((t) => t.id === state.playerTeamId)!;
  if (team.creatures.length >= cfg.economy.club.maxSquad) return { state, outcome: { kind: 'error', error: 'squadFull' } };
  const next = structuredClone(state);
  const k = next.youth.find((c) => c.id === creatureId)!;
  next.youth = next.youth.filter((c) => c.id !== creatureId);
  next.freeAgents.push(k);
  const wage = youthWage(k, clubOf(next, next.playerTeamId).reputation, cfg);
  transfer(next, k.id, next.playerTeamId, 0, { wage, years: cfg.training.youth.years }, cfg);
  return { state: next, outcome: { kind: 'kept', wage } };
}

export function dismissYouth(state: GameState, creatureId: string): GameState {
  const next = structuredClone(state);
  const k = next.youth.find((c) => c.id === creatureId);
  if (!k) return state;
  next.youth = next.youth.filter((c) => c.id !== creatureId);
  next.freeAgents.push(k);
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
