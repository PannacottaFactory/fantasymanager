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

/** Break deciders that replay recorded decisions exactly (nothing else at the breaks). */
export function replayDeciders(decisions: MatchResult['decisions']): [BreakDecider, BreakDecider] {
  const pick = (side: 0 | 1): BreakDecider => (combat) => decisions.find((d) => d.side === side && d.round === combat.round)?.decision ?? {};
  return [pick(0), pick(1)];
}

/** Replays a recorded match (same seed, same teams, same decisions ⇒ the same fight). */
export function replayMatch(setup: MatchSetup, decisions: MatchResult['decisions'], cfg: GameConfig = DEFAULT_CONFIG): MatchResult {
  return simulateMatch(setup, { cfg, deciders: replayDeciders(decisions) });
}
