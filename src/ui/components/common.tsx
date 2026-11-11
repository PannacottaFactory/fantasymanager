import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { ElementId } from '../../data/schema.ts';
import { elementName, speciesName, traitText } from '../../engine/text/localize.ts';
import { attrClass, initials } from '../format.ts';
import { effectsOn, useT } from '../i18n/index.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from '../icons/gameIcons.ts';
import { levelOf, maxLevelOf, xpInLevel } from '../../engine/progression/levels.ts';
import { potentialLevelRange } from '../../engine/economy/scouting.ts';
import type { Creature } from '../../engine/model.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';

export function Attr({ v }: { v: number }) {
  return <span className={`attr ${attrClass(v)}`}>{v}</span>;
}

/** Estimated attribute: a range coloured by its middle. */
export function AttrRange({ r }: { r: { low: number; high: number } }) {
  if (r.low === r.high) return <Attr v={r.low} />;
  return <span className={`attr range ${attrClass((r.low + r.high) / 2)}`}>{r.low}–{r.high}</span>;
}

/** A rating out of 10 written « 8★ » (potential = the highest level reachable, coach quality…), coloured by tier. */
export function Stars({ n, max, title }: { n: number; max?: number; title?: string }) {
  const { t } = useT();
  const v = Math.max(1, Math.min(10, Math.round(n)));
  const hi = max === undefined ? v : Math.max(v, Math.min(10, Math.round(max)));
  // A range is coloured by its middle.
  const mid = (v + hi) / 2;
  const tier = mid >= 9 ? 'legend' : mid >= 7 ? 'high' : mid >= 4 ? 'mid' : 'low';
  const label = hi > v ? `${v}–${hi}` : `${v}`;
  return (
    <span className={`stars-n ${tier} ${hi > v ? 'range' : ''}`} title={title ?? t('stars.title', { n: label })} aria-label={t('stars.title', { n: label })}>
      {label}
      <i>★</i>
    </span>
  );
}

/** Potential of a creature as the player knows it: exact for its own, a range for the others. */
export function PotentialStars({ c, k }: { c: Creature; k: number }) {
  const { t } = useT();
  if (k >= 100) {
    const n = maxLevelOf(c);
    return <Stars n={n} title={t('stars.potential', { n })} />;
  }
  const r = potentialLevelRange(c, k);
  return <Stars n={r.low} max={r.high} title={t(r.high > r.low ? 'stars.potentialRange' : 'stars.potential', { n: r.low, m: r.high })} />;
}

/** Knowledge gauge (0–100). */
export function Knowledge({ k }: { k: number }) {
  return (
    <span className="knowledge" title={`${k} %`}>
      <i style={{ width: `${k}%` }} />
    </span>
  );
}

/**
 * Horizontal gauge. With `ghost`, a lighter layer trails behind when the value drops
 * (fighting-game style), so recent damage stays visible for a moment.
 */
