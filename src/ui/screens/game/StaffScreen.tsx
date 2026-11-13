import { UiIcon } from '../../icons/Icon.tsx';
import { useState } from 'react';
import type { AttributeCategory } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { Coach } from '../../../engine/league/types.ts';
import { fireCoach, hireCoach, hireFee, programCategory } from '../../../engine/progression/training.ts';
import { categoryName } from '../../../engine/text/localize.ts';
import { Stars, Gold, Money } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';

const DOMAINS: AttributeCategory[] = ['physical', 'combat', 'mental'];
const DomainIcon = ({ d }: { d: AttributeCategory }) => (
  <span className={`dom-icon d-${d}`}>
    <UiIcon name={`dom-${d}`} size="1.05em" />
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
  const staff = game.staff[game.playerTeamId] ?? {};
  const balance = clubOf(game, game.playerTeamId).balance;
  const squad = playerTeam(game).creatures;
  const followers = (d: AttributeCategory) => squad.filter((c) => programCategory(game, c) === d).length;
  const pct = (p: number) => Math.round(p * 100);
  const signed = (v: number, digits: number) => `${v >= 0 ? '+' : '−'}${tr.dec(Math.abs(v), digits)}`;

  const cols: Column<Coach>[] = [
    { key: 'name', label: t('col.name'), sort: (c) => c.name, render: (c) => <b>{c.name}</b> },
    {
      key: 'domain',
      label: t('col.domain'),
      sort: (c) => DOMAINS.indexOf(c.domain),
      render: (c) => (
        <span>
          <DomainIcon d={c.domain} /> {categoryName(c.domain, lang)}
        </span>
      ),
    },
    {
      key: 'quality',
      label: t('col.quality'),
      sort: (c) => c.quality,
      render: (c) => <Stars n={c.quality / 2} title={`${c.quality}/20`} />,
    },
    {
      key: 'effect',
      label: t('staff.col.effect'),
      title: t('staff.col.effect.title'),
      sort: (c) => c.quality,
      render: (c) => {
        const cur = staff[c.domain];
        const now = effectOf(cur ? cur.quality : null);
        const it = effectOf(c.quality);
        const better = it.xp > now.xp;
        return (
          <span className="coach-effect">
            <span>{t('staff.xp', { f: tr.dec(it.xp, 2) })}</span>
            <span>{t('staff.jackpot', { p: pct(it.p) })}</span>
            <span className={better ? 'good-text' : 'bad-text'}>
              {cur ? t('staff.vsCurrent', { xp: signed(it.xp - now.xp, 2), p: signed(pct(it.p) - pct(now.p), 0), name: cur.name }) : t('staff.vsNone')}
            </span>
          </span>
        );
      },
    },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.wage, render: (c) => <Money v={c.wage} /> },
    {
      key: 'hire',
      label: '',
      render: (c) => (
        <button
          className="btn small"
          disabled={hireFee(c) > balance}
          onClick={() => {
            const o = act((g) => hireCoach(g, c.id));
            if (!o) return;
            if (o.kind === 'hired') setNote({ text: t('msg.coachHired.title', { name: c.name }), tone: 'good' });
            else setNote({ text: errorText(tr, o.error === 'taken' ? 'notFound' : o.error), tone: 'bad' });
          }}
        >
          <Gold>{t('staff.hire', { fee: money(hireFee(c)) })}</Gold>
        </button>
      ),
    },
  ];

  const none = effectOf(null);
  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ marginBottom: 6 }}>{t('staff.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('staff.intro', { weeks: DEFAULT_CONFIG.training.coaches.hireWeeks, xp: tr.dec(none.xp, 1), p: pct(none.p) })}
        </p>
        <div className="fin-tiles">
          {DOMAINS.map((d) => {
            const c = staff[d];
            const e = effectOf(c ? c.quality : null);
            const n = followers(d);
            return (
              <div key={d} className={`tile coach-tile d-${d}`}>
                <span className="muted">
                  <DomainIcon d={d} /> {categoryName(d, lang)}
                </span>
                {c ? (
                  <>
                    <b style={{ fontSize: '1.1rem' }}>{c.name}</b>
                    <span className="row">
                      <Stars n={c.quality / 2} title={`${c.quality}/20`} />
                    </span>
                  </>
                ) : (
                  <span className="bad-text">{t('staff.none')}</span>
                )}
                <div className="coach-impact">
                  <span>
                    <b>{t('staff.xp', { f: tr.dec(e.xp, 2) })}</b>
                  </span>
                  <span>
                    <b>{t('staff.jackpot', { p: pct(e.p) })}</b>
                  </span>
                  <span className="faint">{t('staff.followers', { n, program: categoryName(d, lang) })}</span>
                </div>
                {c && (
                  <span className="row" style={{ gap: 8 }}>
                    <span className="faint" style={{ fontSize: '0.857rem' }}>
                      <Gold>{t('common.perWeek', { v: money(c.wage) })}</Gold>
                    </span>
                    <span className="spacer" />
                    <button className="btn small ghost" onClick={() => update((g) => fireCoach(g, d))}>
                      {t('staff.fire')}
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {note && (
          <div className={`answer ${note.tone}`} style={{ marginTop: 10 }}>
            {note.text}
          </div>
        )}
      </section>
      <section className="panel">
        <h3 style={{ marginBottom: 8 }}>{t('staff.market')}</h3>
        <SortableTable rows={game.coachMarket} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'quality', dir: -1 }} />
      </section>
    </div>
  );
}
