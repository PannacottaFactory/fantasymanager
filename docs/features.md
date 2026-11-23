# Fantasy Manager — features & mechanics reference

Detail of every system, screen and mechanic (moved out of CLAUDE.md to keep it short). Search it by keyword
(`grep -n "Board" docs/features.md`) before touching a system; update the matching entry when a feature changes,
add a new bullet for a new one.

## Systems, screens and conventions
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
- **Style guide**: `docs/style-guide.md` (type scale, spacing, radii, surfaces, colour roles, motion; decisions log). Every
  theme token sits in the three blocks at the top of `styles.css`. Fonts are bundled (`@fontsource/inter`, `@fontsource/spectral-sc` — titles —
  imported in `src/ui/main.tsx`, no Google Fonts). Font sizes / radii use the scale tokens (`--fs-*`, `--r-*`, `--sp-*`):
  never a raw rem size or px radius in a new rule. Loops only in the live match, the ribbon's next week, the tutorial
  ring, the ticker and the embers. Shared components (button, panel, chip / tag, tile, table, headings) are each defined
  once (« Component: » blocks): screens may place or size them, never restyle them; a chip variant only sets colours. `node scripts/style-shots.mjs <dir>` (20 screens × 3 themes, fixed world,
  effects off) + `node scripts/style-diff.mjs <before> <after>` (pixel diff) check what a CSS change did.
- UI: four themes — slate (dark blue-grey, default), night (black), dark (brown), parchment (light) — via CSS tokens in `src/ui/styles.css`; localStorage only for
  per-viewer prefs (theme, language, commentary speed, layout).
- **Layout** (⚙ « Disposition », `useSettings().layout`): `side` (default, manager-game style) = sidebar `SideNav` (`NavBar.tsx`,
  same `NAV_ENTRIES` as the tabs, foldable, icons only < 1100 px), top bar with the
  stable colour (`--club`) along its top edge and the stable identity `ClubIdentity` (crest, name, league · place) beside the title; `top` = the former tabs (`NavBar`). The start screen follows the setting too
  (without a game only the tools are enabled).
