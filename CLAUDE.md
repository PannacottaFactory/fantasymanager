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
Saves use IndexedDB (`idb`, 3 slots, `src/ui/store/saves.ts`); heavy sims will move to a Web Worker (phase 6).

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
- **Live match dressing** (stays textual, columns kept): each fighter column = « Première ligne » block (cards with a shield
  edge facing the opponent) · rampart showing the back line's cover (`coverPoints` / `coverReduction`, bar = share of the
  max, « Plus de couverture » when the front falls) · « Ligne arrière » block (cards a step back) · bench strip (compact quiet
  rows, always visible; creatures taken off go there). KO creatures stay in their line until the next break, then are
  carried to the bench (still KO, struck through; `retired` set in `LiveMatch`, display only). Cover label / wall colour
  goes red → amber → green with its strength. Guard = a thin golden arc on the side facing the opponent, card stays still
  (`lunge: 'still'`). Hesitation = a swirl above the head. « Conseil de l'assistant » at the break has the Tactics
  flourish (glow + sweep, sparkles, orders and rows light up). Centre: score band (judges' % live
  on each side, round title, team health, `RoundTrack` = 20 pips with the breaks), chronicle with round chapters, a margin
  icon per tone (`TONE_ICON`) for lines that matter, big moments (importance 2) larger on a tinted band, lines inked in.
  `node scripts/live-check.mjs <outDir> <url> <shots> <everyMs> [speed]` screenshots a live match.
- **Animation motifs** (`ui/screens/arena/motifs.ts`, display only): every ability gets a motif from its id / kind / target
  (exceptions in `BY_ID`): bite, claw, blade, blunt, charge, sting, lash, sweep, quake, arrow, rock, spit, volley, orb,
  bolt (lightning), beam, breath (cone), storm (falls from the sky), wave, heal, song (notes), blessing, shout (sound
  waves), curse (sigil), gaze, cloud, snare. `fxCanvas.ts` draws the flight (`drawMotif`, `motifTrail`) and the impact
  (`impactMotif`, + element sparks on physical motifs); multi-strikes are staggered (`Shot.seq`); charges lunge further
  (`FxBatch.lunge`). **Marks** (`matchFx.ts` `Mark`, drawn by `ui/screens/arena/fxMarks.ts`): every status applied /
  ticking / wearing off and one-off reactions have their own animation (burn flames, poison bubbles by doses, blood drops,
  snowflakes, frost crystals + thaw shatter, orbiting stun stars, hex shield + break, sigils, silence sign, taunt rings,
  stamina / life streams between cards, thorns, cleanse, guard, rest, metamorphosis vortex, sacrifice, flee, « ? »,
  gold motes from the creature going off to the one coming on (the card slides in, `.fighter.sub-in`), execution, ambush, pack). A new event or effect ⇒ give it a mark.
- **Fixed canvases** (`.fx-canvas`, FxLayer) must never sit under an ancestor keeping a `transform` / `filter`: screen
  transitions use `animation-fill-mode: backwards` (with `both`, Chrome keeps an identity matrix + `blur(0)` that captures
  fixed children and shifted every particle effect ~185 px down).
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
- **Starting squad**: the player's creatures keep their drawn strength but little room to grow
  (`generation.startingSquad`: potential = ability + gap × 0.35, at most 101 = 6★); stars come later (market, prospects).
- **Stable names** (`generateTeamName`): six kinds (adjective + noun, noun of place, order of emblem, order of place,
  standalone, figure's troupe), same draws in every language (indices modulo each list); French names carry no leading
  article (« face à Les … »).
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
  effects), × life stage, capped by the potential. XP feeds the attribute pool by program, **held until the level-up** (RPG-like: all the points land at once, listed in the `levelUp` message `gains`; the potential IS the max level: reaching it jumps the aptitude to the potential, the last level-up gives everything left; new creatures are settled by `alignPotential` (trained up to the potential, or a full level still to gain — never at the max level below it); ageing losses at once — `shiftAbility`); the sheet shows `XpTrack` (level → next, thin blue XP bar `--xp-color`, how it works in the tooltip); each level gained gives
  the player a free point (`growth.freePoints`, `spendFreePoint`, + buttons in the sheet; AI places it by program)
  and `levelUp` / `abilityUnlocked` messages. New creatures start 10–25 % below what their age allows
  (`generation.headroom`) so they can level up; the league starts weaker (~92) and settles at the same plateau.
  Attributes are capped by the species range at full potential (+2). Ageing uses the same mechanism, negative.
- **Roles** (`cfg.combat.roles`): each role has a bonus and a cost (tank +armour −damage, striker +melee −armour,
  caster +spells −armour, support +healing −damage, skirmisher +ranged/+melee −armour). Bonuses scale with
  `roleFactor` (role fit, 0.78–1.2); outside the species' natural roles (`Combatant.naturalRole`) the role gives only `roleFit.offRoleBonus` (half) of its bonus (costs stay whole), no other penalty
  (`roleFit.offRole` ×0.8 removed). Tank interceptions and the skirmisher flank penalty also use `roleFactor`.
- **Cover** (`cfg.combat.cover`, `coverPoints` / `coverReduction`): every creature standing in the front line shields
  the back line from ranged attacks and spells (a tank counts 1.5), with diminishing returns: 1 → −11 %, lone tank −15 %,
  2 → −18 %, 3 → −24 %, 4 → −27 %, max 36 % (melee ignores it).
