import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { Combat } from './combat.ts';
import { aiBreakDecision } from './decisions.ts';
import type { BreakDecider, MatchResult, MatchSetup } from './types.ts';

export interface SimulateOptions {
  cfg?: GameConfig;
  /** Per-side break deciders; defaults to the AI manager. */
  deciders?: [BreakDecider?, BreakDecider?];
}

/** Runs a whole match without any UI. */
export function simulateMatch(setup: MatchSetup, opts: SimulateOptions = {}): MatchResult {
  const combat = new Combat(setup, opts.cfg ?? DEFAULT_CONFIG);
  while (combat.phase !== 'ended') {
    combat.advance();
    if (combat.phase === 'break') {
      // Both managers decide on the same information, then decisions are applied.
      const decisions = ([0, 1] as const).map((side) => (opts.deciders?.[side] ?? aiBreakDecision)(combat, side));
      combat.applyBreakDecision(0, decisions[0]!);
      combat.applyBreakDecision(1, decisions[1]!);
      combat.resume();
    }
  }
  return combat.result();
}
