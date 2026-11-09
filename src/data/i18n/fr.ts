/**
 * French texts for the static game data. Keys mirror the English declarations
 * (src/data/*.ts); tests check that every id has a translation.
 *
 * Grammar helpers used by the French commentary:
 * - species.the: how to say "the troll" ("le troll", "l'orc", "la harpie")
 * - species.fem: feminine noun (adjectives in templates take an "e" through {aE}/{tE})
 * - effects.noun: the effect as a subject ("la brûlure", "le poison")
 * - injuries.name: with an indefinite article ("une côte fêlée")
 * Ability verbs must take their target directly or end with sur/contre/chez/dans/pour/sous
 * (never "de"/"à", which would need elision or contraction).
 */
import type { AbilityKind, ElementId, RoleId, SizeClass } from '../schema.ts';
import type { AttributeCategory, AttributeKey } from '../attributes.ts';

export interface SpeciesText {
  name: string;
  plural: string;
  description: string;
  the: string;
  fem: boolean;
}

export const FR_SPECIES: Record<string, SpeciesText> = {
  goblin: { name: 'Gobelin', plural: 'Gobelins', the: 'le gobelin', fem: false, description: 'Bon marché, rapide et sournois. S’épanouit tôt, décline vite — et détale souvent quand ça tourne mal.' },
  orc: { name: 'Orc', plural: 'Orcs', the: 'l’orc', fem: false, description: 'Né pour l’arène. Fort, agressif et têtu ; la colonne vertébrale de bien des écuries.' },
  troll: { name: 'Troll', plural: 'Trolls', the: 'le troll', fem: false, description: 'Un mur de muscles dont les plaies se referment seules. Lent d’esprit, lent des pieds, et vite essoufflé.' },
  elf: { name: 'Elfe sylvain', plural: 'Elfes sylvains', the: 'l’elfe', fem: false, description: 'Archers et guérisseurs gracieux. Fragiles, mais précis, disciplinés et malins.' },
  golem: { name: 'Golem de pierre', plural: 'Golems de pierre', the: 'le golem', fem: false, description: 'Une statue animée : infatigable, obéissante, presque indestructible — et terriblement lente.' },
  wyvern: { name: 'Vouivre', plural: 'Vouivres', the: 'la vouivre', fem: true, description: 'Un dragon mineur à la queue venimeuse. Fond sur la deuxième ligne.' },
  dragon: { name: 'Dragon', plural: 'Dragons', the: 'le dragon', fem: false, description: 'Le sommet de l’arène. Mûrit pendant une décennie, règne un demi-siècle — et coûte une fortune à nourrir.' },
  minotaur: { name: 'Minotaure', plural: 'Minotaures', the: 'le minotaure', fem: false, description: 'Homme-taureau qui charge tout. Dévastateur, imprudent, presque impossible à contrôler.' },
  harpy: { name: 'Harpie', plural: 'Harpies', the: 'la harpie', fem: true, description: 'Volatile hurleuse qui harcèle la deuxième ligne et ralentit tout le monde.' },
  shade: { name: 'Spectre', plural: 'Spectres', the: 'le spectre', fem: false, description: 'Un esprit sans repos. Draine la vie et le courage ; les coups le traversent à moitié.' },
  treant: { name: 'Tréant', plural: 'Tréants', the: 'le tréant', fem: false, description: 'Un arbre ancien qui marche. Bouge à peine, mais abrite et soigne toute son équipe.' },
  naga: { name: 'Naga', plural: 'Nagas', the: 'la naga', fem: true, description: 'Mage des eaux au corps de serpent. Polyvalente : elle frappe, lance des sorts et soigne.' },
  griffin: { name: 'Griffon', plural: 'Griffons', the: 'le griffon', fem: false, description: 'Fier aigle-lion. Courageux, loyal et rapide ; plonge sur la deuxième ligne adverse.' },
  'lich': { name: 'Liche', plural: 'Liches', the: 'la liche', fem: true, description: 'Un sorcier qui a trompé la mort. Corps fragile, esprit terrible : maudit, draine et survit à tout le monde.' },
  'kraken': { name: 'Kraken', plural: 'Krakens', the: 'le kraken', fem: false, description: 'Une terreur des mers traînée sur le sable. Des tentacules partout : il saisit, broie et encaisse.' },
  'phoenix': { name: 'Phénix', plural: 'Phénix', the: 'le phénix', fem: false, description: 'L’oiseau de feu immortel. Soigne son équipe, brûle ses ennemis, et sa propre flamme ne cesse de renaître.' },
  'dryad': { name: 'Dryade', plural: 'Dryades', the: 'la dryade', fem: true, description: 'Un esprit de la forêt lié à un vieux chêne. Fragile et douce, mais peu de soigneurs la valent.' },
  'basilisk': { name: 'Basilic', plural: 'Basilics', the: 'le basilic', fem: false, description: 'Un grand serpent aux écailles de pierre. Sa morsure empoisonne, son regard pétrifie.' },
  'djinn': { name: 'Djinn', plural: 'Djinns', the: 'le djinn', fem: false, description: 'Un esprit de feu sans fumée. Rapide, malin et capricieux — les vœux ont un prix.' },
  'centaur': { name: 'Centaure', plural: 'Centaures', the: 'le centaure', fem: false, description: 'Archer et lancier des plaines. Rapide, fier, mortel de loin comme à la charge.' },
  'wendigo': { name: 'Wendigo', plural: 'Wendigos', the: 'le wendigo', fem: false, description: 'Une horreur affamée des forêts gelées. Jamais rassasié, jamais calme, jamais loin.' },
  'crystal-golem': { name: 'Golem de cristal', plural: 'Golems de cristal', the: 'le golem de cristal', fem: false, description: 'Un golem de cristal vivant. Il réfracte la lumière en rayons et en boucliers ; posé, obéissant, lent.' },
  'salamander': { name: 'Salamandre', plural: 'Salamandres', the: 'la salamandre', fem: true, description: 'Un petit lézard de feu très vif. Bon marché, fragile et franchement agaçant.' },
};

