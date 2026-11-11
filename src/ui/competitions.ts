/** Names and looks of divisions and competitions (display only). */
import type { StringKey } from './i18n/strings.ts';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/** Name of a division: 0 = the Grand Arena (top) … 3 = the Marches League. */
export const divName = (t: T, d: number) => t(`div.${Math.max(0, Math.min(3, d))}` as StringKey);

/** Tournament definition from a tournament id ("division-2" → "division"); undefined = the Shadow Cup. */
export const compDef = (id?: string) => (!id || id === 'shadow' ? 'shadow' : id.startsWith('division') ? 'division' : id);

/** Name of a competition: the Shadow Cup (no id), a tournament id, or a definition id. */
export function compName(t: T, id?: string): string {
  const def = compDef(id);
  if (def === 'shadow') return t('cup.title');
  if (def === 'division') {
    const d = Number(id?.split('-')[1] ?? 0);
    return t(`comp.division.${Math.max(0, Math.min(3, d))}` as StringKey);
  }
  return t(`comp.${def}` as StringKey);
}

/** Emblem of each competition and division. */
export const COMP_ICON: Record<string, string> = { shadow: '🏆', division: '🛡', champions: '👑', preseason: '⚑', marches: '🏮', argent: '🥈', or: '🥇' };
export const DIV_ICON = ['👑', '🦁', '🏰', '⛺'];

/** Name of a round, counted from the final. */
export function roundKey(round: number, rounds: number): StringKey {
  const fromFinal = rounds - 1 - round;
  return (['cup.final', 'cup.semi', 'cup.quarter', 'cup.r16', 'cup.r32'] as const)[fromFinal] ?? 'cup.prelim';
}
