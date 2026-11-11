import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { STEPS, useTutorial, type Placement, type TutorialStep } from './tutorial.ts';

const BUBBLE_W = 340;
const GAP = 12;

function anchorRect(step: TutorialStep): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-tip="${step.anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** Where the bubble goes: the requested side if there is room, else below/above. */
function bubbleStyle(r: DOMRect, placement: Placement): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(GAP, Math.min(vw - BUBBLE_W - GAP, x));
  if (placement === 'center') return { left: (vw - BUBBLE_W) / 2, top: Math.max(GAP, vh * 0.28) };
  if (placement === 'right' && r.right + GAP + BUBBLE_W < vw) return { left: r.right + GAP, top: Math.max(GAP, Math.min(vh - 220, r.top + 20)) };
  if (placement === 'left' && r.left - GAP - BUBBLE_W > 0) return { left: r.left - GAP - BUBBLE_W, top: Math.max(GAP, Math.min(vh - 220, r.top + 20)) };
  const below = placement !== 'above' ? r.bottom + GAP + 200 < vh : r.top - GAP - 200 < 0;
  return below
    ? { left: clampX(r.left + r.width / 2 - BUBBLE_W / 2), top: Math.min(vh - 200, r.bottom + GAP) }
    : { left: clampX(r.left + r.width / 2 - BUBBLE_W / 2), bottom: Math.max(GAP, vh - r.top + GAP) };
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
      <div className="tutorial-bubble" style={{ ...bubbleStyle(rect, placement), width: BUBBLE_W }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <b className="grow">{t(`tut.${step.id}.title` as StringKey)}</b>
          <span className="faint mono" style={{ fontSize: '0.786rem' }}>
            💡
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
