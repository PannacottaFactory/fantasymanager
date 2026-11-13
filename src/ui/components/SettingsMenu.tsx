/**
 * One settings button in the top bar for the viewer's preferences (language, text size, visual effects, sound, theme), so the
 * navigation tabs keep room for their names.
 */
import { useEffect, useRef, useState } from 'react';
import { LANGS } from '../../core/i18n.ts';
import { TEXT_SIZES, THEMES, useSettings, useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { UiIcon } from '../icons/Icon.tsx';
import { play } from '../sound/sfx.ts';

export function SettingsMenu() {
  const { t } = useT();
  const { lang, setLang, theme, setTheme, textSize, setTextSize, effects, setEffects, volume, setVolume } = useSettings();
  // Volume before muting, to come back to it.
  const before = useRef(volume || 0.5);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="settings" ref={ref}>
      <button className={`btn small ghost settings-btn ${open ? 'active' : ''}`} title={t('settings.title')} aria-label={t('settings.title')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <UiIcon name="settings" size="1.2em" />
        <span className="settings-lang">{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label={t('settings.title')}>
          <div className="settings-head">
            <UiIcon name="settings" size="1.1em" />
            <b>{t('settings.title')}</b>
          </div>
          <div className="settings-block">
            <span className="settings-label">{t('settings.lang')}</span>
            <div className="opt-seg" role="radiogroup">
              {LANGS.map((l) => (
                <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)} role="radio" aria-checked={l === lang}>
                  {l === 'fr' ? 'Français' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-block">
            <span className="settings-label">{t('settings.text')}</span>
            <div className="opt-seg text-sizes" role="radiogroup">
              {TEXT_SIZES.map((s, i) => (
                <button key={s} className={s === textSize ? 'on' : ''} onClick={() => setTextSize(s)} role="radio" aria-checked={s === textSize} title={t(`text.${s}` as StringKey)}>
                  <span className="ts-a" style={{ fontSize: `${0.9 + i * 0.22}rem` }}>A</span>
                  <small>{t(`text.short.${s}` as StringKey)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="settings-block">
            <span className="settings-label">{t('settings.theme')}</span>
            <div className="opt-seg themes" role="radiogroup">
              {THEMES.map((th) => (
                <button key={th} className={th === theme ? 'on' : ''} onClick={() => setTheme(th)} role="radio" aria-checked={th === theme} title={t(`theme.${th}` as StringKey)}>
                  <i className={`theme-chip ${th}`}><i /></i>
                  <small>{t(`theme.short.${th}` as StringKey)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="settings-sep" />
          <div className="settings-line">
            <span className="settings-label">{t('settings.effects')}</span>
            <button
              className={`opt-switch ${effects === 'full' ? 'on' : ''}`}
              role="switch"
              aria-checked={effects === 'full'}
              aria-label={t('settings.effects')}
              onClick={() => setEffects(effects === 'full' ? 'reduced' : 'full')}
            >
              <i />
              <span>{t(effects === 'full' ? 'settings.on' : 'settings.off')}</span>
            </button>
          </div>
          <div className="settings-line">
            <span className="settings-label">{t('settings.sound')}</span>
            <span className="volume-row">
              <button
                className="btn small ghost"
                title={t(volume > 0 ? 'settings.mute' : 'settings.unmute')}
                aria-label={t(volume > 0 ? 'settings.mute' : 'settings.unmute')}
                onClick={() => {
                  if (volume > 0) {
                    before.current = volume;
                    setVolume(0);
                  } else {
                    setVolume(before.current || 0.5);
                    play('coin');
                  }
                }}
              >
                <UiIcon name={volume > 0 ? 'sound-on' : 'sound-off'} size="1.15em" />
              </button>
              <input
                type="range"
                className="volume"
                min={0}
                max={100}
                step={5}
                value={Math.round(volume * 100)}
                style={{ ['--v' as string]: `${Math.round(volume * 100)}%` }}
                aria-label={t('settings.sound')}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                onPointerUp={() => play('coin')}
                onKeyUp={() => play('coin')}
              />
              <span className="volume-val">{Math.round(volume * 100)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
