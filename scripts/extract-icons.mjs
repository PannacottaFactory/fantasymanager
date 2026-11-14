/* global URL, console */
/**
 * Extracts the few game-icons.net icons the game uses into src/ui/icons/gameIcons.ts, so the bundle does not
 * ship the whole 4,000-icon set. Run after changing the lists below:  node scripts/extract-icons.mjs
 *
 * Icons: game-icons.net (Lorc, Delapouite and contributors), CC BY 3.0 — credited in the Help page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const set = JSON.parse(readFileSync(require.resolve('@iconify-json/game-icons/icons.json'), 'utf8'));

/** Species id → icon name. */
const SPECIES = {
  goblin: 'goblin-head',
  orc: 'orc-head',
  troll: 'troll',
  elf: 'woman-elf-face',
  golem: 'rock-golem',
  wyvern: 'wyvern',
  dragon: 'spiked-dragon-head',
  minotaur: 'minotaur',
  harpy: 'harpy',
  shade: 'spectre',
  treant: 'tree-face',
  naga: 'sea-serpent',
  griffin: 'griffin-symbol',
  lich: 'crowned-skull',
  kraken: 'kraken-tentacle',
  phoenix: 'egyptian-bird',
  dryad: 'fairy',
  basilisk: 'medusa-head',
  djinn: 'djinn',
  centaur: 'centaur',
  wendigo: 'animal-skull',
  'crystal-golem': 'ice-golem',
  salamander: 'salamander',
  'giant-spider': 'spider-face',
  'giant-scorpion': 'scorpion',
  myconid: 'mushroom-gills',
  'winter-wolf': 'wolf-howl',
  'frost-giant': 'giant',
  'frost-wraith': 'floating-ghost',
  hag: 'witch-face',
  unicorn: 'unicorn',
  hellhound: 'hound',
  imp: 'imp',
  werewolf: 'werewolf',
  'bramble-horror': 'thorny-vine',
  vampire: 'vampire-dracula',
  'giant-bat': 'bat',
  'giant-mantis': 'praying-mantis',
  ooze: 'slime',
  'magma-golem': 'golem-head',
  banshee: 'haunting',
  nightmare: 'horse-head',
  'giant-hyena': 'hyena-head',
  raptor: 'velociraptor',
  cyclops: 'cyclops',
  'storm-elemental': 'lightning-storm',
  ogre: 'ogre',
  'blood-demon': 'daemon-skull',
  seraph: 'angel-wings',
  hydra: 'hydra',
  gargoyle: 'gargoyle',
  manticore: 'lion',
  chimera: 'fire-breath',
  yeti: 'gorilla',
  roc: 'eagle-head',
  skeleton: 'skeleton',
  ghoul: 'shambling-zombie',
  mummy: 'mummy-head',
  'death-knight': 'black-knight-helm',
  pegasus: 'pegasus',
  sphinx: 'egyptian-sphinx',
  'will-o-wisp': 'ball-glow',
  'light-elemental': 'spark-spirit',
  kobold: 'imp-laugh',
  gnoll: 'wolf-head',
  lizardfolk: 'lizardman',
  satyr: 'goat',
  'runic-golem': 'metal-golem-head',
  'spell-eater': 'lamprey-mouth',
  oni: 'oni',
  kitsune: 'fox',
  lamia: 'cobra',
  tengu: 'raven',
  qilin: 'deer',
  kelpie: 'seahorse',
  werebear: 'bear-head',
  cockatrice: 'rooster',
};

