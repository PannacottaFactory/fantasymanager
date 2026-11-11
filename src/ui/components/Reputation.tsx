/** The stable's reputation (0–100): a compact chip for the top bar and a fuller line with the next invitational. */
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { clubOf } from '../../engine/economy/finance.ts';
import type { GameState } from '../../engine/league/types.ts';
import { compName } from '../competitions.ts';
import { UiIcon } from '../icons/Icon.tsx';
import { useT } from '../i18n/index.ts';
import { useGame } from '../store/gameStore.ts';

export const reputationOf = (game: GameState) => Math.round(clubOf(game, game.playerTeamId).reputation);

/** Next invitational the reputation does not open yet (id and threshold), if any. */
export function nextInvitational(rep: number): { id: string; minRep: number } | null {
  const open = Object.entries(DEFAULT_CONFIG.league.tournaments.open)
    .map(([id, d]) => ({ id, minRep: d.minRep }))
    .filter((d) => d.minRep > rep)
    .sort((a, b) => a.minRep - b.minRep);
  return open[0] ?? null;
}

export function ReputationChip({ game }: { game: GameState }) {
  const { t } = useT();
  const rep = reputationOf(game);
  return (
    <button className="rep-chip" title={t('rep.title', { n: rep })} onClick={() => useGame.getState().openLeague('comps')}>
      <UiIcon name="honours" />
      <b>{rep}</b>
    </button>
  );
}

/** « Reputation 20/100 » with a bar and what it opens next. */
export function ReputationLine({ game }: { game: GameState }) {
  const { t } = useT();
  const rep = reputationOf(game);
  const next = nextInvitational(rep);
  return (
    <div className="rep-line" title={t('rep.title', { n: rep })}>
      <span className="rep-label">
        <UiIcon name="honours" /> {t('rep.label')} <b>{rep}</b>
        <span className="faint">/100</span>
      </span>
      <span className="rep-bar">
        <i style={{ width: `${rep}%` }} />
        {next && <em style={{ left: `${next.minRep}%` }} />}
      </span>
      <small className="muted">{next ? t('rep.next', { comp: compName(t, next.id), n: next.minRep }) : t('rep.allOpen')}</small>
    </div>
  );
}
