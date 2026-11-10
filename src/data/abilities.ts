import type { AbilityDef } from './schema.ts';

const list: AbilityDef[] = [
  // ——— Goblin ———
  { id: 'stab', name: 'Rusty Stab', kind: 'melee', element: 'physical', target: 'enemy', power: 13, staminaCost: 5, cooldown: 0, critMod: 0.05, verb: 'stabs at', description: 'Quick jab looking for a weak spot.' },
  { id: 'sling', name: 'Sling Stone', kind: 'ranged', element: 'physical', target: 'enemy', power: 10, staminaCost: 4, cooldown: 0, verb: 'slings a stone at', description: 'Pebble to the head. Works more often than it should.' },
  { id: 'dirty-trick', name: 'Dirty Trick', kind: 'melee', element: 'physical', target: 'enemy', power: 6, staminaCost: 6, cooldown: 3, accuracyMod: 0.1, verb: 'throws sand in the eyes of', description: 'Sand, kicks, bites — whatever weakens the foe.', effects: [{ effect: 'weakened', chance: 0.75, on: 'target' }] },
  { id: 'scurry', name: 'Scurry', kind: 'buff', element: 'physical', target: 'self', power: 0, staminaCost: 4, cooldown: 4, verb: 'scurries away from', description: 'Darts around, becoming hard to hit.', effects: [{ effect: 'evasive', chance: 1, on: 'self' }] },

  // ——— Orc ———
  { id: 'axe-swing', name: 'Axe Swing', kind: 'melee', element: 'physical', target: 'enemy', power: 16, staminaCost: 7, cooldown: 0, verb: 'swings an axe at', description: 'Brutal overhead swing.' },
  { id: 'cleave', name: 'Cleave', kind: 'melee', element: 'physical', target: 'enemyFront', power: 12, staminaCost: 13, cooldown: 3, verb: 'cleaves through', description: 'Wide arc hitting the whole enemy front line.' },
  { id: 'war-cry', name: 'War Cry', kind: 'buff', element: 'physical', target: 'allAllies', power: 0, staminaCost: 10, cooldown: 5, verb: 'bellows a war cry', description: 'Rallies every ally on the field.', effects: [{ effect: 'rallied', chance: 1, on: 'target' }] },

  // ——— Troll ———
  { id: 'club-smash', name: 'Club Smash', kind: 'melee', element: 'physical', target: 'enemy', power: 18, staminaCost: 8, cooldown: 0, accuracyMod: -0.04, verb: 'smashes a club into', description: 'A tree trunk used as a club.' },
  { id: 'crushing-blow', name: 'Crushing Blow', kind: 'melee', element: 'earth', target: 'enemy', power: 27, staminaCost: 16, cooldown: 3, accuracyMod: -0.1, verb: 'brings a crushing blow down on', description: 'Slow, devastating, may stun.', effects: [{ effect: 'stunned', chance: 0.35, on: 'target' }] },

  // ——— Elf ———
  { id: 'longbow', name: 'Longbow', kind: 'ranged', element: 'physical', target: 'enemy', power: 14, staminaCost: 5, cooldown: 0, accuracyMod: 0.05, verb: 'looses an arrow at', description: 'Elegant and deadly.' },
  { id: 'aimed-shot', name: 'Aimed Shot', kind: 'ranged', element: 'physical', target: 'enemy', power: 23, staminaCost: 12, cooldown: 3, critMod: 0.1, verb: 'takes careful aim at', description: 'Patient shot at a vital spot.' },
  { id: 'moonbeam', name: 'Moonbeam', kind: 'spell', element: 'light', target: 'enemy', power: 15, staminaCost: 8, cooldown: 1, verb: 'calls a moonbeam down on', description: 'Pale searing light.' },
  { id: 'healing-song', name: 'Healing Song', kind: 'heal', element: 'nature', target: 'ally', power: 20, staminaCost: 10, cooldown: 2, verb: 'sings a healing song for', description: 'Mends the wounds of an ally.' },

  // ——— Golem ———
  { id: 'stone-fist', name: 'Stone Fist', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'pounds', description: 'A fist of solid rock.' },
  { id: 'seismic-slam', name: 'Seismic Slam', kind: 'melee', element: 'earth', target: 'enemyFront', power: 12, staminaCost: 14, cooldown: 3, verb: 'slams the ground, shaking', description: 'Shockwave through the enemy front line.', effects: [{ effect: 'slowed', chance: 0.5, on: 'target' }] },
  { id: 'stone-skin', name: 'Stone Skin', kind: 'buff', element: 'earth', target: 'self', power: 0, staminaCost: 6, cooldown: 4, verb: 'hardens its stone skin', description: 'Takes much less damage for a while.', effects: [{ effect: 'fortified', chance: 1, on: 'self', duration: 3 }] },

  // ——— Wyvern ———
  { id: 'talons', name: 'Talons', kind: 'melee', element: 'physical', target: 'enemy', power: 14, staminaCost: 6, cooldown: 0, verb: 'rakes its talons across', description: 'Hooked claws.' },
  { id: 'venom-sting', name: 'Venom Sting', kind: 'melee', element: 'nature', target: 'enemy', power: 10, staminaCost: 8, cooldown: 2, verb: 'drives its venomous tail into', description: 'Poisoned barb.', effects: [{ effect: 'poisoned', chance: 0.85, on: 'target' }] },
  { id: 'dive', name: 'Dive', kind: 'melee', element: 'air', target: 'enemy', power: 19, staminaCost: 12, cooldown: 2, reachBack: true, verb: 'dives out of the sky onto', description: 'Plunges onto any target, even in the back line.' },

  // ——— Dragon ———
  { id: 'rend', name: 'Rend', kind: 'melee', element: 'physical', target: 'enemy', power: 19, staminaCost: 8, cooldown: 0, verb: 'rends', description: 'Claws like swords.' },
  { id: 'fire-breath', name: 'Fire Breath', kind: 'spell', element: 'fire', target: 'allEnemies', power: 14, staminaCost: 22, cooldown: 4, verb: 'breathes a torrent of fire over', description: 'Engulfs the whole enemy team.', effects: [{ effect: 'burning', chance: 0.4, on: 'target' }] },
  { id: 'tail-sweep', name: 'Tail Sweep', kind: 'melee', element: 'physical', target: 'enemyFront', power: 13, staminaCost: 12, cooldown: 3, verb: 'sweeps its tail through', description: 'Knocks the front line about.', effects: [{ effect: 'slowed', chance: 0.35, on: 'target' }] },
  { id: 'terrifying-roar', name: 'Terrifying Roar', kind: 'debuff', element: 'physical', target: 'allEnemies', power: 0, staminaCost: 10, cooldown: 5, fear: 14, verb: 'unleashes a terrifying roar at', description: 'Shakes the courage of every foe.', effects: [{ effect: 'terrified', chance: 0.4, on: 'target' }] },

  // ——— Minotaur ———
  { id: 'horn-gore', name: 'Horn Gore', kind: 'melee', element: 'physical', target: 'enemy', power: 18, staminaCost: 8, cooldown: 0, verb: 'gores', description: 'Horns first.', effects: [{ effect: 'bleeding', chance: 0.3, on: 'target' }] },
  { id: 'bull-charge', name: 'Bull Charge', kind: 'melee', element: 'physical', target: 'enemy', power: 24, staminaCost: 15, cooldown: 3, reachBack: true, accuracyMod: -0.05, verb: 'charges headlong into', description: 'Bulldozes through the lines to any target.', effects: [{ effect: 'exposed', chance: 0.5, on: 'target' }] },
  { id: 'rampage', name: 'Rampage', kind: 'buff', element: 'physical', target: 'self', power: 0, staminaCost: 6, cooldown: 6, verb: 'snorts and works itself into a rampage', description: 'Deliberately enrages itself.', effects: [{ effect: 'enraged', chance: 1, on: 'self' }] },

  // ——— Harpy ———
  { id: 'rake', name: 'Rake', kind: 'melee', element: 'physical', target: 'enemy', power: 13, staminaCost: 5, cooldown: 0, verb: 'rakes at', description: 'Swift slashing pass.', effects: [{ effect: 'bleeding', chance: 0.2, on: 'target' }] },
  { id: 'screech', name: 'Screech', kind: 'debuff', element: 'air', target: 'allEnemies', power: 0, staminaCost: 10, cooldown: 4, fear: 6, verb: 'lets out a piercing screech at', description: 'Deafening cry that slows every foe.', effects: [{ effect: 'slowed', chance: 0.5, on: 'target' }] },

  // ——— Shade ———
  { id: 'chill-touch', name: 'Chill Touch', kind: 'melee', element: 'shadow', target: 'enemy', power: 11, staminaCost: 5, cooldown: 0, verb: 'lays a chilling hand on', description: 'Cold that seeps into the soul.' },
  { id: 'shadow-bolt', name: 'Shadow Bolt', kind: 'spell', element: 'shadow', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'hurls a shadow bolt at', description: 'Darkness given force.' },
  { id: 'life-drain', name: 'Life Drain', kind: 'spell', element: 'shadow', target: 'enemy', power: 13, staminaCost: 10, cooldown: 2, lifesteal: 0.6, verb: 'drains the life from', description: 'Steals vitality from the target.' },
  { id: 'dread', name: 'Dread', kind: 'debuff', element: 'shadow', target: 'enemy', power: 0, staminaCost: 8, cooldown: 3, fear: 18, verb: 'fills the mind of', description: 'Whispers of doom that crush morale.', effects: [{ effect: 'terrified', chance: 0.9, on: 'target' }] },

  // ——— Treant ———
  { id: 'branch-slam', name: 'Branch Slam', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 8, cooldown: 0, verb: 'slams a massive branch into', description: 'Like being hit by a forest.' },
  { id: 'entangle', name: 'Entangle', kind: 'debuff', element: 'nature', target: 'enemy', power: 6, staminaCost: 9, cooldown: 3, verb: 'sends roots to entangle', description: 'Roots burst from the sand to bind a foe.', effects: [{ effect: 'slowed', chance: 0.9, on: 'target' }, { effect: 'stunned', chance: 0.3, on: 'target' }] },
  { id: 'barkskin', name: 'Barkskin', kind: 'buff', element: 'nature', target: 'ally', power: 0, staminaCost: 10, cooldown: 3, verb: 'wraps protective bark around', description: 'Shields an ally.', effects: [{ effect: 'shielded', chance: 1, on: 'target' }] },
  { id: 'sap-mend', name: 'Sap Mend', kind: 'heal', element: 'nature', target: 'ally', power: 14, staminaCost: 10, cooldown: 3, verb: 'seals the wounds of', description: 'Healing sap that keeps working.', effects: [{ effect: 'regenerating', chance: 1, on: 'target' }] },

  // ——— Naga ———
  { id: 'trident', name: 'Trident Thrust', kind: 'melee', element: 'physical', target: 'enemy', power: 14, staminaCost: 6, cooldown: 0, verb: 'thrusts a trident at', description: 'Three points of pain.' },
  { id: 'tidal-lash', name: 'Tidal Lash', kind: 'spell', element: 'water', target: 'enemy', power: 16, staminaCost: 8, cooldown: 0, verb: 'whips a lash of water at', description: 'Pressurized brine.' },
  { id: 'constrict', name: 'Constrict', kind: 'melee', element: 'physical', target: 'enemy', power: 9, staminaCost: 10, cooldown: 3, verb: 'coils around', description: 'Squeezes the target into helplessness.', effects: [{ effect: 'stunned', chance: 0.5, on: 'target' }] },
  { id: 'healing-waters', name: 'Healing Waters', kind: 'heal', element: 'water', target: 'allAllies', power: 9, staminaCost: 14, cooldown: 4, verb: 'washes healing waters over', description: 'Heals every ally a little.' },

  // ——— Griffin ———
  { id: 'beak-and-claw', name: 'Beak and Claw', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 6, cooldown: 0, verb: 'tears into', description: 'Eagle and lion at once.' },
  { id: 'radiant-dive', name: 'Radiant Dive', kind: 'melee', element: 'light', target: 'enemy', power: 20, staminaCost: 12, cooldown: 2, reachBack: true, verb: 'dives in a blaze of light onto', description: 'A shining plunge on any target.' },
  { id: 'sky-cry', name: 'Sky Cry', kind: 'buff', element: 'light', target: 'allAllies', power: 0, staminaCost: 9, cooldown: 5, verb: 'lets out a proud cry', description: 'Inspires allies.', effects: [{ effect: 'rallied', chance: 0.7, on: 'target' }] },

  // ——— Lich ———
  { id: 'necrotic-bolt', name: 'Necrotic Bolt', kind: 'spell', element: 'shadow', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'hurls a necrotic bolt at', description: 'Death shaped into a missile.' },
  { id: 'withering-curse', name: 'Withering Curse', kind: 'debuff', element: 'shadow', target: 'enemy', power: 0, staminaCost: 9, cooldown: 3, effects: [{ effect: 'hexed', chance: 0.8, on: 'target' }, { effect: 'frailty', chance: 0.5, on: 'target' }], verb: 'lays a withering curse on', description: 'Curses strength and armour until the next break.' },
  { id: 'soul-harvest', name: 'Soul Harvest', kind: 'spell', element: 'shadow', target: 'allEnemies', power: 9, staminaCost: 18, cooldown: 4, lifesteal: 0.3, fear: 6, verb: 'reaps the souls of', description: 'A scythe of shadow through the whole enemy team.' },
  { id: 'bone-ward', name: 'Bone Ward', kind: 'buff', element: 'shadow', target: 'ally', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'shielded', chance: 1, on: 'target' }], verb: 'raises a ward of bones before', description: 'A rampart of bones shields an ally.' },

  // ——— Kraken ———
  { id: 'tentacle-lash', name: 'Tentacle Lash', kind: 'melee', element: 'water', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'lashes a tentacle at', description: 'A whip of wet muscle.' },
  { id: 'crushing-grip', name: 'Crushing Grip', kind: 'melee', element: 'physical', target: 'enemy', power: 10, staminaCost: 10, cooldown: 3, effects: [{ effect: 'stunned', chance: 0.5, on: 'target' }], verb: 'wraps its tentacles around', description: 'Squeezes until the target cannot move.' },
  { id: 'ink-cloud', name: 'Ink Cloud', kind: 'buff', element: 'water', target: 'allAllies', power: 0, staminaCost: 9, cooldown: 5, effects: [{ effect: 'evasive', chance: 0.8, on: 'target' }], verb: 'clouds the arena with ink', description: 'Black ink hides its whole team.' },
  { id: 'maelstrom', name: 'Maelstrom', kind: 'spell', element: 'water', target: 'enemyFront', power: 13, staminaCost: 16, cooldown: 4, effects: [{ effect: 'slowed', chance: 0.5, on: 'target' }], verb: 'conjures a maelstrom under', description: 'A whirlpool swallows the enemy front line.' },

  // ——— Phoenix ———
  { id: 'ember-talons', name: 'Ember Talons', kind: 'melee', element: 'fire', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, effects: [{ effect: 'burning', chance: 0.3, on: 'target' }], verb: 'sinks burning talons into', description: 'Claws that leave embers behind.' },
  { id: 'flame-burst', name: 'Flame Burst', kind: 'spell', element: 'fire', target: 'enemy', power: 16, staminaCost: 8, cooldown: 0, verb: 'unleashes a burst of flame at', description: 'A sheaf of fire.' },
  { id: 'rebirth-flame', name: 'Flame of Rebirth', kind: 'heal', element: 'fire', target: 'allAllies', power: 10, staminaCost: 16, cooldown: 5, effects: [{ effect: 'regenerating', chance: 0.5, on: 'target' }], verb: 'pours the flame of rebirth over', description: 'Heals every ally, and the flame keeps working.' },
  { id: 'solar-flare', name: 'Solar Flare', kind: 'spell', element: 'light', target: 'allEnemies', power: 8, staminaCost: 16, cooldown: 5, effects: [{ effect: 'exposed', chance: 0.5, on: 'target' }], verb: 'unleashes a solar flare against', description: 'Blinding light that leaves every foe exposed.' },

  // ——— Dryad ———
  { id: 'thorn-whip', name: 'Thorn Whip', kind: 'melee', element: 'nature', target: 'enemy', power: 12, staminaCost: 5, cooldown: 0, effects: [{ effect: 'bleeding', chance: 0.25, on: 'target' }], verb: 'lashes a thorny whip at', description: 'A vine full of thorns.' },
  { id: 'bloom', name: 'Bloom', kind: 'heal', element: 'nature', target: 'ally', power: 22, staminaCost: 9, cooldown: 1, verb: 'makes healing flowers bloom over', description: 'Flowers that close wounds.' },
  { id: 'pollen-cloud', name: 'Pollen Cloud', kind: 'debuff', element: 'nature', target: 'allEnemies', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'slowed', chance: 0.6, on: 'target' }, { effect: 'weakened', chance: 0.3, on: 'target' }], verb: 'releases a cloud of pollen at', description: 'Sneezing, sluggish foes.' },
  { id: 'oak-blessing', name: 'Blessing of the Oaks', kind: 'buff', element: 'nature', target: 'allAllies', power: 0, staminaCost: 10, cooldown: 5, effects: [{ effect: 'fortified', chance: 0.7, on: 'target' }], verb: 'calls down the blessing of the oaks', description: 'Allies grow hard as old wood.' },

  // ——— Basilisk ———
  { id: 'venom-fang', name: 'Venom Fang', kind: 'melee', element: 'nature', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, effects: [{ effect: 'poisoned', chance: 0.6, on: 'target' }], verb: 'sinks venomous fangs into', description: 'A bite that keeps hurting.' },
  { id: 'tail-crush', name: 'Tail Crush', kind: 'melee', element: 'physical', target: 'enemy', power: 18, staminaCost: 10, cooldown: 2, verb: 'brings its tail crashing down on', description: 'A stone-scaled tail like a mace.' },
  { id: 'stone-gaze', name: 'Petrifying Gaze', kind: 'debuff', element: 'earth', target: 'enemy', power: 0, staminaCost: 12, cooldown: 4, fear: 6, effects: [{ effect: 'stunned', chance: 0.6, on: 'target' }], verb: 'fixes its petrifying gaze on', description: 'One look, and limbs turn to stone.' },

  // ——— Djinn ———
  { id: 'wind-blade', name: 'Wind Blade', kind: 'spell', element: 'air', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'sends a blade of wind at', description: 'Air sharp as steel.' },
  { id: 'mirage', name: 'Mirage', kind: 'buff', element: 'air', target: 'self', power: 0, staminaCost: 6, cooldown: 4, effects: [{ effect: 'evasive', chance: 1, on: 'self' }], verb: 'dissolves into a shimmering mirage', description: 'Becomes very hard to hit.' },
  { id: 'whirlwind', name: 'Whirlwind', kind: 'spell', element: 'air', target: 'allEnemies', power: 9, staminaCost: 16, cooldown: 4, effects: [{ effect: 'slowed', chance: 0.4, on: 'target' }], verb: 'raises a whirlwind against', description: 'Sand and wind batter the whole enemy team.' },
  { id: 'granted-wish', name: 'Granted Wish', kind: 'buff', element: 'fire', target: 'ally', power: 0, staminaCost: 10, cooldown: 5, effects: [{ effect: 'enraged', chance: 1, on: 'target' }], verb: 'grants a burning wish to', description: 'An ally is filled with fury.' },

  // ——— Centaur ———
  { id: 'recurve-bow', name: 'Recurve Bow', kind: 'ranged', element: 'physical', target: 'enemy', power: 14, staminaCost: 6, cooldown: 0, accuracyMod: 0.05, verb: 'looses a recurve arrow at', description: 'Shot at full gallop.' },
  { id: 'hoof-strike', name: 'Hoof Strike', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'kicks out at', description: 'Four hooves, one direction.' },
  { id: 'lance-charge', name: 'Lance Charge', kind: 'melee', element: 'physical', target: 'enemy', power: 21, staminaCost: 14, cooldown: 3, reachBack: true, critMod: 0.05, verb: 'gallops lance-first into', description: 'Charges through the lines to any target.' },
  { id: 'trample', name: 'Trample', kind: 'melee', element: 'earth', target: 'enemyFront', power: 11, staminaCost: 13, cooldown: 3, effects: [{ effect: 'slowed', chance: 0.3, on: 'target' }], verb: 'tramples', description: 'Rides over the enemy front line.' },

  // ——— Wendigo ———
  { id: 'frost-claws', name: 'Frost Claws', kind: 'melee', element: 'water', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, effects: [{ effect: 'chilled', chance: 0.3, on: 'target' }], verb: 'rakes frozen claws across', description: 'Claws of ice.' },
  { id: 'ravenous-bite', name: 'Ravenous Bite', kind: 'melee', element: 'shadow', target: 'enemy', power: 14, staminaCost: 9, cooldown: 2, lifesteal: 0.5, verb: 'takes a ravenous bite out of', description: 'Feeds on its prey.' },
  { id: 'chilling-howl', name: 'Chilling Howl', kind: 'debuff', element: 'shadow', target: 'allEnemies', power: 0, staminaCost: 10, cooldown: 5, fear: 12, effects: [{ effect: 'terrified', chance: 0.4, on: 'target' }], verb: 'lets loose a chilling howl at', description: 'A howl from the frozen woods.' },

  // ——— Crystal golem ———
  { id: 'crystal-fist', name: 'Crystal Fist', kind: 'melee', element: 'light', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, verb: 'smashes a crystal fist into', description: 'Hard, sharp and glittering.' },
  { id: 'prism-beam', name: 'Prism Beam', kind: 'spell', element: 'light', target: 'enemy', power: 17, staminaCost: 9, cooldown: 1, accuracyMod: 0.05, verb: 'focuses a prism beam on', description: 'Light gathered into a searing ray.' },
  { id: 'refraction', name: 'Refraction', kind: 'buff', element: 'light', target: 'ally', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'shielded', chance: 1, on: 'target' }], verb: 'raises a refracting shield before', description: 'A crystal shield bends blows away from an ally.' },

  // ——— Salamander ———
  { id: 'quick-bite', name: 'Quick Bite', kind: 'melee', element: 'physical', target: 'enemy', power: 11, staminaCost: 4, cooldown: 0, verb: 'snaps at', description: 'Fast and annoying.' },
  { id: 'fire-spit', name: 'Fire Spit', kind: 'ranged', element: 'fire', target: 'enemy', power: 11, staminaCost: 5, cooldown: 0, effects: [{ effect: 'burning', chance: 0.4, on: 'target' }], verb: 'spits fire at', description: 'A gob of flame.' },
  { id: 'ember-dash', name: 'Ember Dash', kind: 'melee', element: 'fire', target: 'enemy', power: 15, staminaCost: 10, cooldown: 2, reachBack: true, verb: 'darts in a trail of embers at', description: 'Dashes to any target, even in the back line.' },

  // ——— Giant spider ———
  { id: 'spider-bite', name: 'Venomous Bite', kind: 'melee', element: 'nature', target: 'enemy', power: 12, staminaCost: 6, cooldown: 0, effects: [{ effect: 'poisoned', chance: 0.8, on: 'target' }], verb: 'sinks dripping fangs into', description: 'Each bite adds a dose of venom.' },
  { id: 'web', name: 'Web', kind: 'debuff', element: 'nature', target: 'enemy', power: 0, staminaCost: 8, cooldown: 3, accuracyMod: 0.05, effects: [{ effect: 'slowed', chance: 0.9, on: 'target' }, { effect: 'stunned', chance: 0.25, on: 'target' }], verb: 'shoots a sticky web over', description: 'Binds a foe in silk.' },
  { id: 'venom-pounce', name: 'Venom Pounce', kind: 'melee', element: 'nature', target: 'enemy', power: 15, staminaCost: 12, cooldown: 3, reachBack: true, effects: [{ effect: 'poisoned', chance: 0.9, on: 'target', stacks: 2 }], verb: 'drops from above onto', description: 'Leaps on any target, even in the back line, and injects two doses of venom.' },

  // ——— Giant scorpion ———
  { id: 'pincer', name: 'Pincer', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'snaps its pincers on', description: 'A vice of chitin.' },
  { id: 'scorpion-sting', name: 'Deadly Sting', kind: 'melee', element: 'nature', target: 'enemy', power: 12, staminaCost: 9, cooldown: 2, effects: [{ effect: 'poisoned', chance: 1, on: 'target', stacks: 2 }], verb: 'drives its stinger into', description: 'Injects two doses of venom.' },
  { id: 'carapace', name: 'Carapace', kind: 'buff', element: 'physical', target: 'self', power: 0, staminaCost: 6, cooldown: 4, effects: [{ effect: 'fortified', chance: 1, on: 'self', duration: 3 }], verb: 'hunkers down behind its carapace', description: 'Takes much less damage for a while.' },

  // ——— Myconid ———
  { id: 'fungal-slam', name: 'Fungal Slam', kind: 'melee', element: 'physical', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, effects: [{ effect: 'poisoned', chance: 0.3, on: 'target' }], verb: 'slams its spongy bulk into', description: 'Soft, heavy, damp — and sometimes toxic.' },
  { id: 'toxic-spores', name: 'Toxic Spores', kind: 'debuff', element: 'nature', target: 'allEnemies', power: 0, staminaCost: 11, cooldown: 3, effects: [{ effect: 'poisoned', chance: 0.75, on: 'target' }], verb: 'releases a cloud of toxic spores over', description: 'Poisons the whole enemy team.' },
  { id: 'mycelial-mend', name: 'Mycelial Mend', kind: 'heal', element: 'nature', target: 'ally', power: 16, staminaCost: 9, cooldown: 2, effects: [{ effect: 'regenerating', chance: 1, on: 'target' }], verb: 'knits fungal threads into the wounds of', description: 'Heals an ally, and the threads keep working.' },

  // ——— Winter wolf ———
  { id: 'frost-bite', name: 'Frost Bite', kind: 'melee', element: 'water', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, effects: [{ effect: 'chilled', chance: 0.35, on: 'target' }], verb: 'bites with icy jaws into', description: 'Each bite adds a charge of cold.' },
  { id: 'frost-breath', name: 'Frost Breath', kind: 'spell', element: 'water', target: 'enemyFront', power: 8, staminaCost: 12, cooldown: 3, effects: [{ effect: 'chilled', chance: 0.5, on: 'target' }], verb: 'breathes a freezing gale over', description: 'Chills the whole enemy front line.' },

  // ——— Frost giant ———
  { id: 'glacial-club', name: 'Glacial Club', kind: 'melee', element: 'water', target: 'enemy', power: 18, staminaCost: 9, cooldown: 0, accuracyMod: -0.04, effects: [{ effect: 'chilled', chance: 0.35, on: 'target' }], verb: 'brings a club of ice down on', description: 'A club of never-melting ice.' },
  { id: 'avalanche', name: 'Avalanche', kind: 'melee', element: 'earth', target: 'enemyFront', power: 12, staminaCost: 15, cooldown: 4, effects: [{ effect: 'chilled', chance: 0.5, on: 'target' }], verb: 'brings an avalanche down on', description: 'Snow and rock bury the enemy front line.' },
  { id: 'ice-armor', name: 'Ice Armour', kind: 'buff', element: 'water', target: 'self', power: 0, staminaCost: 8, cooldown: 5, effects: [{ effect: 'shielded', chance: 1, on: 'self' }], verb: 'grows a shell of ice', description: 'A thick crust of ice absorbs blows.' },

  // ——— Frost wraith ———
  { id: 'frost-bolt', name: 'Frost Bolt', kind: 'spell', element: 'water', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, effects: [{ effect: 'chilled', chance: 0.5, on: 'target' }], verb: 'hurls a shard of ice at', description: 'Each bolt adds a charge of cold.' },
  { id: 'blizzard', name: 'Blizzard', kind: 'spell', element: 'water', target: 'allEnemies', power: 7, staminaCost: 16, cooldown: 4, effects: [{ effect: 'chilled', chance: 0.45, on: 'target' }], verb: 'summons a blizzard over', description: 'Chills the whole enemy team.' },
  { id: 'deep-freeze', name: 'Deep Freeze', kind: 'debuff', element: 'water', target: 'enemy', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'chilled', chance: 1, on: 'target', stacks: 2 }], verb: 'breathes a deathly cold over', description: 'Two charges of cold at once.' },

  // ——— Hag ———
  { id: 'hex-bolt', name: 'Hex Bolt', kind: 'spell', element: 'shadow', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, effects: [{ effect: 'hexed', chance: 0.45, on: 'target' }], verb: 'spits a crackling hex at', description: 'May hex the target until the next break.' },
  { id: 'curse-of-frailty', name: 'Curse of Frailty', kind: 'debuff', element: 'shadow', target: 'enemy', power: 0, staminaCost: 8, cooldown: 3, effects: [{ effect: 'frailty', chance: 0.9, on: 'target' }], verb: 'points a crooked finger at', description: 'Armour fails until the next break.' },
  { id: 'blight', name: 'Blight', kind: 'debuff', element: 'nature', target: 'allEnemies', power: 0, staminaCost: 12, cooldown: 5, effects: [{ effect: 'blighted', chance: 0.7, on: 'target' }], verb: 'calls a creeping blight down on', description: 'Halves the healing every foe receives until the next break.' },
  { id: 'evil-eye', name: 'Evil Eye', kind: 'debuff', element: 'shadow', target: 'enemy', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'jinxed', chance: 0.9, on: 'target' }, { effect: 'hexed', chance: 0.6, on: 'target' }], verb: 'casts the evil eye on', description: 'Bad luck and weak blows until the next break.' },

  // ——— Unicorn ———
  { id: 'horn-strike', name: 'Horn Strike', kind: 'melee', element: 'light', target: 'enemy', power: 17, staminaCost: 7, cooldown: 0, verb: 'drives its shining horn into', description: 'A spiral of hardened light.' },
  { id: 'purifying-light', name: 'Purifying Light', kind: 'heal', element: 'light', target: 'ally', power: 19, staminaCost: 9, cooldown: 2, cleanse: true, verb: 'pours purifying light over', description: 'Heals an ally and removes its poisons, cold, stuns and other ailments (not curses).' },
  { id: 'sanctuary', name: 'Sanctuary', kind: 'heal', element: 'light', target: 'allAllies', power: 6, staminaCost: 15, cooldown: 5, cleanse: true, verb: 'raises a sanctuary of light around', description: 'Heals and purifies every ally (not curses).' },

  // ——— Hellhound ———
  { id: 'hellfire-bite', name: 'Hellfire Bite', kind: 'melee', element: 'fire', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, effects: [{ effect: 'burning', chance: 0.5, on: 'target' }], verb: 'sinks smouldering fangs into', description: 'A bite that sets the wound on fire.' },
  { id: 'flame-lunge', name: 'Flame Lunge', kind: 'melee', element: 'fire', target: 'enemy', power: 17, staminaCost: 12, cooldown: 3, reachBack: true, effects: [{ effect: 'burning', chance: 0.7, on: 'target' }], verb: 'leaps in a burst of flame at', description: 'Leaps on any target, even in the back line, and sets it ablaze.' },

  // ——— Imp ———
  { id: 'firebolt', name: 'Firebolt', kind: 'spell', element: 'fire', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, effects: [{ effect: 'burning', chance: 0.5, on: 'target' }], verb: 'flings a firebolt at', description: 'A cheap, nasty little spell.' },
  { id: 'cinder-cloud', name: 'Cinder Cloud', kind: 'spell', element: 'fire', target: 'enemyFront', power: 7, staminaCost: 12, cooldown: 4, effects: [{ effect: 'burning', chance: 0.6, on: 'target' }], verb: 'showers burning cinders on', description: 'Sets the enemy front line alight.' },
  { id: 'blink', name: 'Blink', kind: 'buff', element: 'shadow', target: 'self', power: 0, staminaCost: 5, cooldown: 4, effects: [{ effect: 'evasive', chance: 1, on: 'self' }], verb: 'blinks in and out of sight', description: 'Pops in and out of existence, hard to hit.' },

  // ——— Werewolf ———
  { id: 'savage-claws', name: 'Savage Claws', kind: 'melee', element: 'physical', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, effects: [{ effect: 'bleeding', chance: 0.4, on: 'target' }], verb: 'tears savage claws through', description: 'Each slash may open a wound.' },
  { id: 'rend-flesh', name: 'Rend Flesh', kind: 'melee', element: 'physical', target: 'enemy', power: 16, staminaCost: 11, cooldown: 2, effects: [{ effect: 'bleeding', chance: 0.9, on: 'target', stacks: 2 }], verb: 'rips into the flesh of', description: 'Opens two wounds at once.' },
  { id: 'moon-howl', name: 'Moon Howl', kind: 'buff', element: 'shadow', target: 'self', power: 0, staminaCost: 6, cooldown: 6, effects: [{ effect: 'enraged', chance: 1, on: 'self' }], verb: 'howls at an invisible moon', description: 'Gives in to the beast.' },

  // ——— Bramble horror ———
  { id: 'thorn-lash', name: 'Thorn Lash', kind: 'melee', element: 'nature', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, effects: [{ effect: 'bleeding', chance: 0.3, on: 'target' }], verb: 'lashes a thorny limb across', description: 'Brambles that tear.' },
  { id: 'bramble-ward', name: 'Bramble Ward', kind: 'buff', element: 'nature', target: 'ally', power: 0, staminaCost: 9, cooldown: 3, effects: [{ effect: 'thorned', chance: 1, on: 'target' }], verb: 'wraps brambles around', description: 'An ally grows thorns that hurt melee attackers.' },
  { id: 'strangling-vines', name: 'Strangling Vines', kind: 'debuff', element: 'nature', target: 'enemy', power: 0, staminaCost: 10, cooldown: 4, effects: [{ effect: 'slowed', chance: 0.9, on: 'target' }, { effect: 'stunned', chance: 0.35, on: 'target' }], verb: 'sends strangling vines around', description: 'Vines grip a foe.' },

  // ——— Vampire ———
  { id: 'vampiric-bite', name: 'Vampiric Bite', kind: 'melee', element: 'shadow', target: 'enemy', power: 15, staminaCost: 8, cooldown: 0, lifesteal: 0.7, verb: 'sinks its fangs into the neck of', description: 'Drinks the life it takes.' },
  { id: 'blood-bolt', name: 'Blood Bolt', kind: 'spell', element: 'shadow', target: 'enemy', power: 14, staminaCost: 8, cooldown: 1, lifesteal: 0.35, verb: 'hurls a bolt of blood at', description: 'A spell that heals its caster.' },
  { id: 'crimson-feast', name: 'Crimson Feast', kind: 'spell', element: 'shadow', target: 'allEnemies', power: 8, staminaCost: 18, cooldown: 5, lifesteal: 0.5, verb: 'draws the blood out of', description: 'Drains every foe at once.' },

  // ——— Giant bat ———
  { id: 'leeching-bite', name: 'Leeching Bite', kind: 'melee', element: 'shadow', target: 'enemy', power: 12, staminaCost: 5, cooldown: 0, lifesteal: 0.65, verb: 'latches on to', description: 'Feeds as it bites.' },
  { id: 'sonic-shriek', name: 'Sonic Shriek', kind: 'debuff', element: 'air', target: 'allEnemies', power: 0, staminaCost: 10, cooldown: 4, fear: 4, staminaDrain: 8, effects: [{ effect: 'slowed', chance: 0.4, on: 'target' }], verb: 'lets out a piercing shriek at', description: 'A shriek that slows and tires every foe.' },

  // ——— Giant mantis ———
  { id: 'scythe-arms', name: 'Scythe Arms', kind: 'melee', element: 'physical', target: 'enemy', power: 14, staminaCost: 6, cooldown: 0, critMod: 0.05, execute: 0.5, verb: 'slices its scythes across', description: 'Hits 50 % harder on a target below 30 % health.' },
  { id: 'decapitate', name: 'Decapitate', kind: 'melee', element: 'physical', target: 'enemy', power: 16, staminaCost: 12, cooldown: 3, reachBack: true, execute: 1, verb: 'strikes at the neck of', description: 'Reaches any target; deals double damage to one below 30 % health.' },
  { id: 'mantis-stance', name: 'Mantis Stance', kind: 'buff', element: 'physical', target: 'self', power: 0, staminaCost: 5, cooldown: 4, effects: [{ effect: 'evasive', chance: 1, on: 'self' }], verb: 'freezes into a patient stance', description: 'Waits, sways, hard to hit.' },

  // ——— Ooze ———
  { id: 'engulf', name: 'Engulf', kind: 'melee', element: 'water', target: 'enemy', power: 11, staminaCost: 6, cooldown: 0, staminaDrain: 14, effects: [{ effect: 'sapped', chance: 0.6, on: 'target' }], verb: 'engulfs', description: 'Drains 14 stamina and may sap the target’s recovery.' },
  { id: 'sapping-spray', name: 'Sapping Spray', kind: 'spell', element: 'water', target: 'enemyFront', power: 6, staminaCost: 11, cooldown: 4, staminaDrain: 12, effects: [{ effect: 'sapped', chance: 0.8, on: 'target' }], verb: 'sprays enervating slime over', description: 'Drains stamina from the whole enemy front line.' },
  { id: 'gelatinous-wall', name: 'Gelatinous Wall', kind: 'buff', element: 'water', target: 'self', power: 0, staminaCost: 7, cooldown: 5, effects: [{ effect: 'shielded', chance: 1, on: 'self' }], verb: 'swells into a quivering wall', description: 'Its jelly absorbs the next blows.' },

  // ——— Magma golem ———
  { id: 'molten-fist', name: 'Molten Fist', kind: 'melee', element: 'fire', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, effects: [{ effect: 'burning', chance: 0.35, on: 'target' }], verb: 'drives a molten fist into', description: 'Rock hot enough to set the wound on fire.' },
  { id: 'lava-burst', name: 'Lava Burst', kind: 'melee', element: 'fire', target: 'enemyFront', power: 11, staminaCost: 14, cooldown: 4, effects: [{ effect: 'burning', chance: 0.55, on: 'target' }], verb: 'splashes lava over', description: 'Sets the whole enemy front line on fire.' },
  { id: 'magma-skin', name: 'Magma Skin', kind: 'buff', element: 'fire', target: 'self', power: 0, staminaCost: 6, cooldown: 4, effects: [{ effect: 'fortified', chance: 1, on: 'self', duration: 3 }], verb: 'lets its crust harden', description: 'Takes much less damage for a while.' },

  // ——— Banshee ———
  { id: 'keening-bolt', name: 'Keening Bolt', kind: 'spell', element: 'shadow', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, fear: 7, verb: 'sends a keening bolt at', description: 'Hurts the body and the nerves.' },
  { id: 'death-wail', name: 'Death Wail', kind: 'debuff', element: 'shadow', target: 'allEnemies', power: 0, staminaCost: 11, cooldown: 4, fear: 14, effects: [{ effect: 'terrified', chance: 0.5, on: 'target' }], verb: 'wails a death-cry at', description: 'A cry that shakes the courage of every foe.' },
  { id: 'harrowing-shriek', name: 'Harrowing Shriek', kind: 'debuff', element: 'shadow', target: 'enemy', power: 0, staminaCost: 9, cooldown: 3, fear: 24, effects: [{ effect: 'terrified', chance: 1, on: 'target' }], verb: 'shrieks into the face of', description: 'Breaks the nerve of one foe.' },

  // ——— Nightmare ———
  { id: 'nightmare-hoof', name: 'Nightmare Hoof', kind: 'melee', element: 'shadow', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, fear: 5, verb: 'brings burning hooves down on', description: 'Hooves of smoke and embers.' },
  { id: 'dread-charge', name: 'Dread Charge', kind: 'melee', element: 'shadow', target: 'enemy', power: 18, staminaCost: 12, cooldown: 3, reachBack: true, fear: 10, effects: [{ effect: 'terrified', chance: 0.6, on: 'target' }], verb: 'charges out of a bad dream at', description: 'Charges any target, even in the back line, and terrifies it.' },

  // ——— Giant hyena ———
  { id: 'hyena-bite', name: 'Hyena Bite', kind: 'melee', element: 'physical', target: 'enemy', power: 12, staminaCost: 5, cooldown: 0, pack: 0.3, verb: 'snaps at', description: '+30 % damage for each ally that already hit the target this round.' },
  { id: 'cackle', name: 'Cackle', kind: 'debuff', element: 'physical', target: 'allEnemies', power: 0, staminaCost: 8, cooldown: 4, fear: 8, verb: 'cackles madly at', description: 'An unnerving laugh.' },

  // ——— Raptor ———
  { id: 'raptor-claw', name: 'Sickle Claw', kind: 'melee', element: 'physical', target: 'enemy', power: 13, staminaCost: 6, cooldown: 0, pack: 0.3, effects: [{ effect: 'bleeding', chance: 0.2, on: 'target' }], verb: 'slashes its sickle claw across', description: '+30 % damage for each ally that already hit the target this round.' },
  { id: 'pounce', name: 'Pounce', kind: 'melee', element: 'physical', target: 'enemy', power: 15, staminaCost: 10, cooldown: 2, reachBack: true, pack: 0.4, verb: 'pounces on', description: 'Leaps on any target; +40 % damage for each ally already on it this round.' },

  // ——— Cyclops ———
  { id: 'cyclops-club', name: 'Giant Club', kind: 'melee', element: 'physical', target: 'enemy', power: 18, staminaCost: 9, cooldown: 0, accuracyMod: -0.04, verb: 'swings a tree trunk at', description: 'A whole tree, swung.' },
  { id: 'boulder-throw', name: 'Boulder Throw', kind: 'ranged', element: 'earth', target: 'enemyBack', power: 8, staminaCost: 15, cooldown: 4, verb: 'hurls a boulder into', description: 'Hits the whole enemy back line.' },
  { id: 'earthshaker', name: 'Earthshaker', kind: 'melee', element: 'earth', target: 'enemyFront', power: 10, staminaCost: 15, cooldown: 4, effects: [{ effect: 'stunned', chance: 0.2, on: 'target' }], verb: 'stamps the ground under', description: 'Shakes the whole enemy front line; may stun.' },

  // ——— Storm elemental ———
  { id: 'lightning-bolt', name: 'Lightning Bolt', kind: 'spell', element: 'air', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'calls lightning down on', description: 'A bolt from a clear sky.' },
  { id: 'chain-lightning', name: 'Chain Lightning', kind: 'spell', element: 'air', target: 'allEnemies', power: 7, staminaCost: 16, cooldown: 4, verb: 'unleashes chain lightning through', description: 'Arcs through the whole enemy team.' },
  { id: 'thunderclap', name: 'Thunderclap', kind: 'spell', element: 'air', target: 'enemyBack', power: 7, staminaCost: 13, cooldown: 4, effects: [{ effect: 'stunned', chance: 0.25, on: 'target' }], verb: 'calls a thunderclap down on', description: 'Strikes the whole enemy back line; may stun.' },

  // ——— Ogre ———
  { id: 'ogre-club', name: 'Ogre Club', kind: 'melee', element: 'physical', target: 'enemy', power: 17, staminaCost: 8, cooldown: 0, verb: 'clubs', description: 'Simple and effective.' },
  { id: 'blood-frenzy', name: 'Blood Frenzy', kind: 'buff', element: 'physical', target: 'self', power: 0, staminaCost: 6, cooldown: 5, effects: [{ effect: 'frenzied', chance: 1, on: 'self' }], verb: 'licks its wounds and goes into a frenzy', description: 'The more wounded, the harder it hits for 3 rounds.' },

  // ——— Blood demon ———
  { id: 'hellclaw', name: 'Hellclaw', kind: 'melee', element: 'fire', target: 'enemy', power: 15, staminaCost: 7, cooldown: 0, verb: 'rakes burning claws across', description: 'Claws from below.' },
  { id: 'blood-price', name: 'Blood Price', kind: 'melee', element: 'shadow', target: 'enemy', power: 25, staminaCost: 8, cooldown: 3, hpCost: 0.1, verb: 'pays in blood and smashes', description: 'A huge blow that costs 10 % of its own health.' },
  { id: 'infernal-sacrifice', name: 'Infernal Sacrifice', kind: 'spell', element: 'fire', target: 'allEnemies', power: 13, staminaCost: 12, cooldown: 5, hpCost: 0.2, verb: 'sets its own blood alight over', description: 'Burns the whole enemy team; costs 20 % of its own health.' },

  // ——— Seraph ———
  { id: 'radiant-blade', name: 'Radiant Blade', kind: 'melee', element: 'light', target: 'enemy', power: 14, staminaCost: 7, cooldown: 0, verb: 'slashes a blade of light across', description: 'Light with an edge.' },
  { id: 'martyrdom', name: 'Martyrdom', kind: 'heal', element: 'light', target: 'ally', power: 32, staminaCost: 8, cooldown: 2, hpCost: 0.12, verb: 'gives of its own life to heal', description: 'A huge heal for an ally, paid with 12 % of its own health.' },
  { id: 'hymn-of-valor', name: 'Hymn of Valour', kind: 'buff', element: 'light', target: 'allAllies', power: 0, staminaCost: 10, cooldown: 5, effects: [{ effect: 'rallied', chance: 1, on: 'target' }], verb: 'sings a hymn of valour', description: 'Rallies every ally: courage, harder and truer blows.' },
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(list.map((a) => [a.id, a]));
