# Fantasy Manager — history & balance log

What each phase / pass delivered and the measured numbers behind balancing decisions (moved out of CLAUDE.md).
Append new passes here.

## Status
- [x] **Phase 1** — creatures (13 species, 23 traits, 43 abilities, 17 effects, injuries), combat engine,
  live commentary, post-match report, Training Arena screen (team editor, live match with speed/pause/skip,
  manager break panel, report), CLI sims, 37 tests, GitHub Pages workflow.
- [x] **Phase 2** — 10-stable league (double round-robin, 18 matchdays, 12 creatures per stable), inbox, squad,
  tactics, league table & fixtures, match day (live or simulated), fatigue/injuries/morale/form between weeks,
  next season, IndexedDB autosave; full French translation with FR/EN switch; live-match card reactions.
  Not yet: ageing/progression between seasons (phase 4), several save slots (phase 6).
- [x] **Phase 3** — economy (treasury, reputation, ledger: tickets, sponsor, prizes, wages, upkeep, medical),
  contracts (1–3 seasons, renewals, expiry), transfers (bids with counter-offers, AI offers for the player's
  creatures, sale list, release), free-agent market, AI market activity, 2 scouts & attribute ranges,
  Recruitment & Finances screens, creature sheet with market actions, save migration. Combat builds
  (favourite abilities), stamina gauges, canvas projectiles. 65 tests.
- [x] **Phase 4** — training programs & intensity, 3 coaches (staff market, hire/fire), progression towards
  potential, ageing/decline/retirement, yearly brood of youngsters, role fit in combat, Training & Staff screens,
  three themes (night/brown/parchment), gold currency. 72 tests.
  Known: average potential drifts up slowly over seasons (AI keeps its best youngsters) — watch it.
- [x] **Phase 5** — 2 divisions of 10 (player starts in D2, 2 up / 2 down, money ×1.5 in D1), Shadow Cup for
  all 20 stables (preliminary round for the 8 weakest, midweek after matchdays 3/7/11/14/17, half rest, prizes),
  facilities × 3 levels (training ground, infirmary, stands — the nursery was removed later; paid up front, weeks of works, upkeep),
  board objective & confidence (bonus, warnings, no sacking), news feed, relations (bonds from fighting together,
  quarrels, match-start morale, friends mourn departures), grouped navigation, save migration v3→v4. 77 tests.
- [x] **Tutorial** (reworked for new players): `ui/tutorial/FirstSteps.tsx` = « Premiers pas » checklist on the home
  screen (6 quests ticked automatically by `useFirstStepsTracker`: open a sheet, tactics, first match, report, training,
  market; stored with the tutorial in localStorage); the dashboard always shows everything. 22 short tips (no step counter), incl. board, points to place, orders cycle, how a match is won (score band `scoreband`), training sessions. Originally: 19 contextual tips (`ui/tutorial/`: steps anchored to `data-tip="…"` elements, the first
  unseen one whose anchor is visible is shown; progress in localStorage; only during a game), Help page (`?` button)
  with the manual and tutorial controls, opt-out checkbox on the start screen. Adding a screen ⇒ add a `data-tip`
  anchor + a step + `tut.<id>.title/body` strings if it needs explaining.
- [x] **Bestiary ×2**: 23 species (+ lich, kraken, phoenix, dryad, basilisk, djinn, centaur, wendigo, crystal golem,
  salamander), 77 abilities, `rekindling` passive, 5 new name cultures, all translated. Adding a species = species.ts +
  abilities.ts + names.ts (culture) + fr.ts (FR_SPECIES with `the`/`fem`, FR_ABILITIES verbs, FR_SURNAMES aligned).
- [x] **Play styles, wave 1**: stacking poison, chill → freeze, curses until the break, purification; 8 new species
  (giant spider, giant scorpion, myconid, winter wolf, frost giant, frost wraith, hag, unicorn) → 31 species,
  23 new abilities; lich curses, wendigo chills; `sim:archetypes`. 83 tests.
- [x] **Play styles, wave 2**: burn, bleed, thorns, life drain, execution, exhaustion; 9 new species (hellhound,
  imp, werewolf, bramble horror, vampire, giant bat, giant mantis, ooze, magma golem) → 40 species. Power shown as ✸.
- [x] **Play styles, wave 3**: terror, pack, area (back-line attacks), rage (fury), sacrifice; 9 new species
  (banshee, nightmare, giant hyena, raptor, cyclops, storm elemental, ogre, blood demon, seraph) → 49 species.
  17 styles in `sim:archetypes`: averages 33–70 % (frost strongest vs other pure styles, pack weakest). League KO
  rate now ~48–59 %. 91 tests.
- [x] **Bestiary wave 4** (+18 → 67 species): hydra, gargoyle, manticore, chimera, yeti, roc; skeleton warrior,
  ghoul, mummy, death knight; pegasus, sphinx, will-o'-wisp, light elemental; kobold, gnoll, lizardfolk, satyr.
  New mechanics: **multi-strike** (`AbilityDef.hits`: several attacks in one action, each rolls to hit; AI × hits)
  and **revive** (`EffectDef.revive`: one-time passive, `revive` event — handled by commentator, view, matchFx;
  skeleton `reassembling` 30 %). Hydra passive `regrowth` (hot 3 %). Prices from `sim:species` (30–61 % win).
- [x] **AI identities & difficulty**: styles + temperaments per AI stable, difficulty at start, save v5, `sim:ai`.
  Autopilot player finishes ~4.8th (easy), ~6.8th (normal), ~8.8th (hard) of 10 in D2. 97 tests.
- [x] **Levers pass**: role trade-offs + off-role penalty, cover, aggression costs stamina, harsher fatigue (faster
  weekly recovery 22), base orders kept at breaks (bug: the assistant reset them to balanced), AI focus fire,
  per-stable style focus (eclectic → purist), coloured inbox by category with filters, prices recalibrated.
  `sim:levers` now: wrong roles −5, all back line −7, no break management −18, tired squad −21, targeting the
  back line vs brutes +12; aggression/cautious are neutral on average (situational). 101 tests.
  Then: tanks toned down (role armour +3 %, −12 % damage; guard interception max 60 %; stone body 5 %; frost giant
  stats), "Build" column renamed "Preference", Approach orders explained in a tooltip.
