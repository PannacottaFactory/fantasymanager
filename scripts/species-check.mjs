/* global console, process, window, localStorage */
/**
 * Visual check of chosen species in the Test arena: builds both teams from the species and skills given, plays the
 * match live and takes screenshots at intervals; then lists the events seen (to check each mechanic fired) and the
 * console errors. The dev server must be running:  npx vite --port 5179
 *   node scripts/species-check.mjs <outDir> [url] [shots] [everyMs] [speed]
 * Teams come from MATCHES below: [species, skill equipped with the basic attack].
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'species-shots';
const url = process.argv[3] ?? 'http://localhost:5179/';
const shots = Number(process.argv[4] ?? 8);
const every = Number(process.argv[5] ?? 2500);
const speed = process.argv[6] ?? 'fast';
mkdirSync(out, { recursive: true });

/** Each match: home starters and away starters, [species, skill]. */
const MATCHES = [
  [
    [['dwarf', 'last-stand'], ['siren', 'siren-song'], ['valkyrie', 'raise-the-fallen'], ['pixie', 'mirror-images'], ['gnome', 'clockwork-bomb']],
    [['mimic', 'sticky-hide'], ['rakshasa', 'tiger-guard'], ['thunderbird', 'forked-lightning'], ['locust-swarm', 'devouring-cloud'], ['doppelganger', 'steal-form']],
  ],
  [
    [['sandworm', 'burrow'], ['lamassu', 'sacred-vow'], ['mandrake', 'seed-pod'], ['giant-moth', 'mesmerize'], ['jackal-warden', 'unravel']],
    [['sea-serpent', 'submerge'], ['ettin', 'double-smash'], ['sun-lion', 'last-stand'], ['poltergeist', 'possession'], ['rat-swarm', 'plague-tide']],
  ],
];

/** Basic attack of each species above (equipped with its skill). */
const BASIC = {
  dwarf: 'dwarf-hammer', siren: 'salt-spray', valkyrie: 'valkyrie-spear', pixie: 'glitter-bolt', gnome: 'gnome-crossbow',
  mimic: 'lid-snap', rakshasa: 'tiger-claws', thunderbird: 'storm-talons', 'locust-swarm': 'stripping-bites', doppelganger: 'borrowed-blade',
  sandworm: 'grinding-maw', lamassu: 'lamassu-hooves', mandrake: 'root-lash', 'giant-moth': 'scale-dust', 'jackal-warden': 'khopesh',
  'sea-serpent': 'serpent-fangs', ettin: 'twin-clubs', 'sun-lion': 'golden-claws', poltergeist: 'flying-crockery', 'rat-swarm': 'gnawing-horde',
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((s) => localStorage.setItem('arena.speed', s), speed);
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
const wait = (ms) => page.waitForTimeout(ms);
const report = [];

for (let m = 0; m < MATCHES.length; m++) {
  await page.goto(url);
  await wait(800);
  await page.evaluate(() => window.__fm.getState().setScreen('arena'));
  await wait(500);
  await page.evaluate(([sides, BASIC]) => {
    const A = window.__arena;
    sides.forEach((list, side) => {
      let team = A.getState().teams[side];
      team.tactic.lineup.forEach((slot, i) => {
        if (list[i]) A.getState().swapSpecies(side, slot.creatureId, list[i][0]);
      });
      team = A.getState().teams[side];
      const skills = { ...(team.tactic.skills ?? {}) };
      team.tactic.lineup.forEach((slot, i) => {
        const c = team.creatures.find((x) => x.id === slot.creatureId);
        if (c && list[i]) skills[c.id] = [BASIC[list[i][0]], list[i][1]];
      });
      A.getState().setTeam(side, { ...team, tactic: { ...team.tactic, skills } });
    });
    A.getState().setPlayerControls(false);
    A.getState().start();
  }, [MATCHES[m], BASIC]);
  for (let i = 0; i < shots; i++) {
    await wait(every);
    await page.screenshot({ path: `${out}/m${m + 1}-${String(i + 1).padStart(2, '0')}.png` });
  }
  // Jump to the result, then read what happened.
  const skip = page.locator('.live button', { hasText: /⏭/ });
  if (await skip.count()) await skip.first().click();
  await wait(1500);
  await page.screenshot({ path: `${out}/m${m + 1}-end.png` });
  const toReport = page.locator('.live button.btn.primary').last();
  if (await toReport.count()) await toReport.click();
  for (let k = 0; k < 30 && !(await page.evaluate(() => window.__arena.getState().result)); k++) await wait(500);
  const seen = await page.evaluate(() => {
    const r = window.__arena.getState().result;
    if (!r) return null;
    const count = {};
    const add = (k) => (count[k] = (count[k] ?? 0) + 1);
    for (const e of r.events) {
      if (e.type === 'attack') {
        for (const f of ['chain', 'riposte', 'charmed', 'decoy', 'undying', 'ambush']) if (e[f]) add(`attack.${f}`);
      } else if (e.type === 'revive') add(e.by ? 'raise' : 'revive');
      else if (e.type === 'dispel') add(e.stolen ? 'steal' : 'dispel');
      else if (e.type === 'effectApplied') add(`+${e.effect}`);
      else if (e.type === 'effectTick' && ['ticking-bomb', 'seed-pod', 'haunted'].includes(e.effect)) add(`blast.${e.effect}`);
    }
    return { outcome: r.outcome, count };
  });
  await page.screenshot({ path: `${out}/m${m + 1}-report.png` });
  report.push({ match: m + 1, ...seen });
}

writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
console.log(JSON.stringify({ report, errors }, null, 2));
await browser.close();