export const FR_ABILITIES: Record<string, { name: string; verb: string; description: string }> = {
  stab: { name: 'Coup de surin', verb: 'plante sa lame rouillée dans', description: 'Coup rapide qui cherche le point faible.' },
  sling: { name: 'Fronde', verb: 'envoie une pierre de fronde sur', description: 'Un caillou en pleine tête. Ça marche plus souvent que prévu.' },
  'dirty-trick': { name: 'Coup bas', verb: 'envoie une poignée de sable sur', description: 'Sable, coups de pied, morsures — tout ce qui affaiblit l’adversaire.' },
  scurry: { name: 'Détale', verb: 'se met à détaler en tous sens', description: 'Court partout et devient difficile à toucher.' },
  'axe-swing': { name: 'Coup de hache', verb: 'abat sa hache sur', description: 'Moulinet brutal par-dessus la tête.' },
  cleave: { name: 'Fauchage', verb: 'taille dans', description: 'Large arc qui frappe toute la première ligne adverse.' },
  'war-cry': { name: 'Cri de guerre', verb: 'pousse un cri de guerre', description: 'Galvanise tous les alliés présents dans l’arène.' },
  'club-smash': { name: 'Coup de massue', verb: 'abat sa massue sur', description: 'Un tronc d’arbre en guise de gourdin.' },
  'crushing-blow': { name: 'Coup écrasant', verb: 'assène un coup écrasant sur', description: 'Lent, dévastateur, peut étourdir.' },
  longbow: { name: 'Arc long', verb: 'décoche une flèche sur', description: 'Élégant et mortel.' },
  'aimed-shot': { name: 'Tir ajusté', verb: 'ajuste soigneusement son tir sur', description: 'Un tir patient visant un point vital.' },
  moonbeam: { name: 'Rayon de lune', verb: 'fait tomber un rayon de lune sur', description: 'Une lumière pâle et brûlante.' },
  'healing-song': { name: 'Chant de guérison', verb: 'entonne un chant de guérison pour', description: 'Referme les plaies d’un allié.' },
  'stone-fist': { name: 'Poing de pierre', verb: 'martèle', description: 'Un poing de roche massive.' },
  'seismic-slam': { name: 'Onde sismique', verb: 'frappe le sol et ébranle', description: 'Onde de choc à travers la première ligne adverse.' },
  'stone-skin': { name: 'Peau de pierre', verb: 'durcit sa peau de pierre', description: 'Subit beaucoup moins de dégâts pendant un temps.' },
  talons: { name: 'Serres', verb: 'plante ses serres dans', description: 'Des griffes en crochet.' },
  'venom-sting': { name: 'Dard venimeux', verb: 'enfonce son dard venimeux dans', description: 'Aiguillon empoisonné.' },
  dive: { name: 'Piqué', verb: 'fond du ciel sur', description: 'Plonge sur n’importe quelle cible, même en deuxième ligne.' },
  rend: { name: 'Lacération', verb: 'lacère', description: 'Des griffes comme des épées.' },
  'fire-breath': { name: 'Souffle de feu', verb: 'crache un torrent de flammes sur', description: 'Engloutit toute l’équipe adverse.' },
  'tail-sweep': { name: 'Coup de queue', verb: 'balaie d’un coup de queue', description: 'Bouscule toute la première ligne.' },
  'terrifying-roar': { name: 'Rugissement terrifiant', verb: 'pousse un rugissement terrifiant contre', description: 'Ébranle le courage de tous les adversaires.' },
  'horn-gore': { name: 'Coup de cornes', verb: 'encorne', description: 'Les cornes en avant.' },
  'bull-charge': { name: 'Charge du taureau', verb: 'charge tête baissée sur', description: 'Traverse les lignes pour atteindre n’importe quelle cible.' },
  rampage: { name: 'Déchaînement', verb: 'souffle des naseaux et se met en furie', description: 'Entre volontairement en rage.' },
  rake: { name: 'Griffure', verb: 'griffe', description: 'Passage rapide et tranchant.' },
  screech: { name: 'Cri strident', verb: 'lance un cri strident contre', description: 'Un hurlement assourdissant qui ralentit tous les adversaires.' },
  'chill-touch': { name: 'Toucher glacial', verb: 'pose une main glacée sur', description: 'Un froid qui s’insinue jusque dans l’âme.' },
  'shadow-bolt': { name: 'Trait d’ombre', verb: 'lance un trait d’ombre sur', description: 'Les ténèbres faites projectile.' },
  'life-drain': { name: 'Drain de vie', verb: 'vampirise', description: 'Vole la vitalité de la cible.' },
  dread: { name: 'Effroi', verb: 'instille l’effroi chez', description: 'Des murmures funestes qui brisent le moral.' },
  'branch-slam': { name: 'Coup de branche', verb: 'abat une branche massive sur', description: 'Comme se prendre une forêt sur la tête.' },
  entangle: { name: 'Enchevêtrement', verb: 'fait jaillir des racines sous', description: 'Des racines surgissent du sable pour entraver un ennemi.' },
  barkskin: { name: 'Écorce protectrice', verb: 'dresse une armure d’écorce sur', description: 'Protège un allié derrière une barrière.' },
  'sap-mend': { name: 'Sève curative', verb: 'applique une sève curative sur', description: 'Une sève qui continue de soigner.' },
  trident: { name: 'Coup de trident', verb: 'enfonce son trident dans', description: 'Trois pointes de douleur.' },
  'tidal-lash': { name: 'Fouet des marées', verb: 'projette un fouet d’eau sur', description: 'De la saumure sous pression.' },
  constrict: { name: 'Étreinte', verb: 'enserre', description: 'Comprime la cible jusqu’à l’immobiliser.' },
  'healing-waters': { name: 'Eaux curatives', verb: 'répand des eaux curatives sur', description: 'Soigne un peu tous les alliés.' },
  'beak-and-claw': { name: 'Bec et serres', verb: 'se jette bec et serres sur', description: 'Aigle et lion à la fois.' },
  'radiant-dive': { name: 'Piqué radieux', verb: 'plonge dans un éclat de lumière sur', description: 'Un piqué éclatant sur n’importe quelle cible.' },
  'sky-cry': { name: 'Cri céleste', verb: 'lance un cri fier vers le ciel', description: 'Inspire les alliés.' },
  'necrotic-bolt': { name: 'Trait nécrotique', verb: 'lance un trait nécrotique sur', description: 'La mort taillée en projectile.' },
  'withering-curse': { name: 'Malédiction flétrissante', verb: 'jette une malédiction flétrissante sur', description: 'Sape la force et la défense.' },
  'soul-harvest': { name: 'Moisson d’âmes', verb: 'lance une moisson d’âmes contre', description: 'Une faux d’ombre traverse toute l’équipe adverse.' },
  'bone-ward': { name: 'Rempart d’os', verb: 'dresse un rempart d’os devant', description: 'Un rempart d’ossements protège un allié.' },
  'tentacle-lash': { name: 'Coup de tentacule', verb: 'abat un tentacule sur', description: 'Un fouet de muscle trempé.' },
  'crushing-grip': { name: 'Étreinte broyante', verb: 'referme ses tentacules sur', description: 'Serre jusqu’à ce que la cible ne puisse plus bouger.' },
  'ink-cloud': { name: 'Nuage d’encre', verb: 'noie l’arène sous un nuage d’encre', description: 'Une encre noire cache toute son équipe.' },
  'maelstrom': { name: 'Maelström', verb: 'fait tourbillonner un maelström sous', description: 'Un tourbillon avale la première ligne adverse.' },
  'ember-talons': { name: 'Serres de braise', verb: 'plante ses serres brûlantes dans', description: 'Des griffes qui laissent des braises.' },
  'flame-burst': { name: 'Gerbe de flammes', verb: 'déchaîne une gerbe de flammes sur', description: 'Un bouquet de feu.' },
  'rebirth-flame': { name: 'Flamme de renaissance', verb: 'répand la flamme de la renaissance sur', description: 'Soigne tous les alliés, et la flamme continue d’agir.' },
  'solar-flare': { name: 'Éruption solaire', verb: 'déclenche une éruption solaire contre', description: 'Une lumière aveuglante qui laisse chaque ennemi exposé.' },
  'thorn-whip': { name: 'Fouet d’épines', verb: 'abat un fouet d’épines sur', description: 'Une liane couverte d’épines.' },
  'bloom': { name: 'Floraison', verb: 'fait éclore des fleurs guérisseuses sur', description: 'Des fleurs qui referment les plaies.' },
  'pollen-cloud': { name: 'Nuage de pollen', verb: 'libère un nuage de pollen sur', description: 'Des ennemis qui éternuent et ralentissent.' },
  'oak-blessing': { name: 'Bénédiction des chênes', verb: 'appelle la bénédiction des vieux chênes', description: 'Les alliés deviennent durs comme le vieux bois.' },
  'venom-fang': { name: 'Crocs venimeux', verb: 'plante ses crocs venimeux dans', description: 'Une morsure qui fait mal longtemps.' },
  'tail-crush': { name: 'Écrasement caudal', verb: 'abat sa queue sur', description: 'Une queue écailleuse comme une masse d’armes.' },
  'stone-gaze': { name: 'Regard pétrifiant', verb: 'pose son regard pétrifiant sur', description: 'Un regard, et les membres se changent en pierre.' },
  'wind-blade': { name: 'Lame de vent', verb: 'projette une lame de vent sur', description: 'De l’air tranchant comme l’acier.' },
  'mirage': { name: 'Mirage', verb: 'se dissout en un mirage scintillant', description: 'Devient très difficile à toucher.' },
  'whirlwind': { name: 'Tourbillon', verb: 'soulève un tourbillon contre', description: 'Sable et vent frappent toute l’équipe adverse.' },
  'granted-wish': { name: 'Vœu exaucé', verb: 'exauce un vœu brûlant pour', description: 'Un allié est saisi de fureur.' },
  'recurve-bow': { name: 'Arc recourbé', verb: 'décoche une flèche sur', description: 'Tirée au grand galop.' },
  'hoof-strike': { name: 'Ruade', verb: 'rue contre', description: 'Quatre sabots, une seule direction.' },
  'lance-charge': { name: 'Charge à la lance', verb: 'charge lance en avant sur', description: 'Traverse les lignes jusqu’à n’importe quelle cible.' },
  'trample': { name: 'Piétinement', verb: 'piétine', description: 'Passe sur le corps de la première ligne adverse.' },
  'frost-claws': { name: 'Griffes de givre', verb: 'abat ses griffes gelées sur', description: 'Des griffes de glace.' },
  'ravenous-bite': { name: 'Morsure vorace', verb: 'mord voracement', description: 'Se nourrit de sa proie.' },
  'chilling-howl': { name: 'Hurlement glaçant', verb: 'pousse un hurlement glaçant contre', description: 'Un hurlement venu des forêts gelées.' },
  'crystal-fist': { name: 'Poing de cristal', verb: 'abat un poing de cristal sur', description: 'Dur, tranchant et scintillant.' },
  'prism-beam': { name: 'Rayon prismatique', verb: 'concentre un rayon prismatique sur', description: 'La lumière rassemblée en un rayon brûlant.' },
  'refraction': { name: 'Réfraction', verb: 'dresse un bouclier réfractant devant', description: 'Un bouclier de cristal détourne les coups d’un allié.' },
  'quick-bite': { name: 'Morsure rapide', verb: 'mord', description: 'Rapide et agaçant.' },
  'fire-spit': { name: 'Crachat de feu', verb: 'crache du feu sur', description: 'Une giclée de flammes.' },
  'ember-dash': { name: 'Ruée de braises', verb: 'fonce dans une traînée de braises sur', description: 'Fonce sur n’importe quelle cible, même en deuxième ligne.' },
};

