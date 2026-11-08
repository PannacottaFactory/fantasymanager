import { validateTactic } from '../../../engine/team/team.ts';
import { useArena } from '../../store/arenaStore.ts';
import { TeamPanel } from './TeamPanel.tsx';

export function SetupView() {
  const { teams, seed, playerControls } = useArena();
  const { setSeed, rollSeed, setPlayerControls, start } = useArena.getState();
  const valid = validateTactic(teams[0]).length === 0 && validateTactic(teams[1]).length === 0;

  return (
    <div className="setup-grid">
      <section className="panel">
        <div className="matchbar">
          <div>
            <h2>Training Arena</h2>
            <div className="muted" style={{ fontSize: 12 }}>
              Pick your creatures, set the tactics, and let the simulation decide. Same seed + same choices = same fight.
            </div>
          </div>
          <span className="spacer" />
          <label className="field">
            Match seed
            <span className="row" style={{ gap: 4 }}>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} aria-label="Match seed" />
              <button className="btn small" onClick={rollSeed} title="Random seed">
                ⚄
              </button>
            </span>
          </label>
          <label className="row" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={playerControls} onChange={(e) => setPlayerControls(e.target.checked)} />
            Manage my team at breaks
          </label>
          <button className="btn primary" disabled={!valid} onClick={start} style={{ padding: '8px 22px' }}>
            Enter the arena ⚔
          </button>
        </div>
      </section>
      <TeamPanel side={0} />
      <TeamPanel side={1} />
    </div>
  );
}
