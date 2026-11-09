import { useEffect, type ReactNode } from 'react';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { ElementId } from '../../data/schema.ts';
import { elementName, speciesName, traitText } from '../../engine/text/localize.ts';
import { attrClass, initials } from '../format.ts';
import { useT } from '../i18n/index.ts';

export function Attr({ v }: { v: number }) {
  return <span className={`attr ${attrClass(v)}`}>{v}</span>;
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
      <text x="12" y="14.2" textAnchor="middle" className="crest-text">
        {label}
      </text>
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

export function Modal({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
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

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
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