- [x] **Encyclopedia** (`ui/screens/EncyclopediaScreen.tsx`, texts in `ui/i18n/encyclopedia.ts`): species, abilities,
  effects, traits, roles, elements chart, attributes, injuries and combat rules, generated from the data and config
  (exact numbers, cross-links, search); reachable without a game (nav + Help). Never names play styles. Adding a
  mechanic ⇒ describe it there (ability `spec.*`, effect `mod.*` / `fx.*`, or a rule). Rule bodies (`ru.*.body`) use a
  tiny markup rendered by `RuleText`: one block per line, `# ` heading, `- ` list item, `> ` assistant's tip, else a
  paragraph (the first = lede), `**label**` bold; filled-in numbers (with sign and « % ») become `.rule-num` pills. Test renders every page in
  both languages. 103 tests.
- [x] **Post-match analysis** (`engine/report/analysis.ts` → `ui/screens/arena/AnalysisPanel.tsx`, texts in
  `ui/i18n/analysis.ts`): conclusions (data + key, worded by the UI), damage sources (validated categorical palette
  `--viz-1..5`), team & creature health per round, periods between breaks with the changes made, duels, lost turns.
  French texts use "vous" everywhere (the player is a coach).
- [x] **Visual progression** (player's creatures only, `CreatureGrowth.seasonStart / recent / history`, logged by
  `shiftAbility` through a logger; `snapshotSeasonStart` at game and season start): ▲/▼ next to attributes changed
  since the season started, ability curve with the potential as a ceiling and latest changes in the sheet, trend
  sparkline in Training, attributes named in the training report. 107 tests.
- [x] **Orders that matter**: ascendancy between approaches (`cfg.combat.orders.ascendancy`: cautious > aggressive >
  balanced > cautious, +8 % damage), reading AI managers counter the opponent's approach (pre-match and at breaks); the
  player cannot see the opponent's approach (guessing game, see « Hidden approach »).
  **Sim bug fixed**: mirror matches cloned teams with identical creature ids (corrupting `sim:levers`/`sim:ai`);
  `cloneTeam()` gives fresh ids and `Combat` now refuses duplicate ids. Measured against varied opponents
  (`sim:levers`, paired with/without): counter approach +14, aggressive vs balanced +16, wrong roles −17, all back
  line −16, best starters benched −13, tired squad (60) −22, no break management −36. Fatigue softened (pre-match
  loss 50 %, penalties below 50 % stamina, max −35 %), base HP 60 (65 since the veteran XP rework, 68 since the fatigue hit share) (league KO ≈ 49 %). AI managers now matter
  (tactician vs plain 64 %); autopilot finishes ~4th / 7th / 8–9th (easy / normal / hard). 110 tests.
- [x] **Style balance pass** (on correct measurements): fury 30 % / frenzy 40 %, thorns 20 % / thorn hide 15 %,
  burn 5.6 %/round, poison 3.2 %/dose, frost giant / ogre / bramble horror toned down, vampire / bat / hyena / banshee
  helped, prices recalibrated. Pure styles vs mixed teams: 33–60 % (bleed team ~65 % because of its minotaurs and
  werewolves; drain and pack lowest — they need a front line). League KO ≈ 50 %.
- [x] **Feedback pass**: board badge icon (`UI_ICONS`, `<BadgeIcon>`), training screen explained (how it works,
  Aptitude bar vs potential, Next ability column; no sparkline), `abilityUnlocked` inbox message, clearer training
  report (changes since the last report + aptitude before → after), locked abilities show their threshold,
  attribute colours red → green, ability kinds in bold, finances: income green / expenses red and a chart margin
  sized to its labels, Tactics: Starter / Bench / Reserve switch + ⇄ swap (`setSelection`, `swapCreatures`),
  "Fatigue" column, 7 light traits (lucky, clumsy, quick learner, stoic, reckless, cheerful, patient), report shows
  both line-ups with the abilities seen used, **replays**: `GameState.matchHistory` keeps the last 10 player
  matches (setup snapshot + break decisions; `replayMatch` / `replayDeciders` reproduce them exactly), "Watch
  again" and "Report" in the inbox, `LiveMatch` `replay` mode. 113 tests.
- **Match verdict** (`engine/report/verdict.ts` → `ui/screens/arena/VerdictPanel.tsx`, top of every report): up to 4
  weighted reasons for the result among ~40 (strength, fatigue, morale, roles, lines, bench, approach ascendancy, elements
  both ways, their star / our star / weak link, accuracy, crits, damage over time, purification, breaks, unused subs,
  control, thorns, back line, healers, stamina, nerves, discipline…; uses the pre-match line-ups found in `matchHistory`
  by seed), one counterpoint (a weakness despite a win / a strength despite a loss) and 1–3 varied tips (one per kind,
  heaviest first) with a button to the right screen. After the player's latest match, `engine/report/advice.ts`
  (`nextMatchAdvice`) adds tips about the next opponent from public info only (their elements vs ours, healers, tanks,
  thorns) and our squad (injured / tired starters, points to place, two matches next week): « Leçons » + « Prochain adversaire ».
  Kept short: 3 reasons, 3 tips in all (2 lessons + 1 ahead), each tip with the icon of the screen it is done on, no buttons.
