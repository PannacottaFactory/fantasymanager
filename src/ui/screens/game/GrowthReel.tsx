/**
 * The week's progress of the player's creatures, made to be enjoyed: an XP bar that fills (and wraps with a
 * « Level N! » burst on a level-up), attribute gains popping one after another, new abilities, points to place.
 * Built from the creatures at the start and at the end of the week. Display only.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { levelOf, maxLevelOf } from '../../../engine/progression/levels.ts';
import { weekGrowth } from '../../growth.ts';
import { abilityText, attributeText } from '../../../engine/text/localize.ts';
import { Crest, Modal } from '../../components/common.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { effectsOn, useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { play } from '../../sound/sfx.ts';

const PER = DEFAULT_CONFIG.training.levels.xpPerLevel;

export function GrowthReel({ before, after, onOpen }: { before: GameState; after: GameState; onOpen?: () => void }) {
  const { t, lang } = useT();
  // Opening a sheet (to place points) closes the window holding the reel first, so the sheet is not hidden under it.
  const openSheet = (id: string) => {
    onOpen?.();
    useGame.getState().openSheet(id);
  };
  const list = weekGrowth(before, after);
  const refs = useRef(new Map<string, HTMLElement>());
  const ups = list.filter((g) => g.lv1 > g.lv0).map((g) => g.c.id);
  const upsKey = ups.join(',');
  useEffect(() => {
    if (!upsKey) return;
    const sound = window.setTimeout(() => play('levelUp'), 800);
    if (!effectsOn()) return () => window.clearTimeout(sound);
    // Sparkles when the bars wrap round.
    const timer = window.setTimeout(() => {
      for (const id of upsKey.split(',')) {
        const at = centreOf(refs.current.get(id));
        if (at) fxLayer()?.sparkle(at.x, at.y, true);
      }
    }, 800);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(sound);
    };
  }, [upsKey]);
  if (!list.length) return <p className="faint">{t('grow.none')}</p>;
  return (
    <div className="grow-reel">
      {list.map((g, i) => {
        const up = g.lv1 > g.lv0;
        const atMax = g.lv1 >= maxLevelOf(g.c);
        const style = { '--from': `${(100 * g.from) / PER}%`, '--to': `${atMax ? 100 : (100 * g.to) / PER}%`, '--delay': `${i * 140}ms` } as CSSProperties;
        return (
          <div
            key={g.c.id}
            className={`grow-card ${up ? 'up' : ''}`}
            style={style}
            ref={(el) => {
              if (el) refs.current.set(g.c.id, el);
              else refs.current.delete(g.c.id);
            }}
          >
            <button className="grow-head link-plain" onClick={() => openSheet(g.c.id)}>
              <Crest speciesId={g.c.speciesId} name={g.c.name} size={30} level={levelOf(g.c)} />
              <span className="grow-name">
                <b>{g.c.name}</b>
                <small className="muted">{t('lvl.short', { n: g.lv1 })}</small>
              </span>
              {g.xp > 0 && <span className="grow-xp">{t('grow.xp', { n: g.xp })}</span>}
            </button>
            <div className="grow-bar">
              <i className={up ? 'wrap' : 'fill'} style={{ width: 'var(--to)' }} />
            </div>
            {up && <span className="grow-level">{t('grow.levelUp', { n: g.lv1 })}</span>}
            {atMax && <small className="faint">{t('grow.maxed')}</small>}
            {(g.attrs.length > 0 || g.abilities.length > 0 || (up && (g.c.growth?.freePoints ?? 0) > 0)) && (
              <div className="grow-chips">
                {g.attrs.map((a, j) => (
                  <span key={a.k} className={`grow-chip ${a.d > 0 ? 'plus' : 'minus'}`} style={{ animationDelay: `calc(var(--delay) + ${900 + j * 160}ms)` }}>
                    {a.d > 0 ? '+' : '−'}
                    {Math.abs(a.d)} {attributeText(a.k, lang).name}
                  </span>
                ))}
                {g.abilities.map((id, j) => (
                  <span key={id} className="grow-chip ability" style={{ animationDelay: `calc(var(--delay) + ${1100 + (g.attrs.length + j) * 160}ms)` }}>
                    ✦ {t('grow.ability', { name: abilityText(id, lang).name })}
                  </span>
                ))}
                {up && (g.c.growth?.freePoints ?? 0) > 0 && (
                  <button className="grow-chip point" style={{ animationDelay: `calc(var(--delay) + 1300ms)` }} onClick={() => openSheet(g.c.id)}>
                    + {t('grow.point')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** After every player match: its XP filling the bars (level-ups, attributes, abilities), before the after-match training. */
export function MatchProgress() {
  const { t } = useT();
  const progress = useGame((s) => s.progress);
  const match = useGame((s) => s.match);
  const viewing = useGame((s) => s.viewing);
  if (!progress || match || viewing) return null;
  const close = () => useGame.getState().closeProgress();
  return (
    <Modal
      title={t('progress.title')}
      onClose={close}
      className="progress-dialog"
      actions={
        <button className="btn primary" onClick={close} autoFocus>
          {t('drill.done')}
        </button>
      }
    >
      <GrowthReel before={progress.before} after={progress.after} onOpen={close} />
    </Modal>
  );
}
