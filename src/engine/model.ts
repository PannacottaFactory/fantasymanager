/** Runtime data model shared by every engine module. Everything here is plain, serializable data. */
import type { TeamCrest } from '../data/crest.ts';
import type { AttributeKey, Attributes } from '../data/attributes.ts';
import type { Line, RoleId, TargetPriority } from '../data/schema.ts';
import type { ManagerId, PlayStyleId } from '../data/config/identity.ts';

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
  /** Gold pieces per week. */
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
  /** Training progress not yet turned into whole points (league games). */
  growth?: CreatureGrowth;
}

export interface CreatureGrowth {
  /** Fraction of the next ability point. */
  ability: number;
  /** Attribute points earned (or lost) but not yet given to an attribute. */
  pool: number;
  /** Attribute points gained (− lost) this season. */
  season: number;
  /** XP earned in this week's match, turned into progress by the weekly training. */
  matchXp?: number;
  /** Player's creatures: attribute points to place by hand (one per level gained). */
  freePoints?: number;
  // ——— Player's creatures only (visual progression) ———
  /** Attributes when the season started (or when the creature joined). */
  seasonStart?: Partial<Record<AttributeKey, number>>;
  /** Latest attribute changes, newest last: attribute, +1/−1, season, matchday (0 = off-season). */
  recent?: { k: AttributeKey; d: number; s: number; w: number }[];
  /** Ability over time: [season, matchday, ability]. */
  history?: [number, number, number][];
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

/** How an AI manager behaves at the breaks. */
export interface AiManagerStyle {
  /** Swap a creature out below this stamina fraction. */
  tiredBelow: number;
  /** Swap a creature out below this HP fraction. */
  hurtBelow: number;
  /** Adjust aggression to the score. */
  adaptOrders: boolean;
  /** Re-reads the opponent's line-up at each break (target orders). */
  reads?: boolean;
  /** Orders to come back to when the score is level. */
  base?: TeamOrders;
}

export interface Tactic {
  lineup: LineupSlot[];
  bench: string[];
  orders: TeamOrders;
  /** Favourite abilities per creature (light "builds"): the AI leans towards them in combat. */
  favorites?: Record<string, string[]>;
  /** AI stables: their manager's break behaviour (the player decides alone). */
  ai?: AiManagerStyle;
}

/** An AI stable's personality: the style it builds around and its manager's temperament. */
export interface StableIdentity {
  style: PlayStyleId;
  manager: ManagerId;
  /** How much the stable sticks to its style (0 = eclectic, 1 = purist): squad share, signings, favourites. */
  focus: number;
}

export interface Team {
  id: string;
  name: string;
  creatures: Creature[];
  tactic: Tactic;
  /** AI stables only. */
  identity?: StableIdentity;
  /** The stable's crest (the player's choice; AI stables: drawn from the id when missing). */
  crest?: TeamCrest;
}
