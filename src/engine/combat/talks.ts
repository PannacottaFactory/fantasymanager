/**
 * Team talks: which talk a manager gives, before the match and at each break. Pure functions (no RNG): the same
 * situation always gets the same talk. `sim:talks` measures them.
 */
import { ABILITIES } from '../../data/abilities.ts';
import { getAbilities } from '../creature/derived.ts';
import type { AiManagerStyle, Talk, Team } from '../model.ts';
import type { Combat } from './combat.ts';
import type { Side } from './types.ts';

export const TALKS: Talk[] = ['rally', 'secondWind', 'focus', 'ranks', 'evade', 'fury'];

/** Why a talk was picked (the assistant's advice is worded from it). */
export type TalkReason = 'tired' | 'shaken' | 'ranged' | 'melee' | 'behind' | 'default';

export interface TalkAdvice {
  talk: Talk;
  reason: TalkReason;
}

/** What a team looks like when the talk is given: its stamina and morale, the opponent's way of fighting. */
export interface TalkSituation {
  /** Average stamina of the creatures on the field, 0–1. */
  stamina: number;
  /** Average morale, 0–100. */
  morale: number;
  /** Share of the opponents' attacking abilities that are melee, 0–1. */
  foeMelee: number;
  /** Behind on the judges' cards in the last period. */
  behindLate: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Share of melee among a creature's attacking abilities. */
export function meleeShare(abilities: readonly string[]): number {
  const atk = abilities.map((id) => ABILITIES[id]).filter((a) => a && a.power > 0 && (a.kind === 'melee' || a.kind === 'ranged' || a.kind === 'spell'));
  return atk.length ? atk.filter((a) => a!.kind === 'melee').length / atk.length : 0.5;
}

/** The talk of a manager who reads the game: tired → second wind, shaken → rally, late and behind → fury, then the foe's style. */
export function readTalk(s: TalkSituation): TalkAdvice {
  if (s.stamina < 0.5) return { talk: 'secondWind', reason: 'tired' };
  if (s.morale < 40) return { talk: 'rally', reason: 'shaken' };
  if (s.behindLate) return { talk: 'fury', reason: 'behind' };
  if (s.foeMelee <= 0.4) return { talk: 'evade', reason: 'ranged' };
  if (s.foeMelee >= 0.7) return { talk: 'ranks', reason: 'melee' };
  return { talk: 'focus', reason: 'default' };
}

/** The talk a manager gives, by temperament (`talker`); managers who read the game follow `readTalk`. */
export function managerTalk(style: AiManagerStyle | undefined, s: TalkSituation): Talk {
  const read = readTalk(s);
  switch (style?.talker ?? 'read') {
    case 'read':
      return read.talk;
    case 'cautious':
      return read.reason === 'tired' || read.reason === 'shaken' ? read.talk : 'ranks';
    case 'aggressive':
      return s.behindLate || s.stamina >= 0.7 ? (s.behindLate ? 'fury' : 'focus') : read.talk;
    case 'gambler':
      return s.behindLate ? 'fury' : 'focus';
    case 'steady':
      return s.stamina < 0.6 ? 'secondWind' : 'focus';
  }
}

/** Situation before the match, from the two line-ups (fatigue stands for the stamina lost). */
export function preMatchSituation(own: Team, foe: Team | undefined): TalkSituation {
  const starters = (t: Team) => t.tactic.lineup.map((s) => t.creatures.find((c) => c.id === s.creatureId)).filter((c) => !!c);
  const mine = starters(own);
  return {
    stamina: 1 - avg(mine.map((c) => c.condition.fatigue)) / 100,
    morale: avg(mine.map((c) => c.condition.morale)),
    foeMelee: foe ? avg(starters(foe).map((c) => meleeShare(getAbilities(c).map((a) => a.id)))) : 0.55,
    behindLate: false,
  };
}

/** Situation at a break, from the creatures on the field and the judges' cards. */
export function breakSituation(combat: Combat, side: Side): TalkSituation {
  const foeSide: Side = side === 0 ? 1 : 0;
  const mine = combat.active(side);
  const foes = combat.active(foeSide);
  const last = combat.cfg.match.breakRounds.at(-1) ?? 15;
  return {
    stamina: avg(mine.map((c) => c.stamina / Math.max(1, c.maxStamina))),
    morale: avg(mine.map((c) => c.morale)),
    foeMelee: avg(foes.map((c) => meleeShare(c.abilities))),
    behindLate: combat.round >= last && combat.judgeScore(side) < combat.judgeScore(foeSide) - 5,
  };
}
