import { useEffect, useRef } from 'react';
import { effectsOn } from '../../i18n/index.ts';
import { FxCanvas } from './fxCanvas.ts';
import { playMark } from './fxMarks.ts';
import type { FxBatch, Mark, Shot } from './matchFx.ts';
import { play } from '../../sound/sfx.ts';

/** Full-screen canvas drawing projectiles and particles between fighter cards (display only). */
export function Projectiles({ shots, bursts, marks, flight }: { shots: Shot[]; bursts: FxBatch['bursts']; marks: Mark[]; flight: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FxCanvas | null>(null);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas?.getContext('2d')) return;
    const fx = new FxCanvas(canvas);
    engine.current = fx;
    return () => {
      fx.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (!flight || !shots.length) return;
    // Sounds land with the projectile (one per batch: the loudest).
    const s = shots.find((x) => x.ko) ?? shots.find((x) => x.crit && !x.miss) ?? shots[0]!;
    const sound = s.ko ? null : s.miss ? 'miss' : s.style === 'heal' ? 'heal' : s.style === 'buff' || s.style === 'debuff' ? 'magic' : s.crit ? 'crit' : 'hit';
    if (sound) {
      if (s.style === 'ranged' || s.style === 'spell') play('whoosh');
      const timer = window.setTimeout(() => play(sound), flight);
      timers.current.add(timer);
    }
    const fx = engine.current;
    if (!fx || !effectsOn()) return;
    for (const x of shots) fx.launch(x, flight);
    // A critical blow: a short camera punch on the arena and a jolt of the target.
    const crit = shots.find((x) => x.crit && !x.miss && !x.ko);
    if (crit) {
      const timer = window.setTimeout(() => critPunch(crit.to), flight);
      timers.current.add(timer);
    }
  }, [shots, flight]);
  useEffect(() => {
    if (bursts.some((b) => b.kind === 'ko')) {
      const t = window.setTimeout(() => play('ko'), flight || 0);
      timers.current.add(t);
    }
    const fx = engine.current;
    if (!fx || !bursts.length || !effectsOn()) return;
    // A knock-out lands with the blow that caused it (timers survive the next batches).
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      for (const b of bursts) {
        if (b.kind === 'ko') {
          fx.knockout(b.id);
          koStamp(b.id);
        }
        else fx.revive(b.id);
      }
    }, flight || 0);
    timers.current.add(timer);
  }, [bursts, flight]);
  useEffect(() => {
    const fx = engine.current;
    if (!fx || !marks.length || !effectsOn()) return;
    // Statuses land with the blow that brought them (ticks and lone reactions at once).
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      for (const m of marks) playMark(fx, m);
    }, flight || 0);
    timers.current.add(timer);
  }, [marks, flight]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  return <canvas ref={ref} className="fx-canvas" aria-hidden="true" />;
}

/** "K.O." stamp slammed onto the card and a short shake of the arena (DOM, display only). */
function koStamp(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`);
  if (!card) return;
  const stamp = document.createElement('span');
  stamp.className = 'ko-stamp';
  stamp.textContent = 'K.O.';
  stamp.setAttribute('aria-hidden', 'true');
  card.appendChild(stamp);
  window.setTimeout(() => stamp.remove(), 1800);
  const arena = card.closest<HTMLElement>('.live');
  if (arena) {
    arena.classList.remove('ko-shake');
    void arena.offsetWidth; // restart the animation
    arena.classList.add('ko-shake');
    window.setTimeout(() => arena.classList.remove('ko-shake'), 500);
  }
}

/** Restarts a CSS animation class on an element for `ms`. */
function pulseClass(el: HTMLElement, cls: string, ms: number) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

/** A critical hit: the arena punches in a hair, its edges flash, the target jolts. */
function critPunch(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`);
  const arena = card?.closest<HTMLElement>('.live');
  if (!card || !arena) return;
  pulseClass(arena, 'crit-punch', 450);
  pulseClass(card, 'crit-jolt', 450);
}
