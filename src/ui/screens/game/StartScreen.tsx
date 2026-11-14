import { CrestEditor, CrestShield } from '../../components/TeamCrest.tsx';
import { defaultCrest } from '../../../engine/team/crest.ts';
import type { TeamCrest } from '../../../data/crest.ts';
import { useEffect, useMemo, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../data/config/identity.ts';
import { Rng } from '../../../core/rng.ts';
import { generateTeamName } from '../../../engine/creature/names.ts';
import { randomManagerName } from '../../../engine/team/identity.ts';
import { STARTING_SQUADS, type StartingSquad } from '../../../engine/league/season.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { randomSeed } from '../../format.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from '../../icons/gameIcons.ts';
import { divName } from '../../competitions.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { useTutorial } from '../../tutorial/tutorial.ts';
import { SLOTS, type SlotId, type SlotMeta } from '../../store/saves.ts';
import type { Translator } from '../../i18n/index.ts';

function slotWeek(tr: Translator, m: SlotMeta): string {
  const { t } = tr;
  const w = m.week === 0 ? t('week.pre') : m.week > m.weeks ? t('week.over') : t('week.of', { d: m.week, n: m.weeks });
  return t('start.seasonWeek', { s: m.season, w });
}

/** One save slot: the game in it (continue / load / delete) or a free place. */
function SlotCard({ n, slot, meta, playing, onNew }: { n: number; slot: SlotId; meta: SlotMeta | null; playing: boolean; onNew: () => void }) {
  const tr = useT();
  const { t, lang } = tr;
  const { loadSlot, deleteSlot, setScreen } = useGame.getState();
  if (!meta)
    return (
      <button className="slot-card empty" onClick={onNew}>
        <span className="slot-n">{t('start.slot', { n })}</span>
        <span className="slot-empty-ico">
          <UiIcon name="new-game" size="1.5em" />
        </span>
        <b>{t('start.empty')}</b>
        <small className="muted">{t('start.emptyHint')}</small>
      </button>
    );
  const date = meta.savedAt ? new Date(meta.savedAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className={`slot-card ${playing ? 'playing' : ''}`}>
      <span className="slot-n">
        {t('start.slot', { n })}
        {playing && <em>{t('start.playing')}</em>}
      </span>
      <div className="slot-main">
        <CrestShield crest={meta.crest ?? defaultCrest(meta.teamId)} size={44} title={meta.teamName} />
        <div className="slot-text">
          <b>{meta.teamName}</b>
          <span className="muted">{slotWeek(tr, meta)}</span>
          <span className="muted">
            {divName(t, meta.division)} · {meta.position > 0 ? tr.ordinal(meta.position) : '—'} · {t(`diff.${meta.difficulty}`)}
            {meta.career ? ` · ${t('slot.career')}` : ''}
            {meta.ironman ? ` · ${t('slot.ironman')}` : ''}
          </span>
          {date && <small className="faint">{t('start.savedAt', { date })}</small>}
        </div>
      </div>
      <div className="slot-actions">
        <button className="btn primary" onClick={() => (playing ? setScreen('dashboard') : void loadSlot(slot))}>
          {playing ? t('start.resume') : t('start.load')} ▶
        </button>
        <button
          className="btn small ghost slot-del"
          title={t('start.delete')}
          aria-label={t('start.delete')}
          onClick={() => window.confirm(t('start.deleteConfirm', { team: meta.teamName })) && void deleteSlot(slot)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}


/** Shown when no game is loaded, or from the "new game" button: continue the save, or start a new game. */
export function StartScreen({ onCancel, onCreated }: { onCancel?: () => void; onCreated?: () => void }) {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game);
  const slots = useGame((s) => s.slots);
  const current = useGame((s) => s.slot);
  const { newGame, setScreen, refreshSlots } = useGame.getState();
  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);
  // Where the new game goes: the first free slot, otherwise the one in play.
  const firstFree = slots ? SLOTS.find((x) => !slots[x]) : undefined;
  const [target, setTarget] = useState<SlotId | null>(null);
  const into = target ?? firstFree ?? current;
  // With saved games, the launch screen shows the slots; the form opens from « New game » or a free slot.
  const [picking, setPicking] = useState(false);
  const openForm = (slot?: SlotId) => {
    if (slot) setTarget(slot);
    setPicking(true);
  };
  const suggested = useMemo(() => generateTeamName(new Rng(randomSeed()), lang), [lang]);
  const [name, setName] = useState('');
  const suggestedManager = useMemo(() => randomManagerName(new Rng(randomSeed())), []);
  const [manager, setManager] = useState('');
  const [seed, setSeed] = useState(randomSeed);
  const tutorial = useTutorial();
  const [tips, setTips] = useState(tutorial.enabled);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [career, setCareer] = useState(false);
  const [squad, setSquad] = useState<StartingSquad>('solid');
  const [ironman, setIronman] = useState(false);
  const [more, setMore] = useState(false);
  const [crest, setCrest] = useState<TeamCrest>(() => defaultCrest(randomSeed()));

  const start = () => {
    const taken = slots?.[into];
    if (taken && !window.confirm(t('start.overwriteSlot', { team: taken.teamName, n: SLOTS.indexOf(into) + 1 }))) return;
    if (tips) tutorial.restart();
    else tutorial.setEnabled(false);
    newGame(name.trim() || suggested, seed, difficulty, crest, into, { career, ironman: career && ironman, managerName: manager.trim() || suggestedManager, squad });
    onCreated?.();
  };
  const anySaved = !!slots && SLOTS.some((x) => slots[x]);
  const showSlots = anySaved && !onCancel && !picking;
  const takenInto = slots?.[into];

  return (
    <div className="start">
      <header className="start-hero">
        <div className="start-title-row">
          <svg className="start-logo" viewBox={ICON_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPECIES_ICONS.dragon! }} />
          <h1 className="start-title">{t('app.title')}</h1>
        </div>
        <div className="start-ornament" aria-hidden="true">
          <i />
          <b>◆</b>
          <i />
        </div>
        <p className="start-tagline">{t('start.intro')}</p>
      </header>

      {showSlots && (
        <>
          <section className="slots" aria-label={t('start.slots')}>
            {SLOTS.map((x, i) => (
              <SlotCard key={x} n={i + 1} slot={x} meta={slots![x]} playing={!!game && x === current} onNew={() => openForm(x)} />
            ))}
          </section>
          <button className="btn big-btn new-game-cta" onClick={() => openForm(firstFree)}>
            <UiIcon name="new-game" size="1.1em" /> {t('start.new')}
          </button>
        </>
      )}

      {!showSlots && (
      <section className="panel start-card new-card">
        <div className="start-card-tag new">{t('start.newTag')}</div>
        <div className="row wrap new-head">
          <h2 className="row" style={{ gap: 8 }}>
            <UiIcon name="new-game" size="1.1em" /> {t('start.new')}
          </h2>
          {anySaved && slots && (
            <div className="slot-pick" role="radiogroup" aria-label={t('start.saveIn')}>
              <span className="muted">{t('start.saveIn')}</span>
              {SLOTS.map((x, i) => (
                <button
                  key={x}
                  role="radio"
                  aria-checked={x === into}
                  className={`slot-opt ${x === into ? 'on' : ''} ${slots[x] ? 'taken' : ''}`}
                  title={slots[x] ? t('start.slotReplace', { team: slots[x]!.teamName }) : t('start.slotFree')}
                  onClick={() => setTarget(x)}
                >
                  <b>{t('start.slot', { n: i + 1 })}</b>
                  <small>{slots[x] ? slots[x]!.teamName : t('start.slotFree')}</small>
                </button>
              ))}
              {takenInto && <span className="new-warning">{t('start.slotReplaceLong', { team: takenInto.teamName })}</span>}
            </div>
          )}
          {anySaved && !onCancel && (
            <button className="link back-to-slots" onClick={() => setPicking(false)}>
              ← {t('start.backToSlots')}
            </button>
          )}
        </div>
        <div className="new-grid">
          <div className="new-col">
            <div className="name-row">
              <label className="field">
                {t('start.teamName')}
                <input type="text" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </label>
              <label className="field">
                {t('start.managerName')}
                <input type="text" value={manager} placeholder={suggestedManager} onChange={(e) => setManager(e.target.value)} maxLength={30} />
              </label>
            </div>
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
                  <button key={d} role="radio" aria-checked={d === difficulty} className={`diff-card ${d} ${d === difficulty ? 'on' : ''}`} title={t(`diff.${d}.desc`)} onClick={() => setDifficulty(d)}>
                    <span className="diff-icon">
                      <UiIcon name={`diff-${d}`} size="1.6em" />
                    </span>
                    <span className="diff-text">
                      <b>{t(`diff.${d}`)}</b>
                      <span className="muted">{t(`diff.${d}.short`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              {t('start.squad')}
              <div className="mode-cards squad-cards" role="radiogroup" aria-label={t('start.squad')}>
                {STARTING_SQUADS.map((k) => (
                  <button key={k} role="radio" aria-checked={k === squad} className={`mode-card ${k === squad ? 'on' : ''}`} title={t(`start.squad.${k}.desc`)} onClick={() => setSquad(k)}>
                    <b>{t(`start.squad.${k}`)}</b>
                    <span className="muted">{t(`start.squad.${k}.short`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              {t('start.mode')}
              <div className="mode-cards" role="radiogroup" aria-label={t('start.mode')}>
                {(['free', 'career'] as const).map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={(k === 'career') === career}
                    className={`mode-card ${(k === 'career') === career ? 'on' : ''}`}
                    title={t(`start.mode.${k}.desc`)}
                    onClick={() => setCareer(k === 'career')}
                  >
                    <b>{t(`start.mode.${k}`)}</b>
                    <span className="muted">{t(`start.mode.${k}.short`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6, columnGap: 18 }}>
              <label className={`row ironman ${career ? '' : 'off'}`} title={t('start.ironman.desc')}>
                <input type="checkbox" disabled={!career} checked={career && ironman} onChange={(e) => setIronman(e.target.checked)} />
                <b>{t('start.ironman')}</b>
                <span className="muted">{t('start.ironman.short')}</span>
              </label>
              <label className="row" style={{ gap: 6, fontSize: '0.929rem' }}>
                <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
                {t('start.tutorial')}
              </label>
            </div>
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
              <button className="btn primary big-btn" onClick={start}>
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
      )}

      {!onCancel && !picking && (
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
