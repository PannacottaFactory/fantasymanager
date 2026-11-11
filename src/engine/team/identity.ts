/**
 * AI stable identities: a play style (squad, signings, favoured abilities, target orders) and a manager
 * temperament (aggression, risk, substitutions, reading the opponent). Pure functions.
 */
import { Rng } from '../../core/rng.ts';
import { MANAGER_NAMES } from '../../data/names.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { DEFAULT_CONFIG, type DifficultyId, type GameConfig, type ManagerId, type PlayStyleId } from '../../data/config/index.ts';
import { MANAGER_IDS, PLAY_STYLE_IDS, STYLE_FOCUS } from '../../data/config/identity.ts';
import type { TargetPriority } from '../../data/schema.ts';
import { getAbilities } from '../creature/derived.ts';
import { counterApproach } from '../combat/formulas.ts';
import type { AiManagerStyle, Creature, StableIdentity, Tactic, Team, TeamOrders } from '../model.ts';

/** Name of a stable's manager: fixed for the stable (drawn from its id), never changes results. */
export function managerName(team: Pick<Team, 'id'>): string {
  const rng = new Rng(`manager|${team.id}`);
  return `${rng.pick(MANAGER_NAMES.first)} ${rng.pick(MANAGER_NAMES.last)}`;
}

/** Distinct styles for as many stables as possible (then repeats), each with a manager temperament and a focus. */
export function drawIdentities(rng: Rng, count: number): StableIdentity[] {
  const styles: PlayStyleId[] = [];
  while (styles.length < count) styles.push(...rng.shuffle([...PLAY_STYLE_IDS]));
  const managers: ManagerId[] = [];
  while (managers.length < count) managers.push(...rng.shuffle([...MANAGER_IDS]));
  const focus: number[] = [];
  while (focus.length < count) focus.push(...rng.shuffle([...STYLE_FOCUS]));
  return styles.slice(0, count).map((style, i) => ({ style, manager: managers[i]!, focus: focus[i]! }));
}

/** Share of the squad drawn from the style: the stable's focus, scaled by the difficulty (0.5 = as is). */
export function styleShare(identity: StableIdentity, difficulty: DifficultyId, cfg: GameConfig = DEFAULT_CONFIG): number {
  const scale = cfg.identity.difficulties[difficulty].styleShare / 0.5;
  return Math.max(0.05, Math.min(0.95, (identity.focus ?? 0.5) * scale));
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
    // Pick the approach that has the upper hand on the opponent's.
    orders.aggression = counterApproach(opponent.tactic.orders.aggression, cfg);
  }
  const favorites: Record<string, string[]> = {};
  // Eclectic stables don't bother with builds.
  if (d.favorites && team.identity && (team.identity.focus ?? 0.5) >= 0.3) {
    for (const s of tactic.lineup) {
      const c = team.creatures.find((x) => x.id === s.creatureId);
      const fav = c ? styleFavorites(c, team.identity.style, cfg.combat.favorites.max, cfg) : [];
      if (fav.length) favorites[s.creatureId] = fav;
    }
  }
  return { ...tactic, orders, favorites, ai: managerStyle(team, difficulty, orders, cfg) };
}
