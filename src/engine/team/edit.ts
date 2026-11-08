/** Pure team/tactic edits used by the UI (each returns a new Team). */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { ROLES } from '../../data/roles.ts';
import { bestRole } from '../creature/derived.ts';
import type { Creature, LineupSlot, Team, TeamOrders } from '../model.ts';

export function isStarter(team: Team, id: string): boolean {
  return team.tactic.lineup.some((s) => s.creatureId === id);
}

/** Moves a creature between lineup and bench (bench first, then reserves when the bench is full). */
export function toggleStarter(team: Team, id: string, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const t = structuredClone(team.tactic);
  if (isStarter(team, id)) {
    t.lineup = t.lineup.filter((s) => s.creatureId !== id);
    if (t.bench.length < cfg.match.benchSize) t.bench.push(id);
  } else {
    if (t.lineup.length >= cfg.match.starters) return team;
    const c = team.creatures.find((x) => x.id === id);
    if (!c) return team;
    const role = bestRole(c);
    t.lineup.push({ creatureId: id, role, line: ROLES[role].defaultLine, stance: 'normal' });
    t.bench = t.bench.filter((b) => b !== id);
  }
  return { ...team, tactic: t };
}

export function toggleBench(team: Team, id: string, cfg: GameConfig = DEFAULT_CONFIG): Team {
  if (isStarter(team, id)) return team;
  const t = structuredClone(team.tactic);
  if (t.bench.includes(id)) t.bench = t.bench.filter((b) => b !== id);
  else if (t.bench.length < cfg.match.benchSize) t.bench.push(id);
  return { ...team, tactic: t };
}

export function updateSlot(team: Team, id: string, patch: Partial<Omit<LineupSlot, 'creatureId'>>): Team {
  return {
    ...team,
    tactic: { ...team.tactic, lineup: team.tactic.lineup.map((s) => (s.creatureId === id ? { ...s, ...patch } : s)) },
  };
}

export function setOrders(team: Team, orders: Partial<TeamOrders>): Team {
  return { ...team, tactic: { ...team.tactic, orders: { ...team.tactic.orders, ...orders } } };
}

/** Swaps a creature for another one, keeping its place in the tactic. */
export function replaceCreature(team: Team, oldId: string, replacement: Creature): Team {
  const creatures = team.creatures.map((c) => (c.id === oldId ? replacement : c));
  const lineup = team.tactic.lineup.map((s) => {
    if (s.creatureId !== oldId) return s;
    const role = bestRole(replacement);
    return { ...s, creatureId: replacement.id, role, line: ROLES[role].defaultLine };
  });
  const bench = team.tactic.bench.map((b) => (b === oldId ? replacement.id : b));
  return { ...team, creatures, tactic: { ...team.tactic, lineup, bench } };
}
