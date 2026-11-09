/** French post-match report texts. Same keys as report.ts. */
import type { ASSISTANT_REMARKS, HEADLINES, KEY_MOMENT_TEXT, REPORT_WORDS } from './report.ts';

export const ASSISTANT_REMARKS_FR: Record<keyof typeof ASSISTANT_REMARKS, string[]> = {
  exhaustedEarly: [
    '{name} tournait à vide dès le round {round}. Une consigne de repos ou un changement à la pause aurait aidé.',
    'Notre {species} {name} était à bout dès le round {round} — bien trop tôt. Surveillez les barres d’endurance.',
    '{name} a manqué de souffle au round {round} et n’a plus servi à grand-chose ensuite.',
  ],
  lowAccuracy: [
    '{name} n’a placé que {pct} % de ses attaques. Contre cet adversaire, une autre cible ou un autre rôle pourrait payer.',
    '{name} a raté encore et encore : {pct} % de réussite. Pas assez.',
  ],
  typeDisadvantage: [
    'Les affinités élémentaires ont joué contre nous : nos coups n’ont fait que ×{mult} de dégâts en moyenne. Leurs créatures {enemyElements} résistent à notre style.',
    'On s’est battus à contre-courant sur les éléments (×{mult} en moyenne). Pensez à des créatures qui contrent {enemyElements}.',
  ],
  typeAdvantage: [
    'Nos affinités élémentaires ont payé : ×{mult} de dégâts en moyenne contre leur composition {enemyElements}.',
    'Bonne préparation sur les éléments — on les a frappés à ×{mult} en moyenne.',
  ],
  backlineExposed: [
    'Leurs attaquants ont atteint notre deuxième ligne : {pct} % des dégâts subis y ont été encaissés. Un tank en garde aiderait.',
    'Notre deuxième ligne était à découvert — {pct} % de leurs dégâts sont passés par-dessus la première ligne.',
  ],
  disobedient: [
    '{name} a ignoré vos consignes {n} fois. La discipline va devenir un problème.',
    '{name} n’en a fait qu’à sa tête {n} fois au lieu de suivre le plan.',
  ],
  moraleBreak: [
    '{name} a perdu ses nerfs pendant le combat. Une créature plus courageuse tiendrait mieux.',
    '{name} a craqué sous la pression — le moral s’est effondré en plein combat.',
  ],
  fled: [
    '{name} a pris la fuite ! On va en parler dans les tavernes.',
    '{name} a tourné les talons. La foule ne l’oubliera pas.',
  ],
  unusedSubs: [
    'On a terminé avec {subs} non utilisés alors que des créatures étaient à terre ou épuisées.',
    'On a laissé {subs} sur le banc — il y avait des jambes fraîches disponibles.',
  ],
  mvp: [
    '{name} a livré une prestation exceptionnelle (note {rating}). À choyer.',
    'Vedette du jour : {name}, avec une note de {rating}.',
    '{name} nous a portés aujourd’hui — {rating}/10.',
  ],
  worst: [
    '{name} a vécu une journée à oublier ({rating}).',
    '{name} a déçu ({rating}/10).',
  ],
  closePoints: [
    'Tout s’est joué sur la décision des juges : {score}. Des marges infimes.',
    'Décision aux points, {score}. Un bon coup de plus aurait tout changé.',
  ],
  healing: ['Nos soigneurs ont rendu {n} PV pendant le combat — ça nous a maintenus dans le match.'],
  outmatched: ['Ils étaient simplement plus forts aujourd’hui. Pas de honte — mais il nous faudra de meilleures créatures pour rivaliser à ce niveau.'],
};

export const KEY_MOMENT_TEXT_FR: typeof KEY_MOMENT_TEXT = {
  firstBlood: ['Première chute du match : {target} tombe face à {actor}.'],
  ko: ['{actor} met {target} KO.', '{target} est à terre, KO signé {actor}.'],
  koEffect: ['{target} succombe : {effect}.'],
  bigHit: ['{ability} : {actor} frappe {target} pour {n}.', 'Coup énorme : {actor} inflige {n} à {target} avec {ability}.'],
  flee: ['{actor} s’enfuit de l’arène !'],
  enrage: ['{actor} entre dans une rage folle.'],
  substitution: ['{inName} remplace {outName}.'],
  swing: ['Le vent tourne : {team} prend l’ascendant.'],
  finalBlow: ['{actor} porte le coup de grâce.'],
};

export const HEADLINES_FR: typeof HEADLINES = {
  koWin: '{us} bat {them} par KO au round {round}.',
  koLoss: '{us} est mis KO par {them} au round {round}.',
  pointsWin: '{us} bat {them} aux points ({score}).',
  pointsLoss: '{us} s’incline face à {them} aux points ({score}).',
};

export const REPORT_WORDS_FR: typeof REPORT_WORDS = {
  theirWounds: 'ses blessures',
  substitution: 'remplacement',
  substitutions: 'remplacements',
};
