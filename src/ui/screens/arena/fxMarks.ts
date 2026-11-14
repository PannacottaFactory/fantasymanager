/**
 * Statuses and one-off reactions drawn on the fighter cards by the particle engine (display only):
 * poison bubbles, flames, blood drops, frost crystals, orbiting stars, shields, sigils, streams between two cards…
 */
import { cardRect, easeOut, Flash, glow, lerp, PALETTES, rand, Ring, shake, type Effect, type FxCanvas, type Particle, type Vec } from './fxCanvas.ts';
import { Sigil, Slash } from './fxCanvas.ts';
import type { Mark } from './matchFx.ts';

const POISON = ['#f2ffd0', '#b5f05a', '#6bc53a', '#2f6b28'];
const BLOOD = ['#ffd9cf', '#e8574a', '#a3221a', '#4a0d09'];
const ICE = ['#ffffff', '#e2f6ff', '#9fd8f5', '#4a9fd0'];
const GOLD = ['#fffbe8', '#ffe58a', '#f5b935', '#b9821c'];
const CURSE = ['#f3d9ff', '#c07bff', '#7e33c9', '#2a0f45'];
const RAGE = ['#fff1d6', '#ff9a4a', '#e8361f', '#5a1a10'];
const GREY = ['#eeeeee', '#b9b4aa', '#8a857c', '#4a4640'];
const STAMINA = ['#e8f6ff', '#8fd0ff', '#3f8fd8', '#1d4f86'];
const ACID = ['#fbffd0', '#e1f05a', '#a6b52a', '#4f5a14'];

type Emit = Partial<Particle> & { palette: readonly string[] };

