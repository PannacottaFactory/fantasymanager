/* global console, process, window, localStorage, structuredClone */
/**
 * Plays the game like a player would, in a real (headless) browser: default layout, tutorial on, career mode,
 * every window answered as it comes (tips, board, reveals, requests, contract talks…), some matches live with the
 * breaks managed, the others simulated, a few management actions (assistant line-up, free points, scout, signing,
 * coach, facility), a whole season then the next one. Logs every window seen, console / page errors and states
 * where the game gets stuck. The dev server must be running:
 *   npx vite --port 5179   then   node scripts/play-check.mjs [outDir] [url] [weeks]
 * HOPELESS=1: a hopeless manager instead (every attribute of the squad at 1, board already angry, matches simulated,
 * no management): ultimatums, last warning, sacking, job window, new stable; every window is screenshotted.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'play-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const maxWeeks = Number(process.argv[4] ?? 26);
const hopeless = !!process.env.HOPELESS;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('arena.speed', 'fast'));
const errors = [];
const log = [];
const note = (s) => {
  log.push(s);
  console.log(s);
};
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}\n${e.stack ?? ''}`));
let shots = 0;
const shot = async (name) => page.screenshot({ path: `${out}/${String(++shots).padStart(3, '0')}-${name.replace(/[^\w-]+/g, '_').slice(0, 60)}.png` });
const wait = (ms = 400) => page.waitForTimeout(ms);
const firstLine = (e) => String(e?.message ?? e).split('\n')[0];
const st = () =>
  page.evaluate(() => {
    const s = window.__fm.getState();
    const g = s.game;
    return {
      screen: s.screen,
      match: s.match?.phase ?? null,
      recap: !!s.recap,
      drill: s.drill,
      progress: !!s.progress,
      reveals: s.reveals.length,
      signings: s.signings.length,
      talks: s.contractTalks,
      boardNotes: s.boardNotes.length,
      sheet: s.sheet,
      intro: s.intro,
      season: g?.season,
      matchday: g?.matchday,
      unemployed: !!g?.manager?.unemployed,
      balance: g ? g.clubs[g.playerTeamId]?.balance : null,
    };
  });

/** Titles of the windows already screenshotted (one shot per kind). */
const seen = new Set();
/** Answers whatever is on top: tutorial tip, then windows. Returns false when nothing was open. */
const clearOne = async () => {
  const tip = page.locator('.tutorial-bubble .btn.primary');
  if (await tip.count()) {
    const title = (await page.locator('.tutorial-bubble b').first().textContent().catch(() => '')) ?? '';
    if (!seen.has(`tip:${title}`)) {
      seen.add(`tip:${title}`);
      note(`  tip: ${title}`);
      await shot(`tip-${title}`);
    }
    // A tip may move or go away by itself while it animates (live match): no click is then needed.
    await tip.first().click({ timeout: 5000 }).catch(() => {});
    await wait(250);
    return true;
  }
  const overlay = page.locator('.overlay').last();
  if (!(await overlay.count())) return false;
  const head = ((await overlay.locator('.dialog-head').first().textContent().catch(() => '')) ?? '').trim().slice(0, 50);
  const cls = (await overlay.locator('.dialog').first().getAttribute('class').catch(() => '')) ?? '';
  const key = `${cls}|${head.replace(/\d+/g, '#')}`;
  if (hopeless || !seen.has(key)) {
    seen.add(key);
    note(`  window: ${head} [${cls}]`);
    await wait(1800);
    await shot(`win-${head}`);
  }
  // Drill: spin the roulette once when a session is waiting.
  const spin = overlay.locator('.session-go:not([disabled])');
  if (await spin.count()) {
    await spin.first().click();
    await wait(6500);
  }
  // Requests: answer with the first choice. Job offers: take the first.
  const choice = overlay.locator('.request-actions .btn, .job-actions .btn.primary');
  if (await choice.count()) {
    await choice.first().click();
    await wait(400);
    return true;
  }
  const close = overlay.locator('.dialog-head .btn.ghost[aria-label]');
  if (await close.count()) {
    await close.last().click();
  } else {
    const main = overlay.locator('.btn.primary');
    if (await main.count()) await main.last().click();
    else await page.keyboard.press('Escape');
  }
  await wait(400);
  return true;
};
const clearAll = async (where) => {
  for (let i = 0; i < 25; i++) if (!(await clearOne())) return;
  note(`STUCK: windows keep opening (${where})`);
  await shot(`stuck-${where}`);
};
const go = async (screen) => {
  await clearAll(`before ${screen}`);
  await page.evaluate((s) => window.__fm.getState().setScreen(s), screen);
  await wait(600);
  await clearAll(`on ${screen}`);
};
const clickText = async (re, scope = page) => {
  const b = scope.locator('button:not([disabled])', { hasText: re });
  if (!(await b.count())) return false;
  await b.first().click();
  await wait(400);
  return true;
};

