import { useEffect, type ReactNode } from 'react';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { ElementId } from '../../data/schema.ts';
import { attrClass, speciesColor, speciesName } from '../format.ts';

export function Attr({ v }: { v: number }) {
  return <span className={`attr ${attrClass(v)}`}>{v}</span>;
}

export function Bar({ value, max, color, thin, title }: { value: number; max: number; color: string; thin?: boolean; title?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;
  return (
    <div className={`bar${thin ? ' thin' : ''}`} title={title} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Sigil({ speciesId }: { speciesId: string }) {
  return (
    <span className="sigil" style={{ background: speciesColor(speciesId) }} title={speciesName(speciesId)}>
      {speciesName(speciesId).slice(0, 2)}
    </span>
  );
}

export function ElementDots({ speciesId }: { speciesId: string }) {
  const els = SPECIES[speciesId]?.elements ?? [];
  return (
    <span title={els.map((e) => ELEMENTS[e].name).join(' / ')}>
      {els.map((e: ElementId) => (
        <i key={e} className="elem" style={{ background: ELEMENTS[e].color }} />
      ))}
    </span>
  );
}

export function TraitChip({ id }: { id: string }) {
  const t = TRAITS[id];
  if (!t) return null;
  const cls = t.polarity === 'positive' ? 'pos' : t.polarity === 'negative' ? 'neg' : 'mixed';
  return (
    <span className={`chip ${cls}`} title={t.description}>
      {t.name}
    </span>
  );
}

export function Modal({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
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
          <button className="btn small ghost" onClick={onClose} aria-label="Close">
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
