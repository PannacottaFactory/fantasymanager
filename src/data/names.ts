/**
 * Name generation material, one "culture" per family of species.
 * - syllables: name = start + (optional middle) + end
 * - compound: name = first + second (e.g. "Oldbark")
 */

export interface NameCulture {
  style: 'syllables' | 'compound';
  starts: string[];
  middles?: string[];
  ends: string[];
  /** Chance to add a middle syllable. */
  middleChance?: number;
  /** Optional surnames / titles appended. */
  surnames?: string[];
  surnameChance?: number;
}

/** English team-name material. Index-aligned with FR_TEAM_NAME_PARTS (same draw = same name translated). */
export const TEAM_NAME_PARTS = {
  adjectives: [
    'Iron', 'Crimson', 'Howling', 'Black', 'Ashen', 'Gilded', 'Rotting', 'Thundering', 'Silent', 'Burning', 'Frozen', 'Wild', 'Grim', 'Sunken',
    'Bleak', 'Scarlet', 'Hollow', 'Savage', 'Wailing', 'Cursed', 'Brazen', 'Rusted', 'Shadow', 'Bone',
  ],
  nouns: [
    'Fangs', 'Wardens', 'Maws', 'Talons', 'Brutes', 'Sentinels', 'Ravagers', 'Hounds', 'Claws', 'Reavers', 'Horns', 'Serpents', 'Wyrms', 'Stalkers',
    'Jackals', 'Ravens', 'Vultures', 'Wolves', 'Blades', 'Spears', 'Shields', 'Lions', 'Bears', 'Scorpions',
  ],
  places: [
    'Duskmoor', 'Karak Varn', 'the Mire', 'Emberfall', 'Greyhaven', 'the Hollow Peaks', 'Saltmarsh', 'Thornwood', 'Old Brannoc', 'Skarn',
    'Varnholt', 'the Ashlands', 'Mirefen', 'Blackwater', 'the Iron Coast', 'Gallowmere', 'Highcairn', 'Vel Shaddar', 'the Sunken Isles', 'Rookspire',
  ],
  /** "Order of the Broken Tusk" / "Legion of Skarn". */
  orders: ['Order', 'Brotherhood', 'Court', 'Circle', 'Covenant', 'Legion', 'Company', 'Guild', 'Pact', 'Host', 'Coven', 'Sisterhood', 'Conclave', 'Watch', 'Band', 'Fraternity'],
  emblems: [
    'the Broken Tusk', 'the Last Ember', 'Ashes', 'Thorns', 'the Deep', 'the Pale Moon', 'the Red Hand', 'Seven Scars', 'the Hollow Crown',
    'the Black Lantern', 'the Iron Vow', 'Bones', 'the Weeping Star', 'the Gutter', 'the Ninth Gate', 'the Rusted Key',
    'the Silver Fang', 'the Drowned King', 'Embers', 'the Shattered Shield', 'the Black Sun', 'the Crooked Spire', 'the Wolf’s Head',
    'Nine Candles', 'the Bleeding Rose', 'the Long Night',
  ],
  /** Names that stand alone. */
  standalone: [
    'Bloodmoon', 'The Ninth Pit', 'Gravewind', 'Cinderhorn', 'Last Light', 'The Unbowed', 'Hollowcrown', 'The Bonepickers', 'Nightglass',
    'Ironvow', 'Stormcallers', 'The Gutterkings', 'Grimhold', 'The Lantern Guild', 'Rustmarrow', 'Whispering Gallows', 'Thirteen Teeth',
    'The Dregs', 'Mournwatch', 'Old Smoke', 'The Midnight Menagerie', 'Kingsbane', 'The Chained', 'Embertide',
    'Ashmarch', 'The Grey Host', 'Wolfsbane', 'Saltblood', 'The Lost Banner', 'Stormwake', 'Bramblecrown', 'The Faceless',
    'Ravenmoor', 'Duskrunners', 'The Ninefold', 'Brightscar', 'The Ragged Crown', 'Coldiron', 'Blackfen', 'The Undertow',
  ],
  /** "Mother Gorza's Brood". */
  figures: [
    'Mother Gorza', 'Baron Vex', 'Old Tamsin', 'the Widow Marrow', 'Captain Skarr', 'Uncle Brisk', 'Lady Morne', 'One-Eyed Hob', 'the Hermit', 'Doctor Quill',
    'Granny Wort', 'Sir Aldous', 'the Brothers Grimsby', 'Madame Sorrel', 'Old Man Crane', 'the Pale Duchess', 'Mad Ludo', 'Sister Ember',
  ],
  troupes: ['Brood', 'Butchers', 'Rabble', 'Menagerie', 'Beasts', 'Strays', 'Kennel', 'Circus', 'Horde', 'Rejects', 'Pack', 'Crew', 'Mob', 'Troupe', 'Hunt', 'Gang'],
};

