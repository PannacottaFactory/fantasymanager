/**
 * "How training works", in four cards (when XP comes, levels, what the program does, intensity & boosts).
 * Collapsible; the open/closed choice is remembered per viewer. Every number comes from the config.
 */
import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';

const KEY = 'fm.trainingGuide';

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
}
function writeOpen(open: boolean) {
  try {
    localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    /* storage unavailable */
  }
}

export function TrainingGuide() {
  const tr = useT();
  const { t, lang } = tr;
  const [open, setOpen] = useState(readOpen);
  const c = DEFAULT_CONFIG.training;
  const n = (v: number) => (lang === 'fr' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(Math.round(v * 100) / 100));
  const x = c.xp;
  // A typical match: starter, rating 7, win.
  const typical = x.played + x.starter + 2 * x.perRatingPoint + x.win;
  const vars: Record<string, string | number> = {
    played: n(x.played), starter: n(x.starter), rating: n(x.perRatingPoint), win: n(x.win), typical: Math.round(typical),
    perLevel: c.levels.xpPerLevel, max: c.levels.max,
    young: n(c.stage.young), prime: n(c.stage.prime),
    focus: n(c.programs.physical.physical), rest: c.restRecovery,
    light: n(c.intensity.light.growth), lightF: -c.intensity.light.fatigue, intense: n(c.intensity.intense.growth), intenseF: c.intensity.intense.fatigue,
    noCoach: n(c.coaches.noCoach), bestCoach: n(c.coaches.base + 20 * c.coaches.perQuality),
    ground: Math.round(DEFAULT_CONFIG.club.facilities.training.growth * 100),
  };
  const card = (id: string, icon: string, lines: number) => (
    <div className="guide-card">
      <h4>
        <span aria-hidden="true">{icon}</span> {t(`guide.${id}.title` as StringKey)}
      </h4>
      <ul>
        {Array.from({ length: lines }, (_, i) => (
          <li key={i}>{t(`guide.${id}.${i + 1}` as StringKey, vars)}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <details
      className="training-guide"
      open={open}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(o);
        writeOpen(o);
      }}
    >
      <summary>
        <b>{t('guide.title')}</b> <span className="faint">{open ? t('guide.hide') : t('guide.show')}</span>
      </summary>
      <div className="guide-grid">
        {card('when', '⏱', 4)}
        {card('levels', '⭐', 3)}
        {card('program', '🎯', 4)}
        {card('boost', '⚡', 4)}
      </div>
    </details>
  );
}
