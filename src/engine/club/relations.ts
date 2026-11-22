/**
 * Relations between creatures of a stable (−100 rivalry … +100 bond), stored on both creatures.
 * They change through random weekly « moments » (good or bad), and lift or sap morale at the start of a match.
 */
import { clamp } from '../../core/math.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { pushMessage } from '../league/messages.ts';
import type { GameState } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';

export const relationOf = (a: Creature, b: Creature) => a.relations[b.id] ?? 0;

/** Changes the relation of a pair (both sides). Returns the new value. */
export function shiftRelation(a: Creature, b: Creature, delta: number): number {
  const v = clamp(Math.round(relationOf(a, b) + delta), -100, 100);
  a.relations[b.id] = v;
  b.relations[a.id] = v;
  return v;
}

/** A few friendships and rivalries when a stable is created. */
export function seedRelations(team: Team, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const r = cfg.club.relations;
  const cs = team.creatures;
  if (cs.length < 2) return;
  const pair = () => {
    const a = rng.pick(cs);
    let b = rng.pick(cs);
    for (let i = 0; b.id === a.id && i < 10; i++) b = rng.pick(cs);
    return a.id === b.id ? null : [a, b];
  };
  for (let i = 0; i < r.startFriends; i++) {
    const p = pair();
    if (p) shiftRelation(p[0]!, p[1]!, rng.int(60, 85) - relationOf(p[0]!, p[1]!));
  }
  for (let i = 0; i < r.startRivals; i++) {
    const p = pair();
    if (p) shiftRelation(p[0]!, p[1]!, -rng.int(50, 75) - relationOf(p[0]!, p[1]!));
  }
}

/** Match-start morale bonus of a creature from its relations with the other starters. */
export function relationMorale(c: Creature, teammates: readonly Creature[], cfg: GameConfig = DEFAULT_CONFIG): number {
  const r = cfg.club.relations;
  let sum = 0;
  for (const o of teammates) if (o.id !== c.id) sum += ((c.relations[o.id] ?? 0) / 100) * r.moralePerTeammate;
  return clamp(sum, -r.maxMorale, r.maxMorale);
}

/** Chance that a moment between two creatures is a good one (team players lean to good, hotheads to bad). */
export function goodMomentChance(a: Creature, b: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  const r = cfg.club.relations;
  let p = r.good;
  for (const c of [a, b]) {
    if (c.traits.includes('team-player')) p += r.traitShift;
    if (c.traits.includes('hothead')) p -= r.traitShift;
  }
  return clamp(p, 0.05, 0.95);
}

/**
 * Weekly relations: in each stable, sometimes a « moment » between two creatures (more often two that fought together
 * that week). A good one makes them friends at once (rivals reconcile: neutral), a bad one rivals (friends fall out:
 * neutral). A moment that would change nothing (good between friends) tries another pair.
 * `starters` maps team id → ids of the creatures that started its match this week.
 */
export function weeklyRelations(state: GameState, starters: Map<string, string[]>, cfg: GameConfig = DEFAULT_CONFIG) {
  const r = cfg.club.relations;
  const rng = new Rng(deriveSeed(state.worldSeed, 'relations', state.season, state.matchday));
  // Wear: a bond not fought together this week may fade back to neutral (own stream: moments stay the same).
  const fade = new Rng(deriveSeed(state.worldSeed, 'relations-fade', state.season, state.matchday));
  for (const team of state.teams) {
    const ids = starters.get(team.id) ?? [];
    const cs = team.creatures;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i]!;
        const b = cs[j]!;
        const v = relationOf(a, b);
        if (v < r.friend && v > r.rival) continue;
        if (ids.includes(a.id) && ids.includes(b.id)) continue;
        if (!fade.chance(r.fadeChance)) continue;
        shiftRelation(a, b, -v);
        if (team.id === state.playerTeamId) pushMessage(state, { kind: 'relation', a: a.name, b: b.name, bond: v > 0 ? 'friendsFaded' : 'rivalsFaded' });
      }
    }
  }
  for (const team of state.teams) {
    if (team.creatures.length < 2 || !rng.chance(r.momentChance)) continue;
    const ids = starters.get(team.id) ?? [];
    const weight = (c: Creature) => (ids.includes(c.id) ? r.fightersWeight : 1);
    for (let tries = 0; tries < 5; tries++) {
      const a = rng.weighted(team.creatures, weight);
      const b = rng.weighted(team.creatures.filter((c) => c.id !== a.id), weight);
      const good = rng.chance(goodMomentChance(a, b, cfg));
      const v = relationOf(a, b);
      if (good ? v >= r.friend : v <= r.rival) continue;
      const bond = good ? (v <= r.rival ? 'reconciled' : 'friends') : v >= r.friend ? 'fallenOut' : 'rivals';
      const target = bond === 'friends' ? r.friendValue : bond === 'rivals' ? r.rivalValue : 0;
      shiftRelation(a, b, target - v);
      const moment = rng.int(0, r.variants - 1);
      if (team.id === state.playerTeamId) pushMessage(state, { kind: 'relation', a: a.name, b: b.name, bond, moment });
      break;
    }
  }
}

/** A creature leaves: its friends in the stable lose morale (mutates). Returns the friends' names. */
export function friendsMourn(team: Team, leaving: Creature, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const r = cfg.club.relations;
  const friends = team.creatures.filter((c) => c.id !== leaving.id && relationOf(c, leaving) >= r.friend);
  for (const f of friends) {
    f.condition.morale = clamp(f.condition.morale + r.friendLeft, 0, 100);
    delete f.relations[leaving.id];
  }
  for (const c of team.creatures) delete c.relations[leaving.id];
  leaving.relations = {};
  return friends.map((f) => f.name);
}
