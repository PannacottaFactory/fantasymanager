import type { ScarDef } from './schema.ts';

/**
 * Scars: what a healed injury may leave for good (`config/scars.ts` for the chances). Each one costs a little and
 * gives a little back; mostly they tell what the creature went through.
 */
const list: ScarDef[] = [
  {
    id: 'weak-joint', name: 'Weak Joint', from: ['sprained-limb', 'broken-limb'],
    description: 'The joint never quite healed. It moves with care now, and reads the fight a step ahead.',
    attrMods: { agility: -2, anticipation: 1 },
  },
  {
    id: 'stiff-ribs', name: 'Badly Knit Ribs', from: ['cracked-ribs'],
    description: 'Its ribs knit crooked: it runs out of breath sooner, but its chest is a shield.',
    attrMods: { stamina: -2, toughness: 1 },
  },
  {
    id: 'ragged-wing', name: 'Ragged Wing', from: ['torn-wing'],
    description: 'The membrane was stitched back as well as could be. It flies slower, and fights all the harder.',
    attrMods: { speed: -2, determination: 1 },
  },
  {
    id: 'burn-scars', name: 'Burnt Hide', from: ['burns'],
    description: 'Its skin pulls where the fire went through. Flames no longer frighten it.',
    attrMods: { agility: -2, courage: 1 },
  },
  {
    id: 'lost-eye', name: 'Lost Eye', from: ['burns', 'shattered-horn'],
    description: 'One eye is gone. It aims less well, and nothing seems to unsettle it any more.',
    attrMods: { accuracy: -2, composure: 1 },
  },
  {
    id: 'cracked-soul', name: 'Cracked Soul', from: ['soul-wound'],
    description: 'Something in it stayed broken. Its nerves are frayed, but magic flows more freely through the crack.',
    attrMods: { composure: -2, magic: 1 },
  },
  {
    id: 'blackouts', name: 'Blackouts', from: ['concussion'],
    description: 'It sometimes loses the thread of the fight, and no longer sees danger coming.',
    attrMods: { anticipation: -2, courage: 1 },
  },
  {
    id: 'crooked-limb', name: 'Crooked Limb', from: ['broken-limb'],
    description: 'The bone set crooked and thicker than before: slower, but harder to break.',
    attrMods: { speed: -2, toughness: 1 },
  },
  {
    id: 'broken-horn', name: 'Broken Horn', from: ['shattered-horn'],
    description: 'Its weapon is a stump now. It strikes less hard, and with more spite.',
    attrMods: { attack: -2, aggression: 1 },
  },
  {
    id: 'facial-scar', name: 'Scarred Face', from: ['shattered-horn', 'crippling-wound'],
    description: 'A scar across the face that nobody forgets. Its stablemates keep their distance, and follow it.',
    attrMods: { teamwork: -1, leadership: 1 },
  },
  {
    id: 'maimed', name: 'Maimed', from: ['crippling-wound'],
    description: 'It came back from the worst. Its body is diminished; its will is not.',
    attrMods: { strength: -2, speed: -2, determination: 2 },
  },
];

export const SCARS: Record<string, ScarDef> = Object.fromEntries(list.map((s) => [s.id, s]));
