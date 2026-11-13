import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { STEPS, useTutorial, type Placement, type TutorialStep } from './tutorial.ts';
import { UiIcon } from '../icons/Icon.tsx';

const BUBBLE_W = 340;
const GAP = 12;

/** A box on screen (viewport coordinates). */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const boxOf = (r: DOMRect | Box): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
const intersect = (a: Box, b: Box): Box => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
const empty = (b: Box) => b.right - b.left < 4 || b.bottom - b.top < 4;

/**
 * The part of the element actually on screen, and the area the bubble should stay in: the element's scrolling
 * container (the main content, a window), never the top bar above it nor the viewport's edges.
 */
function visibleArea(el: HTMLElement): { rect: Box; bounds: Box } | null {
  const viewport: Box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  let rect = intersect(boxOf(el.getBoundingClientRect()), viewport);
  let bounds: Box | null = null;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(st.overflowY + st.overflowX)) {
      const box = intersect(boxOf(p.getBoundingClientRect()), viewport);
      rect = intersect(rect, box);
      bounds ??= box;
    }
  }
  if (empty(rect)) return null;
  const b = bounds && !empty(bounds) && bounds.bottom - bounds.top > 260 ? bounds : viewport;
  return { rect, bounds: b };
}

function anchorArea(step: TutorialStep): { rect: Box; bounds: Box } | null {
  const scope: ParentNode = document.querySelector('.overlay') ?? document;
  const el = scope.querySelector<HTMLElement>(`[data-tip="${step.anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  // Inside a scrolling window, bring the element into view first.
  if (scope !== document && (r.top < 0 || r.bottom > window.innerHeight)) el.scrollIntoView({ block: 'center' });
  return visibleArea(el);
}

interface Size {
  w: number;
  h: number;
}

/**
 * Where the bubble goes: the requested side if there is room, else below / above; when the element fills the area
 * (a whole panel), inside it, in its top-right corner. Always kept inside `bounds`.
 */
function bubbleStyle(r: Box, placement: Placement, { w, h }: Size, bounds: Box): CSSProperties {
  const clampX = (x: number) => Math.max(bounds.left + GAP, Math.min(bounds.right - w - GAP, x));
  const clampY = (y: number) => Math.max(bounds.top + GAP, Math.min(bounds.bottom - h - GAP, y));
  const centredX = clampX((r.left + r.right) / 2 - w / 2);
  if (placement === 'center') return { left: clampX((bounds.left + bounds.right - w) / 2), top: clampY(bounds.top + (bounds.bottom - bounds.top) * 0.28) };
  if (placement === 'right' && r.right + GAP + w + GAP <= bounds.right) return { left: r.right + GAP, top: clampY(r.top + 20) };
  if (placement === 'left' && r.left - GAP - w - GAP >= bounds.left) return { left: r.left - GAP - w, top: clampY(r.top + 20) };
  const fitsBelow = r.bottom + GAP + h + GAP <= bounds.bottom;
  const fitsAbove = r.top - GAP - h - GAP >= bounds.top;
  if (placement === 'above' ? fitsAbove : !fitsBelow && fitsAbove) return { left: centredX, top: r.top - GAP - h };
  if (fitsBelow) return { left: centredX, top: r.bottom + GAP };
  return { left: clampX(r.right - w - GAP * 2), top: clampY(r.top + GAP * 2) };
}

interface Found {
  step: TutorialStep;
  rect: Box;
  bounds: Box;
}

/** First unseen step whose anchor is on screen. */
function findStep(seen: readonly string[]): Found | null {
  for (const step of STEPS) {
    if (seen.includes(step.id)) continue;
    const area = anchorArea(step);
    if (area) return { step, ...area };
  }
  return null;
}

const sameBox = (a: Box, b: Box) =>
  Math.round(a.left) === Math.round(b.left) && Math.round(a.top) === Math.round(b.top) && Math.round(a.right) === Math.round(b.right) && Math.round(a.bottom) === Math.round(b.bottom);
const same = (a: Found | null, b: Found | null) =>
  a === b || (!!a && !!b && a.step.id === b.step.id && sameBox(a.rect, b.rect) && sameBox(a.bounds, b.bounds));

/** Shows the first unseen tip whose anchor is visible, pointing at it (only during a game). */
export function TutorialOverlay({ active }: { active: boolean }) {
  const { t } = useT();
  const { enabled, seen, markSeen, skip } = useTutorial();
  const [found, setFound] = useState<Found | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: BUBBLE_W, h: 200 });
  const [, setViewport] = useState(0);

  // The bubble's real size (it grows with the text size and the language), measured after layout.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [found?.step.id]);

  useEffect(() => {
    const onResize = () => setViewport((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Anchors are read from the DOM after it is painted, and again as screens change.
  useEffect(() => {
    if (!enabled || !active) {
      setFound(null);
      return;
    }
    const check = () => setFound((prev) => {
      const next = findStep(seen);
      return same(prev, next) ? prev : next;
    });
    check();
    const id = window.setInterval(check, 300);
    return () => window.clearInterval(id);
  }, [enabled, active, seen]);

  if (!enabled || !active || !found) return null;
  const { step, rect, bounds } = found;
  const placement = step.placement ?? 'below';
  const pad = 6;

  return (
    <div className="tutorial" role="dialog" aria-live="polite" aria-label={t(`tut.${step.id}.title` as StringKey)}>
      {placement !== 'center' && (
        <div className="tutorial-ring" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.right - rect.left + pad * 2, height: rect.bottom - rect.top + pad * 2 }} />
      )}
      <div ref={bubble} className="tutorial-bubble" style={{ ...bubbleStyle(rect, placement, size, bounds), width: `min(${BUBBLE_W}px, calc(100vw - ${GAP * 2}px))` }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <b className="grow">{t(`tut.${step.id}.title` as StringKey)}</b>
          <span className="faint mono" style={{ fontSize: '0.786rem' }}>
            <UiIcon name="tip" />
          </span>
        </div>
        <div className="tutorial-body">{t(`tut.${step.id}.body` as StringKey)}</div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn small primary" onClick={() => markSeen(step.id)} autoFocus>
            {t('tut.next')}
          </button>
          <span className="spacer" />
          <button className="btn small ghost" onClick={skip}>
            {t('tut.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
