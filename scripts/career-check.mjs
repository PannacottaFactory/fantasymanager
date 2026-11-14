/* global console, process, window, document */
/**
 * Visual check of career mode: the start screen with the mode cards (must fit without scrolling at common sizes),
 * a new career + Ironman game, then a sacking forced through the dev store (the job window a sacked manager cannot
 * close), taking a job. The dev server must be running:  npx vite --port 5179   then
 *   node scripts/career-check.mjs [outDir] [url]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'career-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const sizes = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  await page.goto(url);
  await page.waitForTimeout(800);
  const career = page.locator('.mode-card', { hasText: /Carrière|Career/ });
  if (await career.count()) await career.click();
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => {
    const scrolls = [document.documentElement, ...document.querySelectorAll('.main')];
    return Math.max(...scrolls.map((el) => el.scrollHeight - el.clientHeight));
  });
  console.log(`${w}×${h}: start screen overflow ${overflow}px`);
  await page.screenshot({ path: `${out}/start-${w}.png` });
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(800);
await page.locator('.mode-card', { hasText: /Carrière|Career/ }).click();
await page.locator('.ironman input').check();
await page.locator('.start-actions .btn').first().click();
await page.waitForTimeout(800);
const mgr = await page.evaluate(() => window.__fm.getState().game.manager);
console.log('manager:', JSON.stringify({ career: mgr.career, ironman: mgr.ironman, reputation: mgr.reputation }));
// Close the welcome / board windows.
for (let i = 0; i < 4; i++) {
  const btn = page.locator('.overlay .dialog .btn.primary, .overlay .dialog-head .btn.ghost').first();
  if (!(await btn.count())) break;
  await btn.click();
  await page.waitForTimeout(300);
}
// Force a sacking with two rescue offers.
await page.evaluate(() => {
  const s = window.__fm.getState();
  s.update((g) => {
    const others = g.teams.filter((t) => t.id !== g.playerTeamId).slice(-2);
    const offers = others.map((t, i) => ({ id: `job-test-${i}`, teamId: t.id, reason: 'rescue', season: g.season, until: 9e15 }));
    return { ...g, manager: { ...g.manager, unemployed: true, offers }, inbox: [...g.inbox, { id: 'm-sacked', kind: 'sacked', team: 'Test', reason: 'ultimatum', reputation: 12, season: g.season, matchday: g.matchday, read: false }] };
  });
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/job-centre.png` });
console.log('job window open:', await page.locator('.job-card').count(), 'offers');
await page.locator('.job-card .btn.primary').first().click();
await page.waitForTimeout(600);
const after = await page.evaluate(() => {
  const g = window.__fm.getState().game;
  return { unemployed: !!g.manager.unemployed, team: g.teams.find((t) => t.id === g.playerTeamId).name, jobs: g.manager.jobs.length };
});
console.log('after taking the job:', JSON.stringify(after));
await page.screenshot({ path: `${out}/new-job.png` });
// The start screen again, now with a saved game (slot cards on top), at every size.
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.reload();
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => {
    const scrolls = [document.documentElement, ...document.querySelectorAll('.main')];
    return Math.max(...scrolls.map((el) => el.scrollHeight - el.clientHeight));
  });
  console.log(`${w}×${h} with a save: start screen overflow ${overflow}px`);
  await page.screenshot({ path: `${out}/start-saved-${w}.png` });
  // « New game »: the form takes the slots' place.
  await page.locator('.new-game-cta').click();
  await page.waitForTimeout(400);
  const form = await page.evaluate(() => {
    const scrolls = [document.documentElement, ...document.querySelectorAll('.main')];
    return Math.max(...scrolls.map((el) => el.scrollHeight - el.clientHeight));
  });
  console.log(`${w}×${h} new-game form with a save: overflow ${form}px`);
  await page.screenshot({ path: `${out}/start-form-${w}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
