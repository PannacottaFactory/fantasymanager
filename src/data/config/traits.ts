/**
 * Traits that change after matches, at random: after each match a stable may see one of the creatures that played
 * gain or lose a trait. Nothing in the match decides which; the message wears a generic sentence.
 */

/** Kind of change, for the message's sentence: a quality or a flaw (or a double-edged trait) gained or lost. */
export type TraitChangeKind = 'gainedGood' | 'gainedBad' | 'gainedMixed' | 'lostGood' | 'lostBad' | 'lostMixed';

export const TRAIT_EVOLUTION_CONFIG = {
  /** Chance, after each match, that one creature of the stable (among those that played) gains or loses a trait. */
  chance: 0.25,
  /** Share of changes that are a gain (a creature without traits always gains, one that can take none loses). */
  gainShare: 0.6,
  /** Most traits a creature can hold: a creature already full that gains one loses another, at random. */
  maxTraits: 3,
  /** Traits keep a « new » tag this many weeks (UI). */
  newWeeks: 6,
  /** Generic sentences per kind of change (`msg.trait.line.<kind>.<n>`). */
  lines: 3,
};