export function Bar({ value, max, color, thin, title, ghost }: { value: number; max: number; color: string; thin?: boolean; title?: string; ghost?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;
  return (
    <div className={`bar${thin ? ' thin' : ''}`} title={title} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      {ghost && <i className="ghost" style={{ width: `${pct}%` }} />}
      <i className="fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * Creature crest: a shield in the colours of its species' elements, carrying the creature's initials
 * (or the species' when no name is given).
 */
export function Crest({ speciesId, name, size = 24 }: { speciesId: string; name?: string; size?: number }) {
  const { lang } = useT();
  const els = SPECIES[speciesId]?.elements ?? [];
  const c1 = els[0] ? ELEMENTS[els[0]].color : '#777';
  const c2 = els[1] ? ELEMENTS[els[1]].color : c1;
  const sp = speciesName(speciesId, lang);
  const label = initials(name ?? sp);
  const gid = `crest-${els.join('-') || 'none'}`;
  return (
    <svg className="crest" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={name ? `${name} (${sp})` : sp}>
      <title>{name ? `${name} — ${sp}` : sp}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="50%" stopColor={c1} />
          <stop offset="50%" stopColor={c2} />
        </linearGradient>
      </defs>
      <path d="M2.5 2.5 H21.5 V11.5 C21.5 17.5 12 22.5 12 22.5 C12 22.5 2.5 17.5 2.5 11.5 Z" fill={`url(#${gid})`} stroke="rgb(0 0 0 / 0.45)" strokeWidth="1" />
      <path d="M4.5 4.5 H19.5 V11.5 C19.5 16 12 20.2 12 20.2 C12 20.2 4.5 16 4.5 11.5 Z" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="0.8" />
      {SPECIES_ICONS[speciesId] ? (
        <svg x="5.2" y="4.6" width="13.6" height="13.6" viewBox={ICON_VIEWBOX} className="crest-icon">
          <g dangerouslySetInnerHTML={{ __html: SPECIES_ICONS[speciesId]! }} />
        </svg>
      ) : (
        <text x="12" y="14.2" textAnchor="middle" className="crest-text">
          {label}
        </text>
      )}
    </svg>
  );
}

export function ElementDots({ speciesId }: { speciesId: string }) {
  const { lang } = useT();
  const els = SPECIES[speciesId]?.elements ?? [];
  return (
    <span title={els.map((e) => elementName(e, lang)).join(' / ')}>
      {els.map((e: ElementId) => (
        <i key={e} className="elem" style={{ background: ELEMENTS[e].color }} />
      ))}
    </span>
  );
}

export function TraitChip({ id }: { id: string }) {
  const { lang } = useT();
  const t = TRAITS[id];
  if (!t) return null;
  const txt = traitText(id, lang);
  const cls = t.polarity === 'positive' ? 'pos' : t.polarity === 'negative' ? 'neg' : 'mixed';
  return (
    <span className={`chip ${cls}`} title={txt.description}>
      {txt.name}
    </span>
  );
}

export function Modal({ title, onClose, children, actions, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="dialog-head">
          <h2>{title}</h2>
          <span className="spacer" />
          {actions}
          <button className="btn small ghost" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="radio" aria-checked={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Level 1–10 with the XP bar of the current level and the creature's maximum level (own creatures). */
export function LevelBadge({ c, compact }: { c: Creature; compact?: boolean }) {
  const { t } = useT();
  const lv = levelOf(c);
  const max = maxLevelOf(c);
  const xp = xpInLevel(c);
  const atMax = lv >= max;
  const per = DEFAULT_CONFIG.training.levels.xpPerLevel;
  return (
    <span className="level-badge" title={atMax ? t('lvl.atMax', { n: lv }) : t('lvl.tip', { n: lv, xp, per, max })}>
      <b>{t('lvl.short', { n: lv })}</b>
      <span className="xp-bar">
        <i style={{ width: atMax ? '100%' : `${(100 * xp) / per}%` }} className={atMax ? 'max' : ''} />
      </span>
      {!compact && <span className="faint">{atMax ? t('lvl.max') : t('lvl.of', { max })}</span>}
    </span>
  );
}

/** Amounts as `money()` writes them: digits (thin-space or comma groups, optional "k"), a no-break space, po / gp. */
const MONEY_RE = /([−+-]?\d[\d\u202f,.]*(?:\u202fk)?\u00a0(?:po|gp))/;

/** Text with every amount of gold in gold colour (other children are rendered as they are). */
export function Gold({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>;
  const parts = children.split(MONEY_RE);
  if (parts.length === 1) return <>{children}</>;
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="gold">{p}</span> : p))}</>;
}

/** An amount of gold. */
export function Money({ v, compact }: { v: number; compact?: boolean }) {
  const { money } = useT();
  return <span className="gold">{money(v, compact)}</span>;
}

/** A number that rolls towards its new value (instantly when effects are off). */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value || !effectsOn()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** An amount of gold that rolls when it changes. */
export function RollingMoney({ v, compact }: { v: number; compact?: boolean }) {
  const { money } = useT();
  const shown = useCountUp(v, 900);
  return <span className="gold">{money(shown, compact)}</span>;
}
