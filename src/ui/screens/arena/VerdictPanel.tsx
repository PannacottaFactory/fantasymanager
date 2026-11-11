/**
 * "Why this result?" and "For the next match": the main reasons of a win or a loss, with numbers, and two or three
 * concrete things to try, each with a button to the screen where it is done.
 */
import { useMemo } from 'react';
import { normalizeSeed } from '../../../core/rng.ts';
import type { MatchResult, MatchSetup } from '../../../engine/combat/types.ts';
import { explainMatch, type TipTarget } from '../../../engine/report/verdict.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

/** The line-ups before the match: given (arena) or found in the stable's match history (league). */
function useSetup(result: MatchResult, given?: MatchSetup): MatchSetup | undefined {
  const history = useGame((s) => s.game?.matchHistory);
  return useMemo(() => {
    if (given) return given;
    return [...(history ?? [])]
      .reverse()
      .find((h) => normalizeSeed(h.setup.seed) === result.seed && h.setup.teams[0].id === result.teams[0].id && h.setup.teams[1].id === result.teams[1].id)?.setup;
  }, [given, history, result]);
}

export function VerdictPanel({ result, setup }: { result: MatchResult; setup?: MatchSetup }) {
  const { t } = useT();
  const game = useGame((s) => s.game);
  const before = useSetup(result, setup);
  const v = useMemo(() => explainMatch(result, 0, before), [result, before]);
  const vars = (x: Record<string, string | number>) => ({
    ...x,
    casters: t('target.casters'),
    weakest: t('target.weakest'),
    cautious: t('orders.cautious'),
    pct: x.pct,
  });
  const go = (to: TipTarget) => {
    if (to === 'encyclopedia') useGame.getState().setScreen('encyclopedia');
    else if (game) useGame.getState().setScreen(to);
  };
  return (
    <section className={`panel verdict ${v.won ? 'won' : 'lost'}`}>
      <div className="verdict-cols">
        <div>
          <h3>{v.won ? t('verdict.whyWin') : t('verdict.whyLoss')}</h3>
          {v.factors.length === 0 && <div className="muted">{t('verdict.nothing')}</div>}
          <ul className="verdict-list">
            {v.factors.map((f) => (
              <li key={f.key} className={f.tone}>
                <span className="ico">{f.tone === 'good' ? '▲' : f.tone === 'bad' ? '▼' : '•'}</span>
                <span>{t(`verdict.f.${f.key}` as StringKey, vars(f.vars))}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>💡 {t('verdict.next')}</h3>
          <ul className="verdict-list tips">
            {v.tips.map((tip) => (
              <li key={tip.key}>
                <span className="grow">{t(`verdict.t.${tip.key}` as StringKey, vars(tip.vars))}</span>
                {tip.to && (game || tip.to === 'encyclopedia') && (
                  <button className="btn small" onClick={() => go(tip.to!)}>
                    {t(`verdict.go.${tip.to}` as StringKey)} →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