/** Interface icons. */
const UI = {
  board: 'scroll-unfurled',
  competitions: 'trophy',
  honours: 'laurels',
  'diff-easy': 'sprout',
  'diff-normal': 'crossed-swords',
  'diff-hard': 'death-skull',
  'new-game': 'scroll-quill',
  'news-upset': 'thunder-struck',
  'kind-melee': 'broadsword',
  'nav-dashboard': 'house',
  'nav-inbox': 'scroll-unfurled',
  'nav-stable': 'paw',
  'nav-squad': 'wolf-head',
  'nav-tactics': 'chess-knight',
  'nav-training': 'weight-lifting-up',
  'nav-competitions': 'trophy',
  'nav-league': 'podium',
  'nav-news': 'newspaper',
  'nav-recruit': 'magnifying-glass',
  'nav-club': 'castle',
  'nav-finances': 'two-coins',
  'nav-staff': 'whistle',
  'nav-facilities': 'hammer-nails',
  'nav-tools': 'toolbox',
  'nav-encyclopedia': 'open-book',
  'nav-arena': 'arena',
  'kind-ranged': 'pocket-bow',
  'kind-spell': 'magic-swirl',
  'kind-heal': 'health-normal',
  'kind-buff': 'aura',
  'kind-debuff': 'cursed-star',
  'dom-physical': 'biceps',
  'dom-combat': 'crossed-swords',
  'dom-mental': 'brain',
  'news-quickKo': 'punch-blast',
  'news-streak': 'flame',
  'news-leader': 'crown',
  'news-bigTransfer': 'two-coins',
  'news-starInjury': 'bandage-roll',
  'news-cupWinner': 'trophy-cup',
  'news-champion': 'laurel-crown',
  'news-promotion': 'upgrade',
  'news-relegation': 'team-downgrade',
  'news-retirement': 'sunset',
  'news-death': 'candle-skull',
  'medal-matches': 'visored-helm',
  'medal-wins': 'laurels',
  'medal-kos': 'scythe',
  'medal-mvp': 'star-medal',
  'medal-damage': 'sword-clash',
  'medal-healing': 'heart-plus',
  'medal-trophies': 'trophy-cup',
  'medal-downs': 'cracked-shield',
  bestiary: 'spell-book',
  'bestiary-seen': 'eyeball',
  'bestiary-owned': 'paw-print',
  locked: 'padlock',
  settings: 'cog',
  'help-goal': 'archery-target',
  'help-week': 'calendar',
  'help-combat': 'crossed-swords',
  'help-roles': 'checked-shield',
  'help-squad': 'spiked-dragon-head',
  'help-economy': 'two-coins',
  'help-recruit': 'magnifying-glass',
  'help-training': 'weight-lifting-up',
  'help-competitions': 'trophy',
  'help-club': 'castle',
  help: 'help',
  flying: 'feathered-wing',
  injury: 'bandage-roll',
  tip: 'light-bulb',
  memorial: 'candle-skull',
  compass: 'compass',
  dice: 'perspective-dice-six-faces-random',
  'fac-training': 'arena',
  'fac-infirmary': 'health-normal',
  'fac-stands': 'ticket',
  fans: 'party-flags',
  scout: 'spyglass',
  stamina: 'power-lightning',
  power: 'sword-wound',
  'sound-on': 'speaker',
  'sound-off': 'speaker-off',
  'view-cards': 'card-pickup',
  'view-table': 'table',
  versus: 'crossed-swords',
  flag: 'checkered-flag',
  simulate: 'fast-forward-button',
  'arena-rain': 'heavy-rain',
  'arena-heat': 'thermometer-hot',
  'arena-fog': 'fog',
  'arena-night': 'night-sky',
  'arena-sun': 'sun',
  'arena-storm': 'lightning-storm',
  'arena-clear': 'sun-cloud',
  'arena-sacred': 'holy-symbol',
  'arena-cursed': 'graveyard',
  'arena-swamp': 'swamp',
  'arena-ice': 'frozen-block',
  'arena-frenzy': 'sparkles',
  'arena-thinAir': 'mountains',
  'arena-mana': 'crystal-ball',
  'arena-pit': 'stone-wall',
  'arena-eclipse': 'eclipse',
  'arena-sandstorm': 'sandstorm',
  'arena-eruption': 'volcano',
};

/** Competition definition → icon name. */
const COMPETITIONS = {
  shadow: 'trophy-cup',
  division: 'laurels-trophy',
  champions: 'diamond-trophy',
  preseason: 'knight-banner',
  marches: 'lantern-flame',
  argent: 'medal',
  or: 'laurel-crown',
};

/** Division (0 = top) → icon name. */
const DIVISIONS = ['crown', 'fleur-de-lys', 'castle', 'watchtower'];

/** Crest emblems (ids = icon names; keep in sync with src/data/crest.ts). */
const CREST = [
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
];

/** Role id → icon name. */
const ROLES = {
  tank: 'shield',
  striker: 'crossed-swords',
  support: 'health-normal',
  caster: 'magic-swirl',
  skirmisher: 'sprint',
};

const body = (name) => {
  const icon = set.icons[name];
  if (!icon) throw new Error(`Unknown icon ${name}`);
  return icon.body;
};
const block = (map) =>
  Object.entries(map)
    .map(([id, name]) => `  ${JSON.stringify(id)}: ${JSON.stringify(body(name))},`)
    .join('\n');

const out = `/* Generated by scripts/extract-icons.mjs — do not edit by hand. */
/* Icons: game-icons.net (Lorc, Delapouite and contributors), CC BY 3.0. viewBox 0 0 ${set.width ?? 512} ${set.height ?? 512}. */

export const ICON_VIEWBOX = '0 0 ${set.width ?? 512} ${set.height ?? 512}';

/** SVG bodies of the species icons (fill = currentColor). */
export const SPECIES_ICONS: Record<string, string> = {
${block(SPECIES)}
};

/** SVG bodies of the role icons (fill = currentColor). */
export const ROLE_ICONS: Record<string, string> = {
${block(ROLES)}
};

/** SVG bodies of interface icons (fill = currentColor). */
export const UI_ICONS: Record<string, string> = {
${block(UI)}
};

/** SVG bodies of the competition emblems (fill = currentColor). */
export const COMP_ICONS: Record<string, string> = {
${block(COMPETITIONS)}
};

/** SVG bodies of the crest emblems (fill = currentColor). */
export const CREST_ICONS: Record<string, string> = {
${block(Object.fromEntries(CREST.map((n) => [n, n])))}
};

/** SVG bodies of the division emblems, from the top division down (fill = currentColor). */
export const DIV_ICONS: string[] = [
${DIVISIONS.map((n) => `  ${JSON.stringify(body(n))},`).join('\n')}
];
`;
writeFileSync(new URL('../src/ui/icons/gameIcons.ts', import.meta.url), out);
console.log(`Wrote ${Object.keys(SPECIES).length} species and ${Object.keys(ROLES).length} role icons.`);