/** Names of the managers of AI stables (the same in every language). */
export const MANAGER_NAMES = {
  first: [
    'Aldric', 'Brunhild', 'Morwenna', 'Thrain', 'Zeltha', 'Xanbar', 'Ulgrim', 'Sylvaris', 'Krag', 'Nimue', 'Balthor', 'Elowen',
    'Draxis', 'Ysmira', 'Gorvak', 'Azura', 'Grimbold', 'Isolde', 'Varnak', 'Lirael', 'Snikkit', 'Orsolya', 'Thessaly', 'Bramwyn',
    'Kezzara', 'Moloch', 'Fennick', 'Seraphine', 'Ragnor', 'Velka', 'Zubrak', 'Eldrin', 'Hagatha', 'Corvin', 'Ilsabet', 'Torvald',
    'Wulfric', 'Maelis', 'Odran', 'Sigrun', 'Halvard', 'Ysolde', 'Bastien', 'Kaida', 'Oren', 'Rhoswen', 'Dagny', 'Lucan',
    'Mirela', 'Theron', 'Ondine', 'Gerolt', 'Saphra', 'Albrecht', 'Zora', 'Pelham', 'Ivo', 'Cassia', 'Hrolf', 'Marisol',
    'Tybalt', 'Nadira', 'Quillon', 'Rowena', 'Faustin', 'Jorunn', 'Lisandre', 'Mordecai', 'Vashti', 'Ebba', 'Gaspard', 'Yrsa',
  ],
  last: [
    'Vossarak', 'Corbeval', 'Malvoisin', 'Duskmantle', 'Brisefer', 'Ashgrove', 'Thornquist', 'Grimaud', 'Kaelthas', 'Morgrath',
    'Valdane', 'Ironhand', 'Sombrelune', 'Roquelaure', 'Vexley', 'Drakkenhof', 'Nightbloom', 'Blackwood', 'Ravenhill', 'Ur-Gazrak',
    'Montfaucon', 'Silverbrook', 'Zarethi', 'Fendragon', 'Gloomweaver', 'Ombrecoeur', 'Tarnwick', 'Skarnhelm', 'Varga', 'Ystrandir',
    'Fairweather', 'Hollowell', 'Dunmorrow', 'Ashcombe', 'Kettleburn', 'Saltwick', 'Beaumanoir', 'Castelgrise', 'Wyrmsbane', 'Ostrander',
    'Thistlewood', 'Harrowgate', 'Quellmar', 'Brokenshield', 'Corvane', 'Steelbrook', 'Mournhallow', 'Dravenholt', 'Hexley', 'Sablemoor',
    'Varkesh', 'Ul-Thoran', 'Ironbridge', 'Lanternwick', 'Stonecrop', 'Wintermere', 'Duvalier', 'Kestrel', 'Noirval', 'Grisemarche',
  ],
};

