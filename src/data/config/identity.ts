/**
 * AI stable identities and difficulty levels.
 *
 * Play styles are a design tool: the game never names them. Each AI stable leans towards one (its squad, its
 * signings, the abilities it favours, its target orders) and is run by a manager with a temperament (aggression,
 * when to substitute, whether it reads the opponent).
 */
import type { TargetPriority } from '../schema.ts';

export type PlayStyleId =
  | 'poison' | 'frost' | 'curse' | 'purify' | 'fortress' | 'burn' | 'bleed' | 'thorns' | 'drain'
  | 'execute' | 'exhaust' | 'terror' | 'pack' | 'area' | 'rage' | 'sacrifice' | 'skies' | 'charm' | 'undying';

export interface PlayStyleDef {
  /** Species this style recruits by preference. */
  species: string[];
  /** Skills its creatures equip first (when they have unlocked them). */
  abilities: string[];
  /** Preferred target order. */
  target: TargetPriority;
}

export const PLAY_STYLES: Record<PlayStyleId, PlayStyleDef> = {
  poison: { species: ['giant-spider', 'giant-scorpion', 'myconid', 'basilisk', 'wyvern', 'manticore', 'hydra', 'rat-swarm', 'mandrake'], abilities: ['spider-bite', 'venom-pounce', 'scorpion-sting', 'toxic-spores', 'venom-fang', 'venom-sting', 'tail-spikes', 'plague-bite', 'root-rot', 'plague-tide'], target: 'strongest' },
  frost: { species: ['frost-giant', 'winter-wolf', 'frost-wraith', 'wendigo', 'yeti'], abilities: ['frost-bite', 'frost-breath', 'glacial-club', 'avalanche', 'frost-bolt', 'blizzard', 'deep-freeze', 'frost-claws', 'yeti-maul', 'snow-hurl'], target: 'threat' },
  curse: { species: ['hag', 'lich', 'shade', 'mummy', 'pixie'], abilities: ['hex-bolt', 'curse-of-frailty', 'blight', 'evil-eye', 'withering-curse', 'fairy-prank'], target: 'strongest' },
  purify: { species: ['unicorn', 'dryad', 'naga', 'elf', 'seraph', 'light-elemental', 'pegasus', 'satyr', 'jackal-warden', 'pixie'], abilities: ['purifying-light', 'sanctuary', 'bloom', 'healing-waters', 'healing-song', 'healing-wind', 'wild-song', 'embalm', 'fey-mend'], target: 'nearest' },
  fortress: { species: ['golem', 'troll', 'treant', 'crystal-golem', 'naga', 'gargoyle', 'skeleton', 'lizardfolk', 'dwarf', 'lamassu', 'mimic'], abilities: ['stone-skin', 'barkskin', 'refraction', 'oak-blessing', 'healing-waters', 'warding-wings', 'sticky-hide'], target: 'nearest' },
  burn: { species: ['hellhound', 'imp', 'phoenix', 'magma-golem', 'salamander', 'chimera', 'kobold', 'gnome', 'sun-lion'], abilities: ['hellfire-bite', 'flame-lunge', 'firebolt', 'cinder-cloud', 'molten-fist', 'lava-burst', 'fire-spit', 'ember-talons', 'firepot', 'forge-strike', 'solar-mane', 'clockwork-bomb'], target: 'casters' },
  bleed: { species: ['werewolf', 'minotaur', 'harpy', 'raptor', 'gnoll', 'manticore'], abilities: ['savage-claws', 'rend-flesh', 'horn-gore', 'rake', 'raptor-claw', 'gnoll-flail', 'lion-maul'], target: 'weakest' },
  thorns: { species: ['bramble-horror', 'treant', 'troll', 'golem'], abilities: ['bramble-ward', 'barkskin'], target: 'nearest' },
  drain: { species: ['vampire', 'giant-bat', 'shade', 'wendigo', 'ghoul', 'death-knight', 'locust-swarm'], abilities: ['vampiric-bite', 'blood-bolt', 'crimson-feast', 'leeching-bite', 'life-drain', 'ravenous-bite', 'runeblade', 'ravenous-swarm', 'devour'], target: 'threat' },
  execute: { species: ['giant-mantis', 'centaur', 'griffin', 'elf', 'sphinx', 'will-o-wisp', 'lamassu', 'jackal-warden', 'valkyrie'], abilities: ['scythe-arms', 'decapitate', 'aimed-shot', 'lance-charge', 'lure', 'judgement', 'weigh-the-heart'], target: 'weakest' },
  exhaust: { species: ['ooze', 'giant-bat', 'kraken', 'naga', 'locust-swarm'], abilities: ['engulf', 'sapping-spray', 'sonic-shriek', 'crushing-grip', 'devouring-cloud'], target: 'casters' },
  terror: { species: ['banshee', 'nightmare', 'shade', 'wendigo', 'dragon', 'death-knight', 'sphinx', 'mandrake', 'poltergeist'], abilities: ['death-wail', 'harrowing-shriek', 'dread-charge', 'dread', 'terrifying-roar', 'chilling-howl', 'riddle', 'mandrake-shriek'], target: 'weakest' },
  pack: { species: ['raptor', 'giant-hyena', 'winter-wolf', 'goblin', 'kobold', 'ghoul', 'gnoll', 'rat-swarm', 'locust-swarm'], abilities: ['hyena-bite', 'raptor-claw', 'pounce', 'spear-jab', 'ghoul-claws', 'mob-rush'], target: 'weakest' },
  area: { species: ['cyclops', 'storm-elemental', 'djinn', 'kraken', 'roc', 'mummy', 'thunderbird', 'sea-serpent', 'gnome'], abilities: ['boulder-throw', 'chain-lightning', 'thunderclap', 'earthshaker', 'whirlwind', 'maelstrom', 'gale-wings', 'sandstorm', 'firepot', 'forked-lightning', 'static-web', 'tidal-wave', 'arc-coil'], target: 'nearest' },
  rage: { species: ['ogre', 'orc', 'minotaur', 'werewolf', 'chimera', 'yeti', 'ettin'], abilities: ['blood-frenzy', 'rampage', 'moon-howl', 'war-cry', 'double-smash'], target: 'threat' },
  sacrifice: { species: ['blood-demon', 'seraph', 'phoenix'], abilities: ['blood-price', 'infernal-sacrifice', 'martyrdom', 'hymn-of-valor'], target: 'strongest' },
  charm: { species: ['siren', 'giant-moth', 'poltergeist', 'doppelganger', 'pixie'], abilities: ['siren-song', 'mesmerize', 'possession', 'drowning-chorus', 'mirror-images', 'steal-form'], target: 'strongest' },
  undying: { species: ['dwarf', 'valkyrie', 'lamassu', 'sun-lion', 'jackal-warden', 'ettin'], abilities: ['last-stand', 'sacred-vow', 'raise-the-fallen', 'judgement'], target: 'nearest' },
  skies: { species: ['griffin', 'wyvern', 'harpy', 'giant-bat', 'phoenix', 'roc', 'pegasus', 'gargoyle', 'will-o-wisp', 'valkyrie', 'thunderbird'], abilities: ['dive', 'radiant-dive', 'flame-lunge', 'radiant-dive'], target: 'casters' },
};

