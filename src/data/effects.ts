import type { EffectDef } from './schema.ts';

export const EFFECTS: Record<string, EffectDef> = {
  /** Short and fierce; also halves the healing received. */
  burning: {
    id: 'burning', name: 'Burning', kind: 'dot', beneficial: false, defaultDuration: 3, magnitude: 0.05,
    mods: { healingTaken: 0.4 }, description: 'Loses a lot of health every round, and healing received is cut by 60 %.',
  },
  /** Stacks up to 5 doses; each dose drains health every round (armour does not help). */
  poisoned: {
    id: 'poisoned', name: 'Poisoned', kind: 'dot', beneficial: false, defaultDuration: 4, magnitude: 0.028, maxStacks: 5,
    mods: { damageMult: 0.95 },
    description: 'Loses health every round for each dose (up to 5, armour does not help) and hits a little softer. Every new dose renews the duration.',
  },
  /** Stacks up to 3 wounds; any healing ability closes them all. */
  bleeding: {
    id: 'bleeding', name: 'Bleeding', kind: 'dot', beneficial: false, defaultDuration: 4, magnitude: 0.025, maxStacks: 3, endsOnHeal: true,
    description: 'Loses health every round for each wound (up to 3). Any healing stops the bleeding at once.',
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
  /** Three charges of cold freeze the target solid. */
  chilled: {
    id: 'chilled', name: 'Chilled', kind: 'mods', beneficial: false, defaultDuration: 3, maxStacks: 3, onMaxStacks: 'frozen',
    mods: { initiativeMult: 0.85 }, description: 'Acts a little later. At 3 charges of cold, freezes solid.',
  },
  frozen: {
    id: 'frozen', name: 'Frozen', kind: 'stun', beneficial: false, defaultDuration: 1,
    mods: { dodgeBonus: -0.2 }, description: 'Frozen solid: loses its next turn and cannot dodge well. Cannot be chilled while frozen.',
  },
  // ——— Curses: last until the next break (or the end of the match), cannot be cleansed ———
  hexed: {
    id: 'hexed', name: 'Hexed', kind: 'mods', beneficial: false, defaultDuration: 1, curse: true,
    mods: { damageMult: 0.8 }, description: 'Curse: deals 20 % less damage until the next break.',
  },
  frailty: {
    id: 'frailty', name: 'Frailty', kind: 'mods', beneficial: false, defaultDuration: 1, curse: true,
    mods: { mitigation: -0.15 }, description: 'Curse: armour and spell resistance reduced until the next break.',
  },
  blighted: {
    id: 'blighted', name: 'Blighted', kind: 'mods', beneficial: false, defaultDuration: 1, curse: true,
    mods: { healingTaken: 0.5 }, description: 'Curse: receives half healing until the next break.',
  },
  jinxed: {
    id: 'jinxed', name: 'Jinxed', kind: 'mods', beneficial: false, defaultDuration: 1, curse: true,
    mods: { hitBonus: -0.1, critBonus: -0.05 }, description: 'Curse: misses more and lands fewer critical hits until the next break.',
  },
  regenerating: {
    id: 'regenerating', name: 'Regenerating', kind: 'hot', beneficial: true, defaultDuration: 3, magnitude: 0.05,
    description: 'Recovers health every round.',
  },
  /** Stamina drained: recovers less of it. */
  sapped: {
    id: 'sapped', name: 'Sapped', kind: 'mods', beneficial: false, defaultDuration: 3,
    mods: { staminaRegenMult: 0.5 }, description: 'Recovers half as much stamina each round.',
  },
  /** Buff: thorns that hurt melee attackers. */
  thorned: {
    id: 'thorned', name: 'Thorns', kind: 'mods', beneficial: true, defaultDuration: 3,
    mods: { thorns: 0.3 }, description: 'Sends 30 % of the melee damage it takes back to the attacker.',
  },
  /** Bramble horror passive. */
  thornhide: {
    id: 'thornhide', name: 'Thorn Hide', kind: 'mods', beneficial: true, defaultDuration: 999,
    mods: { thorns: 0.25 }, description: 'Covered in thorns: sends 25 % of the melee damage it takes back to the attacker.',
  },
  /** Ogre passive: hits harder the more it is hurt. */
  bloodlust: {
    id: 'bloodlust', name: 'Bloodlust', kind: 'mods', beneficial: true, defaultDuration: 999,
    mods: { fury: 0.4 }, description: 'The more wounded, the harder it hits: up to +40 % damage near 0 health.',
  },
  frenzied: {
    id: 'frenzied', name: 'Frenzied', kind: 'mods', beneficial: true, defaultDuration: 3,
    mods: { fury: 0.6 }, description: 'Up to +60 % damage, the more wounded the stronger.',
  },
  /** Troll passive: permanent, weaker regeneration. */
  trollblood: {
    id: 'trollblood', name: 'Troll Blood', kind: 'hot', beneficial: true, defaultDuration: 999, magnitude: 0.025,
    description: 'Wounds close by themselves.',
  },
  stoneform: {
    id: 'stoneform', name: 'Stone Body', kind: 'mods', beneficial: true, defaultDuration: 999,
    mods: { mitigation: 0.05 }, description: 'Made of rock: shrugs off part of every blow.',
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
