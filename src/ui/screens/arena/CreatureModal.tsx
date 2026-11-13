import { ATTRIBUTE_CATEGORIES, type AttributeCategory, type AttributeKey } from '../../../data/attributes.ts';
import { useState, type ReactNode } from 'react';
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
import { Attr, AttrRange, Bar, Crest, ElementDots, Modal, PotentialStars, TraitChip, LevelBadge, XpTrack } from '../../components/common.tsx';
import { attributeRange, overallRange, traitsKnown } from '../../../engine/economy/scouting.ts';
import { fatigueColor, moraleColor, moraleKey } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { RoleLabel } from '../../icons/Icon.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';
import { isUnlocked, levelOf, unlockLevel } from '../../../engine/progression/levels.ts';
import { attributeCeiling } from '../../../engine/progression/training.ts';
import { MAX_NAME_LENGTH } from '../../../engine/team/rename.ts';
import { UiIcon } from '../../icons/Icon.tsx';

interface Props {
  creature: Creature;
  onClose: () => void;
  showHidden?: boolean;
  /** Favourite abilities (light build); editable when `onToggleFavorite` is given. */
  favorites?: readonly string[];
  onToggleFavorite?: (abilityId: string) => void;
  /** Extra content right under the header (e.g. live match state, market estimate). */
  extra?: ReactNode;
  /** Content at the bottom of the sheet (management: training, contract…). */
  footer?: ReactNode;
  /** Shown under the abilities (the creature's record). */
  aside?: ReactNode;
  /** Attribute changes to show next to the values (own creatures: since the season started). */
  deltas?: Partial<Record<AttributeKey, number>>;
  /** Own creatures with free points: places one on an attribute (undefined = not allowed). */
  onSpendPoint?: (k: AttributeKey) => void;
  /** 0–100: below 100, attributes are shown as estimated ranges and private details are hidden. */
  knowledge?: number;
  /** Own creatures: gives it a new name. */
  onRename?: (name: string) => void;
}

