/**
 * The week's progress of the player's creatures, made to be enjoyed: an XP bar that fills (and wraps with a
 * « Level N! » burst on a level-up), attribute gains popping one after another, new abilities, points to place.
 * Built from the creatures at the start and at the end of the week. Display only.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { ATTRIBUTE_KEYS } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { SPECIES } from '../../../data/species.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { levelOf, maxLevelOf, unlockLevel, xpInLevel } from '../../../engine/progression/levels.ts';
import { abilityText, attributeText } from '../../../engine/text/localize.ts';
import { Crest } from '../../components/common.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { effectsOn, useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { play } from '../../sound/sfx.ts';

const PER = DEFAULT_CONFIG.training.levels.xpPerLevel;
const totalXp = (c: Creature) => (levelOf(c) - 1) * PER + xpInLevel(c);

interface Growth {
  c: Creature;
  xp: number;
  from: number;
  to: number;
  lv0: number;
  lv1: number;
  attrs: { k: (typeof ATTRIBUTE_KEYS)[number]; d: number }[];
  abilities: string[];
}

export function weekGrowth(before: GameState, after: GameState): Growth[] {
  const was = new Map(playerTeam(before).creatures.map((c) => [c.id, c]));
  const out: Growth[] = [];
  for (const c of playerTeam(after).creatures) {
    const b = was.get(c.id);
    if (!b) continue;
    const lv0 = levelOf(b);
    const lv1 = levelOf(c);
    const xp = totalXp(c) - totalXp(b);
    const attrs = ATTRIBUTE_KEYS.map((k) => ({ k, d: c.attributes[k] - b.attributes[k] })).filter((a) => a.d !== 0);
    const abilities = (SPECIES[c.speciesId]?.abilities ?? []).filter((a) => {
      const l = unlockLevel(a.minAbility);
      return l > lv0 && l <= lv1;
    });
    if (xp <= 0 && !attrs.length && lv1 <= lv0) continue;
    out.push({ c, xp: Math.max(0, xp), from: xpInLevel(b), to: xpInLevel(c), lv0, lv1, attrs, abilities: abilities.map((a) => a.id) });
  }
  return out.sort((a, b) => b.lv1 - b.lv0 - (a.lv1 - a.lv0) || b.attrs.length - a.attrs.length || b.xp - a.xp);
}

export function GrowthReel({ before, after }: { before: GameState; after: GameState }) {
  const { t, lang } = useT();
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
            <button className="grow-head link-plain" onClick={() => useGame.getState().openSheet(g.c.id)}>
              <Crest speciesId={g.c.speciesId} name={g.c.name} size={30} />
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
                  <button className="grow-chip point" style={{ animationDelay: `calc(var(--delay) + 1300ms)` }} onClick={() => useGame.getState().openSheet(g.c.id)}>
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
