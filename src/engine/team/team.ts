import { makeId } from '../../core/ids.ts';
import type { Rng } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { ROLES } from '../../data/roles.ts';
import { generateCreature } from '../creature/generate.ts';
import { bestRole, isInjured, roleFit } from '../creature/derived.ts';
import { generateTeamName } from '../creature/names.ts';
import type { Creature, LineupSlot, Tactic, Team, TeamOrders } from '../model.ts';

export const DEFAULT_ORDERS: TeamOrders = { aggression: 'balanced', target: 'nearest', risk: 'normal' };

/** Lineup chosen by ability with natural roles; guarantees at least one creature in front. */
export function autoTactic(creatures: Creature[], cfg: GameConfig = DEFAULT_CONFIG, orders = DEFAULT_ORDERS): Tactic {
  const healthy = creatures.filter((c) => !isInjured(c));
  const pool = (healthy.length >= cfg.match.starters ? healthy : creatures)
    .slice()
    .sort((a, b) => b.ability - a.ability || a.id.localeCompare(b.id));
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
  size?: number;
}

export function generateTeam(rng: Rng, opts: GenerateTeamOptions = {}, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const id = makeId(rng, 'tm');
  const size = opts.size ?? cfg.generation.team.starters + cfg.generation.team.bench;
  const creatures: Creature[] = [];
  for (let i = 0; i < size; i++) {
    const speciesId = opts.speciesPool?.length ? rng.pick(opts.speciesPool) : undefined;
    creatures.push(generateCreature(rng, { quality: opts.quality, speciesId, stableId: id }, cfg));
  }
  return { id, name: opts.name ?? generateTeamName(rng), creatures, tactic: autoTactic(creatures, cfg) };
}

/** Basic validation of a tactic against a team and the arena rules. Returns error messages. */
export function validateTactic(team: Team, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const errors: string[] = [];
  const ids = new Set(team.creatures.map((c) => c.id));
  const used = new Set<string>();
  const t = team.tactic;
  if (t.lineup.length !== cfg.match.starters) errors.push(`Lineup needs exactly ${cfg.match.starters} creatures.`);
  if (t.bench.length > cfg.match.benchSize) errors.push(`Bench holds at most ${cfg.match.benchSize} creatures.`);
  for (const id of [...t.lineup.map((s) => s.creatureId), ...t.bench]) {
    if (!ids.has(id)) errors.push(`Unknown creature ${id}.`);
    if (used.has(id)) errors.push('A creature is selected twice.');
    used.add(id);
  }
  return errors;
}
