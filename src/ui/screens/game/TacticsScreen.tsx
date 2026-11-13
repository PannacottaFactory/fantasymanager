import { useRef } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { validateTactic } from '../../../engine/team/team.ts';
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
            <h2>
              {t('tactics.title')} — {team.name}
            </h2>
            <span className="spacer" />
            <span className="muted" style={{ fontSize: '0.857rem' }}>
              {t('tactics.hint')}
            </span>
            {injured && (
              <button className="btn" onClick={repair}>
                {t('tactics.fix')}
              </button>
            )}
            <button ref={button} className="btn assistant-btn" onClick={assistant} title={t('tactics.auto.title')}>
              {t('tactics.auto')}
            </button>
          </>
        }
      />
    </div>
  );
}
