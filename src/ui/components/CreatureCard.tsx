/**
 * A creature as a collectible card (Squad, cards view): art in its element colours with the species icon, rating and
 * level, name, species, role, selection, condition bars, best medals; the frame's metal follows the level
 * (bronze → silver → gold → legend). Click = the creature sheet. Own creatures only (it shows exact numbers).
 */
import type { CSSProperties } from 'react';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { bestRole, isInjured, overallRating } from '../../engine/creature/derived.ts';
import type { Creature } from '../../engine/model.ts';
import { levelOf, maxLevelOf, xpInLevel } from '../../engine/progression/levels.ts';
import { MEDAL_FAMILIES, medalsOf } from '../../engine/team/record.ts';
import { injuryText, speciesName } from '../../engine/text/localize.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { fatigueColor, moraleColor, moraleKey } from '../format.ts';
import { useT } from '../i18n/index.ts';
import { RoleLabel, SpeciesIcon, UiIcon } from '../icons/Icon.tsx';
import { Medal } from './CreatureRecord.tsx';
import { StageMark, Stars } from './common.tsx';

export type Selection = 'starter' | 'bench' | 'reserve';

/** Metal of the frame by level. */
export function frameOf(level: number): 'bronze' | 'silver' | 'gold' | 'legend' {
  return level >= 10 ? 'legend' : level >= 7 ? 'gold' : level >= 4 ? 'silver' : 'bronze';
}

export function CreatureCard({ c, selection, onOpen, forSale }: { c: Creature; selection: Selection; onOpen: () => void; forSale?: boolean }) {
  const tr = useT();
  const { t, lang } = tr;
  const els = SPECIES[c.speciesId]?.elements ?? [];
  const c1 = els[0] ? ELEMENTS[els[0]].color : '#8a7a62';
  const c2 = els[1] ? ELEMENTS[els[1]].color : c1;
  const lv = levelOf(c);
  const xp = xpInLevel(c) / DEFAULT_CONFIG.training.levels.xpPerLevel;
  const injury = c.condition.injuries.find((i) => i.weeksLeft > 0);
  const medals = medalsOf(c.record);
  const best = MEDAL_FAMILIES.filter((f) => medals[f] > 0)
    .sort((a, b) => medals[b] - medals[a])
    .slice(0, 4);
  const points = c.growth?.freePoints ?? 0;
  const f = c.condition.fatigue;
  const m = c.condition.morale;
  return (
    <button
      className={`ccard frame-${frameOf(lv)} sel-${selection} ${isInjured(c) ? 'injured' : ''}`}
      style={{ '--c1': c1, '--c2': c2 } as CSSProperties}
      onClick={onOpen}
      title={t('card.open')}
    >
      <span className="ccard-art">
        <span className="ccard-glow" />
        <span className="ccard-icon">
          <SpeciesIcon id={c.speciesId} size="4.2em" />
        </span>
        <span className="ccard-ovr" title={t('col.ovr.title')}>
          <b>{overallRating(c)}</b>
          <small>{t('col.ovr')}</small>
        </span>
        <span className="ccard-lvl" title={t('col.level.title')}>
          <small>{t('card.level')}</small>
          <b>{lv}</b>
          <i style={{ '--xp': xp } as CSSProperties} />
        </span>
        {points > 0 && <span className="ccard-points" title={t('points.chip.title')}>+{points}</span>}
        <span className={`ccard-sel ${selection}`}>{t(selection === 'starter' ? 'sel.starter' : selection === 'bench' ? 'sel.bench' : 'sel.reserve')}</span>
        {injury && (
          <span className="ccard-injury" title={injuryText(injury.injuryId, lang).short}>
            <UiIcon name="injury" /> {tr.weeks(injury.weeksLeft)}
          </span>
        )}
      </span>
      <span className="ccard-body">
        <b className="ccard-name">{c.name}</b>
        <span className="ccard-species">
          {speciesName(c.speciesId, lang)} · {t('card.age', { n: c.age })} <StageMark c={c} />
        </span>
        <span className="ccard-row">
          <RoleLabel role={bestRole(c)} />
          <span className="spacer" />
          <Stars n={maxLevelOf(c)} title={t('stars.potential', { n: maxLevelOf(c) })} />
        </span>
        <span className="ccard-bars">
          <span title={`${t('col.fatigue')} ${f}`}>
            <small>{t('col.fatigue')}</small>
            <span className="ccard-bar">
              <i style={{ width: `${f}%`, background: fatigueColor(f) }} />
            </span>
          </span>
          <span title={`${t('col.morale')} ${m}`}>
            <small>{t('col.morale')}</small>
            <span className="ccard-bar">
              <i style={{ width: `${m}%`, background: moraleColor(m) }} />
            </span>
            <em style={{ color: moraleColor(m) }}>{t(moraleKey(m))}</em>
          </span>
        </span>
        <span className="ccard-foot">
          {best.length ? (
            best.map((fam) => <Medal key={fam} family={fam} tier={medals[fam]} size="sm" />)
          ) : (
            <small className="faint">{t('card.noMedal')}</small>
          )}
          <span className="spacer" />
          {forSale && <span className="tag">{t('tag.forSale')}</span>}
          {c.record && c.record.matches > 0 && <small className="faint">{t('card.matches', { n: c.record.matches })}</small>}
        </span>
      </span>
    </button>
  );
}
