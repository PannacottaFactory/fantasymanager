/**
 * Career statistics: the manager's record over every season and stable (league seasons, wins and defeats, titles,
 * promotions, trophies, objectives met), the reputation curve (career mode) and the stables managed. Reads only what
 * the game already records (`GameState.career`, `manager`); zero game rules.
 */
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { lastMatchday, playerTeam, standings } from '../../../engine/league/season.ts';
import type { GameState, SeasonRecord } from '../../../engine/league/types.ts';
import { compName, divName } from '../../competitions.ts';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { CompIcon, DivIcon, UiIcon } from '../../icons/Icon.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { objectiveText } from './InboxScreen.tsx';

const promoted = DEFAULT_CONFIG.league.promoted;

/** What a finished season brought: title, promotion, relegation. */
function moves(game: GameState, r: SeasonRecord) {
  const size = game.divisions[r.division]?.length ?? 10;
  return {
    title: r.position === 1,
    up: r.division > 0 && r.position <= promoted,
    down: r.division < game.divisions.length - 1 && r.position > size - promoted,
  };
}

/** Trophies of a season: league title, Shadow Cup, tournaments (division cups named by the season's division). */
function trophiesOf(r: SeasonRecord): { def: string; id: string; league?: boolean }[] {
  return [
    ...(r.position === 1 ? [{ def: 'league', id: 'league', league: true }] : []),
    ...(r.cupWon ? [{ def: 'shadow', id: 'shadow' }] : []),
    ...(r.trophies ?? []).map((d) => ({ def: d, id: d === 'division' ? `division-${r.division}` : d })),
  ];
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="cs-tile">
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small className="muted">{sub}</small>}
    </div>
  );
}

