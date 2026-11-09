import { DEFAULT_CONFIG, type QualityId } from '../../../data/config/index.ts';
import { qualityName } from '../../../engine/text/localize.ts';
import { TeamEditor } from '../../components/TeamEditor.tsx';
import { useT } from '../../i18n/index.ts';
import { useArena } from '../../store/arenaStore.ts';

export function TeamPanel({ side }: { side: 0 | 1 }) {
  const { t, lang } = useT();
  const team = useArena((s) => s.teams[side]);
  const quality = useArena((s) => s.quality[side]);
  const { setTeam, setQuality, regenerate, swapSpecies } = useArena.getState();

  return (
    <TeamEditor
      team={team}
      onChange={(tm) => setTeam(side, tm)}
      onSwapSpecies={(id, sp) => swapSpecies(side, id, sp)}
      className={side === 0 ? 'side-home' : 'side-away'}
      header={
        <>
          <span className={side === 0 ? 'home-text' : 'away-text'} style={{ fontWeight: 700, fontSize: '0.857rem' }}>
            {side === 0 ? t('arena.yourTeam') : t('arena.opponent')}
          </span>
          <input className="team-name-input" value={team.name} aria-label={t('arena.teamName')} onChange={(e) => setTeam(side, { ...team, name: e.target.value })} />
          <span className="spacer" />
          <select value={quality} onChange={(e) => setQuality(side, e.target.value as QualityId)} aria-label={t('arena.quality')}>
            {Object.keys(DEFAULT_CONFIG.generation.qualities).map((id) => (
              <option key={id} value={id}>
                {qualityName(id, lang)}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => regenerate(side)}>
            {t('arena.generate')}
          </button>
        </>
      }
    />
  );
}