- **Opponent line-up in Tactics** (`OpponentPeek` in `TacticsScreen.tsx`, button « Composition adverse »): floating panel (not modal, so the line-up can be edited beside it) with the next opponent's expected line-up (`aiPrepare` as on the pre-match screen, `LineupCard` mirrored as in the face-off; species cell = name · icon · elements in fixed sub-columns so icons and dots line up), the elements to favour / avoid against its likely starters (`elementOutlook` in `engine/report/advice.ts`: average damage dealt − taken per element, ≥ 0.1 / ≤ −0.1, 3 max, ×dealt / ×taken in the tooltip) and its manager's temperament.
- **Trait hover card** (`TraitChip` in `components/common.tsx`, everywhere a trait chip shows): name, quality / flaw, description and the exact effects from `useTraitEffects` (`ui/traitEffects.ts`, also used by the Encyclopedia trait page; only effects the engine applies: the declared `training.gainMult` and `personality.moraleVolatility` are applied nowhere, so not shown). Portal on `<body>`, `.trait-pop`.
- **Play a match again** (not in Ironman): store `undo` (game + pre-match flow + queued windows, taken in `simulate` /
  `finishLive`) → « Rejouer le match » in the report header → `retryMatch` restores and saves the state before the match and
  reopens the pre-match screen. Gone once the report is closed.
- **Action log** (`ui/screens/arena/ActionLog.tsx`, texts `ui/i18n/actionLog.ts`): report section listing every event plainly
  (round headings, creature, action, target, result, stamina paid from the preceding `spend`), filters side / creature /
  effects and statuses; a new event type ⇒ word it there too.
- **Time** (`ui/season.ts`: `playerSeason` = the player's matches past and coming in play order, `byWeek`,
  `completedWeek` = last week fully played, −1 during pre-season, `itemLabel`): **season ribbon** under the top bar
  (`ui/components/SeasonRibbon.tsx`: pre-season + weeks 1…n, circle = league, diamond = competition in its colour,
  results green / red, next match pulsing, cursor on the current week, click = `openLeague('comps')`), and the
  **end-of-week summary** (`ui/screens/game/WeekRecap.tsx`): the store keeps `weekStart` (not saved) and sets `recap`
  when `completedWeek` grows (`advance` in simulate / finishLive / continueGame); shown once the match report is
  closed; `continueGame` waits while it is open. Matches, **week's progress** (`GrowthReel.tsx`: per creature, XP bar
  filling — wrapping with « Niveau N ! » on a level-up —, attribute chips popping one by one, new abilities, point to
  place; sparkles; still when effects are off), position ▲▼, treasury delta, infirmary, next week.
  The ribbon is a row of week tiles (number inside; green win / red defeat, « KO » corner; next match filled in the accent
  colour; cup / tournament matches = diamonds in their colour on top), the W–L record on the left, the next match in words
  on the right (hidden below 1100 px).
- **Crests** (`data/crest.ts`, `engine/team/crest.ts`, `ui/components/TeamCrest.tsx`): `Team.crest` = emblem (96 game-icons, the picker scrolls;
  `CREST_ICONS`) + two field colours + pattern (plain, pale, fess, bend, quarterly, chevron) + emblem colour; chosen in
  the new-game screen (`CrestEditor`, `NewGameOptions.crest`), AI stables get `defaultCrest(id)`. Shown in the top bar,
  home hero, league tables, pre-match, calendar, continue card.
- **Current week**: `currentWeek` / `weekText` (`ui/season.ts`) = the week of the player's next match (0 = pre-season) —
  the same number in the ribbon, home hero, top bar status and start screen; the division hero shows weeks played.
- **Start screen** fits without scrolling (checked at 1366×768, 1440×900, 1920×1080): big gold title with the dragon beside it, ornament + tagline (hidden below 860 px of height), the saved game as a banner, new game in two columns (name +
  crest | difficulty + start). News items use game-icons (`<NewsIcon kind>`, `UI_ICONS['news-<kind>']`).
- `npm run ui:check` closes the end-of-week summaries (screenshot `00-recap`).
- **Navigation tabs** (`NavBar.tsx`): a game-icon per screen (`UI_ICONS['nav-*']`), animated underline on the active
  tab, chevron that turns, menus that unfold (icon tile + name + one-line hint `nav.hint.*`); below 1600 px inactive
  tabs show only their icon (name in the tooltip) when the tabs do not fit — measured on an invisible copy
  (`.nav-measure`, longest name of each group so the result never depends on the screen; hysteresis 24 px): the tabs sit
  beside the title when they fit, otherwise on a row of their own under it (`.nav.own-row`, names kept); icons only when
  even a full row is too narrow. Language, text size, effects and theme live in one ⚙ menu (`SettingsMenu.tsx`). The creature sheet shows the potential as a stat tile.
- **Attribute points to place** (one per level gained): gold « +N » badge on the Stable tab / Squad entry, a banner in
  the Squad listing the creatures (chips open the sheet), a pulsing « +N » next to their level, a gold box in the sheet
  with pulsing + buttons. The overall-rating column is « Note » / « Rating ». Stun = one blinking diamond.
- The nav measure copy must stay outside the `.nav.compact` rules (`> .nav-tab`), otherwise the tabs flip in a loop.
  The top bar no longer repeats the season/week (the ribbon shows it).
- Knocked-out creatures are red in the live match (`.fighter.is-ko`, own fall animation) and in the break table.
  After the end-of-week summary, « Continuer » opens the League (the next match starts from the top bar).
- **Renaming**: own creatures are renamed from their sheet (✎ next to the name, `engine/team/rename.ts`, 30 chars max;
  the id stays). Sheets show the species' description in italics. Ability kinds and staff domains use game-icons
  (`<KindIcon>`, `UI_ICONS['kind-*' | 'dom-*']`). The break panel is a wide dialog with « Reprendre le combat » in its
  sticky header and the team orders above the table.
- **Season calendar** (League › Competitions, « Votre saison »): a tile per week (pre-season … 18), each match a chip in
  its competition's colour (opponent crest, V/D + score once played, « prochain match »), current week highlighted.
- **Starting squad** (chosen at new game, whatever the difficulty: `NewGameOptions.squad` = modest / solid (default) /
  gifted → mean potential `generation.startingSquad.potential` 65 / 72 / 80; the generator's internal tiers are never
  shown). Solid ≈ best five ~73 vs 65 in the Pit League (it used to be 83, a Royal League squad). New-game form:
  difficulty as three compact cards (description in the tooltip), then « Effectif de départ », then « Mode de jeu ».
