/* global console, process, document, localStorage */
/**
 * Visual check of the game in a real (headless) browser: starts a game, plays a few weeks, visits the main
 * screens, opens every creature sheet of the squad and a few others, and saves screenshots + console / page errors.
 * The dev server must be running:  npx vite --port 5179   then   node scripts/ui-check.mjs [outDir] [url] [weeks]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'ui-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const weeks = Number(process.argv[4] ?? 3);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Optional theme for the screenshots: UI_THEME=dark|night|parchment.
if (process.env.UI_THEME) {
  await page.addInitScript((t) => localStorage.setItem('ui.theme', t), process.env.UI_THEME);
}
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}\n${e.stack ?? ''}`));
const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const alive = async (where) => {
  if (!(await page.locator('nav').count())) {
    errors.push(`app crashed (no nav) after: ${where}`);
    await shot(`crash-${where.replace(/\W+/g, '_')}`);
    return false;
  }
  return true;
};

/** Navigation by position: groups are Stable (0), Competitions (1), Club (2); single items by index in the bar. */
const go = async (group, index) => {
  if (group === null) await page.locator('nav > button').nth(index).click();
  else {
    await page.locator('.nav-group').nth(group).locator('> button').click();
    await page.locator('.nav-menu [role=menuitem]').nth(index).click();
  }
  await wait();
};
const closeModal = async () => {
  const close = page.locator('.dialog-head .btn.ghost[aria-label]');
  if (await close.count()) await close.last().click();
  await wait(200);
};

await page.goto(url);
await wait(800);
const tips = page.locator('.start input[type=checkbox]');
if (await tips.count()) await tips.first().uncheck();
await page.locator('.start .btn.primary').last().click();
await wait(800);
// Welcome window of the new game.
await shot('00-intro');
await closeModal();

/** Closes the end-of-week summary (screenshot of the first one). */
let recaps = 0;
const closeRecap = async () => {
  while (await page.locator('.recap').count()) {
    recaps++;
    if (recaps === 1) {
      await wait(2500);
      await shot('00-recap');
    }
    await page.locator('.dialog-head .btn.ghost[aria-label]').first().click();
    await wait(300);
  }
};

// Play a few weeks (simulated matches).
for (let w = 0; w < weeks; w++) {
  await closeRecap();
  await page.locator('.topbar .btn.primary').first().click();
  await wait(600);
  if (w === 0 && (await page.locator('.versus').count())) {
    await wait(900);
    await shot('00-prematch');
  }
  const sim = page.locator('button.cta-sim');
  const fix = page.locator('.remark.bad .btn.small');
  if (await fix.count()) {
    await fix.first().click();
    await wait(300);
  }
  if (await sim.count()) {
    await sim.first().click();
    await wait(1000);
  }
  if (!(await alive(`week ${w + 1}`))) break;
}
await closeRecap();
// The next pre-match screen (arena conditions start after a few weeks).
await page.locator('.topbar .btn.primary').first().click();
await wait(1500);
if (await page.locator('.versus').count()) await shot('00-prematch-late');
await go(null, 0);
await shot('01-inbox');

// Every sheet of the squad.
await go(0, 0);
await shot('02-squad');
// Squad as cards (default view): every card opens its sheet.
const n = await page.locator('.ccard').count();
for (let i = 0; i < n; i++) {
  await page.locator('.ccard').nth(i).click();
  await wait(300);
  if (i === 0) {
    await shot('03-sheet');
    const rec = page.locator('.rec-panel');
    if (await rec.count()) await rec.first().screenshot({ path: `${out}/03-record.png` });
  }
  if (!(await alive(`squad sheet ${i}`))) break;
  await closeModal();
}
if (await alive('squad')) {
  await go(0, 1);
  await shot('04-tactics');
  await go(0, 2);
  await shot('05-training');
  // Other stables' and free agents' sheets from the recruitment screen.
  await go(null, 1);
  await shot('06-recruit');
  const links = page.locator('table.data button.link');
  const m = Math.min(5, await links.count());
  for (let i = 0; i < m; i++) {
    await links.nth(i).click();
    await wait(300);
    if (i === 0) await shot('07-other-sheet');
    if (!(await alive(`recruit sheet ${i}`))) break;
    await closeModal();
  }
  await go(2, 0);
  await shot('08-finances');
  // Bestiary (Encyclopedia tab).
  await go(3, 0);
  await page.locator('.enc-bestiary-tab').click();
  await wait(300);
  await shot('09-bestiary');
  // Combat rules › Arena conditions.
  await page.locator('.enc-tabs').first().locator('.chip').last().click();
  await wait(200);
  await page.locator('.enc-list li button').last().click();
  await wait(300);
  await shot('09-arena-rule');
  await go(null, 0);
  await shot('10-dashboard');
  // Top bar at several widths and text sizes: tab names must stay visible.
  for (const [w, size] of [[1920, 'large'], [1440, 'large'], [1280, 'xlarge'], [1024, 'large']]) {
    await page.locator('.settings-btn').click();
    await page.locator('.settings-block').nth(1).locator('button').nth(size === 'xlarge' ? 2 : 1).click();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: w, height: 900 });
    await wait(400);
    const nav = await page.evaluate(() => document.querySelector('nav.nav')?.className);
    console.log(`top bar ${w}px: ${nav}`);
    await page.screenshot({ path: `${out}/11-topbar-${w}.png`, clip: { x: 0, y: 0, width: w, height: 140 } });
  }
}

console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