export const NAME_CULTURES: Record<string, NameCulture> = {
  goblin: {
    style: 'syllables',
    starts: ['Sn', 'Gr', 'Sk', 'Z', 'Kr', 'N', 'Gl', 'Sp', 'R', 'Bl', 'W', 'Fl', 'Dr', 'Sl', 'Gn', 'Pr', 'Squ', 'Kn', 'Ch', 'T'],
    middles: ['ib', 'ag', 'oz', 'it', 'ek', 'uz', 'ap'],
    ends: ['ik', 'ub', 'ix', 'ot', 'agg', 'izz', 'ug', 'eek', 'ib', 'ax', 'onk', 'it', 'zit', 'ob', 'eep', 'ink', 'ab', 'ret'],
    middleChance: 0.2,
    surnames: ['the Quick', 'Two-Knives', 'Ratbiter', 'the Sly', 'Mudfoot', 'Half-Ear', 'Quickfingers', 'the Lucky', 'Lockpick', 'Nosebiter', 'Toadlicker'],
    surnameChance: 0.2,
  },
  orc: {
    style: 'syllables',
    starts: ['Gr', 'Th', 'Az', 'Mor', 'Ug', 'Dr', 'Gor', 'Kar', 'Bol', 'Nar', 'Sh', 'Ur', 'Zog', 'Kr', 'Grish', 'Lug', 'Mag', 'Brak', 'Og'],
    middles: ['ag', 'um', 'ok', 'ra'],
    ends: ['ak', 'ok', 'ash', 'uk', 'ug', 'goth', 'nak', 'mash', 'dush', 'rak', 'zug', 'gash', 'rug', 'thak', 'bag', 'dak'],
    middleChance: 0.25,
    surnames: ['Skullsplitter', 'Ironjaw', 'Bloodtusk', 'the Red', 'Bonecrusher', 'Blacktooth', 'Gutripper', 'the Scarred', 'Wolfrider', 'Axebiter', 'Stonefist'],
    surnameChance: 0.25,
  },
  troll: {
    style: 'syllables',
    starts: ['Gr', 'Bh', 'Mu', 'Ur', 'Gum', 'Dor', 'Hr', 'Kl', 'Bru', 'Gl', 'Ogg', 'Thr', 'Mog', 'Snor', 'Krum'],
    middles: ['a', 'o'],
    ends: ['ub', 'um', 'oth', 'og', 'uk', 'ung', 'ol', 'ugg', 'unk', 'ab', 'olg', 'urk', 'aff', 'orm'],
    middleChance: 0.15,
    surnames: ['Rockgut', 'the Stinking', 'Mosshide', 'Boulderfist', 'the Hungry', 'Bridgekeeper', 'the Slow', 'Toadbelly', 'Mudwallow', 'the Unwashed'],
    surnameChance: 0.2,
  },
  elf: {
    style: 'syllables',
    starts: ['Ae', 'Ela', 'Fae', 'Ith', 'Lae', 'Sil', 'Tha', 'Ny', 'Cae', 'Mir', 'Aru', 'Ely', 'Gal', 'Ser', 'Lir', 'Ara', 'Ere', 'Nim', 'Tir', 'Vae'],
    middles: ['ra', 'li', 'tha', 'ven', 'ri', 'do', 'nu'],
    ends: ['wen', 'rion', 'thil', 'las', 'nor', 'riel', 'dor', 'vyn', 'iel', 'mar', 'sil', 'ion', 'wyn', 'eth', 'andir', 'ael', 'ith'],
    middleChance: 0.45,
    surnames: ['Leafwhisper', 'of the Glade', 'Moonbow', 'Starbough', 'Silverleaf', 'Dawnsinger', 'of the Silver Wood', 'Windrunner', 'Swiftarrow', 'Thornheart'],
    surnameChance: 0.3,
  },
  golem: {
    style: 'compound',
    starts: ['Granite', 'Basalt', 'Iron', 'Flint', 'Marble', 'Slate', 'Obsidian', 'Cobble', 'Quartz', 'Boulder', 'Bronze', 'Clay', 'Jade', 'Onyx', 'Cinder', 'Rubble', 'Grave', 'Rune', 'Steel'],
    ends: ['heart', 'fist', 'warden', 'wall', 'brow', 'shoulder', 'keeper', 'mound', 'foot', 'guard', 'back', 'jaw', 'hammer', 'crag', 'bulwark'],
    surnames: ['the Unmoving', 'the Ancient', 'of the Forge', 'Gatebreaker', 'the Silent'],
    surnameChance: 0.15,
  },
  dragon: {
    style: 'syllables',
    starts: ['Vy', 'Ska', 'Ign', 'Tha', 'Ora', 'Mal', 'Kry', 'Zar', 'Bal', 'Sar', 'Aur', 'Nith', 'Draz', 'Ve', 'Tiam', 'Sy', 'Xyr', 'Kal'],
    middles: ['ra', 'tho', 'gar', 'vex', 'ul', 'ma', 'ri', 'sa'],
    ends: ['thax', 'gorn', 'vyr', 'rax', 'mir', 'drax', 'thys', 'ion', 'zor', 'gar', 'oth', 'ira', 'yx', 'vorn'],
    middleChance: 0.7,
    surnames: ['the Ember', 'Ashwing', 'the Undying', 'Cinderjaw', 'the Golden', 'Skyrender', 'the Black', 'Worldburner', 'of the Old Peaks', 'Goldhoarder'],
    surnameChance: 0.4,
  },
  minotaur: {
    style: 'syllables',
    starts: ['Ast', 'Kor', 'Tav', 'Bro', 'Mel', 'Ther', 'Dak', 'Hor', 'Ste', 'Ar', 'Lyk', 'Pel', 'Dem', 'Kal', 'Bry', 'Xan'],
    middles: ['er', 'i', 'o'],
    ends: ['ion', 'os', 'ax', 'eus', 'oros', 'ar', 'urn', 'on', 'ides', 'ikos', 'as', 'or'],
    middleChance: 0.35,
    surnames: ['Hornbreaker', 'the Bull', 'of the Maze', 'Hoofthunder', 'the Unbroken', 'Axehorn', 'of the Red Arena', 'Stampede'],
    surnameChance: 0.25,
  },
  /** Winged beasts and hybrids (griffin, harpy, wyvern, roc, chimera…). */
  beast: {
    style: 'compound',
    starts: ['Storm', 'Swift', 'Gold', 'Razor', 'Grey', 'Sky', 'Shriek', 'Night', 'Sun', 'Gale', 'Venom', 'Ash', 'Thunder', 'Cloud', 'Blood', 'Iron', 'Wind', 'Frost', 'Ember', 'Dusk', 'Cliff', 'Bright'],
    ends: ['wing', 'claw', 'feather', 'talon', 'eye', 'tail', 'crest', 'beak', 'fang', 'cry', 'pinion', 'plume', 'flight', 'sting', 'mane', 'hide', 'hunter'],
    surnames: ['of the High Crags', 'the Swooping', 'Cloudpiercer', 'the Untamed', 'Stormrider'],
    surnameChance: 0.15,
  },
  /** Wolves, hounds, hyenas, werebeasts, wendigo. */
  wild: {
    style: 'syllables',
    starts: ['Fen', 'Ulv', 'Gar', 'Var', 'Skol', 'Hra', 'Bry', 'Grau', 'Lok', 'Ruk', 'Vul', 'Wa', 'Ske', 'Ama', 'Tor', 'Kha'],
    middles: ['ra', 'ga', 'ul'],
    ends: ['rik', 'ar', 'mur', 'gul', 'ka', 'rok', 'nar', 'vor', 'ash', 'ok', 'ri', 'gan'],
    middleChance: 0.25,
    surnames: ['Moonhowler', 'the Grey', 'Bloodpaw', 'of the Black Pines', 'Bonegnawer', 'the Ravenous', 'Longtooth', 'Packbreaker'],
    surnameChance: 0.3,
  },
  /** Raptors and salamanders. */
  saurian: {
    style: 'syllables',
    starts: ['Tz', 'Ks', 'Rak', 'Xi', 'Ssz', 'Kli', 'Ta', 'Zek', 'Ix', 'Chal'],
    middles: ['ak', 'i', 'ss'],
    ends: ['ak', 'ith', 'ka', 'ix', 'esh', 'ra', 'ok', 'tli'],
    middleChance: 0.3,
    surnames: ['Quickclaw', 'the Scaled', 'Sunbasker', 'Emberscale', 'Sandrunner'],
    surnameChance: 0.25,
  },
  shade: {
    style: 'syllables',
    starts: ['Mor', 'Vel', 'Sha', 'Nyx', 'Esh', 'Wra', 'Ul', 'Sev', 'Ky', 'Ash', 'Ora', 'Vael', 'Ilm', 'Zeph'],
    middles: ['ae', 'en', 'is', 'ul'],
    ends: ['eth', 'ith', 'oth', 'ael', 'esh', 'ys', 'ora', 'un', 'iel', 'yr', 'ane', 'ost', 'ura'],
    middleChance: 0.4,
    surnames: ['the Whisper', 'of Hollow Graves', 'the Pale', 'Who Was Forgotten', 'the Hungering', 'the Lost', 'Gravewalker', 'of the Empty Hour', 'Who Weeps'],
    surnameChance: 0.35,
  },
  treant: {
    style: 'compound',
    starts: ['Old', 'Moss', 'Oak', 'Thorn', 'Elder', 'Root', 'Bark', 'Ash', 'Yew', 'Deep', 'Willow', 'Birch', 'Fern', 'Briar', 'Hazel', 'Alder', 'Lichen', 'Gnarl'],
    ends: ['bark', 'root', 'bough', 'limb', 'grove', 'wood', 'heart', 'beard', 'stump', 'leaf', 'branch', 'knot', 'thorn', 'shade'],
    surnames: ['the Patient', 'of the Old Wood', 'Who Remembers', 'the Gnarled'],
    surnameChance: 0.15,
  },
  naga: {
    style: 'syllables',
    starts: ['Sss', 'Ish', 'Nas', 'Val', 'Sez', 'Thi', 'Ze', 'Hiss', 'Ny', 'Sha', 'Mes', 'Aza', 'Iss', 'Sar'],
    middles: ['ar', 'ess', 'iri', 'a'],
    ends: ['ra', 'ssa', 'ith', 'esh', 'ari', 'ylla', 'ssk', 'iss', 'ira', 'asha', 'yss'],
    middleChance: 0.5,
    surnames: ['of the Deep', 'Pearlscale', 'Tidecaller', 'the Coiled', 'Venomtongue', 'of the Sunken Temple', 'Thousand-Gleams'],
    surnameChance: 0.3,
  },
  lich: {
    style: 'syllables',
    starts: ['Vor', 'Mal', 'Kel', 'Zar', 'Ner', 'Aza', 'Mor', 'Xe', 'Ith', 'Kor', 'Sar', 'Vex', 'Dra', 'Um'],
    middles: ['ath', 'ul', 'ek', 'ir'],
    ends: ['thas', 'gul', 'oth', 'rak', 'zul', 'mos', 'ion', 'ar', 'eth', 'kul', 'ras'],
    middleChance: 0.5,
    surnames: ['the Undying', 'Bonelord', 'of the Last Crypt', 'the Hollow King', 'Soulbinder', 'the Withered', 'of the Black Tome', 'Graveborn'],
    surnameChance: 0.4,
  },
  deep: {
    style: 'syllables',
    starts: ['Kra', 'Thul', 'Gol', 'Vor', 'Nau', 'Sk', 'Bru', 'Ul', 'Dag', 'Tha', 'Kel', 'Zho', 'Mur'],
    middles: ['a', 'oo', 'u'],
    ends: ['ken', 'gath', 'ul', 'oth', 'mor', 'th', 'lu', 'ath', 'ug', 'ra', 'oon'],
    middleChance: 0.3,
    surnames: ['of the Abyss', 'Shipbreaker', 'the Drowned', 'Tidewrath', 'the Bloated', 'of the Black Trench', 'Coralmaw'],
    surnameChance: 0.35,
  },
  phoenix: {
    style: 'syllables',
    starts: ['Ae', 'Pyr', 'Sol', 'Ign', 'Hel', 'Ca', 'Ra', 'Fla', 'Ori', 'Lu', 'Sor', 'Ky', 'Ama'],
    middles: ['li', 'ra', 'e'],
    ends: ['ios', 'ara', 'yx', 'ena', 'ion', 'is', 'el', 'ora', 'ys', 'ix', 'ova'],
    middleChance: 0.4,
    surnames: ['Ashborn', 'of the Dawn', 'Who Rises Again', 'Flamewing', 'the Radiant', 'Embersong'],
    surnameChance: 0.35,
  },
  djinn: {
    style: 'syllables',
    starts: ['Ifr', 'Zah', 'Mar', 'Shai', 'Kas', 'Aza', 'Jal', 'Nar', 'Sul', 'Haz', 'Ra', 'Bah', 'Tar', 'Yas'],
    middles: ['a', 'i', 'ar'],
    ends: ['it', 'ar', 'im', 'eem', 'ad', 'ul', 'ir', 'an', 'iz', 'ah', 'oun'],
    middleChance: 0.4,
    surnames: ['of the Brass City', 'Wishgranter', 'the Smokeless', 'Stormborn', 'of the Seven Winds', 'the Bound', 'Sandwhirl'],
    surnameChance: 0.35,
  },
  centaur: {
    style: 'syllables',
    starts: ['Chi', 'Ner', 'Pho', 'Eur', 'Kyl', 'Ast', 'Hyl', 'Arg', 'Thal', 'Dex', 'Pel', 'Mel', 'Ori'],
    middles: ['ro', 'e', 'i'],
    ends: ['on', 'us', 'os', 'ion', 'eus', 'ax', 'ar', 'ias', 'ides', 'or'],
    middleChance: 0.4,
    surnames: ['Swifthoof', 'of the Plains', 'the Archer', 'Longbow', 'the Wanderer', 'Stormmane'],
    surnameChance: 0.3,
  },
  vermin: {
    style: 'syllables',
    starts: ['Skr', 'Tik', 'Ksh', 'Zz', 'Chit', 'Vrr', 'Sik', 'Akh', 'Kx', 'Thrr', 'Ixa', 'Shk', 'Zak', 'Nik'],
    middles: ['i', 'a', 'ix'],
    ends: ['ik', 'ash', 'itt', 'ex', 'akk', 'ith', 'ra', 'ix', 'ur', 'eek', 'ssa'],
    middleChance: 0.35,
    surnames: ['Eight-Eyes', 'the Weaver', 'Dunestinger', 'Silkfang', 'Manylegs', 'the Hollow', 'Venomsac', 'Chitter'],
    surnameChance: 0.3,
  },
  giant: {
    style: 'syllables',
    starts: ['Ym', 'Thr', 'Hrim', 'Skad', 'Bor', 'Jot', 'Ulf', 'Gry', 'Hal', 'Ragn', 'Snae', 'Gunn', 'Vid', 'Eik'],
    middles: ['ir', 'a', 'un'],
    ends: ['ir', 'mund', 'gar', 'vald', 'nir', 'ulf', 'dor', 'helm', 'grim', 'bjorn', 'ald'],
    middleChance: 0.3,
    surnames: ['Icebeard', 'of the Glacier', 'Frostborn', 'the Mountain', 'Stonethrower', 'the Old', 'Cloudbreaker', 'of the North'],
    surnameChance: 0.35,
  },
  hag: {
    style: 'syllables',
    starts: ['Gra', 'Mag', 'Ug', 'Bel', 'Morr', 'Hex', 'Agg', 'Nan', 'Gris', 'Wort', 'Lil', 'Scab', 'Ott', 'Bab'],
    middles: ['ga', 'il', 'ro'],
    ends: ['da', 'ethe', 'wyn', 'ra', 'gul', 'mora', 'nys', 'ilda', 'ett', 'ga'],
    middleChance: 0.35,
    surnames: ['Mother Bog', 'the Crooked', 'Toadkisser', 'of the Fen', 'Granny Nettle', 'the Toothless', 'Gravedigger', 'of the Crooked House'],
    surnameChance: 0.45,
  },
  vampire: {
    style: 'syllables',
    starts: ['Vlad', 'Cas', 'Ser', 'Mir', 'Lucr', 'Drav', 'Ist', 'Elis', 'Ana', 'Kat', 'Vik', 'Ras', 'Mor', 'Lad'],
    middles: ['i', 'e', 'an'],
    ends: ['imir', 'ena', 'ius', 'ova', 'an', 'eska', 'or', 'ilda', 'islav', 'etta', 'ov', 'ine'],
    middleChance: 0.35,
    surnames: ['the Count', 'of the Black Keep', 'Nightblood', 'the Thirsting', 'of Crimson Hall', 'Bloodrose', 'the Ageless', 'Duskveil'],
    surnameChance: 0.5,
  },
  demon: {
    style: 'syllables',
    starts: ['Baal', 'Mal', 'Azg', 'Bel', 'Xar', 'Mol', 'Gor', 'Ash', 'Zag', 'Abr', 'Raz', 'Thul', 'Mam', 'Vhe'],
    middles: ['ag', 'ze', 'or'],
    ends: ['oth', 'zar', 'ial', 'goth', 'ek', 'phas', 'ul', 'ax', 'orr', 'ath', 'mon', 'ros'],
    middleChance: 0.4,
    surnames: ['the Bloodbound', 'of the Ninth Pit', 'Ashmaw', 'the Unbowed', 'Hellspawn', 'the Burning', 'Soulreaver', 'the Many-Horned'],
    surnameChance: 0.4,
  },
  seraph: {
    style: 'syllables',
    starts: ['Ari', 'Cel', 'Ura', 'Seph', 'Lum', 'Ael', 'Ith', 'Zad', 'Gab', 'Rhae', 'Oph', 'Sar', 'Eli', 'Han'],
    middles: ['i', 'a', 'el'],
    ends: ['iel', 'ael', 'ion', 'ara', 'iah', 'ys', 'ira', 'on', 'el'],
    middleChance: 0.35,
    surnames: ['of the Seventh Light', 'Dawnwing', 'the Merciful', 'Who Gives', 'Lightbearer', 'of the Choir', 'the Watchful'],
    surnameChance: 0.4,
  },
};
