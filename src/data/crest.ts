/**
 * Stable crests (heraldry): an emblem on a field of one or two colours split by a pattern.
 * Emblem ids must match the CREST list in scripts/extract-icons.mjs (game-icons.net).
 */
export type CrestPattern =
  | 'plain' | 'pale' | 'fess' | 'bend' | 'quarterly' | 'chevron'
  | 'bendSinister' | 'perSaltire' | 'gyronny' | 'chief' | 'bordure' | 'stripe'
  | 'band' | 'cross' | 'saltire' | 'paly' | 'barry' | 'checky';

export interface TeamCrest {
  emblem: string;
  /** Field colours (the second is used by every pattern but « plain »). */
  field: [string, string];
  pattern: CrestPattern;
  /** Colour of the emblem. */
  charge: string;
}

export const CREST_EMBLEMS = [
  'dragon-head', 'wolf-head', 'lion', 'griffin-symbol', 'eagle-head', 'bear-head', 'deer-head', 'boar',
  'snake', 'raven', 'fox-head', 'horse-head', 'unicorn', 'owl', 'scorpion', 'hydra',
  'skull-crossed-bones', 'crossed-swords', 'battle-axe', 'spartan-helmet', 'crown', 'fleur-de-lys', 'tower-flag', 'castle',
  'sun', 'evil-moon', 'flame', 'lightning-helix', 'snowflake-1', 'oak', 'rose', 'trident',
  'bull-horns', 'ram', 'goat', 'rabbit', 'spider-alt', 'bee', 'butterfly', 'beetle-shell',
  'crab', 'octopus', 'whale-tail', 'shark-jaws', 'tortoise', 'frog', 'swan', 'rooster',
  'cat', 'hound', 'elephant-head', 'pegasus', 'sea-dragon', 'wyvern', 'tiger-head', 'mermaid',
  'centaur', 'minotaur', 'harpy', 'stag-head', 'anchor', 'key', 'hourglass', 'anvil',
  'war-axe', 'bow-arrow', 'mailed-fist', 'horseshoe', 'harp', 'chalice-drops', 'scroll-unfurled', 'lantern-flame',
  'all-seeing-eye', 'pentacle', 'ankh', 'pine-tree', 'mushroom', 'wheat', 'lotus', 'tornado',
  'wave-crest', 'volcano', 'crystal-growth', 'crowned-skull', 'death-skull', 'claw-slashes', 'fangs', 'dragon-spiral',
  'winged-sword', 'heart-wings', 'visored-helm', 'spider-web', 'cauldron', 'castle-ruins', 'comet-spark', 'skull-staff',
] as const;

/** Heraldic tinctures, then a few more. AI stables draw their crest from these (kept as is so their crests never change). */
export const CREST_CLASSIC_COLORS = [
  '#a8262b', '#5a1020', '#d2691e', '#d4a62a', '#2f7d3a', '#1b7f80',
  '#4a90c8', '#1f4e9c', '#6b3fa0', '#6b4a2b', '#e8e8e8', '#222222',
];

/** Every colour the player can pick, in display order (by hue, then neutrals). */
export const CREST_COLORS = [
  '#e04a4a', '#a8262b', '#5a1020', '#a04a1e', '#d2691e', '#ff8c1a',
  '#d4a62a', '#f0e05a', '#c8a77a', '#8bc34a', '#2f7d3a', '#1e4a2a',
  '#4fc3c0', '#1b7f80', '#9cc9ec', '#4a90c8', '#1f4e9c', '#14244a',
  '#a77bd6', '#6b3fa0', '#d0458f', '#f2a7b8', '#6b4a2b', '#3b2a1e',
  '#e8e8e8', '#8a8f96', '#4a4f57', '#222222',
];

/** Gold, silver, black (the AI stables' emblems use these three). */
export const CREST_CLASSIC_CHARGES = ['#f2d16b', '#f4f4f4', '#1a1a1a'];

/** Emblem colours: gold, silver, black, then every field colour. */
export const CREST_CHARGES = [...CREST_CLASSIC_CHARGES, ...CREST_COLORS.filter((c) => c !== '#e8e8e8' && c !== '#222222')];

/** The patterns AI stables draw from. */
export const CREST_CLASSIC_PATTERNS: CrestPattern[] = ['plain', 'pale', 'fess', 'bend', 'quarterly', 'chevron'];

export const CREST_PATTERNS: CrestPattern[] = [
  ...CREST_CLASSIC_PATTERNS,
  'bendSinister', 'perSaltire', 'gyronny', 'chief', 'bordure', 'stripe',
  'band', 'cross', 'saltire', 'paly', 'barry', 'checky',
];
