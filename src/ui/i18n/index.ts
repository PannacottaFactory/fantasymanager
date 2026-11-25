/**
 * UI language & theme preferences (per viewer, kept in localStorage) and the translation hook.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { DEFAULT_LANG, isLang, type Lang } from '../../core/i18n.ts';
import { fill } from '../../core/text.ts';
import { en, fr, type StringKey } from './strings.ts';

export type Theme = 'night' | 'dark' | 'parchment' | 'slate';
export const THEMES: Theme[] = ['slate', 'parchment', 'dark', 'night'];
/** Where the navigation sits: a sidebar on the left (manager-game style, default) or tabs in the top bar. */
export type Layout = 'side' | 'top';
export const LAYOUTS: Layout[] = ['side', 'top'];
const LAYOUT_KEY = 'fm.layout';
export type TextSize = 'normal' | 'large' | 'xlarge';
export const TEXT_SIZES: TextSize[] = ['normal', 'large', 'xlarge'];
/** Multiplier of the 14 px base text. */
export const TEXT_SCALE: Record<TextSize, number> = { normal: 1, large: 1.15, xlarge: 1.3 };
const TEXT_KEY = 'ui.textSize';

const LANG_KEY = 'ui.lang';
const THEME_KEY = 'ui.theme';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export type EffectsLevel = 'full' | 'reduced';
const EFFECTS_KEY = 'fm.effects';
const VOLUME_KEY = 'fm.volume';
const RETRO_KEY = 'fm.retro';
const RETRO_FONT_KEY = 'fm.retroFont';
/** Screen filters: none, cathode-ray tube, handheld LCD (pixel grid, green cast), monochrome amber monitor. */
export type RetroFilter = 'off' | 'crt' | 'lcd' | 'amber';
export const RETRO_FILTERS: RetroFilter[] = ['off', 'crt', 'lcd', 'amber'];
/** Retro fonts: none, pixel titles only (body stays readable), terminal everywhere, pixel everywhere. */
export type RetroFont = 'off' | 'titles' | 'terminal' | 'pixel';
export const RETRO_FONTS: RetroFont[] = ['off', 'titles', 'terminal', 'pixel'];
const CVD_KEY = 'fm.colorblind';
const READ_FONT_KEY = 'fm.readFont';
/** Red-green (protanopia / deuteranopia, the most common): blue against orange. Blue-yellow (tritanopia): teal against red. */
export type ColorBlind = 'off' | 'redgreen' | 'blueyellow';
export const COLOR_BLIND: ColorBlind[] = ['off', 'redgreen', 'blueyellow'];
/** OpenDyslexic (weighted letter bottoms) or Atkinson Hyperlegible (letters told apart, made for low vision). */
export type ReadFont = 'off' | 'fira' | 'dyslexic' | 'legible';
export const READ_FONTS: ReadFont[] = ['off', 'fira', 'dyslexic', 'legible'];
const systemReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

