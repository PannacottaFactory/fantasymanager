/* global console, process, document, Image, Buffer */
/**
 * Pixel comparison of two folders of screenshots (same file names), e.g. two runs of `scripts/style-shots.mjs`
 * before and after a stylesheet change. Prints the share of pixels that changed per picture and writes a diff image
 * (changed pixels in magenta over a faded copy) for each one that changed.
 *   node scripts/style-diff.mjs <beforeDir> <afterDir> [diffDir]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [a, b, diffDir = join(b ?? '.', '..', 'style-diff')] = process.argv.slice(2);
if (!a || !b) {
  console.log('usage: node scripts/style-diff.mjs <beforeDir> <afterDir> [diffDir]');
  process.exit(1);
}
mkdirSync(diffDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
let changed = 0;
const files = readdirSync(a).filter((f) => f.endsWith('.png'));
for (const f of files) {
  if (!existsSync(join(b, f))) {
    console.log(`${f}: missing in ${b}`);
    continue;
  }
  const da = `data:image/png;base64,${readFileSync(join(a, f)).toString('base64')}`;
  const db = `data:image/png;base64,${readFileSync(join(b, f)).toString('base64')}`;
  const r = await page.evaluate(
    async ([x, y]) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const c = document.getElementById('c');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(ia, 0, 0);
      const pa = ctx.getImageData(0, 0, w, h);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ib, 0, 0);
      const pb = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      let n = 0;
      for (let i = 0; i < pa.data.length; i += 4) {
        const d = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]);
        if (d > 24) {
          n++;
          out.data.set([255, 0, 200, 255], i);
        } else {
          const g = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 3;
          out.data.set([g, g, g, 70], i);
        }
      }
      ctx.putImageData(out, 0, 0);
      return { share: n / (w * h), sizeChanged: ia.width !== ib.width || ia.height !== ib.height, png: n ? c.toDataURL('image/png') : null };
    },
    [da, db],
  );
  if (r.share > 0 || r.sizeChanged) {
    changed++;
    console.log(`${f}: ${(r.share * 100).toFixed(2)} % of pixels changed${r.sizeChanged ? ' (size changed)' : ''}`);
    if (r.png) writeFileSync(join(diffDir, f), Buffer.from(r.png.split(',')[1], 'base64'));
  }
}
console.log(changed ? `${changed} of ${files.length} pictures changed (diffs in ${diffDir})` : `all ${files.length} pictures identical`);
await browser.close();
