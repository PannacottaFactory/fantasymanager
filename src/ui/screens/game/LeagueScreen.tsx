/**
 * League: the pyramid of divisions (where you are, where you are going), the table of a division with zones and
 * movements, its fixtures; every competition of the season (status, prizes, registration, draw); the honours.
 */
import { StableCrest } from '../../components/TeamCrest.tsx';
import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { divisionFixtures, divisionOf } from '../../../engine/league/divisions.ts';
import { lastMatchday, playerDivision, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import { computeStandings } from '../../../engine/league/standings.ts';
import { registerTournament, registrationState, tournamentDef, tournamentPrize } from '../../../engine/league/tournaments.ts';
import type { Fixture, GameState, Tournament } from '../../../engine/league/types.ts';
import { compName, divName, roundKey } from '../../competitions.ts';
import { CompIcon, DivIcon, UiIcon } from '../../icons/Icon.tsx';
import { byWeek, itemLabel, playerSeason } from '../../season.ts';
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

// ——— The pyramid ———

function Pyramid({ game, selected, onSelect }: { game: GameState; selected: number; onSelect: (d: number) => void }) {
  const { t, ordinal, lang } = useT();
  const mine = playerDivision(game);
  const n = game.divisions.length;
  return (
    <section className="panel pyramid" data-tip="league-tabs">
      <h3>{t('league.climb')}</h3>
      <div className="pyr">
        {game.divisions.map((_, d) => {
          const table = d === mine ? standings(game, d) : [];
          const pos = table.findIndex((r) => r.teamId === game.playerTeamId) + 1;
          return (
            <button
              key={d}
              className={`pyr-tier tier-${d} ${d === selected ? 'on' : ''} ${d === mine ? 'mine' : ''}`}
              style={{ width: `${76 + (24 * d) / Math.max(1, n - 1)}%` }}
              onClick={() => onSelect(d)}
            >
              <span className="pyr-icon">
                <DivIcon d={d} />
              </span>
              <span className="pyr-name">
                <b>{divName(t, d)}</b>
                <small>
                  {t('div.short', { n: d + 1 })} · <span className="gold">{t('league.money', { x: String(DEFAULT_CONFIG.league.divisionMoney[d] ?? 1).replace('.', lang === 'fr' ? ',' : '.') })}</span>
                </small>
              </span>
              {d === mine && (
                <span className="pyr-you">
                  {t('league.you')}
                  {pos > 0 && table[pos - 1]!.played > 0 ? ` · ${ordinal(pos)}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ——— The division ———

function DivisionHero({ game, division }: { game: GameState; division: number }) {
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
    <section className={`panel div-hero tier-${division}`}>
      <div className="div-emblem">
        <DivIcon d={division} />
      </div>
      <div className="grow">
        <h2>{divName(t, division)}</h2>
        <div className="muted">{rules}</div>
        <div className="div-progress" title={t('league.progress', { d: md, n: lastMatchday(game) })}>
          <i style={{ width: `${(100 * md) / lastMatchday(game)}%` }} />
        </div>
        <div className="faint" style={{ fontSize: '0.786rem' }}>
          {t('league.progress', { d: md, n: lastMatchday(game) })}
        </div>
        {division === mineDiv && <ReputationLine game={game} />}
      </div>
      {division === mineDiv && me && (
        <div className="div-me">
          <b>{ordinal(pos)}</b>
          <span className="muted">{t('dash.points', { n: me.points })}</span>
          {lines.map((l, i) => (
            <span key={i} className={l.tone === 'good' ? 'good-text' : l.tone === 'bad' ? 'bad-text' : 'muted'}>
              {l.text}
            </span>
          ))}
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
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{t('league.standings')}</h3>
        <span className="spacer" />
        <span className="zone-chips">
          {division === 0 ? <span className="zone-chip champ">{t('league.zone.champion')}</span> : <span className="zone-chip up">{t('league.zone.up')}</span>}
          {division < last && <span className="zone-chip down">{t('league.zone.down')}</span>}
        </span>
      </div>
      <div className="table-wrap">
        <table className="data standings">
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
              const moved = prevPos(r.teamId) ? prevPos(r.teamId) - (i + 1) : 0;
              return (
                <tr key={r.teamId} className={`${r.teamId === game.playerTeamId ? 'mine' : ''} ${zone}`}>
                  <td className="num">
                    <span className="pos-badge">{i + 1}</span>
                  </td>
                  <td className={`moved ${moved > 0 ? 'good-text' : moved < 0 ? 'bad-text' : 'faint'}`}>{moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '·'}</td>
                  <td>
                    <span className="team-cell">
                      <StableCrest team={teamById(game, r.teamId)} size={18} /> {teamById(game, r.teamId).name}
                    </span>
                  </td>
                  <td className="num">{r.played}</td>
                  <td className="num">{r.koWins}</td>
                  <td className="num">{r.pointsWins}</td>
                  <td className="num">{r.pointsLosses}</td>
                  <td className="num">{r.koLosses}</td>
                  <td className="num">{diff > 0 ? `+${diff}` : diff}</td>
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
      <div className="muted" style={{ fontSize: '0.786rem', marginTop: 6 }}>
        {t('league.legend')}
      </div>
    </section>
  );
}

function FixtureRow({ game, f }: { game: GameState; f: Fixture }) {
  const { t } = useT();
  const mine = f.home === game.playerTeamId || f.away === game.playerTeamId;
  const r = f.result;
  const canReport = mine && r && game.lastMatch?.fixtureId === f.id;
  const cls = (side: 0 | 1) => (r ? (r.winner === side ? 'winner' : 'loser') : '');
  return (
    <tr className={mine ? 'mine' : ''}>
      <td className={`right ${cls(0)}`}>{teamById(game, f.home).name}</td>
      <td className="score">{r ? `${r.score[0]} – ${r.score[1]}` : <span className="faint">{t('league.upcoming')}</span>}</td>
      <td className={cls(1)}>{teamById(game, f.away).name}</td>
      <td className="faint" style={{ fontSize: '0.857rem' }}>
        {r ? (r.method === 'ko' ? t('league.koRound', { n: r.rounds }) : t('league.pts')) : ''}
      </td>
      <td>
        {canReport && (
          <button className="btn small" onClick={() => useGame.getState().viewReport(game.lastMatch!.result)}>
            {t('league.viewReport')}
          </button>
        )}
      </td>
    </tr>
  );
}

function Fixtures({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const last = lastMatchday(game);
  const current = seasonOver(game) ? last : Math.max(1, Math.min(last, game.matchday));
  const [day, setDay] = useState(current);
  const list = game.fixtures.filter((f) => !f.competition && (f.division ?? 0) === division && f.matchday === day);
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{t('league.fixtures')}</h3>
        <span className="spacer" />
        <button className="btn small" disabled={day <= 1} onClick={() => setDay(day - 1)} aria-label="‹">
          ‹
        </button>
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label={t('league.matchday', { d: day })}>
          {Array.from({ length: last }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {t('league.matchday', { d })}
            </option>
          ))}
        </select>
        <button className="btn small" disabled={day >= last} onClick={() => setDay(day + 1)} aria-label="›">
          ›
        </button>
      </div>
      <table className="data fixtures">
        <tbody>
          {list.map((f) => (
            <FixtureRow key={f.id} game={game} f={f} />
          ))}
        </tbody>
      </table>
    </section>
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

function Bracket({ game, v }: { game: GameState; v: CompView }) {
  const { t } = useT();
  return (
    <div className="cup-rounds">
      {Array.from({ length: v.rounds }, (_, r) => {
        const ties = v.fixtures.filter((f) => f.round === r);
        return (
          <div key={r} className={`cup-round ${r === v.round ? 'current' : ''}`}>
            <h4>{t(roundKey(r, v.rounds))}</h4>
            <div className="faint" style={{ fontSize: '0.786rem', marginBottom: 4 }}>
              {(v.keys[r] ?? 0) < 1 ? t('comp.beforeFirst') : t('cup.after', { d: Math.floor(v.keys[r] ?? 0) })}
            </div>
            {ties.length === 0 && <div className="faint">{t('cup.notDrawn')}</div>}
            <table className="data fixtures">
              <tbody>
                {ties.map((f) => (
                  <FixtureRow key={f.id} game={game} f={f} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function CompCard({ game, v }: { game: GameState; v: CompView }) {
  const { t, money } = useT();
  const [open, setOpen] = useState(false);
  const c = useCompInfo(game, v);
  return (
    <section className={`panel comp-card comp-${c.status.tone} def-${v.def}`}>
      <div className="comp-head">
        <span className="comp-icon">
          <CompIcon def={v.def} />
        </span>
        <div className="grow">
          <h3>{c.name}</h3>
          <div className="muted" style={{ fontSize: '0.857rem' }}>
            <Gold>{c.desc}</Gold>
          </div>
        </div>
        <span className="comp-trophy" title={t('comp.trophy', { prize: money(v.trophy) })}>
          <Gold>{money(v.trophy)}</Gold>
        </span>
      </div>
      <div className="comp-status">
        <span className={`comp-chip ${c.status.tone}`}>{c.status.text}</span>
        {v.winner && v.winner !== c.me && <span className="muted">{t('comp.status.over', { team: teamById(game, v.winner).name })}</span>}
        {c.nextText && <span className="muted">{c.nextText}</span>}
        {c.opp && <span>{t('comp.yourMatch', { opp: c.opp })}</span>}
        {!v.winner && <span className="muted">{c.field}</span>}
        {c.favText && <span className="muted" title={t('comp.favourite.title')}>{c.favText}</span>}
        {v.def === 'champions' && !c.inIt && <span className="faint">{t('comp.req.champions')}</span>}
      </div>
      {c.registerButton && (
        <div className="row" style={{ gap: 8 }}>
          {c.registerButton}
        </div>
      )}
      {c.note && <div className="muted">{c.note}</div>}
      {v.fixtures.length > 0 && (
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((x) => !x)}>
          {open ? t('comp.hideBracket') : t('comp.bracket')}
        </button>
      )}
      {open && <Bracket game={game} v={v} />}
    </section>
  );
}

function CompRow({ game, v }: { game: GameState; v: CompView }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const c = useCompInfo(game, v);
  return (
    <>
      <tr className={`comp-row comp-${c.status.tone} def-${v.def}`}>
        <td>
          <span className="comp-row-name">
            <span className="comp-icon-sm">
              <CompIcon def={v.def} />
            </span>
            <b>{c.name}</b>
          </span>
          <span className="comp-row-desc faint">
            <Gold>{c.desc}</Gold>
          </span>
        </td>
        <td>
          <span className={`comp-chip ${c.status.tone}`}>{c.status.text}</span>
          {v.def === 'champions' && !c.inIt && <span className="faint comp-req">{t('comp.req.champions')}</span>}
        </td>
        <td>
          {v.winner ? (
            <b className="gold">{c.field}</b>
          ) : (
            <>
              <span>{c.field}</span>
              {c.favText && (
                <span className="comp-sub faint" title={t('comp.favourite.title')}>
                  {c.favText}
                </span>
              )}
            </>
          )}
        </td>
        <td>
          {c.nextRound ? (
            <>
              <span>{c.nextRound}</span>
              <span className="comp-sub faint">
                {c.nextWhen} · {c.roundText}
              </span>
            </>
          ) : (
            <span className="faint">—</span>
          )}
        </td>
        <td>{c.opp ?? <span className="faint">—</span>}</td>
        <td className="num">
          <Money v={v.trophy} />
        </td>
        <td className="right">
          <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            {c.registerButton}
            {v.fixtures.length > 0 && (
              <button className="link" onClick={() => setOpen((x) => !x)}>
                {open ? t('comp.hideBracket') : t('comp.bracket')}
              </button>
            )}
          </span>
          {c.note && (
            <div className="muted" style={{ fontSize: '0.786rem' }}>
              {c.note}
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr className="comp-row-bracket">
          <td colSpan={7}>
            <Bracket game={game} v={v} />
          </td>
        </tr>
      )}
    </>
  );
}

function CompTable({ game, list }: { game: GameState; list: CompView[] }) {
  const { t } = useT();
  return (
    <section className="panel">
      <div className="table-wrap">
        <table className="data comp-list">
          <thead>
            <tr>
              <th>{t('comp.col.name')}</th>
              <th>{t('comp.col.status')}</th>
              <th>{t('comp.col.field')}</th>
              <th>{t('comp.col.next')}</th>
              <th>{t('comp.col.match')}</th>
              <th className="num">{t('comp.col.trophy')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <CompRow key={v.id} game={game} v={v} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The season as a calendar: a tile per week, results of the past weeks, opponents of the coming ones. */
function Schedule({ game }: { game: GameState }) {
  const { t } = useT();
  const items = playerSeason(game);
  const weeks = new Map(byWeek(items).map((w) => [w.week, w.items]));
  const n = lastMatchday(game);
  const next = items.find((x) => !x.played && !x.maybe);
  const current = next ? next.week : n + 1;
  return (
    <section className="panel schedule">
      <div className="panel-head">
        <h3>{t('cal.title')}</h3>
        <span className="spacer" />
        <span className="cal-legend faint">
          <i className="cal-dot win" /> {t('recap.win')} <i className="cal-dot loss" /> {t('recap.loss')} <i className="cal-dot todo" /> {t('ribbon.toPlay')}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.857rem' }}>
        {t('cal.intro')}
      </p>
      <div className="cal-grid">
        {Array.from({ length: n + 1 }, (_, w) => {
          const list = weeks.get(w) ?? [];
          const when = w < current ? 'past' : w === current ? 'now' : 'later';
          return (
            <div key={w} className={`cal-tile ${when} ${list.length > 1 ? 'double' : ''}`}>
              <div className="cal-tile-head">
                <b>{w === 0 ? t('cal.before') : t('cal.week', { d: w })}</b>
                {when === 'now' && <span className="cal-now">{t('cal.thisWeek')}</span>}
                {list.length > 1 && when !== 'past' && <span className="cal-double">{t('cal.double')}</span>}
              </div>
              {list.length === 0 && <div className="faint cal-empty">—</div>}
              {list.map((x, i) => {
                const opp = x.oppId ? teamById(game, x.oppId) : null;
                return (
                  <div
                    key={i}
                    className={`cal-chip def-${x.def} ${x.played ? x.outcome : x.maybe ? 'maybe' : 'todo'} ${x === next ? 'next' : ''}`}
                    title={`${itemLabel(t, x)}${x.opp ? ` · ${t('common.vs')} ${x.opp}` : ''}`}
                  >
                    <span className="cal-chip-comp">
                      {x.league ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />}
                      <small>{x.league ? t('cal.league') : itemLabel(t, x)}</small>
                    </span>
                    <span className="cal-chip-opp">
                      {opp ? (
                        <>
                          <StableCrest team={opp} size={16} /> <span className="ellipsis">{opp.name}</span>
                        </>
                      ) : (
                        <span className="faint">{x.maybe ? t('cal.ifThrough') : t('cal.tbd')}</span>
                      )}
                    </span>
                    {x.played && x.score ? (
                      <span className={`cal-res ${x.outcome}`}>
                        {t(x.outcome === 'win' ? 'cal.w' : 'cal.l')} {x.score[0]}–{x.score[1]}
                      </span>
                    ) : x === next ? (
                      <span className="cal-res next">{t('cal.next')}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type CompLayout = 'cards' | 'list';
const COMP_VIEW_KEY = 'fm.compView';
const readCompView = (): CompLayout => {
  try {
    return localStorage.getItem(COMP_VIEW_KEY) === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
};

function Competitions({ game }: { game: GameState }) {
  const { t } = useT();
  const [others, setOthers] = useState(false);
  const [view, setViewState] = useState<CompLayout>(readCompView);
  const setView = (v: CompLayout) => {
    setViewState(v);
    try {
      localStorage.setItem(COMP_VIEW_KEY, v);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const all = views(game);
  const myDiv = divisionOf(game, game.playerTeamId);
  const order = ['shadow', `division-${myDiv}`, 'champions', 'marches', 'argent', 'or', 'preseason'];
  const main = order.map((id) => all.find((v) => v.id === id)).filter((v): v is CompView => !!v);
  const rest = all.filter((v) => v.def === 'division' && v.id !== `division-${myDiv}`);
  const block = (list: CompView[]) =>
    view === 'list' ? (
      <CompTable game={game} list={list} />
    ) : (
      <div className="comp-grid">
        {list.map((v) => (
          <CompCard key={v.id} game={game} v={v} />
        ))}
      </div>
    );
  return (
    <div className="stack">
      <Schedule game={game} />
      <section className="panel rep-panel">
        <ReputationLine game={game} />
      </section>
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <p className="muted grow" style={{ margin: 0 }}>
          {t('comp.intro')}
        </p>
        <Seg
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: `☰ ${t('comp.view.list')}` },
            { value: 'cards', label: `▦ ${t('comp.view.cards')}` },
          ]}
        />
      </div>
      {block(main)}
      {rest.length > 0 && (
        <>
          <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setOthers((x) => !x)}>
            {t('comp.otherDivisions')} {others ? '▴' : '▾'}
          </button>
          {others && block(rest)}
        </>
      )}
    </div>
  );
}

// ——— Honours ———

function Honours({ game }: { game: GameState }) {
  const { t, ordinal } = useT();
  const career = game.career ?? [];
  const n = game.divisions.length;
  const count = (def: string) => career.filter((r) => (def === 'shadow' ? r.cupWon : r.trophies?.includes(def))).length;
  const titles = (d: number) => career.filter((r) => r.division === d && r.position === 1).length;
  const tiles: { key: string; icon: ReactNode; name: string; n: number }[] = [
    ...Array.from({ length: n }, (_, d) => ({ key: `title-${d}`, icon: <DivIcon d={d} />, name: `${t('honours.league')} — ${divName(t, d)}`, n: titles(d) })),
    { key: 'shadow', icon: <CompIcon def="shadow" />, name: compName(t), n: count('shadow') },
    { key: 'champions', icon: <CompIcon def="champions" />, name: compName(t, 'champions'), n: count('champions') },
    { key: 'division', icon: <CompIcon def="division" />, name: t('honours.divisionCups'), n: count('division') },
    { key: 'or', icon: <CompIcon def="or" />, name: compName(t, 'or'), n: count('or') },
    { key: 'argent', icon: <CompIcon def="argent" />, name: compName(t, 'argent'), n: count('argent') },
    { key: 'marches', icon: <CompIcon def="marches" />, name: compName(t, 'marches'), n: count('marches') },
    { key: 'preseason', icon: <CompIcon def="preseason" />, name: compName(t, 'preseason'), n: count('preseason') },
  ];
  const any = tiles.some((x) => x.n > 0);
  return (
    <div className="stack">
      <section className="panel">
        <h3>{t('honours.title')}</h3>
        {!any && <p className="muted">{t('honours.empty')}</p>}
        <div className="trophy-grid">
          {tiles.map((x) => (
            <div key={x.key} className={`trophy-tile ${x.n ? 'won' : ''}`} title={x.name}>
              <span className="trophy-icon">{x.icon}</span>
              <span className="trophy-name">{x.name}</span>
              <b className="trophy-n">{x.n ? `×${x.n}` : '—'}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h3>{t('honours.seasons')}</h3>
        {career.length === 0 ? (
          <p className="muted">{t('honours.noSeason')}</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t('honours.season')}</th>
                <th>{t('honours.division')}</th>
                <th className="num">{t('honours.position')}</th>
                <th className="num">{t('honours.points')}</th>
                <th>{t('honours.trophies')}</th>
              </tr>
            </thead>
            <tbody>
              {[...career].reverse().map((r, i, list) => {
                const nextDiv = i > 0 ? list[i - 1]!.division : divisionOf(game, game.playerTeamId);
                const move = nextDiv < r.division ? '▲' : nextDiv > r.division ? '▼' : '';
                return (
                  <tr key={r.season}>
                    <td>{r.season}</td>
                    <td>
                      <DivIcon d={r.division} /> {divName(t, r.division)}
                    </td>
                    <td className="num">
                      {ordinal(r.position)} <span className={move === '▲' ? 'good-text' : 'bad-text'}>{move}</span>
                    </td>
                    <td className="num">{r.points}</td>
                    <td>
                      {r.position === 1 || r.cupWon || (r.trophies ?? []).length ? (
                        <span className="trophy-row">
                          {r.position === 1 && <DivIcon d={r.division} />}
                          {r.cupWon && <CompIcon def="shadow" />}
                          {(r.trophies ?? [])
                            .filter((x) => x !== 'shadow')
                            .map((x, k) => (
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
  const [division, setDivision] = useState(playerDivision(game));
  return (
    <div className="stack">
      <div style={{ alignSelf: 'start' }}>
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: 'table', label: <span className="tab-label"><DivIcon d={playerDivision(game)} /> {t('league.tab.table')}</span> },
            { value: 'comps', label: <span className="tab-label"><UiIcon name="competitions" /> {t('league.tab.comps')}</span> },
            { value: 'honours', label: <span className="tab-label"><UiIcon name="honours" /> {t('league.tab.honours')}</span> },
          ]}
        />
      </div>
      {tab === 'table' && (
        <div className="league-layout">
          <div className="stack">
            <Pyramid game={game} selected={division} onSelect={setDivision} />
          </div>
          <div className="stack">
            <DivisionHero game={game} division={division} />
            <div className="league-grid">
              <Standings game={game} division={division} />
              <Fixtures key={division} game={game} division={division} />
            </div>
          </div>
        </div>
      )}
      {tab === 'comps' && <Competitions game={game} />}
      {tab === 'honours' && <Honours game={game} />}
    </div>
  );
}
