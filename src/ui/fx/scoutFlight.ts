/**
 * A scout sets off: the scout icon leaves the button in an arc towards the « Scouts » tab, leaving a trail of
 * light, and the tab pulses when it lands. Display only; nothing when effects are off.
 */
import { effectsOn } from '../i18n/index.ts';
import { fxLayer } from './FxLayer.tsx';

const FLIGHT_MS = 900;
const TRAIL = ['#fff3c4', '#e8c26a', '#9fd3c7'];

export function flyScout(from: Element | null, to: Element | null) {
  if (!from || !to || !effectsOn()) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2;
  const y1 = b.top + b.height / 2;
  // Control point above the higher of the two ends: a hop, not a straight line.
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - Math.max(80, Math.abs(x1 - x0) * 0.25);
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  });

  const el = document.createElement('div');
  el.className = 'scout-flyer';
  const icon = from.querySelector('svg')?.cloneNode(true);
  if (icon) el.appendChild(icon);
  document.body.appendChild(el);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = at(t);
    const scale = 1 + Math.sin(t * Math.PI) * 0.9;
    frames.push({ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale}) rotate(${(t - 0.5) * 30}deg)`, opacity: t > 0.92 ? 0.4 : 1 });
  }
  const anim = el.animate(frames, { duration: FLIGHT_MS, easing: 'cubic-bezier(.45,.05,.4,1)' });

  const fx = fxLayer();
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    window.setTimeout(() => {
      // The eased position is close enough to the linear one for a trail.
      const p = at(i / steps);
      fx?.emit({ x: p.x, y: p.y, palette: TRAIL, life: 0.55, size: 5, grow: -0.6, shape: 'glow', vy: 18 });
    }, (FLIGHT_MS * i) / steps);
  }
  anim.onfinish = () => {
    el.remove();
    fx?.sparkle(x1, y1);
    to.classList.remove('scout-landed');
    void (to as HTMLElement).offsetWidth;
    to.classList.add('scout-landed');
    window.setTimeout(() => to.classList.remove('scout-landed'), 900);
  };
}
