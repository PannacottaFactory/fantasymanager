# Fantasy Manager (formerly Shadow Arenas) — project guide

Deep fantasy arena-league management game in the spirit of Football Manager. The player runs a stable of
creatures (dragons, trolls, goblins, elves…), never controls fights directly: a deterministic simulation
resolves them. 100 % front-end, deployable on GitHub Pages.

- French time unit: **« semaine »** (one league match per week), never « journée »; cup rounds = « semaine d, après le
  championnat ». English keeps « matchday ».
- Talk to the user in **French**. The game is **bilingual: French (default) and English**, switchable in the top bar.
  Code identifiers, data ids and English source texts stay in English; French lives beside them (see i18n below).
- Repo: https://github.com/PannacottaFactory/fantasymanager (Pages deploy via `.github/workflows/deploy.yml`;
  `index.html` has `<meta name="robots" content="noindex, nofollow">` so search engines skip the site).
- Top bar: dragon icon (game-icons) + title « Fantasy Manager », subtitle = the player's stable name during a game.
  A new game opens a welcome window (`IntroModal`, store flag `intro`, not saved).
- **Gold**: amounts are written in gold colour (`--gold`): `<Money v>` for a standalone amount, `<Gold>{text}</Gold>`
  colours every amount inside a worded string (regex on what `money()` writes). Inside `.good-text`/`.bad-text` they
  keep the gain/loss colour. Morale words use `moraleColor` (red → green).

## Stack
TypeScript (strict) · Vite · React 19 + Zustand · Vitest · tsx (headless CLI) · ESLint (flat config).
Saves use IndexedDB (`idb`, one autosave slot, `src/ui/store/saves.ts`); heavy sims will move to a Web Worker (phase 6).

