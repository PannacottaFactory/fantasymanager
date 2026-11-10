import type { RoleDef, RoleId } from './schema.ts';

export const ROLES: Record<RoleId, RoleDef> = {
  tank: {
    id: 'tank',
    name: 'Tank',
    description: 'Holds the front line and intercepts blows aimed at allies. +6 % armour (more with a good fit), −10 % damage.',
    defaultLine: 'front',
    fit: { toughness: 3, defense: 2.5, stamina: 1.5, courage: 1.5, anticipation: 1, teamwork: 1, strength: 1 },
    ai: { damage: 0.8, heal: 0, buff: 1, debuff: 0.8, guard: 1.6, backlineHunter: 0 },
  },
  striker: {
    id: 'striker',
    name: 'Striker',
    description: 'Deals heavy melee damage from the front line. +15 % melee damage, −5 % armour.',
    defaultLine: 'front',
    fit: { strength: 3, attack: 3, technique: 1, aggression: 1, speed: 1, stamina: 1 },
    ai: { damage: 1.4, heal: 0, buff: 0.6, debuff: 0.6, guard: 0, backlineHunter: 0.2 },
  },
  support: {
    id: 'support',
    name: 'Support',
    description: 'Heals and empowers allies from the back line. +25 % healing, −15 % damage.',
    defaultLine: 'back',
    fit: { magic: 2.5, focus: 2, teamwork: 2, tactics: 1.5, composure: 1, leadership: 1 },
    ai: { damage: 0.5, heal: 1.8, buff: 1.5, debuff: 1, guard: 0, backlineHunter: 0 },
  },
  caster: {
    id: 'caster',
    name: 'Spellcaster',
    description: 'Hurls spells from the back line, exploiting elemental weaknesses. +15 % spell damage, −5 % armour.',
    defaultLine: 'back',
    fit: { magic: 3.5, focus: 2.5, tactics: 1.5, composure: 1 },
    ai: { damage: 1.4, heal: 0.4, buff: 0.6, debuff: 1, guard: 0, backlineHunter: 0.3 },
  },
  skirmisher: {
    id: 'skirmisher',
    name: 'Skirmisher',
    description: 'Fast flanker who reaches and harasses the enemy back line. +10 % ranged and +5 % melee damage, −4 % armour.',
    defaultLine: 'back',
    fit: { speed: 3, agility: 2.5, technique: 1.5, accuracy: 1, attack: 1, anticipation: 1 },
    ai: { damage: 1.2, heal: 0, buff: 0.5, debuff: 1, guard: 0, backlineHunter: 1.5 },
  },
};

export const ROLE_IDS = Object.keys(ROLES) as RoleId[];