/** Manager reputation at the end of each season: one series, a point per season with its value on hover. */
function ReputationCurve({ tr, values }: { tr: Translator; values: number[] }) {
  const { t } = tr;
  const W = 520;
  const H = 150;
  const pad = { l: 30, r: 12, t: 12, b: 24 };
  const n = values.length;
  const x = (i: number) => pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="cs-curve">
      <figcaption>{t('cs.curve')}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('cs.curve')}>
        {[0, 50, 100].map((v) => (
          <g key={v} className="cs-grid">
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <path d={path} className="cs-line" />
        {values.map((v, i) => (
          <g key={i} className="cs-pt">
            <circle cx={x(i)} cy={y(v)} r={12} className="cs-hit" />
            <circle cx={x(i)} cy={y(v)} r={4.5} className="cs-dot" />
            <title>{t('cs.curve.point', { s: i + 1, v })}</title>
            <text x={x(i)} y={H - 6} textAnchor="middle" className="cs-axis">
              {t('cs.season.short', { s: i + 1 })}
            </text>
          </g>
        ))}
        {n > 0 && (
          <text x={x(n - 1)} y={y(values[n - 1]!) - 10} textAnchor="middle" className="cs-last">
            {values[n - 1]}
          </text>
        )}
      </svg>
    </figure>
  );
}

export function CareerScreen() {
  const tr = useT();
  const { t, ordinal } = tr;
  const game = useGame((s) => s.game)!;
  const m = game.manager;
  const records = game.career ?? [];
  const me = playerTeam(game);
  const div = divisionOf(game, me.id);
  const table = standings(game, div);
  const row = table.find((r) => r.teamId === me.id);
  const now = game.matchday > lastMatchday(game) ? null : row;

  const seasons = records.length;
  const won = records.reduce((s, r) => s + (r.won ?? 0), 0) + (now ? now.koWins + now.pointsWins : 0);
  const lost = records.reduce((s, r) => s + (r.lost ?? 0), 0) + (now ? now.koLosses + now.pointsLosses : 0);
  const titles = records.filter((r) => r.position === 1).length;
  const ups = records.filter((r) => moves(game, r).up).length;
  const downs = records.filter((r) => moves(game, r).down).length;
  const cups = records.reduce((s, r) => s + (r.cupWon ? 1 : 0) + (r.trophies?.length ?? 0), 0);
  const judged = records.filter((r) => r.met !== undefined);
  const met = judged.filter((r) => r.met).length;
  // Highest league reached (this season included), and the best place there.
  const top = Math.min(div, ...records.map((r) => r.division));
  const topBest = records.filter((r) => r.division === top).sort((a, b) => a.position - b.position)[0];
  const pct = won + lost ? Math.round((won / (won + lost)) * 100) : 0;
  const jobs = m?.jobs ?? [{ teamId: me.id, teamName: me.name, from: { season: 1, matchday: 1 } }];
  const curve = !!m?.career && (m.trend?.length ?? 0) > 0;

  return (
    <div className="stack career-screen">
      <section className="panel cs-hero">
        <span className="cs-icon">
          <UiIcon name="nav-career" size="2.2em" />
        </span>
        <div className="cs-who">
          <h2>{m?.name ?? t('cs.unnamed')}</h2>
          <span className="muted">
            {t(m?.career ? 'start.mode.career' : 'start.mode.free')} · {t(`diff.${game.difficulty ?? 'normal'}`)}
            {m?.ironman ? ` · ${t('career.ironman')}` : ''}
          </span>
          <span className="muted">{t('cs.now', { team: me.name, div: divName(t, div) })}</span>
        </div>
        <span className="spacer" />
        {m && (
          <div className="cs-rep" title={t('career.reputation.title')}>
            <small>{t('career.reputation')}</small>
            <b>{m.reputation}</b>
            <span className="career-bar">
              <i style={{ width: `${m.reputation}%` }} />
            </span>
          </div>
        )}
      </section>

      <section className="panel cs-tiles">
        <Tile label={t('cs.seasons')} value={seasons} sub={now ? t('cs.inProgress') : undefined} />
        <Tile label={t('cs.record')} value={`${won}–${lost}`} sub={won + lost ? t('cs.winPct', { p: pct }) : undefined} />
        <Tile label={t('cs.titles')} value={titles} />
        <Tile label={t('cs.cups')} value={cups} />
        <Tile label={t('cs.promotions')} value={ups} sub={downs ? t('cs.relegations', { n: downs }) : undefined} />
        <Tile label={t('cs.objectives')} value={judged.length ? `${met}/${judged.length}` : '—'} />
        <Tile label={t('cs.top')} value={divName(t, top)} sub={topBest ? t('cs.topBest', { p: ordinal(topBest.position) }) : undefined} />
      </section>

      <div className={`cs-cols ${curve ? '' : 'one'}`}>
        <section className="panel">
          <h3>{t('cs.stables')}</h3>
          <ul className="cs-jobs">
            {jobs.map((j, i) => {
              const team = game.teams.find((x) => x.id === j.teamId);
              const rs = records.filter((r) => (r.teamId ?? me.id) === j.teamId && r.season >= j.from.season && (!j.to || r.season <= j.to.season));
              const jt = rs.filter((r) => r.position === 1).length + rs.reduce((s, r) => s + (r.cupWon ? 1 : 0) + (r.trophies?.length ?? 0), 0);
              return (
                <li key={`${j.teamId}-${i}`}>
                  {team && <StableCrest team={team} size={28} />}
                  <div>
                    <b>{j.teamName}</b>
                    <small className="muted">
                      {!j.to ? t('career.fromSeason', { s: j.from.season }) : j.to.season === j.from.season ? t('career.season', { s: j.from.season }) : t('career.seasons', { a: j.from.season, b: j.to.season })} ·{' '}
                      {j.end ? t(`career.end.${j.end}`) : t('career.now')}
                    </small>
                  </div>
                  <span className="spacer" />
                  <small className="muted">{t('cs.jobLine', { n: rs.length, tr: jt })}</small>
                </li>
              );
            })}
          </ul>
        </section>
        {curve && (
          <section className="panel">
            <ReputationCurve tr={tr} values={m.trend!} />
          </section>
        )}
      </div>

      <section className="panel">
        <h3>{t('cs.bySeason')}</h3>
        {!records.length && !now ? (
          <p className="muted">{t('honours.noSeason')}</p>
        ) : (
          <div className="table-wrap">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>{t('cs.col.season')}</th>
                  <th>{t('cs.col.stable')}</th>
                  <th>{t('cs.col.league')}</th>
                  <th className="num">{t('cs.col.pos')}</th>
                  <th className="num">{t('cs.col.pts')}</th>
                  <th className="num">{t('cs.col.wl')}</th>
                  <th>{t('cs.col.objective')}</th>
                  <th>{t('cs.col.trophies')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const mv = moves(game, r);
                  return (
                    <tr key={r.season}>
                      <td>{r.season}</td>
                      <td>{r.teamName ?? me.name}</td>
                      <td>
                        <DivIcon d={r.division} /> {divName(t, r.division)}
                      </td>
                      <td className="num">
                        {ordinal(r.position)} {mv.up && <span className="good-text" title={t('cs.up')}>▲</span>}
                        {mv.down && <span className="bad-text" title={t('cs.down')}>▼</span>}
                      </td>
                      <td className="num">{r.points}</td>
                      <td className="num">{r.won !== undefined ? `${r.won}–${r.lost ?? 0}` : '—'}</td>
                      <td>
                        {r.objective ? objectiveText(tr, r.objective) : ''}
                        {r.met !== undefined && <span className={r.met ? 'good-text' : 'bad-text'}> {r.met ? '✓' : '✗'}</span>}
                      </td>
                      <td className="cs-trophies">
                        {trophiesOf(r).map((x, i) =>
                          x.league ? (
                            <DivIcon key={i} d={r.division} title={t('cs.title', { div: divName(t, r.division) })} />
                          ) : (
                            <CompIcon key={i} def={x.def} title={compName(t, x.id)} />
                          ),
                        )}
                      </td>
                    </tr>
                  );
                })}
                {now && (
                  <tr className="cs-now">
                    <td>{game.season}</td>
                    <td>{me.name}</td>
                    <td>
                      <DivIcon d={div} /> {divName(t, div)}
                    </td>
                    <td className="num">{ordinal(table.indexOf(now) + 1)}</td>
                    <td className="num">{now.points}</td>
                    <td className="num">
                      {now.koWins + now.pointsWins}–{now.koLosses + now.pointsLosses}
                    </td>
                    <td>{objectiveText(tr, game.board.objective)}</td>
                    <td className="muted">{t('cs.inProgress')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
