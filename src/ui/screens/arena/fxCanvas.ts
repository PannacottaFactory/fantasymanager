/**
 * Canvas particle engine for the live match (display only, no game logic).
 * Projectiles home on the fighter cards' current positions (`[data-cid]`) every frame,
 * so they always land on the right card even if the layout moves.
 */
import type { ElementId } from '../../../data/schema.ts';
import type { Shot } from './matchFx.ts';
import { effectsOn } from '../../i18n/index.ts';

export type Vec = { x: number; y: number };
type Shape = 'glow' | 'spark' | 'chunk' | 'leaf' | 'smoke' | 'star' | 'bubble' | 'flake' | 'plus';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left / total. */
  life: number;
  max: number;
  size: number;
  /** Size multiplier reached at the end of life. */
  grow: number;
  palette: readonly string[];
  shape: Shape;
  gravity: number;
  drag: number;
  rot: number;
  vr: number;
}

export interface Effect {
  /** Returns false when finished. */
  update(now: number, dt: number): boolean;
  draw(ctx: CanvasRenderingContext2D, now: number): void;
}

// ——— Palettes (bright core → dark end) ———
export const PALETTES: Record<ElementId | 'physical' | 'heal' | 'buff' | 'debuff', readonly string[]> = {
  fire: ['#fff6c4', '#ffc94a', '#ff7a1f', '#d8341b', '#5a1a10'],
  water: ['#f0fdff', '#9fe3ff', '#45aef0', '#1f6fc4'],
  earth: ['#f1dfb8', '#c39a5c', '#8a6538', '#4f3920'],
  air: ['#ffffff', '#e2f6ff', '#b4dcef', '#7fb2cc'],
  nature: ['#f2ffd0', '#a6e07a', '#5fae45', '#2f6b28'],
  shadow: ['#f0dcff', '#b583f0', '#7a3fc4', '#2c1548'],
  light: ['#ffffff', '#fffbe0', '#ffe48a', '#e6b93c'],
  physical: ['#ffffff', '#fff1d6', '#ffc477', '#c9823b'],
  heal: ['#f4fff2', '#a9f5a0', '#4fd26a', '#1f8f3e'],
  buff: ['#fffbe8', '#ffe58a', '#f5b935', '#b9821c'],
  debuff: ['#f3d9ff', '#c07bff', '#7e33c9', '#2a0f45'],
};

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

