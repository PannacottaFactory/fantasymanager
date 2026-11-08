import { useMemo, useState } from 'react';
import { ABILITIES } from '../../../data/abilities.ts';
import type { MatchResult, RosterEntry } from '../../../engine/combat/types.ts';
import { Commentator } from '../../../engine/commentary/commentator.ts';
import { buildReport, type CreatureMatchStats, type TeamMatchStats } from '../../../engine/report/report.ts';
import { Sigil } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { ratingClass, roleName, speciesName } from '../../format.ts';
import { useArena } from '../../store/arenaStore.ts';

function MomentumChart({ momentum, breaks }: { momentum: number[]; breaks: number[] }) {
  const w = 600;
  const h = 120;
  const n = Math.max(1, momentum.length);
  const bw = w / n;
  return (
    <div className="momentum">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Health advantage per round">
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="var(--border-strong)" />
        {breaks.filter((b) => b < n).map((b) => (
          <line key={b} x1={b * bw} x2={b * bw} y1={0} y2={h} stroke="var(--border)" strokeDasharray="3 3" />
        ))}
        {momentum.map((m, i) => {
          const bh = Math.abs(m) * (h / 2 - 4);
          return (
            <rect
              key={i}
              x={i * bw + 2}
              width={Math.max(1, bw - 4)}
              y={m >= 0 ? h / 2 - bh : h / 2}
              height={Math.max(1, bh)}
              rx={2}
              fill={m >= 0 ? 'var(--home)' : 'var(--away)'}
            >
              <title>
                Round {i + 1}: {m >= 0 ? '+' : ''}
                {Math.round(m * 100)}% health
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="row muted" style={{ fontSize: 11 }}>
        <span>Round 1</span>
        <span className="spacer" />
        <span>Bars above the line: your team had more health left · dashed lines: breaks</span>
        <span className="spacer" />
        <span>Round {momentum.length}</span>
      </div>
    </div>
  );
}

function pct(a: number, b: number) {
  return b ? `${Math.round((100 * a) / b)}%` : '—';
}

function TeamCompare({ teams, names }: { teams: [TeamMatchStats, TeamMatchStats]; names: [string, string] }) {
  const rows: [string, (t: TeamMatchStats) => string | number][] = [
    ['Damage dealt', (t) => t.damageDealt],
    ['Hit rate', (t) => pct(t.hits, t.attacks)],
    ['Critical hits', (t) => t.crits],
    ['Knockouts', (t) => t.kos],
    ['Healing', (t) => t.healing],
    ['Avg. elemental multiplier', (t) => `×${t.avgElementMult.toFixed(2)}`],
    ['Damage taken by back line', (t) => pct(t.backlineDamageTaken, t.damageTaken)],
    ['Substitutions', (t) => t.substitutions],
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
            <td>{label}</td>
            <td className="num">{f(teams[0])}</td>
            <td className="num">{f(teams[1])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportView({ result }: { result: MatchResult }) {
  const { rematch, backToSetup } = useArena.getState();
  const report = useMemo(() => buildReport(result, 0), [result]);
  const [showLog, setShowLog] = useState(false);
  const log = useMemo(
    () => (showLog ? new Commentator(result.seed, result.roster, [result.teams[0].name, result.teams[1].name]).narrateAll(result.events) : []),
    [showLog, result],
  );
  const names: [string, string] = [result.teams[0].name, result.teams[1].name];
  const r = (id: string): RosterEntry => result.roster[id]!;
  const o = result.outcome;

  const columns: Column<CreatureMatchStats>[] = [
    {
      key: 'name',
      label: 'Creature',
      sort: (c) => r(c.id).name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Sigil speciesId={r(c.id).speciesId} />
          <span className={c.side === 0 ? 'home-text' : 'away-text'}>●</span>
          {r(c.id).name}
          {report.mvp === c.id && <span className="tag" style={{ color: 'var(--accent)' }}>MVP</span>}
        </span>
      ),
    },
    { key: 'species', label: 'Species', sort: (c) => r(c.id).speciesId, render: (c) => speciesName(r(c.id).speciesId) },
    { key: 'role', label: 'Role', sort: (c) => r(c.id).role, render: (c) => roleName(r(c.id).role) },
    { key: 'rating', label: 'Rating', num: true, sort: (c) => c.rating, render: (c) => <span className={`rating ${ratingClass(c.rating)}`}>{c.rating.toFixed(1)}</span> },
    { key: 'rounds', label: 'Rds', title: 'Rounds on the field', num: true, sort: (c) => c.roundsPlayed, render: (c) => c.roundsPlayed },
    { key: 'dmg', label: 'Dmg', title: 'Damage dealt', num: true, sort: (c) => c.damageDealt, render: (c) => c.damageDealt },
    { key: 'taken', label: 'Taken', num: true, sort: (c) => c.damageTaken, render: (c) => c.damageTaken },
    { key: 'hits', label: 'Hits', num: true, sort: (c) => (c.attacks ? c.hits / c.attacks : 0), render: (c) => `${c.hits}/${c.attacks}` },
    { key: 'crits', label: 'Crit', num: true, sort: (c) => c.crits, render: (c) => c.crits || '' },
    { key: 'kos', label: 'KOs', num: true, sort: (c) => c.kos, render: (c) => c.kos || '' },
    { key: 'heal', label: 'Heal', num: true, sort: (c) => c.healing, render: (c) => c.healing || '' },
    { key: 'int', label: 'Int', title: 'Blows intercepted for an ally', num: true, sort: (c) => c.intercepts, render: (c) => c.intercepts || '' },
    {
      key: 'exh',
      label: 'Exhausted',
      num: true,
      sort: (c) => c.exhaustedRound ?? 99,
      render: (c) => (c.exhaustedRound ? <span style={{ color: 'var(--warn)' }}>R{c.exhaustedRound}</span> : ''),
    },
    {
      key: 'end',
      label: 'End',
      title: 'How the fight ended for this creature',
      sort: (c) => (c.fled ? 0 : c.knockedOut ? 1 : 2),
      render: (c) => (c.fled ? <span style={{ color: 'var(--bad)' }}>Fled</span> : c.knockedOut ? <span style={{ color: 'var(--bad)' }}>KO</span> : `${c.finalHpPct}% hp`),
    },
    {
      key: 'moves',
      label: 'Most used',
      render: (c) => {
        const top = Object.entries(c.abilitiesUsed).sort((a, b) => b[1] - a[1])[0];
        return top ? <span className="muted">{ABILITIES[top[0]]?.name} ×{top[1]}</span> : '';
      },
    },
  ];

  return (
    <div className="stack">
      <section className="panel">
        <div className="report-head">
          <span className={`result-badge ${report.won ? 'win' : 'loss'}`}>{report.won ? 'VICTORY' : 'DEFEAT'}</span>
          <div className="grow">
            <h2>{report.headline}</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              {o.method === 'ko' ? 'Knockout' : 'Judges’ decision'} · {o.rounds} rounds · judges’ score{' '}
              <b className="home-text">{o.score[0]}</b>–<b className="away-text">{o.score[1]}</b> · seed <span className="mono">{result.seed}</span>
            </div>
          </div>
          <button className="btn" onClick={() => rematch(false)} title="Same teams, same seed: the same fight unless you decide differently at the breaks">
            Replay (same seed)
          </button>
          <button className="btn" onClick={() => rematch(true)}>
            Rematch (new seed)
          </button>
          <button className="btn primary" onClick={backToSetup}>
            Back to setup
          </button>
        </div>
      </section>

      <div className="report-grid">
        <div className="stack">
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>Creature ratings</h3>
            <SortableTable rows={report.creatures.filter((c) => c.played)} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'rating', dir: -1 }} />
          </section>
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>Momentum</h3>
            <MomentumChart momentum={report.momentum} breaks={[5, 10, 15]} />
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>Assistant’s notes</h3>
            {report.remarks.length === 0 && <div className="muted">Nothing special to report.</div>}
            {report.remarks.map((rm, i) => (
              <div key={i} className={`remark ${rm.tone}`}>
                <span className="ico">{rm.tone === 'good' ? '✓' : rm.tone === 'bad' ? '!' : 'i'}</span>
                <span>{rm.text}</span>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3 style={{ marginBottom: 8 }}>Key moments</h3>
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
            <h3 style={{ marginBottom: 8 }}>Team comparison</h3>
            <TeamCompare teams={report.teams} names={names} />
          </section>
        </div>
      </div>

      <section className="panel">
        <button className="btn small" onClick={() => setShowLog((v) => !v)}>
          {showLog ? 'Hide' : 'Show'} full commentary
        </button>
        {showLog && (
          <div className="feed" style={{ maxHeight: 420, marginTop: 8 }}>
            {log.map((l, i) => (
              <div key={i} className={`line i${l.importance} ${l.side === null ? '' : `s${l.side}`}`}>
                <span className="faint mono" style={{ fontSize: 11 }}>
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
