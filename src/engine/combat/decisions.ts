/**
 * Break-time decisions taken by an AI manager (also used as the "assistant suggestion" for the player).
 * Deterministic: uses no randomness, only the combat state.
 */
import type { GameConfig } from '../../data/config/index.ts';
import type { AiManagerStyle, TeamOrders } from '../model.ts';
import { counterTarget } from '../team/identity.ts';
import { other, type Combat } from './combat.ts';
import { hpFraction, staminaFraction } from './formulas.ts';
import type { BreakDecision, Combatant, Side, SubstitutionDecision } from './types.ts';

export type { AiManagerStyle };

export const DEFAULT_AI_STYLE: AiManagerStyle = { tiredBelow: 0.25, hurtBelow: 0.25, adaptOrders: true };

function benchScore(c: Combatant, wantedRole: string): number {
  return c.ability + (c.role === wantedRole ? 25 : 0);
}

export function suggestSubstitutions(combat: Combat, side: Side, style: AiManagerStyle = DEFAULT_AI_STYLE): SubstitutionDecision[] {
  const cfg: GameConfig = combat.cfg;
  let left = cfg.match.maxSubstitutions - combat.sides[side].subsUsed;
  const bench = combat.bench(side).slice();
  const subs: SubstitutionDecision[] = [];
  const mine = combat.combatants.filter((c) => c.side === side && !c.replaced);
  // 1) Fill holes left by knocked-out or fled creatures. 2) Rest the exhausted / badly hurt.
  const downed = mine.filter((c) => c.state === 'ko' || c.state === 'fled');
  const struggling = mine
    .filter((c) => c.state === 'active' && (staminaFraction(c) < style.tiredBelow || hpFraction(c) < style.hurtBelow))
    .sort((a, b) => Math.min(staminaFraction(a), hpFraction(a)) - Math.min(staminaFraction(b), hpFraction(b)));
  for (const out of [...downed, ...struggling]) {
    if (left <= 0 || !bench.length) break;
    bench.sort((a, b) => benchScore(b, out.role) - benchScore(a, out.role));
    const inc = bench.shift()!;
    subs.push({ outId: out.id, inId: inc.id });
    left--;
  }
  return subs;
}

export function suggestOrders(combat: Combat, side: Side, base?: TeamOrders): TeamOrders {
  const current = combat.sides[side].orders;
  const diff = combat.teamHealth(side) - combat.teamHealth(other(side));
  const aliveDiff = combat.active(side).length - combat.active(other(side)).length;
  if (diff < -0.2 || aliveDiff <= -2) return { ...current, aggression: 'aggressive', risk: 'high' };
  if (diff > 0.3 && aliveDiff >= 1) return { ...current, aggression: 'cautious', risk: 'low' };
  if (base) return { ...current, aggression: base.aggression, risk: base.risk };
  return { ...current, aggression: 'balanced', risk: 'normal' };
}

/** A manager who reads the game picks the target order against what is still standing. */
export function readTarget(combat: Combat, side: Side): TeamOrders['target'] {
  return counterTarget(combat.active(other(side)).map((c) => ({ role: c.role, ability: c.ability })));
}

/** Break decisions of a side; by default with the side's own manager style (AI stables) or the assistant's. */
export function aiBreakDecision(combat: Combat, side: Side, style: AiManagerStyle = combat.sides[side].ai ?? DEFAULT_AI_STYLE): BreakDecision {
  const d: BreakDecision = { substitutions: suggestSubstitutions(combat, side, style) };
  if (style.adaptOrders) d.orders = suggestOrders(combat, side, style.base);
  if (style.reads) d.orders = { ...(d.orders ?? combat.sides[side].orders), target: readTarget(combat, side) };
  return d;
}
