/**
 * Team talk picker: before the match (with « let the assistant choose ») and at each break. Every talk shows what it
 * does with the config numbers; the assistant's advice is worded from `readTalk`.
 */
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { TALKS, type TalkAdvice } from '../../engine/combat/talks.ts';
import type { Talk } from '../../engine/model.ts';
import { useT, type Translator } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { UiIcon } from '../icons/Icon.tsx';

/** Numbers of a talk's description, from the config. */
export function talkVars(talk: Talk, lang: string): Record<string, string | number> {
  const k = DEFAULT_CONFIG.combat.orders.talks;
  const p = (x: number) => {
    const v = String(Math.round(x * 1000) / 10);
    return lang === 'fr' ? v.replace('.', ',') : v;
  };
  switch (talk) {
    case 'rally':
      return { p: p(k.rally.share), t: k.rally.target };
    case 'secondWind':
      return { p: p(k.secondWind.share) };
    case 'focus':
      return { p: p(k.focus.hit) };
    case 'ranks':
      return { m: p(k.ranks.mitigation), i: p(k.ranks.intercept) };
    case 'evade':
      return { p: p(k.evade.dodge) };
    case 'fury':
      return { d: p(k.fury.damage), c: p(k.fury.cost) };
  }
}

export const talkName = (tr: Translator, talk: Talk) => tr.t(`talk.${talk}` as StringKey);
export const talkDesc = (tr: Translator, talk: Talk) => tr.t(`talk.${talk}.desc` as StringKey, talkVars(talk, tr.lang));
export const adviceText = (tr: Translator, a: TalkAdvice) => tr.t('talk.advice', { talk: talkName(tr, a.talk), reason: tr.t(`talk.reason.${a.reason}` as StringKey) });

interface Props {
  /** Chosen talk; undefined = the assistant chooses (pre-match only). */
  value: Talk | undefined;
  onChange: (t: Talk | undefined) => void;
  advice: TalkAdvice;
  /** Offer « let the assistant choose » (pre-match). */
  assistant?: boolean;
}

export function TalkPicker({ value, onChange, advice, assistant }: Props) {
  const tr = useT();
  const { t } = tr;
  const shown = value ?? (assistant ? undefined : advice.talk);
  const desc = shown ? talkDesc(tr, shown) : t('talk.assistant.desc', { talk: talkName(tr, advice.talk) });
  return (
    <div className="talk-picker">
      <div className="talk-options" role="radiogroup" aria-label={t('talk.heading')}>
        {assistant && (
          <button
            role="radio"
            aria-checked={value === undefined}
            className={`talk-opt assistant ${value === undefined ? 'on' : ''}`}
            onClick={() => onChange(undefined)}
            title={t('talk.assistant.desc', { talk: talkName(tr, advice.talk) })}
          >
            <UiIcon name="talk-assistant" /> {t('talk.assistant')}
          </button>
        )}
        {TALKS.map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={shown === k}
            className={`talk-opt ${shown === k ? 'on' : ''} ${advice.talk === k ? 'advised' : ''}`}
            onClick={() => onChange(k)}
            title={talkDesc(tr, k)}
          >
            <UiIcon name={`talk-${k}`} /> {talkName(tr, k)}
          </button>
        ))}
      </div>
      <div className="talk-desc muted">{desc}</div>
      <div className="talk-advice">
        <UiIcon name="tip" /> {adviceText(tr, advice)}
      </div>
    </div>
  );
}
