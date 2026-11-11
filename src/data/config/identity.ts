/**
 * AI stable identities and difficulty levels.
 *
 * Play styles are a design tool: the game never names them. Each AI stable leans towards one (its squad, its
 * signings, the abilities it favours, its target orders) and is run by a manager with a temperament (aggression,
 * risk, when to substitute, whether it reads the opponent).
 */
import type { TargetPriority } from '../schema.ts';

export type PlayStyleId =
  | 'poison' | 'frost' | 'curse' | 'purify' | 'fortress' | 'burn' | 'bleed' | 'thorns' | 'drain'
  | 'execute' | 'exhaust' | 'terror' | 'pack' | 'area' | 'rage' | 'sacrifice' | 'skies';

export interface PlayStyleDef {
  /** Species this style recruits by preference. */
  species: string[];
  /** Abilities its creatures are told to favour (when they have them). */
  abilities: string[];
  /** Preferred target order. */
  target: TargetPriority;
}

export const PLAY_STYLES: Record<PlayStyleId, PlayStyleDef> = {
  poison: { species: ['giant-spider', 'giant-scorpion', 'myconid', 'basilisk', 'wyvern', 'manticore', 'hydra'], abilities: ['spider-bite', 'venom-pounce', 'scorpion-sting', 'toxic-spores', 'venom-fang', 'venom-sting', 'tail-spikes'], target: 'strongest' },
  frost: { species: ['frost-giant', 'winter-wolf', 'frost-wraith', 'wendigo', 'yeti'], abilities: ['frost-bite', 'frost-breath', 'glacial-club', 'avalanche', 'frost-bolt', 'blizzard', 'deep-freeze', 'frost-claws', 'yeti-maul', 'snow-hurl'], target: 'threat' },
  curse: { species: ['hag', 'lich', 'shade', 'mummy'], abilities: ['hex-bolt', 'curse-of-frailty', 'blight', 'evil-eye', 'withering-curse'], target: 'strongest' },
  purify: { species: ['unicorn', 'dryad', 'naga', 'elf', 'seraph', 'light-elemental', 'pegasus', 'satyr'], abilities: ['purifying-light', 'sanctuary', 'bloom', 'healing-waters', 'healing-song', 'healing-wind', 'wild-song'], target: 'nearest' },
  fortress: { species: ['golem', 'troll', 'treant', 'crystal-golem', 'naga', 'gargoyle', 'skeleton', 'lizardfolk'], abilities: ['stone-skin', 'barkskin', 'refraction', 'oak-blessing', 'healing-waters'], target: 'nearest' },
  burn: { species: ['hellhound', 'imp', 'phoenix', 'magma-golem', 'salamander', 'chimera', 'kobold'], abilities: ['hellfire-bite', 'flame-lunge', 'firebolt', 'cinder-cloud', 'molten-fist', 'lava-burst', 'fire-spit', 'ember-talons', 'firepot'], target: 'casters' },
  bleed: { species: ['werewolf', 'minotaur', 'harpy', 'raptor', 'gnoll', 'manticore'], abilities: ['savage-claws', 'rend-flesh', 'horn-gore', 'rake', 'raptor-claw', 'gnoll-flail', 'lion-maul'], target: 'weakest' },
  thorns: { species: ['bramble-horror', 'treant', 'troll', 'golem'], abilities: ['bramble-ward', 'barkskin'], target: 'nearest' },
  drain: { species: ['vampire', 'giant-bat', 'shade', 'wendigo', 'ghoul', 'death-knight'], abilities: ['vampiric-bite', 'blood-bolt', 'crimson-feast', 'leeching-bite', 'life-drain', 'ravenous-bite', 'runeblade'], target: 'threat' },
  execute: { species: ['giant-mantis', 'centaur', 'griffin', 'elf', 'sphinx', 'will-o-wisp'], abilities: ['scythe-arms', 'decapitate', 'aimed-shot', 'lance-charge', 'lure'], target: 'weakest' },
  exhaust: { species: ['ooze', 'giant-bat', 'kraken', 'naga'], abilities: ['engulf', 'sapping-spray', 'sonic-shriek', 'crushing-grip'], target: 'casters' },
  terror: { species: ['banshee', 'nightmare', 'shade', 'wendigo', 'dragon', 'death-knight', 'sphinx'], abilities: ['death-wail', 'harrowing-shriek', 'dread-charge', 'dread', 'terrifying-roar', 'chilling-howl', 'riddle'], target: 'weakest' },
  pack: { species: ['raptor', 'giant-hyena', 'winter-wolf', 'goblin', 'kobold', 'ghoul', 'gnoll'], abilities: ['hyena-bite', 'raptor-claw', 'pounce', 'spear-jab', 'ghoul-claws'], target: 'weakest' },
  area: { species: ['cyclops', 'storm-elemental', 'djinn', 'kraken', 'roc', 'mummy'], abilities: ['boulder-throw', 'chain-lightning', 'thunderclap', 'earthshaker', 'whirlwind', 'maelstrom', 'gale-wings', 'sandstorm', 'firepot'], target: 'nearest' },
  rage: { species: ['ogre', 'orc', 'minotaur', 'werewolf', 'chimera', 'yeti'], abilities: ['blood-frenzy', 'rampage', 'moon-howl', 'war-cry'], target: 'threat' },
  sacrifice: { species: ['blood-demon', 'seraph', 'phoenix'], abilities: ['blood-price', 'infernal-sacrifice', 'martyrdom', 'hymn-of-valor'], target: 'strongest' },
  skies: { species: ['griffin', 'wyvern', 'harpy', 'giant-bat', 'phoenix', 'roc', 'pegasus', 'gargoyle', 'will-o-wisp'], abilities: ['dive', 'radiant-dive', 'flame-lunge', 'radiant-dive'], target: 'casters' },
};

