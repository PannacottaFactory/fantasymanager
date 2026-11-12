/**
 * Advice for the next match, from what the player can see: the next opponent's line-up (species, elements, roles —
 * all public), the player's own squad (fatigue, injuries, points to place). Never reads hidden attributes of the
 * opponent's creatures, nor its approach. Pure: returns tips (keys and values), worded by the UI.
 */
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { EFFECTS } from '../../data/effects.ts';
import type { ElementId } from '../../data/schema.ts';
import { elementMultiplier } from '../combat/formulas.ts';
import { getSpecies, isInjured, overallRating } from '../creature/derived.ts';
import type { Creature, Team } from '../model.ts';
import type { Tip } from './verdict.ts';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function starters(team: Team): Creature[] {
  return team.tactic.lineup.flatMap((s) => team.creatures.find((c) => c.id === s.creatureId) ?? []);
}

/** Their likely starters: the current line-up, or the five best fit creatures. */
function likelyStarters(team: Team): Creature[] {
  const s = starters(team).filter((c) => !isInjured(c));
  if (s.length >= 3) return s;
  return team.creatures.filter((c) => !isInjured(c)).sort((a, b) => overallRating(b) - overallRating(a)).slice(0, 5);
}

/** Average multiplier of a creature's best element against a set of defenders. */
function attackEdge(c: Creature, foes: Creature[], cfg: GameConfig): number {
  const els = getSpecies(c).elements;
  if (!els.length || !foes.length) return 1;
  return Math.max(...els.map((e) => avg(foes.map((f) => elementMultiplier(e, getSpecies(f).elements, cfg)))));
}

/** Average multiplier the foes' elements get against a creature. */
function threatTo(c: Creature, foes: Creature[], cfg: GameConfig): number {
  const mine = getSpecies(c).elements;
  return avg(foes.map((f) => Math.max(1, ...getSpecies(f).elements.map((e: ElementId) => elementMultiplier(e, mine, cfg)))));
}

export interface NextMatchContext {
  /** The player's stable and the next opponent. */
  team: Team;
  foe: Team;
  /** The player plays twice in the coming week. */
  double?: boolean;
}

export function nextMatchAdvice(ctx: NextMatchContext, cfg: GameConfig = DEFAULT_CONFIG): Tip[] {
  const { team, foe } = ctx;
  const tips: Tip[] = [];
  const tip = (key: Tip['key'], weight: number, to: Tip['to'], vars: Tip['vars'] = {}) => tips.push({ key, vars, to, weight });
  const ours = starters(team);
  const theirs = likelyStarters(foe);
  const fit = team.creatures.filter((c) => !isInjured(c));
  const ourIds = new Set(ours.map((c) => c.id));

  // Injured or tired starters.
  const injured = ours.filter(isInjured);
  if (injured.length) tip('nextInjured', 8, 'tactics', { names: injured.map((c) => c.name).join(', ') });
  const tired = ours.filter((c) => !isInjured(c) && c.condition.fatigue >= 40).sort((a, b) => b.condition.fatigue - a.condition.fatigue);
  if (tired.length) tip('nextRest', 3 + tired.length * 1.5 + (ctx.double ? 2 : 0), 'tactics', { names: tired.slice(0, 3).map((c) => c.name).join(', '), pct: Math.round(tired[0]!.condition.fatigue) });
  if (ctx.double) tip('nextDouble', 4, 'tactics');

  // Points to place.
  const points = team.creatures.filter((c) => (c.growth?.freePoints ?? 0) > 0);
  if (points.length) tip('nextPoints', 2.5 + points.length / 2, 'squad', { names: points.slice(0, 3).map((c) => c.name).join(', '), n: points.reduce((s, c) => s + (c.growth?.freePoints ?? 0), 0) });

  if (theirs.length) {
    // Elements: a fit creature left out that hits them hard, or starters their elements hurt.
    const edge = fit
      .filter((c) => !ourIds.has(c.id))
      .map((c) => ({ c, m: attackEdge(c, theirs, cfg) }))
      .filter((x) => x.m >= 1.15)
      .sort((a, b) => b.m - a.m || overallRating(b.c) - overallRating(a.c))[0];
    if (edge) tip('nextElements', 3 + (edge.m - 1) * 10, 'tactics', { name: edge.c.name, mult: Math.round(edge.m * 100) / 100, foe: foe.name });
    const exposed = ours.filter((c) => threatTo(c, theirs, cfg) >= 1.2);
    if (exposed.length) tip('nextVulnerable', 2 + exposed.length * 1.5, 'tactics', { names: exposed.slice(0, 3).map((c) => c.name).join(', '), foe: foe.name });

    // Their shape.
    const roleOf = (c: Creature) => foe.tactic.lineup.find((s) => s.creatureId === c.id)?.role;
    const healers = theirs.filter((c) => roleOf(c) === 'support');
    if (healers.length && team.tactic.orders.target !== 'casters') tip('nextHealers', 2.5 + healers.length, 'tactics', { n: healers.length, foe: foe.name });
    const tanks = theirs.filter((c) => roleOf(c) === 'tank');
    if (tanks.length >= 2) tip('nextTanks', 2 + tanks.length / 2, 'tactics', { n: tanks.length, foe: foe.name });
    const thorny = theirs.filter((c) => (getSpecies(c).passives ?? []).some((p) => (EFFECTS[p]?.mods?.thorns ?? 0) > 0));
    if (thorny.length) tip('nextThorns', 2 + thorny.length, 'tactics', { names: thorny.map((c) => c.name).join(', ') });

  }
  return tips.sort((a, b) => b.weight - a.weight);
}
