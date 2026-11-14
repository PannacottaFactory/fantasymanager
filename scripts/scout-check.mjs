/* global console, process, window */
/**
 * Visual check of the scouts: new game, sends two scouts from the recruitment cards (flight to the tab), plays the
 * weeks until the reports come in and screenshots the staged reveal (during and after), the cards and the journal.
 * The dev server must be running:  npx vite --port 5179   then   node scripts/scout-check.mjs [outDir] [url]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'scout-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}\n${e.stack ?? ''}`));
const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const closeTop = async () => {
  const close = page.locator('.overlay .dialog-head .btn.ghost[aria-label]');
  if (await close.count()) await close.last().click();
  else await page.keyboard.press('Escape');
  await wait(300);
};

/** Opens the recruitment screen from whichever nav group holds it. */
const openRecruit = async () => {
  const direct = page.locator('nav button', { hasText: /Recrutement|Recruitment/ });
  if (await direct.count()) {
    await direct.first().click();
    await wait(500);
    return true;
  }
  const groups = page.locator('.nav-group');
  for (let i = 0; i < (await groups.count()); i++) {
    await groups.nth(i).locator('> button').click();
    const item = page.locator('.nav-menu [role=menuitem]', { hasText: /Recrutement|Recruitment/ });
    if (await item.count()) {
      await item.first().click();
      await wait(500);
      return true;
    }
    await page.keyboard.press('Escape');
  }
  return false;
};

await page.goto(url);
await wait(800);
const tips = page.locator('.start input[type=checkbox]');
if (await tips.count()) await tips.first().uncheck();
await page.locator('.start .btn.primary').last().click();
await wait(800);
await closeTop();

if (!(await openRecruit())) errors.push('recruitment screen not found');
await shot('01-recruit-free');
// Send two scouts from the cards (the first one mid-flight).
const send = page.locator('.recruit-card .scout-send:not([disabled])');
await send.first().click();
await wait(450);
await shot('02-flight');
await wait(900);
await page.locator('.seg button').nth(1).click();
await wait(400);
await page.locator('.recruit-card .scout-send:not([disabled])').first().click();
await wait(1400);
await shot('03-recruit-after');

// Play weeks until a reveal shows (simulated matches; training windows and summaries closed on the way).
let revealed = 0;
const state = () =>
  page.evaluate(() => {
    const s = window.__fm?.getState();
    return s ? { reveals: s.reveals.length, match: s.match?.phase ?? null, drill: s.drill, recap: !!s.recap, sheet: s.sheet, missions: s.game?.scouting.missions.length } : null;
  });
for (let w = 0; w < 8 && revealed < 2; w++) {
  console.log(`week loop ${w}`, JSON.stringify(await state()));
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.reveal-dialog').count()) {
      revealed++;
      await wait(1300);
      await shot(`04-reveal-${revealed}-mid`);
      await wait(3200);
      await shot(`05-reveal-${revealed}-done`);
      await page.locator('.reveal-actions .btn.ghost').click();
      await wait(500);
      continue;
    }
    if (await page.locator('.overlay').count()) await closeTop();
    else break;
  }
  if (revealed >= 2) break;
  await page.locator('.topbar .btn.primary').first().click();
  await wait(700);
  if (await page.locator('.overlay').count()) continue;
  const sim = page.locator('button.cta-sim');
  // An injured starter blocks the match: let the assistant fix the line-up.
  if (await page.locator('button.cta-sim[disabled]').count()) {
    await page.evaluate(() => window.__fm.getState().repair());
    await wait(300);
  }
  if (await sim.count()) {
    await sim.first().click();
    await wait(1000);
    // A bench warning may ask first.
    const anyway = page.locator('.overlay .btn', { hasText: /quand même|anyway/i });
    if (await anyway.count()) await anyway.first().click();
    await wait(800);
    await closeTop();
  }
}
console.log(`reveals seen: ${revealed}`);
if (await openRecruit()) await shot('06-recruit-later');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
