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
| `npm run sim:season -- --seed 42` | a full league season headless, prints the final table |

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
  league/    GameState (= save file), double round-robin calendar, standings, playMatchday, next season
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
- UI: dark (default) and parchment themes via CSS tokens in `src/ui/styles.css`; localStorage only for
  per-viewer prefs (theme, language, commentary speed).
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
- **League week order** (`playMatchday`): all matches → existing injuries tick down → match effects (fatigue,
  new injuries, morale, form) → a week of rest. The player's team is always side 0 in its match.

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
- [ ] Phase 3 — economy, contracts, transfers, scouts with imperfect information.
- [ ] Phase 4 — training, staff, progression/ageing, youth intake, multiple seasons.
- [ ] Phase 5 — multiple divisions, cup, facilities, board objectives, news, advanced morale/relations.
- [ ] Phase 6 — mass season sims in a worker, balancing, polish, save slots & import/export.

## Balance snapshot (professional vs professional, 1000 matches)
~17 rounds, ~56 % KO finishes, hit rate ~73 %, ~4 exhaustions & ~0.7 injuries per match, elite beats novice
>95 %. Known: goblins & harpies are weak per slot (intended as cheap fodder — revisit with economy), dragons strong
(rare/expensive), golems slightly strong.