/** Plays the mark of a status or reaction on its card. */
export function playMark(fx: FxCanvas, m: Mark) {
  const r = cardRect(m.id);
  if (!r) return;
  const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  /** A particle somewhere on the card. */
  const on = (p: Emit, where: 'any' | 'bottom' | 'top' | 'middle' = 'any') => {
    const x = r.left + rand(0.08, 0.92) * r.width;
    const y = where === 'bottom' ? r.bottom - rand(2, 10) : where === 'top' ? r.top + rand(2, 10) : where === 'middle' ? c.y + rand(-8, 8) : r.top + rand(0.15, 0.85) * r.height;
    fx.emit({ x, y, ...p });
  };
  const repeat = (n: number, f: (i: number) => void) => {
    for (let i = 0; i < n; i++) f(i);
  };
  /** Keeps spawning for a while (flames licking, bubbles rising). */
  const stream = (ms: number, perSecond: number, f: () => void) => fx.stream(ms, perSecond, f);
  const big = !m.tick;
  const doses = Math.min(5, m.stacks ?? 1);

  switch (m.kind) {
    case 'burn':
      stream(big ? 900 : 550, big ? 70 : 45, () => on({ vx: rand(-15, 15), vy: rand(-140, -70), palette: PALETTES.fire, life: rand(0.4, 0.7), size: rand(5, 10), shape: 'glow', grow: 0.15, drag: 0.97 }, 'bottom'));
      if (big) fx.add(new Flash(c, '#ff7a1f', 110, false));
      repeat(big ? 6 : 3, () => on({ vx: rand(-10, 10), vy: rand(-50, -20), palette: GREY, life: 1.1, size: rand(8, 12), shape: 'smoke', grow: 2.6 }, 'top'));
      break;
    case 'poison':
      stream(big ? 900 : 600, 18 + doses * 8, () => on({ vx: rand(-10, 10), vy: rand(-60, -25), palette: POISON, life: rand(0.6, 1), size: rand(3, 6), shape: Math.random() < 0.6 ? 'bubble' : 'glow', drag: 0.98 }, 'bottom'));
      if (big) {
        fx.add(new Ring(c, POISON[2]!, 44, 520, 3, true));
        repeat(10, () => on({ vx: rand(-120, 120), vy: rand(-160, -40), palette: POISON, life: 0.6, size: 3, shape: 'glow', gravity: 600 }, 'middle'));
      }
      break;
    case 'bleed':
      if (big) fx.add(new Slash(c, BLOOD, false, { n: 3, r: 22, gap: 8 }));
      repeat(big ? 16 : 9, () => on({ vx: rand(-20, 20), vy: rand(0, 40), palette: BLOOD, life: rand(0.6, 0.9), size: rand(2, 4), shape: 'glow', gravity: 520, drag: 0.99 }, 'middle'));
      break;
    case 'chill':
      repeat(big ? 14 + doses * 3 : 8, () => on({ vx: rand(-20, 20), vy: rand(20, 60), palette: ICE, life: rand(0.8, 1.3), size: rand(3, 6), shape: 'flake', vr: rand(-3, 3), drag: 0.98 }, 'top'));
      if (big) fx.add(new Ring(c, ICE[2]!, 40, 600, 2, true));
      break;
    case 'freeze':
      fx.add(new Crystals(r, big ? 1100 : 600));
      if (big) {
        fx.add(new Flash(c, '#bfe9ff', 150, true));
        repeat(18, () => on({ vx: rand(-60, 60), vy: rand(-60, 60), palette: ICE, life: 0.9, size: rand(3, 6), shape: 'flake', vr: rand(-4, 4) }));
      }
      break;
    case 'thaw':
      fx.add(new Ring(c, ICE[1]!, 70, 420, 3));
      repeat(22, () => {
        const a = rand(0, Math.PI * 2);
        const v = rand(120, 260);
        fx.emit({ x: c.x + rand(-r.width / 3, r.width / 3), y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, palette: ICE, life: 0.8, size: rand(3, 6), shape: 'chunk', gravity: 800, vr: rand(-10, 10), grow: 1 });
      });
      break;
    case 'stun':
      fx.add(new Orbit({ x: c.x, y: r.top + 4 }, Math.min(46, r.width * 0.2), big ? 1300 : 900, GOLD, 'star'));
      if (big) fx.add(new Flash({ x: c.x, y: r.top + 4 }, '#ffe58a', 90, true));
      break;
    case 'slow':
      repeat(10, () => on({ vx: 0, vy: rand(20, 50), palette: GREY, life: 1, size: rand(8, 12), shape: 'smoke', grow: 2 }, 'top'));
      fx.add(new Chevrons(r, '#9fb6c8'));
      break;
    case 'weaken':
    case 'expose':
      fx.add(new Ring(c, CURSE[1]!, 46, 600, 2, true));
      repeat(10, () => on({ vx: rand(-10, 10), vy: rand(30, 70), palette: CURSE, life: 0.9, size: rand(7, 11), shape: 'smoke', grow: 2.2 }, 'top'));
      if (m.kind === 'expose') fx.add(new Slash(c, CURSE, false, { n: 2, r: 26, angle: 0.8, gap: 0 }));
      break;
    case 'fear':
      repeat(14, () => on({ vx: rand(-20, 20), vy: rand(-60, -20), palette: CURSE, life: rand(0.9, 1.3), size: rand(8, 13), shape: 'smoke', grow: 2.6 }, 'bottom'));
      fx.add(new Shiver(m.id));
      break;
    case 'shield':
      fx.add(new HexShell(r, ['#ffffff', '#cfe6ff', '#7fb4ef', '#3f6fb0'], 900, false));
      break;
    case 'shieldBreak':
      fx.add(new HexShell(r, ['#ffffff', '#cfe6ff', '#7fb4ef', '#3f6fb0'], 420, true));
      repeat(18, () => {
        const a = rand(0, Math.PI * 2);
        fx.emit({ x: c.x + Math.cos(a) * r.width * 0.3, y: c.y + Math.sin(a) * r.height * 0.4, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200), palette: ['#ffffff', '#cfe6ff', '#7fb4ef'], life: 0.6, size: rand(3, 5), shape: 'chunk', gravity: 500, vr: rand(-10, 10), grow: 1 });
      });
      break;
    case 'stone':
      repeat(18, () => {
        const a = rand(0, Math.PI * 2);
        const d = rand(50, 90);
        fx.emit({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.6, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 1.3, palette: PALETTES.earth, life: 0.45, size: rand(3, 6), shape: 'chunk', vr: rand(-8, 8), grow: 0.6, drag: 1 });
      });
      fx.add(new Ring(c, PALETTES.earth[1]!, 56, 600, 5));
      break;
    case 'rally':
      fx.add(new Ring(c, GOLD[2]!, 50, 600, 3));
      repeat(16, () => on({ vx: rand(-10, 10), vy: rand(-180, -90), palette: GOLD, life: rand(0.6, 0.9), size: rand(2, 4), shape: 'spark', drag: 0.97 }, 'bottom'));
      break;
    case 'rage':
      fx.add(new Ring(c, RAGE[2]!, 60, 520, 4));
      fx.add(new Flash(c, '#ff5a3c', 120, false));
      stream(600, 60, () => on({ vx: rand(-25, 25), vy: rand(-200, -100), palette: RAGE, life: rand(0.35, 0.6), size: rand(5, 9), shape: 'glow', grow: 0.2 }, 'bottom'));
      shake(3, 200);
      break;
    case 'evasive':
      repeat(10, () => on({ vx: rand(-260, 260), vy: 0, palette: ['#ffffff', '#eef4ff', '#b9c8e0'], life: 0.3, size: 2, shape: 'spark', drag: 0.9 }, 'any'));
      fx.add(new Ring(c, '#ffffff', 50, 420, 1.5, true));
      break;
    case 'camo':
      repeat(16, () => on({ vx: rand(-40, 40), vy: rand(-40, 10), palette: ['#e8efe0', '#a7b59a', '#6d7a62', '#3a4236'], life: rand(0.9, 1.3), size: rand(10, 15), shape: 'smoke', grow: 2.6 }));
      break;
    case 'curse':
      fx.add(new Sigil(c, CURSE, Math.min(40, r.height * 0.6), big ? 1100 : 700));
      repeat(8, () => on({ vx: rand(-10, 10), vy: rand(-30, -10), palette: CURSE, life: 1, size: rand(7, 11), shape: 'smoke', grow: 2 }, 'bottom'));
      break;
    case 'regen':
      repeat(big ? 14 : 8, () => on({ vx: rand(-10, 10), vy: rand(-70, -35), palette: PALETTES.heal, life: rand(0.7, 1.1), size: rand(3, 5), shape: Math.random() < 0.5 ? 'plus' : 'glow', drag: 0.98 }, 'bottom'));
      break;
    case 'sapped':
    case 'exhausted':
      repeat(12, () => on({ vx: rand(-10, 10), vy: rand(30, 80), palette: STAMINA, life: rand(0.7, 1), size: rand(2, 4), shape: 'glow', gravity: 120 }, 'top'));
      break;
    case 'thornsUp':
      repeat(18, () => {
        const a = rand(0, Math.PI * 2);
        fx.emit({ x: c.x + Math.cos(a) * r.width * 0.25, y: c.y + Math.sin(a) * r.height * 0.3, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, palette: PALETTES.nature, life: 0.3, size: 3, shape: 'spark', drag: 0.85 });
      });
      fx.add(new Ring(c, PALETTES.nature[2]!, 48, 480, 3, true));
      break;
    case 'silence':
      fx.add(new Hush(c, Math.min(26, r.height * 0.4)));
      break;
    case 'taunt':
      for (let i = 0; i < 3; i++) fx.add(new Ring(c, i % 2 ? '#ff9a4a' : '#e8361f', 50 + i * 22, 500 + i * 160, 3 - i * 0.6));
      fx.add(new Glyph({ x: c.x, y: r.top }, '!', '#ff8a5c'));
      break;
    case 'corrode':
      repeat(14, () => on({ vx: rand(-10, 10), vy: rand(10, 40), palette: ACID, life: rand(0.6, 1), size: rand(2, 4), shape: 'glow', gravity: 380 }, 'middle'));
      repeat(6, () => on({ vx: rand(-10, 10), vy: rand(-40, -10), palette: ACID, life: 1, size: rand(7, 10), shape: 'smoke', grow: 2 }, 'middle'));
      break;
    case 'mirror':
      fx.add(new Ring(c, '#e8fbff', 50, 600, 2));
      repeat(12, () => on({ vx: rand(-40, 40), vy: rand(-40, 40), palette: ['#ffffff', '#e8fbff', '#9fe3ff', '#7fb2cc'], life: rand(0.5, 0.9), size: rand(3, 5), shape: 'star', drag: 0.9 }));
      break;
    case 'drain':
    case 'siphon':
    case 'thorns':
    case 'reflect': {
      if (!m.from) break;
      const pal = m.kind === 'drain' ? STAMINA : m.kind === 'siphon' ? BLOOD : m.kind === 'thorns' ? PALETTES.nature : ['#ffffff', '#f0e6ff', '#c9b5ff', '#7e6bd0'];
      fx.add(new Stream(m.from, m.id, pal, m.kind === 'thorns' ? 'spark' : 'glow', m.kind === 'reflect' ? 360 : 650));
      break;
    }
    case 'cleanse':
      fx.add(new Ring(c, '#fff6d8', 56, 600, 3));
      fx.add(new Flash(c, '#fffbe8', 110, false));
      repeat(10, () => on({ vx: rand(-20, 20), vy: rand(-90, -40), palette: GREY, life: 1, size: rand(8, 12), shape: 'smoke', grow: 2.4 }, 'middle'));
      repeat(16, () => on({ vx: rand(-15, 15), vy: rand(-160, -60), palette: GOLD, life: rand(0.6, 1), size: rand(2, 4), shape: 'star', drag: 0.97 }, 'bottom'));
      break;
    case 'guard':
      // Discreet: a thin golden arc on the side facing the opponent.
      fx.add(new GuardArc(r));
      break;
    case 'rest':
      repeat(3, (i) => fx.add(new Ring({ x: c.x, y: c.y - i * 6 }, STAMINA[1]!, 30 + i * 14, 700 + i * 200, 2)));
      fx.add(new Glyph({ x: c.x + 20, y: r.top + 6 }, 'z', '#9fd8f5'));
      break;
    case 'transform':
      fx.add(new Vortex(c, Math.max(60, r.width * 0.35), RAGE));
      shake(5, 300);
      break;
    case 'sacrifice':
      fx.add(new Ring(c, BLOOD[2]!, 50, 500, 4));
      repeat(22, () => {
        const a = rand(-Math.PI, 0);
        const v = rand(100, 260);
        fx.emit({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: BLOOD, life: 0.8, size: rand(2, 4), shape: 'glow', gravity: 700 });
      });
      break;
    case 'flee':
      repeat(16, () => on({ vx: rand(-200, 200), vy: rand(-20, 0), palette: GREY, life: rand(0.6, 1), size: rand(8, 12), shape: 'smoke', grow: 2.2 }, 'bottom'));
      break;
    case 'hesitate':
      fx.add(new Swirl({ x: c.x, y: r.top + 2 }, Math.min(30, r.width * 0.12)));
      break;
    case 'swapIn':
      // Gold motes from the creature going off (now on the bench) to the one coming on, a soft ring, a few sparks.
      if (m.from) fx.add(new Stream(m.from, m.id, GOLD, 'glow', 700));
      window.setTimeout(() => {
        const rr = cardRect(m.id);
        if (!rr) return;
        const cc = { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
        fx.add(new Ring(cc, GOLD[1]!, Math.max(50, rr.width * 0.32), 650, 2));
        repeat(12, () => fx.emit({ x: rr.left + rand(0.1, 0.9) * rr.width, y: rr.bottom - rand(2, 8), vx: rand(-10, 10), vy: rand(-110, -50), palette: GOLD, life: rand(0.6, 0.9), size: rand(2, 3.5), shape: 'spark', drag: 0.97 }));
      }, m.from ? 500 : 0);
      break;
    case 'execute':
      fx.add(new Slash(c, BLOOD, true, { n: 1, r: 46, angle: 0.7 }));
      fx.add(new Slash(c, BLOOD, true, { n: 1, r: 46, angle: -0.7 }));
      fx.add(new Flash(c, '#e8361f', 140, true));
      break;
    case 'ambush':
      repeat(12, () => on({ vx: rand(-60, 60), vy: rand(-60, 20), palette: GREY, life: 0.9, size: rand(9, 13), shape: 'smoke', grow: 2.4 }));
      fx.add(new Flash(c, '#ffffff', 130, true));
      break;
    case 'pack':
      fx.add(new Slash(c, BLOOD, false, { n: Math.min(5, 1 + doses), r: 18, gap: 9 }));
      break;
  }
}

