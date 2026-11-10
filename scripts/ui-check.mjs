/* global console, process */
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
  if (await close.count()) await close.first().click();
  await wait(200);
};

await page.goto(url);
await wait(800);
const tips = page.locator('.start input[type=checkbox]');
if (await tips.count()) await tips.first().uncheck();
await page.locator('.start .btn.primary').last().click();
await wait(800);

// Play a few weeks (simulated matches).
for (let w = 0; w < weeks; w++) {
  await page.locator('.topbar .btn.primary').first().click();
  await wait(600);
  const sim = page.locator('button[data-tip=prematch]');
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
await go(null, 0);
await shot('01-inbox');

// Every sheet of the squad.
await go(0, 0);
await shot('02-squad');
const n = await page.locator('table.data button.link').count();
for (let i = 0; i < n; i++) {
  await page.locator('table.data button.link').nth(i).click();
  await wait(300);
  if (i === 0) await shot('03-sheet');
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
}

console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
