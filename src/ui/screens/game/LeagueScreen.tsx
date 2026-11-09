import { useState } from 'react';
import { lastMatchday, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { Fixture, GameState } from '../../../engine/league/types.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

const FORM_KEY: Record<string, StringKey> = { W: 'form.W', w: 'form.w', l: 'form.l', L: 'form.L' };

function FormDots({ form }: { form: string[] }) {
  const { t } = useT();
  return (
    <span className="form-dots">
      {form.slice(-5).map((f, i) => (
        <i key={i} className={`f-${f === 'W' ? 'kw' : f === 'w' ? 'pw' : f === 'l' ? 'pl' : 'kl'}`} title={t(FORM_KEY[f]!)} />
      ))}
    </span>
  );
}

function Standings({ game }: { game: GameState }) {
  const { t } = useT();
  const rows = standings(game);
  const n = rows.length;
  return (
    <section className="panel">
      <h2 style={{ marginBottom: 8 }}>{t('league.standings')}</h2>
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
              const zone = i === 0 ? 'top' : i === n - 1 ? 'bottom' : '';
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
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
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
      <td className="faint" style={{ fontSize: 12 }}>
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

function Fixtures({ game }: { game: GameState }) {
  const { t } = useT();
  const last = lastMatchday(game);
  const current = seasonOver(game) ? last : Math.max(1, game.matchday - 1 || 1);
  const [day, setDay] = useState(current);
  const list = game.fixtures.filter((f) => f.matchday === day);
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

export function LeagueScreen() {
  const game = useGame((s) => s.game)!;
  return (
    <div className="league-grid">
      <Standings game={game} />
      <Fixtures game={game} />
    </div>
  );
}
