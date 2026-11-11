import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { lastMatchday, playerDivision, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { Fixture, GameState } from '../../../engine/league/types.ts';
import { Seg, Gold } from '../../components/common.tsx';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

const FORM_KEY: Record<string, StringKey> = { W: 'form.W', w: 'form.w', l: 'form.l', L: 'form.L' };

/** Name of a cup round, counted from the final. */
export function cupRoundKey(round: number, rounds: number): StringKey {
  const fromFinal = rounds - 1 - round;
  return (['cup.final', 'cup.semi', 'cup.quarter', 'cup.r16'] as const)[fromFinal] ?? 'cup.prelim';
}

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

function Standings({ game, division }: { game: GameState; division: number }) {
  const { t } = useT();
  const rows = standings(game, division);
  const n = rows.length;
  const promoted = DEFAULT_CONFIG.league.promoted;
  const last = game.divisions.length - 1;
  return (
    <section className="panel">
      <h2 style={{ marginBottom: 8 }}>
        {t('league.standings')} — {t('league.division', { n: division + 1 })}
      </h2>
      <div className="table-wrap">
        <table className="data standings">
          <thead>
            <tr>
              <th className="num">{t('col.pos')}</th>
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
              <th className="num" title={t('col.kosFor.title')}>
                {t('col.kosFor')}
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
              const zone = up || (division === 0 && i === 0) ? 'top' : down ? 'bottom' : '';
              return (
                <tr key={r.teamId} className={`${r.teamId === game.playerTeamId ? 'mine' : ''} ${zone}`}>
                  <td className="num">{i + 1}</td>
                  <td>{teamById(game, r.teamId).name}</td>
                  <td className="num">{r.played}</td>
                  <td className="num">{r.koWins}</td>
                  <td className="num">{r.pointsWins}</td>
                  <td className="num">{r.pointsLosses}</td>
                  <td className="num">{r.koLosses}</td>
                  <td className="num">{diff > 0 ? `+${diff}` : diff}</td>
                  <td className="num">{r.kosFor}</td>
                  <td>
                    <FormDots form={r.form} />
                  </td>
                  <td className="num">
                    <b>{r.points}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: '0.857rem', marginTop: 6 }}>
        {t('league.legend')} {t('league.zones')}
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
  const current = seasonOver(game) ? last : Math.max(1, game.matchday - 1 || 1);
  const [day, setDay] = useState(current);
  const list = game.fixtures.filter((f) => f.competition !== 'cup' && (f.division ?? 0) === division && f.matchday === day);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('league.fixtures')}</h2>
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

function Cup({ game }: { game: GameState }) {
  const tr = useT();
  const { t, money } = tr;
  const c = DEFAULT_CONFIG.league.cup;
  const rounds = game.cup.rounds || c.after.length;
  return (
    <section className="panel" style={{ gridColumn: '1 / -1' }}>
      <div className="panel-head">
        <h2>🏆 {t('cup.title')}</h2>
        <span className="spacer" />
        {game.cup.winner && <b className="good-text">{t('cup.winner', { team: teamById(game, game.cup.winner).name })}</b>}
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('cup.intro', { days: c.after.join(', '), byes: c.byes })}
      </p>
      <div className="cup-rounds">
        {Array.from({ length: rounds }, (_, r) => {
          const ties = game.fixtures.filter((f) => f.competition === 'cup' && f.round === r);
          return (
            <div key={r} className={`cup-round ${r === game.cup.round ? 'current' : ''}`}>
              <h4>{t(cupRoundKey(r, rounds))}</h4>
              <div className="faint" style={{ fontSize: '0.857rem', marginBottom: 6 }}>
                <Gold>{t('cup.after', { d: c.after[r] ?? '?' })} · {t('cup.prize', { prize: money(c.prize[r] ?? 0) })}</Gold>
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
    </section>
  );
}

export function LeagueScreen() {
  const { t } = useT();
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState<string>(String(playerDivision(game)));
  return (
    <div className="stack">
      <div data-tip="league-tabs" style={{ alignSelf: 'start' }}>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          ...game.divisions.map((_, d) => ({ value: String(d), label: t('league.division', { n: d + 1 }) })),
          { value: 'cup', label: `🏆 ${t('league.tab.cup')}` },
        ]}
      />
      </div>
      {tab === 'cup' ? (
        <Cup game={game} />
      ) : (
        <div className="league-grid">
          <Standings game={game} division={Number(tab)} />
          <Fixtures key={tab} game={game} division={Number(tab)} />
        </div>
      )}
    </div>
  );
}
