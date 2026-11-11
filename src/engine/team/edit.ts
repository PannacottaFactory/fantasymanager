/** Pure team/tactic edits used by the UI (each returns a new Team). */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { ROLES } from '../../data/roles.ts';
import { bestRole } from '../creature/derived.ts';
import type { Line } from '../../data/schema.ts';
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

export type Selection = 'starter' | 'bench' | 'reserve';

export function selectionOf(team: Team, id: string): Selection {
  return isStarter(team, id) ? 'starter' : team.tactic.bench.includes(id) ? 'bench' : 'reserve';
}

/** Puts a creature in the lineup, on the bench or in reserve (no change when the target group is full). */
export function setSelection(team: Team, id: string, to: Selection, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const from = selectionOf(team, id);
  if (from === to) return team;
  if (to === 'starter' && team.tactic.lineup.length >= cfg.match.starters) return team;
  if (to === 'bench' && team.tactic.bench.length >= cfg.match.benchSize) return team;
  const c = team.creatures.find((x) => x.id === id);
  if (!c) return team;
  const t = structuredClone(team.tactic);
  t.lineup = t.lineup.filter((s) => s.creatureId !== id);
  t.bench = t.bench.filter((b) => b !== id);
  if (to === 'starter') {
    const role = bestRole(c);
    t.lineup.push({ creatureId: id, role, line: ROLES[role].defaultLine, stance: 'normal' });
  } else if (to === 'bench') t.bench.push(id);
  return { ...team, tactic: t };
}

/**
 * Swaps the places of two creatures (starter ↔ bench / reserve, bench ↔ reserve). A creature entering the lineup
 * keeps the slot's line and takes its own best role.
 */
export function swapCreatures(team: Team, a: string, b: string): Team {
  const sa = selectionOf(team, a);
  const sb = selectionOf(team, b);
  if (sa === sb) return team;
  const ca = team.creatures.find((x) => x.id === a);
  const cb = team.creatures.find((x) => x.id === b);
  if (!ca || !cb) return team;
  const t = structuredClone(team.tactic);
  const put = (id: string, c: Creature, to: Selection, slotOf?: LineupSlot) => {
    if (to === 'starter') {
      const role = bestRole(c);
      t.lineup.push({ creatureId: id, role, line: slotOf?.line ?? ROLES[role].defaultLine, stance: 'normal' });
    } else if (to === 'bench') t.bench.push(id);
  };
  const slotA = t.lineup.find((s) => s.creatureId === a);
  const slotB = t.lineup.find((s) => s.creatureId === b);
  const benchIndex = (id: string) => t.bench.indexOf(id);
  const ia = benchIndex(a);
  const ib = benchIndex(b);
  t.lineup = t.lineup.filter((s) => s.creatureId !== a && s.creatureId !== b);
  // Keep bench order: the newcomer takes the leaver's place.
  if (ia >= 0 && sb !== 'bench') t.bench[ia] = b;
  else if (ib >= 0 && sa !== 'bench') t.bench[ib] = a;
  t.bench = t.bench.filter((id) => (id !== a || sb === 'bench') && (id !== b || sa === 'bench'));
  if (sb === 'starter') put(a, ca, 'starter', slotB);
  if (sa === 'starter') put(b, cb, 'starter', slotA);
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

/** Toggles a favourite ability of a creature (at most `cfg.combat.favorites.max`; the oldest is dropped). */
export function toggleFavorite(team: Team, creatureId: string, abilityId: string, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const current = team.tactic.favorites?.[creatureId] ?? [];
  let next = current.includes(abilityId) ? current.filter((a) => a !== abilityId) : [...current, abilityId];
  if (next.length > cfg.combat.favorites.max) next = next.slice(next.length - cfg.combat.favorites.max);
  const favorites = { ...(team.tactic.favorites ?? {}) };
  if (next.length) favorites[creatureId] = next;
  else delete favorites[creatureId];
  return { ...team, tactic: { ...team.tactic, favorites } };
}

// ——— Line-up board (drag and drop) ———

/** Line-up board zones: the two lines of starters, the bench and the reserve. */
export type Zone = 'front' | 'back' | 'bench' | 'reserve';
/** Where a creature sits on the board. */
export function zoneOf(team: Team, id: string): Zone {
  const slot = team.tactic.lineup.find((s) => s.creatureId === id);
  if (slot) return slot.line;
  return selectionOf(team, id) === 'bench' ? 'bench' : 'reserve';
}

/** The team after moving creature `id` to a zone (unchanged when the zone is full). */
export function moveToZone(team: Team, id: string, to: Zone, cfg: GameConfig = DEFAULT_CONFIG): Team {
  const from = zoneOf(team, id);
  if (from === to) return team;
  if (to === 'front' || to === 'back') {
    const next = from === 'front' || from === 'back' ? team : setSelection(team, id, 'starter', cfg);
    if (next === team && from !== 'front' && from !== 'back') return team;
    return updateSlot(next, id, { line: to as Line });
  }
  return setSelection(team, id, to === 'bench' ? 'bench' : 'reserve', cfg);
}

/** The team after dropping `id` on creature `on`: swap places (or lines, between two starters). */
export function dropOnCreature(team: Team, id: string, on: string): Team {
  if (id === on) return team;
  const a = zoneOf(team, id);
  const b = zoneOf(team, on);
  if (a === b) return team;
  const starter = (z: Zone) => z === 'front' || z === 'back';
  if (starter(a) && starter(b)) return updateSlot(updateSlot(team, id, { line: b as Line }), on, { line: a as Line });
  return swapCreatures(team, id, on);
}

/**
 * Drag and drop in the Tactics table: dropping `id` onto creature `on` moves it into `on`'s group (and line) when
 * that group has room; otherwise (or between two starters) the two swap places.
 */
export function dropOnto(team: Team, id: string, on: string, cfg: GameConfig = DEFAULT_CONFIG): Team {
  if (id === on) return team;
  const a = zoneOf(team, id);
  const b = zoneOf(team, on);
  const starter = (z: Zone) => z === 'front' || z === 'back';
  if (a === b || (starter(a) && starter(b))) return dropOnCreature(team, id, on);
  const moved = moveToZone(team, id, b, cfg);
  return moved !== team ? moved : dropOnCreature(team, id, on);
}
