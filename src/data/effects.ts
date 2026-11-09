import type { EffectDef } from './schema.ts';

export const EFFECTS: Record<string, EffectDef> = {
  burning: {
    id: 'burning', name: 'Burning', kind: 'dot', beneficial: false, defaultDuration: 3, magnitude: 0.04,
    description: 'Loses health every round.',
  },
  poisoned: {
    id: 'poisoned', name: 'Poisoned', kind: 'dot', beneficial: false, defaultDuration: 4, magnitude: 0.035,
    mods: { damageMult: 0.92 }, description: 'Loses health every round and hits a little softer.',
  },
  bleeding: {
    id: 'bleeding', name: 'Bleeding', kind: 'dot', beneficial: false, defaultDuration: 3, magnitude: 0.03,
    description: 'Loses health every round.',
  },
  stunned: {
    id: 'stunned', name: 'Stunned', kind: 'stun', beneficial: false, defaultDuration: 1,
    mods: { dodgeBonus: -0.15 }, description: 'Loses its next turn.',
  },
  slowed: {
    id: 'slowed', name: 'Slowed', kind: 'mods', beneficial: false, defaultDuration: 2,
    mods: { initiativeMult: 0.6, dodgeBonus: -0.08 }, description: 'Acts later and dodges worse.',
  },
  weakened: {
    id: 'weakened', name: 'Weakened', kind: 'mods', beneficial: false, defaultDuration: 2,
    mods: { damageMult: 0.75 }, description: 'Deals reduced damage.',
  },
  terrified: {
    id: 'terrified', name: 'Terrified', kind: 'mods', beneficial: false, defaultDuration: 2,
    mods: { hitBonus: -0.08 }, moralePerRound: -6, description: 'Morale drains every round and aim falters.',
  },
  exposed: {
    id: 'exposed', name: 'Exposed', kind: 'mods', beneficial: false, defaultDuration: 2,
    mods: { mitigation: -0.15, dodgeBonus: -0.1 }, description: 'Guard broken: takes more damage.',
  },
  shielded: {
    id: 'shielded', name: 'Shielded', kind: 'shield', beneficial: true, defaultDuration: 3, magnitude: 0.18,
    description: 'A barrier absorbs incoming damage.',
  },
  fortified: {
    id: 'fortified', name: 'Fortified', kind: 'mods', beneficial: true, defaultDuration: 2,
    mods: { mitigation: 0.2 }, description: 'Takes reduced damage.',
  },
  rallied: {
    id: 'rallied', name: 'Rallied', kind: 'mods', beneficial: true, defaultDuration: 3,
    mods: { damageMult: 1.12, hitBonus: 0.05 }, moralePerRound: 4, description: 'Fired up: hits harder and truer.',
  },
  enraged: {
    id: 'enraged', name: 'Enraged', kind: 'mods', beneficial: true, defaultDuration: 3,
    mods: { damageMult: 1.3, mitigation: -0.1, critBonus: 0.05 },
    description: 'Blind fury: big damage, poor guard, ignores orders.',
  },
  evasive: {
    id: 'evasive', name: 'Evasive', kind: 'mods', beneficial: true, defaultDuration: 2,
    mods: { dodgeBonus: 0.15, initiativeMult: 1.2 }, description: 'Darts around, hard to pin down.',
  },
  regenerating: {
    id: 'regenerating', name: 'Regenerating', kind: 'hot', beneficial: true, defaultDuration: 3, magnitude: 0.05,
    description: 'Recovers health every round.',
  },
  /** Troll passive: permanent, weaker regeneration. */
  trollblood: {
    id: 'trollblood', name: 'Troll Blood', kind: 'hot', beneficial: true, defaultDuration: 999, magnitude: 0.025,
    description: 'Wounds close by themselves.',
  },
  stoneform: {
    id: 'stoneform', name: 'Stone Body', kind: 'mods', beneficial: true, defaultDuration: 999,
    mods: { mitigation: 0.08 }, description: 'Made of rock: shrugs off part of every blow.',
  },
  incorporeal: {
    id: 'incorporeal', name: 'Incorporeal', kind: 'mods', beneficial: true, defaultDuration: 999,
    mods: { dodgeBonus: 0.08 }, description: 'Half there, half not: blows pass through.',
  },
  /** Phoenix passive: its flame keeps rekindling. */
  rekindling: {
    id: 'rekindling', name: 'Rekindling', kind: 'hot', beneficial: true, defaultDuration: 999, magnitude: 0.02,
    description: 'Its flame keeps rekindling.',
  },
};
