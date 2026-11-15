/**
 * Dev-only tools in the top bar (`npm run dev`, never in a production build): play full screen like a PC game, and
 * try the game at the resolutions of a Steam release. The size test shows the game in a frame of the exact size
 * (an iframe: the game inside sees that viewport, media queries included), shrunk to fit the window when it is
 * larger. Both copies share the save: closing the test reloads the page so it picks up what was played inside.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';

/** Inside the size-test frame the tools are hidden (no frame within the frame). */
export const inTestFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const PRESETS: { w: number; h: number; label: StringKey }[] = [
  { w: 1920, h: 1080, label: 'dev.size.fhd' },
  { w: 2560, h: 1440, label: 'dev.size.qhd' },
  { w: 1366, h: 768, label: 'dev.size.laptop' },
  { w: 1280, h: 800, label: 'dev.size.deck' },
  { w: 1280, h: 720, label: 'dev.size.hd' },
];

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

function FullscreenButton() {
  const { t } = useT();
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  const label = t(full ? 'dev.fullscreen.exit' : 'dev.fullscreen');
  return (
    <button className={`btn small ghost ${full ? 'active' : ''}`} onClick={toggle} title={label} aria-label={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={full ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
      </svg>
    </button>
  );
}

/** The game in a frame of `w`×`h`, scaled down to fit the window; the presets switch the size in place. */
function SizeFrame({ w, h, onPick, onClose }: { w: number; h: number; onPick: (w: number, h: number) => void; onClose: () => void }) {
  const { t } = useT();
  const win = useWindowSize();
  const bar = 52;
  const scale = Math.min(1, (win.w - 32) / w, (win.h - bar - 24) / h);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="size-test" role="dialog" aria-label={t('dev.size.title')}>
      <div className="size-test-bar">
        <b>{t('dev.size.title')}</b>
        <span className="size-test-presets" role="radiogroup">
          {PRESETS.map((p) => (
            <button key={`${p.w}x${p.h}`} role="radio" aria-checked={p.w === w && p.h === h} className={`btn small ${p.w === w && p.h === h ? 'primary' : ''}`} onClick={() => onPick(p.w, p.h)}>
              {p.w}×{p.h} <small>{t(p.label)}</small>
            </button>
          ))}
        </span>
        <span className="muted">{t('dev.size.scale', { pct: Math.round(scale * 100) })}</span>
        <span className="spacer" />
        <button className="btn small" onClick={onClose}>
          {t('dev.size.close')}
        </button>
      </div>
      <div className="size-test-stage" style={{ width: w * scale, height: h * scale }}>
        <iframe title={t('dev.size.title')} src={window.location.href} width={w} height={h} style={{ transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}

function SizeTest() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', away);
    return () => window.removeEventListener('mousedown', away);
  }, [open]);
  const close = () => {
    setFrame(null);
    // The frame may have played and saved: start again from that save.
    window.location.reload();
  };
  return (
    <span className="size-pick" ref={ref}>
      <button className={`btn small ghost ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} title={t('dev.size.title')} aria-label={t('dev.size.title')} aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="4" width="19" height="13" rx="1.5" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </button>
      {open && (
        <div className="size-pick-menu" role="menu">
          {PRESETS.map((p) => (
            <button
              key={`${p.w}x${p.h}`}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setFrame({ w: p.w, h: p.h });
              }}
            >
              <b>
                {p.w}×{p.h}
              </b>
              <small>{t(p.label)}</small>
            </button>
          ))}
        </div>
      )}
      {/* On the body: the top bar is a stacking context that would keep the frame under the news band. */}
      {frame && createPortal(<SizeFrame w={frame.w} h={frame.h} onPick={(w, h) => setFrame({ w, h })} onClose={close} />, document.body)}
    </span>
  );
}

/** The dev tools of the top bar: window size, size test, full screen. */
export function DevTools() {
  const { t } = useT();
  const size = useWindowSize();
  if (inTestFrame()) return null;
  return (
    <span className="dev-tools">
      <small title={t('dev.size')}>
        {size.w}×{size.h}
      </small>
      <SizeTest />
      <FullscreenButton />
    </span>
  );
}
