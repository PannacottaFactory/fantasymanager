/**
 * Dashboard banner of the next match (manager-game style): both stables face to face with their position and form,
 * the last meeting, then three tiles — the assistant's advice (public information only, `nextMatchAdvice`), the arena
 * condition and the state of our starters — and the way to the match, the tactics and the squad. Display only.
 */
import type { CSSProperties } from 'react';
import { isInjured } from '../../../engine/creature/derived.ts';
import { arenaActive, arenaFor } from '../../../engine/league/arena.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { lastMatchday, playerFixture, playerTeam, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Team } from '../../../engine/model.ts';
import { nextMatchAdvice } from '../../../engine/report/advice.ts';
import { defaultCrest } from '../../../engine/team/crest.ts';
import { managerName } from '../../../engine/team/identity.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { ArenaConditionCard } from '../../components/ArenaCondition.tsx';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { compDef, compName, divName, roundKey } from '../../competitions.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { CompIcon, DivIcon, UiIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';
import { useTipVars } from '../arena/VerdictPanel.tsx';
import { FormDots } from './LeagueScreen.tsx';
import { lastMeeting } from './Versus.tsx';

function Side({ game, team, away }: { game: GameState; team: Team; away?: boolean }) {
  const tr = useT();
  const { t } = tr;
  const d = divisionOf(game, team.id);
  const table = standings(game, d);
  const pos = table.findIndex((r) => r.teamId === team.id) + 1;
  const row = table[pos - 1];
  const showManager = away && team.identity && DEFAULT_CONFIG.identity.difficulties[game.difficulty ?? 'normal'].identities;
  return (
    <div className={`nmb-side ${away ? 'away' : ''}`}>
      <StableCrest team={team} size={52} />
      <div className="nmb-team">
        <b className="nmb-name">{team.name}</b>
        {row && (
          <span className="muted">
            {d !== divisionOf(game, game.playerTeamId) && `${divName(t, d)} · `}
            {t('match.position', { pos: tr.ordinal(pos), pts: row.points })}
          </span>
        )}
        {showManager && (
          <span className="muted" title={t(`manager.${team.identity!.manager}.desc`)}>
            {t('match.manager', { name: managerName(team), m: t(`manager.${team.identity!.manager}`) })}
          </span>
        )}
        {row && row.form.length > 0 && <FormDots form={row.form} />}
      </div>
    </div>
  );
}

export function NextMatchBanner({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const tipVars = useTipVars();
  const f = playerFixture(game);
  if (!f || seasonOver(game)) return null;
  const { setScreen, continueGame } = useGame.getState();
  const me = playerTeam(game);
  const home = f.home === game.playerTeamId;
  const opp = teamById(game, home ? f.away : f.home);
  const def = f.competition ? compDef(f.tournamentId) : 'league';
  const title = f.competition
    ? t('match.cup', { comp: compName(t, f.tournamentId), round: t(roundKey(f.round ?? 0, f.tournamentId ? (game.tournaments.find((x) => x.id === f.tournamentId)?.rounds ?? 1) : game.cup.rounds)) })
    : `${divName(t, f.division ?? 0)} · ${t('match.matchday', { d: f.matchday, n: lastMatchday(game) })}`;

  const last = lastMeeting(game, opp.id);
  const lastText = (() => {
    if (!last?.result) return t('nmb.firstMeeting');
    const side = last.home === game.playerTeamId ? 0 : 1;
    const sc = side === 0 ? last.result.score : [last.result.score[1], last.result.score[0]];
    return t(last.result.winner === side ? 'vs.lastWin' : 'vs.lastLoss', { a: sc[0], b: sc[1] });
  })();

  const tips = nextMatchAdvice({ team: me, foe: opp }).slice(0, 2);
  const starters = me.tactic.lineup.flatMap((s) => me.creatures.find((c) => c.id === s.creatureId) ?? []);
  const injured = starters.filter(isInjured).length;
  const tired = starters.filter((c) => !isInjured(c) && c.condition.fatigue >= 50).length;
  const points = me.creatures.reduce((s, c) => s + (c.growth?.freePoints ?? 0), 0);
  const showArena = arenaActive(game, f.matchday);
  const colours = {
    '--nmb-home': (me.crest ?? defaultCrest(me.id)).field[0],
    '--nmb-away': (opp.crest ?? defaultCrest(opp.id)).field[0],
  } as CSSProperties;

  return (
    <section className="panel nmb" style={colours}>
      <div className="nmb-head">
        <h3>{t('inbox.nextMatch')}</h3>
        <div className="nmb-actions">
          <button className="btn primary" onClick={() => continueGame()}>
            {t('nmb.prepare')} ▶
          </button>
          <button className="btn" onClick={() => setScreen('tactics')}>
            {t('nav.tactics')}
          </button>
          <button className="btn" onClick={() => setScreen('squad')}>
            {t('nav.squad')}
          </button>
        </div>
        <span className={`comp-badge def-${def}`}>
          {f.competition ? <CompIcon def={def} /> : <DivIcon d={f.division ?? 0} />} {title}
        </span>
        <span className="tag">{home ? t('common.home') : t('common.away')}</span>
      </div>
      <div className="nmb-face">
        <Side game={game} team={me} />
        <div className="nmb-vs">
          <b>VS</b>
          <small className="muted">{lastText}</small>
        </div>
        <Side game={game} team={opp} away />
      </div>
      <div className="nmb-info">
        <div className="nmb-tile">
          <span className="nmb-label">
            <UiIcon name="tip" /> {t('nmb.assistant')}
          </span>
          {tips.length ? (
            <ul className="nmb-tips">
              {tips.map((x) => (
                <li key={x.key}>{t(`verdict.t.${x.key}` as StringKey, tipVars(x.vars))}</li>
              ))}
            </ul>
          ) : (
            <span className="muted">{t('nmb.noTip')}</span>
          )}
        </div>
        <div className="nmb-tile">
          <span className="nmb-label">{t('nmb.arena')}</span>
          {showArena ? <ArenaConditionCard id={arenaFor(game, f)} compact /> : <span className="muted">{t('nmb.arenaLater')}</span>}
        </div>
        <div className="nmb-tile">
          <span className="nmb-label">{t('nmb.starters')}</span>
          {injured + tired + points === 0 ? (
            <span className="good-text">{t('nmb.ready')}</span>
          ) : (
            <span className="nmb-status">
              {injured > 0 && <span className="bad-text">{t('nmb.injured', { n: injured })}</span>}
              {tired > 0 && <span className="warn-text">{t('nmb.tired', { n: tired })}</span>}
              {points > 0 && <span className="gold-text">{t('nmb.points', { n: points })}</span>}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
