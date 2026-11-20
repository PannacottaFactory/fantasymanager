/* global console, process, window, localStorage, document */
/**
 * Screenshots of the creature sheet (own creature, another stable's) and of an Encyclopedia species page.
 * Dev server running:  node scripts/sheet-shots.mjs <outDir> [url] [1440x900,1920x1080]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'sheet-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const sizes = (process.argv[4] ?? '1440x900,1920x1080').split(',').map((s) => s.split('x').map(Number));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const [width, height] of sizes) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('ui.lang', 'fr');
    localStorage.setItem('fm.effects', 'reduced');
    localStorage.setItem('tutorial.enabled', 'false');
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const wait = (ms = 400) => page.waitForTimeout(ms);
  const calm = () => page.evaluate(() => window.__fm.setState({ intro: false, boardNotes: [], recap: null, drill: false, reveals: [], sheet: null, boardRules: false }));
  await page.goto(url);
  await wait(800);
  await page.evaluate(() => window.__fm.getState().newGame('Gardiens de Karak', 'sheet-shots', 'normal', undefined, 'auto', { career: false }));
  await wait(600);
  await calm();
  await page.evaluate(() => {
    const s = window.__fm.getState();
    s.setScreen('squad');
    s.openSheet(s.game.teams.find((t) => t.id === s.game.playerTeamId).creatures[0].id);
  });
  await wait();
  await page.screenshot({ path: `${out}/${width}-own.png` });
  const over = await page.evaluate(() => {
    const d = document.querySelector('.sheet-dialog');
    return d ? d.scrollHeight - d.clientHeight : -1;
  });
  console.log(`${width}x${height} own sheet overflow: ${over}px`);
  await calm();
  await page.evaluate(() => {
    const s = window.__fm.getState();
    s.openSheet(s.game.teams.find((t) => t.id !== s.game.playerTeamId).creatures[0].id);
  });
  await wait();
  await page.screenshot({ path: `${out}/${width}-other.png` });
  await calm();
  await page.evaluate(() => window.__fm.getState().openEncyclopedia('species', 'dragon'));
  await wait();
  await page.screenshot({ path: `${out}/${width}-enc.png`, fullPage: true });
  await context.close();
}
await browser.close();
if (errors.length) console.log('errors:\n' + errors.join('\n'));
