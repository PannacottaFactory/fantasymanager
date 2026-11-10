# Shadow Arenas (Arènes de l'Ombre) — project guide

Deep fantasy arena-league management game in the spirit of Football Manager. The player runs a stable of
creatures (dragons, trolls, goblins, elves…), never controls fights directly: a deterministic simulation
resolves them. 100 % front-end, deployable on GitHub Pages.

- Talk to the user in **French**. The game is **bilingual: French (default) and English**, switchable in the top bar.
  Code identifiers, data ids and English source texts stay in English; French lives beside them (see i18n below).
- Repo: https://github.com/PannacottaFactory/fantasymanager (Pages deploy via `.github/workflows/deploy.yml`).

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
             youth intake (brood), coaches (hire/fire), training plans
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
- **Builds**: `Tactic.favorites[creatureId]` = up to 2 favourite abilities; the combat AI multiplies their score
  (`cfg.combat.favorites`, scaled by discipline). Chosen with ★ in the creature sheet (Tactics « Build » column).
- **Stamina gauges**: abilities cost stamina (no mana). A `spend` event (cost, stamina left, cooldown) precedes each
  ability/guard so the live view drains gauges and refills cooldown chips; the commentator ignores it.
- **Projectiles**: `ui/screens/arena/Projectiles.tsx` draws shots, element particles and impacts between cards
  (`data-cid`); target reactions & health drop land when the projectile arrives (`FLIGHT` per speed).
- **Weeks**: `playMatchday` plays the due cup round first when `cupDue(state)` (cup weeks sit between league
  matchdays; `seasonOver` waits for the final). `playerFixture` returns the cup tie during a cup week.
- **League week order** (`playMatchday`): all matches → existing injuries tick down → match effects (fatigue,
  new injuries, morale, form) → a week of rest → finances (tickets, sponsor, prizes, wages, upkeep, medical,
  scouts, staff) → scouting → market (free agents, AI signings/buys, AI offers to the player) → contract
  warning; training runs before the money (after rest). Unkept youngsters leave at the first matchday.
  The player's team is always side 0 in its match. Season end: prize money + reputation; next season:
  ageing (+1 year, decline past the prime, retirement past maxAge) → expired contracts leave (player) or are
  renewed/released (AI) → brood of 2–4 youngsters (player decides in Training; AI keeps the promising ones) →
  new coach market → `ensureSquads` keeps every squad ≥ 9.
- **Progression** (phase 4, `data/config/training.ts`): weekly ability gain = gap to potential × rate × life stage
  × professionalism × intensity × coaches; it feeds a pool of attribute points (`Creature.growth.pool`), each whole
  point going to an attribute drawn by program weight (so progress is visible). Attributes are capped by the
  species range at full potential (+2). Ageing uses the same mechanism with negative amounts.
- **Roles** (`cfg.combat.roles`): each role has a bonus and a cost (tank +armour −damage, striker +melee −armour,
  caster +spells −armour, support +healing −damage, skirmisher +ranged/+melee −armour). Bonuses scale with
  `roleFactor` (role fit, 0.78–1.2); outside the species' natural roles (`Combatant.naturalRole`) damage and healing
  ×`roleFit.offRole` (0.8). Tank interceptions and the skirmisher flank penalty also use `roleFactor`.
- **Cover** (`cfg.combat.cover`): while ≥ 2 creatures of a side stand in the front line, its back line takes 20 % less
  from ranged attacks and spells (melee reaching the back line ignores it).
- **Orders**: aggressive = more damage for much more stamina (a burst, ruinous over a whole match); cautious = armour
  and stamina savings. `Combat.sides[].baseOrders` = starting orders, which break decisions return to when level.
- **Fatigue**: pre-match fatigue removes up to 70 % of the stamina pool, penalties start below 60 % stamina (up to
  −40 % hit/damage/initiative/interception) and injuries are ×(1 + fatigue/100).
- **Economy** (phase 3, money in gold pieces: "po" in French, "gp" in English): all numbers in `data/config/economy.ts`. Player actions in
  `engine/economy/actions.ts` return `{ state, outcome }` (UI words the outcome; `useGame().act(f)` saves).
  AI bid answers are deterministic (`deriveSeed(world, 'bid', season, matchday, creature, attempt)`).
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
League points (phase 2): KO win 3, points win 2, points loss 1, KO loss 0. No death (severe injuries instead).

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
  4 facilities × 3 levels (training ground, infirmary, stands, nursery; paid up front, weeks of works, upkeep),
  board objective & confidence (bonus, warnings, no sacking), news feed, relations (bonds from fighting together,
  quarrels, match-start morale, friends mourn departures), grouped navigation, save migration v3→v4. 77 tests.
- [x] **Tutorial**: 19 contextual tips (`ui/tutorial/`: steps anchored to `data-tip="…"` elements, the first
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
  balanced > cautious, +8 % damage), reading managers counter the opponent's approach (pre-match and at breaks), the
  break panel shows the opponent's approach and who has the upper hand, the assistant's suggestion reads too.
  **Sim bug fixed**: mirror matches cloned teams with identical creature ids (corrupting `sim:levers`/`sim:ai`);
  `cloneTeam()` gives fresh ids and `Combat` now refuses duplicate ids. Measured against varied opponents
  (`sim:levers`, paired with/without): counter approach +14, aggressive vs balanced +16, wrong roles −17, all back
  line −16, best starters benched −13, tired squad (60) −22, no break management −36. Fatigue softened (pre-match
  loss 50 %, penalties below 50 % stamina, max −35 %), base HP 60 (league KO ≈ 49 %). AI managers now matter
  (tactician vs plain 64 %); autopilot finishes ~4th / 7th / 8–9th (easy / normal / hard). 110 tests.
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