export const FR_EFFECTS: Record<string, { name: string; noun: string; description: string }> = {
  burning: { name: 'Brûlure', noun: 'la brûlure', description: 'Perd des points de vie à chaque round.' },
  poisoned: { name: 'Empoisonné', noun: 'le poison', description: 'Perd des points de vie à chaque round et frappe un peu moins fort.' },
  bleeding: { name: 'Saignement', noun: 'l’hémorragie', description: 'Perd des points de vie à chaque round.' },
  stunned: { name: 'Étourdi', noun: 'l’étourdissement', description: 'Perd son prochain tour.' },
  slowed: { name: 'Ralenti', noun: 'le ralentissement', description: 'Agit plus tard et esquive moins bien.' },
  weakened: { name: 'Affaibli', noun: 'la faiblesse', description: 'Inflige moins de dégâts.' },
  terrified: { name: 'Terrifié', noun: 'la terreur', description: 'Le moral chute à chaque round et la visée vacille.' },
  exposed: { name: 'Exposé', noun: 'la garde brisée', description: 'Garde brisée : subit davantage de dégâts.' },
  shielded: { name: 'Bouclier', noun: 'le bouclier', description: 'Une barrière absorbe les dégâts reçus.' },
  fortified: { name: 'Fortifié', noun: 'la fortification', description: 'Subit moins de dégâts.' },
  rallied: { name: 'Galvanisé', noun: 'l’élan', description: 'Gonflé à bloc : frappe plus fort et plus juste.' },
  enraged: { name: 'Enragé', noun: 'la rage', description: 'Fureur aveugle : gros dégâts, garde médiocre, ignore les ordres.' },
  evasive: { name: 'Insaisissable', noun: 'l’agilité', description: 'Bondit partout, difficile à atteindre.' },
  regenerating: { name: 'Régénération', noun: 'la régénération', description: 'Récupère des points de vie à chaque round.' },
  trollblood: { name: 'Sang de troll', noun: 'le sang de troll', description: 'Les plaies se referment toutes seules.' },
  stoneform: { name: 'Corps de pierre', noun: 'le corps de pierre', description: 'Fait de roche : encaisse une partie de chaque coup.' },
  incorporeal: { name: 'Immatériel', noun: 'l’immatérialité', description: 'À moitié là, à moitié absent : les coups le traversent.' },
  rekindling: { name: 'Renaissance', noun: 'la flamme renaissante', description: 'Sa flamme ne cesse de renaître.' },
};

