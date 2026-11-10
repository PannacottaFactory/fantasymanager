/**
 * AI stable identities: a play style (squad, signings, favoured abilities, target orders) and a manager
 * temperament (aggression, risk, substitutions, reading the opponent). Pure functions.
 */
import type { Rng } from '../../core/rng.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { DEFAULT_CONFIG, type DifficultyId, type GameConfig, type ManagerId, type PlayStyleId } from '../../data/config/index.ts';
import { MANAGER_IDS, PLAY_STYLE_IDS } from '../../data/config/identity.ts';
import type { TargetPriority } from '../../data/schema.ts';
import { getAbilities } from '../creature/derived.ts';
import type { AiManagerStyle, Creature, StableIdentity, Tactic, Team, TeamOrders } from '../model.ts';

/** Distinct styles for as many stables as possible (then repeats), each with a manager temperament. */
export function drawIdentities(rng: Rng, count: number): StableIdentity[] {
  const styles: PlayStyleId[] = [];
  while (styles.length < count) styles.push(...rng.shuffle([...PLAY_STYLE_IDS]));
  const managers: ManagerId[] = [];
  while (managers.length < count) managers.push(...rng.shuffle([...MANAGER_IDS]));
  return styles.slice(0, count).map((style, i) => ({ style, manager: managers[i]! }));
}

/** Species a stable recruits by preference (empty without identity). */
export function favouredSpecies(team: Team, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  return team.identity ? cfg.identity.styles[team.identity.style].species : [];
}

/** Base orders of an AI stable: aggression and risk from its manager, target from its style. */
export function identityOrders(team: Team, difficulty: DifficultyId, cfg: GameConfig = DEFAULT_CONFIG): TeamOrders {
  const d = cfg.identity.difficulties[difficulty];
  if (!team.identity || !d.identities) return { aggression: 'balanced', target: 'nearest', risk: 'normal' };
  const m = cfg.identity.managers[team.identity.manager];
  return { aggression: m.aggression, risk: m.risk, target: cfg.identity.styles[team.identity.style].target };
}

/** Does this stable's manager study the opponent? */
export function readsOpponent(team: Team, difficulty: DifficultyId, cfg: GameConfig = DEFAULT_CONFIG): boolean {
  const reading = cfg.identity.difficulties[difficulty].reading;
  if (reading === 'all') return true;
  if (reading === 'none' || !team.identity) return false;
  return cfg.identity.managers[team.identity.manager].reads;
}

/** Break-time behaviour of an AI stable's manager. */
export function managerStyle(team: Team, difficulty: DifficultyId, orders: TeamOrders, cfg: GameConfig = DEFAULT_CONFIG): AiManagerStyle {
  const d = cfg.identity.difficulties[difficulty];
  const m = cfg.identity.managers[team.identity && d.identities ? team.identity.manager : 'steady'];
  return { tiredBelow: m.tiredBelow, hurtBelow: m.hurtBelow, adaptOrders: m.adaptOrders, reads: readsOpponent(team, difficulty, cfg), base: orders };
}

/**
 * Best target order against a known line-up: hunt the healers and casters when there are several,
 * the star when one creature stands far above the rest, otherwise finish the weakest.
 */
export function counterTarget(opponents: readonly { role: string; ability: number }[]): TargetPriority {
  const backers = opponents.filter((o) => o.role === 'support' || o.role === 'caster').length;
  if (backers >= 2) return 'casters';
  const sorted = opponents.map((o) => o.ability).sort((a, b) => b - a);
  if (sorted.length >= 2 && sorted[0]! - sorted[1]! >= 25) return 'strongest';
  return 'weakest';
}

/** Up to `max` favourite abilities among the style's ones that the creature knows. */
export function styleFavorites(c: Creature, style: PlayStyleId, max: number, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const wanted = cfg.identity.styles[style].abilities;
  return getAbilities(c)
    .map((a) => a.id)
    .filter((id) => wanted.includes(id) && ABILITIES[id])
    .slice(0, max);
}

/** Applies the identity to a freshly built AI tactic: orders, favourites, break behaviour, reading the opponent. */
export function applyIdentity(team: Team, tactic: Tactic, difficulty: DifficultyId, opponent?: Team, cfg: GameConfig = DEFAULT_CONFIG): Tactic {
  const d = cfg.identity.difficulties[difficulty];
  const orders = identityOrders(team, difficulty, cfg);
  if (opponent && readsOpponent(team, difficulty, cfg)) {
    const byId = new Map(opponent.creatures.map((c) => [c.id, c]));
    const lineup = opponent.tactic.lineup.map((s) => ({ role: s.role, ability: byId.get(s.creatureId)?.ability ?? 0 }));
    orders.target = counterTarget(lineup);
  }
  const favorites: Record<string, string[]> = {};
  if (d.favorites && team.identity) {
    for (const s of tactic.lineup) {
      const c = team.creatures.find((x) => x.id === s.creatureId);
      const fav = c ? styleFavorites(c, team.identity.style, cfg.combat.favorites.max, cfg) : [];
      if (fav.length) favorites[s.creatureId] = fav;
    }
  }
  return { ...tactic, orders, favorites, ai: managerStyle(team, difficulty, orders, cfg) };
}
