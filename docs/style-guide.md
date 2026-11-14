# Fantasy Manager — style guide

A sober management game, polished and readable: the eye goes to the data and the decisions, not the decoration.
Every rule here is a token in `src/ui/styles.css` (`:root` and the theme blocks at the top); a component never
writes a raw value the guide already names.

Verification: `node scripts/style-shots.mjs <dir>` takes 20 screens × 3 themes from a fixed world;
`node scripts/style-diff.mjs <before> <after>` shows what a change did, pixel by pixel.

## 1. Principles

1. **Data first.** Numbers, names and states carry the colour; frames and backgrounds stay quiet.
2. **One way to do each thing.** One panel material, one button family, one chip, one table style.
3. **Colour means something.** A colour is a role (interaction, money, status, competition), never decoration.
4. **Motion answers something.** An animation follows an action or an event and stops; nothing loops on a
   management screen except a single « it's your turn » cue.
5. **Three themes, one design.** Night (default), Brown, Parchment differ only by their tokens.

## 2. Typography

| Token | Size (× 14 px × text scale) | Use |
|---|---|---|
| `--fs-xs` | 0.714rem (10 px) | badges, axis labels, corner marks |
| `--fs-sm` | 0.786rem (11 px) | captions, table headers, chip text |
| `--fs-md` | 0.857rem (12 px) | secondary text, hints, buttons « small » |
| `--fs-body-sm` | 0.929rem (13 px) | dense lists, cards |
| `--fs-base` | 1rem (14 px) | body, table cells, buttons |
| `--fs-lg` | 1.143rem (16 px) | `h2` inside a card, dialog titles |
| `--fs-xl` | 1.429rem (20 px) | page titles, key figures in a card |
| `--fs-2xl` | 1.714rem (24 px) | hero figures (rank, treasury, rating) |
| `--fs-3xl` | 2.286rem (32 px) | score digits, stage titles |
| `--fs-display` | 2.857rem (40 px) | « VS », big reveal marks |

Sizes below 0.6rem (corner glyphs, dots) stay as they are; `clamp()` sizes (start title) too.

- **Title font** (`--font-title`, Spectral SC): page titles and panel titles only — never numbers, buttons, table
  cells or labels. Panel titles in small caps are fine; nothing else is uppercased except `--fs-xs` labels
  (letter-spacing 0.06em).
- **Body font** (`--font-body`, Inter): everything else, weights 400 / 600 / 700 only (500 is not bundled).
- **Numbers**: tabular figures everywhere (`font-variant-numeric: tabular-nums`), right-aligned in tables.
- Line height 1.45 for text, 1.15 for figures and titles.
- Fonts are bundled (`@fontsource/*` imported in `src/ui/main.tsx`): no network request.

## 3. Spacing and shape

| Token | Value | Use |
|---|---|---|
| `--sp-1` | 4px | inside chips, icon ↔ text |
| `--sp-2` | 8px | between related items, table cell padding (vertical) |
| `--sp-3` | 12px | between controls, card padding (compact) |
| `--sp-4` | 16px | panel padding, gap between cards |
| `--sp-5` | 24px | between sections of a screen |
| `--sp-6` | 32px | page margins on wide screens |

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 4px | inputs, small chips, bars |
| `--r-md` | 8px | buttons, tiles, cards inside a panel |
| `--r-lg` | 12px | panels, dialogs |
| `--r-pill` | 999px | pills, toggles |
| (50 %) | — | round icons, dots, avatars |

## 4. Surfaces and depth

- `--bg` the page; `--panel` a panel; `--panel-2` a tile or card inside a panel (filled, **no border**);
  `--panel-3` hover / pressed.
- Panels: `--panel` + 1px `--border` + one soft shadow (`--depth`). No gradient, no glow, no gilded edge.
- Highlight a panel (next match, an alert) with a **3px left border** in its role colour — never a full coloured
  background.
- Dialogs: `--panel` + `--border-strong` + a stronger shadow; the overlay dims the page.
- Ambient background: kept (embers, grain, glows, vignette — decided 2026-11-14); it stays behind the panels, which are
  opaque.

## 5. Colour roles

