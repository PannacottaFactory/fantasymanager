import { StableCrest } from '../../components/TeamCrest.tsx';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { compDef, compName, divName, roundKey } from '../../competitions.ts';
import { CompIcon, DivIcon } from '../../icons/Icon.tsx';
import { isInjured } from '../../../engine/creature/derived.ts';
import { aiPrepare, lastMatchday, playerPrepare, playerTeam, teamById } from '../../../engine/league/season.ts';
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
import { RoleLabel, UiIcon } from '../../icons/Icon.tsx';
import { Versus } from './Versus.tsx';
import { arenaActive, arenaFor } from '../../../engine/league/arena.ts';

function LineupCard({ team, title, side }: { team: Team; title: string; side: 0 | 1 }) {
  const { t } = useT();
  const byId = new Map(team.creatures.map((c) => [c.id, c]));
  return (
    <section className={`panel ${side === 0 ? 'side-home' : 'side-away'}`}>
      <h3 className={`row lineup-head ${side === 0 ? 'home-text' : 'away-text'}`}>
        <StableCrest team={team} size={22} /> <span className="ellipsis">{team.name}</span>
        <small className="faint">{title}</small>
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
  const opp = aiPrepare(teamById(game, home ? f.away : f.home), undefined, game.difficulty ?? 'normal', playerPrepare(mine));
  const title =
    f.competition
      ? t('match.cup', { comp: compName(t, f.tournamentId), round: t(roundKey(f.round ?? 0, f.tournamentId ? (game.tournaments.find((x) => x.id === f.tournamentId)?.rounds ?? 1) : game.cup.rounds)) })
      : `${divName(t, f.division ?? 0)} · ${t('match.matchday', { d: match.matchday, n: lastMatchday(game) })}`;
  const issues = validateTactic(mine, DEFAULT_CONFIG, true);

  return (
    <div className="stack">
      <Versus
        game={game}
        mine={mine}
        opp={opp}
        home={home}
        arena={arenaFor(game, f)}
        showArena={arenaActive(game, f.matchday)}
        title={
          <span className={`comp-badge big def-${f.competition ? compDef(f.tournamentId) : 'league'}`}>
            {f.competition ? <CompIcon def={compDef(f.tournamentId)} /> : <DivIcon d={f.division ?? 0} />} {title}
          </span>
        }
      />
      {issues.length > 0 && (
        <div className="remark bad">
          <span className="ico">!</span>
          <span className="grow">
            {t('match.problems')} {issues.map((i) => issueText(tr, mine, i)).join(' ')}
          </span>
          <button className="btn small" onClick={repair}>
            {t('match.fix')}
          </button>
        </div>
      )}
      <section className="match-cta" data-tip="prematch">
        <button className="cta-tactics" onClick={() => setScreen('tactics')}>
          <span className="cta-tactics-icon"><UiIcon name="nav-tactics" size="1.2em" /></span>
          <span className="cta-text">
            <b>{t('match.editTactics')}</b>
            <small>{t('match.editTacticsSub')}</small>
          </span>
        </button>
        <button className="cta-live" disabled={issues.length > 0} onClick={playLive}>
          <span className="cta-icon"><UiIcon name="versus" size="1.3em" /></span>
          <span className="cta-text">
            <b>{t('match.playLive').replace(' ⚔', '')}</b>
            <small>{t('match.liveSub')}</small>
          </span>
        </button>
        <button className="cta-sim" disabled={issues.length > 0} onClick={simulate}>
          <b><UiIcon name="simulate" /> {t('match.simulate')}</b>
          <small>{t('match.simulateSub')}</small>
        </button>
        <label className="manage-breaks">
          <input type="checkbox" checked={playerControls} onChange={(e) => setPlayerControls(e.target.checked)} />
          {t('match.manageBreaks')}
        </label>
      </section>
      <div className="two-cols prematch-lineups">
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