## Commands
| | |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (tests/*.test.ts) |
| `npm run typecheck` / `npm run lint` | must stay clean |
| `npm run build` | typecheck + production build into `dist/` |
| `npm run sim:match -- --seed 42 --a professional --b regional` | one match in the terminal with commentary + report |
| `npm run sim:batch -- --matches 1000 --a elite --b novice` | balancing stats over many headless matches |
| `npm run sim:season -- --seed 42 --seasons 3` | league seasons headless: table, wages, treasuries, transfers |
| `npm run sim:archetypes -- --matches 200 --detail` | play styles head to head (poison, frost, curses…) + what each style did |
| `npm run sim:ai -- --matches 300 --seasons 6` | AI management vs plain, temperaments, a season per difficulty (`--season-only`) |
| `npm run sim:levers -- --matches 400` | weight of each manager decision (orders, lines, roles, bench, fatigue, breaks) at equal squads |
| `npx vite --port 5179` then `npm run ui:check -- <outDir> <url> <weeks>` | headless browser (Playwright): new game, plays weeks, opens every sheet & main screens, screenshots + console errors |

Quality tiers: `novice | regional | professional | elite | legendary`.

## Architecture (strict layering)
```
src/core/    RNG (sfc32, seeded, forkable), math, text helpers — no deps
src/data/    DECLARATIONS ONLY: bestiary, abilities, traits, effects, injuries, names, texts
  config/    every balancing number (combat, elements, generation, match rules, report)
  text/      commentary templates & report/assistant phrases (*.ts = English, *.fr.ts = French)
  i18n/      fr.ts: French names/descriptions/verbs of every data id (+ grammar hints: gender, articles)
src/engine/  pure game logic, no UI imports, no Math.random / Date (enforced by ESLint)
  creature/  generation, derived values (HP, abilities, role fit), names
  team/      team generation, auto-lineup, tactic validation, pure edit helpers
  combat/    Combat class (rounds, AI, morale, breaks), formulas, AI, break decisions, view replay
  commentary/ Commentator: events → varied English text (own RNG stream)
  report/    buildReport: stats, ratings /10, key moments, assistant remarks — from events only
  league/    GameState (= save file), calendars per division, standings, playMatchday / playCupRound, cup draw,
             promotion & relegation, news feed, migrate.ts (saves v1→v4)
  club/      facilities (levels, works, effects), board (objective, confidence, verdict), relations
  economy/   value & wages, finances/ledger, market (transfers, free agents, AI activity, contracts),
             scouting (knowledge → attribute ranges), player actions (bid, sign, sell, renew, release, scouts),
             setup (initEconomy, migrateGame v1→v2→v3)
  progression/ training.ts: weekly training (programs × intensity × coaches), ageing & retirement,
             young prospects (to the free-agent market), coaches (hire/fire), training plans
  text/      localize.ts: data names/descriptions per language
src/sim/     headless CLI scripts (Node via tsx)
src/ui/      React screens; reads engine state, sends decisions; zero game rules
  i18n/      strings.ts (UI texts en/fr, typed keys), useT() hook, settings store (lang, theme)
  store/     gameStore (league game + match-day flow, autosave), arenaStore (sandbox), saves (IndexedDB)
  screens/   game/ (start, inbox, squad, tactics, league, match day), arena/ (sandbox, live match, report)
tests/       Vitest
```

### Key conventions
- **Determinism**: `seed + teams + break decisions` ⇒ identical match. Use `deriveSeed(...)`/`rng.fork()` for
  independent streams. Commentary/report wording uses separate streams so text never alters results.
- **Combat flow**: `new Combat(setup)` → `advance()` until `phase === 'break'` → each side's decision is computed
  **before** either is applied (avoids a side bias) → `applyBreakDecision` ×2 → `resume()`. `simulateMatch()`
  does it headless with `aiBreakDecision`. `result().decisions` allows exact replays.
- **Events are the source of truth**: `MatchEvent[]` drives commentary, report and the live UI
  (`engine/combat/view.ts` replays them). Add a new event type ⇒ handle it in commentator, report and view.
- **Balancing values** live in `src/data/config/*`; engine functions take a `GameConfig` (default `DEFAULT_CONFIG`)
  so batch sims can test variants.
- Attributes 1–20 (21 attributes: 6 physical, 6 combat, 9 mental). Hidden: ability/potential 1–200, personality.
- Commentary templates: `[tags, text]`; tags must all be present on the event; specific templates are favoured,
  recent ones avoided. Tests fail on any unfilled `{placeholder}`.
- UI: three themes — night (black, default), dark (brown) and parchment (light) — via CSS tokens in `src/ui/styles.css`; localStorage only for
  per-viewer prefs (theme, language, commentary speed).
- **Icons**: species & role icons from game-icons.net (CC BY 3.0, credited in Help), extracted by
  `node scripts/extract-icons.mjs` into `src/ui/icons/gameIcons.ts` (edit the lists there when adding a species
  or role); `<SpeciesIcon>` (element colour), `<RoleIcon>`, `<RoleLabel>`; the crest shows the species icon.
- **Text size**: every font size is in `rem` (base 14 px × `--text-scale`); the viewer picks normal / large (default,
  ×1.15) / extra-large (×1.3) with the « Aa » button. Never write font sizes in px (CSS) or numbers (inline styles).
- **i18n**: engine text functions take a `lang` (`Commentator(…, cfg, lang)`, `buildReport(…, cfg, lang)`,
  `generateTeam({ lang })`); the language never changes RNG draws or results (tested). French templates must not
  write `de {x}` / `à {x}` / `que {x}` before a creature (elision), use `{aE}/{tE}/{oE}` for gender agreement;
  `tests/i18n.test.ts` checks this on real matches. Inbox messages are stored as data and worded by the UI.
- **Live match visuals**: `ui/screens/arena/matchFx.ts` turns events into card reactions (attacker glow/lunge,
  target shake + floating number, ghost HP bar); hovering a commentary line highlights actor & target
  (`CommentaryLine.actor/target`).
- **Builds**: `Tactic.favorites[creatureId]` = one favourite ability (`cfg.combat.favorites.max` = 1); the combat AI multiplies their score
  (`cfg.combat.favorites`, scaled by discipline). Chosen with ★ in the creature sheet (Tactics « Build » column).
- **Stamina gauges**: abilities cost stamina (no mana). A `spend` event (cost, stamina left, cooldown) precedes each
  ability/guard so the live view drains gauges and refills cooldown chips; the commentator ignores it.
- **Visual effects** (display only): setting `effects` (full / reduced, ✨ button, default = system reduced-motion,
  `effectsOn()`, `:root[data-effects]` turns CSS animations off). `ui/fx/FxLayer.tsx` = app-wide particle canvas
  (`fxLayer()?.confetti() / fireworks() / sparkle() / coins()`), `ui/fx/Celebrations.tsx` = toasts for new inbox
  messages that matter (level-up, ability, signing, trophies, death), worded by `wording()` from the inbox. Live match:
  status auras on cards (`AURA` in Scoreboard), KO dust + grey fall, revive light, crit label, victory confetti,
  score count-up (`useCountUp`, `RollingMoney`). Top bar treasury rolls and shows the weekly delta with coins.
- **Projectiles**: `ui/screens/arena/Projectiles.tsx` draws shots, element particles and impacts between cards
  (`data-cid`); target reactions & health drop land when the projectile arrives (`FLIGHT` per speed).
- **Pyramid** (save v6 — older saves need a new game): 4 divisions of 10 — 0 Grand Arena, 1 Royal League, 2 Barony
  League, 3 Marches League (names in `ui/competitions.ts` `divName`, emblems `DIV_ICON`). The player starts in D4
  (`cfg.league.playerDivision` 3, quality novice; easy: regional via `DifficultyDef.playerQuality`). Money ×1.35/1/0.75/0.55,
  reputation baselines 64/46/30/18. 2 up / 2 down between each pair.
- **Competitions**: the Shadow Cup (`state.cup`, 40 stables: 24 byes, 6 rounds after matchdays 2/5/8/11/14/17) and
  `state.tournaments` (`engine/league/tournaments.ts`, generic knockouts with a preliminary round when needed):
  pre-season (player + 3 of its division, before matchday 1), a cup per division, the Champions Cup (best four of the
  Grand Arena last season), three invitationals (marches « Joute des Lanternes » rep 0, argent rep 35, or rep 55; entry fee,
  `registerTournament` replaces the least famous entrant before round 0, expense `fees`). Each round has a key in
  `cfg.league.tournaments` (after that matchday; decimals = a later midweek); the player's competitions never share a key.
  Fixtures: `competition: 'cup' | 'tournament'` + `tournamentId`; league fixtures have none (`!f.competition`).
- **Weeks**: `midweekKey` = earliest due key among cup and tournament rounds; `cupDue` = a midweek is due;
  `playMatchday` plays it first (`playCupRound` plays every round of that key). `playerFixture` returns the player's tie
  in a midweek (or nothing). In the UI, « Next match » plays midweeks without the player on their own up to its next match.
  Cup messages carry `tournament` / `rounds`; `SeasonRecord.trophies` lists the season's tournament wins.
- **League screen**: tabs Championship (pyramid of the 4 leagues with the money scale « po ×1,35 » in gold, division
  hero with rules + gap to promotion / drop, table with zones and ▲▼ movement since the previous matchday, fixtures),
  Competitions (« Votre programme » = the player's coming matches grouped by week — pre-season, then week d = league
  match ① then the rounds keyed d / d.5 ② —, next match highlighted, « deux matchs » flag; then every competition as a
  list (default) or cards, choice in localStorage `fm.compView`: description, status, field (still in / favourite =
  most famous still in / winner), next round + week, tie, trophy, registration, draw), Honours (trophy cabinet with greyed trophies still to win, season by season).
  Competition colours: `.def-<id>` sets `--comp` (league, shadow, champions, division, or, argent, marches, preseason),
  used by `.comp-badge` (schedule, pre-match title). Emblems are game-icons: `<CompIcon def>` / `<DivIcon d>` (`COMP_ICONS`, `DIV_ICONS` in `scripts/extract-icons.mjs`: crown, fleur-de-lys, castle, watchtower), no emojis.
- **Coaches** cost wage = 40 + quality² × 2.2 per week and a hiring fee of 12 weeks of wages (a top coach ≈ 10k).
- **League week order** (`playMatchday`): all matches → existing injuries tick down → match effects (fatigue,
  new injuries, morale, form) → a week of rest → finances (tickets, sponsor, prizes, wages, upkeep, medical,
  scouts, staff) → scouting → market (free agents, AI signings/buys, AI offers to the player) → contract
  warning; training runs before the money (after rest). (Old saves: pending youngsters go to the free agents at the first matchday.)
  The player's team is always side 0 in its match. Season end: prize money + reputation; next season:
  ageing (+1 year, decline past the prime, retirement past maxAge) → expired contracts leave (player) or are
  renewed/released (AI) → young prospects (2–4 per stable: AI stables sign the promising ones, the rest and the player's share join the
  free agents — no nursery, no « brood » the player keeps) →
  new coach market → `ensureSquads` keeps every squad ≥ 9.
- **Levels & XP** (`engine/progression/levels.ts`, `cfg.training.levels / xp`): the player sees a level 1–10 and
  0–100 XP; underneath, levels are steps of the hidden aptitude (`ability`, 1–200; `levels.steps` = [28, 40, 50, 60,
  72, 86, 102, 120, 142, 168]: short at the bottom so modest creatures still climb, long at the top), which still drives the
  attributes, AI and prices. Max level = level of the potential. Abilities unlock by level (`unlockLevel(minAbility)`,
  `isUnlocked`, used by `getAbilities`). XP per week = training share of the former gain (none while resting /
  injured) + match XP (`matchXp`: played, starter, rating above 5, win — no KO bonus so healers and tanks are not penalised; stored in `growth.matchXp` by the match
  effects), × life stage, capped by the potential. XP feeds the attribute pool by program; each level gained gives
  the player a free point (`growth.freePoints`, `spendFreePoint`, + buttons in the sheet; AI places it by program)
  and `levelUp` / `abilityUnlocked` messages. New creatures start 10–25 % below what their age allows
  (`generation.headroom`) so they can level up; the league starts weaker (~92) and settles at the same plateau.
  Attributes are capped by the species range at full potential (+2). Ageing uses the same mechanism, negative.
- **Roles** (`cfg.combat.roles`): each role has a bonus and a cost (tank +armour −damage, striker +melee −armour,
  caster +spells −armour, support +healing −damage, skirmisher +ranged/+melee −armour). Bonuses scale with
  `roleFactor` (role fit, 0.78–1.2); outside the species' natural roles (`Combatant.naturalRole`) damage and healing
  ×`roleFit.offRole` (0.8). Tank interceptions and the skirmisher flank penalty also use `roleFactor`.
- **Cover** (`cfg.combat.cover`): while ≥ 2 creatures of a side stand in the front line, its back line takes 20 % less
  from ranged attacks and spells (melee reaching the back line ignores it).
- **Orders**: aggressive = more damage for much more stamina (a burst, ruinous over a whole match); cautious = armour
  and stamina savings. `Combat.sides[].baseOrders` = starting orders, which break decisions return to when level.
  Individual instruction (`cfg.combat.stances`): all out = +8 % damage, −4 % armour, +15 % stamina costs; pace yourself
  = −8 % damage, −15 % stamina costs (AI uses fewer big abilities); normal = neither. Neutral on average in `sim:levers`
  (±1.5), a tired squad pacing itself +4.
- **Fatigue**: pre-match fatigue removes up to 70 % of the stamina pool, penalties start below 60 % stamina (up to
  −40 % hit/damage/initiative/interception) and injuries are ×(1 + fatigue/100).
- **Economy** (phase 3, money in gold pieces: "po" in French, "gp" in English): all numbers in `data/config/economy.ts`. Player actions in
  `engine/economy/actions.ts` return `{ state, outcome }` (UI words the outcome; `useGame().act(f)` saves).
  AI bid answers are deterministic (`deriveSeed(world, 'bid', season, matchday, creature, attempt)`).
- **Market size**: at most `freeAgents.max` (10) free agents (20 % leave each week, the least valuable go when crowded;
  refill to `pool` 8); `GameState.freeAgentsBefore` = ids before the last weekly market → « Nouveau » badge. Home ambitions:
  one line with the current one, the list on demand.
  Recruitment › Other stables opens on « Sélection pour vous » = `transferOffers` (15 creatures outside their stable's
  best five, divisions ±1, within reach of the treasury — relaxed when too few — plus `dreamOffers` 5 stars of the
  divisions above, any price); a stable or « all » shows full squads. The home dashboard always shows every card.
- **Imperfect information**: the player sees other creatures through `knowledgeOf` (own = 100, league 25,
  free agents 10; matches +20 up to 60; scouts 70/90). Ranges come from a fixed per-creature offset
  (`noise(id, key)`), always contain the truth and narrow monotonically — never show raw attributes,
  ability or potential of a creature the player does not own.
- **Play styles** (design only — never named in the game or the encyclopedia; teams mix them freely): each style
  must work through its own abilities and effects, with one readable rule and a counter. No team/synergy bonuses,
  no cross-effect combos. Mechanics: stacking effects (`EffectDef.maxStacks`, `AbilityEffectRef.stacks`; poison up to
  5 doses, dot × stacks), `onMaxStacks` (3 chill charges → frozen, a stun; no chill while frozen), curses
  (`EffectDef.curse`: no countdown, lifted at each break, not cleansable), `AbilityDef.cleanse` (removes harmful
  non-curse effects, `cleanse` event), `EffectMods.healingTaken`; wave 2: burn (short, healing −60 %), bleed
  (3 wounds, `endsOnHeal`), thorns (`EffectMods.thorns`, `thorns` event, melee only), execution
  (`AbilityDef.execute`, below `executeBelow` health), stamina drain (`AbilityDef.staminaDrain`, `drain` event,
  `sapped` halves stamina recovery via `staminaRegenMult`); wave 3: pack (`AbilityDef.pack`, per ally already on
  the target this round, capped by `packMax`; the AI converges on bitten prey), line attacks (`enemyBack` target,
  `lineTargets`), fury (`EffectMods.fury`, scales with missing health), sacrifice (`AbilityDef.hpCost`, never below
  1 HP, `sacrifice` event); terror reuses fear / terrified / flight. Validate with `sim:archetypes` (pure styles
  ≈ 35–45 % vs mixed teams, strong/weak match-ups between styles) and price species with `sim:species`.
- **AI identities & difficulty** (`data/config/identity.ts`, `engine/team/identity.ts`): each AI stable has
  `Team.identity = { style, manager }` (17 styles, 5 temperaments: cautious, aggressive, tactician, gambler, steady),
  drawn so styles are varied. The style sets the squad share (`favoured` in `generateTeam`), signings bias, target
  order and favourite abilities; the manager sets aggression / risk and break behaviour (`Tactic.ai`, read by
  `Combat.sides[].ai` so `aiBreakDecision` uses it everywhere). Managers who "read" the opponent pick the target
  from its line-up (`counterTarget`) before the match and at breaks. `GameState.difficulty` (easy / normal / hard,
  chosen at start) sets division tiers, style share, identities on/off, who reads, favourites, AI rest threshold,
  player's starting money, board losses. The opponent's temperament is shown before the match; styles never are.
- **Saves**: `GameState.version` 5; `loadGame` runs `migrateGame` (v1 → economy, v2 → staff, plans, youth, v3 → divisions,
  v4 → identities + normal difficulty).

## Arena rules (current)
5 starters + 3 bench, 2 abstract lines (front/back). Max 20 rounds; breaks after rounds 5/10/15 with up to
3 substitutions. A team with nobody standing loses by KO; otherwise judges' score = % of opposing health removed.
League points (phase 2): KO win 3, points win 2, points loss 1, KO loss 0.
**Deaths (rare)**: after a league/cup match, a creature knocked out that picked up an injury dies of it with
`cfg.league.death.chance[severity]` (moderate 2 %, severe 20 %, career 50 %) × the infirmary factor — own RNG stream
(`deriveSeed(world, 'death', …)`), so match results never change. `bury()` removes it (friends mourn, whole stable
−6 morale), `death` inbox message + news, `GameState.fallen` = memorial shown under the Squad. ≈ 3–4 deaths per season
in the 20 stables (one every ~5 seasons per stable). Not shown during the live match.

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
  market; stored with the tutorial in localStorage); the dashboard always shows everything. 13 short tips (one or two sentences, no step counter). Originally: 19 contextual tips (`ui/tutorial/`: steps anchored to `data-tip="…"` elements, the first
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
  mechanic ⇒ describe it there (ability `spec.*`, effect `mod.*` / `fx.*`, or a rule). Test renders every page in
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
  loss 50 %, penalties below 50 % stamina, max −35 %), base HP 60 (league KO ≈ 49 %). AI managers now matter
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
  heaviest first) with a button to the right screen.
- **Time** (`ui/season.ts`: `playerSeason` = the player's matches past and coming in play order, `byWeek`,
  `completedWeek` = last week fully played, −1 during pre-season, `itemLabel`): **season ribbon** under the top bar
  (`ui/components/SeasonRibbon.tsx`: pre-season + weeks 1…n, circle = league, diamond = competition in its colour,
  results green / red, next match pulsing, cursor on the current week, click = `openLeague('comps')`), and the
  **end-of-week summary** (`ui/screens/game/WeekRecap.tsx`): the store keeps `weekStart` (not saved) and sets `recap`
  when `completedWeek` grows (`advance` in simulate / finishLive / continueGame); shown once the match report is
  closed; `continueGame` waits while it is open. Matches, **week's progress** (`GrowthReel.tsx`: per creature, XP bar
  filling — wrapping with « Niveau N ! » on a level-up —, attribute chips popping one by one, new abilities, point to
  place; sparkles; still when effects are off), position ▲▼, treasury delta, infirmary, next week.
  The ribbon is a rail filled up to the current week, a medallion per week (league result), diamonds for cup matches.
- **Difficulty** (re-tuned): the player starts with a regional squad in every difficulty; the Marches League holds
  0 / 3 / 6 regional stables (easy / normal / hard) and AI identities, reading, money and board differ. `sim:ai
  --season-only` (autopilot, enters the invitationals it can) ≈ 4th · 1.4 trophies/season (easy), 5th · 0.8 (normal),
  7th · 0.5 (hard) — a skilled player does better.
- **Potential** of other stables' creatures is a range « 4–8★ » (`potentialLevelRange`, `<PotentialStars c k>`, contains
  the truth, narrows with knowledge); young creatures are priced on their ceiling (`value.potentialWeight` 1.3).
- **Potential** is written « n★ » (`<Stars n>`, 1–10 = highest level reachable: `maxLevelOf` for own creatures,
  `potentialLevel(c, knowledge)` estimate for others; coach quality /2). Squad has a one-line hint on how creatures
  grow with a link to Training; Training shows species icon + element dots.
- **News ticker** (`ui/components/NewsTicker.tsx`): TV-style band at the bottom (next match, last result, leaders, cup,
  infirmary, latest news), loops, pauses on hover, static when effects are off. Inbox is named « Journal ».
- **Top-bar button** says what it does: « Prochain match » (opens the pre-match screen), « Retour au match »,
  « Semaine suivante », « Saison suivante ». Pre-match screen: big « Jouer le match en direct » card + « Simuler ».
- Approach ascendancy is a cycle (cautious > aggressive > balanced > cautious): the verdict says so, never « best ».
- **Hidden approach**: the player never sees the opponent's approach before or during a match (break panel shows only the
  cycle; the break assistant reads the line-up for the target but not the approach). The post-match verdict may name it.
- Live-match speed: only « slow » is remembered; fast / instant reset to normal at the next match.
- **Managers' names**: `managerName(team)` (`engine/team/identity.ts`, fantasy names from `MANAGER_NAMES` in `data/names.ts`, drawn from the
  team id, no RNG of the world) shown with the temperament on the pre-match screen (French gambler = « flambeur »).
- Pre-match: line-ups first, then a centred row « Modifier la tactique » (`.cta-tactics`) · « Jouer en direct » · « Simuler ».
- **Drag and drop in Tactics**: the table is split into three boxes (`SortableTable.groups`: Starters / Bench / Reserve,
  one tbody each with a heading). `ui/components/rowDrag.ts` drags the whole row with pointer events (a copy follows the
  pointer; touch: the ⠿ grip), boxes light up (red when full). Drop on a box = `setSelection`; on a creature = `dropOnto`
  (free place in its group, otherwise swap; between two starters their lines swap) in `engine/team/edit.ts`. A box may be
  over-filled (`setSelection(…, over = true)`, « 6/5 » in red, the match stays blocked). Box borders: starters green,
  bench light blue, reserve grey.
  Rows follow the team order (lineup, bench, reserve); the top / bottom third of a row = insert there (`insertInGroup`,
  accent line), the middle = `dropOnto`. The dragged copy hangs just below the pointer.
- **Break panel**: under the table, a card per substitute (level, species, role / off-role, health, stamina, morale,
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