- **Difficulty** (re-tuned): the player starts with a regional squad in every difficulty but a small club (money,
  reputation, staff: `DifficultyDef.playerClub`, novice except easy); the Pit League holds
  0 / 3 / 6 regional stables (easy / normal / hard) and AI identities, reading, money and board differ. `sim:ai
  --season-only` (autopilot, enters the invitationals it can) ≈ 4th · 1.4 trophies/season (easy), 5th · 0.8 (normal),
  7th · 0.5 (hard) — a skilled player does better.
- **Potential** of other stables' creatures is a range « 4–8★ » (`potentialLevelRange`, `<PotentialStars c k>`, contains
  the truth, narrows with knowledge); young creatures are priced on their ceiling (`value.potentialWeight` 1.3).
- **Potential** is written « n★ » (`<Stars n>`, 1–10 = highest level reachable: `maxLevelOf` for own creatures,
  `potentialLevel(c, knowledge)` estimate for others; coach quality /2). Squad has a one-line hint on how creatures
  grow with a link to Training; Training shows species icon + element dots.
- **Journal** (`InboxScreen`): three panes — folders by category (game-icons, unread badge) · messages grouped by week
  (sticky week headings, icon per kind `messageIcon`, preview line, score pill, unread dot kept for the visit) · reading
  pane (category tag, title, body as paragraphs / list, big score with crests for results, actions: report, watch again,
  offers…); ↑ ↓ browse; fills the viewport height. Board and next match live on the dashboard only.
- **Pre-match** compact: each side of the face-off holds its star card, the last meeting sits under « VS », the arena
  condition beside the title; actions in one row with « manage breaks »; line-up cards with a one-line header — both
  line-ups fit at 1440×900.
- **Flash info** (`ui/components/NewsTicker.tsx`): TV-style band at the bottom, red « FLASH INFO » tag with a blinking
  dot; every item = category badge (match, league, cups, finances, squad, market, club, news — colour tokens `--tk-*`) +
  icon + text coloured by tone (gains green, losses / alerts red, warnings amber): next match + arena forecast, last
  result, streaks, position + gap to promotion, leaders, Shadow Cup and every tournament, treasury, last week's net and
  income, wage bill, injured / tired, points to place, expiring contracts, offers received, free agents (new), board,
  reputation, works, next ambition, bestiary, latest news. Loops, pauses on hover, static when effects are off. Inbox is named « Journal ».
- **Top-bar button** says what it does: « Prochain match » (opens the pre-match screen), « Retour au match »,
  « Semaine suivante », « Saison suivante ». Pre-match screen: big « Jouer le match en direct » card + « Simuler ».
- Approach ascendancy is a cycle (cautious > aggressive > balanced > cautious): the verdict says so, never « best ».
- **Hidden approach**: the player never sees the opponent's approach before or during a match (break panel shows only the
  cycle; the break assistant reads the line-up for the target but not the approach). The post-match verdict may name it.
- Live-match speed: only « slow » is remembered; fast / instant reset to normal at the next match.
- **Managers' names**: `managerName(team)` (`engine/team/identity.ts`, fantasy names from `MANAGER_NAMES` in `data/names.ts`, drawn from the
  team id, no RNG of the world) shown with the temperament on the pre-match screen (French gambler = « flambeur »).