- **Melee reach**: any melee fighter may strike the back line past a standing front line (`flank`), at −22 % to hit
  (`hit.reachPenalty`); skirmishers only −10 % × (2 − role factor); flyers / reachBack none. The AI keeps only 30 % of
  the target-priority bonus for such strikes (`ai.reachPriority`), so brutes do it only when worth it.
- **Orders**: aggressive = more damage for much more stamina (a burst, ruinous over a whole match); cautious = armour
  and stamina savings. `Combat.sides[].baseOrders` = starting orders, which break decisions return to when level.
  Individual instruction (`cfg.combat.stances`): all out = +8 % damage, −4 % armour, +15 % stamina costs; pace yourself
  = −8 % damage, −15 % stamina costs (AI uses fewer big abilities); normal = neither. Neutral on average in `sim:levers`
  (±1.5), a tired squad pacing itself +4.
- **Fatigue**: pre-match fatigue removes up to 70 % of the stamina pool, penalties start below 60 % stamina (up to
  −40 % hit/damage/initiative/interception) and injuries are ×(1 + fatigue/100).
- **Training intensity** (`cfg.training.intensity`): light ×0.6 growth, −8 fatigue, +1 morale; intense ×1.4 growth,
  +16 fatigue a week (after recovery, so carried into the match), −2 morale, 3 % injury a week (× proneness/10).
  The select's tooltip shows these numbers (`intensityDesc`). Match injuries: KO 9 %, heavy hit 1 % (≈ 0.9 per match);
  death chances lowered (1.6 / 16 / 40 %) to keep deaths flat. Free agents' signing bonus = 55 % of value (no fee).
- **Encyclopedia › Attributes**: each attribute lists what it does in the arena with the config numbers
  (`attributeVars`, `at.*` texts), the roles weighing it and the best species.
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
  heaviest first) with a button to the right screen. After the player's latest match, `engine/report/advice.ts`
  (`nextMatchAdvice`) adds tips about the next opponent from public info only (their elements vs ours, healers, tanks,
  thorns) and our squad (injured / tired starters, points to place, two matches next week): « Leçons » + « Prochain adversaire ».
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
- **Difficulty** (re-tuned): the player starts with a regional squad in every difficulty but a small club (money,
  reputation, staff: `DifficultyDef.playerClub`, novice except easy); the Marches League holds
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
- **Drag and drop in Tactics**: the table is split into three boxes (`SortableTable.groups`: Starters / Bench / Reserve,
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
  start screen). Start screen: three slot cards (in play / load / delete, empty = start here) and « Sauvegarder dans »
  chips in the new-game form (default: first free slot; replacing a game asks first).
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
- **Training sessions** (`engine/progression/sessions.ts`, `ui/screens/game/TrainingSession.tsx`, top of Training + dashboard card + gold badge on the Training tab): every match a stable plays earns `cfg.training.sessions.byFacility[training ground level]` sessions (1, 1, 2, 2; `afterMatchSessions` in `playFixtures`), the player keeps up to `maxStored` (3) in `GameState.sessions` (`available`, `total` = seed of the draws, `recent`); AI stables spend theirs at once. « Entraîner une créature »: `runSession` draws a healthy creature (not the last one trained), then an attribute of its **program** category below its ceiling: +1, or +2 with `jackpot.base + coach quality × perQuality` (coach of that category). UI: two chained roulettes (the squad stays shown, the drawn one lit gold, the others dimmed; then the program's attributes; ~4–6 s; instant when effects are off). **Programs are physical / combat / mental only** (default `defaultProgram` = `cfg.training.roleProgram[role]`: tank / skirmisher physical, striker / caster combat, support mental; old role / balanced / rest plans map to it; « Selon le rôle » in apply-all resets). **XP comes from matches only** (`matchXp`, ×1.6 to fold in the old training share) × life stage × the coach of the creature’s program (`coachFactor`) × the training ground (+10 % per level); **training touches neither fatigue nor morale and causes no injury; no intensity.** Staff screen: per coach « XP en match ×f · +2 en séance p % · n créatures au programme », candidates compared with the current coach. Training table: no age / next-ability columns. Each level gives `levels.freePoints` (2) points to place in the program's attributes only (`programFocus`; « + » only there). Life stage = `<StageMark>` (▲ developing, ◆ prime, ▼ declining; XP ×1 / ×0.5 / ×0 on hover) in Training, Squad table and cards.
- **Bonds** (discreet, mostly lore; `cfg.combat.bonds`, `Combatant.bonds` from relations ≥ `club.relations.friend` / ≤ `rival`): a friend knocked out makes the other **avenging** (effect, damage ×1.1, 4 rounds; `enrage` event with `reason: 'friendKo'` + `friend`, commentary `friendKo`, rage mark/aura); a friend who already hit the target this round gives +4 % to hit; a rival's hit never counts as teamwork (combo). Match-start morale from relations as before. Encyclopedia › Morale explains it in one sentence.
- **Fatigue retuned** (training no longer adds any): match fatigue = 12 + 52 × stamina spent, weekly recovery 20 + 0.6 × recovery → starters ~19–25 % fatigued before a match (sim:balance), rotation matters.
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
- **Creature cards** (`ui/components/CreatureCard.tsx`): Squad shows cards by default (Cards / Table switch, localStorage
  `fm.squadView`), grouped Starters / Bench / Reserves; art in the element colours, frame metal by level (bronze 1–3,
  silver 4–6, gold 7–9, legend 10 with a shine), rating, level + XP, points to place, condition bars, best medals.
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
  roles, record (`aside`) | abilities | management (`footer`); one column below 1250 px. Competitions list: `CompLine`
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
