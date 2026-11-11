import { weekText } from '../../season.ts';
import { CrestEditor, StableCrest } from '../../components/TeamCrest.tsx';
import { defaultCrest } from '../../../engine/team/crest.ts';
import type { TeamCrest } from '../../../data/crest.ts';
import { useMemo, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../data/config/identity.ts';
import { Rng } from '../../../core/rng.ts';
import { generateTeamName } from '../../../engine/creature/names.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { playerTeam, standings } from '../../../engine/league/season.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { randomSeed } from '../../format.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from '../../icons/gameIcons.ts';
import { divName } from '../../competitions.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { useTutorial } from '../../tutorial/tutorial.ts';


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
  const [crest, setCrest] = useState<TeamCrest>(() => defaultCrest(randomSeed()));

  const start = () => {
    if (game && !window.confirm(t('start.overwrite'))) return;
    if (tips) tutorial.restart();
    else tutorial.setEnabled(false);
    newGame(name.trim() || suggested, seed, difficulty, crest);
    onCreated?.();
  };

  const saved = game ? playerTeam(game) : null;
  const pos = game && saved ? standings(game, divisionOf(game, saved.id)).findIndex((r) => r.teamId === saved.id) + 1 : 0;

  return (
    <div className="start">
      {!onCancel && (
        <header className="start-hero">
          <svg className="start-logo" viewBox={ICON_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPECIES_ICONS.dragon! }} />
          <div>
            <h1>{t('app.title')}</h1>
            <p className="muted">{t('start.intro')}</p>
          </div>
        </header>
      )}

      {game && saved && !onCancel && (
        <section className="panel start-card continue-card">
          <div className="start-card-tag">{t('start.continueTag')}</div>
          <StableCrest team={saved} size={48} />
          <div className="grow">
            <h2>{saved.name}</h2>
            <div className="muted">
              {t('dash.season', { s: game.season, w: weekText(t, game) })} · {divName(t, divisionOf(game, saved.id))} · {tr.ordinal(pos)} ·{' '}
              {t(`diff.${game.difficulty ?? 'normal'}`)}
            </div>
          </div>
          <button className="btn primary big-btn" onClick={() => setScreen('dashboard')}>
            {t('start.resume')} ▶
          </button>
        </section>
      )}

      <section className="panel start-card new-card">
        <div className="start-card-tag new">{t('start.newTag')}</div>
        <h2 className="row" style={{ gap: 8 }}>
          <UiIcon name="new-game" size="1.1em" /> {t('start.new')}
        </h2>
        {game && <p className="answer bad" style={{ margin: 0 }}>{t('start.replaceWarning')}</p>}
        <div className="new-grid">
          <div className="new-col">
            <label className="field">
              {t('start.teamName')}
              <input type="text" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </label>
            <div className="field">
              {t('crest.title')}
              <CrestEditor value={crest} onChange={setCrest} />
            </div>
          </div>
          <div className="new-col">
            <div className="field">
              {t('start.difficulty')}
              <div className="diff-cards" role="radiogroup" aria-label={t('start.difficulty')}>
                {DIFFICULTY_IDS.map((d) => (
                  <button key={d} role="radio" aria-checked={d === difficulty} className={`diff-card ${d} ${d === difficulty ? 'on' : ''}`} onClick={() => setDifficulty(d)}>
                    <span className="diff-icon">
                      <UiIcon name={`diff-${d}`} size="1.6em" />
                    </span>
                    <span className="diff-text">
                      <b>{t(`diff.${d}`)}</b>
                      <span className="muted">{t(`diff.${d}.desc`)}</span>
                    </span>
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
            <div className="row wrap start-actions" style={{ gap: 10 }}>
              <button className={`btn ${game && !onCancel ? '' : 'primary'} big-btn`} onClick={start}>
                {t('start.begin')}
              </button>
              {onCancel && (
                <button className="btn" onClick={onCancel}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {!onCancel && (
        <p className="start-links muted">
          <button className="link" onClick={() => setScreen('arena')}>
            {t('start.arena')}
          </button>
          <button className="link" onClick={() => setScreen('encyclopedia')}>
            {t('nav.encyclopedia')}
          </button>
        </p>
      )}
    </div>
  );
}
