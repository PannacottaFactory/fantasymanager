import { TEXT_SIZES, useSettings, useT, type TextSize } from '../i18n/index.ts';
import { Seg } from '../components/common.tsx';
import type { StringKey } from '../i18n/strings.ts';
import { useTutorial } from '../tutorial/tutorial.ts';

const SECTIONS = ['goal', 'week', 'combat', 'roles', 'squad', 'economy', 'recruit', 'training', 'competitions', 'club'] as const;
const ICON: Record<(typeof SECTIONS)[number], string> = {
  goal: '🎯',
  week: '📅',
  combat: '⚔',
  roles: '🛡',
  squad: '🐉',
  economy: '💰',
  recruit: '🔍',
  training: '💪',
  competitions: '🏆',
  club: '🏛',
};

/** Always-available manual, plus tutorial controls. */
export function HelpScreen() {
  const { t } = useT();
  const { enabled, restart, setEnabled } = useTutorial();
  const { textSize, setTextSize } = useSettings();
  return (
    <div className="stack narrow">
      <section className="panel">
        <div className="panel-head">
          <h2>❓ {t('help.title')}</h2>
          <span className="spacer" />
          <button className="btn small primary" onClick={restart}>
            {t('help.restart')}
          </button>
          <label className="row" style={{ fontSize: '0.929rem', gap: 6 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t('help.tips')}
          </label>
          <Seg<TextSize> value={textSize} onChange={setTextSize} options={TEXT_SIZES.map((s) => ({ value: s, label: t(`text.${s}`) }))} />
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('help.intro')}
        </p>
      </section>
      {SECTIONS.map((s) => (
        <section key={s} className="panel help-section">
          <h3>
            {ICON[s]} {t(`help.${s}.title` as StringKey)}
          </h3>
          {t(`help.${s}.body` as StringKey)
            .split('\n')
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </section>
      ))}
      <p className="faint" style={{ fontSize: '0.857rem', textAlign: 'center' }}>
        {t('help.credits')}{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
      </p>
    </div>
  );
}
