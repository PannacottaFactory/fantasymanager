import { useLayoutEffect, useRef, useState } from 'react';
import { FansMeter } from '../../components/Fans.tsx';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf, weeklyBill } from '../../../engine/economy/finance.ts';
import { creatureValue } from '../../../engine/economy/value.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { ExpenseKind, IncomeKind, LedgerEntry } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { getSpecies } from '../../../engine/creature/derived.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, Gold, Money, RollingMoney, Seg, useCountUp } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';
import { levelOf } from '../../../engine/progression/levels.ts';

const INCOME: IncomeKind[] = ['tickets', 'sponsor', 'prizes', 'sales'];
const EXPENSE: ExpenseKind[] = ['wages', 'staff', 'upkeep', 'medical', 'scouting', 'facilities', 'purchases', 'compensation', 'fees'];

function totals(entries: LedgerEntry[]) {
  const income: Partial<Record<IncomeKind, number>> = {};
  const expense: Partial<Record<ExpenseKind, number>> = {};
  for (const e of entries) {
    for (const k of INCOME) income[k] = (income[k] ?? 0) + (e.income[k] ?? 0);
    for (const k of EXPENSE) expense[k] = (expense[k] ?? 0) + (e.expense[k] ?? 0);
  }
  const inc = INCOME.reduce((s, k) => s + (income[k] ?? 0), 0);
  const exp = EXPENSE.reduce((s, k) => s + (expense[k] ?? 0), 0);
  return { income, expense, inc, exp };
}

/** A signed amount in the gain / loss colour. */
function Signed({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? 'good-text' : 'bad-text'}>
      {v >= 0 ? '+' : '−'}
      <Money v={Math.abs(v)} />
    </span>
  );
}

/** Income and expenses of a period as proportional bars (one scale for both sides), then the net. */
function Flows({ entries }: { entries: LedgerEntry[] }) {
  const { t } = useT();
  if (!entries.length) return <div className="faint">{t('fin.noPrev')}</div>;
  const { income, expense, inc, exp } = totals(entries);
  const max = Math.max(1, ...INCOME.map((k) => income[k] ?? 0), ...EXPENSE.map((k) => expense[k] ?? 0));
  const side = (kind: 'in' | 'out', title: string, total: number, rows: [string, number][]) => (
    <div className={`flow-side ${kind}`}>
      <div className="flow-head">
        <span>{title}</span>
        <b>
          {kind === 'in' ? '+' : '−'}
          <Money v={total} />
        </b>
      </div>
      {rows
        .filter(([, v]) => v > 0)
        .map(([label, v]) => (
          <div key={label} className="flow-row">
            <span className="flow-label">{label}</span>
            <span className="flow-bar">
              <i style={{ width: `${Math.max(2, (v / max) * 100)}%` }} />
            </span>
            <span className="flow-val">
              <Money v={v} />
            </span>
          </div>
        ))}
    </div>
  );
  return (
    <div className="flows">
      {side('in', t('fin.income'), inc, INCOME.map((k) => [t(`inc.${k}` as StringKey), income[k] ?? 0]))}
      {side('out', t('fin.expense'), exp, EXPENSE.map((k) => [t(`exp.${k}` as StringKey), expense[k] ?? 0]))}
      <div className="flow-net">
        <span>{t('fin.net')}</span>
        <b>
          <Signed v={inc - exp} />
        </b>
      </div>
    </div>
  );
}