export const PLAY_STYLE_IDS = Object.keys(PLAY_STYLES) as PlayStyleId[];

export type ManagerId = 'cautious' | 'aggressive' | 'tactician' | 'gambler' | 'steady';

export interface ManagerDef {
  aggression: 'cautious' | 'balanced' | 'aggressive';
  /** Substitute creatures below this stamina / health fraction at a break. */
  tiredBelow: number;
  hurtBelow: number;
  /** Changes its orders at the breaks depending on the score. */
  adaptOrders: boolean;
  /** Reads the opponent (target orders) — at normal difficulty only tacticians do. */
  reads: boolean;
}

export const MANAGERS: Record<ManagerId, ManagerDef> = {
  cautious: { aggression: 'cautious', tiredBelow: 0.35, hurtBelow: 0.35, adaptOrders: true, reads: false },
  aggressive: { aggression: 'aggressive', tiredBelow: 0.15, hurtBelow: 0.15, adaptOrders: false, reads: false },
  tactician: { aggression: 'balanced', tiredBelow: 0.25, hurtBelow: 0.3, adaptOrders: true, reads: true },
  gambler: { aggression: 'balanced', tiredBelow: 0.2, hurtBelow: 0.2, adaptOrders: true, reads: false },
  steady: { aggression: 'balanced', tiredBelow: 0.25, hurtBelow: 0.25, adaptOrders: true, reads: false },
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
  /** AI stables equip their style's skills (otherwise the latest unlocked). */
  styleSkills: boolean;
  /** AI managers rest creatures above this fatigue. */
  restFatigue: number;
  /** Player's starting treasury multiplier. */
  startMoney: number;
  /** Quality tier of the player's starting squad. */
  playerQuality?: 'novice' | 'regional';
  /** Tier of the player's club (money, reputation, coaches, facilities); default novice: a small stable with a decent squad. */
  playerClub?: 'novice' | 'regional';
  /** Multiplier on the board's confidence losses. */
  boardLoss: number;
  /** Weight of the style when AI stables sign or buy (ability points). */
  styleBias: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    divisions: [
      ['elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional'],
      ['professional', 'professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'regional', 'regional', 'regional'],
      ['regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice'],
      ['novice', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice'],
    ],
    playerQuality: 'regional', playerClub: 'regional', styleShare: 0.35, identities: false, reading: 'none', styleSkills: false, restFatigue: 60, startMoney: 1.3, boardLoss: 0.5, styleBias: 6,
  },
  normal: {
    divisions: [
      ['elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'regional'],
      ['professional', 'professional', 'professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'regional', 'regional'],
      ['regional', 'regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'novice', 'novice'],
      ['regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice', 'novice'],
    ],
    playerQuality: 'regional', styleShare: 0.5, identities: true, reading: 'tacticians', styleSkills: true, restFatigue: 55, startMoney: 1, boardLoss: 1, styleBias: 10,
  },
  hard: {
    divisions: [
      ['elite', 'elite', 'elite', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional', 'professional'],
      ['professional', 'professional', 'professional', 'professional', 'professional', 'regional', 'regional', 'regional', 'regional', 'regional'],
      ['regional', 'regional', 'regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'novice'],
      ['regional', 'regional', 'regional', 'regional', 'regional', 'regional', 'novice', 'novice', 'novice', 'novice'],
    ],
    playerQuality: 'regional', styleShare: 0.55, identities: true, reading: 'all', styleSkills: true, restFatigue: 45, startMoney: 0.8, boardLoss: 1.5, styleBias: 12,
  },
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];