/** A small labelled value in the sheet header. */
function StatTile({ label, value, title, big }: { label: string; value: ReactNode; title?: string; big?: boolean }) {
  return (
    <div className={`stat-tile ${big ? 'big' : ''}`} title={title}>
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

export function CreatureModal({ creature, onClose, showHidden = true, favorites = [], onToggleFavorite, extra, footer, aside, knowledge = 100, deltas, onSpendPoint, onRename }: Props) {
  const freePoints = onSpendPoint ? (creature.growth?.freePoints ?? 0) : 0;
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
          <Crest speciesId={sp.id} name={creature.name} size={30} />
          {onRename ? <RenameTitle name={creature.name} onRename={onRename} /> : creature.name}
        </span>
      }
      onClose={onClose}
      className="sheet-dialog"
    >
      <div className="sheet">
        <div className="sheet-head">
          <div className="sheet-sub">
            <span title={spText.description}>
              <SpeciesIcon id={sp.id} size="1.3em" /> <b>{spText.name}</b>
            </span>
            <span>
              <ElementDots speciesId={sp.id} /> {sp.elements.map((e) => elementName(e, lang)).join(' / ')}
            </span>
            <span>
              {sizeName(sp.size, lang)}
              {sp.flying ? ` · ${t('cr.flying')}` : ''}
            </span>
            <span title={t('cr.age', { age: creature.age, stage, a: lc.peakStart, b: lc.peakEnd })}>
              {t('sheet.age', { age: creature.age })} · <span className="faint">{stage}</span>
            </span>
          </div>
          {spText.description && <p className="species-desc">{spText.description}</p>}
          <div className="stat-strip" data-tip="sheet-tiles">
            <StatTile label={t('cr.overall')} value={known ? overallRating(creature) : `${ovr.low}–${ovr.high}`} big />
            {known && <StatTile label={t('sheet.level')} value={<LevelBadge c={creature} />} />}
            <StatTile label={t('col.potentialFull')} value={<PotentialStars c={creature} k={knowledge} />} title={t('stars.potentialCol')} />
            {known && <StatTile label={t('sheet.hp')} value={maxHp(creature, DEFAULT_CONFIG)} />}
            {known && <StatTile label={t('sheet.stamina')} value={maxStamina(creature, DEFAULT_CONFIG)} />}
            {known && <StatTile label={t('col.form')} value={<><Attr v={creature.condition.form} /><span className="faint">/20</span></>} title={t('sheet.formTip')} />}
            {known && <StatTile label={t('col.morale')} value={<span style={{ color: moraleColor(creature.condition.morale) }}>{t(moraleKey(creature.condition.morale))}</span>} title={t('sheet.moraleTip', { v: creature.condition.morale })} />}
            {known && <StatTile label={t('col.fatigue')} value={<span style={{ color: fatigueColor(creature.condition.fatigue) }}>{creature.condition.fatigue} %</span>} />}
          </div>
          {onSpendPoint && <XpTrack c={creature} />}
          {known && injuries.length > 0 && (
            <div className="bad-text" style={{ fontSize: '0.929rem' }}>
              <UiIcon name="injury" /> {injuries.map((i) => `${injuryText(i.injuryId, lang).short} (${tr.weeks(i.weeksLeft)})`).join(', ')}
            </div>
          )}
        </div>
        {extra}

        {freePoints > 0 && (
          <div className="points-banner in-sheet">
            <span className="pb-icon">+{freePoints}</span>
            <div className="grow">
              <b>{t('lvl.freePoints', { n: freePoints })}</b>
              <div className="muted">{t('points.why')}</div>
            </div>
          </div>
        )}
        <div className={`sheet-cols ${footer ? 'three' : ''}`}>
        <div className="sheet-col">
        <div className="attr-grid" data-tip="sheet-attrs">
          {(Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).map((cat) => (
            <div key={cat} className={`sheet-box sec-${cat}`}>
              <h4 className="sheet-box-title">{categoryName(cat, lang)}</h4>
              <div className="attr-list">
                {ATTRIBUTE_CATEGORIES[cat].map((k) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <span className="attr-name" title={attributeText(k, lang).description}>
                      {attributeText(k, lang).name}
                    </span>
                    <span className="attr-cell">
                      {/* The change since the season started sits before the value, so values and « + » keep their column. */}
                      {known && deltas?.[k] ? (
                        <span className={`attr-delta ${deltas[k]! > 0 ? 'up' : 'down'}`} title={t('cr.sinceSeason')}>
                          {deltas[k]! > 0 ? `+${deltas[k]}` : `−${-deltas[k]!}`}
                        </span>
                      ) : null}
                      {known ? <Attr v={creature.attributes[k]} /> : <AttrRange r={attributeRange(creature, k, knowledge)} />}
                      {/* A slot on every row while points are left, so the values stay aligned. */}
                      {freePoints > 0 && (
                        <span className="plus-slot">
                          {creature.attributes[k] < attributeCeiling(creature, k) && (
                            <button
                              className="plus-btn"
                              title={t('lvl.raise', { attr: attributeText(k, lang).name })}
                              aria-label={t('lvl.raise', { attr: attributeText(k, lang).name })}
                              onClick={() => onSpendPoint!(k)}
                            >
                              <svg viewBox="0 0 10 10" aria-hidden="true">
                                <path d="M5 1.6v6.8M1.6 5h6.8" />
                              </svg>
                            </button>
                          )}
                        </span>
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sheet-traits">
          <div className="sheet-box sec-traits">
            <h4 className="sheet-box-title">{t('cr.traits')}</h4>
            {!traitsKnown(knowledge) && <span className="faint">{t('cr.traitsUnknown')}</span>}
            {traitsKnown(knowledge) && creature.traits.length === 0 && <span className="faint">{t('cr.noTraits')}</span>}
            {(traitsKnown(knowledge) ? creature.traits : []).map((x) => (
              <div key={x} className="trait-line">
                <TraitChip id={x} />{' '}
                <span className="muted" style={{ fontSize: '0.857rem' }}>
                  {traitText(x, lang).description}
                </span>
              </div>
            ))}
          </div>
          {known && (
            <div className="sheet-box sec-roles" data-tip="sheet-roles">
              <h4 className="sheet-box-title">{t('cr.roleFit')}</h4>
              {ROLE_IDS.map((r) => (
                <div key={r} className="row role-line" title={roleText(r, lang).description}>
                  <span className="role-name">
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
            </div>
          )}
        </div>

        {showHidden && <HiddenBlock creature={creature} />}
        </div>
        <div className="sheet-col">
          <div className="sheet-box-head sec-abilities">
            <h4 className="sheet-box-title">{t('cr.abilities')}</h4>
            {onToggleFavorite && (
              <span className="muted fav-hint">
                {t('fav.hint', { n: DEFAULT_CONFIG.combat.favorites.max })}
              </span>
            )}
          </div>
          <div className="ability-grid" data-tip="sheet-abilities">
            {sp.abilities.map((a) => (
              <AbilityCard
                key={a.id}
                id={a.id}
                elements={sp.elements}
                locked={!isUnlocked(creature, a.minAbility)}
                unlockAt={unlockLevel(a.minAbility)}
                current={knowledge >= 100 ? levelOf(creature) : undefined}
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
          {aside}
        </div>
        {footer && <div className="sheet-col sheet-manage">{footer}</div>}
        </div>
      </div>
    </Modal>
  );
}

/** Hidden numbers (sandbox and debugging): aptitude, potential, personality. */
function HiddenBlock({ creature }: { creature: Creature }) {
  const { t } = useT();
  return (
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
  );
}

/** The creature's name, with a ✎ button to rename it (Enter saves, Escape cancels). */
function RenameTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (!editing)
    return (
      <span className="rename-title">
        {name}
        <button
          type="button"
          className="btn small ghost rename-btn"
          title={t('rename.title')}
          aria-label={t('rename.title')}
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          ✎
        </button>
      </span>
    );
  const save = () => {
    if (value.trim()) onRename(value);
    setEditing(false);
  };
  return (
    <span className="rename-title">
      <input
        className="rename-input"
        value={value}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={t('rename.title')}
      />
      <button type="button" className="btn small primary" onClick={save}>
        {t('rename.ok')}
      </button>
    </span>
  );
}