/** Treasury after each week of the season: one line, zero baseline, hover crosshair + tooltip. */
function BalanceChart({ entries, start }: { entries: LedgerEntry[]; start: number }) {
  const tr = useT();
  const { t, money } = tr;
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at its real size, so the labels keep the text size whatever the width.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 200;
  const pad = { l: 64, r: 16, t: 14, b: 26 };
  const points = [{ matchday: 0, balance: start }, ...entries.map((e) => ({ matchday: e.matchday, balance: e.balance }))];
  const last = DEFAULT_CONFIG.league.teams * 2 - 2;
  const values = points.map((p) => p.balance);
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  lo -= span * 0.08;
  hi += span * 0.08;
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  // Room on the left for the longest money label, so it never spills out of the frame.
  pad.l = Math.max(56, 14 + 7.5 * Math.max(...ticks.map((v) => money(v, true).length)));
  const x = (md: number) => pad.l + (md / last) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.matchday).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : null;
  const end = points[points.length - 1]!;

  return (
    <div className="chart-wrap" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="chart"
        role="img"
        aria-label={t('fin.chart')}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((p, i) => {
            if (Math.abs(x(p.matchday) - mx) < Math.abs(x(points[best]!.matchday) - mx)) best = i;
          });
          setHover(best);
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'zero' : 'grid'} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="tick">
              {money(v, true)}
            </text>
          </g>
        ))}
        {[0, 6, 12, last].map((md) => (
          <text key={md} x={x(md)} y={H - 8} textAnchor="middle" className="tick">
            {md === 0 ? '—' : t('fin.mdShort', { d: md })}
          </text>
        ))}
        <defs>
          <linearGradient id="fin-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && (
          <path
            d={`${path} L${x(end.matchday).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} L${x(points[0]!.matchday).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} Z`}
            fill="url(#fin-area)"
            className="area"
          />
        )}
        <path d={path} className="line draw" pathLength={1} />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.matchday)} cy={y(p.balance)} r={2.5} className="pt" />
        ))}
        {h && (
          <>
            <line x1={x(h.matchday)} x2={x(h.matchday)} y1={pad.t} y2={H - pad.b} className="crosshair" />
            <circle cx={x(h.matchday)} cy={y(h.balance)} r={5} className="dot" />
          </>
        )}
        {!h && points.length > 1 && <circle cx={x(end.matchday)} cy={y(end.balance)} r={4.5} className="dot" />}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(x(h.matchday) / W) * 100}%` }}>
          <div className="faint">{h.matchday === 0 ? t('fin.start') : t('fin.matchday', { d: h.matchday })}</div>
          <b className="mono">
            <Money v={h.balance} />
          </b>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function FinancesScreen() {
  const tr = useT();
  const { t, money, lang } = tr;
  const game = useGame((s) => s.game)!;
  const team = playerTeam(game);
  const club = clubOf(game, team.id);
  const season = club.ledger.filter((e) => e.season === game.season);
  const prev = club.ledger.filter((e) => e.season === game.season - 1);
  const lastWeek = season.length ? [season[season.length - 1]!] : [];
  // Treasury before the first week of the season.
  const first = season[0];
  const start = first ? first.balance - Object.values(first.income).reduce((s, v) => s + (v ?? 0), 0) + Object.values(first.expense).reduce((s, v) => s + (v ?? 0), 0) : club.balance;
  const wages = team.creatures.reduce((s, c) => s + (c.contract?.wage ?? 0), 0);
  const bill = weeklyBill(game, team.id);
  const prizes = DEFAULT_CONFIG.economy.income.seasonPrize;
  const reputation = useCountUp(club.reputation, 900);
  const [period, setPeriod] = useState<'week' | 'season' | 'prev'>('season');
  const seasonSum = totals(season);
  const weekNet = lastWeek.length ? lastWeek[0]!.balance - (season.length > 1 ? season[season.length - 2]!.balance : start) : null;

  const cols: Column<Creature>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={c.speciesId} name={c.name} level={levelOf(c)} />
          <button className="link" onClick={() => useGame.getState().openSheet(c.id)}>
            {c.name}
          </button>
          {game.forSale.includes(c.id) && <span className="tag">{t('tag.forSale')}</span>}
        </span>
      ),
    },
    { key: 'species', label: t('col.species'), sort: (c) => speciesName(c.speciesId, lang), render: (c) => speciesName(c.speciesId, lang) },
    { key: 'value', label: t('col.value'), num: true, sort: (c) => creatureValue(c), render: (c) => <Money v={creatureValue(c)} compact /> },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.contract?.wage ?? 0, render: (c) => <Money v={c.contract?.wage ?? 0} /> },
    { key: 'upkeep', label: t('exp.upkeep'), num: true, sort: (c) => getSpecies(c).upkeep, render: (c) => <Money v={getSpecies(c).upkeep} /> },
    {
      key: 'contract',
      label: t('col.contract'),
      sort: (c) => c.contract?.untilSeason ?? 0,
      render: (c) =>
        c.contract ? (
          <span className={c.contract.untilSeason <= game.season ? 'bad-text' : ''}>{t('contract.until', { s: c.contract.untilSeason })}</span>
        ) : (
          '—'
        ),
    },
  ];

  const detail = t('fin.weekly.detail', { w: money(wages), u: money(bill - wages) });
  return (
    <div className="stack fin">
      <section className="panel fin-hero" data-tip="finances">
        <h2 className="fin-title">
          <UiIcon name="nav-finances" /> {t('fin.title')}
        </h2>
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">{t('fin.balance')}</span>
            <b className={`kpi-value ${club.balance < 0 ? 'bad-text' : 'gold-text'}`}>
              <RollingMoney v={club.balance} />
            </b>
            {weekNet !== null && (
              <span className="kpi-sub">
                <Signed v={weekNet} /> {t('fin.lastWeekDelta')}
              </span>
            )}
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('fin.seasonNet')}</span>
            <b className="kpi-value">
              <Signed v={seasonSum.inc - seasonSum.exp} />
            </b>
            <span className="kpi-sub">
              <Gold>{t('fin.inOut', { i: money(seasonSum.inc), o: money(seasonSum.exp) })}</Gold>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('fin.weekly')}</span>
            <b className="kpi-value">
              <Money v={bill} />
            </b>
            <span className="kpi-split" title={detail}>
              <i style={{ width: `${(wages / Math.max(1, bill)) * 100}%` }} />
            </span>
            <span className="kpi-sub">
              <Gold>{detail}</Gold>
            </span>
          </div>
          <div className="kpi" title={t('fans.title.hint')}>
            <span className="kpi-label">{t('fans.title')}</span>
            <FansMeter game={game} compact />
          </div>
          <div className="kpi" title={t('fin.reputation.title')}>
            <span className="kpi-label">{t('fin.reputation')}</span>
            <b className="kpi-value">
              {reputation}
              <small>/100</small>
            </b>
            <span className="kpi-split rep">
              <i style={{ width: `${club.reputation}%` }} />
            </span>
          </div>
        </div>
        {club.balance < 0 && <div className="answer bad">{t('fin.negative')}</div>}
      </section>
      <div className="fin-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t('fin.chart')}</h3>
          </div>
          <BalanceChart entries={season} start={start} />
          <p className="faint fin-note">
            <Gold>{t('fin.prizes', { first: money(prizes[0]!), last: money(prizes[prizes.length - 1]!) })}</Gold>
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h3 className="grow">{t('fin.flows')}</h3>
            <Seg
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'week' as const, label: t('fin.lastWeek') },
                { value: 'season' as const, label: t('fin.season', { s: game.season }) },
                ...(prev.length ? [{ value: 'prev' as const, label: t('fin.prevSeason', { s: game.season - 1 }) }] : []),
              ]}
            />
          </div>
          <Flows entries={period === 'week' ? lastWeek : period === 'season' ? season : prev} />
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h3 className="grow">{t('fin.wages')}</h3>
          <span className="muted">
            <Gold>{t('fin.wageTotal', { n: team.creatures.length, w: money(wages) })}</Gold>
          </span>
        </div>
        <SortableTable rows={team.creatures} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'wage', dir: -1 }} />
      </section>
    </div>
  );
}