export const FR_TRAITS: Record<string, { name: string; description: string }> = {
  ambitious: { name: 'Ambitieux', description: 'Veut la gloire et une plus grande scène. Travaille dur, mais attend d’être récompensé.' },
  lazy: { name: 'Paresseux', description: 'Fait le strict minimum. Se lasse vite de l’effort.' },
  professional: { name: 'Professionnel', description: 'Se prépare avec soin et suit le plan.' },
  loyal: { name: 'Loyal', description: 'Dévoué à l’écurie. Demande rarement à partir.' },
  hothead: { name: 'Tête brûlée', description: 'Soupe au lait. Perd les pédales quand on le provoque.' },
  'cool-headed': { name: 'Sang-froid', description: 'De la glace dans les veines quand ça compte.' },
  'pack-leader': { name: 'Chef de meute', description: 'Les autres le suivent. Rassure toute l’équipe sur le terrain.' },
  coward: { name: 'Lâche', description: 'Nerfs fragiles. Peut se figer ou fuir quand ça tourne mal.' },
  fearless: { name: 'Intrépide', description: 'Rien ne lui fait peur. Absolument rien.' },
  berserker: { name: 'Berserker', description: 'Devient fou furieux une fois blessé : dégâts énormes, aucune retenue.' },
  vengeful: { name: 'Vengeur', description: 'Voir tomber un allié le plonge dans la fureur.' },
  'glory-hunter': { name: 'Chasseur de gloire', description: 'Veut le final spectaculaire, quitte à ignorer le plan.' },
  showboat: { name: 'Cabotin', description: 'Joue pour la foule. Oublie parfois qu’il y a un combat.' },
  'team-player': { name: 'Collectif', description: 'S’épanouit dans les attaques coordonnées.' },
  loner: { name: 'Solitaire', description: 'Se bat mieux seul, mal en groupe.' },
  'iron-hide': { name: 'Cuir de fer', description: 'Exceptionnellement dur à blesser, rarement indisponible.' },
  brittle: { name: 'Fragile', description: 'Se blesse bien trop facilement.' },
  cunning: { name: 'Rusé', description: 'Repère les faiblesses et les exploite.' },
  stubborn: { name: 'Têtu', description: 'N’abandonne jamais — et n’écoute jamais non plus.' },
  bloodthirsty: { name: 'Sanguinaire', description: 'Va à la curée dès qu’il sent le sang.' },
  guardian: { name: 'Gardien', description: 'Se jette d’instinct devant les alliés menacés.' },
  'big-game': { name: 'Créature des grands soirs', description: 'Se surpasse quand l’équipe est en difficulté.' },
  'frail-nerves': { name: 'Nerfs fragiles', description: 'S’effondre sous la pression.' },
};

