/**
 * League: the pyramid of divisions (where you are, where you are going), the table of a division with zones and
 * movements, its fixtures; every competition of the season (status, prizes, registration, draw); the honours.
 */
import { StableCrest } from '../../components/TeamCrest.tsx';
import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { divisionFixtures, divisionOf } from '../../../engine/league/divisions.ts';
import { lastMatchday, playerDivision, playerFixture, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import { computeStandings } from '../../../engine/league/standings.ts';
import { registerTournament, registrationState, tournamentDef, tournamentPrize } from '../../../engine/league/tournaments.ts';
import type { Fixture, GameState, Tournament } from '../../../engine/league/types.ts';
import { compName, divName, roundKey } from '../../competitions.ts';
import { CompIcon, DivIcon, UiIcon } from '../../icons/Icon.tsx';
import { byWeek, itemLabel, playerSeason, type SeasonItem } from '../../season.ts';
import { ReputationLine } from '../../components/Reputation.tsx';
import { Gold, Money, Seg } from '../../components/common.tsx';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

const FORM_KEY: Record<string, StringKey> = { W: 'form.W', w: 'form.w', l: 'form.l', L: 'form.L' };

/** Name of a cup round, counted from the final (kept for older imports). */
export const cupRoundKey = roundKey;

export function FormDots({ form }: { form: string[] }) {
  const { t } = useT();
  return (
    <span className="form-dots">
      {form.slice(-5).map((f, i) => (
        <i key={i} className={`f-${f === 'W' ? 'kw' : f === 'w' ? 'pw' : f === 'l' ? 'pl' : 'kl'}`} title={t(FORM_KEY[f]!)} />
      ))}
    </span>
  );
}

// ——— The championship (manager-game style): division strip, division header, the table, then the side column ———

/** The four divisions side by side, lowest on the left: where you are, where you are going. */
function DivisionStrip({ game, selected, onSelect }: { game: GameState; selected: number; onSelect: (d: number) => void }) {
  const { t, ordinal, lang } = useT();
  const mine = playerDivision(game);
  return (
    <nav className="lg-divs" aria-label={t('league.climb')} data-tip="league-tabs">
      {/* The lowest league on the left, the Grand Arena on the right: the climb reads left to right. */}
      {game.divisions.map((_, i) => game.divisions.length - 1 - i).map((d) => {
        const table = d === mine ? standings(game, d) : [];
        const pos = table.findIndex((r) => r.teamId === game.playerTeamId) + 1;
        return (
          <button key={d} className={`lg-div tier-${d} ${d === selected ? 'on' : ''} ${d === mine ? 'mine' : ''}`} aria-pressed={d === selected} onClick={() => onSelect(d)}>
            <span className="lg-div-icon">
              <DivIcon d={d} />
            </span>
            <span className="lg-div-name">
              <b>{divName(t, d)}</b>
              <small>
                {t('div.short', { n: d + 1 })} · <span className="gold">{t('league.money', { x: String(DEFAULT_CONFIG.league.divisionMoney[d] ?? 1).replace('.', lang === 'fr' ? ',' : '.') })}</span>
              </small>
            </span>
            {d === mine && (
              <span className="lg-div-you">
                {t('league.you')}
                {pos > 0 && table[pos - 1]!.played > 0 ? ` · ${ordinal(pos)}` : ''}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** The division's header: emblem, rules, season progress — and, for the player's own, its place and the gaps. */
function DivisionHeader({ game, division }: { game: GameState; division: number }) {
  const { t, ordinal } = useT();
  const promoted = DEFAULT_CONFIG.league.promoted;
  const last = game.divisions.length - 1;
  const rows = standings(game, division);
  const size = rows.length;
  const mineDiv = playerDivision(game);
  const pos = rows.findIndex((r) => r.teamId === game.playerTeamId) + 1;
  const me = rows[pos - 1];
  const md = Math.min(seasonOver(game) ? lastMatchday(game) : game.matchday - 1, lastMatchday(game));
  const rules =
    division === 0
      ? t('league.rules.top', { n: promoted, below: divName(t, 1) })
      : division === last
        ? t('league.rules.bottom', { n: promoted, above: divName(t, division - 1) })
        : t('league.rules.mid', { n: promoted, above: divName(t, division - 1), below: divName(t, division + 1) });
  const lines: { text: string; tone: 'good' | 'bad' | 'info' }[] = [];
  if (division === mineDiv && me && me.played > 0) {
    if (division === 0) {
      if (pos === 1) lines.push({ text: t('league.status.title'), tone: 'good' });
      else lines.push({ text: t('league.status.gapTitle', { n: rows[0]!.points - me.points }), tone: 'info' });
    } else if (pos <= promoted) lines.push({ text: t('league.status.promo'), tone: 'good' });
    else lines.push({ text: t('league.status.gapUp', { n: rows[promoted - 1]!.points - me.points }), tone: 'info' });
    if (division < last) {
      if (pos > size - promoted) lines.push({ text: t('league.status.danger'), tone: 'bad' });
      else lines.push({ text: t('league.status.safe', { n: me.points - rows[size - promoted]!.points }), tone: pos > size - promoted - 2 ? 'bad' : 'info' });
    }
  }
  return (
    <section className={`panel lg-head tier-${division}`}>
      <span className="lg-emblem" aria-hidden="true">
        <DivIcon d={division} />
      </span>
      <div className="lg-head-main">
        <div className="lg-head-title">
          <h2>{divName(t, division)}</h2>
          <div className="lg-progress">
            <span className="lg-progress-bar" aria-hidden="true">
              <i style={{ width: `${(100 * md) / lastMatchday(game)}%` }} />
            </span>
            <small className="faint">{t('league.progress', { d: md, n: lastMatchday(game) })}</small>
          </div>
        </div>
        <div className="muted lg-rules">{rules}</div>
      </div>
      {division === mineDiv && me && (
        <div className="lg-me">
          <span className="lg-me-pos">
            <b>{ordinal(pos)}</b>
            <small>{t('dash.points', { n: me.points })}</small>
          </span>
          <span className="lg-me-lines">
            {lines.map((l, i) => (
              <span key={i} className={`lg-chip ${l.tone}`}>
                {l.text}
              </span>
            ))}
          </span>
        </div>
      )}
    </section>
  );
}

function Standings({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const rows = standings(game, division);
  const n = rows.length;
  const promoted = DEFAULT_CONFIG.league.promoted;
  const last = game.divisions.length - 1;
  // Movement since the previous matchday.
  const fx = divisionFixtures(game, division);
  const lastPlayed = fx.reduce((m, f) => (f.result ? Math.max(m, f.matchday) : m), 0);
  const prev = lastPlayed > 1 ? computeStandings(game.divisions[division] ?? [], fx.filter((f) => f.matchday < lastPlayed)) : null;
  const prevPos = (id: string) => (prev ? prev.findIndex((r) => r.teamId === id) + 1 : 0);
  // The player's next opponent, flagged in the table.
  const next = playerFixture(game);
  const nextOpp = next ? (next.home === game.playerTeamId ? next.away : next.home) : null;
  return (
    <section className="panel lg-standings">
      <div className="panel-head">
        <h3>{t('league.standings')}</h3>
        <span className="spacer" />
        <span className="zone-chips">
          {division === 0 ? <span className="zone-chip champ">{t('league.zone.champion')}</span> : <span className="zone-chip up">{t('league.zone.up')}</span>}
          {division < last && <span className="zone-chip down">{t('league.zone.down')}</span>}
        </span>
      </div>
      <div className="table-wrap">
        <table className="data standings lg-table">
          <thead>
            <tr>
              <th className="num">{t('col.pos')}</th>
              <th title={t('league.moved')} />
              <th>{t('col.stable')}</th>
              <th className="num">{t('col.played')}</th>
              <th className="num" title={t('col.koW.title')}>
                {t('col.koW')}
              </th>
              <th className="num" title={t('col.ptsW.title')}>
                {t('col.ptsW')}
              </th>
              <th className="num" title={t('col.ptsL.title')}>
                {t('col.ptsL')}
              </th>
              <th className="num" title={t('col.koL.title')}>
                {t('col.koL')}
              </th>
              <th className="num" title={t('col.diff.title')}>
                {t('col.diff')}
              </th>
              <th>{t('col.lastForm')}</th>
              <th className="num">{t('col.points')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const diff = r.scoreFor - r.scoreAgainst;
              const up = division > 0 && i < promoted;
              const down = division < last && i >= n - promoted;
              const zone = division === 0 && i === 0 ? 'champ' : up ? 'top' : down ? 'bottom' : '';
              // A rule under the last place that goes up, and above the first that goes down.
              const edge = (division > 0 && i === promoted - 1) || (division === 0 && i === 0) ? 'edge-up' : division < last && i === n - promoted - 1 ? 'edge-down' : '';
              const moved = prevPos(r.teamId) ? prevPos(r.teamId) - (i + 1) : 0;
              const team = teamById(game, r.teamId);
              return (
                <tr key={r.teamId} className={`${r.teamId === game.playerTeamId ? 'mine' : ''} ${zone} ${edge}`}>
                  <td className="num pos">{i + 1}</td>
                  <td className={`moved ${moved > 0 ? 'good-text' : moved < 0 ? 'bad-text' : 'faint'}`}>{moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '–'}</td>
                  <td>
                    <span className="team-cell">
                      <StableCrest team={team} size={22} /> <span className="ellipsis">{team.name}</span>
                      {r.teamId === nextOpp && <span className="lg-next">{t('lg.next')}</span>}
                    </span>
                  </td>
                  <td className="num">{r.played}</td>
                  <td className="num sub">{r.koWins}</td>
                  <td className="num sub">{r.pointsWins}</td>
                  <td className="num sub">{r.pointsLosses}</td>
                  <td className="num sub">{r.koLosses}</td>
                  <td className={`num sub ${diff > 0 ? 'good-text' : diff < 0 ? 'bad-text' : ''}`}>{diff > 0 ? `+${diff}` : diff}</td>
                  <td>
                    <FormDots form={r.form} />
                  </td>
                  <td className="num">
                    <b className="pts">{r.points}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="faint lg-legend">{t('league.legend')}</div>
    </section>
  );
}

/** One match of the matchday: home — score — away, the KO round under the score. */
function MatchLine({ game, f }: { game: GameState; f: Fixture }) {
  const { t } = useT();
  const mine = f.home === game.playerTeamId || f.away === game.playerTeamId;
  const r = f.result;
  const canReport = mine && r && game.lastMatch?.fixtureId === f.id;
  const side = (s: 0 | 1) => (r ? (r.winner === s ? 'won' : 'lost') : '');
  const home = teamById(game, f.home);
  const away = teamById(game, f.away);
  return (
    <li className={`lg-fx ${mine ? 'mine' : ''}`}>
      <span className={`lg-fx-team home ${side(0)}`}>
        <span className="ellipsis">{home.name}</span>
        <StableCrest team={home} size={22} />
      </span>
      <span className="lg-fx-mid">
        {r ? (
          <span className={`score-pill ${r.method === 'ko' ? 'ko' : ''}`}>
            {r.score[0]}
            <i>–</i>
            {r.score[1]}
          </span>
        ) : (
          <span className="score-pill todo">{t('league.upcoming')}</span>
        )}
        {r && <small>{r.method === 'ko' ? t('league.koRound', { n: r.rounds }) : t('league.pts')}</small>}
        {canReport && (
          <button className="link lg-fx-report" onClick={() => useGame.getState().viewReport(game.lastMatch!.result)}>
            {t('league.viewReport')}
          </button>
        )}
      </span>
      <span className={`lg-fx-team ${side(1)}`}>
        <StableCrest team={away} size={22} />
        <span className="ellipsis">{away.name}</span>
      </span>
    </li>
  );
}

function Matchday({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const last = lastMatchday(game);
  const current = seasonOver(game) ? last : Math.max(1, Math.min(last, game.matchday));
  const [day, setDay] = useState(current);
  const list = game.fixtures.filter((f) => !f.competition && (f.division ?? 0) === division && f.matchday === day);
  return (
    <section className="panel lg-card">
      <div className="lg-card-head">
        <h3>{t('league.fixtures')}</h3>
        <span className="lg-stepper">
          <button className="btn small ghost" disabled={day <= 1} onClick={() => setDay(day - 1)} aria-label={t('league.matchday', { d: day - 1 })}>
            ‹
          </button>
          <b>{t('league.matchday', { d: day })}</b>
          <button className="btn small ghost" disabled={day >= last} onClick={() => setDay(day + 1)} aria-label={t('league.matchday', { d: day + 1 })}>
            ›
          </button>
        </span>
      </div>
      <ul className="lg-fxs">
        {list.map((f) => (
          <MatchLine key={f.id} game={game} f={f} />
        ))}
      </ul>
    </section>
  );
}

/** The player's place after each league week, with the promotion and drop zones behind. */
function PositionChart({ game, division }: { game: GameState; division: number }) {
  const { t, ordinal } = useT();
  const ids = game.divisions[division] ?? [];
  const fx = divisionFixtures(game, division);
  const played = fx.reduce((m, f) => (f.result ? Math.max(m, f.matchday) : m), 0);
  const size = ids.length;
  const weeks = lastMatchday(game);
  if (played < 1 || size < 2) return <p className="faint lg-empty">{t('lg.noData')}</p>;
  const pts = Array.from({ length: played }, (_, i) => {
    const table = computeStandings(ids, fx.filter((f) => f.matchday <= i + 1));
    return table.findIndex((r) => r.teamId === game.playerTeamId) + 1;
  });
  const W = 300;
  const H = 96;
  const pad = { l: 22, r: 10, t: 8, b: 16 };
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, weeks - 1);
  const y = (p: number) => pad.t + ((H - pad.t - pad.b) * (p - 1)) / (size - 1);
  const promoted = DEFAULT_CONFIG.league.promoted;
  const last = game.divisions.length - 1;
  const band = (from: number, to: number) => ({ y: y(from) - (H - pad.t - pad.b) / (size - 1) / 2, h: ((H - pad.t - pad.b) * (to - from + 1)) / (size - 1) });
  const top = division === 0 ? band(1, 1) : band(1, promoted);
  const bottom = division < last ? band(size - promoted + 1, size) : null;
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const now = pts[pts.length - 1]!;
  return (
    <div className="lg-chart-box">
      <span className="lg-chart-now">
        {t('lg.pos.title')} <b>{ordinal(now)}</b>
      </span>
      <svg className="lg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t('lg.pos.title')} ${pts.map((p) => ordinal(p)).join(', ')}`}>
        <rect className="band-up" x={pad.l} width={W - pad.l - pad.r} y={Math.max(pad.t - 4, top.y)} height={top.h} />
        {bottom && <rect className="band-down" x={pad.l} width={W - pad.l - pad.r} y={bottom.y} height={Math.min(bottom.h, H - pad.b - bottom.y + 4)} />}
        {[1, size].map((p) => (
          <text key={p} className="axis" x={pad.l - 6} y={y(p) + 3} textAnchor="end" fontSize={8}>
            {p}
          </text>
        ))}
        {[1, Math.ceil(weeks / 2), weeks].map((w) => (
          <text key={w} className="axis" x={x(w - 1)} y={H - 3} textAnchor="middle" fontSize={8}>
            {t('lg.pos.week', { n: w })}
          </text>
        ))}
        <polyline className="line" points={line} />
        {pts.map((p, i) => (
          <circle key={i} className={i === pts.length - 1 ? 'dot now' : 'dot'} cx={x(i)} cy={y(p)} r={i === pts.length - 1 ? 3.6 : 2.2}>
            <title>{`${t('league.matchday', { d: i + 1 })} : ${ordinal(p)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/** Season figures of the division's stables: most KOs, tightest defence, best form over the last five. */
function TeamLeaders({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const rows = standings(game, division).filter((r) => r.played > 0);
  const formPts = (f: string[]) => f.slice(-5).reduce((s, x) => s + (x === 'W' ? 3 : x === 'w' ? 2 : x === 'l' ? 1 : 0), 0);
  const blocks: { key: StringKey; unit: StringKey; list: { id: string; v: number }[] }[] = [
    { key: 'lg.lead.kos', unit: 'lg.unit.kos', list: rows.map((r) => ({ id: r.teamId, v: r.kosFor })).sort((a, b) => b.v - a.v) },
    { key: 'lg.lead.def', unit: 'lg.unit.taken', list: rows.map((r) => ({ id: r.teamId, v: r.kosAgainst })).sort((a, b) => a.v - b.v) },
    { key: 'lg.lead.form', unit: 'lg.unit.pts', list: rows.map((r) => ({ id: r.teamId, v: formPts(r.form) })).sort((a, b) => b.v - a.v) },
  ];
  if (rows.length === 0) return <p className="faint lg-empty">{t('lg.noData')}</p>;
  return (
        <div className="lg-leaders">
          {blocks.map((b) => (
            <div key={b.key} className="lg-lead">
              <span className="lg-lead-title">{t(b.key)}</span>
              <ol>
                {b.list.slice(0, 3).map((x, i) => {
                  const team = teamById(game, x.id);
                  return (
                    <li key={x.id} className={x.id === game.playerTeamId ? 'mine' : ''}>
                      <span className="lg-lead-rank">{i + 1}</span>
                      <StableCrest team={team} size={18} />
                      <span className="ellipsis">{team.name}</span>
                      <b>{t(b.unit, { n: x.v })}</b>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
  );
}

/** Position over the season and the division's figures, as one card with two tabs. */
function SeasonWidget({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const own = division === playerDivision(game);
  const [tab, setTab] = useState<'pos' | 'figures'>(own ? 'pos' : 'figures');
  const shown = own ? tab : 'figures';
  return (
    <section className="panel lg-card">
      <div className="lg-card-head">
        <h3>{t('lg.season')}</h3>
        {own && (
          <Seg<'pos' | 'figures'>
            value={shown}
            onChange={setTab}
            options={[
              { value: 'pos', label: t('lg.tab.pos') },
              { value: 'figures', label: t('lg.tab.figures') },
            ]}
          />
        )}
      </div>
      {shown === 'pos' ? <PositionChart game={game} division={division} /> : <TeamLeaders game={game} division={division} />}
    </section>
  );
}

function Championship({ game }: { game: GameState }) {
  const [division, setDivision] = useState(playerDivision(game));
  return (
    <div className="lg">
      <DivisionStrip game={game} selected={division} onSelect={setDivision} />
      <DivisionHeader game={game} division={division} />
      <div className="lg-main">
        <Standings game={game} division={division} />
        <div className="lg-side">
          <Matchday key={`md-${division}`} game={game} division={division} />
          <SeasonWidget key={`sw-${division}`} game={game} division={division} />
        </div>
      </div>
    </div>
  );
}

// ——— Competitions ———

/** A competition seen the same way, whether the Shadow Cup or a tournament. */
interface CompView {
  id: string;
  def: string;
  tournament?: Tournament;
  keys: readonly number[];
  round: number;
  rounds: number;
  entrants: string[];
  alive: string[];
  winner?: string;
  fixtures: Fixture[];
  trophy: number;
}

function views(game: GameState): CompView[] {
  const c = DEFAULT_CONFIG.league.cup;
  const shadow: CompView = {
    id: 'shadow',
    def: 'shadow',
    keys: c.after,
    round: game.cup.round,
    rounds: game.cup.rounds,
    entrants: game.teams.map((x) => x.id),
    alive: game.cup.alive,
    winner: game.cup.winner,
    fixtures: game.fixtures.filter((f) => f.competition === 'cup'),
    trophy: c.prize[c.prize.length - 1] ?? 0,
  };
  const tours = (game.tournaments ?? []).map(
    (x): CompView => ({
      id: x.id,
      def: x.def,
      tournament: x,
      keys: x.keys,
      round: x.round,
      rounds: x.rounds,
      entrants: x.entrants,
      alive: x.alive,
      winner: x.winner,
      fixtures: game.fixtures.filter((f) => f.tournamentId === x.id),
      trophy: tournamentPrize(game, x, x.rounds - 1),
    }),
  );
  return [shadow, ...tours];
}

/** What every view of a competition needs: status, next round, the player's tie, registration. */
function useCompInfo(game: GameState, v: CompView) {
  const { t, money } = useT();
  const [note, setNote] = useState<string | null>(null);
  const me = game.playerTeamId;
  const inIt = v.entrants.includes(me);
  const name = compName(t, v.id);
  const roundName = (r: number) => t(roundKey(r, v.rounds));
  const lostAt = inIt && !v.alive.includes(me) ? v.fixtures.filter((f) => f.result && (f.home === me || f.away === me)).at(-1) : undefined;
  const nextTie = inIt && v.alive.includes(me) ? v.fixtures.find((f) => !f.result && f.round === v.round && (f.home === me || f.away === me)) : undefined;
  const t0 = v.tournament;
  const def = t0 ? tournamentDef(t0) : null;
  const reg = t0 ? registrationState(game, t0) : null;
  let status: { text: string; tone: string };
  if (v.winner === me) status = { text: t('comp.status.won'), tone: 'won' };
  else if (inIt && v.alive.includes(me) && !v.winner) status = { text: t('comp.status.alive'), tone: 'alive' };
  else if (lostAt) status = { text: t('comp.status.out', { round: roundName(lostAt.round ?? 0).toLowerCase() }), tone: 'out' };
  else if (reg === 'ok' || reg === 'money') status = { text: t('comp.status.open', { d: Math.floor(v.keys[0] ?? 0) }), tone: 'open' };
  else if (reg === 'reputation') status = { text: t('comp.status.locked', { rep: def?.minRep ?? 0, mine: clubOf(game, me).reputation }), tone: 'locked' };
  else if (reg === 'closed' && t0?.kind === 'open') status = { text: t('comp.status.closed'), tone: 'none' };
  else status = { text: t('comp.status.notIn'), tone: 'none' };
  const nextKey = v.round < v.rounds ? v.keys[v.round] : undefined;
  const nextText =
    v.winner || nextKey === undefined ? '' : nextKey < 1 ? t('comp.nextPre', { round: roundName(v.round) }) : t('comp.next', { round: roundName(v.round), d: Math.floor(nextKey) });
  const register = () => {
    const o = useGame.getState().act((g) => registerTournament(g, v.id));
    if (!o) return;
    setNote(o.kind === 'registered' ? t('comp.done', { comp: name, fee: money(o.fee) }) : t(`comp.err.${o.error === 'notOpen' || o.error === 'registered' ? 'closed' : o.error}` as StringKey));
  };
  const desc =
    v.def === 'shadow' || v.def === 'division' || v.def === 'champions' || v.def === 'preseason'
      ? t(`comp.desc.${v.def}` as StringKey)
      : def?.minRep
        ? t('comp.desc.open', { rep: def.minRep, fee: money(def.fee ?? 0) })
        : t('comp.desc.openAll', { fee: money(def?.fee ?? 0) });
  const canRegister = reg === 'ok' || reg === 'money';
  const registerButton = canRegister ? (
    <button className="btn primary small" disabled={reg === 'money'} onClick={register}>
      {reg === 'money' ? t('comp.noMoney') : t('comp.register', { fee: money(def?.fee ?? 0) })}
    </button>
  ) : null;
  const opp = nextTie ? teamById(game, nextTie.home === me ? nextTie.away : nextTie.home).name : undefined;
  const started = v.fixtures.some((f) => f.result);
  const favourite = v.winner ? undefined : [...v.alive].sort((a, b) => clubOf(game, b).reputation - clubOf(game, a).reputation)[0];
  const field = v.winner
    ? t('comp.status.over', { team: teamById(game, v.winner).name })
    : started
      ? t('comp.field', { alive: v.alive.length, n: v.entrants.length })
      : t('comp.fieldStart', { n: v.entrants.length });
  const favText = favourite ? t('comp.favourite', { team: teamById(game, favourite).name }) : '';
  const roundText = v.winner ? '' : t('comp.roundOf', { r: Math.min(v.round + 1, v.rounds), n: v.rounds });
  const nextRound = nextKey === undefined || v.winner ? '' : roundName(v.round);
  const nextWhen = nextKey === undefined || v.winner ? '' : nextKey < 1 ? t('cal.before') : t('cal.week', { d: Math.floor(nextKey) });
  return { name, status, nextText, desc, registerButton, note, opp, inIt, me, field, favText, roundText, nextRound, nextWhen };
}

/** One match of the season in a cell: competition icon, opponent, result or « next ». */
function SeasonCell({ game, x, next }: { game: GameState; x: SeasonItem; next: boolean }) {
  const { t } = useT();
  const opp = x.oppId ? teamById(game, x.oppId) : null;
  return (
    <div className={`sm def-${x.def} ${x.played ? x.outcome : x.maybe ? 'maybe' : 'todo'} ${next ? 'next' : ''}`} title={itemLabel(t, x)}>
      <span className="sm-comp">{x.league ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />}</span>
      {x.league ? null : <span className="sm-round">{t(roundKey(x.round ?? 0, x.rounds ?? 1))}</span>}
      {opp ? (
        <span className="sm-opp">
          <StableCrest team={opp} size={18} />
          <span className="ellipsis">{opp.name}</span>
        </span>
      ) : (
        <span className="sm-opp faint">{x.maybe ? t('cal.ifThrough') : t('cal.tbd')}</span>
      )}
      {x.played && x.score ? (
        <span className={`sm-res ${x.outcome}`}>
          {t(x.outcome === 'win' ? 'cal.w' : 'cal.l')} {x.score[0]}–{x.score[1]}
        </span>
      ) : next ? (
        <span className="sm-res next">{t('cal.next')}</span>
      ) : null}
    </div>
  );
}

/** The season: the matches coming next as a chain of cards, then every week (league | cups & tournaments). */
function Schedule({ game }: { game: GameState }) {
  const { t } = useT();
  const items = playerSeason(game);
  const weeks = new Map(byWeek(items).map((w) => [w.week, w.items]));
  const n = lastMatchday(game);
  const next = items.find((x) => !x.played && !x.maybe);
  const current = next ? next.week : n + 1;
  const coming = items.filter((x) => !x.played).slice(0, 5);
  const weekName = (w: number) => (w === 0 ? t('cal.before') : t('cal.week', { d: w }));
  const [full, setFull] = useState(false);
  return (
    <section className="panel schedule">
      <div className="panel-head">
        <h3 className="grow">{t('cal.title')}</h3>
      </div>
      {coming.length > 0 && (
        <ol className="chain">
          {coming.map((x, i) => {
            const opp = x.oppId ? teamById(game, x.oppId) : null;
            return (
              <li key={i} className={`chain-card def-${x.def} ${x === next ? 'next' : ''} ${x.maybe ? 'maybe' : ''}`}>
                <span className="chain-when">
                  {weekName(x.week)}
                  {x === next && <b>{t('cal.next')}</b>}
                </span>
                <span className="chain-comp">
                  {x.league ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />}
                  <span className="ellipsis">{itemLabel(t, x)}</span>
                </span>
                <span className="chain-opp">
                  {opp ? <StableCrest team={opp} size={34} /> : <span className="chain-unknown">?</span>}
                  <span className="ellipsis">{opp ? opp.name : x.maybe ? t('cal.ifThrough') : t('cal.tbd')}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <button className="link cal-toggle" aria-expanded={full} onClick={() => setFull((x) => !x)}>
        {t(full ? 'cal.hideFull' : 'cal.full')} {full ? '▴' : '▾'}
      </button>
      {full && <p className="muted cal-intro">{t('cal.intro')}</p>}
      {full && (
      <div className="season-table" role="table">
        <div className="st-row st-head" role="row">
          <span role="columnheader" />
          <span role="columnheader">{t('cal.matchday')}</span>
          <span role="columnheader">{t('cal.comp')}</span>
        </div>
        {Array.from({ length: n + 1 }, (_, w) => {
          const list = weeks.get(w) ?? [];
          const league = list.filter((x) => x.league);
          const comps = list.filter((x) => !x.league);
          const when = w < current ? 'past' : w === current ? 'now' : 'later';
          const two = list.filter((x) => !x.maybe).length > 1;
          return (
            <div key={w} className={`st-row ${when}`} role="row">
              <span className="st-week" role="cell">
                {w === 0 ? <small>{t('cal.before')}</small> : <b>{w}</b>}
                {two && when !== 'past' && <i title={t('cal.double')}>×2</i>}
              </span>
              <span className="st-cell" role="cell">
                {league.map((x, i) => (
                  <SeasonCell key={i} game={game} x={x} next={x === next} />
                ))}
              </span>
              <span className="st-cell" role="cell">
                {comps.map((x, i) => (
                  <SeasonCell key={i} game={game} x={x} next={x === next} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}

/** One tie of a knockout round: both stables with their score, the winner lit, the player's tie outlined. */
function BracketTie({ game, f }: { game: GameState; f: Fixture }) {
  const me = game.playerTeamId;
  const r = f.result;
  const sides = [f.home, f.away] as const;
  return (
    <div className={`bk-tie ${f.home === me || f.away === me ? 'mine' : ''} ${r ? 'played' : ''}`}>
      {sides.map((id, s) => {
        const team = teamById(game, id);
        return (
          <div key={id} className={`bk-team ${r ? (r.winner === s ? 'won' : 'lost') : ''} ${id === me ? 'me' : ''}`}>
            <StableCrest team={team} size={18} />
            <span className="ellipsis">{team.name}</span>
            <b>{r ? r.score[s] : ''}</b>
          </div>
        );
      })}
    </div>
  );
}

/** The knockout as a tree read left to right: one column per round, its ties spread along the height. */
function Bracket({ game, v }: { game: GameState; v: CompView }) {
  const { t } = useT();
  return (
    <div className="bk" style={{ ['--bk-cols' as string]: v.rounds }}>
      {Array.from({ length: v.rounds }, (_, r) => {
        const ties = v.fixtures.filter((f) => f.round === r);
        return (
          <div key={r} className={`bk-col ${r === v.round && !v.winner ? 'current' : ''} ${r < v.round || v.winner ? 'done' : ''}`}>
            <div className="bk-round">
              <b>{t(roundKey(r, v.rounds))}</b>
              <small>{(v.keys[r] ?? 0) < 1 ? t('comp.beforeFirst') : t('cup.after', { d: Math.floor(v.keys[r] ?? 0) })}</small>
            </div>
            <div className="bk-ties">
              {ties.length ? ties.map((f) => <BracketTie key={f.id} game={game} f={f} />) : <span className="bk-empty">{t('cup.notDrawn')}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Where the player stands in a competition (for grouping): still in, can register, or the rest. */
function compGroup(game: GameState, v: CompView): 'alive' | 'entry' | 'other' {
  const me = game.playerTeamId;
  if (!v.winner && v.entrants.includes(me) && v.alive.includes(me)) return 'alive';
  const reg = v.tournament ? registrationState(game, v.tournament) : null;
  if (!v.winner && (reg === 'ok' || reg === 'money' || reg === 'reputation')) return 'entry';
  return 'other';
}

/** A competition in the list: emblem, name, where it stands, status, trophy. */
function CompRow({ game, v, on, onPick }: { game: GameState; v: CompView; on: boolean; onPick: () => void }) {
  const c = useCompInfo(game, v);
  return (
    <button className={`cp-row def-${v.def} comp-${c.status.tone} ${on ? 'on' : ''}`} aria-pressed={on} onClick={onPick}>
      <span className="cp-row-icon">
        <CompIcon def={v.def} />
      </span>
      <span className="cp-row-name">
        <b>{c.name}</b>
        <small>{v.winner ? c.field : c.nextRound ? `${c.nextRound} · ${c.nextWhen}` : c.desc}</small>
      </span>
      <span className={`comp-chip ${c.status.tone}`}>{c.status.text}</span>
    </button>
  );
}

/** The chosen competition: banner in its colour, trophy, status, the player's next tie, registration, the tree. */
function CompDetail({ game, v }: { game: GameState; v: CompView }) {
  const { t, money } = useT();
  const c = useCompInfo(game, v);
  const tie = v.fixtures.find((f) => !f.result && f.round === v.round && (f.home === c.me || f.away === c.me));
  const oppId = tie ? (tie.home === c.me ? tie.away : tie.home) : undefined;
  return (
    <section className={`panel cp-detail def-${v.def}`}>
      <header className="cp-banner">
        <span className="cp-watermark" aria-hidden="true">
          <CompIcon def={v.def} />
        </span>
        <span className="cp-emblem" aria-hidden="true">
          <CompIcon def={v.def} />
        </span>
        <div className="cp-title">
          <h2>{c.name}</h2>
          <span className="muted">
            <Gold>{c.desc}</Gold>
          </span>
        </div>
        <div className="cp-trophy" title={t('comp.trophy', { prize: money(v.trophy) })}>
          <UiIcon name="honours" size="1.6em" />
          <span>
            <small>{t('comp.col.trophy')}</small>
            <b>
              <Money v={v.trophy} />
            </b>
          </span>
        </div>
      </header>
      <div className="cp-facts">
        <span className={`comp-chip ${c.status.tone}`}>{c.status.text}</span>
        {c.roundText && <span>{c.roundText}</span>}
        {c.nextText && <span className="muted">{c.nextText}</span>}
        <span className="muted">{c.field}</span>
        {c.favText && (
          <span className="muted" title={t('comp.favourite.title')}>
            {c.favText}
          </span>
        )}
        {v.def === 'champions' && !c.inIt && <span className="faint">{t('comp.req.champions')}</span>}
      </div>
      {(oppId || c.registerButton || c.note) && (
        <div className="cp-action">
          {oppId && (
            <div className="cp-next">
              <small>{t('comp.yourNext')}</small>
              <span className="cp-vs">
                <StableCrest team={teamById(game, c.me)} size={30} />
                <b>VS</b>
                <StableCrest team={teamById(game, oppId)} size={30} />
                <span className="ellipsis">{teamById(game, oppId).name}</span>
              </span>
              <span className="faint">
                {c.nextRound} · {c.nextWhen}
              </span>
            </div>
          )}
          {c.registerButton}
          {c.note && <span className="muted">{c.note}</span>}
        </div>
      )}
      {v.fixtures.length > 0 ? <Bracket game={game} v={v} /> : <p className="faint cp-nodraw">{t('cup.notDrawn')}</p>}
    </section>
  );
}

function Competitions({ game }: { game: GameState }) {
  const { t } = useT();
  const all = views(game);
  const myDiv = divisionOf(game, game.playerTeamId);
  const order = ['shadow', `division-${myDiv}`, 'champions', 'marches', 'argent', 'or', 'preseason'];
  const main = order.map((id) => all.find((v) => v.id === id)).filter((v): v is CompView => !!v);
  const rest = all.filter((v) => v.def === 'division' && v.id !== `division-${myDiv}`);
  const groups = (['alive', 'entry', 'other'] as const).map((g) => ({ g, items: main.filter((v) => compGroup(game, v) === g) })).filter((x) => x.items.length);
  const first = groups[0]?.items[0] ?? main[0];
  const [sel, setSel] = useState<string | undefined>(first?.id);
  const chosen = all.find((v) => v.id === sel) ?? first;
  return (
    <div className="stack">
      <Schedule game={game} />
      <div className="cp-layout">
        <nav className="panel cp-list" aria-label={t('league.tab.comps')}>
          {groups.map(({ g, items }) => (
            <div key={g} className={`cp-group cp-${g}`}>
              <h4 className="cp-group-head">
                {t(`comp.group.${g}` as StringKey)} <span className="faint">{items.length}</span>
              </h4>
              {items.map((v) => (
                <CompRow key={v.id} game={game} v={v} on={v.id === chosen?.id} onPick={() => setSel(v.id)} />
              ))}
            </div>
          ))}
          {rest.length > 0 && (
            <div className="cp-group">
              <h4 className="cp-group-head">{t('comp.otherDivisions')}</h4>
              {rest.map((v) => (
                <CompRow key={v.id} game={game} v={v} on={v.id === chosen?.id} onPick={() => setSel(v.id)} />
              ))}
            </div>
          )}
          <div className="cp-rep">
            <ReputationLine game={game} />
          </div>
          <p className="faint cp-intro">{t('comp.intro')}</p>
        </nav>
        {chosen && <CompDetail key={chosen.id} game={game} v={chosen} />}
      </div>
    </div>
  );
}

// ——— Honours ———

interface TrophyDef {
  key: string;
  icon: ReactNode;
  name: string;
  /** Seasons it was won. */
  seasons: number[];
  /** Colour class: a division's metal or a competition's colour. */
  cls: string;
}

function TrophyStand({ x }: { x: TrophyDef }) {
  const { t } = useT();
  const won = x.seasons.length > 0;
  return (
    <div className={`hn-trophy ${x.cls} ${won ? 'won' : ''}`} title={x.name}>
      <span className="hn-medal">
        <span className="hn-icon">{x.icon}</span>
        {won && <b className="hn-count">×{x.seasons.length}</b>}
      </span>
      <span className="hn-plinth" aria-hidden="true" />
      <span className="hn-name">{x.name}</span>
      <span className="hn-when">{won ? x.seasons.map((s) => t('honours.seasonShort', { s })).join(' · ') : t('honours.notYet')}</span>
    </div>
  );
}

function Honours({ game }: { game: GameState }) {
  const { t, ordinal } = useT();
  const career = game.career ?? [];
  const n = game.divisions.length;
  const seasonsOf = (def: string) =>
    career.filter((r) => (def === 'shadow' ? r.cupWon : (r.trophies ?? []).some((x) => (def === 'division' ? x.startsWith('division') : x === def)))).map((r) => r.season);
  const titleSeasons = (d: number) => career.filter((r) => r.division === d && r.position === 1).map((r) => r.season);
  // Lowest league first: the climb reads left to right, as on the Championship tab.
  const leagues: TrophyDef[] = Array.from({ length: n }, (_, i) => n - 1 - i).map((d) => ({
    key: `title-${d}`,
    icon: <DivIcon d={d} />,
    name: divName(t, d),
    seasons: titleSeasons(d),
    cls: `tier-${d}`,
  }));
  const cups: TrophyDef[] = [
    { key: 'shadow', icon: <CompIcon def="shadow" />, name: compName(t), seasons: seasonsOf('shadow'), cls: 'def-shadow' },
    { key: 'division', icon: <CompIcon def="division" />, name: t('honours.divisionCups'), seasons: seasonsOf('division'), cls: 'def-division' },
    { key: 'champions', icon: <CompIcon def="champions" />, name: compName(t, 'champions'), seasons: seasonsOf('champions'), cls: 'def-champions' },
  ];
  const tours: TrophyDef[] = (['preseason', 'marches', 'argent', 'or'] as const).map((d) => ({
    key: d,
    icon: <CompIcon def={d} />,
    name: compName(t, d),
    seasons: seasonsOf(d),
    cls: `def-${d}`,
  }));
  const all = [...leagues, ...cups, ...tours];
  const total = all.reduce((s, x) => s + x.seasons.length, 0);
  const titles = leagues.reduce((s, x) => s + x.seasons.length, 0);
  const rows = [...career].reverse();
  const promotions = career.filter((r, i) => i + 1 < career.length && career[i + 1]!.division < r.division).length + (career.length && divisionOf(game, game.playerTeamId) < career[career.length - 1]!.division ? 1 : 0);
  const best = career.length ? [...career].sort((a, b) => a.division - b.division || a.position - b.position)[0]! : null;
  const shelf = (title: StringKey, list: TrophyDef[]) => (
    <div className="hn-shelf">
      <h4 className="hn-shelf-title">{t(title)}</h4>
      <div className="hn-row">
        {list.map((x) => (
          <TrophyStand key={x.key} x={x} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="stack">
      <section className="panel hn-cabinet">
        <div className="panel-head">
          <h3 className="grow">{t('honours.title')}</h3>
          <span className="muted">
            {all.filter((x) => x.seasons.length).length} / {all.length}
          </span>
        </div>
        <div className="kpis hn-kpis">
          <div className="kpi">
            <span className="kpi-label">{t('honours.kpi.trophies')}</span>
            <b className="kpi-value gold-text">{total}</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('honours.kpi.titles')}</span>
            <b className="kpi-value">{titles}</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('honours.kpi.seasons')}</span>
            <b className="kpi-value">{career.length}</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('honours.kpi.promotions')}</span>
            <b className="kpi-value">{promotions}</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('honours.kpi.best')}</span>
            <b className="kpi-value">{best ? ordinal(best.position) : '—'}</b>
            {best && <span className="kpi-sub">{divName(t, best.division)}</span>}
          </div>
        </div>
        {total === 0 && <p className="muted hn-empty">{t('honours.empty')}</p>}
        <div className="hn-shelves">
          {shelf('honours.shelf.leagues', leagues)}
          {shelf('honours.shelf.cups', cups)}
          {shelf('honours.shelf.tournaments', tours)}
        </div>
      </section>
      <section className="panel">
        <h3>{t('honours.seasons')}</h3>
        {career.length === 0 ? (
          <p className="muted">{t('honours.noSeason')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data hn-table">
              <thead>
                <tr>
                  <th>{t('honours.season')}</th>
                  <th>{t('honours.division')}</th>
                  <th className="num">{t('honours.position')}</th>
                  <th />
                  <th className="num">{t('honours.points')}</th>
                  <th className="num">{t('honours.record')}</th>
                  <th>{t('honours.objective')}</th>
                  <th>{t('honours.trophies')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const nextDiv = i > 0 ? rows[i - 1]!.division : divisionOf(game, game.playerTeamId);
                  const move = nextDiv < r.division ? 'up' : nextDiv > r.division ? 'down' : '';
                  const cups = [...(r.cupWon ? ['shadow'] : []), ...(r.trophies ?? []).filter((x) => x !== 'shadow')];
                  return (
                    <tr key={r.season} className={r.position === 1 ? 'champ' : ''}>
                      <td>
                        <b>{t('honours.seasonShort', { s: r.season })}</b>
                        {r.teamName && r.teamId !== game.playerTeamId && <small className="faint"> · {r.teamName}</small>}
                      </td>
                      <td>
                        <span className={`hn-div tier-${r.division}`}>
                          <DivIcon d={r.division} /> {divName(t, r.division)}
                        </span>
                      </td>
                      <td className="num">
                        <b className="hn-pos">{ordinal(r.position)}</b>
                      </td>
                      <td>{move && <span className={`lg-chip ${move === 'up' ? 'good' : 'bad'}`}>{t(move === 'up' ? 'honours.up' : 'honours.down')}</span>}</td>
                      <td className="num">{r.points}</td>
                      <td className="num">{r.won !== undefined ? `${r.won}–${r.lost ?? 0}` : '—'}</td>
                      <td>{r.met === undefined ? <span className="faint">—</span> : r.met ? <span className="good-text">✓ {t('honours.met')}</span> : <span className="bad-text">✗ {t('honours.missed')}</span>}</td>
                      <td>
                        {r.position === 1 || cups.length ? (
                          <span className="trophy-row">
                            {r.position === 1 && <DivIcon d={r.division} />}
                            {cups.map((x, k) => (
                              <CompIcon key={k} def={x.startsWith('division') ? 'division' : x} />
                            ))}
                          </span>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function LeagueScreen() {
  const { t } = useT();
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState<'table' | 'comps' | 'honours'>(() => useGame.getState().leagueTab ?? 'table');
  const asked = useGame((s) => s.leagueTab);
  useEffect(() => {
    if (!asked) return;
    setTab(asked);
    useGame.setState({ leagueTab: null });
  }, [asked]);
  return (
    <div className="stack league">
      <section className="panel page-head">
        <h2 className="page-title">
          <UiIcon name="nav-league" /> {t('nav.league')}
        </h2>
        <span className="muted page-sub">
          {divName(t, playerDivision(game))} · {t('honours.season')} {game.season}
        </span>
        <nav className="page-tabs" role="tablist">
          {(
            [
              ['table', <DivIcon key="i" d={playerDivision(game)} />, t('league.tab.table')],
              ['comps', <UiIcon key="i" name="competitions" />, t('league.tab.comps')],
              ['honours', <UiIcon key="i" name="honours" />, t('league.tab.honours')],
            ] as const
          ).map(([id, icon, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`page-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              {icon} {label}
            </button>
          ))}
        </nav>
      </section>
      {tab === 'table' && <Championship game={game} />}
      {tab === 'comps' && <Competitions game={game} />}
      {tab === 'honours' && <Honours game={game} />}
    </div>
  );
}