export const PLAY_STYLE_IDS = Object.keys(PLAY_STYLES) as PlayStyleId[];

export type ManagerId = 'cautious' | 'aggressive' | 'tactician' | 'gambler' | 'steady';

export interface ManagerDef {
  aggression: 'cautious' | 'balanced' | 'aggressive';
  risk: 'low' | 'normal' | 'high';
  /** Substitute creatures below this stamina / health fraction at a break. */
  tiredBelow: number;
  hurtBelow: number;
  /** Changes its orders at the breaks depending on the score. */
  adaptOrders: boolean;
  /** Reads the opponent (target orders) — at normal difficulty only tacticians do. */
  reads: boolean;
}

export const MANAGERS: Record<ManagerId, ManagerDef> = {
  cautious: { aggression: 'cautious', risk: 'low', tiredBelow: 0.35, hurtBelow: 0.35, adaptOrders: true, reads: false },
  aggressive: { aggression: 'aggressive', risk: 'high', tiredBelow: 0.15, hurtBelow: 0.15, adaptOrders: false, reads: false },
  tactician: { aggression: 'balanced', risk: 'normal', tiredBelow: 0.25, hurtBelow: 0.3, adaptOrders: true, reads: true },
  gambler: { aggression: 'balanced', risk: 'high', tiredBelow: 0.2, hurtBelow: 0.2, adaptOrders: true, reads: false },
  steady: { aggression: 'balanced', risk: 'normal', tiredBelow: 0.25, hurtBelow: 0.25, adaptOrders: true, reads: false },
};

export const MANAGER_IDS = Object.keys(MANAGERS) as ManagerId[];

/** Possible style focus of a stable, from eclectic to purist (drawn evenly). */
export const STYLE_FOCUS = [0.15, 0.4, 0.65, 0.9];

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  /** Quality tiers of each division's stables (the player takes the last slot of its division). */
  divisions: readonly (readonly string[])[];
  /** Share of an AI squad drawn from its style's species. */
  styleShare: number;
  /** AI stables get a manager temperament and their style's target orders (else everyone plays "steady"). */
  identities: boolean;
  /** Who reads the opponent: nobody, tacticians only, or every manager. */
  reading: 'none' | 'tacticians' | 'all';
  /** AI creatures favour their style's abilities. */
  favorites: boolean;
  /** AI managers rest creatures above this fatigue. */
  restFatigue: number;
  /** Player's starting treasury multiplier. */
  startMoney: number;
  /** Multiplier on the board's confidence losses. */
  boardLoss: number;
  /** Weight of the style when AI stables sign or buy (ability points). */
  styleBias: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    divisions: [
      ['elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional'],
      ['professional', 'regional', 'regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'regional'],
    ],
    styleShare: 0.35, identities: false, reading: 'none', favorites: false, restFatigue: 60, startMoney: 1.3, boardLoss: 0.5, styleBias: 6,
  },
  normal: {
    divisions: [
      ['elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional'],
      ['professional', 'professional', 'professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'novice', 'regional'],
    ],
    styleShare: 0.5, identities: true, reading: 'tacticians', favorites: true, restFatigue: 55, startMoney: 1, boardLoss: 1, styleBias: 10,
  },
  hard: {
    divisions: [
      ['elite', 'elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional'],
      ['professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'regional'],
    ],
    styleShare: 0.55, identities: true, reading: 'all', favorites: true, restFatigue: 45, startMoney: 0.8, boardLoss: 1.5, styleBias: 12,
  },
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];