export const FR_INJURIES: Record<string, { name: string; short: string }> = {
  bruises: { name: 'de grosses contusions', short: 'Contusions' },
  gash: { name: 'une entaille profonde', short: 'Entaille profonde' },
  'sprained-limb': { name: 'une entorse', short: 'Entorse' },
  'cracked-ribs': { name: 'des côtes fêlées', short: 'Côtes fêlées' },
  'torn-wing': { name: 'une aile déchirée', short: 'Aile déchirée' },
  burns: { name: 'de graves brûlures', short: 'Brûlures graves' },
  frostbite: { name: 'les poumons noyés', short: 'Poumons noyés' },
  'soul-wound': { name: 'une blessure de l’âme', short: 'Blessure de l’âme' },
  concussion: { name: 'une commotion', short: 'Commotion' },
  'broken-limb': { name: 'un membre brisé', short: 'Membre brisé' },
  'shattered-horn': { name: 'une corne ou une défense brisée', short: 'Corne brisée' },
  'crippling-wound': { name: 'une blessure invalidante', short: 'Blessure invalidante' },
};

export const FR_ELEMENTS: Record<ElementId, string> = {
  fire: 'Feu',
  water: 'Eau',
  earth: 'Terre',
  air: 'Air',
  nature: 'Nature',
  shadow: 'Ombre',
  light: 'Lumière',
};

