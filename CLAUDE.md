# Fantasy Manager — project guide

Deep fantasy arena-league management game in the spirit of Football Manager. The player runs a stable of creatures
(97 species), never controls fights: a deterministic turn-based simulation resolves them. 100 % front-end, deployed on
GitHub Pages (https://github.com/PannacottaFactory/fantasymanager, `.github/workflows/deploy.yml`, `noindex`).

**Where the details live** (read only what the task needs — search by keyword, don't load whole files):
- `docs/features.md` — every system, screen and mechanic in detail (board, fans, career, scouts, skills, talks, live
  match visuals, tutorial, economy, arena conditions, waves of species…) + current arena rules. Update the matching
  entry when a feature changes; new features get a bullet there, **not** in this file.
- `docs/history.md` — phases delivered, balance passes and measured numbers. Append new passes there.
- `docs/tools.md` — every `sim:*` command and browser check script with its arguments.
- `docs/style-guide.md` — type scale, spacing, radii, surfaces, colour roles, motion, decisions log.

## Working with the user
- Talk to the user in **French**. The game is bilingual: **French (default) and English**. Code identifiers, data ids
  and English source texts stay in English; French lives beside them.
- French game texts address the player with « vous »; no « — » inside game sentences; time unit = « semaine »
  (never « journée »; cup rounds « semaine d, après le championnat »), English keeps « matchday ».
- No emojis in the UI: game-icons everywhere (`UI_ICONS`, `<BadgeIcon>`, `<SpeciesIcon>`, `<RoleIcon>`, `<DivIcon>`,
  `<CompIcon>`; new icons via `node scripts/extract-icons.mjs`, lists in `src/ui/icons/gameIcons.ts`).

## Stack & commands
TypeScript (strict) · Vite · React 19 + Zustand · Vitest · tsx (headless CLI) · ESLint (flat config) · IndexedDB saves
(`idb`, 3 slots). Playwright for browser checks.

| | |
|---|---|
| `npm run dev` | dev server (5173) |
| `npm test` · `npm run typecheck` · `npm run lint` | must stay clean |
| `npm run build` | typecheck + production build |
| `npm run sim:<name>` | headless sims for balance (list + args in `docs/tools.md`) |
| `npm run ui:check -- <outDir> <url> <weeks>` | headless browser: new game, plays weeks, screenshots + console errors |

## Architecture (strict layering)
```
src/core/    RNG (sfc32, seeded, forkable), math, text helpers — no deps
src/data/    DECLARATIONS ONLY: species, abilities, traits, effects, injuries, names, crest, texts
  config/    every balancing number (combat, elements, economy, club, career, training, arena, identity…)
  text/      commentary templates (*.ts English, *.fr.ts French)
  i18n/fr.ts French names / descriptions / verbs of every data id (+ gender, articles)
src/engine/  pure game logic: no UI imports, no Math.random / Date (ESLint enforces)
  creature/ team/ combat/ commentary/ report/ league/ club/ economy/ progression/ text/
src/sim/     headless CLI scripts
src/ui/      React; reads engine state, sends decisions; zero game rules
  i18n/strings.ts (typed keys, EN block then FR block) · store/ (gameStore, arenaStore, saves) · screens/ · components/
tests/       Vitest
```

## Rules that must hold
- **Determinism**: `seed + teams + break decisions` ⇒ identical match. Independent streams via `deriveSeed(...)` /
  `rng.fork(name)`; commentary, report, deaths, grace, sessions… use their own streams so text or side features never
  change results. A new random feature draws only when present (matches without it stay identical). Language never
  changes RNG draws (tested).
- **Combat flow**: `new Combat(setup)` → `advance()` until `phase === 'break'` → both sides' decisions computed
  **before** either is applied → `applyBreakDecision` ×2 → `resume()`. `simulateMatch()` = headless with
  `aiBreakDecision`; `result().decisions` replays exactly.
- **Events are the source of truth** (`MatchEvent[]`). A new event type ⇒ handle it in the commentator, report,
  analysis, view (`engine/combat/view.ts`), `matchFx.ts` (with a mark in `fxMarks.ts`) and the action log
  (`ActionLog.tsx`). A new effect ⇒ a mark too. A new mechanic ⇒ describe it in the Encyclopedia
  (`ui/i18n/encyclopedia.ts`: `spec.*`, `mod.*`, `fx.*` or a rule).
- **Balancing numbers** live in `src/data/config/*`; engine functions take a `GameConfig` (default `DEFAULT_CONFIG`) so
  sims can test variants (`--set path=v`). Measure levers against varied opponents, never mirrors, never duplicate ids
  (`cloneTeam()`); paired runs, ≥ 1000 matches (noise ±2 points). Species prices (`valueMult`) are recalibrated last.
- **Imperfect information**: never show raw attributes, ability or potential of a creature the player doesn't own —
  ranges from `knowledgeOf` (`overallRange`, `potentialLevelRange`). The opponent's approach is never shown before or
  during a match. Play styles are never named in the game or the Encyclopedia.
- **Manual beats assistant**: simulating must stay a bit worse than managing breaks by hand.
- **Saves**: `GameState` = save file, `version` + `migrateGame`; a new optional field must tolerate old saves (absent =
  default). The UI-only fields (`playTime`) are never read by the engine.
- **i18n**: engine text functions take a `lang`; inbox messages are stored as data and worded by the UI. French
  templates must not write `de {x}` / `à {x}` / `que {x}` before a creature (elision): use `{aE}/{tE}/{oE}`; no unfilled
  `{placeholder}` (tested). EN / FR name lists are index-aligned.
- Attributes 1–20 (21: 6 physical, 6 combat, 9 mental); hidden ability / potential 1–200; levels 1–10 shown.
- **Selection** uses the overall rating × fatigue, never the hidden aptitude.

## UI conventions
- Themes: slate (default), night, dark, parchment — every token in the three blocks at the top of `src/ui/styles.css`.
  Check new UI in a dark theme **and** parchment.
- Font sizes in `rem` via the scale tokens (`--fs-*`), radii `--r-*`, spacing `--sp-*`: never a raw px size / radius,
  never a numeric font size in inline styles. Text scale ×1 / ×1.15 / ×1.3.
- Shared components (button, panel, chip / tag, tile, table, headings) are defined once (« Component: » blocks): screens
  place or size them, never restyle them; a chip variant only sets colours.
- Animations: one-shot entrances are fine; loops only in the live match, the ribbon's next week, the tutorial ring, the
  ticker and the embers. Everything must stop under `:root[data-effects='reduced']`.
- Fixed canvases (`.fx-canvas`) must never sit under an ancestor keeping a `transform` / `filter` (screen transitions use
  `animation-fill-mode: backwards`).
- Gold amounts: `<Money v>` alone, `<Gold>{text}</Gold>` inside worded strings.
- Screens must fit 1366×768 → 1920×1080 (`scripts/steam-check.mjs` measures overflow).
- A new screen ⇒ a `data-tip` anchor + a tutorial step + `tut.<id>.title/body` strings if it needs explaining.
- Adding a species = `species.ts` + `abilities.ts` + `names.ts` (culture) + `fr.ts` (FR_SPECIES with `the` / `fem`,
  FR_ABILITIES verbs, FR_SURNAMES aligned) + icon list in `gameIcons.ts`.
- Visual checks: `node scripts/style-shots.mjs <dir>` (20 screens × 3 themes) + `style-diff.mjs <before> <after>`.