/** Frost crystals growing from the card's edges inwards (frozen). */
class Crystals implements Effect {
  private t0 = performance.now();
  private shards: { x: number; y: number; a: number; len: number; w: number }[] = [];
  constructor(
    r: DOMRect,
    private dur: number,
  ) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const top = i % 2 === 0;
      const x = r.left + rand(0.04, 0.96) * r.width;
      this.shards.push({ x, y: top ? r.top : r.bottom, a: (top ? Math.PI / 2 : -Math.PI / 2) + rand(-0.5, 0.5), len: rand(0.25, 0.55) * r.height, w: rand(4, 8) });
    }
  }
  update(now: number) {
    return now - this.t0 < this.dur;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / this.dur;
    const g = easeOut(Math.min(1, e / 0.3));
    const fade = e < 0.6 ? 1 : 1 - (e - 0.6) / 0.4;
    ctx.globalCompositeOperation = 'source-over';
    for (const s of this.shards) {
      const tx = s.x + Math.cos(s.a) * s.len * g;
      const ty = s.y + Math.sin(s.a) * s.len * g;
      const nx = -Math.sin(s.a) * s.w;
      const ny = Math.cos(s.a) * s.w;
      ctx.globalAlpha = fade * 0.75;
      ctx.fillStyle = '#d8f2ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x + nx, s.y + ny);
      ctx.lineTo(tx, ty);
      ctx.lineTo(s.x - nx, s.y - ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
  }
}

/** Little things circling above a head (stars of a stun). */
class Orbit implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private rx: number,
    private dur: number,
    private pal: readonly string[],
    private shape: 'star' | 'glow',
  ) {}
  update(now: number) {
    return now - this.t0 < this.dur;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / this.dur;
    const fade = e < 0.15 ? e / 0.15 : e > 0.75 ? 1 - (e - 0.75) / 0.25 : 1;
    for (let i = 0; i < 4; i++) {
      const a = now / 160 + (i * Math.PI * 2) / 4;
      const x = this.at.x + Math.cos(a) * this.rx;
      const y = this.at.y + Math.sin(a) * this.rx * 0.32;
      const front = Math.sin(a) > 0;
      ctx.globalAlpha = fade * (front ? 1 : 0.55);
      const s = front ? 7 : 5;
      glow(ctx, x, y, s * 3, this.pal[2]!);
      if (this.shape === 'star') {
        ctx.fillStyle = this.pal[0]!;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const ang = (k * Math.PI) / 5 - Math.PI / 2 + now / 300;
          const rr = k % 2 ? s * 0.45 : s;
          ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** A hexagon shell around the card (shield, guard) — or breaking apart. */
class HexShell implements Effect {
  private t0 = performance.now();
  constructor(
    private r: DOMRect,
    private pal: readonly string[],
    private dur: number,
    private breaking: boolean,
  ) {}
  update(now: number) {
    return now - this.t0 < this.dur;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / this.dur;
    const k = this.breaking ? 1 + e * 0.15 : 0.85 + 0.15 * easeOut(Math.min(1, e / 0.35));
    const fade = this.breaking ? 1 - e : e < 0.5 ? 1 : 1 - (e - 0.5) / 0.5;
    const cx = this.r.left + this.r.width / 2;
    const cy = this.r.top + this.r.height / 2;
    const rx = (this.r.width / 2 + 6) * k;
    const ry = (this.r.height / 2 + 6) * k;
    ctx.globalAlpha = fade;
    for (const [c, lw] of [[this.pal[2]!, 6], [this.pal[1]!, 2.5], ['#ffffff', 1]] as [string, number][]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      if (this.breaking) ctx.setLineDash([10, 8]);
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = fade * 0.12;
    ctx.fillStyle = this.pal[1]!;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Motes travelling from one card to another (stamina drained, life stolen, thorns, a spell sent back). */
class Stream implements Effect {
  private t0 = performance.now();
  private motes = Array.from({ length: 14 }, (_, i) => ({ delay: i * 28, off: rand(-14, 14), size: rand(3, 6) }));
  constructor(
    private from: string,
    private to: string,
    private pal: readonly string[],
    private shape: 'glow' | 'spark',
    private dur: number,
  ) {}
  update(now: number) {
    return now - this.t0 < this.dur + 14 * 28;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const a = cardRect(this.from);
    const b = cardRect(this.to);
    if (!a || !b) return;
    const p0 = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const p2 = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 60 };
    for (const m of this.motes) {
      const t = (now - this.t0 - m.delay) / this.dur;
      if (t < 0 || t > 1) continue;
      const u = 1 - t;
      const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
      const y = u * u * p0.y + 2 * u * t * (p1.y + m.off) + t * t * p2.y;
      ctx.globalAlpha = Math.sin(Math.PI * t);
      if (this.shape === 'spark') {
        ctx.strokeStyle = this.pal[1]!;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(lerp(x, p2.x, 0.04), lerp(y, p2.y, 0.04));
        ctx.stroke();
      }
      glow(ctx, x, y, m.size * 3, this.pal[1]!);
      glow(ctx, x, y, m.size, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}

/** A thin golden arc on the card's side facing the opponent (guard). */
class GuardArc implements Effect {
  private t0 = performance.now();
  constructor(private r: DOMRect) {}
  update(now: number) {
    return now - this.t0 < 650;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 650;
    const right = this.r.left + this.r.width / 2 < window.innerWidth / 2;
    const x = right ? this.r.right - 2 : this.r.left + 2;
    const cy = this.r.top + this.r.height / 2;
    const h = this.r.height * 0.42;
    ctx.globalAlpha = (e < 0.2 ? e / 0.2 : 1 - (e - 0.2) / 0.8) * 0.7;
    ctx.strokeStyle = GOLD[1]!;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(x - (right ? 10 : -10), cy, 14, h, 0, right ? -Math.PI / 2 : Math.PI / 2, right ? Math.PI / 2 : (Math.PI * 3) / 2);
    ctx.stroke();
    glow(ctx, x, cy, 26, GOLD[2]!);
    ctx.globalAlpha = 1;
  }
}

/** A little swirl turning above a head (hesitation, disobedience). */
class Swirl implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private r: number,
  ) {}
  update(now: number) {
    return now - this.t0 < 1100;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 1100;
    const fade = e < 0.15 ? e / 0.15 : e > 0.7 ? 1 - (e - 0.7) / 0.3 : 1;
    const rot = now / 180;
    ctx.globalAlpha = fade * 0.9;
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      ctx.strokeStyle = arm ? '#d8cbb3' : '#f2dfa6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = rot + arm * Math.PI + t * Math.PI * 2.2;
        const rr = this.r * (0.15 + t * 0.85);
        const x = this.at.x + Math.cos(a) * rr;
        const y = this.at.y - 6 - e * 10 + Math.sin(a) * rr * 0.38;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    glow(ctx, this.at.x, this.at.y - 6 - e * 10, this.r * 1.2, '#c9a24a');
    ctx.globalAlpha = 1;
  }
}

/** A floating sign above a card (« ! », « z »): engraved letter with a soft glow. */
class Glyph implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private text: string,
    private color: string,
  ) {}
  update(now: number) {
    return now - this.t0 < 1100;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 1100;
    const pop = e < 0.15 ? e / 0.15 : 1;
    const alpha = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
    const y = this.at.y - 4 - e * 22;
    const size = Math.round(12 + 8 * pop);
    ctx.globalAlpha = alpha * 0.8;
    glow(ctx, this.at.x, y, size * 2.6, this.color);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${size}px 'Spectral SC', 'Palatino Linotype', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(20,14,8,0.6)';
    ctx.strokeText(this.text, this.at.x, y);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(this.text, this.at.x, y);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
  }
}

/** A circle crossed out over the card (silence). */
class Hush implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private r: number,
  ) {}
  update(now: number) {
    return now - this.t0 < 1000;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 1000;
    const k = easeOut(Math.min(1, e / 0.25));
    ctx.globalAlpha = e < 0.6 ? 1 : 1 - (e - 0.6) / 0.4;
    ctx.strokeStyle = '#b9c8e0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.at.x, this.at.y, this.r * k, 0, Math.PI * 2);
    ctx.moveTo(this.at.x - this.r * 0.7 * k, this.at.y + this.r * 0.7 * k);
    ctx.lineTo(this.at.x + this.r * 0.7 * k, this.at.y - this.r * 0.7 * k);
    ctx.stroke();
    glow(ctx, this.at.x, this.at.y, this.r * 3, '#7e8bb0');
    ctx.globalAlpha = 1;
  }
}

/** Chevrons sinking down the card (slowed). */
class Chevrons implements Effect {
  private t0 = performance.now();
  constructor(
    private r: DOMRect,
    private color: string,
  ) {}
  update(now: number) {
    return now - this.t0 < 900;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 900;
    const cx = this.r.left + this.r.width / 2;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, Math.min(1, e * 1.4 - i * 0.15));
      const y = this.r.top + t * this.r.height;
      ctx.globalAlpha = Math.sin(Math.PI * t) * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - 14, y - 7);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + 14, y - 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Particles spiralling in, then a burst (metamorphosis). */
class Vortex implements Effect {
  private t0 = performance.now();
  private burst = false;
  constructor(
    private at: Vec,
    private r: number,
    private pal: readonly string[],
  ) {}
  update(now: number) {
    const e = now - this.t0;
    if (e > 650 && !this.burst) {
      this.burst = true;
    }
    return e < 900;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 650;
    if (e <= 1) {
      for (let i = 0; i < 18; i++) {
        const t = (e + i / 18) % 1;
        const a = t * Math.PI * 4 + i;
        const rr = this.r * (1 - t);
        ctx.globalAlpha = t;
        glow(ctx, this.at.x + Math.cos(a) * rr, this.at.y + Math.sin(a) * rr * 0.6, 14, this.pal[1 + (i % 2)]!);
      }
    } else {
      const k = (now - this.t0 - 650) / 250;
      ctx.globalAlpha = 1 - k;
      glow(ctx, this.at.x, this.at.y, this.r * 2.4 * (0.5 + k), this.pal[1]!);
      glow(ctx, this.at.x, this.at.y, this.r * (0.5 + k), '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}

/** The card trembles (terror). */
class Shiver implements Effect {
  constructor(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`);
    el?.animate?.(
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ transform: `translateX(${i % 2 ? 2 : -2}px)` })).concat([{ transform: 'none' }]),
      { duration: 500, easing: 'linear' },
    );
  }
  update() {
    return false;
  }
  draw() {}
}