export const FR_ROLES: Record<RoleId, { name: string; short: string; description: string }> = {
  tank: { name: 'Tank', short: 'TNK', description: 'Tient la première ligne et intercepte les coups destinés aux alliés.' },
  striker: { name: 'Frappeur', short: 'FRP', description: 'Inflige de gros dégâts au corps à corps depuis la première ligne.' },
  support: { name: 'Soutien', short: 'SOU', description: 'Soigne et renforce les alliés depuis la deuxième ligne.' },
  caster: { name: 'Lanceur de sorts', short: 'MAG', description: 'Lance des sorts depuis la deuxième ligne en exploitant les faiblesses élémentaires.' },
  skirmisher: { name: 'Tirailleur', short: 'TIR', description: 'Flanqueur rapide qui harcèle la deuxième ligne adverse.' },
};

export const FR_ATTRIBUTES: Record<AttributeKey, { name: string; short: string; description: string }> = {
  strength: { name: 'Force', short: 'For', description: 'Puissance brute des coups au corps à corps. Augmente les PV.' },
  stamina: { name: 'Endurance', short: 'End', description: 'Réserve d’énergie et capacité à tenir la distance.' },
  speed: { name: 'Vitesse', short: 'Vit', description: 'Agit plus tôt dans chaque round.' },
  agility: { name: 'Agilité', short: 'Agi', description: 'Esquive des coups et des projectiles.' },
  toughness: { name: 'Robustesse', short: 'Rob', description: 'PV et résistance aux dégâts physiques.' },
  recovery: { name: 'Récupération', short: 'Réc', description: 'Énergie regagnée entre les actions et au repos.' },
  attack: { name: 'Attaque', short: 'Att', description: 'Placer ses coups au corps à corps.' },
  accuracy: { name: 'Précision', short: 'Pré', description: 'Toucher avec les attaques à distance.' },
  defense: { name: 'Défense', short: 'Déf', description: 'Parer et bloquer les attaques au corps à corps.' },
  magic: { name: 'Magie', short: 'Mag', description: 'Puissance des sorts et des soins.' },
  focus: { name: 'Concentration', short: 'Con', description: 'Précision des sorts et résistance à la magie hostile.' },
  technique: { name: 'Technique', short: 'Tec', description: 'Coups critiques et finesse aux armes à distance.' },
  courage: { name: 'Courage', short: 'Cou', description: 'Tenir bon quand les alliés tombent ou que les coups font mal.' },
  composure: { name: 'Sang-froid', short: 'SgF', description: 'Tête froide sous pression : critiques et moins d’erreurs.' },
  aggression: { name: 'Agressivité', short: 'Agr', description: 'Frappe plus fort mais se protège moins, et peut oublier toute prudence.' },
  tactics: { name: 'Sens tactique', short: 'Tac', description: 'Faire les bons choix : cibles, affinités élémentaires, timing.' },
  discipline: { name: 'Discipline', short: 'Dis', description: 'Suivre les consignes du manager.' },
  anticipation: { name: 'Anticipation', short: 'Ant', description: 'Lire le combat : initiative, esquive, interceptions.' },
  determination: { name: 'Détermination', short: 'Dét', description: 'Se battre encore plus fort quand l’équipe est menée.' },
  teamwork: { name: 'Jeu collectif', short: 'Col', description: 'Attaques coordonnées et protection des alliés.' },
  leadership: { name: 'Leadership', short: 'Lea', description: 'Maintient le moral des alliés tant qu’il est sur le terrain.' },
};

