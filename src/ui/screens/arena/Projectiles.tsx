import { useEffect, useRef } from 'react';
import { effectsOn } from '../../i18n/index.ts';
import { FxCanvas } from './fxCanvas.ts';
import type { FxBatch, Shot } from './matchFx.ts';

/** Full-screen canvas drawing projectiles and particles between fighter cards (display only). */
export function Projectiles({ shots, bursts, flight }: { shots: Shot[]; bursts: FxBatch['bursts']; flight: number }) {
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
    const fx = engine.current;
    if (!fx || !flight || !effectsOn()) return;
    for (const s of shots) fx.launch(s, flight);
  }, [shots, flight]);
  useEffect(() => {
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
