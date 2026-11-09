import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ABILITIES } from '../../data/abilities.ts';
import { ELEMENTS } from '../../data/elements.ts';
import type { AbilityKind, ElementId } from '../../data/schema.ts';
import { abilityKindName, abilityText, effectText, elementName } from '../../engine/text/localize.ts';
import { useT } from '../i18n/index.ts';

export const KIND_GLYPH: Record<AbilityKind, string> = { melee: '⚔', ranged: '➶', spell: '✦', heal: '✚', buff: '▲', debuff: '▼' };

/** Colour of an ability: its element, the creature's first element for innate ones, neutral for physical. */
export function abilityColor(abilityId: string, elements: readonly ElementId[]): string {
  const el = ABILITIES[abilityId]?.element;
  const id = el === 'innate' ? elements[0] : el;
  return id && id !== 'physical' ? ELEMENTS[id as ElementId].color : 'var(--muted)';
}

interface Props {
  id: string;
  elements: readonly ElementId[];
  locked?: boolean;
  favorite?: boolean;
  /** When set, a star button toggles the favourite. */
  onToggleFavorite?: () => void;
}

/** Full description of an ability (creature sheet). */
export function AbilityCard({ id, elements, locked, favorite, onToggleFavorite }: Props) {
  const { t, lang } = useT();
  const def = ABILITIES[id]!;
  const txt = abilityText(id, lang);
  const el = def.element === 'innate' ? elements[0] : def.element;
  const color = abilityColor(id, elements);
  return (
    <div className={`ability-card ${locked ? 'locked' : ''} ${favorite ? 'fav' : ''}`} style={{ ['--c' as string]: color }}>
      <div className="ability-head">
        <span className="glyph" title={abilityKindName(def.kind, lang)}>
          {KIND_GLYPH[def.kind]}
        </span>
        <b className="grow">{txt.name}</b>
        {locked ? (
          <span className="faint" style={{ fontSize: 11 }}>
            {t('cr.locked')}
          </span>
        ) : (
          onToggleFavorite && (
            <button
              className={`star ${favorite ? 'on' : ''}`}
              onClick={onToggleFavorite}
              title={favorite ? t('fav.remove') : t('fav.add')}
              aria-pressed={favorite}
            >
              {favorite ? '★' : '☆'}
            </button>
          )
        )}
        {!onToggleFavorite && favorite && <span className="star on">★</span>}
      </div>
      <div className="ability-stats">
        <span>{abilityKindName(def.kind, lang)}</span>
        {el && el !== 'physical' && <span style={{ color }}>{elementName(el as ElementId, lang)}</span>}
        {def.power > 0 && <span>{t('ab.power', { n: def.power })}</span>}
        <span className="cost" title={t('ab.cost.title')}>
          ⚡ {def.staminaCost}
        </span>
        {def.cooldown > 0 && <span title={t('ab.cooldown.title')}>⟳ {t('ab.cooldown', { n: def.cooldown })}</span>}
      </div>
      {def.effects && def.effects.length > 0 && (
        <div className="ability-stats">
          {def.effects.map((e) => (
            <span key={e.effect} title={effectText(e.effect, lang).description}>
              {effectText(e.effect, lang).name} {Math.round(e.chance * 100)} %
            </span>
          ))}
        </div>
      )}
      <div className="muted ability-desc">{txt.description}</div>
    </div>
  );
}

/** Floating explanation of an ability, anchored to an element's rectangle (rendered in a portal). */
export function AbilityTip({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const W = 290;
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, anchor.left + anchor.width / 2 - W / 2));
  const below = anchor.bottom + 230 < window.innerHeight;
  const style: CSSProperties = below
    ? { left, top: anchor.bottom + 6, width: W }
    : { left, bottom: window.innerHeight - anchor.top + 6, width: W };
  return createPortal(
    <div className="ability-tip" style={style} role="tooltip">
      {children}
    </div>,
    document.body,
  );
}
