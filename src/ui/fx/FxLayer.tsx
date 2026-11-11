/**
 * App-wide particle layer (celebrations, level-ups, coins…), drawn above everything. Display only.
 * `fxLayer()` returns the engine, or null when effects are turned off (or not mounted yet).
 */
import { useEffect, useRef } from 'react';
import { effectsOn } from '../i18n/index.ts';
import { FxCanvas } from '../screens/arena/fxCanvas.ts';

let engine: FxCanvas | null = null;

export function fxLayer(): FxCanvas | null {
  return engine && effectsOn() ? engine : null;
}

/** Centre of an element on screen (for bursts anchored to the UI). */
export function centreOf(el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas?.getContext('2d')) return;
    const fx = new FxCanvas(canvas);
    engine = fx;
    return () => {
      fx.destroy();
      if (engine === fx) engine = null;
    };
  }, []);
  return <canvas ref={ref} className="fx-canvas fx-layer" aria-hidden="true" />;
}
