/* global console, process, document, localStorage */
/**
 * « Does it fit on one screen? » — the main screens at the resolutions a Steam release must handle: 1920×1080 (most
 * players), 1366×768 (small laptops) and 1280×800 (Steam Deck). For each one: a screenshot and how many pixels the
 * screen overflows (0 = it fits, no scrolling). The dev server must be running:
 *   npx vite --port 5179   then   node scripts/steam-check.mjs [outDir] [url] [sizes=1920x1080,1366x768,1280x800]
 * Options: UI_THEME=dark|night|parchment|slate, UI_LAYOUT=side|top (default side).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'steam-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const sizes = (process.argv[4] ?? '1920x1080,1366x768,1280x800').split(',').map((s) => s.split('x').map(Number));
mkdirSync(out, { recursive: true });

// Sidebar entries, by their position in the menu (Home, Journal, Squad, Tactics, Training, League, News, Recruitment,
// Finances, Staff, Facilities, Career).
const SCREENS = ['home', 'journal', 'squad', 'tactics', 'training', 'league', 'news', 'recruit', 'finances', 'staff', 'facilities', 'career'];

const browser = await chromium.launch();
const rows = [];
const errors = [];
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  await page.addInitScript(
    ([theme, layout]) => {
      localStorage.setItem('ui.theme', theme);
      localStorage.setItem('fm.layout', layout);
      localStorage.setItem('fm.effects', 'reduced');
    },
    [process.env.UI_THEME ?? 'dark', process.env.UI_LAYOUT ?? 'side'],
  );
  const wait = (ms = 450) => page.waitForTimeout(ms);
  const closeAll = async () => {
    for (let i = 0; i < 4 && (await page.locator('.overlay').count()); i++) {
      const c = page.locator('.overlay .dialog-head .btn.ghost[aria-label]');
      if (await c.count()) await c.last().click();
      else await page.keyboard.press('Escape');
      await wait(250);
    }
    // Tutorial bubbles cover the screen: dismiss them.
    const skip = page.locator('.tut-skip, .tutorial-pop button', { hasText: /Passer|Skip/ });
    if (await skip.count()) await skip.first().click().catch(() => {});
  };
  /** Pixels the screen needs beyond the window (the main area and the page itself). */
  const overflow = () =>
    page.evaluate(() => {
      const main = document.querySelector('.main');
      const inner = main ? main.scrollHeight - main.clientHeight : 0;
      const doc = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { tall: Math.max(0, inner, doc), wide: Math.max(0, wide) };
    });

  await page.goto(url);
  await wait(900);
  const start = await overflow();
  await page.screenshot({ path: `${out}/${w}x${h}-00-start.png` });
  rows.push({ size: `${w}x${h}`, screen: 'start', ...start });
  const tips = page.locator('.start input[type=checkbox]');
  if (await tips.count()) await tips.last().uncheck();
  await page.locator('.start .btn.primary').last().click();
  await wait(900);
  await closeAll();
  const items = page.locator('.side-item');
  for (let i = 0; i < SCREENS.length && i < (await items.count()); i++) {
    await closeAll();
    await items.nth(i).click();
    await wait();
    await closeAll();
    const o = await overflow();
    rows.push({ size: `${w}x${h}`, screen: SCREENS[i], ...o });
    await page.screenshot({ path: `${out}/${w}x${h}-${String(i + 1).padStart(2, '0')}-${SCREENS[i]}.png` });
  }
  await page.close();
}
await browser.close();

console.log('\nOverflow in pixels (0 = fits on one screen):');
for (const size of [...new Set(rows.map((r) => r.size))]) {
  const list = rows.filter((r) => r.size === size);
  const bad = list.filter((r) => r.tall > 0 || r.wide > 0);
  console.log(`\n${size}: ${list.length - bad.length}/${list.length} screens fit`);
  for (const r of bad) console.log(`  ${r.screen.padEnd(11)} ${r.tall ? `+${r.tall}px tall` : ''}${r.wide ? ` +${r.wide}px wide` : ''}`);
}
if (errors.length) console.log('\nErrors:\n' + errors.join('\n'));
console.log(`\nScreenshots in ${out}/`);
