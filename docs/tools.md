# Fantasy Manager — commands & check tools

Every CLI sim and browser check script. Sims print to the terminal; browser scripts need the dev server running.

## Commands
| | |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (tests/*.test.ts) |
| `npm run typecheck` / `npm run lint` | must stay clean |
| `npm run build` | typecheck + production build into `dist/` |
| `npm run sim:match -- --seed 42 --a professional --b regional` | one match in the terminal with commentary + report |
| `npm run sim:species [-- --only a,b --mean m]` | strength of each species at equal potential → suggested `valueMult` |
| `npm run sim:balance -- --seasons 10` | long-run drift: ability / potential, ages, fatigue, injuries, KO rate, treasuries, reputation, transfers |
| `npm run sim:batch -- --matches 1000 --a elite --b novice` | balancing stats over many headless matches |
| `npm run sim:season -- --seed 42 --seasons 3` | league seasons headless: table, wages, treasuries, transfers |
| `npm run sim:abilities -- --matches 1000 [--only a,b] [--part 1/4]` | what each skill (basic attack included) is worth per species: uses by the AI and win rate added as the second equipped one (same matches, partner alone in the other arm), rank among the species' six; flags rarely used / costly ones (`--only` = species or skill ids) |
| `npm run sim:variety -- --matches 150 [--abilities] [--only troll,orc]` | variety of play: per species (every skill unlocked, each pair equipped in turn), share of its actions taken by its most used one, uses per match and pick rate when ready of each ability; `--abilities` lists the cooldown abilities least picked when ready |
| `npm run sim:archetypes -- --matches 200 --detail` | play styles head to head (poison, frost, curses…) + what each style did |
| `npm run sim:ai -- --matches 300 --seasons 6` | AI management vs plain, temperaments, a season per difficulty (`--season-only`) |
| `npm run sim:board -- --worlds 10 --seasons 2` | board, supporters & star requests over seasons on autopilot: weeks per mood / tier, ultimatums, tickets, requests per kind, per difficulty |
| `npm run sim:career -- --worlds 8 --seasons 4` | career mode on autopilot: sackings (ultimatum / verdict), job offers, manager reputation & division per season (`--policy climb` takes offers) |
| `npm run sim:facility -- --worlds 8 --seasons 2` | weight of the training ground: same worlds with the player's ground forced to 0–3 (sessions, attribute points, league points, position) |
| `npm run sim:levers -- --matches 400` | weight of each manager decision (orders, lines, roles, bench, fatigue, breaks) at equal squads; `--only a,b` (label words) · `--set path=v,…` config variant |
| `npm run sim:talks -- --matches 600` | team talks: each talk / reading the game / a random talk vs no talk, per situation (tired, shaken, vs ranged, vs brutes), opponent silent or reading; `--set` |
| `npm run sim:attributes -- --matches 3000 --points 3` | what attribute points are worth: a level on one / every starter, +n in each attribute (ranking), health per strength; `--only a,b` · `--set combat.x.y=v,…` to try a config variant |
| `npm run sim:fatigue -- --worlds 6` | fatigue spiral: the player's season with no rotation / the assistant's rotation / rotation + pace yourself (starters' fatigue, ≥ 50 / ≥ 70, points, place) |
| `npm run sim:judges -- --matches 4000` | fairness of the judges: points won by the side with more health / that healed more / made more substitutions, last-break dilution trick |
| `npm run sim:upsets -- --matches 3000` · `--league --worlds 4 --seasons 2` | surprises: weaker side's win rate per strength gap (starters' rating × fatigue, +5 = a point everywhere), lead changes per match, leader at each break who loses, favourite / underdog behind who wins; `--set` |
| `npm run sim:injuries -- --worlds 6 --seasons 2` | injuries on autopilot: injured per stable and week, weeks with 2+ / 3+ / 4+ / 5+ out, new injuries per match, weeks out, squad size |
| `node scripts/play-check.mjs <outDir> [url] [loops]` (dev server running; `LIVE_EVERY=n`) | plays like a player: default layout, tutorial on, career mode, every window answered, some matches live with breaks, scout / signing / facility, a season and more; logs windows seen, stuck states, console errors |
| `npx vite --port 5179` then `npm run ui:check -- <outDir> <url> <weeks>` | headless browser (Playwright): new game, plays weeks, opens every sheet & main screens, screenshots + console errors |
| `node scripts/steam-check.mjs <outDir> [url] [1920x1080,1366x768,1280x800]` | Steam formats (dev server running): screenshots of every main screen per resolution + pixels each one overflows (0 = fits) |
| `npm run dev` → top-bar dev tools (dev builds only, `ui/dev/DevTools.tsx`) | window size · screen-size test (the game in an iframe at 1920×1080 / 2560×1440 / 1366×768 / 1280×800 Steam Deck / 1280×720, scaled to fit; the frame skips the start screen; closing reloads to pick up its save) · full screen like a PC game |

Quality tiers: `novice | regional | professional | elite | legendary`.


Other browser checks (dev server running): `scripts/board-check.mjs`, `scout-check.mjs`, `career-check.mjs`, `live-check.mjs`,
`sheet-shots.mjs`, `species-check.mjs`, `style-shots.mjs` + `style-diff.mjs` (see their header comment for arguments).
