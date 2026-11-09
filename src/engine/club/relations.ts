/**
 * Relations between creatures of a stable (−100 rivalry … +100 bond), stored on both creatures.
 * They grow by fighting together, sour in quarrels, lift or sap morale at the start of a match.
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

/**
 * Weekly relations: starters who fought together bond; volatile creatures sometimes quarrel.
 * `starters` maps team id → ids of the creatures that started its match this week.
 */
export function weeklyRelations(state: GameState, starters: Map<string, string[]>, cfg: GameConfig = DEFAULT_CONFIG) {
  const r = cfg.club.relations;
  const rng = new Rng(deriveSeed(state.worldSeed, 'relations', state.season, state.matchday));
  const announce = (team: Team, a: Creature, b: Creature, before: number, after: number) => {
    if (team.id !== state.playerTeamId) return;
    if (before < r.friend && after >= r.friend) pushMessage(state, { kind: 'relation', a: a.name, b: b.name, bond: 'friends' });
    if (before > r.rival && after <= r.rival) pushMessage(state, { kind: 'relation', a: a.name, b: b.name, bond: 'rivals' });
  };
  for (const team of state.teams) {
    const ids = starters.get(team.id) ?? [];
    const fighters = team.creatures.filter((c) => ids.includes(c.id));
    for (let i = 0; i < fighters.length; i++) {
      for (let j = i + 1; j < fighters.length; j++) {
        const a = fighters[i]!;
        const b = fighters[j]!;
        let gain = r.perMatch;
        if (a.traits.includes('team-player') || b.traits.includes('team-player')) gain += r.teamPlayerBonus;
        if (a.traits.includes('loner') || b.traits.includes('loner')) gain *= r.lonerFactor;
        const before = relationOf(a, b);
        announce(team, a, b, before, shiftRelation(a, b, gain));
      }
    }
    if (team.creatures.length >= 2 && rng.chance(r.quarrelChance)) {
      // Volatile tempers clash more often.
      const a = rng.weighted(team.creatures, (c) => c.hidden.temperament + (c.traits.includes('hothead') ? 10 : 0));
      const others = team.creatures.filter((c) => c.id !== a.id);
      const b = rng.weighted(others, (c) => c.hidden.temperament);
      const before = relationOf(a, b);
      announce(team, a, b, before, shiftRelation(a, b, r.quarrel));
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