export const FR_CATEGORIES: Record<AttributeCategory, string> = { physical: 'Physique', combat: 'Combat', mental: 'Mental' };

export const FR_QUALITIES: Record<string, string> = {
  novice: 'Fosse des novices',
  regional: 'Arène régionale',
  professional: 'Ligue professionnelle',
  elite: 'Circuit d’élite',
  legendary: 'Légendaire',
};

export const FR_SIZES: Record<SizeClass, string> = { small: 'petit', medium: 'moyen', large: 'grand', huge: 'énorme' };

export const FR_ABILITY_KINDS: Record<AbilityKind, string> = {
  melee: 'corps à corps',
  ranged: 'distance',
  spell: 'sort',
  heal: 'soin',
  buff: 'renfort',
  debuff: 'malédiction',
};

/** French surnames, index-aligned with the English ones in NAME_CULTURES (same RNG draws). */
export const FR_SURNAMES: Record<string, string[]> = {
  goblin: ['le Vif', 'Deux-Couteaux', 'Mord-Rat', 'le Fourbe', 'Pied-Boueux', 'Demi-Oreille'],
  orc: ['Fend-Crâne', 'Mâchoire-de-Fer', 'Défense-Sanglante', 'le Rouge', 'Broie-Os', 'Dent-Noire'],
  troll: ['Ventre-de-Roc', 'le Puant', 'Peau-de-Mousse', 'Poing-Rocher', 'l’Affamé'],
  elf: ['Murmure-des-Feuilles', 'de la Clairière', 'Arc-de-Lune', 'Rameau-d’Étoile', 'Feuille-d’Argent'],
  dragon: ['la Braise', 'Aile-de-Cendre', 'l’Immortel', 'Gueule-de-Cendre', 'le Doré'],
  minotaur: ['Brise-Cornes', 'le Taureau', 'du Labyrinthe', 'Sabot-Tonnerre'],
  shade: ['le Murmure', 'des Tombes Creuses', 'le Blême', 'Qui Fut Oublié', 'l’Affamé'],
  naga: ['des Abysses', 'Écaille-de-Perle', 'Appel-des-Marées', 'l’Enroulée'],
  lich: ['Qui Ne Meurt Pas', 'Roi-des-Os', 'de la Dernière Crypte', 'le Roi Creux'],
  deep: ['des Abîmes', 'Brise-Navires', 'le Noyé'],
  phoenix: ['Né-des-Cendres', 'de l’Aube', 'Qui Renaît'],
  djinn: ['de la Cité d’Airain', 'Exauceur', 'Sans-Fumée'],
  centaur: ['Sabot-Vif', 'des Plaines', 'l’Archer'],
};

