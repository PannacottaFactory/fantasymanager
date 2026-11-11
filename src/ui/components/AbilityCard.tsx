import { UiIcon } from '../icons/Icon.tsx';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ABILITIES } from '../../data/abilities.ts';
import { ELEMENTS } from '../../data/elements.ts';
import type { AbilityKind, ElementId } from '../../data/schema.ts';
import { abilityKindName, abilityText, effectText, elementName } from '../../engine/text/localize.ts';
import { useT } from '../i18n/index.ts';

/** Icon of an ability kind (melee, ranged, spell, heal, buff, curse). */
export function KindIcon({ kind }: { kind: AbilityKind }) {
  return (
    <span className={`kind-icon k-${kind}`}>
      <UiIcon name={`kind-${kind}`} size="1em" />
    </span>
  );
}

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
  /** Aptitude at which a locked ability unlocks, and the creature's current aptitude (own creatures only). */
  unlockAt?: number;
  current?: number;
  favorite?: boolean;
  /** When set, a star button toggles the favourite. */
  onToggleFavorite?: () => void;
}

/** Full description of an ability (creature sheet). */
export function AbilityCard({ id, elements, locked, favorite, onToggleFavorite, unlockAt, current }: Props) {
  const { t, lang } = useT();
  const def = ABILITIES[id]!;
  const txt = abilityText(id, lang);
  const el = def.element === 'innate' ? elements[0] : def.element;
  const color = abilityColor(id, elements);
  return (
    <div className={`ability-card ${locked ? 'locked' : ''} ${favorite ? 'fav' : ''}`} style={{ ['--c' as string]: color }}>
      <div className="ability-head">
        <span className="glyph" title={abilityKindName(def.kind, lang)}>
          <KindIcon kind={def.kind} />
        </span>
        <b className="grow">{txt.name}</b>
        {locked ? (
          <span className="faint" style={{ fontSize: '0.786rem' }}>
            {unlockAt ? (current !== undefined ? t('cr.lockedAtNow', { n: unlockAt, c: current }) : t('cr.lockedAt', { n: unlockAt })) : t('cr.locked')}
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
        <b>{abilityKindName(def.kind, lang)}</b>
        {el && el !== 'physical' && <span style={{ color }}>{elementName(el as ElementId, lang)}</span>}
        {def.power > 0 && (
          <span title={t('ab.power.title')}>
            <span style={{ color: 'var(--bad)' }}>✸</span> {def.power}
            {def.hits && def.hits > 1 ? ` ×${def.hits}` : ''}
          </span>
        )}
        <span className="cost" title={t('ab.cost.title')}>
          ⚡ {def.staminaCost}
        </span>
        {def.cooldown > 0 && <span title={t('ab.cooldown.title')}>⟳ {t('ab.cooldown', { n: def.cooldown })}</span>}
      </div>
      {((def.effects && def.effects.length > 0) || def.cleanse) && (
        <div className="ability-stats">
          {def.effects?.map((e) => (
            <span key={e.effect} title={effectText(e.effect, lang).description}>
              {effectText(e.effect, lang).name}
              {(e.stacks ?? 1) > 1 ? ` ×${e.stacks}` : ''} {Math.round(e.chance * 100)} %
            </span>
          ))}
          {def.cleanse && <span title={t('ab.cleanse.title')}>{t('ab.cleanse')}</span>}
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
