/**
 * Post-match analysis (seen from side 0): conclusions, damage sources, course of the fight, breaks, duels and
 * lost turns. Everything comes from `analyzeMatch`, itself built from the event log.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import type { MatchResult, Side } from '../../../engine/combat/types.ts';
import { analyzeMatch, DAMAGE_SOURCES, type DamageSource, type MatchAnalysis } from '../../../engine/report/analysis.ts';
import { effectText } from '../../../engine/text/localize.ts';
import { Crest } from '../../components/common.tsx';
import { anaT, type AnaKey } from '../../i18n/analysis.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';

type Tab = 'summary' | 'sources' | 'flow' | 'periods' | 'duels' | 'turns';
const TABS: Tab[] = ['summary', 'sources', 'flow', 'periods', 'duels', 'turns'];

/** Categorical slots for damage sources (validated palette, see .viz-* tokens in styles.css). */
const SOURCE_VAR: Record<DamageSource, string> = {
  melee: 'var(--viz-1)',
  ranged: 'var(--viz-2)',
  spell: 'var(--viz-3)',
  overTime: 'var(--viz-4)',
  thorns: 'var(--viz-5)',
};

export function AnalysisPanel({ result }: { result: MatchResult }) {
  const { lang } = useT();
  const a = anaT(lang);
  const analysis = useMemo(() => analyzeMatch(result, 0), [result]);
  const [tab, setTab] = useState<Tab>('summary');
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{a('title')}</h3>
        <div className="enc-tabs">
          {TABS.map((t) => (
            <button key={t} className={`chip ${t === tab ? 'on' : ''}`} onClick={() => setTab(t)}>
              {a(`tab.${t}` as AnaKey)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'summary' && <Summary analysis={analysis} />}
      {tab === 'sources' && <Sources analysis={analysis} result={result} />}
      {tab === 'flow' && <Flow analysis={analysis} result={result} />}
      {tab === 'periods' && <Periods analysis={analysis} result={result} />}
      {tab === 'duels' && <Duels analysis={analysis} result={result} />}
      {tab === 'turns' && <Turns analysis={analysis} result={result} />}
    </section>
  );
}

export function Summary({ analysis }: { analysis: MatchAnalysis }) {
  const { lang } = useT();
  const a = anaT(lang);
  if (!analysis.insights.length) return <div className="muted">{a('none')}</div>;
  return (
    <div>
      {analysis.insights.map((ins, i) => {
        const vars = { ...ins.vars };
        if (typeof vars.effect === 'string') vars.effect = vars.effect ? effectText(vars.effect, lang).noun : '—';
        return (
          <div key={i} className={`remark ${ins.tone}`}>
            <span className="ico">{ins.tone === 'good' ? '✓' : ins.tone === 'bad' ? '!' : 'i'}</span>
            <span>{a(`ins.${ins.key}` as AnaKey, vars)}</span>
          </div>
        );
      })}
    </div>
  );
}

const teamClass = (s: Side) => (s === 0 ? 'home-text' : 'away-text');

export function Sources({ analysis, result }: { analysis: MatchAnalysis; result: MatchResult }) {
  const tr = useT();
  const { lang } = tr;
  const a = anaT(lang);
  const max = Math.max(1, ...analysis.sides.map((s) => s.total));
  const pct = (x: number, total: number) => (total ? `${Math.round((100 * x) / total)} %` : '—');
  return (
    <div className="ana-sources">
      <div className="ana-legend">
        {DAMAGE_SOURCES.map((src) => (
          <span key={src}>
            <i style={{ background: SOURCE_VAR[src] }} /> {a(`src.${src}` as AnaKey)}
          </span>
        ))}
      </div>
      {([0, 1] as Side[]).map((side) => {
        const s = analysis.sides[side];
        return (
          <div key={side} className="ana-row">
            <div className={teamClass(side)}>
              <b>{result.teams[side].name}</b> <span className="muted">· {s.total}</span>
            </div>
            <div className="ana-stack" style={{ width: `${(100 * s.total) / max}%` }} role="img" aria-label={a('src.total')}>
              {DAMAGE_SOURCES.filter((src) => s.sources[src] > 0).map((src) => (
                <span key={src} style={{ flexGrow: s.sources[src], background: SOURCE_VAR[src] }} title={`${a(`src.${src}` as AnaKey)} : ${s.sources[src]} (${pct(s.sources[src], s.total)})`} />
              ))}
            </div>
            <div className="ana-values muted">
              {DAMAGE_SOURCES.filter((src) => s.sources[src] > 0).map((src) => (
                <span key={src}>
                  {a(`src.${src}` as AnaKey)} {s.sources[src]} ({pct(s.sources[src], s.total)})
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <table className="data compare" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th></th>
            <th className="num home-text">{result.teams[0].name}</th>
            <th className="num away-text">{result.teams[1].name}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="sep">
            <td colSpan={3} className="faint">
              {a('src.overTimeBy')}
            </td>
          </tr>
          {[...new Set([...Object.keys(analysis.sides[0].overTimeBy), ...Object.keys(analysis.sides[1].overTimeBy)])].map((id) => (
            <tr key={id}>
              <td>{effectText(id, lang).name}</td>
              <td className="num">{analysis.sides[0].overTimeBy[id] ?? ''}</td>
              <td className="num">{analysis.sides[1].overTimeBy[id] ?? ''}</td>
            </tr>
          ))}
          <tr className="sep">
            <td colSpan={3} className="faint">
              {a('src.sustain')}
            </td>
          </tr>
          {(['healing', 'lifesteal', 'regeneration', 'absorbed', 'cleansed', 'sacrificed'] as const).map((k) => (
            <tr key={k}>
              <td>{a(`src.${k}` as AnaKey)}</td>
              <td className="num">{analysis.sides[0][k] || ''}</td>
              <td className="num">{analysis.sides[1][k] || ''}</td>
            </tr>
          ))}
          <tr className="sep">
            <td colSpan={3} className="faint">
              {a('src.focus')}
            </td>
          </tr>
          {(['onBackline', 'onBackers'] as const).map((k) => (
            <tr key={k}>
              <td>{a(`src.${k}` as AnaKey)}</td>
              <td className="num">{pct(analysis.sides[0][k], analysis.sides[0].total)}</td>
              <td className="num">{pct(analysis.sides[1][k], analysis.sides[1].total)}</td>
            </tr>
          ))}
          <tr>
            <td>{a('src.topTarget')}</td>
            <td className="num">{Math.round(analysis.sides[0].topTargetShare * 100)} %</td>
            <td className="num">{Math.round(analysis.sides[1].topTargetShare * 100)} %</td>
          </tr>
          {Object.keys({ ...analysis.sides[0].inflicted, ...analysis.sides[1].inflicted }).length > 0 && (
            <tr className="sep">
              <td colSpan={3} className="faint">
                {a('src.inflicted')}
              </td>
            </tr>
          )}
          {[...new Set([...Object.keys(analysis.sides[0].inflicted), ...Object.keys(analysis.sides[1].inflicted)])].map((id) => (
            <tr key={id}>
              <td>{effectText(id, lang).name}</td>
              <td className="num">{analysis.sides[0].inflicted[id] ?? ''}</td>
              <td className="num">{analysis.sides[1].inflicted[id] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Two team-health lines on one 0–100 % scale, breaks dashed, hover per round. */
export function Flow({ analysis, result }: { analysis: MatchAnalysis; result: MatchResult }) {
  const { lang } = useT();
  const a = anaT(lang);
  const [hover, setHover] = useState<number | null>(null);
  const w = 600;
  const h = 160;
  const pad = { l: 32, r: 8, t: 8, b: 18 };
  const n = analysis.health.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v) * (h - pad.t - pad.b);
  const path = (side: 0 | 1) => analysis.health.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[side]).toFixed(1)}`).join(' ');
  const breaks = DEFAULT_CONFIG.match.breakRounds.filter((b) => b < n);
  const mine = Object.values(result.roster).filter((r) => r.side === 0 && analysis.creatureHp[r.id]?.some((v) => v !== null));
  const theirs = Object.values(result.roster).filter((r) => r.side === 1 && analysis.creatureHp[r.id]?.some((v) => v !== null));
  return (
    <div>
      <h4 style={{ margin: '0 0 4px' }}>{a('flow.team')}</h4>
      <div className="ana-legend">
        <span>
          <i style={{ background: 'var(--home)' }} /> {result.teams[0].name}
        </span>
        <span>
          <i style={{ background: 'var(--away)' }} /> {result.teams[1].name}
        </span>
        {hover !== null && analysis.health[hover] && (
          <span className="muted">
            {a('flow.round', { n: hover + 1 })} · {Math.round(analysis.health[hover]![0] * 100)} % – {Math.round(analysis.health[hover]![1] * 100)} %
          </span>
        )}
      </div>
      <svg className="ana-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={a('flow.team')} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text x={pad.l - 4} y={y(v) + 4} textAnchor="end" className="ana-axis">
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}
        {breaks.map((b) => (
          <line key={b} x1={x(b - 1)} x2={x(b - 1)} y1={pad.t} y2={h - pad.b} stroke="var(--border-strong)" strokeDasharray="3 3">
            <title>{a('flow.break')}</title>
          </line>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="var(--faint)" />}
        <path d={path(0)} fill="none" stroke="var(--home)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path(1)} fill="none" stroke="var(--away)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null &&
          ([0, 1] as const).map((s) => <circle key={s} cx={x(hover)} cy={y(analysis.health[hover]![s])} r={4} fill={s === 0 ? 'var(--home)' : 'var(--away)'} stroke="var(--panel)" strokeWidth={2} />)}
        {analysis.health.map((_, i) => (
          <rect key={i} x={x(i) - (w - pad.l - pad.r) / Math.max(1, n - 1) / 2} y={0} width={(w - pad.l - pad.r) / Math.max(1, n - 1)} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        <text x={pad.l} y={h - 4} className="ana-axis">
          1
        </text>
        <text x={w - pad.r} y={h - 4} textAnchor="end" className="ana-axis">
          {n}
        </text>
      </svg>
      <h4 style={{ margin: '12px 0 4px' }}>{a('flow.creatures')}</h4>
      <div className="two-cols">
        {[mine, theirs].map((list, side) => (
          <div key={side}>
            {list.map((r) => (
              <div key={r.id} className="ana-spark-row">
                <Crest speciesId={r.speciesId} name={r.name} size={18} />
                <span className="ana-spark-name">{r.name}</span>
                <Spark values={analysis.creatureHp[r.id]!} color={side === 0 ? 'var(--home)' : 'var(--away)'} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Health % per round of one creature (gaps when off the field). */
function Spark({ values, color }: { values: (number | null)[]; color: string }) {
  const w = 160;
  const h = 26;
  const n = Math.max(2, values.length);
  const x = (i: number) => 2 + (i / (n - 1)) * (w - 4);
  const y = (v: number) => 2 + (1 - v / 100) * (h - 4);
  let d = '';
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${i && values[i - 1] !== null && values[i - 1] !== undefined ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  const last = [...values].reverse().find((v) => v !== null) ?? 0;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ana-spark">
      <line x1={2} x2={w - 2} y1={h - 2} y2={h - 2} stroke="var(--border)" />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <title>{values.map((v, i) => `R${i + 1}: ${v === null ? '—' : `${v} %`}`).join(' · ')}</title>
      <text x={w - 2} y={10} textAnchor="end" className="ana-axis">
        {last} %
      </text>
    </svg>
  );
}

export function Periods({ analysis, result }: { analysis: MatchAnalysis; result: MatchResult }) {
  const { lang, t } = useT();
  const a = anaT(lang);
  const name = (id: string) => result.roster[id]?.name.split(' ')[0] ?? '?';
  return (
    <table className="data compare">
      <thead>
        <tr>
          <th></th>
          <th className="num home-text">{result.teams[0].name}</th>
          <th className="num away-text">{result.teams[1].name}</th>
          <th className="num">{a('per.net')}</th>
          <th>{a('per.changes')}</th>
        </tr>
      </thead>
      <tbody>
        {analysis.periods.map((p, i) => {
          const net = p.dealt[0] - p.dealt[1];
          const mine = p.changes.find((c) => c.side === 0);
          const bits = mine
            ? [
                ...mine.subs.map((s) => a('per.sub', { out: name(s.outId), in: name(s.inId) })),
                ...(mine.orders ? [a('per.orders', { aggression: t(`orders.${mine.orders.aggression}` as StringKey).toLowerCase(), target: t(`target.${mine.orders.target}` as StringKey).toLowerCase() })] : []),
              ]
            : [];
          return (
            <tr key={i}>
              <td>{a('per.period', { from: p.from, to: Math.min(p.to, result.outcome.rounds) })}</td>
              <td className="num">
                {p.dealt[0]}
                {p.kos[0] ? <span className="faint"> · {p.kos[0]} KO</span> : null}
              </td>
              <td className="num">
                {p.dealt[1]}
                {p.kos[1] ? <span className="faint"> · {p.kos[1]} KO</span> : null}
              </td>
              <td className={`num ${net > 0 ? 'good-text' : net < 0 ? 'bad-text' : ''}`}>{net > 0 ? `+${net}` : net}</td>
              <td className="muted" style={{ whiteSpace: 'normal' }}>
                {i === 0 ? '' : bits.length ? bits.join(' · ') : a('per.none')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Duels({ analysis, result }: { analysis: MatchAnalysis; result: MatchResult }) {
  const { lang } = useT();
  const a = anaT(lang);
  const top = analysis.duels.slice(0, 10);
  const max = Math.max(1, ...top.map((d) => d.damage));
  const r = (id: string) => result.roster[id]!;
  return (
    <div>
      <h4 style={{ margin: '0 0 6px' }}>{a('duel.top')}</h4>
      {top.map((d) => {
        const side = r(d.attacker).side;
        return (
          <div key={`${d.attacker}|${d.target}`} className="ana-duel">
            <span className={teamClass(side)}>●</span>
            <span className="ana-duel-name">{a('duel.line', { a: r(d.attacker).name, t: r(d.target).name })}</span>
            <span className="ana-bar">
              <i style={{ width: `${(100 * d.damage) / max}%`, background: side === 0 ? 'var(--home)' : 'var(--away)' }} />
            </span>
            <span className="mono">{d.damage}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Turns({ analysis, result }: { analysis: MatchAnalysis; result: MatchResult }) {
  const { lang } = useT();
  const a = anaT(lang);
  const rows = analysis.lostTurns.filter((l) => l.stunned + l.frozen + l.hesitated + l.rested > 0);
  if (!rows.length) return <div className="muted">{a('turns.none')}</div>;
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {a('turns.intro')}
      </p>
      <table className="data compare">
        <thead>
          <tr>
            <th></th>
            <th className="num">{a('turns.stunned')}</th>
            <th className="num">{a('turns.frozen')}</th>
            <th className="num">{a('turns.hesitated')}</th>
            <th className="num">{a('turns.rested')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const r = result.roster[l.id]!;
            return (
              <tr key={l.id}>
                <td>
                  <span className={teamClass(r.side)}>●</span> {r.name}
                </td>
                <td className="num">{l.stunned || ''}</td>
                <td className="num">{l.frozen || ''}</td>
                <td className="num">{l.hesitated || ''}</td>
                <td className="num">{l.rested || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
