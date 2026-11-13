/* global console, process, localStorage */
/**
 * Visual check of the live match: starts a game, opens the first match live and takes screenshots at intervals
 * (plus console errors). The dev server must be running:  npx vite --port 5179
 *   node scripts/live-check.mjs [outDir] [url] [shots] [everyMs] [speed: slow|normal|fast]   (SKIP=1: jump to the result)
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'live-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const count = Number(process.argv[4] ?? 6);
const every = Number(process.argv[5] ?? 2500);
const speed = process.argv[6] ?? 'normal';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (process.env.UI_THEME) await page.addInitScript((t) => localStorage.setItem('ui.theme', t), process.env.UI_THEME);
await page.addInitScript((s) => localStorage.setItem('arena.speed', s), speed);
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
const wait = (ms) => page.waitForTimeout(ms);
const close = async () => {
  const b = page.locator('.dialog-head .btn.ghost[aria-label]');
  if (await b.count()) await b.last().click();
  await wait(300);
};

await page.goto(url);
await wait(800);
const tips = page.locator('.start input[type=checkbox]');
if (await tips.count()) await tips.first().uncheck();
await page.locator('.start .btn.primary').last().click();
await wait(800);
await close();
for (let i = 0; i < 4 && !(await page.locator('button.cta-live').count()); i++) {
  while (await page.locator('.recap').count()) await close();
  await page.locator('.topbar .btn.primary').first().click();
  await wait(1000);
}
const fix = page.locator('.remark.bad .btn.small');
if (await fix.count()) {
  await fix.first().click();
  await wait(300);
}
// No break panel: the assistant manages the breaks.
const manage = page.locator('.manage-breaks input');
if (await manage.count() && (await manage.isChecked())) await manage.uncheck();
await page.locator('button.cta-live').click();
// SKIP=1: jump to the result first (to see the end state: the fallen on the bench, the final band).
if (process.env.SKIP) {
  await wait(1500);
  await page.locator('.chronicle .btn.small').last().click();
}
for (let i = 0; i < count; i++) {
  await wait(every);
  await page.screenshot({ path: `${out}/live-${String(i + 1).padStart(2, '0')}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
