/**
 * Visual motif of each ability in the live match (display only): how its blow travels and lands.
 * Derived from the ability's id / kind / target so a new ability gets a sensible look without any table to fill;
 * the few exceptions are listed by id.
 */
import { ABILITIES } from '../../../data/abilities.ts';

export type Motif =
  // Melee
  | 'bite' | 'claw' | 'blade' | 'blunt' | 'charge' | 'sting' | 'lash' | 'sweep' | 'quake'
  // Ranged
  | 'arrow' | 'rock' | 'spit' | 'volley'
  // Spells
  | 'orb' | 'bolt' | 'beam' | 'breath' | 'storm' | 'wave'
  // Support / control
  | 'heal' | 'song' | 'blessing' | 'shout' | 'curse' | 'gaze' | 'cloud' | 'snare' | 'self';

const BY_ID: Record<string, Motif> = {
  'dirty-trick': 'cloud',
  'crushing-grip': 'lash',
  constrict: 'lash',
  coils: 'lash',
  'death-grip': 'lash',
  'drowning-grip': 'lash',
  engulf: 'lash',
  undertow: 'lash',
  'chill-touch': 'claw',
  'tide-kick': 'blunt',
  'corrosive-peck': 'sting',
  'tail-spikes': 'volley',
  'snow-hurl': 'rock',
  'boulder-throw': 'rock',
  firepot: 'rock',
  sling: 'rock',
  javelin: 'arrow',
  'lightning-bolt': 'bolt',
  'chain-lightning': 'bolt',
  thunderclap: 'bolt',
  'wind-blade': 'beam',
  'gust-cut': 'wave',
  'gale-wings': 'wave',
  'tidal-lash': 'wave',
  'rune-pulse': 'wave',
  'void-maw': 'bite',
  'devour-spell': 'bite',
  'life-drain': 'beam',
  'healing-wind': 'song',
  'pan-pipes': 'song',
  'wild-song': 'song',
  'healing-song': 'song',
  'hymn-of-valor': 'song',
  'blinding-flash': 'shout',
  web: 'snare',
  entangle: 'snare',
  'strangling-vines': 'snare',
  lure: 'gaze',
  riddle: 'gaze',
  'deep-freeze': 'curse',
  'thorn-whip': 'lash',
  'thorn-lash': 'lash',
  blight: 'cloud',
  'pollen-cloud': 'cloud',
  'ink-cloud': 'cloud',
};

const RULES: [RegExp, Motif][] = [
  [/bite|fang|maw|peck|beak/, 'bite'],
  [/claw|talon|rake|rend|maul|swipe|tails/, 'claw'],
  [/blade|stab|axe|scythe|spear|lance-|jab|decapitat|trident|sword|cut/, 'blade'],
  [/charge|gore|dive|pounce|lunge|dash|butt|horn|trample/, 'charge'],
  [/sting|pincer|spike/, 'sting'],
  [/whip|lash|tentacle|vine|grip|coil/, 'lash'],
  [/club|fist|slam|smash|crush|hoof|flail|kick|blow/, 'blunt'],
  [/bow|shot|arrow/, 'arrow'],
  [/spit|spray/, 'spit'],
  [/breath/, 'breath'],
  [/beam|ray|flare|light$/, 'beam'],
  [/storm|blizzard|whirlwind|maelstrom|cloud|avalanche|harvest|feast|sacrifice/, 'storm'],
  [/roar|howl|shriek|screech|wail|cry|cackle|keening/, 'shout'],
  [/curse|hex|blight|dread|evil|spores|pollen/, 'curse'],
  [/gaze|eye/, 'gaze'],
];

const cache = new Map<string, Motif>();

export function abilityMotif(id: string): Motif {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = ABILITIES[id];
  let m: Motif = BY_ID[id] ?? 'orb';
  if (!BY_ID[id] && def) {
    const rule = RULES.find(([re]) => re.test(id))?.[1];
    switch (def.kind) {
      case 'melee':
        m = def.target === 'enemyFront' ? (def.element === 'earth' || def.element === 'fire' ? 'quake' : 'sweep') : rule && ['bite', 'claw', 'blade', 'charge', 'sting', 'lash', 'blunt'].includes(rule) ? rule : 'blunt';
        break;
      case 'ranged':
        m = rule === 'spit' ? 'spit' : rule === 'arrow' ? 'arrow' : 'rock';
        break;
      case 'spell':
        m = rule === 'breath' ? 'breath' : rule === 'beam' ? 'beam' : rule === 'storm' || def.target === 'allEnemies' ? 'storm' : def.target === 'enemyFront' ? 'wave' : 'orb';
        break;
      case 'heal':
        m = rule === 'beam' || def.target === 'allAllies' ? 'blessing' : 'heal';
        break;
      case 'buff':
        m = def.target === 'self' ? 'self' : rule === 'shout' ? 'shout' : 'blessing';
        break;
      case 'debuff':
        m = rule === 'shout' ? 'shout' : rule === 'gaze' ? 'gaze' : rule === 'curse' ? (def.target === 'allEnemies' ? 'cloud' : 'curse') : def.target === 'allEnemies' ? 'shout' : 'curse';
        break;
    }
  }
  cache.set(id, m);
  return m;
}