// ---------- New game (default layout, tutorial on, career mode) ----------
await page.goto(url);
await wait(1200);
await shot('start');
const career = page.locator('.start').getByText(/Carrière/).first();
if (await career.count()) await career.click().catch(() => {});
await page.locator('.start .btn.primary').last().click();
await wait(1200);
await clearAll('intro');
if (hopeless) {
  await page.evaluate(() =>
    window.__fm.getState().update((g0) => {
      const g = structuredClone(g0);
      for (const c of g.teams.find((t) => t.id === g.playerTeamId).creatures) for (const k of Object.keys(c.attributes)) c.attributes[k] = 1;
      g.board.confidence = 28;
      return g;
    }),
  );
  await wait(400);
}
await shot('dashboard-0');

// ---------- Management actions on given weeks ----------
const manage = async (week) => {
  if (week === 1) {
    await go('tactics');
    await shot('tactics');
    if (!(await clickText(/Laisser l.assistant choisir/))) note('  ! no assistant line-up button');
    await wait(1200);
    await go('squad');
    await shot('squad');
    const link = page.locator('.sq-who-text .link');
    if (await link.count()) {
      await link.first().click();
      await wait(500);
      await clearAll('sheet tips');
      await shot('sheet');
      const plus = page.locator('.overlay .plus-btn');
      note(`  free-point buttons in sheet: ${await plus.count()}`);
      if (await plus.count()) await plus.first().click();
      await clearAll('sheet');
    }
  }
  if (week === 2) {
    await go('recruit');
    await shot('recruit');
    const scout = page.locator('.scout-send:not([disabled])');
    if (await scout.count()) {
      await scout.first().click();
      await wait(1500);
      note('  scout sent');
    } else note('  ! no scout button');
    // Sign the cheapest free agent through its sheet.
    const sign = page.locator('button:not([disabled])', { hasText: /^Recruter$/ });
    if (await sign.count()) {
      await sign.first().click();
      await wait(600);
      await shot('sign-sheet');
      const confirm = page.locator('.overlay button:not([disabled])', { hasText: /Signer pour/ });
      if (await confirm.count()) {
        await confirm.first().click();
        await wait(800);
        note('  free agent signed');
      } else note('  ! no « Signer pour » in the sheet');
      await clearAll('signing');
    } else note('  ! no free agent to sign');
  }
  if (week === 3) {
    await go('staff');
    await shot('staff');
    if (await clickText(/Trouver un entraîneur/)) {
      await shot('staff-candidates');
      if (await clickText(/Embaucher/)) note('  coach hired');
    }
    await go('facilities');
    await shot('facilities');
    if (await clickText(/Construire le niveau/)) note('  facility ordered');
    await clearAll('facility');
  }
  if (week === 5) {
    for (const s of ['league', 'finances', 'training', 'inbox', 'career', 'news', 'encyclopedia']) {
      await go(s);
      await shot(`screen-${s}`);
    }
  }
};

