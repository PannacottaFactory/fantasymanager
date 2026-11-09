import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { validateTactic } from '../../../engine/team/team.ts';
import { TeamEditor } from '../../components/TeamEditor.tsx';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

export function TacticsScreen() {
  const { t } = useT();
  const game = useGame((s) => s.game)!;
  const { setPlayerTeam, autoPick, repair } = useGame.getState();
  const team = playerTeam(game);
  const injured = validateTactic(team, DEFAULT_CONFIG, true).some((i) => i.code === 'injured');

  return (
    <div className="stack">
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
            <span className="muted" style={{ fontSize: 12 }}>
              {t('tactics.hint')}
            </span>
            {injured && (
              <button className="btn" onClick={repair}>
                {t('tactics.fix')}
              </button>
            )}
            <button className="btn" onClick={autoPick} title={t('tactics.auto.title')}>
              {t('tactics.auto')}
            </button>
          </>
        }
      />
    </div>
  );
}
