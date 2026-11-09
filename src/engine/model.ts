/** Runtime data model shared by every engine module. Everything here is plain, serializable data. */
import type { Attributes } from '../data/attributes.ts';
import type { Line, RoleId, TargetPriority } from '../data/schema.ts';

export interface HiddenAttributes {
  /** Training attitude (phase 4). */
  professionalism: number;
  /** Wants a bigger club / more money (phase 3). */
  ambition: number;
  loyalty: number;
  /** Volatility of mood. */
  temperament: number;
  injuryProneness: number;
  /** Match-to-match consistency (phase 2: form). */
  consistency: number;
}

export interface Injury {
  injuryId: string;
  weeksLeft: number;
}

export interface CreatureCondition {
  /** 0 = fresh, 100 = spent. */
  fatigue: number;
  /** 1–20, 10 is average. */
  form: number;
  /** 0–100. */
  morale: number;
  injuries: Injury[];
}

/** Employment terms with a stable (league games only). */
export interface Contract {
  /** Crowns per week. */
  wage: number;
  /** Last season covered by the contract. */
  untilSeason: number;
}

export interface Creature {
  id: string;
  name: string;
  speciesId: string;
  /** Years. */
  age: number;
  attributes: Attributes;
  hidden: HiddenAttributes;
  /** Current ability, 1–200 (hidden from the player, drives attribute levels). */
  ability: number;
  /** Potential ability, 1–200 (hidden). */
  potential: number;
  traits: string[];
  condition: CreatureCondition;
  /** −100 (rivalry) … +100 (bond), keyed by creature id. */
  relations: Record<string, number>;
  stableId: string | null;
  contract?: Contract;
}

export type Aggression = 'cautious' | 'balanced' | 'aggressive';
export type Risk = 'low' | 'normal' | 'high';
export type Stance = 'normal' | 'conserve' | 'allOut';

export interface TeamOrders {
  aggression: Aggression;
  target: TargetPriority;
  risk: Risk;
}

export interface LineupSlot {
  creatureId: string;
  role: RoleId;
  line: Line;
  stance: Stance;
}

export interface Tactic {
  lineup: LineupSlot[];
  bench: string[];
  orders: TeamOrders;
  /** Favourite abilities per creature (light "builds"): the AI leans towards them in combat. */
  favorites?: Record<string, string[]>;
}

export interface Team {
  id: string;
  name: string;
  creatures: Creature[];
  tactic: Tactic;
}
