import type { TraitDef } from './schema.ts';

const list: TraitDef[] = [
  {
    id: 'ambitious', name: 'Ambitious', polarity: 'mixed',
    description: 'Wants glory and a bigger stage. Works hard, but expects to be rewarded.',
    combat: { attrMods: { determination: 2 } },
    training: { gainMult: 1.1 }, personality: { ambitionMod: 5 },
  },
  {
    id: 'lazy', name: 'Lazy', polarity: 'negative', excludes: ['professional'],
    description: 'Does the minimum. Tires of effort quickly.',
    combat: { attrMods: { stamina: -2, determination: -2 } },
    training: { gainMult: 0.75 },
  },
  {
    id: 'professional', name: 'Professional', polarity: 'positive', excludes: ['lazy', 'hothead'],
    description: 'Prepares carefully and follows the plan.',
    combat: { attrMods: { discipline: 2, composure: 1 }, disobeyMult: 0.5 },
    training: { gainMult: 1.15, injuryMult: 0.85 },
  },
  {
    id: 'loyal', name: 'Loyal', polarity: 'positive',
    description: 'Devoted to the stable. Rarely asks to leave.',
    combat: { attrMods: { teamwork: 1 }, moraleLossMult: 0.9 },
    personality: { loyaltyMod: 6 },
  },
  {
    id: 'hothead', name: 'Hothead', polarity: 'negative', excludes: ['cool-headed', 'professional'],
    description: 'Short-tempered. Loses the plot when provoked.',
    combat: { attrMods: { aggression: 3, composure: -3 }, disobeyMult: 1.8, enrageBelowHp: 0.4, instinctTarget: 'threat' },
    personality: { moraleVolatility: 1.4 },
  },
  {
    id: 'cool-headed', name: 'Cool-headed', polarity: 'positive', excludes: ['hothead'],
    description: 'Ice in the veins when it matters.',
    combat: { attrMods: { composure: 3 }, critBonus: 0.02, moraleLossMult: 0.85 },
  },
  {
    id: 'pack-leader', name: 'Pack Leader', polarity: 'positive',
    description: 'Others follow its lead. Steadies the whole team on the field.',
    combat: { attrMods: { leadership: 3 }, auraMorale: 2 },
  },
  {
    id: 'coward', name: 'Coward', polarity: 'negative', excludes: ['fearless', 'berserker'],
    description: 'Fragile nerve. May freeze or flee when things go badly.',
    combat: { attrMods: { courage: -4 }, moraleLossMult: 1.5, breakThresholdMod: 12, instinctTarget: 'weakest' },
  },
  {
    id: 'fearless', name: 'Fearless', polarity: 'positive', excludes: ['coward'],
    description: 'Nothing scares it. Absolutely nothing.',
    combat: { attrMods: { courage: 3 }, moraleLossMult: 0.5, breakThresholdMod: -10 },
  },
  {
    id: 'berserker', name: 'Berserker', polarity: 'mixed', excludes: ['coward'],
    description: 'Goes berserk when wounded: huge damage, no restraint.',
    combat: { enrageBelowHp: 0.5, damageMult: 1.05, disobeyMult: 1.3, instinctTarget: 'nearest' },
  },
  {
    id: 'vengeful', name: 'Vengeful', polarity: 'mixed',
    description: 'Seeing an ally fall sends it into a fury.',
    combat: { enrageOnAllyKo: true, moraleLossMult: 0.8 },
  },
  {
    id: 'glory-hunter', name: 'Glory Hunter', polarity: 'mixed',
    description: 'Wants the spectacular finish, even if it means ignoring the plan.',
    combat: { disobeyMult: 1.5, critBonus: 0.03, instinctTarget: 'weakest' },
  },
  {
    id: 'showboat', name: 'Showboat', polarity: 'negative',
    description: 'Plays to the crowd. Sometimes forgets there is a fight going on.',
    combat: { showboatChance: 0.06, moraleGainMult: 1.3 },
  },
  {
    id: 'team-player', name: 'Team Player', polarity: 'positive', excludes: ['loner'],
    description: 'Thrives in coordinated attacks.',
    combat: { attrMods: { teamwork: 3 }, comboBonus: 0.06, interceptBonus: 0.05 },
  },
  {
    id: 'loner', name: 'Loner', polarity: 'mixed', excludes: ['team-player', 'pack-leader'],
    description: 'Fights best on its own terms, poorly in concert.',
    combat: { attrMods: { teamwork: -3 }, soloDamageMult: 1.12, disobeyMult: 1.2 },
  },
  {
    id: 'iron-hide', name: 'Iron Hide', polarity: 'positive', excludes: ['brittle'],
    description: 'Unusually hard to hurt and rarely injured.',
    combat: { attrMods: { toughness: 2 } },
    training: { injuryMult: 0.6 },
  },
  {
    id: 'brittle', name: 'Brittle', polarity: 'negative', excludes: ['iron-hide'],
    description: 'Picks up injuries far too easily.',
    training: { injuryMult: 1.7 },
  },
  {
    id: 'cunning', name: 'Cunning', polarity: 'positive',
    description: 'Spots weaknesses and exploits them.',
    combat: { attrMods: { tactics: 3, anticipation: 1 }, instinctTarget: 'weakest' },
  },
  {
    id: 'stubborn', name: 'Stubborn', polarity: 'mixed',
    description: 'Never gives up — and never listens either.',
    combat: { attrMods: { determination: 3 }, disobeyMult: 1.5, moraleLossMult: 0.8 },
  },
  {
    id: 'bloodthirsty', name: 'Bloodthirsty', polarity: 'mixed',
    description: 'Goes for the kill whenever it smells blood.',
    combat: { attrMods: { aggression: 2 }, instinctTarget: 'weakest', critBonus: 0.02 },
  },
  {
    id: 'guardian', name: 'Guardian', polarity: 'positive',
    description: 'Instinctively throws itself in front of threatened allies.',
    combat: { interceptBonus: 0.15, attrMods: { teamwork: 1 } },
  },
  {
    id: 'big-game', name: 'Big Game Creature', polarity: 'positive',
    description: 'Rises to the occasion when the team is in trouble.',
    combat: { attrMods: { determination: 3, composure: 1 } },
  },
  {
    id: 'frail-nerves', name: 'Frail Nerves', polarity: 'negative', excludes: ['cool-headed', 'fearless'],
    description: 'Crumbles under pressure.',
    combat: { attrMods: { composure: -3 }, moraleLossMult: 1.25 },
  },
  // ——— Light flavour traits (small effects) ———
  {
    id: 'lucky', name: 'Lucky', polarity: 'positive', excludes: ['clumsy'],
    description: 'Things just tend to go its way.',
    combat: { critBonus: 0.03 },
  },
  {
    id: 'clumsy', name: 'Clumsy', polarity: 'negative', excludes: ['lucky'],
    description: 'All paws. Fumbles the odd blow.',
    combat: { attrMods: { technique: -1, agility: -1 } },
  },
  {
    id: 'quick-learner', name: 'Quick Learner', polarity: 'positive', excludes: ['lazy'],
    description: 'Picks things up fast in training.',
    training: { gainMult: 1.12 },
  },
  {
    id: 'stoic', name: 'Stoic', polarity: 'mixed', excludes: ['showboat', 'frail-nerves'],
    description: 'Neither elated nor crushed: morale moves less, both ways.',
    combat: { moraleLossMult: 0.85, moraleGainMult: 0.8 },
  },
  {
    id: 'reckless', name: 'Reckless', polarity: 'mixed', excludes: ['cool-headed'],
    description: 'Throws itself in without a second thought.',
    combat: { attrMods: { aggression: 2, defense: -1 } },
  },
  {
    id: 'cheerful', name: 'Cheerful', polarity: 'positive',
    description: 'Always in a good mood — and it rubs off on the others.',
    combat: { auraMorale: 0.5 },
  },
  {
    id: 'patient', name: 'Patient', polarity: 'positive', excludes: ['hothead'],
    description: 'Waits for the right moment and sticks to the plan.',
    combat: { attrMods: { composure: 1 }, disobeyMult: 0.8 },
  },
];

export const TRAITS: Record<string, TraitDef> = Object.fromEntries(list.map((t) => [t.id, t]));
