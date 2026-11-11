/**
 * "First steps": six concrete things to do in a first game, ticked automatically as the player does them
 * (tracked by `useFirstStepsTracker`, mounted once in the app). Shown on the home screen until done or hidden.
 */
import { useEffect, useState } from 'react';
import { fxLayer, centreOf } from '../fx/FxLayer.tsx';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { useGame, type Screen } from '../store/gameStore.ts';
import { QUESTS, useTutorial, type QuestId } from './tutorial.ts';

const TARGET: Record<QuestId, Screen | 'continue'> = {
  creature: 'squad',
  tactics: 'tactics',
  match: 'continue',
  report: 'continue',
  training: 'training',
  recruit: 'recruit',
};

/** Ticks the first steps from what the player does (screens visited, sheets opened, matches played). */
export function useFirstStepsTracker() {
  const screen = useGame((s) => s.screen);
  const sheet = useGame((s) => s.sheet);
  const phase = useGame((s) => s.match?.phase);
  const viewing = useGame((s) => s.viewing);
  const played = useGame((s) => (s.game?.matchHistory?.length ?? 0) > 0);
  const { markQuest } = useTutorial.getState();
  useEffect(() => {
    if (sheet) markQuest('creature');
  }, [sheet, markQuest]);
  useEffect(() => {
    if (screen === 'tactics') markQuest('tactics');
    if (screen === 'training') markQuest('training');
    if (screen === 'recruit') markQuest('recruit');
  }, [screen, markQuest]);
  useEffect(() => {
    if (phase === 'live' || played) markQuest('match');
    if (phase === 'report' || viewing) markQuest('report');
  }, [phase, played, viewing, markQuest]);
}

/** Still learning? (the home screen keeps things simple meanwhile) */
export function useLearning(): boolean {
  const { enabled, quests, questsHidden } = useTutorial();
  return enabled && !questsHidden && quests.length < QUESTS.length;
}

export function FirstSteps() {
  const { t } = useT();
  const { enabled, quests, questsHidden, hideQuests } = useTutorial();
  const [open, setOpen] = useState(false);
  const done = quests.length >= QUESTS.length;
  useEffect(() => {
    if (!done || questsHidden || !enabled) return;
    const at = centreOf(document.querySelector('.first-steps'));
    if (at) fxLayer()?.sparkle(at.x, at.y, true);
  }, [done, questsHidden, enabled]);
  if (!enabled || questsHidden) return null;
  const go = (q: QuestId) => {
    const target = TARGET[q];
    const st = useGame.getState();
    if (target === 'continue') {
      if (st.match && st.match.phase !== 'report') st.setScreen('match');
      else st.continueGame();
    } else st.setScreen(target);
  };
  if (done)
    return (
      <section className="panel first-steps done">
        <div className="row" style={{ gap: 12 }}>
          <span className="fs-trophy">🏆</span>
          <div className="grow">
            <b>{t('quest.done.title')}</b>
            <div className="muted">{t('quest.done.body')}</div>
          </div>
          <button className="btn small" onClick={hideQuests}>
            {t('quest.done.close')}
          </button>
        </div>
      </section>
    );
  const next = QUESTS.find((q) => !quests.includes(q));
  // One line: progress and the next step; the whole list on demand.
  return (
    <section className={`panel first-steps compact ${open ? 'open' : ''}`} data-tip="first-steps">
      <div className="fs-row">
        <b className="fs-title">🧭 {t('quest.title')}</b>
        <span className="fs-bar" aria-hidden="true">
          <i style={{ width: `${(100 * quests.length) / QUESTS.length}%` }} />
        </span>
        <span className="muted fs-count">{t('quest.progress', { n: quests.length, m: QUESTS.length })}</span>
        {next && !open && (
          <span className="fs-next grow">
            <span className="fs-arrow">➤</span> <b>{t(`quest.${next}` as StringKey)}</b>
            <span className="muted"> — {t(`quest.${next}.hint` as StringKey)}</span>
          </span>
        )}
        {open && <span className="grow" />}
        {next && !open && (
          <button className="btn small primary" onClick={() => go(next)}>
            {t('quest.go')}
          </button>
        )}
        <button className="link fs-link" onClick={() => setOpen((x) => !x)}>
          {open ? t('quest.less') : t('quest.all')}
        </button>
        <button className="link fs-link" onClick={hideQuests}>
          {t('quest.hide')}
        </button>
      </div>
      {open && (
        <>
          <ol className="fs-list">
            {QUESTS.map((q) => {
              const ok = quests.includes(q);
              return (
                <li key={q} className={`${ok ? 'ok' : ''} ${q === next ? 'next' : ''}`}>
                  <span className="fs-check">{ok ? '✓' : ''}</span>
                  <span className="grow">
                    <b>{t(`quest.${q}` as StringKey)}</b>
                    {!ok && <span className="muted"> — {t(`quest.${q}.hint` as StringKey)}</span>}
                  </span>
                  {!ok && (
                    <button className={`btn small ${q === next ? 'primary' : ''}`} onClick={() => go(q)}>
                      {t('quest.go')}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="faint" style={{ fontSize: '0.857rem', marginTop: 6 }}>
            {t('quest.lost')}
          </div>
        </>
      )}
    </section>
  );
}
