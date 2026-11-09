import { useEffect, useRef } from 'react';
import { FxCanvas } from './fxCanvas.ts';
import type { Shot } from './matchFx.ts';

/** Full-screen canvas drawing projectiles and particles between fighter cards (display only). */
export function Projectiles({ shots, flight }: { shots: Shot[]; flight: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FxCanvas | null>(null);
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
    if (!fx || !flight) return;
    for (const s of shots) fx.launch(s, flight);
  }, [shots, flight]);
  return <canvas ref={ref} className="fx-canvas" aria-hidden="true" />;
}
