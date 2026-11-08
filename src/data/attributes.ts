/** Visible creature attributes, on a 1–20 scale. */

export const PHYSICAL_ATTRIBUTES = ['strength', 'stamina', 'speed', 'agility', 'toughness', 'recovery'] as const;
export const COMBAT_ATTRIBUTES = ['attack', 'accuracy', 'defense', 'magic', 'focus', 'technique'] as const;
export const MENTAL_ATTRIBUTES = [
  'courage',
  'composure',
  'aggression',
  'tactics',
  'discipline',
  'anticipation',
  'determination',
  'teamwork',
  'leadership',
] as const;

export const ATTRIBUTE_KEYS = [...PHYSICAL_ATTRIBUTES, ...COMBAT_ATTRIBUTES, ...MENTAL_ATTRIBUTES] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type AttributeCategory = 'physical' | 'combat' | 'mental';
export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_CATEGORIES: Record<AttributeCategory, readonly AttributeKey[]> = {
  physical: PHYSICAL_ATTRIBUTES,
  combat: COMBAT_ATTRIBUTES,
  mental: MENTAL_ATTRIBUTES,
};

export const CATEGORY_LABELS: Record<AttributeCategory, string> = {
  physical: 'Physical',
  combat: 'Combat',
  mental: 'Mental',
};

export const ATTRIBUTE_INFO: Record<AttributeKey, { name: string; short: string; description: string }> = {
  strength: { name: 'Strength', short: 'Str', description: 'Raw power behind melee blows. Adds to health.' },
  stamina: { name: 'Stamina', short: 'Sta', description: 'Size of the energy pool and how long the creature lasts.' },
  speed: { name: 'Speed', short: 'Spd', description: 'How early the creature acts each round.' },
  agility: { name: 'Agility', short: 'Agi', description: 'Dodging blows and missiles.' },
  toughness: { name: 'Toughness', short: 'Tgh', description: 'Health and resistance to physical damage.' },
  recovery: { name: 'Recovery', short: 'Rec', description: 'Energy regained between actions and when resting.' },
  attack: { name: 'Attack', short: 'Atk', description: 'Landing melee strikes.' },
  accuracy: { name: 'Accuracy', short: 'Acc', description: 'Landing ranged attacks.' },
  defense: { name: 'Defense', short: 'Def', description: 'Parrying and blocking melee attacks.' },
  magic: { name: 'Magic', short: 'Mag', description: 'Power of spells and healing.' },
  focus: { name: 'Focus', short: 'Foc', description: 'Precision of spells and resistance to hostile magic.' },
  technique: { name: 'Technique', short: 'Tec', description: 'Critical strikes and finesse with ranged weapons.' },
  courage: { name: 'Courage', short: 'Cou', description: 'Holding firm when allies fall or the blows hurt.' },
  composure: { name: 'Composure', short: 'Cmp', description: 'Cool head under pressure: crits and fewer mistakes.' },
  aggression: { name: 'Aggression', short: 'Agr', description: 'Hits harder but guards less, and may ignore caution.' },
  tactics: { name: 'Tactical Sense', short: 'Tac', description: 'Making smart choices: targets, type matchups, timing.' },
  discipline: { name: 'Discipline', short: 'Dis', description: 'Following the manager’s orders.' },
  anticipation: { name: 'Anticipation', short: 'Ant', description: 'Reading the fight: initiative, dodging, intercepting.' },
  determination: { name: 'Determination', short: 'Det', description: 'Fighting back harder when the team is behind.' },
  teamwork: { name: 'Teamwork', short: 'Tea', description: 'Coordinated attacks and protecting allies.' },
  leadership: { name: 'Leadership', short: 'Lea', description: 'Keeps allies’ morale up while on the field.' },
};