/** Pre-rendered soft glow sprites, one per colour. */
const sprites = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let s = sprites.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.45, `${color}66`);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, s);
  return s;
}
function smokeSprite(): HTMLCanvasElement {
  const key = '__smoke';
  let s = sprites.get(key);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(40,30,45,0.55)');
  grad.addColorStop(1, 'rgba(40,30,45,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, s);
  return s;
}

/** Where a projectile leaves / hits a card: just inside the edge facing the other card. */
export function cardRect(id: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`);
  return el ? el.getBoundingClientRect() : null;
}
function sameColumn(a: DOMRect, b: DOMRect): boolean {
  return Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) < a.width / 2;
}
function facing(r: DOMRect, other: DOMRect): Vec {
  const cy = r.top + r.height / 2;
  if (sameColumn(r, other)) return { x: r.left + r.width * 0.55, y: cy };
  const right = other.left + other.width / 2 > r.left + r.width / 2;
  return { x: right ? r.right - 46 : r.left + 46, y: cy };
}

export class FxCanvas {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private effects: Effect[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.idle();
    window.addEventListener('resize', this.resize);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.particles = [];
    this.effects = [];
    this.idle();
  }

  /** Keeps the drawing surface the size of the window (zoom and DPR changes included). */
  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * this.dpr);
    const h = Math.round(window.innerHeight * this.dpr);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  };

  /** Nothing to draw: wipe the surface and take it off screen, so no stale frame can ever stay visible. */
  private idle() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.canvas.style.visibility = 'hidden';
  }

  private start() {
    if (this.raf) return;
    this.canvas.style.visibility = 'visible';
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - this.last) / 1000);
      this.last = now;
      this.resize();
      try {
        this.frame(now, dt);
      } catch (err) {
        // A drawing error must never freeze a half-drawn frame on screen.
        console.warn('fx frame failed', err);
        this.effects = [];
        this.particles = [];
      }
      if (this.effects.length || this.particles.length) this.raf = requestAnimationFrame(loop);
      else {
        this.raf = 0;
        this.idle();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(now: number, dt: number) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Effects may spawn new ones while updating (impacts): keep those too.
    const current = this.effects;
    this.effects = [];
    const kept = current.filter((e) => e.update(now, dt));
    this.effects = [...kept, ...this.effects];
    // Particles.
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const f = Math.pow(p.drag, dt * 60);
      p.vx *= f;
      p.vy = p.vy * f + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      alive.push(p);
    }
    this.particles = alive;
    // Smoke first (normal blending), then everything bright with additive blending.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) if (p.shape === 'smoke' || p.shape === 'chunk' || p.shape === 'leaf' || p.shape === 'flake') this.drawParticle(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) if (!(p.shape === 'smoke' || p.shape === 'chunk' || p.shape === 'leaf' || p.shape === 'flake')) this.drawParticle(p);
    for (const e of this.effects) e.draw(ctx, now);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticle(p: Particle) {
    const ctx = this.ctx;
    const k = 1 - p.life / p.max; // 0 → 1 over the life
    const size = p.size * lerp(1, p.grow, k);
    const color = p.palette[Math.min(p.palette.length - 1, Math.floor(k * p.palette.length))]!;
    const alpha = k < 0.1 ? k / 0.1 : 1 - easeIn((k - 0.1) / 0.9);
    ctx.globalAlpha = Math.max(0, alpha);
    switch (p.shape) {
      case 'glow': {
        const s = size * 2.4;
        ctx.drawImage(glowSprite(color), p.x - s / 2, p.y - s / 2, s, s);
        break;
      }
      case 'spark': {
        const len = Math.min(26, Math.hypot(p.vx, p.vy) * 0.035) + size;
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
        ctx.stroke();
        break;
      }
      case 'star': {
        const s = size * 2.6;
        ctx.drawImage(glowSprite(color), p.x - s / 2, p.y - s / 2, s, s);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - size * 1.6, p.y);
        ctx.lineTo(p.x + size * 1.6, p.y);
        ctx.moveTo(p.x, p.y - size * 1.6);
        ctx.lineTo(p.x, p.y + size * 1.6);
        ctx.stroke();
        break;
      }
      case 'bubble': {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'chunk':
      case 'leaf': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = color;
        ctx.beginPath();
        if (p.shape === 'leaf') ctx.ellipse(0, 0, size * 0.75, size * 0.35, 0, 0, Math.PI * 2);
        else {
          ctx.moveTo(-size * 0.5, -size * 0.3);
          ctx.lineTo(size * 0.2, -size * 0.55);
          ctx.lineTo(size * 0.55, size * 0.15);
          ctx.lineTo(-size * 0.1, size * 0.5);
        }
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'smoke': {
        const s = size * 2.2;
        ctx.drawImage(smokeSprite(), p.x - s / 2, p.y - s / 2, s, s);
        break;
      }
      case 'flake': {
        // Six-armed snowflake.
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.22);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = p.rot + (i * Math.PI) / 3;
          ctx.moveTo(p.x - Math.cos(a) * size, p.y - Math.sin(a) * size);
          ctx.lineTo(p.x + Math.cos(a) * size, p.y + Math.sin(a) * size);
        }
        ctx.stroke();
        break;
      }
      case 'plus': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, size * 0.4);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - size, p.y);
        ctx.lineTo(p.x + size, p.y);
        ctx.moveTo(p.x, p.y - size);
        ctx.lineTo(p.x, p.y + size);
        ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  emit(p: Partial<Particle> & { x: number; y: number; palette: readonly string[] }) {
    if (this.particles.length > 2500) return;
    const life = p.life ?? 0.5;
    this.particles.push({
      vx: 0, vy: 0, size: 4, grow: 0.3, shape: 'glow', gravity: 0, drag: 0.94, rot: rand(0, 6.3), vr: 0, ...p, life, max: life,
    });
    this.start();
  }

  add(e: Effect) {
    this.effects.push(e);
    this.start();
  }

  /** Keeps spawning particles for a while (confetti, coin rain…). */
  stream(durationMs: number, perSecond: number, spawn: () => void) {
    const t0 = performance.now();
    let acc = 0;
    this.add({
      update: (now, dt) => {
        acc += dt * perSecond;
        while (acc >= 1) {
          spawn();
          acc -= 1;
        }
        return now - t0 < durationMs;
      },
      draw: () => {},
    });
  }

  /** A creature goes down: dust, debris and a red shockwave on its card. */
  knockout(id: string) {
    const r = cardRect(id);
    if (!r) return;
    const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dust = ['#d8cbb3', '#a8977b', '#6f6252', '#3e3429'];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 110);
      this.emit({ x: at.x + rand(-r.width / 3, r.width / 3), y: r.bottom - 6, vx: Math.cos(a) * v, vy: -Math.abs(Math.sin(a) * v) * 0.6, palette: dust, life: rand(0.8, 1.3), size: rand(8, 14), shape: 'smoke', grow: 2.4, drag: 0.94 });
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI, 0);
      const v = rand(120, 260);
      this.emit({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: dust, life: 0.9, size: rand(3, 6), shape: 'chunk', gravity: 900, vr: rand(-10, 10), drag: 0.98, grow: 1 });
    }
    this.add(new Ring(at, '#ff3b26', Math.max(60, r.width / 2), 600, 4));
    // The big blow: a red flash, a second wider shockwave, embers and bone-white shards.
    this.add(new Flash(at, '#ff5a3c', Math.max(160, r.width * 1.2), true));
    this.add(new Ring(at, '#ffd2a8', Math.max(110, r.width), 900, 2));
    const embers = ['#ffffff', '#ffd27a', '#ff7a3c', '#e8361f'];
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(160, 420);
      this.emit({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: embers, life: rand(0.5, 1.1), size: rand(2, 4.5), shape: i % 3 ? 'spark' : 'glow', drag: 0.93, gravity: 220 });
    }
  }

  /** A creature gets back up: light and bone-white sparks rising from its card. */
  revive(id: string) {
    const r = cardRect(id);
    if (!r) return;
    const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const pal = ['#ffffff', '#fff6d8', '#f2dfa6', '#c9a24a'];
    for (let i = 0; i < 30; i++) this.emit({ x: at.x + rand(-r.width / 2, r.width / 2), y: r.bottom - rand(0, 8), vx: rand(-15, 15), vy: rand(-160, -60), palette: pal, life: rand(0.8, 1.3), size: rand(3, 5), shape: i % 3 ? 'glow' : 'star', drag: 0.97 });
    this.add(new Ring(at, '#fff3c4', Math.max(70, r.width / 2), 700, 3));
    this.add(new Flash(at, '#fff3c4', 120, true));
  }

  /** Golden burst around a point (level up, reward). */
  sparkle(x: number, y: number, big = false) {
    const pal = ['#ffffff', '#fff3b0', '#f0cb4c', '#c9a24a'];
    for (let i = 0; i < (big ? 46 : 26); i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(60, big ? 260 : 180);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: pal, life: rand(0.5, 1), size: rand(2.5, 5), shape: i % 4 ? 'spark' : 'star', drag: 0.92, gravity: 60 });
    }
    this.add(new Ring({ x, y }, '#f0cb4c', big ? 90 : 60, 600, 3));
  }

  /** Gold coins flying from one point to another (money earned). */
  coins(from: { x: number; y: number }, to: { x: number; y: number }, n = 10) {
    const pal = ['#fff6c4', '#f0cb4c', '#d19a1e', '#8a5a12'];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now() + i * 45;
      const dur = rand(650, 900);
      const arc = rand(-120, -40);
      let done = false;
      this.add({
        update: (now) => {
          if (now - t0 >= dur && !done) {
            done = true;
            for (let k = 0; k < 4; k++) this.emit({ x: to.x, y: to.y, vx: rand(-80, 80), vy: rand(-90, 10), palette: pal, life: 0.4, size: 2.5, shape: 'spark', drag: 0.9 });
          }
          return now - t0 < dur;
        },
        draw: (ctx, now) => {
          const k = Math.min(1, Math.max(0, now - t0) / dur);
          if (k <= 0) return;
          const e = easeIn(k);
          const x = lerp(from.x, to.x, e);
          const y = lerp(from.y, to.y, e) + arc * Math.sin(Math.PI * k);
          ctx.globalAlpha = 1;
          ctx.fillStyle = pal[1]!;
          ctx.beginPath();
          ctx.ellipse(x, y, 5, 5 * Math.abs(Math.cos(now / 90 + i)), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = pal[3]!;
          ctx.lineWidth = 1;
          ctx.stroke();
        },
      });
    }
  }

  /** Confetti and gold raining over the whole screen (victory, promotion, trophy). */
  confetti(durationMs = 2200) {
    const colours = [['#fff6c4', '#f0cb4c'], ['#ffd1c4', '#e5574b'], ['#d9f5ff', '#3987e5'], ['#e2ffd6', '#3fd68e'], ['#f3d9ff', '#b583f0']];
    this.stream(durationMs, 90, () => {
      const pal = colours[Math.floor(rand(0, colours.length))]!;
      this.emit({ x: rand(0, window.innerWidth), y: -10, vx: rand(-40, 40), vy: rand(60, 160), palette: pal, life: rand(2.2, 3.4), size: rand(4, 7), shape: 'chunk', gravity: 90, drag: 0.985, vr: rand(-12, 12), grow: 1 });
    });
  }

  /** Fireworks bursting in the sky (promotion, cup, title). */
  fireworks(count = 7) {
    const pals = [PALETTES.fire, PALETTES.light, PALETTES.water, PALETTES.nature, PALETTES.shadow, PALETTES.buff];
    for (let i = 0; i < count; i++) {
      const t0 = performance.now() + i * rand(250, 420);
      const x = rand(window.innerWidth * 0.15, window.innerWidth * 0.85);
      const y = rand(window.innerHeight * 0.15, window.innerHeight * 0.45);
      const pal = pals[i % pals.length]!;
      let fired = false;
      this.add({
        update: (now) => {
          if (!fired && now >= t0) {
            fired = true;
            for (let k = 0; k < 60; k++) {
              const a = (k / 60) * Math.PI * 2;
              const v = rand(140, 230);
              this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: pal, life: rand(0.9, 1.4), size: rand(2, 3.5), shape: 'spark', gravity: 120, drag: 0.95 });
            }
            this.add(new Flash({ x, y }, pal[1]!, 90, false));
          }
          return !fired;
        },
        draw: () => {},
      });
    }
  }

  launch(shot: Shot, flight: number) {
    const a = cardRect(shot.from);
    const b = cardRect(shot.to);
    if (!a || !b) return;
    this.add(new Flight(this, shot, flight));
    // Lets automated checks know what is flying.
    this.canvas.dataset.last = `${shot.style}:${shot.element}${shot.crit ? ':crit' : ''}${shot.ko ? ':ko' : ''}`;
    this.canvas.dataset.count = String(Number(this.canvas.dataset.count ?? 0) + 1);
  }
}

// ——— Visual recipes ———

function paletteOf(shot: Shot): readonly string[] {
  if (shot.style === 'heal' || shot.style === 'buff' || shot.style === 'debuff') return PALETTES[shot.style];
  return PALETTES[shot.element];
}

/** A projectile from one card to another, homing on the target card every frame. */
class Flight implements Effect {
  private t0: number;
  private trail: Vec[] = [];
  private landed = false;
  private pos: Vec = { x: 0, y: 0 };
  private angle = 0;
  private emitAcc = 0;
  private palette: readonly string[];
  /** Small per-shot variety. */
  private wobble = rand(-1, 1);
  private missSide = Math.random() < 0.5 ? -1 : 1;
  private dur: number;

  constructor(
    private fx: FxCanvas,
    private shot: Shot,
    flight: number,
  ) {
    this.palette = paletteOf(shot);
    // Several strikes of one action follow each other; rays and bolts strike faster, blows faster than shots.
    this.t0 = performance.now() + (shot.seq ?? 0) * 120;
    const m = shot.motif;
    this.dur = m === 'bolt' || m === 'beam' || m === 'gaze' ? flight * 0.55 : shot.style === 'melee' ? flight * 0.8 : flight;
    const a = cardRect(shot.from);
    const b = cardRect(shot.to);
    if (a && b) {
      const p0 = facing(a, b);
      // Cast flash on the caster (a summoning circle for spells, a cry for shouts).
      if (shot.motif === 'shout') this.fx.add(new Ring(p0, this.palette[1]!, 50, 500, 3));
      else if (shot.style !== 'melee' && shot.style !== 'ranged') this.fx.add(new Ring(p0, this.palette[1]!, 34, 420, 2, true));
      for (let i = 0; i < 8; i++) {
        const ang = rand(0, Math.PI * 2);
        this.fx.emit({ x: p0.x, y: p0.y, vx: Math.cos(ang) * rand(30, 90), vy: Math.sin(ang) * rand(30, 90), life: rand(0.25, 0.45), size: rand(2, 4), palette: this.palette, shape: 'spark' });
      }
    }
  }

  /** Current endpoints (cards may have moved). */
  private path(): { p0: Vec; p1: Vec; p2: Vec } | null {
    const a = cardRect(this.shot.from);
    const b = cardRect(this.shot.to);
    if (!a || !b) return null;
    let p0 = facing(a, b);
    let p2 = facing(b, a);
    // Falling from the sky onto the target: storms and blessings.
    const fromSky = this.shot.motif === 'storm' || this.shot.motif === 'blessing';
    if (fromSky) {
      p2 = { x: b.left + b.width / 2 + this.wobble * b.width * 0.15, y: b.top + b.height / 2 };
      p0 = { x: p2.x + this.wobble * 30, y: Math.max(0, b.top - 150) };
      return { p0, p1: { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 }, p2 };
    }
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.shot.miss) {
      // Passes just above/below the card and keeps going.
      p2 = { x: p2.x + (dx / dist) * 90, y: p2.y + this.missSide * (b.height * 0.75) };
    }
    let p1: Vec;
    if (sameColumn(a, b)) {
      // Allies in the same column: bow towards the outer edge of the screen, never into the log.
      const outward = a.left + a.width / 2 < window.innerWidth / 2 ? -1 : 1;
      p1 = { x: (p0.x + p2.x) / 2 + outward * Math.min(a.width * 0.35, dist * 0.45), y: (p0.y + p2.y) / 2 };
    } else {
      const m = this.shot.motif;
      const lift = m === 'rock' ? 0.38 : m === 'spit' ? 0.22 : m === 'bolt' || m === 'beam' || m === 'gaze' || m === 'breath' ? 0 : m === 'wave' ? 0.04 : { melee: 0.02, ranged: 0.1, spell: 0.12, heal: 0.16, buff: 0.16, debuff: 0.05 }[this.shot.style];
      const h = Math.min(130, dist * lift) * (1 + this.wobble * 0.25);
      p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - h };
    }
    return { p0, p1, p2 };
  }

  update(now: number, dt: number): boolean {
    if (now < this.t0) return true;
    const raw = Math.max(0, now - this.t0) / this.dur;
    const path = this.path();
    if (!path) return false;
    const { p0, p1, p2 } = path;
    const t = Math.min(1, this.shot.style === 'melee' ? easeIn(Math.min(1, raw)) : Math.min(1, raw));
    const u = 1 - t;
    this.pos = { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
    this.angle = Math.atan2(2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y), 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x));
    if (raw < 1) {
      this.trail.push({ ...this.pos });
      if (this.trail.length > 14) this.trail.shift();
      this.emitTrail(dt);
    } else if (this.trail.length) this.trail.shift();
    if (raw >= 1 && !this.landed) {
      this.landed = true;
      if (!this.shot.miss) impact(this.fx, this.shot, p2, this.angle, this.palette);
    }
    return raw < 1 || this.trail.length > 0;
  }

  /** Trails that belong to a motif rather than an element (breath cone, rain, smoke clouds, notes…). True = handled. */
  private motifTrail(base: { x: number; y: number; vx: number; vy: number; palette: readonly string[] }): boolean {
    const s = this.shot;
    const pal = this.palette;
    switch (s.motif) {
      case 'breath': {
        // A cone poured from the mouth towards the target.
        const path = this.path();
        if (!path) return true;
        const { p0 } = path;
        const a = Math.atan2(this.pos.y - p0.y, this.pos.x - p0.x) + rand(-0.32, 0.32);
        const v = rand(260, 480);
        const shape = s.element === 'water' ? 'flake' : s.element === 'shadow' ? 'smoke' : 'glow';
        this.fx.emit({ x: p0.x, y: p0.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: pal, life: rand(0.35, 0.6), size: rand(5, 11), shape, grow: shape === 'smoke' ? 2.4 : 1.6, drag: 0.96, vr: rand(-4, 4) });
        return true;
      }
      case 'storm': {
        // Rain of the element around the falling head.
        const shape = s.element === 'water' ? 'flake' : s.element === 'earth' ? 'chunk' : s.element === 'nature' ? 'leaf' : s.element === 'shadow' ? 'smoke' : s.element === 'air' ? 'spark' : 'glow';
        this.fx.emit({ x: base.x + rand(-60, 60), y: base.y + rand(-50, 10), vx: rand(-40, 40) + (s.element === 'air' ? rand(-160, 160) : 0), vy: rand(160, 320), palette: pal, life: rand(0.3, 0.55), size: rand(3, 7), shape, gravity: 300, vr: rand(-6, 6), grow: shape === 'smoke' ? 2 : 0.6 });
        return true;
      }
      case 'blessing':
        this.fx.emit({ ...base, x: base.x + rand(-26, 26), vx: rand(-15, 15), vy: rand(40, 120), life: rand(0.4, 0.8), size: rand(2, 4), shape: Math.random() < 0.3 ? 'star' : 'glow' });
        return true;
      case 'cloud':
        this.fx.emit({ ...base, life: rand(0.7, 1.1), size: rand(9, 15), shape: 'smoke', grow: 2.6, drag: 0.95 });
        if (Math.random() < 0.4) this.fx.emit({ ...base, life: rand(0.4, 0.7), size: rand(2, 4), shape: 'glow' });
        return true;
      case 'song':
      case 'shout':
        this.fx.emit({ ...base, life: rand(0.3, 0.5), size: rand(2, 3), shape: 'spark' });
        return true;
      case 'bolt':
        if (Math.random() < 0.35) this.fx.emit({ ...base, vx: rand(-160, 160), vy: rand(-160, 160), life: rand(0.12, 0.25), size: rand(1.5, 3), shape: 'spark' });
        return true;
      case 'wave':
        this.fx.emit({ ...base, vx: base.vx + rand(-60, 60), vy: base.vy + rand(-80, 80), life: rand(0.3, 0.5), size: rand(3, 6), shape: s.element === 'water' ? 'bubble' : 'glow' });
        return true;
      case 'spit':
        this.fx.emit({ ...base, life: rand(0.3, 0.5), size: rand(2, 4), shape: 'glow', gravity: 420 });
        return true;
      case 'snare':
        this.fx.emit({ ...base, life: rand(0.5, 0.8), size: rand(4, 7), shape: 'leaf', gravity: 60, vr: rand(-6, 6), grow: 0.9 });
        return true;
      default:
        return false;
    }
  }

  /** Particles shed along the way, per kind and element. */
  private emitTrail(dt: number) {
    const s = this.shot;
    const motifRate: Partial<Record<string, number>> = { breath: 420, storm: 160, cloud: 90, blessing: 90, song: 20, shout: 30, bolt: 60, wave: 160, spit: 60, snare: 50 };
    const rate = (motifRate[s.motif] ?? { melee: 40, ranged: 25, spell: 260, heal: 120, buff: 100, debuff: 140 }[s.style]) * (s.crit ? 1.5 : 1);
    this.emitAcc += rate * dt;
    const { x, y } = this.pos;
    const back = this.angle + Math.PI;
    while (this.emitAcc >= 1) {
      this.emitAcc--;
      const spread = rand(-0.6, 0.6);
      const v = rand(20, 70);
      const base = { x: x + rand(-3, 3), y: y + rand(-3, 3), vx: Math.cos(back + spread) * v, vy: Math.sin(back + spread) * v, palette: this.palette };
      if (this.motifTrail(base)) continue;
      if (s.style !== 'spell') {
        this.fx.emit({ ...base, life: rand(0.2, 0.4), size: rand(2, 4), shape: s.style === 'debuff' ? 'smoke' : 'glow', grow: 0.2 });
        continue;
      }
      switch (s.element) {
        case 'fire':
          this.fx.emit({ ...base, vy: base.vy - rand(20, 60), life: rand(0.3, 0.6), size: rand(5, 11), shape: 'glow', grow: 0.1 });
          if (Math.random() < 0.25) this.fx.emit({ ...base, vy: -rand(20, 50), life: rand(0.5, 0.9), size: rand(6, 10), shape: 'smoke', grow: 2.5 });
          break;
        case 'water':
          this.fx.emit({ ...base, life: rand(0.3, 0.6), size: rand(3, 6), shape: Math.random() < 0.4 ? 'bubble' : 'glow', gravity: 120 });
          break;
        case 'earth':
          this.fx.emit({ ...base, life: rand(0.3, 0.6), size: rand(3, 6), shape: Math.random() < 0.5 ? 'chunk' : 'smoke', gravity: 260, vr: rand(-8, 8), grow: 1 });
          break;
        case 'air':
          this.fx.emit({ ...base, vx: base.vx * 2, vy: base.vy * 2, life: rand(0.2, 0.35), size: rand(2, 3), shape: 'spark' });
          break;
        case 'nature':
          this.fx.emit({ ...base, life: rand(0.5, 0.9), size: rand(5, 8), shape: 'leaf', gravity: 40, vr: rand(-6, 6), grow: 0.8 });
          break;
        case 'shadow':
          this.fx.emit({ ...base, life: rand(0.5, 0.9), size: rand(7, 12), shape: 'smoke', grow: 2.2 });
          if (Math.random() < 0.5) this.fx.emit({ ...base, life: rand(0.3, 0.5), size: rand(3, 6), shape: 'glow' });
          break;
        case 'light':
          this.fx.emit({ ...base, vx: rand(-30, 30), vy: rand(-30, 30), life: rand(0.3, 0.6), size: rand(2, 5), shape: Math.random() < 0.3 ? 'star' : 'glow' });
          break;
        default:
          this.fx.emit({ ...base, life: rand(0.25, 0.45), size: rand(3, 6), shape: 'glow' });
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    if (now < this.t0) return;
    const s = this.shot;
    const raw = Math.max(0, now - this.t0) / this.dur;
    const fade = s.miss ? Math.max(0, 1 - Math.max(0, raw - 0.75) / 0.25) : 1;
    if (raw >= 1 && (s.miss || this.landed)) {
      this.drawTrail(ctx, 0.6);
      return;
    }
    ctx.globalAlpha = fade;
    const { x, y } = this.pos;
    const scale = s.crit ? 1.35 : 1;
    if (this.drawMotif(ctx, now, scale)) {
      ctx.globalAlpha = 1;
      return;
    }
    if (s.style === 'melee') {
      this.drawTrail(ctx, 1, 9 * scale);
    } else if (s.style === 'ranged') {
      this.drawTrail(ctx, 0.5, 3);
      drawArrow(ctx, x, y, this.angle, scale, this.palette, s.element === 'physical');
    } else if (s.style === 'spell' && s.element === 'light') {
      // Beam: a ray growing from the caster to the current head.
      const p = this.path();
      if (p) {
        const w = 10 * scale * (0.6 + 0.4 * Math.sin(now / 40));
        beam(ctx, p.p0, this.pos, w, this.palette);
      }
      glow(ctx, x, y, 46 * scale, this.palette[1]!);
    } else if (s.style === 'spell' && s.element === 'earth') {
      this.drawTrail(ctx, 0.3, 4);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now / 90);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = this.palette[2]!;
      ctx.strokeStyle = this.palette[0]!;
      ctx.lineWidth = 1.5;
      const r = 11 * scale;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rr = r * (0.75 + ((i * 37) % 10) / 30);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
    } else if (s.style === 'debuff') {
      // A writhing tendril from the caster.
      const p = this.path();
      if (p) tendril(ctx, p.p0, this.pos, now, this.palette);
      glow(ctx, x, y, 30 * scale, this.palette[2]!);
    } else {
      const pulse = 1 + 0.15 * Math.sin(now / 45);
      const size = { spell: 44, heal: 30, buff: 28, debuff: 30, melee: 0, ranged: 0 }[s.style] * scale * pulse;
      glow(ctx, x, y, size * 1.8, this.palette[2]!);
      glow(ctx, x, y, size, this.palette[1]!);
      glow(ctx, x, y, size * 0.45, '#ffffff');
      if (s.style === 'heal' || s.style === 'buff') {
        // Little motes orbiting the orb.
        for (let i = 0; i < 3; i++) {
          const a = now / 120 + (i * Math.PI * 2) / 3;
          glow(ctx, x + Math.cos(a) * 12, y + Math.sin(a) * 12, 12, this.palette[1]!);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The look of the blow in flight, per motif. True = drawn. */
  private drawMotif(ctx: CanvasRenderingContext2D, now: number, scale: number): boolean {
    const s = this.shot;
    const pal = this.palette;
    const { x, y } = this.pos;
    const path = this.path();
    switch (s.motif) {
      case 'charge':
      case 'blunt':
      case 'quake':
      case 'sweep':
        // Heavy blows: a thick, dull streak.
        this.drawTrail(ctx, 0.9, (s.motif === 'charge' ? 16 : 13) * scale);
        if (s.motif === 'charge') speedLines(ctx, x, y, this.angle, now, pal);
        return true;
      case 'sting':
        this.drawTrail(ctx, 1, 3.5 * scale);
        glow(ctx, x, y, 16 * scale, pal[1]!);
        return true;
      case 'bite':
      case 'claw':
      case 'blade':
        this.drawTrail(ctx, 1, (s.motif === 'blade' ? 6 : 9) * scale);
        return true;
      case 'lash':
      case 'snare':
        if (path) whip(ctx, path.p0, this.pos, now, pal, s.motif === 'snare' ? 2.4 : 3.2);
        glow(ctx, x, y, 18 * scale, pal[1]!);
        return true;
      case 'volley': {
        const nx = -Math.sin(this.angle);
        const ny = Math.cos(this.angle);
        for (const k of [-1, 0, 1]) drawArrow(ctx, x + nx * k * 8 - Math.cos(this.angle) * Math.abs(k) * 8, y + ny * k * 8 - Math.sin(this.angle) * Math.abs(k) * 8, this.angle, 0.75 * scale, pal, s.element === 'physical');
        return true;
      }
      case 'rock':
        this.drawTrail(ctx, 0.3, 4);
        rock(ctx, x, y, now, s.element === 'physical' ? PALETTES.earth : pal, 10 * scale, s.element === 'water');
        return true;
      case 'spit':
        glow(ctx, x, y, 26 * scale, pal[2]!);
        glow(ctx, x, y, 14 * scale, pal[1]!);
        return true;
      case 'bolt':
        if (path) lightning(ctx, path.p0, this.pos, s.element === 'physical' ? PALETTES.air : pal, 3 * scale);
        glow(ctx, x, y, 34 * scale, pal[1]!);
        return true;
      case 'beam':
        if (path) beam(ctx, path.p0, this.pos, 9 * scale * (0.6 + 0.4 * Math.sin(now / 40)), pal);
        glow(ctx, x, y, 40 * scale, pal[1]!);
        return true;
      case 'gaze':
        if (path) {
          const nx = -Math.sin(this.angle) * 4;
          const ny = Math.cos(this.angle) * 4;
          beam(ctx, { x: path.p0.x + nx, y: path.p0.y + ny }, { x: x + nx, y: y + ny }, 2.5, pal);
          beam(ctx, { x: path.p0.x - nx, y: path.p0.y - ny }, { x: x - nx, y: y - ny }, 2.5, pal);
        }
        return true;
      case 'breath':
        if (path) glow(ctx, path.p0.x, path.p0.y, 40 * scale * (0.8 + 0.2 * Math.sin(now / 30)), pal[1]!);
        return true;
      case 'storm':
      case 'blessing':
        glow(ctx, x, y, 34 * scale, pal[2]!);
        glow(ctx, x, y, 16 * scale, pal[0]!);
        return true;
      case 'cloud':
        glow(ctx, x, y, 28, pal[2]!);
        return true;
      case 'wave':
        crescent(ctx, x, y, this.angle, 26 * scale, pal);
        return true;
      case 'shout':
        if (path) soundWaves(ctx, path.p0, this.pos, this.angle, pal);
        return true;
      case 'song':
        if (path) notes(ctx, path.p0, this.pos, now, pal);
        return true;
      default:
        return false;
    }
  }

  /** Comet tail through the last positions. */
  private drawTrail(ctx: CanvasRenderingContext2D, alpha: number, width = 6) {
    const pts = this.trail;
    if (pts.length < 2) return;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        ctx.globalAlpha = alpha * k * (pass ? 1 : 0.45);
        ctx.strokeStyle = pass ? '#ffffff' : this.palette[2]!;
        ctx.lineWidth = (pass ? width * 0.35 : width * 1.6) * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[i - 1]!.x, pts[i - 1]!.y);
        ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.drawImage(glowSprite(color), x - size / 2, y - size / 2, size, size);
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, pal: readonly string[], physical: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  glow(ctx, 0, 0, 26, pal[2]!);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = physical ? '#d9c39a' : pal[1]!;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.fillStyle = physical ? '#f2f2f2' : pal[0]!;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(5, -4.5);
  ctx.lineTo(5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = physical ? '#c2402f' : pal[2]!;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-23, -5);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-23, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
}

export function beam(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, w: number, pal: readonly string[]) {
  const passes: [string, number, number][] = [
    [pal[3]!, w * 2.6, 0.25],
    [pal[2]!, w * 1.4, 0.55],
    ['#ffffff', w * 0.45, 1],
  ];
  ctx.lineCap = 'round';
  for (const [c, lw, al] of passes) {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function tendril(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, now: number, pal: readonly string[]) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (const [c, lw, al] of [
    [pal[3]!, 9, 0.5],
    [pal[1]!, 3, 0.9],
  ] as [string, number, number][]) {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const amp = Math.sin(t * Math.PI) * 14;
      const off = Math.sin(t * 14 - now / 50) * amp;
      ctx.lineTo(a.x + dx * t + nx * off, a.y + dy * t + ny * off);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Speed streaks behind a charging body. */
function speedLines(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, now: number, pal: readonly string[]) {
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  ctx.strokeStyle = pal[0]!;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 9;
    const len = 30 + ((i * 17 + Math.floor(now / 40)) % 3) * 12;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + nx * off - Math.cos(angle) * 12, y + ny * off - Math.sin(angle) * 12);
    ctx.lineTo(x + nx * off - Math.cos(angle) * (12 + len), y + ny * off - Math.sin(angle) * (12 + len));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A whip, tentacle or vine: a wave that thins towards its tip. */
function whip(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, now: number, pal: readonly string[], width: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.lineCap = 'round';
  for (const [c, k, al] of [[pal[3]!, 2.4, 0.5], [pal[1]!, 1, 1]] as [string, number, number][]) {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    let prev: Vec | null = null;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const off = Math.sin(t * 9 - now / 45) * 16 * t * (1 - t * 0.5);
      const pt = { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off };
      if (prev) {
        ctx.lineWidth = Math.max(0.8, width * k * (1 - t * 0.7));
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      prev = pt;
    }
  }
  ctx.globalAlpha = 1;
}

/** A spinning rock (or snowball). */
function rock(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, pal: readonly string[], r: number, round: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(now / 80);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = round ? '#eaf6ff' : pal[2]!;
  ctx.strokeStyle = round ? '#9fd2f0' : pal[3] ?? pal[2]!;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (round) ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  else
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const rr = r * (0.75 + ((i * 37) % 10) / 30);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
}

/** Lightning: a jagged line redrawn every frame (it flickers), with a branch. */
function lightning(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, pal: readonly string[], w: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Vec[] = [];
  const n = Math.max(6, Math.round(len / 28));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : rand(-1, 1) * Math.min(22, len * 0.08);
    pts.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
  }
  const stroke = (p: Vec[], c: string, lw: number, al: number) => {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  };
  stroke(pts, pal[2]!, w * 4, 0.3);
  stroke(pts, pal[1]!, w * 1.8, 0.8);
  stroke(pts, '#ffffff', w * 0.7, 1);
  // A branch from somewhere along the bolt.
  const from = pts[Math.floor(rand(1, pts.length - 1))]!;
  const ang = Math.atan2(dy, dx) + rand(-0.9, 0.9);
  const branch = [from];
  for (let i = 1; i <= 3; i++) branch.push({ x: from.x + Math.cos(ang) * i * 14 + rand(-6, 6), y: from.y + Math.sin(ang) * i * 14 + rand(-6, 6) });
  stroke(branch, pal[1]!, w, 0.6);
  ctx.globalAlpha = 1;
}

/** A crescent of force travelling (gusts, waves, rune pulses). */
function crescent(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, r: number, pal: readonly string[]) {
  ctx.lineCap = 'round';
  for (const [c, lw, al, k] of [[pal[2]!, 10, 0.35, 1], [pal[1]!, 4, 0.9, 0.96], ['#ffffff', 1.5, 1, 0.92]] as [string, number, number, number][]) {
    ctx.globalAlpha = al;
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x - Math.cos(angle) * r, y - Math.sin(angle) * r, r * k, angle - 1, angle + 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Sound waves: arcs leaving the shouter towards the target. */
function soundWaves(ctx: CanvasRenderingContext2D, a: Vec, head: Vec, angle: number, pal: readonly string[]) {
  const dist = Math.hypot(head.x - a.x, head.y - a.y);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const r = dist - i * 22;
    if (r <= 6) continue;
    ctx.globalAlpha = 0.85 - i * 0.18;
    ctx.strokeStyle = i % 2 ? pal[2]! : pal[1]!;
    ctx.lineWidth = 3 - i * 0.5;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, angle - 0.45, angle + 0.45);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Notes dancing along the way (songs, pipes, hymns). */
function notes(ctx: CanvasRenderingContext2D, a: Vec, head: Vec, now: number, pal: readonly string[]) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '700 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const t = Math.max(0, 1 - i * 0.16);
    const x = lerp(a.x, head.x, t);
    const y = lerp(a.y, head.y, t) + Math.sin(now / 90 + i * 1.7) * 10;
    ctx.globalAlpha = 1 - i * 0.2;
    ctx.fillStyle = i % 2 ? pal[1]! : pal[0]!;
    ctx.fillText(i % 2 ? '\u266B' : '\u266A', x, y);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
}

/** Jaws closing on the target: two rows of fangs that snap shut. */
export class Jaws implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private pal: readonly string[],
    private size: number,
  ) {}
  update(now: number) {
    return now - this.t0 < 460;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 460;
    const close = Math.min(1, e / 0.35);
    const fade = e < 0.5 ? 1 : 1 - (e - 0.5) / 0.5;
    const gap = this.size * 0.9 * (1 - easeOut(close));
    const w = this.size * 1.4;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
    for (const dir of [-1, 1]) {
      const y0 = this.at.y + dir * (gap + 3);
      ctx.fillStyle = '#f6efe0';
      ctx.strokeStyle = this.pal[3] ?? '#5a1a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x0 = this.at.x - w / 2 + (i * w) / n;
        const x1 = x0 + w / n;
        const tip = y0 - dir * this.size * (i === 0 || i === n - 1 ? 0.55 : 0.4);
        ctx.moveTo(x0, y0);
        ctx.lineTo((x0 + x1) / 2, tip);
        ctx.lineTo(x1, y0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
  }
}

/** Cracks spreading from a heavy blow. */
export class Cracks implements Effect {
  private t0 = performance.now();
  private lines: { a: number; len: number; kink: number }[];
  constructor(
    private at: Vec,
    private pal: readonly string[],
    big: boolean,
  ) {
    this.lines = Array.from({ length: big ? 8 : 6 }, (_, i) => ({ a: (i / (big ? 8 : 6)) * Math.PI * 2 + rand(-0.3, 0.3), len: rand(22, big ? 60 : 44), kink: rand(-0.5, 0.5) }));
  }
  update(now: number) {
    return now - this.t0 < 650;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / 650;
    const grow = Math.min(1, e / 0.25);
    const fade = e < 0.4 ? 1 : 1 - (e - 0.4) / 0.6;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = this.pal[3] ?? '#3e3429';
    ctx.lineCap = 'round';
    for (const l of this.lines) {
      const mid = { x: this.at.x + Math.cos(l.a) * l.len * 0.5 * grow, y: this.at.y + Math.sin(l.a) * l.len * 0.5 * grow };
      const end = { x: mid.x + Math.cos(l.a + l.kink) * l.len * 0.5 * grow, y: mid.y + Math.sin(l.a + l.kink) * l.len * 0.5 * grow };
      ctx.globalAlpha = fade;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.at.x, this.at.y);
      ctx.lineTo(mid.x, mid.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade * 0.8;
    ctx.strokeStyle = this.pal[1]!;
    ctx.lineWidth = 1;
    for (const l of this.lines) {
      ctx.beginPath();
      ctx.moveTo(this.at.x, this.at.y);
      ctx.lineTo(this.at.x + Math.cos(l.a) * l.len * 0.5 * grow, this.at.y + Math.sin(l.a) * l.len * 0.5 * grow);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** A rotating occult circle (curses, hexes). */
export class Sigil implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private pal: readonly string[],
    private r: number,
    private dur = 900,
  ) {}
  update(now: number) {
    return now - this.t0 < this.dur;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const e = (now - this.t0) / this.dur;
    const k = Math.min(1, e / 0.25);
    const fade = e < 0.6 ? 1 : 1 - (e - 0.6) / 0.4;
    const rot = now / 400;
    const r = this.r * (0.6 + 0.4 * easeOut(k));
    ctx.globalAlpha = fade;
    ctx.strokeStyle = this.pal[1]!;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(this.at.x, this.at.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.at.x, this.at.y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    // Five-pointed star inside, and rune ticks around.
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = rot + (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = this.at.x + Math.cos(a) * r * 0.72;
      const py = this.at.y + Math.sin(a) * r * 0.72;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = this.pal[0]!;
    for (let i = 0; i < 12; i++) {
      const a = -rot * 1.5 + (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(this.at.x + Math.cos(a) * r * 0.78, this.at.y + Math.sin(a) * r * 0.78);
      ctx.lineTo(this.at.x + Math.cos(a) * r * 0.94, this.at.y + Math.sin(a) * r * 0.94);
      ctx.stroke();
    }
    glow(ctx, this.at.x, this.at.y, r * 1.4, this.pal[2]!);
    ctx.globalAlpha = 1;
  }
}

/** Expanding ring (shockwave / cast circle). */
export class Ring implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private color: string,
    private radius: number,
    private dur: number,
    private width: number,
    private dashed = false,
  ) {}
  update(now: number) {
    return Math.max(0, now - this.t0) < this.dur;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const k = Math.max(0, now - this.t0) / this.dur;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (1 - k * 0.6);
    if (this.dashed) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(this.at.x, this.at.y, this.radius * easeOut(k), k * 2, k * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}

/** Claw / blade slashes drawn across the target. */
export class Slash implements Effect {
  private t0 = performance.now();
  private cuts: { a: number; r: number; dx: number; dy: number; delay: number }[];
  constructor(
    private at: Vec,
    private pal: readonly string[],
    big: boolean,
    opts: { n?: number; r?: number; angle?: number; gap?: number } = {},
  ) {
    const n = opts.n ?? (big ? 3 : 2);
    const base = opts.angle ?? rand(-0.9, -0.5);
    const r = (opts.r ?? 30) * (big ? 1.25 : 1);
    const gap = opts.gap ?? 11;
    this.cuts = Array.from({ length: n }, (_, i) => ({ a: base + rand(-0.15, 0.15), r, dx: (i - (n - 1) / 2) * gap, dy: (i - (n - 1) / 2) * 4, delay: i * 45 }));
  }
  update(now: number) {
    return Math.max(0, now - this.t0) < 520;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    for (const c of this.cuts) {
      const e = Math.max(0, now - this.t0) - c.delay;
      if (e < 0) continue;
      const grow = Math.min(1, e / 110);
      const fade = e < 160 ? 1 : Math.max(0, 1 - (e - 160) / 300);
      const len = c.r * 2;
      const x0 = this.at.x + c.dx - Math.cos(c.a) * c.r;
      const y0 = this.at.y + c.dy - Math.sin(c.a) * c.r;
      const x1 = x0 + Math.cos(c.a) * len * grow;
      const y1 = y0 + Math.sin(c.a) * len * grow;
      for (const [col, lw, al] of [
        [this.pal[2]!, 9, 0.45],
        [this.pal[1]!, 4, 0.9],
        ['#ffffff', 1.6, 1],
      ] as [string, number, number][]) {
        ctx.globalAlpha = al * fade;
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2 + 6, (y0 + y1) / 2 - 6, x1, y1);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Short bright flash (+ lens flare on crits). */
export class Flash implements Effect {
  private t0 = performance.now();
  constructor(
    private at: Vec,
    private color: string,
    private size: number,
    private flare: boolean,
  ) {}
  update(now: number) {
    return Math.max(0, now - this.t0) < 380;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const k = Math.max(0, now - this.t0) / 380;
    const a = 1 - easeOut(k);
    ctx.globalAlpha = a;
    glow(ctx, this.at.x, this.at.y, this.size * (0.6 + k * 0.8), this.color);
    glow(ctx, this.at.x, this.at.y, this.size * 0.4, '#ffffff');
    if (this.flare) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * a;
      const l = this.size * 1.6 * (0.5 + k);
      ctx.beginPath();
      ctx.moveTo(this.at.x - l, this.at.y);
      ctx.lineTo(this.at.x + l, this.at.y);
      ctx.moveTo(this.at.x, this.at.y - l * 0.45);
      ctx.lineTo(this.at.x, this.at.y + l * 0.45);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export function shake(strength: number, dur: number) {
  if (!effectsOn()) return;
  const arena = document.querySelector<HTMLElement>('.live');
  if (!arena?.animate) return;
  const a = strength;
  arena.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-a}px, ${a / 2}px)` },
      { transform: `translate(${a}px, ${-a / 2}px)` },
      { transform: `translate(${-a / 2}px, ${-a / 3}px)` },
      { transform: `translate(${a / 3}px, ${a / 3}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration: dur, easing: 'ease-out' },
  );
}

/** Everything that happens when a projectile lands. */
function impact(fx: FxCanvas, shot: Shot, at: Vec, angle: number, pal: readonly string[]) {
  const heavy = shot.crit || !!shot.ko;
  const mult = shot.ko ? 2 : shot.crit ? 1.6 : 1;
  const burst = (n: number, speed: [number, number], opts: Partial<Particle>, dir?: number, spread = Math.PI) => {
    for (let i = 0; i < Math.round(n * mult); i++) {
      const a = dir === undefined ? rand(0, Math.PI * 2) : dir + rand(-spread, spread);
      const v = rand(speed[0], speed[1]) * (heavy ? 1.25 : 1);
      fx.emit({ x: at.x + rand(-4, 4), y: at.y + rand(-4, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v, palette: pal, ...opts });
    }
  };
  const back = angle + Math.PI;
  fx.add(new Flash(at, pal[1]!, heavy ? 150 : 100, heavy));
  // An area blow hitting several creatures: smaller per target.
  const motifDone = impactMotif(fx, shot, at, angle, pal, heavy, burst);
  if (motifDone) {
    finishHeavy(fx, shot, at, pal, heavy);
    return;
  }

  switch (shot.style) {
    case 'melee':
      fx.add(new Slash(at, pal, heavy));
      burst(14, [120, 320], { life: 0.35, size: 3, shape: 'spark', gravity: 500, drag: 0.92 }, back, 1.1);
      break;
    case 'ranged':
      burst(10, [90, 240], { life: 0.35, size: 2.5, shape: 'spark', gravity: 400, drag: 0.92 }, back, 0.9);
      burst(4, [20, 60], { life: 0.6, size: 7, shape: 'smoke', grow: 2 });
      break;
    case 'heal':
      fx.add(new Ring(at, pal[2]!, 46, 520, 3));
      burst(18, [20, 70], { life: rand(0.7, 1), size: 4, shape: 'glow', gravity: -90, drag: 0.96 });
      burst(6, [10, 40], { life: 0.9, size: 4, shape: 'star', gravity: -60 });
      break;
    case 'buff':
      fx.add(new Ring(at, pal[2]!, 44, 520, 3));
      burst(18, [10, 50], { life: rand(0.7, 1.1), size: 3.5, shape: 'spark', gravity: -260, drag: 0.97 });
      break;
    case 'debuff':
      fx.add(new Ring(at, pal[1]!, 40, 560, 3, true));
      burst(14, [10, 40], { life: 0.9, size: 9, shape: 'smoke', grow: 2.4, gravity: 40 });
      burst(12, [60, 140], { life: 0.4, size: 3, shape: 'glow', drag: 0.9 });
      break;
    case 'spell':
      fx.add(new Ring(at, pal[1]!, heavy ? 80 : 58, 480, 4));
      switch (shot.element) {
        case 'fire':
          burst(34, [80, 260], { life: rand(0.4, 0.7), size: 8, shape: 'glow', drag: 0.9, gravity: -120, grow: 0.15 });
          burst(10, [20, 70], { life: 1, size: 10, shape: 'smoke', grow: 3, gravity: -70 });
          burst(12, [150, 340], { life: 0.4, size: 2.5, shape: 'spark', gravity: 300 });
          break;
        case 'water':
          burst(26, [100, 260], { life: 0.6, size: 4, shape: 'glow', gravity: 600, drag: 0.97 }, -Math.PI / 2, 1.3);
          burst(10, [30, 90], { life: 0.7, size: 6, shape: 'bubble', gravity: -40 });
          break;
        case 'earth':
          burst(18, [120, 300], { life: 0.8, size: 7, shape: 'chunk', gravity: 900, vr: 10, drag: 0.98, grow: 1 }, -Math.PI / 2, 1.2);
          burst(12, [30, 90], { life: 1, size: 12, shape: 'smoke', grow: 2.5 });
          break;
        case 'air':
          burst(28, [180, 380], { life: 0.35, size: 2.5, shape: 'spark', drag: 0.88 });
          fx.add(new Ring(at, pal[2]!, 70, 380, 2));
          break;
        case 'nature':
          burst(20, [80, 200], { life: 1, size: 7, shape: 'leaf', gravity: 120, vr: 8, drag: 0.93, grow: 0.9 });
          burst(10, [40, 120], { life: 0.5, size: 4, shape: 'glow' });
          break;
        case 'shadow':
          burst(16, [20, 70], { life: 1.1, size: 12, shape: 'smoke', grow: 2.6 });
          burst(20, [120, 260], { life: 0.5, size: 4, shape: 'glow', drag: 0.88 });
          break;
        case 'light':
          burst(16, [60, 200], { life: 0.7, size: 5, shape: 'star', drag: 0.9 });
          burst(20, [150, 320], { life: 0.35, size: 2, shape: 'spark', drag: 0.88 });
          break;
        default:
          burst(24, [80, 220], { life: 0.5, size: 5, shape: 'glow', drag: 0.9 });
      }
      break;
  }
  finishHeavy(fx, shot, at, pal, heavy);
}

function finishHeavy(fx: FxCanvas, shot: Shot, at: Vec, pal: readonly string[], heavy: boolean) {
  if (!heavy) return;
  // Kept on the struck card: a wider shockwave and a second flash (never a full-screen tint).
  const tint = shot.ko ? '#ff3b26' : shot.element === 'physical' ? '#ff8a3c' : pal[2]!;
  fx.add(new Ring(at, tint, shot.ko ? 110 : 80, 520, 4));
  fx.add(new Flash(at, tint, shot.ko ? 110 : 80, false));
  shake(shot.ko ? 9 : 6, shot.ko ? 460 : 340);
}

type Burst = (n: number, speed: [number, number], opts: Partial<Particle>, dir?: number, spread?: number) => void;

/** Element sparks added to a physical motif (fire claws, frost bite, shadow grip…). */
function elementTouch(burst: Burst, element: Shot['element']) {
  switch (element) {
    case 'fire':
      burst(14, [60, 180], { life: 0.5, size: 6, shape: 'glow', gravity: -140, drag: 0.9, grow: 0.2, palette: PALETTES.fire });
      break;
    case 'water':
      burst(10, [40, 140], { life: 0.7, size: 4, shape: 'flake', drag: 0.94, gravity: 60, vr: 4, palette: PALETTES.water });
      break;
    case 'nature':
      burst(8, [40, 120], { life: 0.7, size: 3, shape: 'glow', gravity: 300, palette: PALETTES.nature });
      break;
    case 'shadow':
      burst(8, [20, 60], { life: 0.9, size: 10, shape: 'smoke', grow: 2.2, palette: PALETTES.shadow });
      break;
    case 'light':
      burst(8, [60, 160], { life: 0.6, size: 4, shape: 'star', drag: 0.9, palette: PALETTES.light });
      break;
    case 'earth':
      burst(8, [100, 220], { life: 0.7, size: 5, shape: 'chunk', gravity: 800, vr: 8, grow: 1, palette: PALETTES.earth });
      break;
    case 'air':
      burst(12, [160, 320], { life: 0.3, size: 2, shape: 'spark', drag: 0.88, palette: PALETTES.air });
      break;
    default:
      break;
  }
}

/** Impact of a motif; false = fall back to the generic impact of its style. */
function impactMotif(fx: FxCanvas, shot: Shot, at: Vec, angle: number, pal: readonly string[], heavy: boolean, burst: Burst): boolean {
  const back = angle + Math.PI;
  const blood = ['#ffd9cf', '#e8574a', '#a3221a', '#4a0d09'];
  switch (shot.motif) {
    case 'bite':
      fx.add(new Jaws(at, pal, heavy ? 30 : 24));
      burst(10, [80, 220], { life: 0.5, size: 3, shape: 'glow', gravity: 600, drag: 0.95, palette: blood });
      elementTouch(burst, shot.element);
      return true;
    case 'claw':
      fx.add(new Slash(at, pal, heavy, { n: heavy ? 4 : 3, r: 30, gap: 10 }));
      burst(10, [120, 300], { life: 0.35, size: 3, shape: 'spark', gravity: 500, drag: 0.92 }, back, 1.1);
      elementTouch(burst, shot.element);
      return true;
    case 'blade':
      fx.add(new Slash(at, pal, heavy, { n: 1, r: 46, angle: rand(-0.5, -0.2) }));
      if (heavy) fx.add(new Slash(at, pal, false, { n: 1, r: 40, angle: rand(0.25, 0.55) }));
      burst(16, [180, 380], { life: 0.3, size: 2.5, shape: 'spark', gravity: 300, drag: 0.9 }, back, 0.8);
      elementTouch(burst, shot.element);
      return true;
    case 'blunt':
      fx.add(new Cracks(at, PALETTES.earth, heavy));
      fx.add(new Ring(at, pal[1]!, heavy ? 70 : 52, 420, 5));
      burst(8, [20, 70], { life: 0.8, size: 9, shape: 'smoke', grow: 2.4, palette: PALETTES.earth });
      burst(8, [120, 260], { life: 0.6, size: 4, shape: 'chunk', gravity: 900, vr: 10, grow: 1, palette: PALETTES.earth }, -Math.PI / 2, 1.2);
      elementTouch(burst, shot.element);
      shake(heavy ? 6 : 3, 260);
      return true;
    case 'charge':
      fx.add(new Ring(at, pal[1]!, 64, 380, 6));
      burst(22, [200, 420], { life: 0.35, size: 3, shape: 'spark', drag: 0.9 }, angle, 0.7);
      burst(6, [20, 60], { life: 0.7, size: 10, shape: 'smoke', grow: 2.2, palette: PALETTES.earth });
      elementTouch(burst, shot.element);
      shake(heavy ? 8 : 5, 300);
      return true;
    case 'sting':
      fx.add(new Slash(at, pal, false, { n: 1, r: 18, angle }));
      burst(10, [60, 160], { life: 0.6, size: 3, shape: 'glow', gravity: 420, drag: 0.95, palette: shot.element === 'physical' ? blood : pal });
      elementTouch(burst, shot.element);
      return true;
    case 'lash':
      fx.add(new Slash(at, pal, heavy, { n: 1, r: 40, angle: rand(-0.2, 0.2) }));
      burst(14, [140, 300], { life: 0.3, size: 2.5, shape: 'spark', drag: 0.9 });
      elementTouch(burst, shot.element);
      return true;
    case 'sweep':
      fx.add(new Slash(at, pal, heavy, { n: 1, r: 54, angle: rand(-0.1, 0.1) }));
      burst(12, [140, 300], { life: 0.35, size: 3, shape: 'spark', gravity: 400, drag: 0.92 }, back, 1.2);
      elementTouch(burst, shot.element);
      return true;
    case 'quake':
      fx.add(new Cracks(at, PALETTES.earth, true));
      burst(12, [140, 300], { life: 0.8, size: 6, shape: 'chunk', gravity: 900, vr: 10, grow: 1, palette: shot.element === 'fire' ? PALETTES.fire : PALETTES.earth }, -Math.PI / 2, 0.9);
      burst(10, [30, 90], { life: 1, size: 12, shape: 'smoke', grow: 2.5, palette: PALETTES.earth });
      shake(5, 300);
      return true;
    case 'rock':
      burst(14, [120, 280], { life: 0.7, size: 6, shape: shot.element === 'water' ? 'flake' : 'chunk', gravity: 900, vr: 10, drag: 0.97, grow: 1 }, -Math.PI / 2, 1.3);
      burst(8, [30, 90], { life: 0.9, size: 10, shape: 'smoke', grow: 2.4, palette: PALETTES.earth });
      if (shot.element === 'fire') burst(20, [80, 220], { life: 0.6, size: 8, shape: 'glow', gravity: -120, drag: 0.9, palette: PALETTES.fire });
      return true;
    case 'spit':
      burst(18, [80, 220], { life: 0.7, size: 4, shape: 'glow', gravity: 700, drag: 0.97 }, -Math.PI / 2, 1.4);
      burst(6, [10, 40], { life: 1, size: 8, shape: 'smoke', grow: 2, gravity: -30 });
      return true;
    case 'bolt':
      fx.add(new Flash(at, '#ffffff', heavy ? 120 : 90, true));
      fx.add(new Ring(at, pal[1]!, 60, 300, 3));
      burst(26, [200, 460], { life: 0.25, size: 2, shape: 'spark', drag: 0.85 });
      return true;
    case 'shout':
      for (let i = 0; i < 3; i++) fx.add(new Ring(at, pal[1 + (i % 2)]!, 40 + i * 18, 420 + i * 120, 3 - i * 0.7));
      burst(10, [40, 120], { life: 0.6, size: 7, shape: 'smoke', grow: 2 });
      return true;
    case 'curse':
    case 'gaze':
      fx.add(new Sigil(at, pal, shot.motif === 'gaze' ? 26 : 34));
      burst(10, [10, 40], { life: 0.9, size: 9, shape: 'smoke', grow: 2.4, gravity: 40 });
      return true;
    case 'cloud':
      burst(16, [20, 80], { life: 1.3, size: 14, shape: 'smoke', grow: 2.8, drag: 0.94 });
      burst(10, [40, 120], { life: 0.7, size: 3, shape: 'glow', drag: 0.9 });
      return true;
    case 'snare':
      fx.add(new Sigil(at, PALETTES.nature, 30, 700));
      burst(16, [60, 160], { life: 0.9, size: 7, shape: 'leaf', gravity: 120, vr: 8, drag: 0.93, grow: 0.9, palette: PALETTES.nature });
      return true;
    case 'song':
      fx.add(new Ring(at, pal[2]!, 46, 520, 3));
      burst(12, [20, 70], { life: 0.9, size: 4, shape: shot.style === 'heal' ? 'plus' : 'star', gravity: -90, drag: 0.96 });
      return true;
    case 'blessing':
      fx.add(new Ring(at, pal[1]!, 50, 600, 3));
      burst(20, [10, 60], { life: rand(0.8, 1.1), size: 3.5, shape: shot.style === 'heal' ? 'plus' : 'spark', gravity: -200, drag: 0.97 });
      return true;
    case 'heal':
      fx.add(new Ring(at, pal[2]!, 46, 520, 3));
      burst(14, [20, 70], { life: rand(0.7, 1), size: 4, shape: 'plus', gravity: -90, drag: 0.96 });
      burst(6, [10, 40], { life: 0.9, size: 4, shape: 'star', gravity: -60 });
      return true;
    default:
      return false;
  }
}
