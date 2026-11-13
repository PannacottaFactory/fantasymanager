/**
 * Stable crests (heraldry): an emblem on a field of one or two colours split by a pattern.
 * Emblem ids must match the CREST list in scripts/extract-icons.mjs (game-icons.net).
 */
export type CrestPattern = 'plain' | 'pale' | 'fess' | 'bend' | 'quarterly' | 'chevron';

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

/** Heraldic tinctures, then a few more. */
export const CREST_COLORS = [
  '#a8262b', '#5a1020', '#d2691e', '#d4a62a', '#2f7d3a', '#1b7f80',
  '#4a90c8', '#1f4e9c', '#6b3fa0', '#6b4a2b', '#e8e8e8', '#222222',
];

/** Emblem colours: gold, silver, black. */
export const CREST_CHARGES = ['#f2d16b', '#f4f4f4', '#1a1a1a'];

export const CREST_PATTERNS: CrestPattern[] = ['plain', 'pale', 'fess', 'bend', 'quarterly', 'chevron'];