interface SettingsState {
  lang: Lang;
  theme: Theme;
  textSize: TextSize;
  /** Particles, shakes and celebrations (reduced: none). Defaults to the system's reduced-motion setting. */
  effects: EffectsLevel;
  setEffects: (e: EffectsLevel) => void;
  /** Sound effects volume, 0 (off) … 1. */
  volume: number;
  setVolume: (v: number) => void;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  setTextSize: (t: TextSize) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  /** Retro screen filter imitating an old machine (square corners, hard shadows, scanlines or pixel grid…). */
  retro: RetroFilter;
  setRetro: (f: RetroFilter) => void;
  /** Retro font, independent of the filter. */
  retroFont: RetroFont;
  setRetroFont: (f: RetroFont) => void;
  /** Colour-blind palette for the colours that carry meaning (good / bad, health, attribute scale, home / away). */
  colorblind: ColorBlind;
  setColorblind: (c: ColorBlind) => void;
  /** Reading font for the body text (titles keep theirs). */
  readFont: ReadFont;
  setReadFont: (f: ReadFont) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  lang: (() => {
    const v = read(LANG_KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  })(),
  theme: (() => {
    const v = read(THEME_KEY);
    return v === 'parchment' || v === 'dark' || v === 'night' || v === 'slate' ? v : 'slate';
  })(),
  layout: read(LAYOUT_KEY) === 'top' ? 'top' : 'side',
  setLayout: (layout) => {
    write(LAYOUT_KEY, layout);
    set({ layout });
  },
  setLang: (lang) => {
    write(LANG_KEY, lang);
    set({ lang });
  },
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    set({ theme });
  },
  textSize: (() => {
    const v = read(TEXT_KEY);
    return v === 'normal' || v === 'large' || v === 'xlarge' ? v : 'large';
  })(),
  setTextSize: (textSize) => {
    write(TEXT_KEY, textSize);
    set({ textSize });
  },
  effects: (() => {
    const v = read(EFFECTS_KEY);
    return v === 'full' || v === 'reduced' ? v : systemReduced() ? 'reduced' : 'full';
  })(),
  setEffects: (effects) => {
    write(EFFECTS_KEY, effects);
    set({ effects });
  },
  retro: (() => {
    const v = read(RETRO_KEY);
    // 'on' = the first test version (one switch): its CRT look.
    return v === 'on' ? 'crt' : RETRO_FILTERS.includes(v as RetroFilter) ? (v as RetroFilter) : 'off';
  })(),
  setRetro: (retro) => {
    write(RETRO_KEY, retro);
    set({ retro });
  },
  retroFont: (() => {
    const v = read(RETRO_FONT_KEY);
    return RETRO_FONTS.includes(v as RetroFont) ? (v as RetroFont) : 'off';
  })(),
  setRetroFont: (retroFont) => {
    write(RETRO_FONT_KEY, retroFont);
    set({ retroFont });
  },
  colorblind: (() => {
    const v = read(CVD_KEY);
    return COLOR_BLIND.includes(v as ColorBlind) ? (v as ColorBlind) : 'off';
  })(),
  setColorblind: (colorblind) => {
    write(CVD_KEY, colorblind);
    set({ colorblind });
  },
  readFont: (() => {
    const v = read(READ_FONT_KEY);
    return READ_FONTS.includes(v as ReadFont) ? (v as ReadFont) : 'off';
  })(),
  setReadFont: (readFont) => {
    write(READ_FONT_KEY, readFont);
    set({ readFont });
  },
  volume: (() => {
    const v = Number(read(VOLUME_KEY));
    return read(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  })(),
  setVolume: (volume) => {
    write(VOLUME_KEY, String(volume));
    set({ volume });
  },
}));

/** Are particles, shakes and celebrations wanted? (read outside React too) */
export const effectsOn = () => useSettings.getState().effects === 'full';

const DICTS: Record<Lang, Record<StringKey, string>> = { en, fr };

export type Vars = Record<string, string | number | undefined>;

export interface Translator {
  lang: Lang;
  t: (key: StringKey, vars?: Vars) => string;
  /** Decimal number with the language's separator. */
  dec: (n: number, digits?: number) => string;
  /** 1st / 1er, 2nd / 2e… */
  ordinal: (n: number) => string;
  weeks: (n: number) => string;
  /** Amount of gold: "12 500 po" / "12,500 gp"; compact: "12,5 k po". */
  money: (n: number, compact?: boolean) => string;
}

export function makeTranslator(lang: Lang): Translator {
  const dict = DICTS[lang];
  const t = (key: StringKey, vars?: Vars) => (vars ? fill(dict[key], vars) : dict[key]);
  return {
    lang,
    t,
    dec: (n, digits = 1) => (lang === 'fr' ? n.toFixed(digits).replace('.', ',') : n.toFixed(digits)),
    ordinal: (n) => {
      if (lang === 'fr') return n === 1 ? '1er' : `${n}e`;
      const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
      return `${n}${s}`;
    },
    weeks: (n) => (n === 1 ? t('weeks.one') : t('weeks.many', { n })),
    money: (n, compact) => {
      // Non-breaking spaces keep "12 500 po" on one line.
      const sign = n < 0 ? '−' : '';
      const a = Math.abs(Math.round(n));
      if (compact && a >= 10000) {
        const k = (a / 1000).toFixed(a >= 100000 ? 0 : 1);
        return `${sign}${lang === 'fr' ? k.replace('.', ',') : k}\u202fk\u00a0${t('money.unit')}`;
      }
      const s = String(a).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? '\u202f' : ',');
      return `${sign}${s}\u00a0${t('money.unit')}`;
    },
  };
}

/** Translation helpers for the current language. */
export function useT(): Translator {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => makeTranslator(lang), [lang]);
}
