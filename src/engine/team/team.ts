import type { Lang } from '../../core/i18n.ts';
import { makeId } from '../../core/ids.ts';
import type { Rng } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { ROLES } from '../../data/roles.ts';
import { generateCreature } from '../creature/generate.ts';
import { bestRole, isInjured, roleFit } from '../creature/derived.ts';
import { generateTeamName } from '../creature/names.ts';
import type { Creature, LineupSlot, Tactic, Team, TeamOrders } from '../model.ts';

export const DEFAULT_ORDERS: TeamOrders = { aggression: 'balanced', target: 'nearest', risk: 'normal' };

/** Selection value used by the assistant: ability, discounted by fatigue. */
export function selectionScore(c: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  return c.ability * (1 - (c.condition.fatigue / 100) * cfg.league.ai.fatigueWeight);
}

/**
 * Lineup chosen by ability (discounted by fatigue) with natural roles; skips injured creatures
 * when possible and guarantees at least one creature in front.
 */
export function autoTactic(creatures: Creature[], cfg: GameConfig = DEFAULT_CONFIG, orders = DEFAULT_ORDERS): Tactic {
  const healthy = creatures.filter((c) => !isInjured(c));
  const pool = (healthy.length >= cfg.match.starters ? healthy : creatures)
    .slice()
    .sort((a, b) => selectionScore(b, cfg) - selectionScore(a, cfg) || a.id.localeCompare(b.id));
  const starters = pool.slice(0, cfg.match.starters);
  const bench = pool.slice(cfg.match.starters, cfg.match.starters + cfg.match.benchSize).map((c) => c.id);
  const lineup: LineupSlot[] = starters.map((c) => {
    const role = bestRole(c);
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
  return { lineup, bench, orders: { ...orders } };
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
    creatures.push(generateCreature(rng, { quality: opts.quality, speciesId, stableId: id, lang: opts.lang }, cfg));
  }
  return { id, name: opts.name ?? generateTeamName(rng, opts.lang), creatures, tactic: autoTactic(creatures, cfg) };
}

export type TacticIssue =
  | { code: 'lineupSize'; n: number }
  | { code: 'benchSize'; n: number }
  | { code: 'unknown'; id: string }
  | { code: 'duplicate'; id: string }
  | { code: 'injured'; id: string };

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
    if (used.has(id)) issues.push({ code: 'duplicate', id });
    used.add(id);
  }
  return issues;
}

/**
 * Assistant fix for a league match: injured creatures leave the lineup/bench and are replaced
 * by the best available ones; everything else the manager chose is kept.
 */
export function repairTactic(team: Team, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const byId = new Map(team.creatures.map((c) => [c.id, c]));
  const fit = (id: string) => {
    const c = byId.get(id);
    return !!c && !isInjured(c);
  };
  const t = structuredClone(team.tactic);
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
    const role = bestRole(c);
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
