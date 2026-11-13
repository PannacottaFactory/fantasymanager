import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { STEPS, useTutorial, type Placement, type TutorialStep } from './tutorial.ts';
import { UiIcon } from '../icons/Icon.tsx';

const BUBBLE_W = 340;
const GAP = 12;

function anchorRect(step: TutorialStep): DOMRect | null {
  const scope: ParentNode = document.querySelector('.overlay') ?? document;
  const el = scope.querySelector<HTMLElement>(`[data-tip="${step.anchor}"]`);
  if (!el) return null;
  let r = el.getBoundingClientRect();
  // Inside a scrolling window, bring the element into view first.
  if (scope !== document && r.height > 0 && (r.top < 0 || r.bottom > window.innerHeight)) {
    el.scrollIntoView({ block: 'center' });
    r = el.getBoundingClientRect();
  }
  return r.width > 0 && r.height > 0 ? r : null;
}

interface Size {
  w: number;
  h: number;
}

/** Where the bubble goes: the requested side if there is room, else below/above — always kept inside the screen. */
function bubbleStyle(r: DOMRect, placement: Placement, { w, h }: Size): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(GAP, Math.min(vw - w - GAP, x));
  const clampY = (y: number) => Math.max(GAP, Math.min(vh - h - GAP, y));
  const centredX = clampX(r.left + r.width / 2 - w / 2);
  if (placement === 'center') return { left: clampX((vw - w) / 2), top: clampY(vh * 0.28) };
  if (placement === 'right' && r.right + GAP + w + GAP <= vw) return { left: r.right + GAP, top: clampY(r.top + 20) };
  if (placement === 'left' && r.left - GAP - w - GAP >= 0) return { left: r.left - GAP - w, top: clampY(r.top + 20) };
  const fitsBelow = r.bottom + GAP + h + GAP <= vh;
  const fitsAbove = r.top - GAP - h - GAP >= 0;
  const below = placement === 'above' ? !fitsAbove && (fitsBelow || vh - r.bottom > r.top) : fitsBelow || !fitsAbove && vh - r.bottom >= r.top;
  return { left: centredX, top: clampY(below ? r.bottom + GAP : r.top - GAP - h) };
}

interface Found {
  step: TutorialStep;
  rect: DOMRect;
}

/** First unseen step whose anchor is on screen. */
function findStep(seen: readonly string[]): Found | null {
  for (const step of STEPS) {
    if (seen.includes(step.id)) continue;
    const rect = anchorRect(step);
    if (rect) return { step, rect };
  }
  return null;
}

const same = (a: Found | null, b: Found | null) =>
  a === b ||
  (!!a && !!b && a.step.id === b.step.id && Math.round(a.rect.left) === Math.round(b.rect.left) && Math.round(a.rect.top) === Math.round(b.rect.top) && Math.round(a.rect.width) === Math.round(b.rect.width));

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
  const { step, rect } = found;
  const placement = step.placement ?? 'below';
  const pad = 6;

  return (
    <div className="tutorial" role="dialog" aria-live="polite" aria-label={t(`tut.${step.id}.title` as StringKey)}>
      {placement !== 'center' && (
        <div className="tutorial-ring" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      )}
      <div ref={bubble} className="tutorial-bubble" style={{ ...bubbleStyle(rect, placement, size), width: `min(${BUBBLE_W}px, calc(100vw - ${GAP * 2}px))` }}>
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
