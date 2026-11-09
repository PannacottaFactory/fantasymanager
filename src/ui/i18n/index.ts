/**
 * UI language & theme preferences (per viewer, kept in localStorage) and the translation hook.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { DEFAULT_LANG, isLang, type Lang } from '../../core/i18n.ts';
import { fill } from '../../core/text.ts';
import { en, fr, type StringKey } from './strings.ts';

export type Theme = 'dark' | 'parchment';

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

interface SettingsState {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  lang: (() => {
    const v = read(LANG_KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  })(),
  theme: read(THEME_KEY) === 'parchment' ? 'parchment' : 'dark',
  setLang: (lang) => {
    write(LANG_KEY, lang);
    set({ lang });
  },
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    set({ theme });
  },
}));

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
  /** Amount of crowns: "12 500 ⚜" / "12,500 ⚜"; compact: "12,5 k⚜". */
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
      const sign = n < 0 ? '−' : '';
      const a = Math.abs(Math.round(n));
      if (compact && a >= 10000) {
        const k = (a / 1000).toFixed(a >= 100000 ? 0 : 1);
        return `${sign}${lang === 'fr' ? k.replace('.', ',') : k} k⚜`;
      }
      const s = String(a).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? ' ' : ',');
      return `${sign}${s} ⚜`;
    },
  };
}

/** Translation helpers for the current language. */
export function useT(): Translator {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => makeTranslator(lang), [lang]);
}
