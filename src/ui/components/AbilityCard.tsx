import { UiIcon } from '../icons/Icon.tsx';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ABILITIES } from '../../data/abilities.ts';
import { ELEMENTS } from '../../data/elements.ts';
import { EFFECTS } from '../../data/effects.ts';
import type { AbilityEffectRef, AbilityKind, ElementId } from '../../data/schema.ts';
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

/** How long an effect an ability applies lasts: rounds, the target's next turns (stuns), until the break (curses), the whole match. */
export type EffectSpan = { kind: 'rounds' | 'turns'; n: number } | { kind: 'break' | 'match' };

export function effectDuration(ref: AbilityEffectRef): EffectSpan {
  const def = EFFECTS[ref.effect];
  const n = ref.duration ?? def?.defaultDuration ?? 1;
  if (n >= 999) return { kind: 'match' };
  if (def?.curse) return { kind: 'break' };
  return { kind: def?.kind === 'stun' ? 'turns' : 'rounds', n };
}

type Tr = ReturnType<typeof useT>['t'];
export function durationLabel(t: Tr, d: EffectSpan): string {
  if (!('n' in d)) return t(d.kind === 'match' ? 'ab.dur.match' : 'ab.dur.break');
  return t(d.kind === 'turns' ? 'ab.dur.turns' : 'ab.dur.rounds', { n: d.n });
}

interface Props {
  id: string;
  elements: readonly ElementId[];
  locked?: boolean;
  /** Aptitude at which a locked ability unlocks, and the creature's current aptitude (own creatures only). */
  unlockAt?: number;
  current?: number;
  /** Small label before the name (« Niv. 4 », « Attaque de base »). */
  badge?: string;
  badgeTitle?: string;
  /** Equipped skill (highlighted). */
  equipped?: boolean;
  /** When set, the whole card is a button that equips the skill. */
  onEquip?: () => void;
  equipTitle?: string;
  /** Replaces the plain name (e.g. a link to the ability's Encyclopedia entry). */
  name?: ReactNode;
}

/** Full description of an ability (creature sheet). */
export function AbilityCard({ id, elements, locked, unlockAt, current, badge, badgeTitle, equipped, onEquip, equipTitle, name }: Props) {
  const { t, lang } = useT();
  const def = ABILITIES[id]!;
  const txt = abilityText(id, lang);
  const el = def.element === 'innate' ? elements[0] : def.element;
  const color = abilityColor(id, elements);
  return (
    <div
      className={`ability-card ${locked ? 'locked' : ''} ${equipped ? 'equipped' : ''} ${onEquip ? 'pickable' : ''}`}
      style={{ ['--c' as string]: color }}
      role={onEquip ? 'button' : undefined}
      tabIndex={onEquip ? 0 : undefined}
      title={onEquip ? equipTitle : undefined}
      onClick={onEquip}
      onKeyDown={onEquip ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onEquip()) : undefined}
      aria-pressed={onEquip || equipped ? Boolean(equipped) : undefined}
    >
      <div className="ability-head">
        {badge && (
          <span className="ab-badge" title={badgeTitle}>
            {badge}
          </span>
        )}
        <span className="glyph" title={abilityKindName(def.kind, lang)}>
          <KindIcon kind={def.kind} />
        </span>
        <b className="grow">{name ?? txt.name}</b>
        {locked ? (
          <span className="ab-locked" title={unlockAt ? (current !== undefined ? t('cr.lockedAtNow', { n: unlockAt, c: current }) : t('cr.lockedAt', { n: unlockAt })) : t('cr.locked')}>
            {t('sk.locked')}
          </span>
        ) : (
          equipped && <span className="ab-equipped">{t('sk.equipped')}</span>
        )}
      </div>
      <div className="ability-stats">
        <b>{abilityKindName(def.kind, lang)}</b>
        {el && el !== 'physical' && <span style={{ color }}>{elementName(el as ElementId, lang)}</span>}
        <span className="ab-target" title={t('ab.tgt.title')}>
          <UiIcon name="help-goal" size="0.95em" /> {t(`ab.tgt.${def.target}`)}
        </span>
        {def.power > 0 && (
          <span title={t('ab.power.title')}>
            <span style={{ color: 'var(--bad)' }}><UiIcon name="power" size="0.95em" /></span> {def.power}
            {def.hits && def.hits > 1 ? ` ×${def.hits}` : ''}
          </span>
        )}
        <span className="cost" title={t('ab.cost.title')}>
          <UiIcon name="stamina" size="0.95em" /> {def.staminaCost}
        </span>
        {def.cooldown > 0 && <span title={t('ab.cooldown.title')}><span className="ab-cd">⟳</span> {t('ab.cooldown', { n: def.cooldown })}</span>}
      </div>
      {((def.effects && def.effects.length > 0) || def.cleanse || def.chain || def.dispel || def.steal || def.raise) && (
        <div className="ability-stats">
          {def.effects?.map((e) => (
            <span key={e.effect} title={effectText(e.effect, lang).description}>
              {effectText(e.effect, lang).name}
              {(e.stacks ?? 1) > 1 ? ` ×${e.stacks}` : ''} {Math.round(e.chance * 100)} %
              <span className="ab-dur" title={t('ab.dur.title')}>
                {' '}⧗ {durationLabel(t, effectDuration(e))}
              </span>
            </span>
          ))}
          {def.cleanse && <span title={t('ab.cleanse.title')}>{t('ab.cleanse')}</span>}
          {def.chain && <span title={t('ab.chain.title', { n: def.chain })}>{t('ab.chain', { n: def.chain })}</span>}
          {def.steal ? <span title={t('ab.steal.title')}>{t('ab.steal')}</span> : def.dispel && <span title={t('ab.dispel.title')}>{t('ab.dispel')}</span>}
          {def.raise && <span title={t('ab.raise.title')}>{t('ab.raise', { v: Math.round(def.raise * 100) })}</span>}
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
