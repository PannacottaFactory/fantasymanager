/** Languages the game can be played in. Code identifiers always stay in English. */
export type Lang = 'en' | 'fr';

export const LANGS: readonly Lang[] = ['fr', 'en'];
export const DEFAULT_LANG: Lang = 'fr';

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'fr';
}
