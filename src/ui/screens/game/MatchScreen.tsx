import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { cupRoundKey } from './LeagueScreen.tsx';
import { isInjured } from '../../../engine/creature/derived.ts';
import { aiPrepare, lastMatchday, playerTeam, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Team } from '../../../engine/model.ts';
import { validateTactic } from '../../../engine/team/team.ts';
import { Bar, Crest } from '../../components/common.tsx';
import { issueText } from '../../components/TeamEditor.tsx';
import { fatigueColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { useGame, type MatchFlow } from '../../store/gameStore.ts';
import { LiveMatch } from '../arena/LiveMatch.tsx';
import { ReportView } from '../arena/ReportView.tsx';
import { RoleLabel } from '../../icons/Icon.tsx';

function LineupCard({ team, title, side }: { team: Team; title: string; side: 0 | 1 }) {
  const { t } = useT();
  const byId = new Map(team.creatures.map((c) => [c.id, c]));
  return (
    <section className={`panel ${side === 0 ? 'side-home' : 'side-away'}`}>
      <h4 style={{ marginBottom: 4 }}>{title}</h4>
      <h3 className={side === 0 ? 'home-text' : 'away-text'} style={{ marginBottom: 8 }}>
        {team.name}
      </h3>
      <div className="lineup">
        {team.tactic.lineup.map((s) => {
          const c = byId.get(s.creatureId);
          if (!c) return null;
          return (
            <div key={c.id} className={`lineup-row ${isInjured(c) ? 'bad-text' : ''}`}>
              <Crest speciesId={c.speciesId} name={c.name} />
              <span className="grow ellipsis">{c.name}</span>
              <span className="tag">
                <RoleLabel role={s.role} short />
              </span>
              <span className="tag">{s.line === 'front' ? t('tag.front') : t('tag.back')}</span>
              <span style={{ width: 44 }} title={`${t('col.fatigue')} ${c.condition.fatigue}`}>
                <Bar value={c.condition.fatigue} max={100} color={fatigueColor(c.condition.fatigue)} thin />
              </span>
            </div>
          );
        })}
        {team.tactic.bench.map((id) => {
          const c = byId.get(id);
          if (!c) return null;
          return (
            <div key={id} className="lineup-row dim">
              <Crest speciesId={c.speciesId} name={c.name} />
              <span className="grow ellipsis">{c.name}</span>
              <span className="tag">{t('tag.bench')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreMatch({ game, match }: { game: GameState; match: MatchFlow }) {
  const tr = useT();
  const { t } = tr;
  const { playLive, simulate, setScreen, repair, setPlayerControls } = useGame.getState();
  const playerControls = useGame((s) => s.playerControls);
  const f = game.fixtures.find((x) => x.id === match.fixtureId)!;
  const mine = playerTeam(game);
  const home = f.home === game.playerTeamId;
  const opp = aiPrepare(teamById(game, home ? f.away : f.home));
  const oppTable = standings(game, divisionOf(game, opp.id));
  const posOf = (id: string) => oppTable.findIndex((r) => r.teamId === id) + 1;
  const title =
    f.competition === 'cup'
      ? t('match.cup', { round: t(cupRoundKey(f.round ?? 0, game.cup.rounds)) })
      : `${t('league.division', { n: (f.division ?? 0) + 1 })} · ${t('match.matchday', { d: match.matchday, n: lastMatchday(game) })}`;
  const issues = validateTactic(mine, DEFAULT_CONFIG, true);

  return (
    <div className="stack">
      <section className="panel">
        <div className="matchbar">
          <div>
            <h4>{title}</h4>
            <h2>
              <span className="home-text">{mine.name}</span> <span className="muted">{t('common.vs')}</span> <span className="away-text">{opp.name}</span>
            </h2>
            <div className="muted" style={{ fontSize: '0.857rem' }}>
              {home ? t('common.home') : t('common.away')} · {t('league.division', { n: divisionOf(game, opp.id) + 1 })} · {t('match.position', { pos: tr.ordinal(posOf(opp.id)), pts: oppTable[posOf(opp.id) - 1]?.points ?? 0 })}
            </div>
          </div>
          <span className="spacer" />
          <label className="row" style={{ fontSize: '0.929rem' }}>
            <input type="checkbox" checked={playerControls} onChange={(e) => setPlayerControls(e.target.checked)} />
            {t('match.manageBreaks')}
          </label>
          <button className="btn" onClick={() => setScreen('tactics')}>
            {t('match.editTactics')}
          </button>
          <button data-tip="prematch" className="btn" disabled={issues.length > 0} onClick={simulate}>
            {t('match.simulate')}
          </button>
          <button className="btn primary" disabled={issues.length > 0} onClick={playLive} style={{ padding: '8px 22px' }}>
            {t('match.playLive')}
          </button>
        </div>
        {issues.length > 0 && (
          <div className="remark bad" style={{ marginTop: 10 }}>
            <span className="ico">!</span>
            <span className="grow">
              {t('match.problems')} {issues.map((i) => issueText(tr, mine, i)).join(' ')}
            </span>
            <button className="btn small" onClick={repair}>
              {t('match.fix')}
            </button>
          </div>
        )}
      </section>
      <div className="two-cols">
        <LineupCard team={mine} title={t('match.lineup')} side={0} />
        <LineupCard team={opp} title={t('match.opponent')} side={1} />
      </div>
    </div>
  );
}

function DayResults({ game, matchday, fixtureId }: { game: GameState; matchday: number; fixtureId: string }) {
  const { t } = useT();
  const mine = game.fixtures.find((f) => f.id === fixtureId);
  const list = game.fixtures.filter(
    (f) =>
      f.result &&
      (mine?.competition === 'cup'
        ? f.competition === 'cup' && f.round === mine.round
        : f.competition !== 'cup' && f.matchday === matchday && (f.division ?? 0) === (mine?.division ?? 0)),
  );
  return (
    <section className="panel">
      <h3 style={{ marginBottom: 8 }}>{t('match.dayResults', { d: matchday })}</h3>
      <table className="data fixtures">
        <tbody>
          {list.map((f) => {
            const r = f.result!;
            const mine = f.home === game.playerTeamId || f.away === game.playerTeamId;
            return (
              <tr key={f.id} className={mine ? 'mine' : ''}>
                <td className={`right ${r.winner === 0 ? 'winner' : 'loser'}`}>{teamById(game, f.home).name}</td>
                <td className="score">
                  {r.score[0]} – {r.score[1]}
                </td>
                <td className={r.winner === 1 ? 'winner' : 'loser'}>{teamById(game, f.away).name}</td>
                <td className="faint" style={{ fontSize: '0.857rem' }}>
                  {r.method === 'ko' ? t('league.koRound', { n: r.rounds }) : t('league.pts')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function MatchScreen() {
  const { t } = useT();
  const game = useGame((s) => s.game)!;
  const match = useGame((s) => s.match);
  const playerControls = useGame((s) => s.playerControls);
  const { finishLive, closeMatch } = useGame.getState();
  if (!match) return null;
  if (match.phase === 'pre') return <PreMatch game={game} match={match} />;
  if (match.phase === 'live' && match.setup) return <LiveMatch key={match.liveKey} setup={match.setup} playerControls={playerControls} onFinish={finishLive} />;
  if (match.phase === 'report' && match.result)
    return (
      <div className="stack">
        <ReportView
          result={match.result}
          actions={
            <button className="btn primary" onClick={closeMatch}>
              {t('match.continue')}
            </button>
          }
        />
        <DayResults game={game} matchday={match.matchday} fixtureId={match.fixtureId} />
      </div>
    );
  return null;
}