// ---------- Play the weeks ----------
let lastKey = '';
let same = 0;
for (let w = 1; w <= maxWeeks; w++) {
  await clearAll(`week ${w}`);
  let s = await st();
  note(`week ${w}: season ${s.season} matchday ${s.matchday} balance ${s.balance} screen ${s.screen}`);
  if (s.match === 'live') {
    note('  back to a live match left open: skipping to the result');
    await page.locator('.topbar .btn.primary').first().click();
    await wait(600);
    await clickText(/Aller au résultat/);
    await wait(800);
    await clickText(/Voir le rapport|Rapport|Terminer/, page.locator('.live'));
    await wait(600);
  }
  if (s.unemployed) {
    note('  unemployed: taking the first offer');
    await shot('unemployed');
  }
  if (!hopeless) await manage(w);
  await go('dashboard');
  if (hopeless) await shot(`dashboard-w${w}`);
  const top = page.locator('.topbar .btn.primary').first();
  const label = ((await top.textContent().catch(() => '')) ?? '').trim();
  note(`  top button: ${label}`);
  await top.click();
  await wait(900);
  await clearAll(`after top ${w}`);
  s = await st();
  if (s.match === 'pre') {
    const fix = page.locator('.remark.bad .btn.small');
    if (await fix.count()) {
      note(`  line-up issue: ${((await page.locator('.remark.bad').first().textContent()) ?? '').trim().slice(0, 120)}`);
      if (!seen.has('lineup-issue')) {
        seen.add('lineup-issue');
        await shot('lineup-issue');
      }
      await fix.first().click();
      await wait(300);
    }
    const live = !hopeless && w % (Number(process.env.LIVE_EVERY ?? 3)) === 1;
    const cta = page.locator(live ? 'button.cta-live' : 'button.cta-sim');
    if (await cta.isDisabled().catch(() => true)) {
      note('  ! match button disabled');
      await shot(`disabled-${w}`);
      // The player's tactic as it stands (starters, bench, fit creatures) to see why the assistant could not fix it.
      const dump = await page.evaluate(() => {
        const g = window.__fm.getState().game;
        const t = g.teams.find((x) => x.id === g.playerTeamId);
        const hurt = (c) => c.condition.injuries.some((i) => i.weeksLeft > 0);
        const name = (id) => t.creatures.find((c) => c.id === id)?.name ?? `?${id}`;
        return {
          lineup: t.tactic.lineup.map((s) => name(s.creatureId)),
          bench: t.tactic.bench.map(name),
          squad: t.creatures.length,
          fit: t.creatures.filter((c) => !hurt(c)).length,
        };
      });
      note(`  tactic: ${JSON.stringify(dump)}`);
    }
    await cta.click().catch((e) => note(`  ! ${e.message.split('\n')[0]}`));
    await wait(800);
    // Bench confirmation.
    const confirm = page.locator('.overlay').last();
    if (!(await clickText(/Compléter le banc/, confirm))) await clickText(/Jouer quand même/, confirm);
    if (live) {
      note('  playing live');
      await clearAll('live start');
      await clickText(/^Rapide$/, page.locator('[data-tip="live-speed"]'));
      for (let t = 0; t < 400; t++) {
        await wait(500);
        const tip = page.locator('.tutorial-bubble .btn.primary');
        if (await tip.count()) await clearOne();
        if (await page.locator('[data-tip="break"]').count()) {
          await clearAll('break tips');
          if (!seen.has('break')) {
            seen.add('break');
            await wait(1500);
            await shot('break');
          }
          const adv = page.locator('.assistant-btn');
          if (await adv.count()) await adv.first().click({ timeout: 5000 }).catch((e) => note(`  ! assistant: ${firstLine(e)}`));
          await wait(600);
          await clearAll('break tips 2');
          await page.locator('[data-tip="break"]').first().click({ timeout: 5000 }).catch(async (e) => {
            note(`  ! resume: ${firstLine(e)}`);
            await shot('resume-fail');
          });
          await wait(400);
          continue;
        }
        const s2 = await st();
        if (s2.match !== 'live') break;
        const done = page.locator('.live .btn.primary:not([data-tip])');
        if (await done.count()) {
          if (!seen.has('live-end')) {
            seen.add('live-end');
            await shot('live-end');
          }
          await done.first().click();
          await wait(800);
          break;
        }
        if (t % 60 === 59) await shot(`live-${w}-${t}`);
        if (t === 399) {
          note('  STUCK: live match never ended');
          await shot('live-stuck');
        }
      }
    }
    s = await st();
    if (s.match === 'report') {
      if (!seen.has('report')) {
        seen.add('report');
        await shot('report');
      }
      // Close the report from the top bar button (continue).
      const top2 = page.locator('.topbar .btn.primary').first();
      note(`  report shown; top button: ${((await top2.textContent()) ?? '').trim()}`);
      await top2.click();
      await wait(900);
    }
  }
  await clearAll(`end ${w}`);
  s = await st();
  const key = `${s.season}/${s.matchday}`;
  if (key === lastKey) {
    same++;
    note(`  ! week did not move (${key}, screen ${s.screen}, match ${s.match})`);
    await shot(`nomove-${w}`);
    if (same >= 3) {
      note('STUCK: three loops without progress');
      break;
    }
  } else same = 0;
  lastKey = key;
  const alive = await page.locator('.topbar').count();
  if (!alive) {
    note('CRASH: no top bar');
    await shot('crash');
    break;
  }
  const boundary = await page.locator('.error-panel').count();
  if (boundary) {
    note('ERROR BOUNDARY shown');
    await shot(`boundary-${w}`);
  }
}
await go('dashboard');
await shot('dashboard-end');
await go('league');
await shot('league-end');
writeFileSync(`${out}/log.txt`, `${log.join('\n')}\n\nERRORS\n${errors.join('\n')}\n`);
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors');
await browser.close();
