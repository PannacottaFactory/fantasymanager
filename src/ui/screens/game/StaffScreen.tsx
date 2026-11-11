import { UiIcon } from '../../icons/Icon.tsx';
import { useState } from 'react';
import type { AttributeCategory } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import type { Coach } from '../../../engine/league/types.ts';
import { coachFactor, fireCoach, hireCoach, hireFee } from '../../../engine/progression/training.ts';
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

export function StaffScreen() {
  const tr = useT();
  const { t, lang, money } = tr;
  const game = useGame((s) => s.game)!;
  const { act, update } = useGame.getState();
  const [note, setNote] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const staff = game.staff[game.playerTeamId] ?? {};
  const balance = clubOf(game, game.playerTeamId).balance;

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
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Stars n={c.quality / 2} title={`${c.quality}/20`} />
        </span>
      ),
    },
    {
      key: 'effect',
      label: '',
      render: (c) => {
        const cur = staff[c.domain];
        const f = DEFAULT_CONFIG.training.coaches.base + c.quality * DEFAULT_CONFIG.training.coaches.perQuality;
        const better = !cur || c.quality > cur.quality;
        return (
          <span className={better ? 'good-text' : 'faint'} style={{ fontSize: '0.857rem' }}>
            {t('staff.effect', { f: tr.dec(f, 2) })}
            {cur ? ` · ${t('staff.replace', { name: cur.name })}` : ''}
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

  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ marginBottom: 6 }}>{t('staff.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('staff.intro', { weeks: DEFAULT_CONFIG.training.coaches.hireWeeks })}
        </p>
        <div className="fin-tiles">
          {DOMAINS.map((d) => {
            const c = staff[d];
            return (
              <div key={d} className="tile coach-tile">
                <span className="muted">
                  <DomainIcon d={d} /> {categoryName(d, lang)}
                </span>
                {c ? (
                  <>
                    <b style={{ fontSize: '1.1rem' }}>{c.name}</b>
                    <span className="row" style={{ gap: 6 }}>
                      <Stars n={c.quality / 2} title={`${c.quality}/20`} />
                    </span>
                    <span className="faint" style={{ fontSize: '0.857rem' }}>
                      <Gold>{t('staff.effect', { f: tr.dec(coachFactor(game, game.playerTeamId, d), 2) })} · {t('common.perWeek', { v: money(c.wage) })}</Gold>
                    </span>
                    <button className="btn small ghost" style={{ alignSelf: 'start' }} onClick={() => update((g) => fireCoach(g, d))}>
                      {t('staff.fire')}
                    </button>
                  </>
                ) : (
                  <span className="bad-text">{t('staff.none')}</span>
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
