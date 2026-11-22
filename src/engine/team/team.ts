import type { Lang } from '../../core/i18n.ts';
import { makeId } from '../../core/ids.ts';
import type { Rng } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { ROLES } from '../../data/roles.ts';
import { generateCreature } from '../creature/generate.ts';
import { bestRole, equippedSkills, isInjured, overallRating, roleFit } from '../creature/derived.ts';
import { generateTeamName } from '../creature/names.ts';
import type { Creature, LineupSlot, Tactic, Team, TeamOrders } from '../model.ts';

export const DEFAULT_ORDERS: TeamOrders = { aggression: 'balanced', target: 'nearest' };

/**
 * Selection value used by the assistant and the AI managers: the overall rating (what the creature brings in the
 * arena, species included), discounted by fatigue. The hidden aptitude is a step within its species' range, so a
 * gifted kobold has a high aptitude but weaker attributes than an average death knight: picking on it lost ≈ 7 points
 * of win rate and the match verdict, which reads the ratings, then blamed the assistant's own choice.
 */
export function selectionScore(c: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  return overallRating(c) * (1 - (c.condition.fatigue / 100) * cfg.league.ai.fatigueWeight);
}

/**
 * Lineup chosen by ability (discounted by fatigue), each creature in the role its attributes and its equipped skills
 * (`skills`, kept in the tactic) suit best; skips injured creatures when possible and guarantees at least one creature
 * in front.
 */
export function autoTactic(creatures: Creature[], cfg: GameConfig = DEFAULT_CONFIG, orders = DEFAULT_ORDERS, skills?: Record<string, string[]>): Tactic {
  const healthy = creatures.filter((c) => !isInjured(c));
  const pool = (healthy.length >= cfg.match.starters ? healthy : creatures)
    .slice()
    .sort((a, b) => selectionScore(b, cfg) - selectionScore(a, cfg) || a.id.localeCompare(b.id));
  const starters = pool.slice(0, cfg.match.starters);
  const bench = pool.slice(cfg.match.starters, cfg.match.starters + cfg.match.benchSize).map((c) => c.id);
  const lineup: LineupSlot[] = starters.map((c) => {
    const role = bestRole(c, skills?.[c.id], cfg);
    return { creatureId: c.id, role, line: ROLES[role].defaultLine, stance: 'normal' };
  });
  if (!lineup.some((s) => s.line === 'front') && lineup.length) {
    // Push the sturdiest creature forward as a tank.
    const byId = new Map(starters.map((c) => [c.id, c]));
    const sturdiest = lineup.reduce((best, s) =>
      roleFit(byId.get(s.creatureId)!, 'tank') > roleFit(byId.get(best.creatureId)!, 'tank') ? s : best,
    );
    sturdiest.line = 'front';
    sturdiest.role = 'tank';
  }
  return { lineup, bench, orders: { ...orders }, ...(skills ? { skills: { ...skills } } : {}) };
}

export interface GenerateTeamOptions {
  name?: string;
  quality?: QualityId;
  /** Restrict species (e.g. a goblin-only stable). */
  speciesPool?: string[];
  /** Draw this share of the squad from these species (a stable's style), the rest from anywhere. */
  favoured?: { species: string[]; share: number };
  size?: number;
  lang?: Lang;
  /** Mean potential of the squad instead of the quality's (the player's starting squad). */
  potentialMean?: number;
}

/** Deep copy of a team with fresh ids (same squad on both sides of a test match). */
export function cloneTeam(team: Team, suffix: string): Team {
  const copy = structuredClone(team);
  const map = new Map(copy.creatures.map((c) => [c.id, `${c.id}~${suffix}`]));
  const re = (id: string) => map.get(id) ?? id;
  for (const c of copy.creatures) {
    c.id = re(c.id);
    c.relations = Object.fromEntries(Object.entries(c.relations).map(([k, v]) => [re(k), v]));
  }
  copy.id = `${copy.id}~${suffix}`;
  copy.tactic.lineup = copy.tactic.lineup.map((s) => ({ ...s, creatureId: re(s.creatureId) }));
  copy.tactic.bench = copy.tactic.bench.map(re);
  if (copy.tactic.skills) copy.tactic.skills = Object.fromEntries(Object.entries(copy.tactic.skills).map(([k, v]) => [re(k), v]));
  return copy;
}

