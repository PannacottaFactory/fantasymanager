/**
 * Staff: one card per program (physical, combat, mental) in its colour — the coach, their quality, what they give
 * (match XP, chance of a +2 in a session), the creatures they work with — then the coaches looking for a stable, one
 * line each, filtered by domain, with the gain over the current coach and the hiring fee.
 */
import { UiIcon } from '../../icons/Icon.tsx';
import { useState } from 'react';
import type { AttributeCategory } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { Coach } from '../../../engine/league/types.ts';
import { levelOf } from '../../../engine/progression/levels.ts';
import { fireCoach, hireCoach, hireFee, programCategory } from '../../../engine/progression/training.ts';
import { categoryName } from '../../../engine/text/localize.ts';
import { Crest, Gold, Money, Seg, Stars } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';

const DOMAINS: AttributeCategory[] = ['physical', 'combat', 'mental'];
const DomainIcon = ({ d, size = '1.05em' }: { d: AttributeCategory; size?: string }) => (
  <span className={`dom-icon d-${d}`}>
    <UiIcon name={`dom-${d}`} size={size} />
  </span>
);

/** What a coach of this quality does (none = no coach): match XP multiplier and chance of a +2 in a session. */
function effectOf(quality: number | null) {
  const c = DEFAULT_CONFIG.training.coaches;
  const j = DEFAULT_CONFIG.training.sessions.jackpot;
  return quality === null ? { xp: c.noCoach, p: j.base } : { xp: c.base + quality * c.perQuality, p: j.base + quality * j.perQuality };
}

