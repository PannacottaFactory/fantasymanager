import { useMemo } from 'react';
import { useArena } from '../../store/arenaStore.ts';
import { LiveMatch } from './LiveMatch.tsx';
import { ReportView } from './ReportView.tsx';
import { SetupView } from './SetupView.tsx';

export function ArenaScreen() {
  const { mode, teams, seed, playerControls, liveKey, result, finish } = useArena();
  // Snapshot of the setup when the match starts (edits on the setup screen don't leak into a running fight).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setup = useMemo(() => ({ seed, teams: structuredClone(teams) }), [liveKey]);
  if (mode === 'live') return <LiveMatch key={liveKey} setup={setup} playerControls={playerControls} onFinish={finish} />;
  if (mode === 'report' && result) return <ReportView result={result} />;
  return <SetupView />;
}
