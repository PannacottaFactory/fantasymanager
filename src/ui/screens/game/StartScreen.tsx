import { useMemo, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../data/config/identity.ts';
import { Rng } from '../../../core/rng.ts';
import { generateTeamName } from '../../../engine/creature/names.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { lastMatchday, playerTeam, standings } from '../../../engine/league/season.ts';
import { Crest } from '../../components/common.tsx';
import { randomSeed } from '../../format.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from '../../icons/gameIcons.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { useTutorial } from '../../tutorial/tutorial.ts';

const DIFF_ICON: Record<DifficultyId, string> = { easy: '🌿', normal: '⚔', hard: '💀' };

/** Shown when no game is loaded, or from the "new game" button: continue the save, or start a new game. */
export function StartScreen({ onCancel, onCreated }: { onCancel?: () => void; onCreated?: () => void }) {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game);
  const { newGame, setScreen } = useGame.getState();
  const suggested = useMemo(() => generateTeamName(new Rng(randomSeed()), lang), [lang]);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(randomSeed);
  const tutorial = useTutorial();
  const [tips, setTips] = useState(tutorial.enabled);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [more, setMore] = useState(false);

  const start = () => {
    if (game && !window.confirm(t('start.overwrite'))) return;
    if (tips) tutorial.restart();
    else tutorial.setEnabled(false);
    newGame(name.trim() || suggested, seed, difficulty);
    onCreated?.();
  };

  const saved = game ? playerTeam(game) : null;
  const pos = game && saved ? standings(game, divisionOf(game, saved.id)).findIndex((r) => r.teamId === saved.id) + 1 : 0;
  const best = saved ? [...saved.creatures].sort((a, b) => b.ability - a.ability)[0] : undefined;

  return (
    <div className="start">
      {!onCancel && (
        <header className="start-hero">
          <svg className="start-logo" viewBox={ICON_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPECIES_ICONS.dragon! }} />
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('start.intro')}</p>
        </header>
      )}

      <div className={`start-cards ${game && !onCancel ? 'two' : ''}`}>
        {game && saved && !onCancel && (
          <section className="panel start-card continue-card">
            <div className="start-card-tag">{t('start.continueTag')}</div>
            <div className="row" style={{ gap: 12 }}>
              {best && <Crest speciesId={best.speciesId} name={saved.name} size={48} />}
              <div>
                <h2>{saved.name}</h2>
                <div className="muted">{t('dash.season', { s: game.season, d: Math.min(game.matchday, lastMatchday(game)), n: lastMatchday(game) })}</div>
                <div className="muted">
                  {t('league.division', { n: divisionOf(game, saved.id) + 1 })} · {tr.ordinal(pos)} · {t(`diff.${game.difficulty ?? 'normal'}`)}
                </div>
              </div>
            </div>
            <button className="btn primary big-btn" onClick={() => setScreen('dashboard')}>
              {t('start.resume')} ▶
            </button>
          </section>
        )}

        <section className="panel start-card new-card">
          <div className="start-card-tag new">{t('start.newTag')}</div>
          <h2>✦ {t('start.new')}</h2>
          {game && <p className="answer bad" style={{ margin: 0 }}>{t('start.replaceWarning')}</p>}
          <label className="field">
            {t('start.teamName')}
            <input type="text" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <div className="field">
            {t('start.difficulty')}
            <div className="diff-cards" role="radiogroup" aria-label={t('start.difficulty')}>
              {DIFFICULTY_IDS.map((d) => (
                <button key={d} role="radio" aria-checked={d === difficulty} className={`diff-card ${d} ${d === difficulty ? 'on' : ''}`} onClick={() => setDifficulty(d)}>
                  <span className="diff-icon">{DIFF_ICON[d]}</span>
                  <b>{t(`diff.${d}`)}</b>
                  <span className="muted">{t(`diff.${d}.desc`)}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="row" style={{ gap: 6, fontSize: '0.929rem' }}>
            <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
            {t('start.tutorial')}
          </label>
          <button className="link" style={{ alignSelf: 'flex-start', fontSize: '0.857rem' }} onClick={() => setMore((m) => !m)}>
            {more ? '▾' : '▸'} {t('start.more')}
          </button>
          {more && (
            <label className="field">
              {t('start.seed')}
              <span className="row" style={{ gap: 4 }}>
                <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 130 }} />
                <button className="btn small" onClick={() => setSeed(randomSeed())} title={t('arena.randomSeed')}>
                  ⚄
                </button>
              </span>
            </label>
          )}
          <div className="row wrap" style={{ gap: 10 }}>
            <button className={`btn ${game && !onCancel ? '' : 'primary'} big-btn`} onClick={start}>
              {t('start.begin')}
            </button>
            {onCancel && (
              <button className="btn" onClick={onCancel}>
                {t('common.cancel')}
              </button>
            )}
          </div>
        </section>
      </div>

      {!onCancel && (
        <p className="start-links muted">
          <button className="link" onClick={() => setScreen('arena')}>
            ⚔ {t('start.arena')}
          </button>
          <button className="link" onClick={() => setScreen('encyclopedia')}>
            📖 {t('nav.encyclopedia')}
          </button>
        </p>
      )}
    </div>
  );
}
