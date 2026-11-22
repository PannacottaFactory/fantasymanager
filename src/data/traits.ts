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
    description: 'Never gives up, and never listens either.',
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
    description: 'Always in a good mood, and it rubs off on the others.',
    combat: { auraMorale: 0.5 },
  },
  {
    id: 'patient', name: 'Patient', polarity: 'positive', excludes: ['hothead'],
    description: 'Waits for the right moment and sticks to the plan.',
    combat: { attrMods: { composure: 1 }, disobeyMult: 0.8 },
  },
  // ——— Drawn at birth, and also earned or caught in matches ———
  {
    id: 'complacent', name: 'Complacent', polarity: 'negative', excludes: ['ambitious', 'iron-will'],
    description: 'Too many easy wins. No longer sees why it should push itself.',
    combat: { attrMods: { determination: -2 } },
    training: { gainMult: 0.9 },
  },
  {
    id: 'tireless', name: 'Tireless', polarity: 'positive', excludes: ['lazy', 'sluggish'],
    description: 'Gets its breath back faster than anyone.',
    combat: { attrMods: { stamina: 1 }, staminaRegenMult: 1.12 },
  },
  {
    id: 'elusive', name: 'Elusive', polarity: 'positive', excludes: ['sluggish'],
    description: 'Never quite where the blow lands.',
    combat: { attrMods: { agility: 1 }, dodgeBonus: 0.03 },
  },
  {
    id: 'sharp-eyed', name: 'Sharp-Eyed', polarity: 'positive', excludes: ['clumsy', 'jinxed'],
    description: 'Sees the opening and does not miss it.',
    combat: { attrMods: { accuracy: 1 }, hitBonus: 0.03 },
  },
  {
    id: 'thick-skinned', name: 'Thick-Skinned', polarity: 'mixed', excludes: ['glass-jaw'],
    description: 'Takes the blows without blinking, but its hide weighs it down.',
    combat: { attrMods: { speed: -1 }, mitigationBonus: 0.04 },
  },
  {
    id: 'finisher', name: 'Finisher', polarity: 'positive',
    description: 'Smells weakness and finishes the job.',
    combat: { woundedTargetMult: 1.12, instinctTarget: 'weakest' },
  },
  {
    id: 'second-wind', name: 'Second Wind', polarity: 'positive', excludes: ['lazy'],
    description: 'When it seems spent, it finds something more.',
    combat: { attrMods: { recovery: 2, determination: 1 } },
  },
  {
    id: 'economical', name: 'Economical', polarity: 'positive', excludes: ['reckless'],
    description: 'Never wastes a movement.',
    combat: { staminaCostMult: 0.9 },
  },
  {
    id: 'gentle-hands', name: 'Gentle Hands', polarity: 'positive',
    description: 'Knows how to tend a wound, even in the middle of a fight.',
    combat: { healMult: 1.1 },
  },
  {
    id: 'heavy-handed', name: 'Heavy-Handed', polarity: 'mixed', excludes: ['sharp-eyed'],
    description: 'Hits like a falling wall, when it hits.',
    combat: { damageMult: 1.05, hitBonus: -0.03 },
  },
  {
    id: 'glass-jaw', name: 'Glass Jaw', polarity: 'negative', excludes: ['iron-hide', 'thick-skinned', 'battle-scarred'],
    description: 'Goes down far too easily.',
    combat: { attrMods: { toughness: -2 } },
    training: { injuryMult: 1.2 },
  },
  {
    id: 'sluggish', name: 'Sluggish', polarity: 'negative', excludes: ['elusive', 'tireless'],
    description: 'Heavy on its feet, and tires itself out moving.',
    combat: { attrMods: { speed: -2 }, staminaCostMult: 1.06 },
  },
  {
    id: 'inspired', name: 'Inspired', polarity: 'positive', excludes: ['stoic', 'jinxed'],
    description: 'Riding high. Every success lifts it further.',
    combat: { attrMods: { composure: 1 }, moraleGainMult: 1.3 },
  },
  {
    id: 'timid', name: 'Timid', polarity: 'negative', excludes: ['reckless', 'bloodthirsty', 'berserker', 'fearless', 'iron-will'],
    description: 'Holds back from the fray and flinches at the first scare.',
    combat: { attrMods: { aggression: -2, courage: -1 }, breakThresholdMod: 4 },
  },
  {
    id: 'wary', name: 'Wary', polarity: 'positive', excludes: ['reckless'],
    description: 'Always expects the next blow.',
    combat: { attrMods: { anticipation: 2 }, dodgeBonus: 0.01 },
  },
  {
    id: 'focused', name: 'Focused', polarity: 'positive', excludes: ['showboat'],
    description: 'Nothing distracts it once the fight has begun.',
    combat: { attrMods: { focus: 2 }, critBonus: 0.01 },
  },
  {
    id: 'jinxed', name: 'Jinxed', polarity: 'negative', excludes: ['lucky', 'sharp-eyed', 'inspired'],
    description: 'Nothing goes its way, and it knows it.',
    combat: { critBonus: -0.02, hitBonus: -0.01 },
  },
  {
    id: 'iron-will', name: 'Iron Will', polarity: 'positive', excludes: ['frail-nerves', 'timid', 'complacent', 'coward'],
    description: 'Does not bend, whatever the score.',
    combat: { attrMods: { determination: 2 }, breakThresholdMod: -4 },
  },
  {
    id: 'brawler', name: 'Brawler', polarity: 'mixed', excludes: ['timid'],
    description: 'Loves a scrap more than a plan.',
    combat: { attrMods: { strength: 1, aggression: 1, discipline: -1 } },
  },
  {
    id: 'quick-footed', name: 'Quick-Footed', polarity: 'positive', excludes: ['sluggish'],
    description: 'First to move, first to strike.',
    combat: { attrMods: { speed: 2 } },
  },
  {
    id: 'hard-hitter', name: 'Hard Hitter', polarity: 'mixed',
    description: 'All the weight goes into the blow, none into the footwork.',
    combat: { attrMods: { strength: 2, agility: -1 } },
  },
  {
    id: 'acrobat', name: 'Acrobat', polarity: 'positive', excludes: ['sluggish', 'clumsy'],
    description: 'Leaps, rolls and twists out of trouble.',
    combat: { attrMods: { agility: 2 }, dodgeBonus: 0.01 },
  },
  {
    id: 'bulwark', name: 'Bulwark', polarity: 'positive', excludes: ['reckless', 'selfish'],
    description: 'A wall the others can shelter behind.',
    combat: { attrMods: { defense: 2 }, interceptBonus: 0.04 },
  },
  {
    id: 'arcane-gift', name: 'Arcane Gift', polarity: 'positive',
    description: 'Magic comes to it as easily as breathing.',
    combat: { attrMods: { magic: 2 } },
  },
  {
    id: 'scatterbrained', name: 'Scatterbrained', polarity: 'negative', excludes: ['focused', 'cunning', 'tactician'],
    description: 'Its mind wanders off in the middle of the fight.',
    combat: { attrMods: { focus: -2, tactics: -1 } },
  },
  {
    id: 'mean-streak', name: 'Mean Streak', polarity: 'mixed', excludes: ['gentle-soul', 'patient'],
    description: 'Fights dirty and enjoys it, orders or not.',
    combat: { attrMods: { aggression: 2 }, critBonus: 0.01, disobeyMult: 1.15 },
  },
  {
    id: 'gentle-soul', name: 'Gentle Soul', polarity: 'mixed', excludes: ['bloodthirsty', 'mean-streak', 'brawler', 'merciless'],
    description: 'Fights because it must. Everyone likes having it around.',
    combat: { attrMods: { aggression: -2, teamwork: 1 }, auraMorale: 0.5 },
  },
  {
    id: 'slow-witted', name: 'Slow-Witted', polarity: 'negative', excludes: ['cunning', 'wary', 'tactician'],
    description: 'Always one move behind the fight.',
    combat: { attrMods: { tactics: -2, anticipation: -1 } },
  },
  {
    id: 'tactician', name: 'Tactician', polarity: 'positive', excludes: ['slow-witted', 'scatterbrained'],
    description: 'Reads the fight like an open book.',
    combat: { attrMods: { tactics: 2, anticipation: 1 } },
  },
  {
    id: 'crowd-pleaser', name: 'Crowd Pleaser', polarity: 'mixed', excludes: ['stoic'],
    description: 'Feeds on the roar of the stands, and sometimes plays to them.',
    combat: { moraleGainMult: 1.2, showboatChance: 0.02 },
  },
  {
    id: 'sore-loser', name: 'Sore Loser', polarity: 'negative', excludes: ['stoic', 'cool-headed'],
    description: 'Takes every setback badly, and lets everyone know.',
    combat: { moraleLossMult: 1.2, disobeyMult: 1.2 },
  },
  {
    id: 'rousing', name: 'Rousing', polarity: 'positive',
    description: 'Its battle cry lifts the whole team.',
    combat: { attrMods: { leadership: 2 }, auraMorale: 1 },
  },
  {
    id: 'selfish', name: 'Selfish', polarity: 'mixed', excludes: ['team-player', 'guardian', 'bulwark'],
    description: 'Fights for itself first.',
    combat: { attrMods: { teamwork: -2 }, soloDamageMult: 1.06 },
  },
  {
    id: 'tough-as-nails', name: 'Tough as Nails', polarity: 'positive', excludes: ['glass-jaw', 'brittle', 'thin-skinned'],
    description: 'Hurts it? It barely notices.',
    combat: { attrMods: { toughness: 2, courage: 1 } },
  },
  {
    id: 'skittish', name: 'Skittish', polarity: 'mixed', excludes: ['fearless', 'cool-headed', 'iron-will'],
    description: 'Jumps at every shadow: hard to pin down, quick to break.',
    combat: { attrMods: { composure: -2 }, dodgeBonus: 0.02, breakThresholdMod: 3 },
  },
  {
    id: 'deadeye', name: 'Deadeye', polarity: 'positive', excludes: ['clumsy', 'jinxed'],
    description: 'Puts its shots exactly where it wants them.',
    combat: { attrMods: { accuracy: 2 }, critBonus: 0.01 },
  },
  {
    id: 'short-winded', name: 'Short-Winded', polarity: 'negative', excludes: ['tireless', 'second-wind'],
    description: 'Runs out of breath long before the others.',
    combat: { attrMods: { stamina: -2 }, staminaRegenMult: 0.9 },
  },
  {
    id: 'merciless', name: 'Merciless', polarity: 'positive', excludes: ['gentle-soul'],
    description: 'Never lets a wounded foe get back up.',
    combat: { woundedTargetMult: 1.08, critBonus: 0.01, instinctTarget: 'weakest' },
  },
  {
    id: 'thin-skinned', name: 'Thin-Skinned', polarity: 'negative', excludes: ['thick-skinned', 'iron-hide', 'tough-as-nails'],
    description: 'Every blow hurts, in the body and in the mind.',
    combat: { mitigationBonus: -0.03, moraleLossMult: 1.1 },
  },
  {
    id: 'rebel', name: 'Rebel', polarity: 'mixed', excludes: ['professional', 'patient'],
    description: 'Does it its own way, and does not give up.',
    combat: { attrMods: { determination: 2 }, disobeyMult: 1.6 },
  },
  // ——— Earned or caught only in matches (never at birth) ———
  {
    id: 'battle-scarred', name: 'Battle-Scarred', polarity: 'positive', acquired: true, excludes: ['traumatised', 'glass-jaw'],
    description: 'Has been to the brink and back. Little shakes it any more.',
    combat: { attrMods: { toughness: 1, composure: 1 }, mitigationBonus: 0.02 },
  },
  {
    id: 'traumatised', name: 'Traumatised', polarity: 'negative', acquired: true, excludes: ['battle-scarred', 'fearless', 'iron-will'],
    description: 'A bad fight has left its mark. It can heal, with time and a few good matches.',
    combat: { attrMods: { courage: -3 }, moraleLossMult: 1.2, breakThresholdMod: 6 },
  },
];

export const TRAITS: Record<string, TraitDef> = Object.fromEntries(list.map((t) => [t.id, t]));