- **Manager-game screens**: dashboard `NextMatchBanner` (face-off with form, last meeting, assistant tips from
  `nextMatchAdvice` worded with `useTipVars`, arena, starters, Prepare / Tactics / Squad in its header) beside the club card
  (`.dash-lead`: crest + name + rank on one line, reputation bar full width; tiles on two rows below 1500 px); Squad = one table (not grouped: selection is the
  Tactics screen's job), views General (role, condition, morale, HP, the six profile axes `useAxisColumns`, traits) /
  Attributes (all 21) / Contracts (age, value, wage, end), `fm.squadView`; Tactics shows HP, the six axes and traits; no
  « Form » column anywhere (it only nudges match-start morale); attribute columns centred (`col-attr`);
  creature sheet header `.sheet-hero` in the species' element colours (`--el1/--el2`) with a medallion and `ProfileRadar`
  (6 axes, dashed league average of the player's division starters, estimates = middle of the ranges). `ui-check` / `board-check` / `scout-check` force `top` (their helpers click tabs) unless `UI_LAYOUT=side`.
- **Icons**: species & role icons from game-icons.net (CC BY 3.0, credited in Help), extracted by
  `node scripts/extract-icons.mjs` into `src/ui/icons/gameIcons.ts` (edit the lists there when adding a species
  or role); `<SpeciesIcon>` (element colour), `<RoleIcon>`, `<RoleLabel>`; the creature emblem `<Crest level?>` = flat species icon in its
  elements' colours on a dark disc, metal ring by level (bronze / silver / gold / legend; iron when unknown — only the
  player's own creatures pass `level`, never in the arena).
- **Text size**: every font size is in `rem` (base 14 px × `--text-scale`); the viewer picks normal / large (default,
  ×1.15) / extra-large (×1.3) with the « Aa » button. Never write font sizes in px (CSS) or numbers (inline styles).
- **Retro look** (⚙ settings, per viewer, `useSettings().retro / retroFont`, `fm.retro` / `fm.retroFont`): a screen filter
  `:root[data-retro]` = off / crt (scanlines, RGB stripes, vignette) / lcd (pixel grid, green cast) / amber (monochrome,
  `mix-blend-mode: color`), each with square corners (`--r-*` = 0) and hard offset shadows; overlays are `body::before/after`
  fixed with no pointer events (never a `filter` on an ancestor). A separate font `:root[data-retro-font]` = off / titles
  (Silkscreen headings only, most readable) / terminal (VT323, `font-size-adjust`) / pixel (Pixelify Sans). The sidebar is
  `max(188px, 12.6rem)` wide and its labels ellipsize so badges stay inside with large text.
- **i18n**: engine text functions take a `lang` (`Commentator(…, cfg, lang)`, `buildReport(…, cfg, lang)`,
  `generateTeam({ lang })`); the language never changes RNG draws or results (tested). French templates must not
  write `de {x}` / `à {x}` / `que {x}` before a creature (elision), use `{aE}/{tE}/{oE}` for gender agreement;
  `tests/i18n.test.ts` checks this on real matches. Inbox messages are stored as data and worded by the UI.
- **Team talks** (`TeamOrders.talk`, `cfg.combat.orders.talks`, `engine/combat/talks.ts`): before the match and at each break each manager gives one talk to the creatures on the field: rally (morale climbs a share of the way to a target, once), second wind (a share of the missing stamina back, once), focus (+to hit), close ranks (front-line armour vs melee + interceptions), keep moving (ranged / spell hit −), all or nothing (+damage, +stamina costs). Given in `Combat.giveTalk` (constructor after `matchStart`, and `resume()` after every break) → `teamTalk` event (with the morale / stamina it set: view, commentator `teamTalk.<talk>`, marks rally / rest). A talk-only change is recorded in `decisions` but emits no `ordersChanged`. `readTalk(situation)` = the assistant (tired → second wind, shaken → rally, behind in the last period → all or nothing, then the foe's melee share: ≤ 0.4 keep moving, ≥ 0.7 close ranks, else focus); `managerTalk(style, …)` by `AiManagerStyle.talker` (readers and tacticians read, cautious / aggressive / gambler / steady have habits); AI pre-match talk in `applyIdentity`, at breaks in `aiBreakDecision`. The player's `orders.talk` undefined = « Au choix de l'assistant » (`withAssistantTalk` in `fixtureSetup`). UI `components/TeamTalk.tsx` (`TalkPicker`: pre-match panel `data-tip="talk"`, break panel), icons `talk-*`, Encyclopedia rule `talks`, analysis « discours » per break. Focus +3 % to hit (was 1.8 %: too weak to feel), all or nothing stamina costs +10 % (was +20 %: a trap, −4 everywhere). Measured (`sim:talks`, 600 paired, vs a reading opponent): reading +3.5 to +9.5 points, random +1.5 to +7.7, focus a solid all-rounder (+2.5 to +5.7) but second wind still best when tired and ranks vs brutes, all or nothing +0.5 to +4.8 (focus at +5 % was best everywhere, +6 to +11: rejected). **Team risk taking was removed** (it duplicated the approach: low always beat high, and no setting made it situational).
- **Break panel substitutions** (`ui/screens/arena/BreakPanel.tsx`, `SubstitutionDecision { outId, inId, role?, line?, stance? }`): a substitute comes on with a role, a line and an individual order (stance) of the manager's choosing (absent = its bench role, the replaced creature's line, its team-sheet stance), all replayed from `decisions`. In the table, « Remplacer » + who comes on; the order column of a replaced creature becomes the incoming creature's order (bordered in the home colour). « Vos remplaçants » cards are short so the bench sits side by side without scrolling: name, species · level, role (off-role tag), one line of facts (max HP, morale, fatigue; stamina bar only if not full), element match-ups as the crests of the foes still standing (▲ strong against / ▼ vulnerable to, names on hover), abilities, then « Entre à la place de » and, once chosen, role / line / order on a three-column grid.
- **Ability balance pass** (Nov 2026, `npm run sim:abilities`: per ability, uses by the AI and win rate added — same
  matches with / without it; `--only`, `--part i/n` for parallel runs, `--set`; at 1000 matches the noise is ±2 points,
  confirm a suspect at 3000). Rule: no useless ability (never used, or costs matches). AI fixes in `ai.ts` /
  `cfg.combat.ai`: no-damage abilities keep only `debuffPriority` (0.3) of the target-priority bonus (curses used to beat
  attacks on the priority target); area attacks get the priority bonus when they catch the priority target (a plain
  blow nearly always beat a breath); cries / auras on a line or every foe weighed by `cryWeight` (0.7); stamina reserve
  (`staminaReserve` 0.5, `reserveMinCost` 12: a filler that would leave too little for a big ability back next round
  scores less — the dragon used to fritter its breath away on Rend); healing cuts worth little without a foe healer,
  silences without foe spells; a stun weighs ×3; ally fury buffs go to the hardest hitter, spell mirrors only vs casters;
  self evasion / rage / camouflage / frenzy scored by line and wounds. Mantis Stance = effect `poised` (dodge +15 %,
  next attack ×1.6, crit +20 %, `EffectDef.consumedOnAttack`). Data: slowed −12 % dodge −4 % hit, terrified −12 % hit,
  evasive +22 % dodge; a few weak abilities buffed or cheaper (Rend cost 5, Constrict, Lance Charge, Tail Crush, Life
  Drain, Crimson Feast, Chill Touch, Gale Wings, Boulder Throw, Screech, Pan Pipes, Death Wail) and four control spells
  deal a little damage (Harrowing Shriek, Evil Eye, Curse of Frailty, Hypnotic Gaze). Result: abilities add +3.75 points
  on average, none measurably negative, the rarest are situational self-buffs (0.3–0.6 uses a match). League KO ≈ 49 %.
  Species 35–70 % in `sim:species`; shade, vampire, lich, giant bat, sphinx, seraph, banshee, myconid repriced up,
  kraken down. Ability cards and the Encyclopedia show each effect's duration (`effectDuration`, ⧗).
- **Ability tuning pass 2** (Nov 2026): every ability with a cooldown ≥ 3 except heals and buffs lost one round; `AbilityDef.aiWeight` (score × it in `chooseAction`, default 1) tunes per ability how eagerly the AI uses it, `sim:abilities --weight w | --wmult m | --override file.json` tries a weight or a data variant without editing the data. Method: measure every cooldown ability (`sim:abilities`, 1500 matches: at 500 the noise is ±3 points, at 1500 still ±2), then for each one that cost matches or was hardly used, try AI weight ×0.6 / ×1.6, a data buff (damage +12 % and cost −10 %; no-damage ones cost −20 % and chances +0.15 or a round more) and buff + ×0.6, keep the smallest change that makes it worth it (≥ +0.5) and used (≥ 0.8 a match), three rounds. Abilities costing ≥ 1.5 points: 15 → 6 (left within the noise); a weight chosen from one noisy run can mislead: three charges pushed to 85–94 % use cost their species 5–7 points in `sim:species` and were put back to 1 — check species after any weight change. Still rarely used (< 0.8 a match): ~25 self-buffs, cries and curses whose effect is too small to beat a blow (they need a real rework, not steps). Strongest kept a little in check: toxic spores, sonic shriek, qilin blessing. `sim:variety` (top-action share 57 → 55 %), league KO ≈ 52 %, `valueMult` recalibrated for the species that moved ≥ 3 points (species 33–73 %).
- **Forecast & upsets** (`engine/report/forecast.ts`, `cfg.report.forecast`, UI `components/Forecast.tsx`): before a match the
  assistant's chance of winning = logistic(slope × gap) of the starters' average rating × (1 − fatigue × 0.35), the
  opponent's from the player's estimates (`overallRange` middle; « ~ 37 % » when they are little known); band (grand favori …
  gros outsider) in a card under the pre-match face-off: big % per side, the band in title font coloured by tone, « estimation grossière » when little known, a thick split gauge (home / away crest colours, 50 % mark) that fills once. Stored at kick-off in `MatchRecord.forecast` and the
  `matchResult` message; a win at ≤ 40 % = « Exploit ! » (≤ 27 % « Exploit retentissant ! »), a loss at ≥ 60 % = « Faux pas »:
  stamp in the report (verdict) and the Journal reader, « ! » in the Journal list. Calibrated with `sim:upsets --league`
  (prints predicted → actual; ±2 points per decile). Measured: in the league the weaker side wins ≈ 31 % (21 % even 10
  rating points below), but matches settle early (≈ 1.2 lead changes a match; the leader after the 3rd break wins 88 %).
- **Touched by grace** (`cfg.combat.grace`, effect `graced`, event `grace`, `Combat.maybeGrace` at each round start, own
  stream `rng.fork('grace')` so matches without it are unchanged): from round 3, while a side trails by ≥ 15 judges'
  points or has fewer creatures standing, each of its creatures may rise above itself (chance 0.5 % a round × (5 +
  courage) / 15: courage 1 ×0.4, 20 ×1.7, no link with talks), once per side and match: until the end, damage ×1.7, hit /
  dodge +15 %, crit +10 %; full stamina, +50 % health, morale +30. Commentary `grace.<reason>`, key moment, golden mark +
  aura `aura-grace`, verdict factors `graceOurs` / `graceTheirs`, Encyclopedia (morale rule, courage). `sim:upsets`
  measures it paired (same match replayed without it): in ≈ 20 % of league matches, the side touched wins ≈ 35 % instead
  of ≈ 16 %, 63 % of the time the weaker side; upsets +1.3 points, late comebacks hardly moved.
- **Elements made visible**: a blow on a weakness / resistance (`elementEdge`: `elementMult` ≥ 1.2 / ≤ 0.85, same thresholds as the commentary) puts a chevron mark beside the damage number on the target card (`.float .elem-mark`: double chevron up, green with a glow in the attacking element's colour = effective; chevron down, grey = resisted) and an « Efficace ! » / « Résiste » `.edge-chip` on its chronicle line; Analysis › « Éléments » (`SideAnalysis.elements`, `elementCreatures`: effective / resisted blows, damage added / lost per side and per creature, taken extra / spared) + insights `elementsFor` / `elementsAgainst` (net gap ≥ 40).
- **Live match visuals**: `ui/screens/arena/matchFx.ts` turns events into card reactions (attacker glow/lunge,
  target shake + floating number, ghost HP bar; a floating number lives `FLOAT_MS` 1.9 s and stays on its card while later blows land elsewhere: `keepRecent` in `LiveMatch`); hovering a commentary line highlights actor & target
  (`CommentaryLine.actor/target`).
- **Skills** (Nov 2026, replaced the ★ favourite moves): every species = `basic` (1 attack, cooldown 0, known from the
  start) + `skills` (exactly 5, in unlock order, levels `cfg.combat.skills.unlockLevels` = 1 / 2 / 4 / 6 / 8). The pool
  (`skillPool`) = basic + unlocked skills; the manager equips up to `cfg.combat.skills.equipped` (2) of it, **the basic
  attack counts as one**: `Tactic.skills[creatureId]`. Undefined = not set up = `defaultSkills` (basic + latest unlocked
  skill); an explicit choice is kept as is (`equippedSkills`, invalid / locked ids dropped; all locked by ageing → the
  default); an empty one stays empty and blocks the match (`validateTactic` issue `noSkill` for lineup and bench,
  `repairTactic` gives the default back). `toggleSkill` = a click (equipped → off, otherwise on, replacing the one
  equipped longest ago when full), `setSkill(team, id, ability)` in `engine/team/edit.ts`. `getAbilities(c, chosen)` =
  the equipped ones only = the combatant's whole kit; the combat AI picks among them (rests when nothing is ready; no
  favourite bonus any more). AI stables with an identity equip their style's skills first (`styleSkills`, difficulty
  flag `styleSkills`), the others the default. UI `components/SkillPanel.tsx` (count / « Aucune compétence » warning,
  basic attack then the five with « Niv. n », locked / « Équipée », click to toggle) in the creature sheet and the
  Tactics « Compétences » column picker (« Aucune compétence » chip). 14 shared skills were added for the kits (brace,
  mob rush, finishing blow, backstab, hunter's mark, arrow volley, flurry, pack howl, web spray, dissolve, thorn volley,
  cauterize, tempest, snare); `oni-challenge` (« Défi », taunt) is shared by most tanks; sling and tide kick were
  dropped. `sim:abilities` measures each (species, kit entry, basic included): equipped with a partner vs the partner
  alone, and its rank among the species' six.
  Measured (1000–1500 paired matches): an equipped second option adds +7.8 points on average; the near-zero ones were
  reworked into « hit and … » attacks with a self effect (blink / mirage / scurry → evasive, vanish → camouflage,
  blood frenzy → frenzied, rampage / moon howl → enraged) or got a little damage (dread 9, strangling vines 8, deep
  freeze 8, web 6, chilling howl 5, blight 5); bramble horror got barkskin instead of sap mend, crystal golem seismic
  slam instead of blinding flash. Every kit entry now ≥ +1 except brace on the skeleton (−0.7, noise) and dread on the
  hellhound (−0.5, noise). Species prices (`valueMult`) not recalibrated yet.
  **Heal floor** (`cfg.combat.ai.healFloor` 0.6): role AI weights heal at 0 for tank / striker / skirmisher (0.4 caster), so a
  heal equipped outside the support role was hardly ever used (treant sap mend −2.4, pixie fey mend 0.3 a match); the heal
  score now uses max(role.heal, floor). With healing song 24 / 9, sap mend 18 / 8 / cd 2, fey mend 21 / 7 / weight 1.6: +4.7,
  +6.2, +7.3; every heal ≥ +2.6, none costing matches (1000 paired).
- **Stamina gauges**: abilities cost stamina (no mana). A `spend` event (cost, stamina left, cooldown) precedes each
  ability/guard so the live view drains gauges and refills cooldown chips; the commentator ignores it.
- **Visual effects** (display only): setting `effects` (full / reduced, ✨ button, default = system reduced-motion,
  `effectsOn()`, `:root[data-effects]` turns CSS animations off). `ui/fx/FxLayer.tsx` = app-wide particle canvas
  (`fxLayer()?.confetti() / fireworks() / sparkle() / coins()`), `ui/fx/Celebrations.tsx` = toasts for new inbox
  messages that matter (level-up, ability, signing, trophies, death), worded by `wording()` from the inbox. Toasts stay until
  clicked (opens the matter) or dismissed (✕); 4 shown at once, « Tout fermer (n) » above them when 2+ wait. Live match:
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
  League, 3 Pit League (names in `ui/competitions.ts` `divName`, emblems `DIV_ICON`). The player starts in D4
  (`cfg.league.playerDivision` 3, quality novice; easy: regional via `DifficultyDef.playerQuality`). Money ×1.35/1/0.75/0.55,
  reputation baselines 64/46/30/18. 2 up / 2 down between each pair.
- **Competitions**: the Shadow Cup (`state.cup`, 40 stables: 24 byes, 6 rounds after matchdays 2/5/8/11/14/17) and
  `state.tournaments` (`engine/league/tournaments.ts`, generic knockouts with a preliminary round when needed):
  pre-season (player + 3 of its division, before matchday 1), a cup per division (own names, never the league's: Coupe de la Poussière D4, des Bannières D3, du Griffon D2, de l'Empyrée D1), the Champions Cup (best four of the
  Grand Arena last season), three invitationals (marches « Joute des Lanternes » rep 0, argent rep 35, or rep 55; entry fee,
  `registerTournament` replaces the least famous entrant before round 0, expense `fees`). Each round has a key in
  `cfg.league.tournaments` (after that matchday; decimals = a later midweek); the player's competitions never share a key.
  Fixtures: `competition: 'cup' | 'tournament'` + `tournamentId`; league fixtures have none (`!f.competition`).
- **Weeks**: `midweekKey` = earliest due key among cup and tournament rounds; `cupDue` = a midweek is due;
  `playMatchday` plays it first (`playCupRound` plays every round of that key). `playerFixture` returns the player's tie
  in a midweek (or nothing). In the UI, « Next match » plays midweeks without the player on their own up to its next match.
  Cup messages carry `tournament` / `rounds`; `SeasonRecord.trophies` lists the season's tournament wins.
- **League screen**: tabs Championship (manager-game layout, fits 1920×1080: strip of the 4 divisions with the money
  scale « po ×1,35 » and « Vous · 6e » (`DivisionStrip`), compact division header (rules, weeks played, place + gap chips),
  the table (zones with dashed edges, ▲▼ since the previous matchday, « Prochain adversaire » tag, points pills), side column:
  matchday with ‹ › (`Matchday`, `MatchLine` cards also used by the competition brackets) and « La saison » card with tabs
  Position (`PositionChart`: place after each week over the zones) / Chiffres (`TeamLeaders`: most KOs, fewest KOs taken,
  form over the last five)); divisions read left (D4, bronze) to right (D1, platinum): `.tier-3` bronze, `.tier-2` silver,
  `.tier-1` gold, `.tier-0` platinum (darker variants on parchment). Competitions tab = master / detail: « Votre saison »
  chain (whole season folded, `cal.full`), list of competitions grouped (in / registration / the rest, other leagues'
  cups), detail of the chosen one (`CompDetail`: banner in `--comp`, trophy, status, your next tie, registration,
  `Bracket` = rounds as columns of `BracketTie` cards). Honours tab: KPI strip, three shelves (league titles bronze →
  platinum, cups, tournaments) of `TrophyStand` plinths lit when won with the seasons, seasons table (league in its metal,
  promoted / relegated chip, W–L, board objective, trophies).
- **Staff screen** (`StaffScreen.tsx`): KPI strip, a card per program in its colour (`--dom`: physical / combat / mental):
  emblem, coach, stars, match XP ×, +2 chance, the creatures on the program (crests open their sheets), wage, dismiss — or
  « Trouver un entraîneur » filtering the candidates; candidates one line each (domain filter, XP ×, +2 %, gain over the
  current coach, wage, hire · fee).
  Competitions (« Votre programme » = the player's coming matches grouped by week — pre-season, then week d = league
  match ① then the rounds keyed d / d.5 ② —, next match highlighted, « deux matchs » flag; then every competition as a
  list (default) or cards, choice in localStorage `fm.compView`: description, status, field (still in / favourite =
  most famous still in / winner), next round + week, tie, trophy, registration, draw), Honours (trophy cabinet with greyed trophies still to win, season by season).
  Competition colours: `.def-<id>` sets `--comp` (league, shadow, champions, division, or, argent, marches, preseason),
  used by `.comp-badge` (schedule, pre-match title). Emblems are game-icons: `<CompIcon def>` / `<DivIcon d>` (`COMP_ICONS`, `DIV_ICONS` in `scripts/extract-icons.mjs`: crown, fleur-de-lys, castle, watchtower), no emojis.
- **Selection** (`selectionScore`, assistant + AI line-ups, `repairTactic`; break substitutions `benchScore`; star requests `starsOf`): the overall rating (attribute average, species included) × fatigue, never the hidden aptitude — picking on the aptitude lost ≈ 7 points of win rate (a gifted kobold over an average death knight) and the verdict's « better creature on the bench » blamed the assistant's own choice.
- **Roles from the kit** (`bestRole(c, chosen)`, `kitFit`, `servesRole`, `RoleDef.kit` in `data/roles.ts`): the role the
  assistant, the AI line-ups, `repairTactic`, the editor and the bench give a creature reads its attributes, its species'
  natural roles (+1.5) **and the skills it takes into the match** (the manager's choice, the AI's build, else the default
  ones). Without a skill serving the role the fit loses `missing` (support 10: a heal or a buff / help for allies; caster 6:
  a spell or a debuff; skirmisher 4: a ranged blow or a dive; striker 3: a melee blow), each serving skill adds `each`
  (two at most). « Laisser l'assistant choisir » keeps the player's equipped skills (it used to drop them). The Squad
  « best role » column reads the equipped skills too.
- **Starting squad**: the player's creatures keep their drawn strength but little room to grow
  (`generation.startingSquad`: potential = ability + gap × 0.35, at most 101 = 6★); stars come later (market, prospects).
- **Stable names** (`generateTeamName`): six kinds (adjective + noun, noun of place, order of emblem, order of place,
  standalone, figure's troupe), same draws in every language (indices modulo each list); French names carry no leading
  article (« face à Les … »). EN / FR team-name lists are index-aligned (same draw = same name translated).
- **Name cultures** (`data/names.ts`, 24): winged beasts `beast`, wolves / hounds / werebeasts `wild`, raptor / salamander
  `saurian`; surnames index-aligned with `FR_SURNAMES` (tested). Syllables are joined without a doubled vowel at the
  seam. Coaches: 40 % a person's name (`personName`, the managers' pool), else a creature name of a random species.
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
- **Traits that change** (Nov 2026, `engine/progression/traitEvolution.ts`, `cfg.traitEvolution` in
  `data/config/traits.ts`): purely random, nothing in the match decides (a first version with marks left by match
  signals was dropped: hard to balance, 86 % good news, a few traits everywhere). After each match (`playFixtures`, after
  deaths) `evolveTraits` gives each stable `chance` (25 %, ≈ one change every 4 weeks) that one creature that played
  changes: `gainShare` (60 %) a gain among `gainableTraits` (not held, no opposite held; match-only traits included),
  else it loses one of its own (no traits → always a gain); a creature already holding `maxTraits` (3) that gains loses
  another at random (`replaced`). Stream `deriveSeed(worldSeed, 'traits', season, fixtureId, teamId)`, never touches a
  result; same rules for AI stables. Logged in `Creature.traitLog`; the player gets an inbox `trait` message with a
  generic sentence (`line` 1–3, `msg.trait.line.<changeKind>.<n>`: quality / flaw / double-edged × gained / lost) and
  « Le trait X disparaît » for the trait pushed out (toast only for good news), a « Nouveau » tag on the chip for 6
  weeks (`newTraits`, `TraitChips`), the last 3 changes in the sheet. Encyclopedia rule `traits` and « Origine » fact.
  21 new traits, drawn at birth in new games (a seed still gives the same world, but not the same one as before they
  existed): complacent, tireless, elusive, sharp-eyed, thick-skinned, finisher, second-wind, economical, gentle-hands,
  heavy-handed, glass-jaw, sluggish, inspired, timid, wary, focused, jinxed, iron-will, brawler; only after matches
  (`acquired: true`, never at birth): battle-scarred, traumatised. Second batch (21 more, drawn at birth): quick-footed, hard-hitter,
  acrobat, bulwark, arcane-gift, scatterbrained, mean-streak, gentle-soul, slow-witted, tactician, crowd-pleaser,
  sore-loser, rousing, selfish, tough-as-nails, skittish, deadeye, short-winded, merciless, thin-skinned, rebel (combat
  effects only). Traits outside the arena (`engine/creature/traitPersonality.ts`, were declared but read nowhere
  until Nov 2026): `training.gainMult` × the weekly progress (`traitTrainingMult`), `personality.ambitionMod` in
  `ambitionOf` (wage asked, ambitious free agents' bonus), `personality.loyaltyMod` taken off it in `leaveDrive` (star
  requests « leave »), `personality.moraleVolatility` × the after-match morale change. New trait hooks in the formulas: `hitBonus`,
  `dodgeBonus`, `mitigationBonus`, `healMult`, `staminaRegenMult`, `staminaCostMult`, `woundedTargetMult` (below
  `combat.damage.woundedBelow` 0.4, also in the AI's expected damage).
- **Levels & XP** (`engine/progression/levels.ts`, `cfg.training.levels / xp`): the player sees a level 1–10 and
  0–100 XP; underneath, levels are steps of the hidden aptitude (`ability`, 1–200; `levels.steps` = [28, 40, 50, 60,
  72, 86, 102, 120, 142, 168]: short at the bottom so modest creatures still climb, long at the top), which still drives the
  attributes, AI and prices. Max level = level of the potential. Skills unlock by level (`skillLevel(i)`,
  `unlockedSkills`, see « Skills »). XP per week = training share of the former gain (none while resting /
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
- **Melee mix** (`cfg.combat.mix`): melee skill to hit = 60 % attack + 20 % accuracy + 20 % technique (was 70 / 0 / 30), melee
  power = 80 % strength + 20 % technique (was strength only); ranged unchanged. +3 everywhere (`sim:attributes`, 1500 paired):
  strength +11.9 → +7.5, attack +6.2 → +4.2, technique +4.8 → +5.6, accuracy +1.7 → +3.2. Brutes hit softer: base HP 68 → 65
  keeps the KO rate (regional batch 42.6 %).
- **Attributes all count** (`sim:attributes`, +3 on every starter ≈ +2 to +5 points of win rate, strength / toughness ≈ +9–10,
  accuracy only for ranged creatures): the weak ones got an effect centred on 10 (an average creature is unchanged, below 10
  is a malus) — speed = dodge (`hit.dodgePerSpeed`) + initiative, composure = to hit (`hit.perComposure`), leadership = the
  best leader on the field gives allies to hit (`hit.perLeadership`, `Combatant.led`), courage = front-line armour
  (`damage.courageFrontPerPoint`), determination = lighter exhaustion penalties (`fatigue.determinationPerPoint`),
  discipline = cheaper abilities (`stamina.disciplinePerPoint`), aggression ±2 %/pt damage (`aggressionBase` + per point),
  teamwork combo (`comboBase` + per point), recovery regen ×2 (`regenBase` −1, `regenMin`). A level (+2) on one creature
  ≈ +1.5, on the five starters ≈ +5; five levels on all ≈ +22.
- **Fatigue**: pre-match fatigue removes up to 70 % of the stamina pool, penalties start below 60 % stamina (up to
  −40 % hit/damage/initiative/interception) — on the chance to hit only `fatigue.hitShare` (0.57) of it, ≤ −20 % (late-match misses felt unfair:
  rounds 16–20 hit 57 % → 62.5 %, whole match 67 → 70 %; tired squad lever −22 → −18; base HP 65 → 68 kept the KO rate, back to 65 with the melee mix below) and injuries are ×(1 + fatigue/100).
- **Training intensity** (`cfg.training.intensity`): light ×0.6 growth, −8 fatigue, +1 morale; intense ×1.4 growth,
  +16 fatigue a week (after recovery, so carried into the match), −2 morale, 3 % injury a week (× proneness/10).
  The select's tooltip shows these numbers (`intensityDesc`). Match injuries: KO 8 %, heavy hit 1 % (≈ 0.8 per match, `sim:injuries`: ≈ 1.4 injured per stable, 4+ out ≈ 7 % of weeks); squads up to 20 (`economy.club.maxSquad`, AI stables keep ≈ 12–13);
  death chances lowered (1.6 / 16 / 40 %) to keep deaths flat. Free agents' signing bonus = 55 % of value (no fee). Very ambitious free agents (ambition ≥ 16) never refuse a small stable (reputation < 35):
  they ask the bonus ×1.25 (`freeAgentBonus`, `ambitiousFor`), said up front in the sheet and « ▲ » on the recruitment bonus.
- **Encyclopedia › Attributes**: each attribute lists what it does in the arena with the config numbers
  (`attributeVars`, `at.*` texts), the roles weighing it and the best species.
- **Economy** (phase 3, money in gold pieces: "po" in French, "gp" in English): all numbers in `data/config/economy.ts`. Player actions in
  `engine/economy/actions.ts` return `{ state, outcome }` (UI words the outcome; `useGame().act(f)` saves).
  AI bid answers are deterministic (`deriveSeed(world, 'bid', season, matchday, creature, attempt)`).
- **New signing unveiled** (`ui/screens/game/SigningReveal.tsx`, store `signings` = `{ id, before }`, not saved): any creature
  joining the player's stable (bid, free agent, emergency signing; not a change of stable) is queued by `commit` with its
  knowledge before; its card turns, the 21 attributes then the rating and potential close in from the ranges to the truth
  (staggered), a stamp says lucky / as expected / disappointing (where the truth sat in the range the player knew). Shown
  over the creature sheet, after the match / training / weekly windows.
- **Contract talks** (`ui/screens/game/ContractTalks.tsx`, store `contractTalks`): opens with the `contractExpiring` warning
  (4 league weeks before the end) and from that Journal message: every contract ending this season, value, wage, demand per
  1/2/3 seasons (delta vs the wage), Extend (`renew`) / Let go (display only: the contract simply runs out).
- **Competition prizes**: each round's prize is paid to every winner of that round; `CompDetail` shows `Prizes` (per round,
  winner in all, runner-up, entry fee, what the player won so far) and the banner's « Le vainqueur empoche » = sum of rounds.
- Pre-match « Pauses » toggle (`.manage-breaks`, role switch, icon `breaks`) replaces the old checkbox.
- **Scout hold** (`scouting.holdWeeks` 3, `scoutHeld`, `ScoutingState.held`): a creature under a scout mission and for 3 weeks after the
  report neither drifts away nor gets cut from the free agents, no AI stable signs / buys it, and it stays in « Sélection pour vous ».
- **Coach market turnover** (`weeklyCoachMarket`, `coaches.marketTurnover` 0.12): each league week a candidate may leave, replaced by a
  newcomer of the same domain (own stream `coachMarket`); the whole market is still redrawn at the season change.
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
- **Board** (`engine/club/board.ts`, `cfg.club.board`, UI `screens/game/Board.tsx`): confidence moves with every match
  (KO win +3, win +2, points loss −1, KO loss −2; losses × difficulty `boardLoss`) and every league week from week 3
  (`weeklyBoardStanding`: on course for the objective +1, 3+ places short −1). Mood (`moodOf`: delighted ≥ 75, content
  ≥ 50, uneasy ≥ 30, angry) sets the **recruitment budget** (`recruitmentBudget`: one purchase ≤ 100 / 75 / 50 / 25 % of
  the treasury; `bid` / `signFreeAgent` → error `board`) and works (`worksFactor`: −20 % delighted, frozen angry;
  `playerUpgradeCost`). Angry ⇒ **ultimatum** (`board.ultimatum`: 2 wins out of the next 4 *league* matches; met +12,
  missed: reputation −5 + recruitment frozen 4 league weeks `board.frozen`; `cooldown` 6). Messages `boardMood`,
  `ultimatum`, `ultimatumOver`; `board.trend` = last 12 weeks. No sacking (career mode later). UI: dashboard `BoardCard`
  (chair `chairName`, mood pill, zoned gauge + trend, objective vs place, effect chips, ultimatum pips, rules window),
  « Réunion du conseil » window (`BoardMeeting`, store queue `boardNotes` for boardObjective / ultimatum / ultimatumOver /
  boardVerdict, after the reveals; the first objective opens after the welcome window), pre-match `UltimatumBanner`,
  board block in the week summary, budget chip in Recruitment, ticker. `sim:board` (autopilot, normal: ~22 % of weeks
  angry, 0.75 ultimatum / season). `node scripts/board-check.mjs <outDir> <url>` screenshots it.
- **Supporters** (`engine/club/fans.ts`, `cfg.club.fans`, `GameState.fans` — absent in old saves = mood 50): mood 0–100
  moved by every player match (`weeklyFans`, in `playFixtures`: home KO win +6 / win +4 / loss −2 / KO loss −5, away
  +4 / +3 / −1 / −3; from the 3rd win or defeat in a row ±2 more), trophies +8, promotion +12, relegation −12
  (`moveFans`), drifting 6 % back to 50 each league week (`fansDrift`). Home ticket revenue × 0.7 … 1.3
  (`fansTicketFactor` in `ticketRevenue`, player only). Tiers (`tierOf`): euphoric ≥ 80, enthusiastic ≥ 60, loyal ≥ 40,
  grumbling ≥ 20, furious; a new tier = `fansMood` message + toast. UI `ui/components/Fans.tsx` (`FansMeter`, `FansPill`,
  `ticketDelta`): dashboard card, Finances KPI, week summary, ticker; icon `fans`. Measured in `sim:board` (normal ≈ tickets ×0.98 on average).
- **Star requests** (`engine/club/requests.ts`, `cfg.club.requests`, `GameState.requests` / `lineups` / `recordBase` /
  `greatSeason`): the player's best 4 (`starsOf`) may ask — **playtime** (fit in ≥ 3 of the last 4 matches, started ≤ 1;
  `recordLineup` after each player match), **leave** (ambition ≥ 12, a bigger stable that can pay value × 1.1–1.35),
  **raise** (great season: ≥ 12 matches at ≥ 6.8 average, or a run of ≥ 8 at ≥ 7 this season, or paid < 80 % of its
  worth; asks max(worth, wage × 1.25)). `weeklyRequests` (league weeks, own RNG stream): ≤ 3 per season, 4 weeks apart,
  one open at a time, once per creature per season, 35 % weekly chance; 2 weeks to answer, silence = refusal (`expired`).
  `answerRequest(state, id, choice)` with `REQUEST_CHOICES` (playtime: promise / refuse / list; raise: accept /
  compromise / refuse; leave: raise ×1.4 / sell / refuse). A promise = 2 starts in the next 3 matches the creature is fit
  for: kept +8 morale, broken −20 and friends −8 (`requestOutcome` message). Measured in `sim:board` (≈ 1–1.5 per season
  on autopilot). UI `screens/game/Requests.tsx`: choices with their consequence in the Journal (`RequestActions`), the
  answer once given, `RequestNote` in the creature sheet; toast, ticker, help.
- **Career mode** (`engine/club/career.ts`, `cfg.career`, `GameState.manager` — absent in old saves = no career): option
  at new game (`NewGameOptions.career`, `ironman` only with career; start screen « Mode de jeu » Libre / Carrière cards +
  Ironman checkbox, `SlotMeta.career / ironman` on the slot cards). Every game autosaves into one slot anyway; **Ironman**
  closes the only way back: `playLive` saves the week already played (simulated) before the live match starts, so
  leaving it (closing the page) counts as played; finishing it live overwrites that save. UI `screens/game/Career.tsx`:
  `JobCentre` (locked window while `unemployed`, worded from the last `sacked` / `resigned` message), `JobOfferActions`
  under `jobOffer` messages (take / decline; rescue offers get no toast), `ManagerCard` on the dashboard (reputation
  /100 + bar + last change, Ironman tag, « à X depuis… », last-warning chip, offers waiting → Journal, stables managed,
  « Démissionner » → `resign(state)`: job `end: 'resigned'`, reputation −2, offers from stables within reach, never the
  one left). The board's rules window shows the career rules instead of « cannot dismiss you ».
  **Manager name** (`manager.name`, `NewGameOptions.managerName`, 30 chars; new-game field beside the stable name,
  placeholder `randomManagerName`, used when left empty) shown on the career card and the career page.
  **Career page** (`screens/game/CareerScreen.tsx`, nav Club › « Carrière », icon `nav-career`, also from the career
  card; on the dashboard the board and career cards share one compact row, `.dash-pair.two`): hero (name, mode, difficulty, Ironman, current stable, reputation), tiles (seasons, league W–L + %, titles,
  cups & tournaments, promotions / relegations, objectives met, highest league reached), stables managed (seasons
  completed, trophies), reputation curve per season (career mode, one series, hover per point), season-by-season table
  (`SeasonRecord.won / lost / objective / met`, trophies as icons, current season in italics). Works in free mode too.
  `sim:career -- --worlds 8 --seasons 4 [--policy climb]` measures sackings, offers, reputation (autopilot = AI line-up,
  free points & sessions used, best contracts renewed: without that the squad bleeds and sackings are wildly
  overstated) — normal ≈ 0.1–0.15 sackings / season, easy 0; the two weakest stables of a division get the objective
  `survive` (« éviter les 2 dernières places ») instead of mid-table;
  `node scripts/career-check.mjs <outDir> <url>` checks the start screen fit and forces a sacking. `manager.reputation` 0–100 (start 20) moves at each season change (`careerSeasonReview`, before
  promotions: objective met / missed — `SeasonRecord.met` —, title, promotion, relegation, trophies, × division weight,
  gains shrink near the top); `manager.jobs` = stables run (`end`: left / sacked); `SeasonRecord.teamId / teamName`.
  **Sacking** (career only): the 2nd missed ultimatum of a season in the same job (`manager.strikes`, the 1st one is a
  last warning: `ultimatumOver.warning / sacked`, worded by the board meeting) or, at the end of the season, objective
  missed with confidence < 20 before the verdict (not if the job started after week 6 of that season) → `pendingSack`,
  handled by `weeklyCareer` at the end of the league week → `unemployed`, reputation −5, `sacked` message,
  2–3 **rescue** offers from stables in trouble (at least one, never the stable that sacked you); `playMatchday` /
  `playCupRound` / `startNextSeason` return the state unchanged until `acceptJob`; the last offer cannot be declined.
  **Offers** (`JobOffer`, `jobOffer` message): `poach` at the season change (`seasonOffers`, stables with reputation ≤
  manager + 8 and ≥ current club + 4, until week 3), `vacancy` mid-season (weeks 6–15, 5 % a week, a stable doing badly).
  **`takeOver(state, teamId)`** (pure): old stable → AI (new identity with `gen` → new `managerName`, held free points
  placed by `placeHeldPoints`, AI tactic, knowledge of its creatures 90), new stable loses its identity; cleared: sale
  list, offers, bids, training plans, open requests, line-ups, sessions, youngsters (released), fans, tournament
  `registered`; fresh board (new objective, 6 weeks without ultimatum; message unless the season is over); kept: inbox, knowledge, bestiary,
  ambitions, replays, memorial. `newJob` message. Tests `tests/career.test.ts`.
- **Scouts** (`economy.scouting`): sent straight from every recruitment card / row (`ScoutSend` in `RecruitScreen.tsx`,
  icon flies to the « Recruteurs » tab: `ui/fx/scoutFlight.ts`; refused when busy, own or already known ≥ 90 → `known`).
  A creature report stores `before` (knowledge) + `verdict` from the estimates only (`scoutVerdict`: gem = potential ≥
  squad's best-five max level + 1 and price ≤ 60 % of its value at that potential; star = +2 priced like it; good; below).
  The store queues fresh reports in `reveals` (not saved); `ScoutReveal.tsx` stages them once no match / training / summary /
  sheet is open: card flips, ranges narrow from `before` to 90 (stars, rating, five strongest points), scout's line
  (`scout.line.<verdict>.<0-2>`), verdict stamp; « Revoir le rapport » in the Journal. **Gem window**: `scouting.gems`
  (quiet `gem.quietWeeks` 3 → `gemNoticed` message, `Creature.hype` ×1.3 on its value and +25 aptitude in AI choices for
  `hypeWeeks` 8 → removed); signed while quiet = never hyped. Cards show « Pépite · n sem. » / « Convoitée ».
  `node scripts/scout-check.mjs <outDir> <url>` screenshots the whole flow (dev store on `window.__fm`).
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
  order and favourite abilities; the manager sets aggression and break behaviour (team risk taking was removed: it duplicated the approach) (`Tactic.ai`, read by
  `Combat.sides[].ai` so `aiBreakDecision` uses it everywhere). Managers who "read" the opponent pick the target
  from its line-up (`counterTarget`) before the match and at breaks. `GameState.difficulty` (easy / normal / hard,
  chosen at start) sets division tiers, style share, identities on/off, who reads, favourites, AI rest threshold,
  player's starting money, board losses. The opponent's temperament is shown before the match; styles never are.
- **Saves**: `GameState.version` 5; `loadGame` runs `migrateGame` (v1 → economy, v2 → staff, plans, youth, v3 → divisions,
  v4 → identities + normal difficulty).


## Arena rules (current)
5 starters + 3 bench, 2 abstract lines (front/back). Max 20 rounds; breaks after rounds 5/10/15 with up to
3 substitutions. A team with nobody standing loses by KO; otherwise judges' score = % of opposing health removed, net of healing,
over every opponent that entered (those taken off count with the health they had left; `judgeScore` in `Combat`,
`judgesScore(view)` for the live band — the same formula, tested in `tests/judges.test.ts`). Counting healing made healers
too strong, so healing was halved (`heal.statBase` 0.28, `statPerPoint` 0.02): the side that healed clearly more now wins
≈ 54 % of points decisions (39 % when healing did not count), support species ≈ 50 % in `sim:species` (`sim:judges`).
Then tank role armour +3 % → +2 % (the tank's job is intercepting), support healing bonus +25 % → +15 %: tanks + healing
(fortress) 65 → 62 %, purify 59 → 55 % in `sim:archetypes`; phoenix `valueMult` 1.08 → 1.5. A striker hits as hard from
the back line (melee ignores the attacker's line) but moving strikers back costs ≈ 4 points (thinner front line).
League points (phase 2): KO win 3, points win 2, points loss 1, KO loss 0.
**Relations** (`engine/club/relations.ts`, `club.relations`): −100…+100 per pair of stablemates, friends ≥ 60, rivals
≤ −50. Drawn at game start (2 friendships, 1 rivalry per stable). Then only random **moments** (`weeklyRelations`, own
stream `deriveSeed(world, 'relations', …)`): each week a stable has `momentChance` 15 % of one, the pair drawn with
weight ×3 for that week's starters; good with 50 % (+10 % per team player, −10 % per hothead in the pair). Good: friends
at once (75), or rivals reconcile (0). Bad: rivals at once (−60), or friends fall out (0). A moment that changes nothing
tries another pair. Wear (own stream `relations-fade`): each week a bond (friends or rivals) whose pair did not both
start has `fadeChance` 1.5 % to go back to neutral (`friendsFaded` / `rivalsFaded` message). `relation` inbox message with a scene (`moment.good|bad.0–9`) + its consequence. No gain from
fighting together any more, no separate quarrels. Effects unchanged: match-start morale ±4 per teammate (cap ±8),
friends add +4 % to the combo and avenge a fallen friend (`avenging`), a rival's hit never counts as a combo. Shown on
the creature sheet (friends / rivals chips).
**Deaths (rare)**: after a league/cup match, a creature knocked out that picked up an injury dies of it with
`cfg.league.death.chance[severity]` (moderate 2 %, severe 20 %, career 50 %) × the infirmary factor — own RNG stream
(`deriveSeed(world, 'death', …)`), so match results never change. `bury()` removes it (friends mourn, whole stable
−6 morale), `death` inbox message + news, `GameState.fallen` = memorial in the Pantheon (with a snapshot of record, traits, scars). ≈ 3–4 deaths per season
in the 20 stables (one every ~5 seasons per stable). Not shown during the live match.
**Pantheon** (`screens/game/PantheonScreen.tsx`, nav Club › Pantheon (after Career), tutorial step `pantheon`): the player's retired
creatures (`GameState.retired`, snapshot taken by `ageing()`: level, age, last season, record, traits, scars) and the
fallen (`GameState.fallen`). Hero tiles (legends, fallen, matches, KOs), stable records (most matches / KOs / MVP /
damage, best rating, most trophies) among the squad + retired + fallen, hall of legends sorted by a legacy score (the
first is « greatest legend »), memorial cards. Old saves: no retired entries, fallen without a record. UI only.
**Scars** (`data/scars.ts`, `config/scars.ts`, `engine/progression/scars.ts`): when an injury heals (`weeklyRecovery`),
it may leave a permanent scar with `scars.chance[severity]` (minor 0, moderate 10 %, severe 50 %, career 100 %), at
most `scars.max` 3 per creature, never twice the same. Each injury lists the scars it can leave (`from`): weak joint,
badly knit ribs, ragged wing, burnt hide, lost eye, cracked soul, blackouts, crooked limb, broken horn, scarred face,
maimed. Each one is a slight malus and a small counterpart in `attrMods` (e.g. lost eye: accuracy −2, composure +1),
added in `effectiveAttributes` like trait mods (not in the overall rating, like traits). Stored in `Creature.scars`
(`{ id, injuryId, s, w }`, absent = none, old saves fine) for the future chronicle. Own RNG stream
(`deriveSeed(world, 'scar', …)`). Public: shown on any creature's sheet (« Cicatrices », with the injury and the week)
and as chips beside the traits (`ScarChip`, same hover card), `scar` inbox message, Encyclopedia: injury pages list
their scars, rule « Blessures » § Cicatrices. ≈ 17 scars a season over the 40 stables (≈ 0.4 per stable).

