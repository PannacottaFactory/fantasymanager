/**
 * Texts of the post-match report. Several variants per remark so reports don't read the same every week.
 * Placeholders: {name} {species} {round} {n} {pct} {elements} {enemyElements} {mult} {score} {opp}
 */
export const ASSISTANT_REMARKS = {
  exhaustedEarly: [
    '{name} was running on empty from round {round}. A rest order or a substitution at the break would have helped.',
    'Our {species} {name} was spent by round {round} — far too early. Watch the stamina bars.',
    '{name} ran out of breath in round {round} and was a passenger after that.',
  ],
  lowAccuracy: [
    '{name} only landed {pct}% of attacks. Against that opponent, a different target or role might pay off.',
    '{name} kept missing: {pct}% on target. Not good enough.',
  ],
  typeDisadvantage: [
    'Elemental matchups worked against us: our hits did only {mult}× damage on average. Their {enemyElements} creatures resist our style.',
    'We were fighting uphill on elements ({mult}× average). Consider creatures that counter {enemyElements}.',
  ],
  typeAdvantage: [
    'Our elemental matchups paid off: {mult}× damage on average against their {enemyElements} line-up.',
    'Good preparation on elements — we hit them at {mult}× on average.',
  ],
  backlineExposed: [
    'Their attackers got at our back line: {pct}% of the damage we took landed there. A tank set to guard would help.',
    'Our back line was left open — {pct}% of their damage went straight past the front.',
  ],
  disobedient: [
    '{name} ignored your orders {n} times. Discipline is going to be a problem.',
    '{name} went their own way {n} times instead of following the plan.',
  ],
  moraleBreak: [
    '{name} lost their nerve during the fight. A creature with more courage might hold firmer.',
    '{name} cracked under pressure — morale collapsed mid-fight.',
  ],
  fled: [
    '{name} fled the arena! That will be talked about in the taverns.',
    '{name} turned tail and ran. The crowd will not forget that.',
  ],
  unusedSubs: [
    'We finished with {subs} unused while creatures were down or exhausted.',
    'We left {subs} on the bench — fresh legs were available.',
  ],
  mvp: [
    '{name} was outstanding (rating {rating}). Keep that one happy.',
    'Star of the show: {name}, rated {rating}.',
    '{name} carried us today — {rating}/10.',
  ],
  worst: [
    '{name} had a day to forget ({rating}).',
    'A poor showing from {name} ({rating}/10).',
  ],
  closePoints: [
    'It came down to the judges: {score}. Fine margins.',
    'Decided on points, {score}. One more good blow would have changed everything.',
  ],
  healing: [
    'Our healers restored {n} health over the fight — that kept us in it.',
  ],
  outmatched: [
    'They were simply stronger today. No shame in that — but we need better creatures to compete at this level.',
  ],
};

export type RemarkKey = keyof typeof ASSISTANT_REMARKS;

export const KEY_MOMENT_TEXT = {
  firstBlood: ['First fall of the match: {target} goes down to {actor}.'],
  ko: ['{actor} knocks out {target}.', '{target} is down, courtesy of {actor}.'],
  koEffect: ['{target} succumbs to {effect}.'],
  bigHit: ['{actor}’s {ability} hits {target} for {n}.', 'Huge blow: {actor} hits {target} for {n} with {ability}.'],
  flee: ['{actor} flees the arena!'],
  enrage: ['{actor} flies into a rage.'],
  substitution: ['{inName} comes on for {outName}.'],
  swing: ['The momentum swings towards {team}.'],
  finalBlow: ['{actor} ends it.'],
};
