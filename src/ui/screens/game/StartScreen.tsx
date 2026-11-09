import { useMemo, useState } from 'react';
import { Rng } from '../../../core/rng.ts';
import { generateTeamName } from '../../../engine/creature/names.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { randomSeed } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

/** Shown when no game is loaded, or from the "new game" button. */
export function StartScreen({ onCancel }: { onCancel?: () => void }) {
  const { t, lang } = useT();
  const game = useGame((s) => s.game);
  const { newGame, setScreen } = useGame.getState();
  const suggested = useMemo(() => generateTeamName(new Rng(randomSeed()), lang), [lang]);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(randomSeed);

  const start = () => {
    if (game && !window.confirm(t('start.overwrite'))) return;
    newGame(name.trim() || suggested, seed);
  };

  return (
    <div className="start">
      <section className="panel start-card">
        <h2>{t('start.title')}</h2>
        <p className="muted">{t('start.intro')}</p>
        {game && !onCancel && (
          <div className="resume">
            <button className="btn primary" onClick={() => setScreen('inbox')}>
              {t('start.resume')}
            </button>
            <span className="muted">{t('start.saved', { season: game.season, d: game.matchday, team: playerTeam(game).name })}</span>
          </div>
        )}
        <h3 style={{ margin: '16px 0 8px' }}>{t('start.new')}</h3>
        <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
          <label className="field">
            {t('start.teamName')}
            <input type="text" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} style={{ width: 240 }} maxLength={40} />
          </label>
          <label className="field">
            {t('start.seed')}
            <span className="row" style={{ gap: 4 }}>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} />
              <button className="btn small" onClick={() => setSeed(randomSeed())} title={t('arena.randomSeed')}>
                ⚄
              </button>
            </span>
          </label>
          <button className="btn primary" onClick={start} style={{ padding: '8px 22px' }}>
            {t('start.begin')}
          </button>
          {onCancel && (
            <button className="btn" onClick={onCancel}>
              {t('common.cancel')}
            </button>
          )}
        </div>
        <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
          <button className="link" onClick={() => setScreen('arena')}>
            {t('start.arena')}
          </button>
        </p>
      </section>
    </div>
  );
}
