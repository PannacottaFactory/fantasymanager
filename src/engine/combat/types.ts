import type { Attributes } from '../../data/attributes.ts';
import type { ElementId, Line, RoleId, SizeClass } from '../../data/schema.ts';
import type { Stance, Team, TeamOrders } from '../model.ts';

export type Side = 0 | 1;
export type CombatantState = 'active' | 'bench' | 'ko' | 'fled' | 'withdrawn';

export interface ActiveEffect {
  id: string;
  /** Rounds left (stun: turns lost). Permanent passives use a huge value. */
  remaining: number;
  /** Remaining absorption for shields. */
  shieldHp?: number;
  sourceId?: string;
  /** Stacks of a stacking effect (poison doses, chill charges). */
  stacks?: number;
}

export interface Combatant {
  id: string;
  side: Side;
  name: string;
  speciesId: string;
  size: SizeClass;
  elements: ElementId[];
  flying: boolean;
  role: RoleId;
  line: Line;
  stance: Stance;
  /** Effective attributes (traits applied). */
  attrs: Attributes;
  traits: string[];
  abilities: string[];
  /** Abilities the manager asked this creature to favour. */
  favorites: string[];
  /** Multiplier on what the creature's role does, from its role fit (≈0.85–1.15). */
  roleFactor: number;
  /** The role is one of the species' natural roles. */
  naturalRole: boolean;
  /** Hidden ability 1–200 (used by AI "strongest" target and ratings). */
  ability: number;
  injuryProneness: number;
  /** Fatigue (0–100) the creature carried into the match. */
  preFatigue: number;
  cooldowns: Record<string, number>;
  maxHp: number;
  hp: number;
  maxStamina: number;
  stamina: number;
  morale: number;
  effects: ActiveEffect[];
  state: CombatantState;
  guarding: boolean;
  exhaustedAnnounced: boolean;
  lowHpRageUsed: boolean;
  /** Substituted out (or replaced after a KO). */
  replaced: boolean;
  enteredRound: number | null;
  leftRound: number | null;
  damageDealt: number;
  lastDamageElement: string;
}

/** Static info about every creature in the match (for commentary, UI and report). */
export interface RosterEntry {
  id: string;
  side: Side;
  name: string;
  speciesId: string;
  role: RoleId;
  line: Line;
  maxHp: number;
  maxStamina: number;
  starter: boolean;
  traits: string[];
  abilities: string[];
  favorites: string[];
}

export interface MatchSetup {
  seed: number | string;
  teams: [Team, Team];
}

export interface SubstitutionDecision {
  outId: string;
  inId: string;
}

export interface BreakDecision {
  substitutions?: SubstitutionDecision[];
  orders?: TeamOrders;
  lineChanges?: { id: string; line: Line }[];
  stanceChanges?: { id: string; stance: Stance }[];
}

export type MatchMethod = 'ko' | 'points';

export interface MatchOutcome {
  winner: Side;
  method: MatchMethod;
  rounds: number;
  /** Judges' score: % of the opponents' total health removed. */
  score: [number, number];
}

export interface CombatantSnapshot {
  id: string;
  hp: number;
  stamina: number;
  morale: number;
  state: CombatantState;
  line: Line;
  effects: string[];
  /** Stacks of stacking effects (only those above 1). */
  stacks?: Record<string, number>;
  /** Rounds before each ability can be used again (only abilities on cooldown). */
  cooldowns: Record<string, number>;
}

export type AttackKind = 'melee' | 'ranged' | 'spell';

export type MatchEvent =
  | { type: 'matchStart'; round: 0; teams: [string, string]; snapshot: CombatantSnapshot[] }
  | { type: 'roundStart'; round: number }
  | {
      type: 'attack';
      round: number;
      actor: string;
      target: string;
      ability: string;
      kind: AttackKind;
      hit: boolean;
      damage: number;
      crit: boolean;
      elementMult: number;
      absorbed: number;
      targetHp: number;
      /** Id of the creature originally targeted when a guard intercepted the blow. */
      interceptedFrom?: string;
      aoe: boolean;
      flank: boolean;
      healed?: number;
      /** Execution bonus applied (target was low on health). */
      execute?: boolean;
      /** Pack: allies that had already hit the target this round (when it raised the damage). */
      pack?: number;
    }
  /** Sacrifice: the user paid `amount` of its own health. */
  | { type: 'sacrifice'; round: number; actor: string; ability: string; amount: number; hp: number }
  /** Thorns: `actor` (the one hit) sends `amount` back to `target` (the melee attacker). */
  | { type: 'thorns'; round: number; actor: string; target: string; amount: number; hp: number }
  /** Stamina drained from `target`. */
  | { type: 'drain'; round: number; actor: string; target: string; ability: string; amount: number; stamina: number }
  | { type: 'heal'; round: number; actor: string; target: string; ability: string; amount: number; targetHp: number }
  | { type: 'buff'; round: number; actor: string; ability: string; targets: string[] }
  | { type: 'debuff'; round: number; actor: string; ability: string; targets: string[]; affected: string[] }
  /** Stamina paid for an action (before it resolves). `ability` is null for a guard. */
  | { type: 'spend'; round: number; actor: string; ability: string | null; cost: number; stamina: number; cooldown: number }
  | { type: 'guard'; round: number; actor: string }
  | { type: 'rest'; round: number; actor: string; gained: number }
  | { type: 'hesitate'; round: number; actor: string }
  | { type: 'flee'; round: number; actor: string }
  /** Turn lost; `effect` says why (stunned, frozen). */
  | { type: 'stunned'; round: number; actor: string; effect?: string }
  | { type: 'showboat'; round: number; actor: string }
  | { type: 'disobey'; round: number; actor: string; ordered: string; chose: string }
  /** `stacks` = total stacks after this application (stacking effects only). */
  | { type: 'effectApplied'; round: number; target: string; effect: string; source?: string; stacks?: number }
  /** Harmful effects removed by a purifying ability. */
  | { type: 'cleanse'; round: number; actor: string; target: string; ability: string; removed: string[] }
  | { type: 'effectTick'; round: number; target: string; effect: string; amount: number; hp: number }
  | { type: 'effectExpired'; round: number; target: string; effect: string }
  | { type: 'enrage'; round: number; actor: string; reason: 'lowHp' | 'allyKo' }
  | { type: 'exhausted'; round: number; actor: string }
  | { type: 'moraleShift'; round: number; side: Side; reason: 'leader'; actor: string }
  | { type: 'ko'; round: number; target: string; by?: string }
  | { type: 'injury'; round: number; target: string; injuryId: string; weeks: number }
  | { type: 'roundEnd'; round: number; snapshot: CombatantSnapshot[] }
  | { type: 'break'; round: number; index: number }
  | { type: 'substitution'; round: number; side: Side; outId: string; inId: string }
  | { type: 'ordersChanged'; round: number; side: Side; orders: TeamOrders }
  | { type: 'matchEnd'; round: number; winner: Side; method: MatchMethod; score: [number, number] };

export type MatchEventType = MatchEvent['type'];

export interface PostMatchCreature {
  creatureId: string;
  fatigueGained: number;
  injuries: { injuryId: string; weeks: number }[];
  played: boolean;
}

export interface MatchResult {
  seed: number;
  teams: [{ id: string; name: string }, { id: string; name: string }];
  roster: Record<string, RosterEntry>;
  events: MatchEvent[];
  outcome: MatchOutcome;
  decisions: { round: number; side: Side; decision: BreakDecision }[];
  postMatch: PostMatchCreature[];
}

export type BreakDecider = (combat: import('./combat.ts').Combat, side: Side) => BreakDecision;
