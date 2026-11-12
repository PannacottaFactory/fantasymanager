import { useEffect, useRef } from 'react';
import { effectsOn } from '../../i18n/index.ts';
import { FxCanvas } from './fxCanvas.ts';
import type { FxBatch, Shot } from './matchFx.ts';
import { play } from '../../sound/sfx.ts';

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
