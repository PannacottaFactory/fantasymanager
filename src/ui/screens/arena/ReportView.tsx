import { useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import type { MatchResult, RosterEntry } from '../../../engine/combat/types.ts';
import { Commentator } from '../../../engine/commentary/commentator.ts';
import { buildReport, type CreatureMatchStats, type TeamMatchStats } from '../../../engine/report/report.ts';
import { abilityText, speciesName } from '../../../engine/text/localize.ts';
import { Crest } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { ratingClass } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { RoleLabel } from '../../icons/Icon.tsx';

function MomentumChart({ momentum, breaks }: { momentum: number[]; breaks: readonly number[] }) {
  const { t } = useT();
  const w = 600;
  const h = 120;
  const n = Math.max(1, momentum.length);
  const bw = w / n;
  return (
    <div className="momentum">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={t('momentum.aria')}>
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="var(--border-strong)" />
        {breaks
          .filter((b) => b < n)
          .map((b) => (
            <line key={b} x1={b * bw} x2={b * bw} y1={0} y2={h} stroke="var(--border)" strokeDasharray="3 3" />
          ))}
        {momentum.map((m, i) => {
          const bh = Math.abs(m) * (h / 2 - 4);
          return (
            <rect key={i} x={i * bw + 2} width={Math.max(1, bw - 4)} y={m >= 0 ? h / 2 - bh : h / 2} height={Math.max(1, bh)} rx={2} fill={m >= 0 ? 'var(--home)' : 'var(--away)'}>
              <title>{t('momentum.round', { n: i + 1, v: `${m >= 0 ? '+' : ''}${Math.round(m * 100)}` })}</title>
            </rect>
          );
        })}
      </svg>
      <div className="row muted" style={{ fontSize: '0.786rem' }}>
        <span>{t('momentum.first')}</span>
        <span className="spacer" />
        <span>{t('momentum.legend')}</span>
        <span className="spacer" />
        <span>{t('live.round', { n: momentum.length })}</span>
      </div>
    </div>
  );
}

function pct(a: number, b: number) {
  return b ? `${Math.round((100 * a) / b)} %` : '—';
}

function TeamCompare({ teams, names }: { teams: [TeamMatchStats, TeamMatchStats]; names: [string, string] }) {
  const tr = useT();
  const rows: [StringKey, (x: TeamMatchStats) => string | number][] = [
    ['cmp.damage', (x) => x.damageDealt],
    ['cmp.hitRate', (x) => pct(x.hits, x.attacks)],
    ['cmp.crits', (x) => x.crits],
    ['cmp.kos', (x) => x.kos],
    ['cmp.healing', (x) => x.healing],
    ['cmp.element', (x) => `×${tr.dec(x.avgElementMult, 2)}`],
    ['cmp.backline', (x) => pct(x.backlineDamageTaken, x.damageTaken)],
    ['cmp.subs', (x) => x.substitutions],
  ];
  return (
    <table className="data compare">
      <thead>
        <tr>
          <th></th>
          <th className="num home-text">{names[0]}</th>
          <th className="num away-text">{names[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, f]) => (
          <tr key={label}>
            <td>{tr.t(label)}</td>
            <td className="num">{f(teams[0])}</td>
            <td className="num">{f(teams[1])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Post-match report seen from side 0. `actions` = buttons shown in the header. */
export function ReportView({ result, actions }: { result: MatchResult; actions?: ReactNode }) {
  const tr = useT();
  const { t, lang } = tr;
  const report = useMemo(() => buildReport(result, 0, DEFAULT_CONFIG, lang), [result, lang]);
  const [showLog, setShowLog] = useState(false);
  const log = useMemo(
    () => (showLog ? new Commentator(result.seed, result.roster, [result.teams[0].name, result.teams[1].name], DEFAULT_CONFIG, lang).narrateAll(result.events) : []),
    [showLog, result, lang],
  );
  const names: [string, string] = [result.teams[0].name, result.teams[1].name];
  const r = (id: string): RosterEntry => result.roster[id]!;
  const o = result.outcome;

  const columns: Column<CreatureMatchStats>[] = [
    {
      key: 'name',
      label: t('col.creature'),
      sort: (c) => r(c.id).name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={r(c.id).speciesId} name={r(c.id).name} />
          <span className={c.side === 0 ? 'home-text' : 'away-text'}>●</span>
          {r(c.id).name}
          {report.mvp === c.id && (
            <span className="tag" style={{ color: 'var(--accent)' }}>
              {t('report.mvp')}
            </span>
          )}
        </span>
      ),
    },
    { key: 'species', label: t('col.species'), sort: (c) => speciesName(r(c.id).speciesId, lang), render: (c) => speciesName(r(c.id).speciesId, lang) },
    { key: 'role', label: t('col.role'), sort: (c) => r(c.id).role, render: (c) => <RoleLabel role={r(c.id).role} /> },
    { key: 'rating', label: t('col.rating'), num: true, sort: (c) => c.rating, render: (c) => <span className={`rating ${ratingClass(c.rating)}`}>{tr.dec(c.rating)}</span> },
    { key: 'rounds', label: t('col.rds'), title: t('col.rds.title'), num: true, sort: (c) => c.roundsPlayed, render: (c) => c.roundsPlayed },
    { key: 'dmg', label: t('col.dmg'), title: t('col.dmg.title'), num: true, sort: (c) => c.damageDealt, render: (c) => c.damageDealt },
    { key: 'taken', label: t('col.taken'), num: true, sort: (c) => c.damageTaken, render: (c) => c.damageTaken },
    { key: 'hits', label: t('col.hits'), num: true, sort: (c) => (c.attacks ? c.hits / c.attacks : 0), render: (c) => `${c.hits}/${c.attacks}` },
    { key: 'crits', label: t('col.crit'), num: true, sort: (c) => c.crits, render: (c) => c.crits || '' },
    { key: 'kos', label: t('col.kos'), num: true, sort: (c) => c.kos, render: (c) => c.kos || '' },
    { key: 'heal', label: t('col.heal'), num: true, sort: (c) => c.healing, render: (c) => c.healing || '' },
    { key: 'int', label: t('col.int'), title: t('col.int.title'), num: true, sort: (c) => c.intercepts, render: (c) => c.intercepts || '' },
    {
      key: 'exh',
      label: t('col.exhausted'),
      num: true,
      sort: (c) => c.exhaustedRound ?? 99,
      render: (c) => (c.exhaustedRound ? <span style={{ color: 'var(--warn)' }}>R{c.exhaustedRound}</span> : ''),
    },
    {
      key: 'end',
      label: t('col.end'),
      title: t('col.end.title'),
      sort: (c) => (c.fled ? 0 : c.knockedOut ? 1 : 2),
      render: (c) =>
        c.fled ? <span className="bad-text">{t('end.fled')}</span> : c.knockedOut ? <span className="bad-text">{t('end.ko')}</span> : t('end.hp', { n: c.finalHpPct }),
    },
    {
      key: 'moves',
      label: t('col.mostUsed'),
      render: (c) => {
        const top = Object.entries(c.abilitiesUsed).sort((a, b) => b[1] - a[1])[0];
        return top ? (
          <span className="muted">
            {abilityText(top[0], lang).name} ×{top[1]}
          </span>
        ) : (
          ''
        );
      },
    },
  ];

  return (
    <div className="stack">
      <section className="panel">
        <div className="report-head" data-tip="report">
          <span className={`result-badge ${report.won ? 'win' : 'loss'}`}>{report.won ? t('report.victory') : t('report.defeat')}</span>
          <div className="grow">
            <h2>{report.headline}</h2>
            <div className="muted" style={{ fontSize: '0.929rem' }}>
              {o.method === 'ko' ? t('report.knockout') : t('report.decision')} · {t('report.rounds', { n: o.rounds })} · {t('report.judges')}{' '}
              <b className="home-text">{o.score[0]}</b>–<b className="away-text">{o.score[1]}</b> · {t('report.seed')} <span className="mono">{result.seed}</span>
            </div>
          </div>
          {actions}
        </div>
      </section>

      <div className="report-grid">
        <div className="stack">
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>{t('report.ratings')}</h3>
            <SortableTable rows={report.creatures.filter((c) => c.played)} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'rating', dir: -1 }} />
          </section>
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>{t('report.momentum')}</h3>
            <MomentumChart momentum={report.momentum} breaks={DEFAULT_CONFIG.match.breakRounds} />
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>{t('report.notes')}</h3>
            {report.remarks.length === 0 && <div className="muted">{t('report.nothing')}</div>}
            {report.remarks.map((rm, i) => (
              <div key={i} className={`remark ${rm.tone}`}>
                <span className="ico">{rm.tone === 'good' ? '✓' : rm.tone === 'bad' ? '!' : 'i'}</span>
                <span>{rm.text}</span>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>{t('report.moments')}</h3>
            <ul className="moments" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {report.keyMoments.map((m, i) => (
                <li key={i}>
                  <span className="r">R{m.round}</span>
                  <span className={m.side === 0 ? 'home-text' : m.side === 1 ? 'away-text' : ''}>●</span> {m.text}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>{t('report.compare')}</h3>
            <TeamCompare teams={report.teams} names={names} />
          </section>
        </div>
      </div>

      <section className="panel">
        <button className="btn small" onClick={() => setShowLog((v) => !v)}>
          {showLog ? t('report.hideLog') : t('report.showLog')}
        </button>
        {showLog && (
          <div className="feed" style={{ maxHeight: 420, marginTop: 8 }}>
            {log.map((l, i) => (
              <div key={i} className={`line i${l.importance} ${l.side === null ? '' : `s${l.side}`}`}>
                <span className="faint mono" style={{ fontSize: '0.786rem' }}>
                  R{l.round}{' '}
                </span>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
