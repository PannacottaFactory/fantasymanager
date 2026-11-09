import { ATTRIBUTE_CATEGORIES, type AttributeCategory } from '../../../data/attributes.ts';
import type { ReactNode } from 'react';
import { ROLE_IDS } from '../../../data/roles.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { getSpecies, maxHp, maxStamina, overallRating, roleFit } from '../../../engine/creature/derived.ts';
import {
  attributeText,
  categoryName,
  effectText,
  elementName,
  injuryText,
  roleText,
  sizeName,
  speciesText,
  traitText,
} from '../../../engine/text/localize.ts';
import type { Creature, HiddenAttributes } from '../../../engine/model.ts';
import { AbilityCard } from '../../components/AbilityCard.tsx';
import { Attr, AttrRange, Bar, Crest, ElementDots, Modal, TraitChip } from '../../components/common.tsx';
import { attributeRange, overallRange, traitsKnown } from '../../../engine/economy/scouting.ts';
import { moraleKey } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { RoleLabel } from '../../icons/Icon.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';

interface Props {
  creature: Creature;
  onClose: () => void;
  showHidden?: boolean;
  /** Favourite abilities (light build); editable when `onToggleFavorite` is given. */
  favorites?: readonly string[];
  onToggleFavorite?: (abilityId: string) => void;
  /** Extra content under the header (e.g. live match state). */
  extra?: ReactNode;
  /** 0–100: below 100, attributes are shown as estimated ranges and private details are hidden. */
  knowledge?: number;
}

export function CreatureModal({ creature, onClose, showHidden = true, favorites = [], onToggleFavorite, extra, knowledge = 100 }: Props) {
  const tr = useT();
  const { t, lang } = tr;
  const sp = getSpecies(creature);
  const spText = speciesText(sp.id, lang);
  const lc = sp.lifeCurve;
  const stage = creature.age < lc.peakStart ? t('cr.developing') : creature.age <= lc.peakEnd ? t('cr.prime') : t('cr.declining');
  const injuries = creature.condition.injuries.filter((i) => i.weeksLeft > 0);
  const known = knowledge >= 100;
  const ovr = overallRange(creature, knowledge);
  return (
    <Modal
      title={
        <span className="row">
          <Crest speciesId={sp.id} name={creature.name} size={30} /> {creature.name}
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <span>
            <SpeciesIcon id={sp.id} size="1.5em" /> {spText.name} · <ElementDots speciesId={sp.id} /> {sp.elements.map((e) => elementName(e, lang)).join(' / ')} · {sizeName(sp.size, lang)}
            {sp.flying ? ` · ${t('cr.flying')}` : ''}
          </span>
          <span className="muted">{t('cr.age', { age: creature.age, stage, a: lc.peakStart, b: lc.peakEnd })}</span>
          <span>
            {t('cr.overall')} <b>{known ? overallRating(creature) : `${ovr.low}–${ovr.high}`}</b>
          </span>
          {known && (
            <span className="muted">{t('cr.hpStamina', { hp: maxHp(creature, DEFAULT_CONFIG), st: maxStamina(creature, DEFAULT_CONFIG) })}</span>
          )}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {spText.description}
        </p>
        {extra}

        <div>
          <div className="row" style={{ marginBottom: 6, gap: 10 }}>
            <h4 style={{ margin: 0 }}>{t('cr.abilities')}</h4>
            {onToggleFavorite && (
              <span className="muted" style={{ fontSize: '0.857rem' }}>
                {t('fav.hint', { n: DEFAULT_CONFIG.combat.favorites.max })}
              </span>
            )}
          </div>
          <div className="ability-grid">
            {sp.abilities.map((a) => (
              <AbilityCard
                key={a.id}
                id={a.id}
                elements={sp.elements}
                locked={(a.minAbility ?? 0) > creature.ability}
                favorite={favorites.includes(a.id)}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(a.id) : undefined}
              />
            ))}
          </div>
          {sp.passives?.map((p) => (
            <div key={p} style={{ marginTop: 6 }}>
              <b>{effectText(p, lang).name}</b>{' '}
              <span className="muted" style={{ fontSize: '0.857rem' }}>
                {t('cr.passive')} {effectText(p, lang).description}
              </span>
            </div>
          ))}
        </div>

        <div className="attr-grid">
          {(Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).map((cat) => (
            <div key={cat}>
              <h4 style={{ marginBottom: 6 }}>{categoryName(cat, lang)}</h4>
              <div className="attr-list">
                {ATTRIBUTE_CATEGORIES[cat].map((k) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <span title={attributeText(k, lang).description}>{attributeText(k, lang).name}</span>
                    {known ? <Attr v={creature.attributes[k]} /> : <AttrRange r={attributeRange(creature, k, knowledge)} />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="attr-grid">
          <div>
            <h4 style={{ marginBottom: 6 }}>{t('cr.traits')}</h4>
            {!traitsKnown(knowledge) && <span className="faint">{t('cr.traitsUnknown')}</span>}
            {traitsKnown(knowledge) && creature.traits.length === 0 && <span className="faint">{t('cr.noTraits')}</span>}
            {(traitsKnown(knowledge) ? creature.traits : []).map((x) => (
              <div key={x} style={{ marginBottom: 4 }}>
                <TraitChip id={x} />{' '}
                <span className="muted" style={{ fontSize: '0.857rem' }}>
                  {traitText(x, lang).description}
                </span>
              </div>
            ))}
          </div>
          {known && (
            <div>
              <h4 style={{ marginBottom: 6 }}>{t('cr.roleFit')}</h4>
              {ROLE_IDS.map((r) => (
                <div key={r} className="row" style={{ fontSize: '0.857rem', marginBottom: 3 }} title={roleText(r, lang).description}>
                  <span style={{ width: 140 }}>
                    <RoleLabel role={r} />
                  </span>
                  <span className="grow">
                    <Bar value={roleFit(creature, r)} max={20} color="var(--accent)" thin />
                  </span>
                  <span className="mono" style={{ width: 32, textAlign: 'right' }}>
                    {tr.dec(roleFit(creature, r))}
                  </span>
                </div>
              ))}
              <h4 style={{ margin: '10px 0 6px' }}>{t('cr.condition')}</h4>
              <dl className="kv">
                <dt>{t('col.form')}</dt>
                <dd>{creature.condition.form}/20</dd>
                <dt>{t('col.morale')}</dt>
                <dd>
                  {t(moraleKey(creature.condition.morale))} ({creature.condition.morale})
                </dd>
                <dt>{t('col.fatigue')}</dt>
                <dd>{creature.condition.fatigue} %</dd>
                {injuries.length > 0 && (
                  <>
                    <dt>{t('cr.injuries')}</dt>
                    <dd className="bad-text">{injuries.map((i) => `${injuryText(i.injuryId, lang).short} (${tr.weeks(i.weeksLeft)})`).join(', ')}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </div>

        {showHidden && (
          <details>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              {t('cr.hidden')}
            </summary>
            <dl className="kv" style={{ marginTop: 6 }}>
              <dt>{t('cr.currentAbility')}</dt>
              <dd>{creature.ability} / 200</dd>
              <dt>{t('cr.potential')}</dt>
              <dd>{creature.potential} / 200</dd>
              {(Object.keys(creature.hidden) as (keyof HiddenAttributes)[]).map((k) => (
                <span key={k} style={{ display: 'contents' }}>
                  <dt>{t(`hidden.${k}`)}</dt>
                  <dd>{creature.hidden[k]}</dd>
                </span>
              ))}
            </dl>
          </details>
        )}
      </div>
    </Modal>
  );
}
