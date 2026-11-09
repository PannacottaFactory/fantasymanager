/**
 * Canvas particle engine for the live match (display only, no game logic).
 * Projectiles home on the fighter cards' current positions (`[data-cid]`) every frame,
 * so they always land on the right card even if the layout moves.
 */
import type { ElementId } from '../../../data/schema.ts';
import type { Shot } from './matchFx.ts';

type Vec = { x: number; y: number };
type Shape = 'glow' | 'spark' | 'chunk' | 'leaf' | 'smoke' | 'star' | 'bubble';

interface Particle {
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

interface Effect {
  /** Returns false when finished. */
  update(now: number, dt: number): boolean;
  draw(ctx: CanvasRenderingContext2D, now: number): void;
}

// ——— Palettes (bright core → dark end) ———
const PALETTES: Record<ElementId | 'physical' | 'heal' | 'buff' | 'debuff', readonly string[]> = {
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

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
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
function cardRect(id: string): DOMRect | null {
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
    window.addEventListener('resize', this.resize);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.particles = [];
    this.effects = [];
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  };

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(now, dt);
      this.raf = this.effects.length || this.particles.length ? requestAnimationFrame(loop) : 0;
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
    for (const p of this.particles) if (p.shape === 'smoke' || p.shape === 'chunk' || p.shape === 'leaf') this.drawParticle(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) if (!(p.shape === 'smoke' || p.shape === 'chunk' || p.shape === 'leaf')) this.drawParticle(p);
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
  private t0 = performance.now();
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
    // Light is a beam: it strikes faster.
    this.dur = shot.style === 'spell' && shot.element === 'light' ? flight * 0.6 : shot.style === 'melee' ? flight * 0.8 : flight;
    const a = cardRect(shot.from);
    const b = cardRect(shot.to);
    if (a && b) {
      const p0 = facing(a, b);
      // Cast flash on the caster.
      if (shot.style !== 'melee' && shot.style !== 'ranged') this.fx.add(new Ring(p0, this.palette[1]!, 34, 420, 2, true));
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
    const p0 = facing(a, b);
    let p2 = facing(b, a);
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
      const lift = { melee: 0.02, ranged: 0.1, spell: 0.12, heal: 0.16, buff: 0.16, debuff: 0.05 }[this.shot.style];
      const h = Math.min(130, dist * lift) * (1 + this.wobble * 0.25);
      p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - h };
    }
    return { p0, p1, p2 };
  }

  update(now: number, dt: number): boolean {
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

  /** Particles shed along the way, per kind and element. */
  private emitTrail(dt: number) {
    const s = this.shot;
    const rate = { melee: 40, ranged: 25, spell: 260, heal: 120, buff: 100, debuff: 140 }[s.style] * (s.crit ? 1.5 : 1);
    this.emitAcc += rate * dt;
    const { x, y } = this.pos;
    const back = this.angle + Math.PI;
    while (this.emitAcc >= 1) {
      this.emitAcc--;
      const spread = rand(-0.6, 0.6);
      const v = rand(20, 70);
      const base = { x: x + rand(-3, 3), y: y + rand(-3, 3), vx: Math.cos(back + spread) * v, vy: Math.sin(back + spread) * v, palette: this.palette };
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

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
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

function beam(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, w: number, pal: readonly string[]) {
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

function tendril(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, now: number, pal: readonly string[]) {
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

/** Expanding ring (shockwave / cast circle). */
class Ring implements Effect {
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
class Slash implements Effect {
  private t0 = performance.now();
  private cuts: { a: number; r: number; dx: number; dy: number; delay: number }[];
  constructor(
    private at: Vec,
    private pal: readonly string[],
    big: boolean,
  ) {
    const n = big ? 3 : 2;
    const base = rand(-0.9, -0.5);
    this.cuts = Array.from({ length: n }, (_, i) => ({ a: base + rand(-0.15, 0.15), r: big ? 38 : 30, dx: (i - (n - 1) / 2) * 11, dy: (i - (n - 1) / 2) * 4, delay: i * 45 }));
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
class Flash implements Effect {
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

/** Coloured glow on the screen edges (crits and KOs). */
class Vignette implements Effect {
  private t0 = performance.now();
  constructor(
    private color: string,
    private strength: number,
  ) {}
  update(now: number) {
    return Math.max(0, now - this.t0) < 650;
  }
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const k = Math.max(0, now - this.t0) / 650;
    const a = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * this.strength;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, `${this.color}00`);
    g.addColorStop(1, this.color);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
  }
}

function shake(strength: number, dur: number) {
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
  if (heavy) {
    fx.add(new Vignette(shot.ko ? '#ff2a1a' : shot.element === 'physical' ? '#ff7a2f' : pal[2]!, shot.ko ? 0.55 : 0.4));
    shake(shot.ko ? 9 : 6, shot.ko ? 460 : 340);
  }
}
