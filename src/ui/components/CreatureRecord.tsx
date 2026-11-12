/**
 * A creature's career record in its sheet: key numbers, medals (bronze → legend, with the progress to the next one)
 * and the trophies won with its stable. Display only.
 */
import type { CSSProperties } from 'react';
import { DEFAULT_CONFIG, type MedalFamily } from '../../data/config/index.ts';
import type { Creature } from '../../engine/model.ts';
import { averageRating, MEDAL_FAMILIES, medalsOf, medalValue, nextMedal } from '../../engine/team/record.ts';
import { compName, divName } from '../competitions.ts';
import { useT, type Translator } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { CompIcon, DivIcon, UiIcon } from '../icons/Icon.tsx';

const TIERS = ['bronze', 'silver', 'gold', 'legend'] as const;

/** Whole number with the language's thousands separator. */
const num = (tr: Translator, n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, tr.lang === 'fr' ? ' ' : ',');

export function medalName(tr: Translator, family: MedalFamily, tier: number): string {
  return `${tr.t(`medal.${family}` as StringKey)} · ${tr.t(`medal.tier.${TIERS[Math.max(0, tier - 1)]}` as StringKey)}`;
}

export function medalDesc(tr: Translator, family: MedalFamily, n: number): string {
  return tr.t(`medal.${family}.desc` as StringKey, { n: num(tr, n) });
}

/** One medal: the family icon on a disc of the tier's metal; greyed with a progress ring when not won yet. */
export function Medal({ family, tier, progress, title, size = 'md' }: { family: MedalFamily; tier: number; progress?: number; title?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`medal ${tier ? `t-${TIERS[tier - 1]}` : 'locked'} ${size}`}
      style={{ '--p': progress ?? 0 } as CSSProperties}
      title={title}
    >
      <UiIcon name={`medal-${family}`} size="1.15em" />
      {tier > 1 && <i className="medal-tier">{tier === 4 ? '★' : tier}</i>}
    </span>
  );
}

export function CreatureRecordPanel({ creature }: { creature: Creature }) {
  const tr = useT();
  const { t } = tr;
  const r = creature.record;
  const medals = medalsOf(r);
  const avg = averageRating(r);
  const stat = (k: StringKey, v: string | number, cls = '') => (
    <span className={`rec-stat ${cls}`}>
      <b>{v}</b>
      <small>{t(k)}</small>
    </span>
  );
  const won = MEDAL_FAMILIES.reduce((s, f) => s + medals[f], 0);
  const total = MEDAL_FAMILIES.reduce((s, f) => s + DEFAULT_CONFIG.collection.medals[f].length, 0);
  return (
    <section className="rec-panel" data-tip="sheet-record">
      <header className="rec-head">
        <h4>{t('rec.title')}</h4>
        <span className="muted">{t('rec.medals', { n: won, total })}</span>
        {r?.since !== undefined && <span className="faint">{t('rec.since', { s: r.since })}</span>}
      </header>
      {!r || r.matches === 0 ? (
        <p className="muted" style={{ margin: 0 }}>{t('rec.none')}</p>
      ) : (
        <div className="rec-stats">
          {stat('rec.matches', r.matches)}
          {stat('rec.wins', r.wins, 'good-text')}
          {stat('rec.kos', r.kos)}
          {stat('rec.downs', r.downs)}
          {stat('rec.damage', num(tr, r.damage))}
          {r.healing > 0 && stat('rec.healing', num(tr, r.healing))}
          {stat('rec.mvp', r.mvp, r.mvp ? 'gold-text' : '')}
          {stat('rec.avg', tr.dec(avg))}
          {stat('rec.best', tr.dec(r.best / 10))}
        </div>
      )}
      <div className="rec-medals">
        {MEDAL_FAMILIES.map((f) => {
          const tier = medals[f];
          const next = nextMedal(r, f);
          const v = r ? medalValue(r, f) : 0;
          const prevN = tier ? DEFAULT_CONFIG.collection.medals[f][tier - 1]! : 0;
          const progress = next ? (v - prevN) / (next - prevN) : 1;
          const title = [tier ? medalName(tr, f, tier) : t(`medal.${f}` as StringKey), next ? `${t('rec.next')} : ${medalDesc(tr, f, next)} (${num(tr, v)}/${num(tr, next)})` : t('rec.allDone')].join('\n');
          return (
            <span key={f} className="rec-medal">
              <Medal family={f} tier={tier} progress={progress} title={title} />
              <small>{t(`medal.${f}` as StringKey)}</small>
              <span className="rec-progress">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
            </span>
          );
        })}
      </div>
      {r && r.trophies.length > 0 && (
        <div className="rec-trophies">
          {r.trophies.map((x, i) => (
            <span key={i} className="rec-trophy" title={`${t('ribbon.season', { s: x.season })}`}>
              {x.def === 'league' ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />}
              <span>{x.def === 'league' ? t('rec.leagueTitle', { div: divName(t, x.division ?? 0) }) : compName(t, x.tournament)}</span>
              <small className="faint">{t('rec.seasonShort', { s: x.season })}</small>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
