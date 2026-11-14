/* global console, process, window, localStorage */
/**
 * Reproducible screenshots of every main screen, in each theme, for visual work on the stylesheet: a fixed world
 * (seed, names, crest), three weeks simulated, effects off, animations disabled, toasts and save dates hidden.
 * Two runs of the same build give identical pictures, so `scripts/style-diff.mjs` shows exactly what a CSS change did.
 * The dev server must be running:  npx vite --port 5179   then
 *   node scripts/style-shots.mjs <outDir> [url] [themes=night,dark,parchment]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'style-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const themes = (process.argv[4] ?? 'night,dark,parchment').split(',');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const HIDE = '.toasts, .embers { display: none !important; } *, *::before, *::after { caret-color: transparent !important; }';

for (const theme of themes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript((t) => {
    localStorage.setItem('ui.theme', t);
    localStorage.setItem('ui.lang', 'fr');
    localStorage.setItem('fm.effects', 'reduced');
    localStorage.setItem('tutorial.enabled', 'false');
  }, theme);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${theme}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${theme} console: ${m.text()}`));
  const wait = (ms = 350) => page.waitForTimeout(ms);
  const shot = async (name) => {
    await page.addStyleTag({ content: HIDE });
    await wait();
    await page.screenshot({ path: `${out}/${theme}-${name}.png`, animations: 'disabled', mask: [page.locator('.slot-card .faint'), page.locator('.name-row input'), page.locator('.crest-editor')] });
  };
  /** Closes every window the game may open (welcome, board meetings, summaries…). */
  const calm = () =>
    page.evaluate(() => window.__fm.setState({ intro: false, boardNotes: [], recap: null, drill: false, reveals: [], sheet: null, boardRules: false }));

  await page.goto(url);
  await wait(800);
  await shot('start');
  await page.evaluate(() =>
    window.__fm.getState().newGame('Gardiens de Karak', 'style-shots', 'normal', undefined, 'auto', { career: true, managerName: 'Aldric Vane' }),
  );
  await wait(600);
  // Three weeks, simulated.
  for (let i = 0; i < 3; i++) {
    await calm();
    await page.evaluate(() => window.__fm.getState().continueGame());
    await wait(300);
    await page.evaluate(() => {
      const s = window.__fm.getState();
      if (s.match) {
        s.simulate();
        window.__fm.getState().closeMatch();
      }
    });
    await wait(300);
  }
  await calm();

  const screens = ['dashboard', 'inbox', 'squad', 'tactics', 'training', 'recruit', 'finances', 'staff', 'facilities', 'career', 'news', 'encyclopedia', 'help'];
  for (const s of screens) {
    await page.evaluate((x) => window.__fm.getState().setScreen(x), s);
    await calm();
    await shot(s);
  }
  for (const tab of ['table', 'comps', 'honours']) {
    await page.evaluate((x) => window.__fm.getState().openLeague(x), tab);
    await calm();
    await shot(`league-${tab}`);
  }
  // A creature sheet, the pre-match screen, the start screen with a save.
  await page.evaluate(() => {
    const s = window.__fm.getState();
    s.setScreen('squad');
    const g = s.game;
    s.openSheet(g.teams.find((t) => t.id === g.playerTeamId).creatures[0].id);
  });
  await shot('sheet');
  await calm();
  await page.evaluate(() => window.__fm.getState().continueGame());
  await calm();
  await shot('prematch');
  await page.evaluate(() => window.__fm.setState({ match: null }));
  await page.evaluate(() => window.__fm.getState().openLaunch());
  await shot('start-saved');
  await context.close();
  console.log(`${theme}: done`);
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
