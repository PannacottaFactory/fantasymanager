import { validateTactic } from '../../../engine/team/team.ts';
import { useT } from '../../i18n/index.ts';
import { useArena } from '../../store/arenaStore.ts';
import { TeamPanel } from './TeamPanel.tsx';

export function SetupView() {
  const { t } = useT();
  const { teams, seed, playerControls } = useArena();
  const { setSeed, rollSeed, setPlayerControls, start } = useArena.getState();
  const valid = validateTactic(teams[0]).length === 0 && validateTactic(teams[1]).length === 0;

  return (
    <div className="setup-grid">
      <section className="panel">
        <div className="matchbar">
          <div>
            <h2>{t('arena.title')}</h2>
            <div className="muted" style={{ fontSize: 12 }}>
              {t('arena.hint')}
            </div>
          </div>
          <span className="spacer" />
          <label className="field">
            {t('arena.seed')}
            <span className="row" style={{ gap: 4 }}>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} aria-label={t('arena.seed')} />
              <button className="btn small" onClick={rollSeed} title={t('arena.randomSeed')}>
                ⚄
              </button>
            </span>
          </label>
          <label className="row" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={playerControls} onChange={(e) => setPlayerControls(e.target.checked)} />
            {t('arena.manageBreaks')}
          </label>
          <button className="btn primary" disabled={!valid} onClick={start} style={{ padding: '8px 22px' }}>
            {t('arena.enter')}
          </button>
        </div>
      </section>
      <TeamPanel side={0} />
      <TeamPanel side={1} />
    </div>
  );
}