export function generateTeam(rng: Rng, opts: GenerateTeamOptions = {}, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const id = makeId(rng, 'tm');
  const size = opts.size ?? cfg.generation.team.starters + cfg.generation.team.bench;
  const creatures: Creature[] = [];
  for (let i = 0; i < size; i++) {
    const fav = opts.favoured;
    const speciesId = opts.speciesPool?.length
      ? rng.pick(opts.speciesPool)
      : fav?.species.length && rng.chance(fav.share)
        ? rng.pick(fav.species)
        : undefined;
    creatures.push(generateCreature(rng, { quality: opts.quality, speciesId, stableId: id, lang: opts.lang, potentialMean: opts.potentialMean }, cfg));
  }
  return { id, name: opts.name ?? generateTeamName(rng, opts.lang), creatures, tactic: autoTactic(creatures, cfg) };
}

export type TacticIssue =
  | { code: 'lineupSize'; n: number }
  | { code: 'benchSize'; n: number }
  | { code: 'unknown'; id: string }
  | { code: 'duplicate'; id: string }
  | { code: 'injured'; id: string }
  | { code: 'noSkill'; id: string };

/**
 * Validation of a tactic against a team and the arena rules (codes, worded by the UI).
 * `injured` issues are only reported with `checkInjuries` (league matches; the sandbox ignores them).
 */
export function validateTactic(team: Team, cfg: GameConfig = DEFAULT_CONFIG, checkInjuries = false): TacticIssue[] {
  const issues: TacticIssue[] = [];
  const byId = new Map(team.creatures.map((c) => [c.id, c]));
  const used = new Set<string>();
  const t = team.tactic;
  if (t.lineup.length !== cfg.match.starters) issues.push({ code: 'lineupSize', n: cfg.match.starters });
  if (t.bench.length > cfg.match.benchSize) issues.push({ code: 'benchSize', n: cfg.match.benchSize });
  for (const id of [...t.lineup.map((s) => s.creatureId), ...t.bench]) {
    const c = byId.get(id);
    if (!c) issues.push({ code: 'unknown', id });
    else if (checkInjuries && isInjured(c)) issues.push({ code: 'injured', id });
    // Every creature that may fight needs at least one skill equipped (the basic attack counts).
    if (c && !equippedSkills(c, t.skills?.[id], cfg).length) issues.push({ code: 'noSkill', id });
    if (used.has(id)) issues.push({ code: 'duplicate', id });
    used.add(id);
  }
  return issues;
}

/**
 * Assistant fix for a league match: injured creatures leave the lineup/bench and are replaced
 * by the best available ones, creatures without a skill get the default ones; everything else the manager chose is kept.
 */
export function repairTactic(team: Team, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const byId = new Map(team.creatures.map((c) => [c.id, c]));
  const fit = (id: string) => {
    const c = byId.get(id);
    return !!c && !isInjured(c);
  };
  const t = structuredClone(team.tactic);
  // A creature left without any skill goes back to the default choice (before any role is picked from its skills).
  for (const id of Object.keys(t.skills ?? {})) {
    const c = byId.get(id);
    if (c && t.skills?.[id] && !equippedSkills(c, t.skills[id], cfg).length) delete t.skills[id];
  }
  t.lineup = t.lineup.filter((s) => fit(s.creatureId));
  t.bench = t.bench.filter((id) => fit(id) && !t.lineup.some((s) => s.creatureId === id));
  const free = () =>
    team.creatures
      .filter((c) => !isInjured(c) && !t.lineup.some((s) => s.creatureId === c.id) && !t.bench.includes(c.id))
      .sort((a, b) => selectionScore(b, cfg) - selectionScore(a, cfg) || a.id.localeCompare(b.id));
  while (t.lineup.length < cfg.match.starters) {
    // Promote from the bench first, then from the reserves.
    const fromBench = t.bench.length ? t.bench.shift()! : free()[0]?.id;
    if (!fromBench) break;
    const c = byId.get(fromBench)!;
    const role = bestRole(c, t.skills?.[c.id], cfg);
    t.lineup.push({ creatureId: c.id, role, line: ROLES[role].defaultLine, stance: 'normal' });
  }
  while (t.bench.length < cfg.match.benchSize) {
    const next = free()[0];
    if (!next) break;
    t.bench.push(next.id);
  }
  if (t.lineup.length && !t.lineup.some((s) => s.line === 'front')) t.lineup[0]!.line = 'front';
  return { ...team, tactic: t };
}