export function StaffScreen() {
  const tr = useT();
  const { t, lang, money } = tr;
  const game = useGame((s) => s.game)!;
  const { act, update } = useGame.getState();
  const [note, setNote] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [domain, setDomain] = useState<AttributeCategory | 'all'>('all');
  const staff = game.staff[game.playerTeamId] ?? {};
  const balance = clubOf(game, game.playerTeamId).balance;
  const squad = playerTeam(game).creatures;
  const pct = (p: number) => Math.round(p * 100);
  const signed = (v: number, digits: number) => `${v >= 0 ? '+' : '−'}${tr.dec(Math.abs(v), digits)}`;
  const wages = DOMAINS.reduce((s, d) => s + (staff[d]?.wage ?? 0), 0);
  const none = effectOf(null);

  const gain = (c: Coach) => {
    const cur = staff[c.domain];
    const now = effectOf(cur ? cur.quality : null);
    const it = effectOf(c.quality);
    return { it, xp: it.xp - now.xp, p: pct(it.p) - pct(now.p), cur };
  };
  const cols: Column<Coach>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="st-cand">
          <DomainIcon d={c.domain} size="1.2em" />
          <b>{c.name}</b>
        </span>
      ),
    },
    { key: 'domain', label: t('col.domain'), sort: (c) => DOMAINS.indexOf(c.domain), render: (c) => <span className={`st-dom d-${c.domain}`}>{categoryName(c.domain, lang)}</span> },
    { key: 'quality', label: t('col.quality'), sort: (c) => c.quality, render: (c) => <Stars n={c.quality / 2} title={`${c.quality}/20`} /> },
    { key: 'xp', label: t('staff.col.xp'), num: true, className: 'col-cat', sort: (c) => c.quality, render: (c) => <b>×{tr.dec(gain(c).it.xp, 2)}</b> },
    { key: 'jackpot', label: t('staff.col.jackpot'), num: true, sort: (c) => c.quality, render: (c) => <b>{pct(gain(c).it.p)} %</b> },
    {
      key: 'gain',
      label: t('staff.col.gain'),
      title: t('staff.col.effect.title'),
      sort: (c) => gain(c).xp,
      render: (c) => {
        const g = gain(c);
        if (!g.cur) return <span className="st-gain up">{t('staff.gain.none')}</span>;
        const tone = g.xp > 0 ? 'up' : g.xp < 0 ? 'down' : 'same';
        return (
          <span className={`st-gain ${tone}`} title={t('staff.vsCurrent', { xp: signed(g.xp, 2), p: signed(g.p, 0), name: g.cur.name })}>
            XP {signed(g.xp, 2)} · +2 {signed(g.p, 0)} %
          </span>
        );
      },
    },
    { key: 'wage', label: t('col.wage'), num: true, className: 'col-cat', sort: (c) => c.wage, render: (c) => <Money v={c.wage} /> },
    {
      key: 'hire',
      label: '',
      render: (c) => (
        <button
          className={`btn small ${gain(c).xp > 0 ? 'primary' : ''}`}
          disabled={hireFee(c) > balance}
          title={t('staff.hireFee', { weeks: DEFAULT_CONFIG.training.coaches.hireWeeks })}
          onClick={() => {
            const o = act((g) => hireCoach(g, c.id));
            if (!o) return;
            if (o.kind === 'hired') setNote({ text: t('msg.coachHired.title', { name: c.name }), tone: 'good' });
            else setNote({ text: errorText(tr, o.error === 'taken' ? 'notFound' : o.error), tone: 'bad' });
          }}
        >
          {t('staff.hireShort')} · <Money v={hireFee(c)} />
        </button>
      ),
    },
  ];
  const market = domain === 'all' ? game.coachMarket : game.coachMarket.filter((c) => c.domain === domain);

  return (
    <div className="stack staff">
      <section className="panel st-screen">
        <div className="panel-head">
          <h2>{t('staff.title')}</h2>
        </div>
        <div className="kpis st-kpis">
          <div className="kpi">
            <span className="kpi-label">{t('staff.kpi.coaches')}</span>
            <b className="kpi-value">
              {DOMAINS.filter((d) => staff[d]).length}
              <small>/3</small>
            </b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('staff.kpi.wages')}</span>
            <b className="kpi-value gold-text">
              <Money v={wages} />
            </b>
            <span className="kpi-sub">{t('staff.kpi.perWeek')}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('staff.kpi.without')}</span>
            <b className="kpi-value">×{tr.dec(none.xp, 1)}</b>
            <span className="kpi-sub">{t('staff.kpi.withoutSub', { p: pct(none.p) })}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('staff.kpi.fee')}</span>
            <b className="kpi-value">{t('staff.kpi.feeWeeks', { n: DEFAULT_CONFIG.training.coaches.hireWeeks })}</b>
            <span className="kpi-sub">{t('staff.kpi.feeSub')}</span>
          </div>
        </div>
        {note && <div className={`answer ${note.tone}`}>{note.text}</div>}
        <div className="st-grid">
          {DOMAINS.map((d) => {
            const c = staff[d];
            const e = effectOf(c ? c.quality : null);
            const pupils = squad.filter((x) => programCategory(game, x) === d);
            return (
              <article key={d} className={`st-card d-${d} ${c ? '' : 'empty'}`}>
                <header className="st-banner">
                  <span className="st-watermark" aria-hidden="true">
                    <UiIcon name={`dom-${d}`} size="6.5em" />
                  </span>
                  <span className="st-emblem" aria-hidden="true">
                    <UiIcon name={`dom-${d}`} size="2.2em" />
                  </span>
                  <div className="st-who">
                    <small>{t('staff.coachOf', { program: categoryName(d, lang) })}</small>
                    <h3>{c ? c.name : t('staff.vacant')}</h3>
                    {c ? <Stars n={c.quality / 2} title={`${c.quality}/20`} /> : <span className="bad-text">{t('staff.none')}</span>}
                  </div>
                </header>
                <div className="st-stats">
                  <div>
                    <span>{t('staff.col.xp')}</span>
                    <b>×{tr.dec(e.xp, 2)}</b>
                  </div>
                  <div>
                    <span>{t('staff.col.jackpot')}</span>
                    <b>{pct(e.p)} %</b>
                  </div>
                </div>
                <div className="st-pupils">
                  <span className="faint">{t('staff.followers', { n: pupils.length, program: categoryName(d, lang) })}</span>
                  <span className="st-crests">
                    {pupils.slice(0, 10).map((x) => (
                      <button key={x.id} className="st-pupil" title={x.name} onClick={() => useGame.getState().openSheet(x.id)}>
                        <Crest speciesId={x.speciesId} name={x.name} level={levelOf(x)} />
                      </button>
                    ))}
                  </span>
                </div>
                <footer className="st-foot">
                  {c ? (
                    <>
                      <span>
                        <Gold>{t('common.perWeek', { v: money(c.wage) })}</Gold>
                      </span>
                      <button className="btn small ghost danger" onClick={() => update((g) => fireCoach(g, d))}>
                        {t('staff.fire')}
                      </button>
                    </>
                  ) : (
                    <button className="btn small primary st-find" onClick={() => setDomain(d)}>
                      {t('staff.find')}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
        <p className="faint st-intro">{t('staff.intro', { weeks: DEFAULT_CONFIG.training.coaches.hireWeeks, xp: tr.dec(none.xp, 1), p: pct(none.p) })}</p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3 className="grow">{t('staff.market')}</h3>
          <Seg<AttributeCategory | 'all'>
            value={domain}
            onChange={setDomain}
            options={[
              { value: 'all', label: t('staff.filter.all') },
              ...DOMAINS.map((d) => ({ value: d, label: <><DomainIcon d={d} /> {categoryName(d, lang)}</> })),
            ]}
          />
        </div>
        <div className="squad-table st-table">
          <SortableTable rows={market} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'quality', dir: -1 }} />
        </div>
      </section>
    </div>
  );
}
