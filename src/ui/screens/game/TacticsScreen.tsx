import { useRef, useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { aiPrepare, playerFixture, playerPrepare, playerTeam, teamById } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { managerName } from '../../../engine/team/identity.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { LineupCard } from './MatchScreen.tsx';
import { validateTactic } from '../../../engine/team/team.ts';
import { SquadCount } from '../../components/common.tsx';
import { TeamEditor } from '../../components/TeamEditor.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { useT } from '../../i18n/index.ts';
import { play } from '../../sound/sfx.ts';
import { useGame } from '../../store/gameStore.ts';

export function TacticsScreen() {
  const { t } = useT();
  const game = useGame((s) => s.game)!;
  const { setPlayerTeam, autoPick, repair } = useGame.getState();
  const team = playerTeam(game);
  const injured = validateTactic(team, DEFAULT_CONFIG, true).some((i) => i.code === 'injured');
  // The assistant's pick: the button glows and sweeps, sparkles fly, the rows of the new line-up light up in turn.
  const button = useRef<HTMLButtonElement>(null);
  const [peek, setPeek] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const assistant = () => {
    autoPick();
    play('magic');
    const at = centreOf(button.current);
    if (at) fxLayer()?.sparkle(at.x, at.y, true);
    for (const [el, cls, ms] of [
      [button.current, 'cast', 1000],
      [box.current, 'auto-picked', 1300],
    ] as const) {
      if (!el) continue;
      el.classList.remove(cls);
      void el.offsetWidth; // restart the animation
      el.classList.add(cls);
      window.setTimeout(() => el.classList.remove(cls), ms);
    }
  };

  return (
    <div className="stack" ref={box}>
      <TeamEditor
        onOpenCreature={(id) => useGame.getState().openSheet(id)}
        team={team}
        onChange={setPlayerTeam}
        league
        className="side-home"
        header={
          <>
            <h2 title={t('tactics.hint')}>
              {t('tactics.title')} — {team.name}
            </h2>
            <SquadCount n={team.creatures.length} />
          </>
        }
        toolbar={
          <>
            {injured && (
              <button className="btn" onClick={repair}>
                {t('tactics.fix')}
              </button>
            )}
            <button className={`btn peek ${peek ? 'on' : ''}`} onClick={() => setPeek(!peek)} title={t('tactics.oppPeek.title')} aria-pressed={peek}>
              <UiIcon name="versus" size="1.3em" /> {t('tactics.oppPeek')}
            </button>
            <button ref={button} className="btn assistant-btn" onClick={assistant} title={t('tactics.auto.title')}>
              <UiIcon name="talk-assistant" size="1.3em" /> {t('tactics.auto')}
            </button>
          </>
        }
      />
      {peek && <OpponentPeek game={game} onClose={() => setPeek(false)} />}
    </div>
  );
}

/** Floating panel: the next opponent's expected line-up, left open while the player edits the tactics. */
function OpponentPeek({ game, onClose }: { game: GameState; onClose: () => void }) {
  const { t } = useT();
  const match = useGame((s) => s.match);
  const f = match?.phase === 'pre' ? game.fixtures.find((x) => x.id === match.fixtureId) : playerFixture(game);
  const mine = playerTeam(game);
  // Same line-up as the pre-match screen shows (public information only).
  const opp = f ? aiPrepare(teamById(game, f.home === game.playerTeamId ? f.away : f.home), undefined, game.difficulty ?? 'normal', playerPrepare(mine)) : null;
  return (
    <aside className="opp-peek" role="dialog" aria-label={t('tactics.oppPeek')}>
      <div className="opp-peek-head">
        <b>{t('tactics.oppPeek')}</b>
        <span className="spacer" />
        <button className="btn ghost small" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>
      {opp ? (
        <>
          <div className="prematch-lineups opp-peek-card">
            <LineupCard team={opp} title={t('match.opponent')} side={1} />
          </div>
          {opp.identity && (
            <div className="muted opp-peek-note" title={t(`manager.${opp.identity.manager}.desc`)}>
              {t('match.manager', { name: managerName(opp), m: t(`manager.${opp.identity.manager}`) })}
            </div>
          )}
          <div className="faint opp-peek-note">{t('tactics.oppPeek.hint')}</div>
        </>
      ) : (
        <div className="muted">{t('tactics.oppPeek.none')}</div>
      )}
    </aside>
  );
}