- Pre-match: face-off banner (`screens/game/Versus.tsx`: crests slide in on their colours, « VS » slams with a
  clash sound, duel of the stars — the opponent's star from public record only —, last meeting), then the row
  « Modifier la tactique » (`.cta-tactics`) · « Jouer en direct » · « Simuler », then both line-ups.
- **Drag and drop in Tactics** (the only way to move a creature: no Starter / Bench / Reserve buttons; a ⠿ grip column for touch;
  same look as the Squad table — two-line name, filled attribute boxes): the table is split into three boxes (`SortableTable.groups`: Starters / Bench / Reserve,
  one tbody each with a heading). `ui/components/rowDrag.ts` drags the whole row with pointer events (a copy follows the
  pointer; touch: the ⠿ grip), boxes light up (red when full). Drop on a box = `setSelection`; on a creature = `dropOnto`
  (free place in its group, otherwise swap; between two starters their lines swap) in `engine/team/edit.ts`. A box may be
  over-filled (`setSelection(…, over = true)`, « 6/5 » in red, the match stays blocked). Box borders: starters green,
  bench light blue, reserve grey.
  Rows follow the team order (lineup, bench, reserve); the top / bottom third of a row = insert there (`insertInGroup`,
  accent line), the middle = `dropOnto`. The dragged copy hangs just below the pointer.
- **Break panel** (`Modal locked`: only « Reprendre le combat » closes it — no click outside, Escape or ✕). A substitute may come on in any role and line (`SubstitutionDecision.role / line`, default: its best role, the line of the creature it replaces; role fit / off-role follow, `substitution` event carries both, roster role updated): under the table, a card per substitute (level, species, role / off-role, health, stamina, morale,
  pre-match fatigue, element advantage / vulnerability against the opponents still standing, abilities, « comes on for »).
- **KO**: `fxCanvas.knockout` (dust, chunks, red flash, two shockwaves, embers) + `koStamp` in Projectiles (« K.O. » stamp
  on the card, short shake of `.live`). Health lost trails in white (`.bar > i.ghost`).
- **Ambitions** (`engine/club/ambitions.ts`): 16 career goals (first win → top half → first trophy → first promotion →
  cup semi-final → level-8 creature → Royal League → Golden Crown → Grand Arena → survive there → all facilities max →
  Shadow Cup → Grand Arena title → Champions Cup → double → 3 titles). `GameState.career` logs each
  finished season (`recordSeason` in `endOfLeague`), `GameState.ambitions` = season reached; `checkAmbitions` runs at
  the end of every league / cup week and at the season change, with an `ambition` inbox message (toast). Dashboard card.
- **Favourite moves**: the Tactics column « Coups favoris » opens a small picker with only the abilities (☆).
- **Sheet tour**: tips anchored inside the creature sheet (`sheet-tiles`, `sheet-roles`, `sheet-abilities`,
  `sheet-attrs` « the rest can wait »); while a window is open, only tips inside it show (scrolled into view).
- Nav « Outils / Tools » groups the Encyclopedia and the « Arène d’essai / Test arena » (sandbox, no effect on the game).
- **Save slots** (`ui/store/saves.ts`): 3 slots (`SLOTS`; the first keeps the old single autosave key `auto`), each with
  a summary in the `meta` store (team, crest, season, week, division, rank, difficulty, saved at) so the start screen lists
  them without loading games (old saves get one on first listing). The game autosaves into `useGame().slot` (remembered
  in localStorage `fm.slot`); `loadSlot`, `deleteSlot`, `refreshSlots`, `openLaunch` (the brand button goes back to the
  start screen). Start screen with saved games: the three slot cards (in play / load / delete, empty = start here) and a
  « Nouvelle partie » button; the new-game form then takes their place (« Retour aux sauvegardes », bottom links hidden),
  with « Enregistrer dans : » as three explicit options « Emplacement n — team / libre » (default: the free slot clicked,
  else the first free one; a taken one turns red with « La partie … sera effacée », replacing still asks first). No
  save: the form directly. **Time played** (`ui/store/playClock.ts`): counted while a game is open, the start
  screen closed and the tab visible; `saveGame` writes it into `GameState.playTime` (UI-owned, the engine never reads it) and
  `SlotMeta.playTime`; `savePlayTime` updates only that field of the saved copy (tab hidden, back to the start screen, another
  slot loaded — never rewrites the rest, so an Ironman's week stays played); slot cards show « 3 h 12 de jeu ». `scripts/career-check.mjs` measures every view at 1366×768, 1440×900, 1920×1080.
- **Start & dashboard**: opening the app with a save shows the start screen (store `launch`) with two cards, « continue »
  and « new game » (difficulty as cards, seed under « more options »). In a game the landing screen is the dashboard
  (`DashboardScreen`, nav « Accueil »): hero (rank), next match, board, squad status tiles, mini table, treasury,
  best creatures, latest results, unread messages, news — each card links to its screen.
- **Creature sheet** (`CreatureModal`): one identity line (species — description as tooltip —, elements, size, age),
  a strip of stat tiles (overall, level, HP, stamina, form, morale, fatigue), then attributes, traits / role fit,
  abilities; `extra` sits under the header (live state, market estimate), `footer` holds management (training +
  progression, relations, contract / bid / signing).
- UI errors are caught by `ui/components/ErrorBoundary.tsx` (main content and the creature sheet): a message instead of a blank screen.
- [x] **Levels & XP rework** (10 levels, match + training XP, max level from potential, a free point per level,
  unlocks by level, encyclopedia "Levels and experience" rule, Level column / badge / chart in levels). 115 tests.
  Next (later): phase 6 (save slots, import/export, worker sims).
- **Training sessions** (`engine/progression/sessions.ts`, `ui/screens/game/TrainingSession.tsx`, top of Training + dashboard card + gold badge on the Training tab): every match a stable plays earns 1 session + a second one with a chance of `cfg.training.sessions.extraChance[training ground level]` (0 / 10 / 20 / 30 %, own stream `extraSession`; `afterMatchSessions` in `playFixtures`; was 1/1/2/2 — level 2 doubled squad growth, level 3 added nothing: `sim:facility` now ≈ 23 / 26 / 28 / 30 sessions a season), the player keeps up to `maxStored` (3) in `GameState.sessions` (`available`, `total` = seed of the draws, `recent`); AI stables spend theirs at once. « Entraîner une créature »: `runSession` draws a healthy creature (not the last one trained), then an attribute of its **program** category below its ceiling: +1, or +2 with `jackpot.base + coach quality × perQuality` (coach of that category). UI: two chained roulettes (the squad stays shown, the drawn one lit gold, the others dimmed; then the program's attributes; ~4–6 s; instant when effects are off). **Programs are physical / combat / mental only** (default `defaultProgram` = `cfg.training.roleProgram[role]`: tank / skirmisher physical, striker / caster combat, support mental; old role / balanced / rest plans map to it; « Selon le rôle » in apply-all resets). **XP comes from matches only** (`matchXp`, ×1.6 to fold in the old training share) × life stage × the coach of the creature’s program (`coachFactor`) × the training ground (+10 % per level); **training touches neither fatigue nor morale and causes no injury; no intensity.** Staff screen: per coach « XP en match ×f · +2 en séance p % · n créatures au programme », candidates compared with the current coach. Training table: no age / next-ability columns. Each level gives `levels.freePoints` (2) points to place in any attribute, whatever the role or program (« + » on every attribute below its ceiling). Life stage = `<StageMark>` (▲ developing, ◆ prime, ▼ veteran — « Vétéran », was « En déclin »; XP ×1.25 / ×1 / ×0.5 on hover) in Training, Squad table and cards. Veterans still earn XP and the prime learns at full speed (was ×0, and prime ×0.5: a veteran's XP bar froze while it lost ground, frustrating): ageing lowers the ability, not the potential, so matches win part of each birthday's loss back. Measured (`sim:balance`, 10 seasons): league ability ~95 → ~103, potential 105 → 109, average age 39 → 46; prime and veteran changes each add about half of it. Compensated by `ageing.lossMult` 1.5 (× every species' `declineRate`, shown in the Encyclopedia): over three worlds (seasons 4–10) KO ≈ 48 % (old rules) → ≈ 54 % (new XP, loss ×1.3) → ≈ 51 % (×2); the loss is a weak lever (veterans are a minority), prime XP drives most of the drift. With prime ×1, KO went to ≈ 56 %: base HP 60 → 65 (`combat.hp.base`) brings it back to ≈ 50 % (three worlds, seasons 4–10; 70 HP ≈ 41 %). Then young ×1 → ×1.25 so developing and prime differ: KO ≈ 47 % (noise).
- **After-match progress**: `simulate` / `finishLive` keep `afterMatch` (states before / after the match); closing the report sets
  `progress` when `weekGrowth` (`ui/growth.ts`) finds any, and `MatchProgress` (`GrowthReel.tsx`, `.progress-dialog`) shows the XP
  bars filling, before the training window (the training, week recap, board, career and scout windows wait for it). Midweek
  (cup / tournament) rounds turn their match XP into progress at once (`weeklyTraining(…, stream 'midweek-<key>')` in
  `playCupRound`), league weeks in `playMatchday` as before.
- **After-match training**: closing a match report (`closeMatch`) opens `AfterMatchTraining` (store flag `drill`, not saved)
  when sessions are waiting, before the end-of-week summary (`closeDrill` folds the session's gains into `recap.after`).
  `continueGame` waits while it is open. **Bench not full** (fewer than `match.benchSize`, lineup valid): amber remark on
  the pre-match screen + a confirmation (« Compléter le banc » via `repair` / « Jouer quand même ») before live or simulate.
- **Bonds** (discreet, mostly lore; `cfg.combat.bonds`, `Combatant.bonds` from relations ≥ `club.relations.friend` / ≤ `rival`): a friend knocked out makes the other **avenging** (effect, damage ×1.1, 4 rounds; `enrage` event with `reason: 'friendKo'` + `friend`, commentary `friendKo`, rage mark/aura); a friend who already hit the target this round gives +4 % to hit; a rival's hit never counts as teamwork (combo). Match-start morale from relations as before. Encyclopedia › Morale explains it in one sentence.
- **Fatigue retuned** (training no longer adds any): match fatigue = 10 + 34 × stamina spent in the match (from `Combatant.startStamina`, not from the max: counting the stamina a tired creature already lacked made it come back ever more tired — a spiral) + 14 × share of the rounds on the field + 10 if knocked out (time and KOs tire too: cheap-blow, quick-recovery species such as skeletons no longer come back fresh every week; spread per species 28–47 instead of 22–49), weekly recovery 20 + 0.6 × recovery → starters ~27 % fatigued before a match (sim:balance), rotation matters.
- **Creature records & medals** (`engine/team/record.ts`, `cfg.collection.medals`): `Creature.record` (matches, starts,
  wins, KOs, times KO, damage, healing, best of the match, best / average rating, trophies with season) filled after every
  league / cup / tournament match (`recordSide` in `playFixtures`) and trophy (`awardTrophy`: every creature of the
  winning squad); 7 medal families × 3–4 tiers (bronze, silver, gold, legend), `medal` inbox message + toast for the
  player's creatures. Sheet: « Palmarès / Record » panel (`ui/components/CreatureRecord.tsx`). Bookkeeping only.
- **Bestiary** (`GameState.bestiary`: species `seen` in the player's matches / `owned`, season of the first time,
  `paid` tiers): `updateBestiary` after the player's matches, reward tiers in gold (+ reputation) from
  `cfg.collection.bestiary`, `bestiary` inbox message; the starting squad is not rewarded (`initBestiary`, also for old
  saves). Encyclopedia tab « Votre bestiaire » (`ui/screens/BestiaryView.tsx`: unknown species are silhouettes, rarity
  from `SpeciesDef.rarity`), dashboard card, `openBestiary()` in the store.
- **Creature cards**: removed (the Squad is a table only).
- **Facilities screen** (`FacilitiesScreen.tsx`): KPI strip (levels built, upkeep, works, board price), one card per facility
  in its colour (`--fac`: training good, infirmary home, stands gold): emblem + watermark, level ladder, effects now → next
  level (`effectsAt`), league average / rank, works progress bar or build button with price, discount, upkeep, shortfall.
- **Sound** (`ui/sound/sfx.ts`) — **switched off for now** (`SOUND_ENABLED = false`: `play` / `unlockAudio` do nothing, the volume
  setting is hidden; flip it to bring them back): every sound is synthesised with Web Audio (no files); volume in the settings menu
  (`useSettings().volume`, `fm.volume`, 0 = off, default 0.5); the context starts on the first gesture. Hooks: button
  clicks (App), coins (treasury), toasts (Celebrations), level-ups (GrowthReel), hits / KO + crowd (Projectiles),
  whistle / victory / defeat (LiveMatch), clash (Versus). Throttled (4 sounds / 120 ms). Never affects the game.
- **Visual depth** (end of `styles.css`): ambient body gradients + vignette, film grain (`.app::before`) and ~46 glowing embers rising
  (`ui/fx/Embers.tsx`, CSS animation, dark themes with effects on, z-index −1: only between the boxes — panels, top bar
  and ribbon stay fully opaque), panels with gradient + soft depth shadow, the first
  panel of a screen lit with a gilded top edge, smoother screen transition, gradient primary buttons, tabular numbers.
  **Refinement** (last section of `styles.css`, « less, but better »): numbers in the body font with tabular figures
  (`--font-mono` = body font), one flat panel material (no sheen, no heading glow / rule), nested tiles filled instead of
  framed, quiet card links, dashboard cards of a row share their height. `UI_THEME=dark npm run ui:check …` picks the theme.
  Settings menu: labelled blocks, « A » sizes, theme cards, switch for effects, styled volume. Finances: KPI strip, chart drawn
  at its real width (ResizeObserver), « Recettes et dépenses » as bars with a period switch. League: page header with
  `.page-tab` tabs, zone bars instead of rank badges, fixtures with crests + score pill, season as a two-column agenda
  (`.agenda`), honours as medallions. Tactics: « Laisser l'assistant choisir » sweeps, sparkles and lights the rows.
  **Live staging** (display only, effects on, not at instant speed): title cards (`.stage-card`: round 1, after each
  break, final round, break, result), crit punch
  (`.live.crit-punch` + `.crit-jolt`), line-ups deal in during the first second (`.live.dealing`).
  Creature sheet fits one screen (1440×900): `Modal className="sheet-dialog"`, `.sheet-cols.three` = attributes, traits,
  roles | skills (`.sheet-skills`: the six kit entries as `AbilityCard`s on two columns, « k/n équipées » and a « ? » hint in
  the heading, kind · element · target · power · cost · cooldown, effects, description; locked = dashed « Verrouillée » chip) |
  management (`footer`: training, relations, compact `ContractPanel`) then record (`aside`); one column below 1250 px.
  Encyclopedia species pages show the same cards (name = link to the ability). `node scripts/sheet-shots.mjs <dir> [url] [sizes]`
  screenshots the sheets + a species page and prints the sheet's overflow. Competitions list: `CompLine`
  rows grouped by `compGroup` (still in / registration / the rest), description as the name's tooltip. Season tab:
  `.chain` (next 5 matches) + `.season-table` (week | league | cups). The « Fantasy Manager » title always shows (top
  bar and start screen, also when coming back from a game). Recruit cards: element medallion (`--c1/--c2`), rating box,
  potential + knowledge, figures in `.rc-stats`, full-width button. Sheet sections are `.sheet-box.sec-<id>` with a colour
  each (physical, combat, mental, traits, roles, abilities).
  No emojis in the UI: game-icons everywhere (`UI_ICONS`: help-*, fac-*, scout, stamina, power, injury, tip…).
- [x] **Wave 5** (+10 → 77 species, 27 abilities, 11 effects): runic golem (rune ward: passive shield of 14 % HP that
  comes back at every break, `EffectDef.rechargeAtBreak`), spell eater + lamia (silence: no spells nor heals,
  `silence`, `isSilenceable`), oni (provocation: single-target attacks must aim at it, `taunt`), kitsune (camouflage:
  cannot be picked by single-target abilities, next attack +30 % and revealed, `hidden`, attack `ambush` flag),
  lamia + cockatrice (corrosion: −7 % armour per dose up to 4 — additive mods now scale with stacks), qilin + tengu
  (spell mirror: `EffectMods.spellReflect`, `thorns` event with `spell`, commentary key `mirror`), kelpie + werebear
  (metamorphosis below half health: `transformBelow` / `transformInto`, `transform` event handled by commentator, view,
  matchFx). AI: `pickableTargets` (camouflage, provocation), silence filter, mirror penalty. Prices from `sim:species`
  (new species 42–65 %). `tests/wave5.test.ts`.
- **Arena conditions** (`data/config/arena.ts`, `engine/league/arena.ts`): 17 — weather (rain, heatwave, fog, night,
  blazing sun, storm, sandstorm, eclipse, eruption), ground (swamp, black ice, narrow pit, hallowed ground, cursed earth,
  mountain air), crowd (frenzy) and magic (mana tide). Levers (`ArenaCondition`): element damage ×, kind of attack ×
  (melee / ranged / spell), ranged / melee hit, stamina costs ×, stamina recovery ×, healing ×, damage over time ×,
  critical chance +, morale per round — the same for both sides; adding one = config + `arena.cond.<id>` strings +
  `arena.<id>` commentary (EN/FR) + `arena-<id>` icon + `.ac-<id>` colour (tested); `arenaFor(state, fixture)` draws
  one per fixture from the world seed (40 % clear days), none before week 4 of the first season (`arenaActive`),
  `MatchSetup.arena` → `Combat.arena` (also seen by the AI), `matchStart.arena` (commentary `arena.<id>`), `arenaIntro`
  inbox message once. UI: `ui/components/ArenaCondition.tsx` (badge in the pre-match face-off, Encyclopedia rule
  « Conditions d'arène » with every condition), `openEncyclopedia(tab, id)` in the store.
- [x] **Wave 6** (+20 → 97 species, 76 abilities, 15 effects): dwarf, gnome tinker, siren, valkyrie, locust swarm, rat swarm,
  pixie, doppelganger, thunderbird, mimic, rakshasa, lamassu, sandworm, sea serpent, ettin, mandrake, giant moth,
  poltergeist, sun lion, jackal warden (name cultures `dwarf`, `fey`). New mechanics, all drawing RNG only when present
  (matches without them are unchanged): **undying** (`EffectDef.undying`, `lethalRoom`: health never below 1, attack
  `undying` flag; `last-stand` self, `vowed` on an ally), **raise** (`AbilityDef.raise`, target `fallenAlly`: an ally KO'd
  since the last break, `canRaise`; `revive` event with `by` / `ability` / `stamina`, view sets it active), **charm**
  (`EffectDef.charm`, consumed on its turn like a stun: `takeTurn` acts with `charmedAi` = own allies as foes,
  `hostileOnly`; attack `charmed`, no credit in damageDealt / report / analysis), **swarm** (`EffectMods.singleTaken` /
  `areaTaken`, `takenMult`; `swarm-body`), **golden hide** (`physicalTaken`), **time bombs** (`EffectDef.detonate`: explodes
  at expiry in `endOfRound` → `effectTick` of that effect, commentary `blast.<id>`; cleansable; `checkVictory` after
  `endOfRound`), **mirror images** (`EffectDef.images`, stacks: each single-target strike hits a double instead, attack
  `decoy`, view decrements; multi-strikes pop them, areas ignore them), **chain** (`AbilityDef.chain`, `chainFrom`: leaps to
  random other enemies × `damage.chainFalloff`^k, attack `chain`), **dispel / steal** (`AbilityDef.dispel` / `steal`,
  `isDispellable`, `dispel` event), **riposte** (`EffectMods.riposte`: basic attack back at a melee attacker, once per
  action, attack `riposte`), **burrow** (`EffectDef.burrowed` + hidden: out of reach of everything, `inReach`), **steadfast**
  (`two-heads`: stuns / charms × `damage.steadfastMult`). AI: kill bonus off vs undying, images / swarm in
  `expectedDamage`, `chainValue`, `dispelValue`, riposte penalty, self-buff scores (images, undying, riposte, burrow), vow
  for a dying ally, raise options. Marks `charm bomb blast images imagePop undying burrow riposte dispel`, auras, motifs,
  AbilityCard chips (chain / dispel / steal / raise), Encyclopedia lines. Two AI styles `charm` and `undying`; six more
  archetypes in `sim:archetypes` (`--only a,b` plays those rows): vs mixed teams charm 39, undying 65, illusion 39, bombs 39,
  swarm 48, burrow 65 %; swarms are crushed by burn / area (5 %). Species 42–64 % in `sim:species` (prices set from it).
  Self-buff skills that cost matches were turned into « hit, then effect » (mirror images, burrow, submerge, just a chest);
  fixing a bug on the way: `reveal` now only removes the cover the creature had before its action (a strike that ends in
  camouflage, kitsune's Vanish, used to lose it at once). Pixie passive `fey-flight` (dodge +10 %).
  `node scripts/species-check.mjs <outDir> [url]` (dev server, dev store `window.__arena`) plays two live Test-arena matches
  between the 20 wave-6 species with their key skill, screenshots, and counts the mechanics that fired. `sim:species --only a,b --mean m` tests a few species against a full run's mean.
  Tests `tests/wave6.test.ts`.
- [x] Assistant roles from the kit (Nov 2026): `bestRole` reads the equipped skills (`RoleDef.kit`). On 1200 generated
  line-ups, starters in a role their skills can't play: supports 217 / 471 → 0, casters 234 / 1301 → 0, skirmishers
  1183 / 1649 → 30 / 636 (strikers 1341 → 2487). Paired run, same squad with the new vs the old roles against the same
  varied opponents (6000 matches): 50.5 % vs 48.4 % (+2.1). The player's « pick for me » keeps the equipped skills.
- [ ] Phase 6 — mass season sims in a worker, balancing, polish, save slots & import/export.

## Balance snapshot
Tools: `sim:batch` (match stats), `sim:species` (strength of each species at equal potential → suggested
`valueMult`), `sim:balance -- --seasons 10` (long-run drift: ability/potential, ages, pre-match fatigue,
injuries, KO rate, treasuries per division, reputation, transfers).

Professional vs professional (600 matches): ~17 rounds, ~59 % KO finishes, ~0.75 injuries per match (full league
season ≈ 49 % KO). At equal squads one attribute point everywhere ≈ 93 % wins: measure levers against varied
opponents, never mirrors (and never with duplicate ids).
Long run (balance pass, after phase 5): average ability ~97 → ~104 and potential ~101 → ~113 over 8–10 seasons,
then flat; starters ~20–27 % fatigued before a match (rotation matters); league KO rate 40–55 %; treasuries stay
positive (AI stables in the red sell to richer ones; rich ones buy and build more); reputation reverts towards
62 (D1) / 38 (D2) so promoted teams can settle. A dynasty can still pile up money (~500–700k after 10 seasons).
Species: at equal potential dragon > golem ≈ kraken ≈ minotaur > … > harpy ≈ salamander ≈ dryad > goblin; their
market value (and wages) scale with `valueMult` (0.6–1.6), so weak species are cheap and strong ones expensive.
Knobs used: youth potential (base 55 + 0.5 × reputation, sd 18), free-agent quality weights, weekly fatigue
recovery (16 + 0.6 × recovery), D1 money ×1.35, distressed sales, rich-club spending.

**Cooldown-1 skills** (Nov 2026): 14 cooldown-2 skills moved to cooldown 1 (usable every other round instead of every
third), their edge over the basic attack cut by about a third: tail crush 20→18 (cost 7→8), life drain 18→16
(lifesteal 0.6→0.5), ravenous bite 14→13 (0.5→0.4), sun ray 20→18, dawn javelin 18→17, void maw 18→16, mob rush
12→11 (cost 6→7), dissolve 14→13 (1 corrosion dose instead of 2), plague bite 9→8 (poison 0.9→0.65), flurry 7→6 ×3,
shield bash 12→11 (stun 0.35→0.2), healing wind 20→17, backstab 17→16 (crit +0.2→+0.15), arc coil 15→13. Joins
moonbeam, bloom, prism beam and blood bolt (18 cooldown-1 skills). `sim:abilities` 400 paired matches, old values
(`--override`) vs new: uses per match +35 %, average added 9.7 → 10.1 points (within the noise); to watch: dissolve on
the ooze 6.2 → −1.0 (sandworm 12.8 → 16.5), life drain slightly up (+2 on average). Follow-up: dissolve gets its 2
corrosion doses back (power 13, cooldown 1), life drain 16 → 15.

**Traits that change** (Nov 2026): first version with marks left by match signals (24 signals, thresholds, decay)
measured on 3 worlds × 2 seasons: one change every 5.1 weeks per stable but 86 % good news, natural losses 10 out of
1058, a few traits everywhere (second wind, guardian, focused) and some never seen: dropped for a purely random draw
(25 % per match and stable, 60 % gains, 3 traits max). Same measure: one change every 4 weeks (5.6 a season, 4.8
messages for the player), gains 875 / losses 474 / pushed out at random 113, good 40 % / bad 37 % / double-edged 23 %,
traits per creature 0: 15 %, 1: 38 %, 2: 30 %, 3: 17 %, every trait seen (sharp-eyed rarest: three common opposites).
Then 21 more traits (73 in all), and `training.gainMult` / `personality.*` finally read by the engine (not measured).

**Relations by moments (2026-11-22).** The +3 per match fought together made every regular starter a friend: replaced
by random weekly moments only (15 % per stable, 50/50 good / bad, bond set at once or undone). Measured (3 worlds ×
2 seasons, ad-hoc script): ≈ 4.5 moments a season for the player; per stable (≈ 75 pairs) friends 2 → 4.4 → 5.8,
rivals 1 → 3.4 → 5.1 (start → season 1 → 2); among the 10 starter pairs only ≈ 0.8 friends and 0.7 rivals, so the
match-start morale stays light. No decay: bonds pile up slowly, departures clear them.