/** French team-name material. Same list sizes as TEAM_NAME_PARTS so the RNG draws match. */
export const FR_TEAM_NAME_PARTS = {
  /** [noun, gender] — plural nouns. */
  nouns: [
    ['Crocs', 'm'], ['Gardiens', 'm'], ['Gueules', 'f'], ['Serres', 'f'], ['Brutes', 'f'], ['Sentinelles', 'f'], ['Ravageurs', 'm'],
    ['Molosses', 'm'], ['Griffes', 'f'], ['Pillards', 'm'], ['Cornes', 'f'], ['Serpents', 'm'], ['Wyrms', 'm'], ['Traqueurs', 'm'],
  ] as [string, 'm' | 'f'][],
  /** [masculine plural, feminine plural] */
  adjectives: [
    ['de Fer', 'de Fer'], ['Cramoisis', 'Cramoisies'], ['Hurlants', 'Hurlantes'], ['Noirs', 'Noires'], ['Cendrés', 'Cendrées'],
    ['Dorés', 'Dorées'], ['Putrides', 'Putrides'], ['Tonnants', 'Tonnantes'], ['Silencieux', 'Silencieuses'], ['Ardents', 'Ardentes'],
    ['Gelés', 'Gelées'], ['Sauvages', 'Sauvages'], ['Sinistres', 'Sinistres'], ['Engloutis', 'Englouties'],
  ] as [string, string][],
  /** With their preposition ("de", "du", "des"). */
  places: ['de Sombrelande', 'de Karak Varn', 'de la Fange', 'de Chutebraise', 'de Grisport', 'des Pics Creux', 'de Salmarais', 'de Boisronce', 'du Vieux-Brannoc', 'de Skarn'],
};
