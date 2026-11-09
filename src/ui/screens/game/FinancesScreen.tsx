import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf, weeklyBill } from '../../../engine/economy/finance.ts';
import { creatureValue } from '../../../engine/economy/value.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { ExpenseKind, IncomeKind, LedgerEntry } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { getSpecies } from '../../../engine/creature/derived.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

const INCOME: IncomeKind[] = ['tickets', 'sponsor', 'prizes', 'sales'];
const EXPENSE: ExpenseKind[] = ['wages', 'staff', 'upkeep', 'medical', 'scouting', 'facilities', 'purchases', 'compensation'];

function totals(entries: LedgerEntry[]) {
  const income: Partial<Record<IncomeKind, number>> = {};
  const expense: Partial<Record<ExpenseKind, number>> = {};
  for (const e of entries) {
    for (const k of INCOME) income[k] = (income[k] ?? 0) + (e.income[k] ?? 0);
    for (const k of EXPENSE) expense[k] = (expense[k] ?? 0) + (e.expense[k] ?? 0);
  }
  return { income, expense };
}

/** Income / expense table for a set of weeks. */
function Breakdown({ title, entries }: { title: string; entries: LedgerEntry[] }) {
  const tr = useT();
  const { t, money } = tr;
  const { income, expense } = totals(entries);
  const inc = INCOME.reduce((s, k) => s + (income[k] ?? 0), 0);
  const exp = EXPENSE.reduce((s, k) => s + (expense[k] ?? 0), 0);
  const line = (label: string, v: number, sign: 1 | -1) =>
    v ? (
      <tr key={label}>
        <td>{label}</td>
        <td className="num mono">{sign < 0 ? `−${money(v).replace('−', '')}` : money(v)}</td>
      </tr>
    ) : null;
  return (
    <div>
      <h4 style={{ marginBottom: 6 }}>{title}</h4>
      {entries.length === 0 ? (
        <div className="faint">{t('fin.empty')}</div>
      ) : (
        <table className="data ledger">
          <tbody>
            <tr className="ledger-head">
              <td>{t('fin.income')}</td>
              <td className="num mono">{money(inc)}</td>
            </tr>
            {INCOME.map((k) => line(t(`inc.${k}` as StringKey), income[k] ?? 0, 1))}
            <tr className="ledger-head">
              <td>{t('fin.expense')}</td>
              <td className="num mono">−{money(exp)}</td>
            </tr>
            {EXPENSE.map((k) => line(t(`exp.${k}` as StringKey), expense[k] ?? 0, -1))}
            <tr className="ledger-total">
              <td>{t('fin.net')}</td>
              <td className={`num mono ${inc - exp >= 0 ? 'good-text' : 'bad-text'}`}>
                {inc - exp >= 0 ? '+' : ''}
                {money(inc - exp)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Treasury after each week of the season: one line, zero baseline, hover crosshair + tooltip. */
function BalanceChart({ entries, start }: { entries: LedgerEntry[]; start: number }) {
  const tr = useT();
  const { t, money } = tr;
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 64, r: 16, t: 14, b: 26 };
  const points = [{ matchday: 0, balance: start }, ...entries.map((e) => ({ matchday: e.matchday, balance: e.balance }))];
  const last = DEFAULT_CONFIG.league.teams * 2 - 2;
  const values = points.map((p) => p.balance);
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  lo -= span * 0.08;
  hi += span * 0.08;
  const x = (md: number) => pad.l + (md / last) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.matchday).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
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
        <path d={path} className="line" />
        {h && (
          <>
            <line x1={x(h.matchday)} x2={x(h.matchday)} y1={pad.t} y2={H - pad.b} className="crosshair" />
            <circle cx={x(h.matchday)} cy={y(h.balance)} r={5} className="dot" />
          </>
        )}
        {!h && points.length > 1 && <circle cx={x(points[points.length - 1]!.matchday)} cy={y(points[points.length - 1]!.balance)} r={4} className="dot" />}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(x(h.matchday) / W) * 100}%` }}>
          <div className="faint">{h.matchday === 0 ? t('fin.start') : t('fin.matchday', { d: h.matchday })}</div>
          <b className="mono">{money(h.balance)}</b>
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

  const cols: Column<Creature>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={c.speciesId} name={c.name} />
          <button className="link" onClick={() => useGame.getState().openSheet(c.id)}>
            {c.name}
          </button>
          {game.forSale.includes(c.id) && <span className="tag">{t('tag.forSale')}</span>}
        </span>
      ),
    },
    { key: 'species', label: t('col.species'), sort: (c) => speciesName(c.speciesId, lang), render: (c) => speciesName(c.speciesId, lang) },
    { key: 'value', label: t('col.value'), num: true, sort: (c) => creatureValue(c), render: (c) => money(creatureValue(c), true) },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.contract?.wage ?? 0, render: (c) => money(c.contract?.wage ?? 0) },
    { key: 'upkeep', label: t('exp.upkeep'), num: true, sort: (c) => getSpecies(c).upkeep, render: (c) => money(getSpecies(c).upkeep) },
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

  return (
    <div className="stack">
      <section className="panel">
        <div className="fin-tiles" data-tip="finances">
          <div className="tile">
            <span className="muted">{t('fin.balance')}</span>
            <b className={club.balance < 0 ? 'bad-text' : ''}>{money(club.balance)}</b>
          </div>
          <div className="tile" title={t('fin.reputation.title')}>
            <span className="muted">{t('fin.reputation')}</span>
            <b>{club.reputation}/100</b>
          </div>
          <div className="tile">
            <span className="muted">{t('fin.weekly')}</span>
            <b>{money(bill)}</b>
            <span className="faint" style={{ fontSize: 12 }}>
              {t('fin.weekly.detail', { w: money(wages), u: money(bill - wages) })}
            </span>
          </div>
        </div>
        {club.balance < 0 && <div className="answer bad">{t('fin.negative')}</div>}
      </section>
      <div className="league-grid">
        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>{t('fin.chart')}</h3>
          <BalanceChart entries={season} start={start} />
          <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>
            {t('fin.prizes', { first: money(prizes[0]!), last: money(prizes[prizes.length - 1]!) })}
          </p>
        </section>
        <section className="panel fin-breakdowns">
          <Breakdown title={t('fin.lastWeek')} entries={lastWeek} />
          <Breakdown title={t('fin.season', { s: game.season })} entries={season} />
          {prev.length > 0 && <Breakdown title={t('fin.prevSeason', { s: game.season - 1 })} entries={prev} />}
        </section>
      </div>
      <section className="panel">
        <h3 style={{ marginBottom: 8 }}>{t('fin.wages')}</h3>
        <SortableTable rows={team.creatures} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'wage', dir: -1 }} />
      </section>
    </div>
  );
}