| Role | Tokens | Rule |
|---|---|---|
| Interaction | `--accent`, `--accent-strong`, `--accent-text` | links, selected tab / segment, focus ring, primary button |
| Money & rewards | `--gold` | gold amounts (`<Money>`, `<Gold>`), trophies, medals, level-up rewards — nothing else |
| Status | `--good`, `--bad`, `--warn`, `--info` | results, gains / losses, alerts; always with a word or icon, never colour alone |
| Sides | `--home`, `--away` | the player vs the opponent (match, tables) |
| Gauges | `--hp*`, `--stamina`, `--morale`, `--xp-color` | bars only |
| Categories | `--tk-*`, `--comp`, `--tier`, `--viz-1..5`, `--rep`, `--role-*`, `--bench` | competitions, divisions, news categories, charts (validated palette), reputation, roles, the bench |
| Ink on fills | `--on-gold`, `--on-good`, `--accent-text` | text on a gold, green or accent background |
| Text | `--text`, `--muted`, `--faint` | three inks; labels and values never take a series colour |

The accent and the gold are close hues: the accent is interaction (a muted brass), the gold is value (bright
yellow). Primary buttons use the accent; gold never fills a button.

## 6. Components (one each)

- **Button**: `.btn` (neutral), `.btn.primary` (one per screen area: the main action), `.btn.ghost`,
  `.btn.small`. Radius `--r-md`, no gradient, no shine animation.
- **Chip / pill**: one `.chip` (radius `--r-pill`, `--fs-sm`, padding `2px 8px`), variants by role colour.
- **Tile**: `--panel-2`, radius `--r-md`, padding `--sp-3`; big figure `--fs-xl`, label `--fs-sm` muted.
- **Table**: header `--fs-sm` muted uppercase-free, rows separated by a 1px `--border` line, hover `--panel-3`,
  numbers right-aligned.
- **Panel title**: `h3` in the title font at `--fs-base` (the small caps read larger), with an optional link « … → »
  on the right; a screen's title is the first panel's `h2` at `--fs-xl`.
- **Bar / gauge**: height 6px, radius `--r-sm`, track `--panel-3`.

## 7. Motion

- Durations: 120 ms (hover, press), 200–300 ms (open, slide), up to 1.2 s for an event (level-up, trophy, KO).
- Allowed loops: the live match (auras, which belong to the fight), the next-match week in the season ribbon, the
  tutorial ring, the news ticker and the ambient embers. Everything else plays once.
- `:root[data-effects='reduced']` and `prefers-reduced-motion` turn every animation off.

## 8. Decisions taken

- 2026-11-14: fonts bundled locally; theme tokens gathered at the top of `styles.css` (no visual change).
- 2026-11-14: title font **Spectral SC** (chosen among Cinzel, Marcellus SC, Alegreya SC, Spectral SC); the ambient
  background (embers, grain, glows, vignette) **stays as it is**; loops on management screens play once (kept: live
  auras, the next-match week in the ribbon, the tutorial ring, the news ticker, the embers); every font size and radius
  now uses the scale tokens (40 sizes → 10, 20 radii → 3 + pill); numbers no longer use the title font.
- 2026-11-14: components defined once, near the top of `styles.css` (« Component: … » comments): button, panel
  (`--panel-shadow` per theme; no gradient, glow or gilded edge; highlights by a left border), chip (one pill shape for
  `.chip` and its 9 variants, which only set colours), tag, tile, table (headers no longer uppercase), headings and card
  titles. Gold audit: the training button, the dashboard rank and the first-steps bar left the gold. Duplicate rules of
  every screen family merged into one place each (228 repeated selectors → 21: the live match, `body`'s ambient
  layers and a few others, each verified pixel-identical with `style-diff`).
- 2026-11-14: the live match has reproducible captures (`style-shots`: the first break, round 5, the end; instant
  speed, player controls) and its duplicate rules are merged too. Category tokens: `--rep` / `--rep-text` (reputation,
  with a parchment variant), `--on-gold` / `--on-good` (ink on a gold or green fill), `--bench`, `--role-*`. Remaining raw
  colours are deliberate: theme swatches, the effects palette of the live match, `#fff` / `#000` used in `color-mix`,
  and per-class category variables (`--tier`, `--comp`, `--ac`, `--metal`).
