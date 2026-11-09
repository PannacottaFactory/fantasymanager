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

export const TEAM_NAME_PARTS = {
  adjectives: ['Iron', 'Crimson', 'Howling', 'Black', 'Ashen', 'Gilded', 'Rotting', 'Thundering', 'Silent', 'Burning', 'Frozen', 'Wild', 'Grim', 'Sunken'],
  nouns: ['Fangs', 'Wardens', 'Maws', 'Talons', 'Brutes', 'Sentinels', 'Ravagers', 'Hounds', 'Claws', 'Reavers', 'Horns', 'Serpents', 'Wyrms', 'Stalkers'],
  places: ['Duskmoor', 'Karak Varn', 'the Mire', 'Emberfall', 'Greyhaven', 'the Hollow Peaks', 'Saltmarsh', 'Thornwood', 'Old Brannoc', 'Skarn'],
};

export const NAME_CULTURES: Record<string, NameCulture> = {
  goblin: {
    style: 'syllables',
    starts: ['Sn', 'Gr', 'Sk', 'Z', 'Kr', 'N', 'Gl', 'Sp', 'R', 'Bl', 'W', 'Fl'],
    middles: ['ib', 'ag', 'oz', 'it', 'ek'],
    ends: ['ik', 'ub', 'ix', 'ot', 'agg', 'izz', 'ug', 'eek', 'ib', 'ax', 'onk', 'it'],
    middleChance: 0.2,
    surnames: ['the Quick', 'Two-Knives', 'Ratbiter', 'the Sly', 'Mudfoot', 'Half-Ear'],
    surnameChance: 0.15,
  },
  orc: {
    style: 'syllables',
    starts: ['Gr', 'Th', 'Az', 'Mor', 'Ug', 'Dr', 'Gor', 'Kar', 'Bol', 'Nar', 'Sh', 'Ur'],
    middles: ['ag', 'um', 'ok', 'ra'],
    ends: ['ak', 'ok', 'ash', 'uk', 'ug', 'goth', 'nak', 'mash', 'dush', 'rak', 'zug'],
    middleChance: 0.25,
    surnames: ['Skullsplitter', 'Ironjaw', 'Bloodtusk', 'the Red', 'Bonecrusher', 'Blacktooth'],
    surnameChance: 0.2,
  },
  troll: {
    style: 'syllables',
    starts: ['Gr', 'Bh', 'Mu', 'Ur', 'Gum', 'Dor', 'Hr', 'Kl', 'Bru'],
    ends: ['ub', 'um', 'oth', 'og', 'uk', 'ung', 'ol', 'ugg', 'unk'],
    surnames: ['Rockgut', 'the Stinking', 'Mosshide', 'Boulderfist', 'the Hungry'],
    surnameChance: 0.15,
  },
  elf: {
    style: 'syllables',
    starts: ['Ae', 'Ela', 'Fae', 'Ith', 'Lae', 'Sil', 'Tha', 'Ny', 'Cae', 'Mir', 'Aru', 'Ely'],
    middles: ['ra', 'li', 'tha', 'ven', 'ri', 'do'],
    ends: ['wen', 'rion', 'thil', 'las', 'nor', 'riel', 'dor', 'vyn', 'iel', 'mar', 'sil'],
    middleChance: 0.45,
    surnames: ['Leafwhisper', 'of the Glade', 'Moonbow', 'Starbough', 'Silverleaf'],
    surnameChance: 0.25,
  },
  golem: {
    style: 'compound',
    starts: ['Granite', 'Basalt', 'Iron', 'Flint', 'Marble', 'Slate', 'Obsidian', 'Cobble', 'Quartz', 'Boulder'],
    ends: ['heart', 'fist', 'warden', 'wall', 'brow', 'shoulder', 'keeper', 'mound', 'foot'],
  },
  dragon: {
    style: 'syllables',
    starts: ['Vy', 'Ska', 'Ign', 'Tha', 'Ora', 'Mal', 'Kry', 'Zar', 'Bal', 'Sar'],
    middles: ['ra', 'tho', 'gar', 'vex', 'ul', 'ma'],
    ends: ['thax', 'gorn', 'vyr', 'rax', 'mir', 'drax', 'thys', 'ion', 'zor'],
    middleChance: 0.7,
    surnames: ['the Ember', 'Ashwing', 'the Undying', 'Cinderjaw', 'the Golden'],
    surnameChance: 0.35,
  },
  minotaur: {
    style: 'syllables',
    starts: ['Ast', 'Kor', 'Tav', 'Bro', 'Mel', 'Ther', 'Dak', 'Hor', 'Ste'],
    middles: ['er', 'i', 'o'],
    ends: ['ion', 'os', 'ax', 'eus', 'oros', 'ar', 'urn'],
    middleChance: 0.35,
    surnames: ['Hornbreaker', 'the Bull', 'of the Maze', 'Hoofthunder'],
    surnameChance: 0.2,
  },
  beast: {
    style: 'compound',
    starts: ['Storm', 'Swift', 'Gold', 'Razor', 'Grey', 'Sky', 'Shriek', 'Night', 'Sun', 'Gale', 'Venom', 'Ash'],
    ends: ['wing', 'claw', 'feather', 'talon', 'eye', 'tail', 'crest', 'beak', 'fang', 'cry'],
  },
  shade: {
    style: 'syllables',
    starts: ['Mor', 'Vel', 'Sha', 'Nyx', 'Esh', 'Wra', 'Ul', 'Sev'],
    middles: ['ae', 'en', 'is', 'ul'],
    ends: ['eth', 'ith', 'oth', 'ael', 'esh', 'ys', 'ora', 'un'],
    middleChance: 0.4,
    surnames: ['the Whisper', 'of Hollow Graves', 'the Pale', 'Who Was Forgotten', 'the Hungering'],
    surnameChance: 0.3,
  },
  treant: {
    style: 'compound',
    starts: ['Old', 'Moss', 'Oak', 'Thorn', 'Elder', 'Root', 'Bark', 'Ash', 'Yew', 'Deep'],
    ends: ['bark', 'root', 'bough', 'limb', 'grove', 'wood', 'heart', 'beard', 'stump'],
  },
  naga: {
    style: 'syllables',
    starts: ['Sss', 'Ish', 'Nas', 'Val', 'Sez', 'Thi', 'Ze', 'Hiss', 'Ny'],
    middles: ['ar', 'ess', 'iri', 'a'],
    ends: ['ra', 'ssa', 'ith', 'esh', 'ari', 'ylla', 'ssk', 'iss'],
    middleChance: 0.5,
    surnames: ['of the Deep', 'Pearlscale', 'Tidecaller', 'the Coiled'],
    surnameChance: 0.25,
  },
  lich: {
    style: 'syllables',
    starts: ['Vor', 'Mal', 'Kel', 'Zar', 'Ner', 'Aza', 'Mor', 'Xe'],
    middles: ['ath', 'ul', 'ek', 'ir'],
    ends: ['thas', 'gul', 'oth', 'rak', 'zul', 'mos', 'ion'],
    middleChance: 0.5,
    surnames: ['the Undying', 'Bonelord', 'of the Last Crypt', 'the Hollow King'],
    surnameChance: 0.4,
  },
  deep: {
    style: 'syllables',
    starts: ['Kra', 'Thul', 'Gol', 'Vor', 'Nau', 'Sk', 'Bru'],
    middles: ['a', 'oo', 'u'],
    ends: ['ken', 'gath', 'ul', 'oth', 'mor', 'th', 'lu'],
    middleChance: 0.3,
    surnames: ['of the Abyss', 'Shipbreaker', 'the Drowned'],
    surnameChance: 0.3,
  },
  phoenix: {
    style: 'syllables',
    starts: ['Ae', 'Pyr', 'Sol', 'Ign', 'Hel', 'Ca', 'Ra'],
    middles: ['li', 'ra', 'e'],
    ends: ['ios', 'ara', 'yx', 'ena', 'ion', 'is'],
    middleChance: 0.4,
    surnames: ['Ashborn', 'of the Dawn', 'Who Rises Again'],
    surnameChance: 0.35,
  },
  djinn: {
    style: 'syllables',
    starts: ['Ifr', 'Zah', 'Mar', 'Shai', 'Kas', 'Aza', 'Jal'],
    middles: ['a', 'i', 'ar'],
    ends: ['it', 'ar', 'im', 'eem', 'ad', 'ul'],
    middleChance: 0.4,
    surnames: ['of the Brass City', 'Wishgranter', 'the Smokeless'],
    surnameChance: 0.3,
  },
  centaur: {
    style: 'syllables',
    starts: ['Chi', 'Ner', 'Pho', 'Eur', 'Kyl', 'Ast', 'Hyl'],
    middles: ['ro', 'e', 'i'],
    ends: ['on', 'us', 'os', 'ion', 'eus', 'ax'],
    middleChance: 0.4,
    surnames: ['Swifthoof', 'of the Plains', 'the Archer'],
    surnameChance: 0.25,
  },
};
