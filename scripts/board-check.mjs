/* global console, process, window */
/**
 * Visual check of the board: new game (season meeting after the welcome window), dashboard card, the rules window,
 * then an angry board forced through the dev store (ultimatum meeting, pre-match banner, recruitment budget, frozen
 * works). The dev server must be running:  npx vite --port 5179   then   node scripts/board-check.mjs [outDir] [url]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'board-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}\n${e.stack ?? ''}`));
const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const nav = async (re) => {
  const direct = page.locator('nav button', { hasText: re });
  if (await direct.count()) return direct.first().click();
  const groups = page.locator('.nav-group');
  for (let i = 0; i < (await groups.count()); i++) {
    await groups.nth(i).locator('> button').click();
    const item = page.locator('.nav-menu [role=menuitem]', { hasText: re });
    if (await item.count()) return item.first().click();
    await page.keyboard.press('Escape');
  }
};

await page.goto(url);
await wait(800);
const tips = page.locator('.start input[type=checkbox]');
if (await tips.count()) await tips.first().uncheck();
await page.locator('.start .btn.primary').last().click();
await wait(800);
// Welcome window, then the board's season meeting.
await page.locator('.overlay .dialog-head .btn.ghost[aria-label]').last().click();
await wait(900);
await shot('01-meeting-objective');
if (!(await page.locator('.meeting-dialog').count())) errors.push('no board meeting after the welcome window');
await page.locator('.meeting-dialog .btn.primary').click();
await wait(400);
await page.locator('.board-card').scrollIntoViewIfNeeded();
await page.locator('.board-card').screenshot({ path: `${out}/02-board-card.png` });
await page.locator('.board-rules-btn').click();
await wait(400);
await shot('03-rules');
await page.locator('.meeting-dialog .btn.primary').click();
await wait(300);

// An angry board: one KO loss away from anger, then a match.
await page.evaluate(() => {
  const st = window.__fm.getState();
  st.update((g) => ({ ...g, board: { ...g.board, confidence: 31, mood: 'uneasy' } }));
});
for (let w = 0; w < 4 && !(await page.locator('.meeting-dialog').count()); w++) {
  await page.locator('.topbar .btn.primary').first().click();
  await wait(700);
  if (await page.locator('button.cta-sim[disabled]').count()) await page.evaluate(() => window.__fm.getState().repair());
  const sim = page.locator('button.cta-sim');
  if (await sim.count()) {
    await page.evaluate(() => {
      const st = window.__fm.getState();
      st.update((g) => ({ ...g, board: { ...g.board, confidence: 25 } }));
    });
    await sim.first().click();
    await wait(1500);
  }
  for (let i = 0; i < 6 && (await page.locator('.overlay').count()) && !(await page.locator('.meeting-dialog').count()); i++) {
    await page.locator('.overlay .dialog-head .btn.ghost[aria-label]').last().click();
    await wait(400);
  }
  // The report screen: leave it so the windows can come.
  if (!(await page.locator('.overlay').count())) {
    await page.locator('.topbar .btn.primary').first().click();
    await wait(800);
    for (let i = 0; i < 6 && (await page.locator('.overlay').count()) && !(await page.locator('.meeting-dialog').count()); i++) {
      await page.locator('.overlay .dialog-head .btn.ghost[aria-label]').last().click();
      await wait(400);
    }
  }
}
await wait(500);
await shot('04-meeting-ultimatum');
const st = await page.evaluate(() => {
  const g = window.__fm.getState().game;
  return { conf: g.board.confidence, ult: g.board.ultimatum ?? null, mood: g.board.mood };
});
console.log('board', JSON.stringify(st));
if (await page.locator('.meeting-dialog').count()) await page.locator('.meeting-dialog .btn.primary').click();
await wait(300);
await nav(/Accueil|Home/);
await wait(500);
await page.locator('.board-card').screenshot({ path: `${out}/05-board-card-angry.png` });
await nav(/Recrutement|Recruitment/);
await wait(500);
await shot('06-recruit');
for (let i = 0; i < 6 && !(await page.locator('.versus').count()); i++) {
  while (await page.locator('.overlay').count()) {
    await page.locator('.overlay .dialog-head .btn.ghost[aria-label]').last().click();
    await wait(400);
  }
  await page.locator('.topbar .btn.primary').first().click();
  await wait(1200);
}
await shot('07-prematch');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
