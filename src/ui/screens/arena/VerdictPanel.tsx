/**
 * "Why this result?" and "For the next match": the main reasons of a win or a loss, with numbers, and two or three
 * concrete things to try, each with a button to the screen where it is done.
 */
import { useMemo } from 'react';
import { normalizeSeed } from '../../../core/rng.ts';
import type { MatchResult, MatchSetup } from '../../../engine/combat/types.ts';
import { explainMatch, type Tip, type TipTarget } from '../../../engine/report/verdict.ts';
import { nextMatchAdvice } from '../../../engine/report/advice.ts';
import { playerTeam, teamById } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { byWeek, playerSeason } from '../../season.ts';
import { useT } from '../../i18n/index.ts';
import { effectText } from '../../../engine/text/localize.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { UiIcon } from '../../icons/Icon.tsx';

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

/** Tips about the next opponent — only after the player's latest match of a game. */
function useNextTips(result: MatchResult, game: GameState | null): { foe: string; tips: Tip[] } | null {
  return useMemo(() => {
    if (!game) return null;
    const last = game.matchHistory?.at(-1);
    if (!last || normalizeSeed(last.setup.seed) !== result.seed) return null;
    const weeks = byWeek(playerSeason(game).filter((x) => !x.played && !x.maybe));
    const next = weeks[0]?.items.find((x) => x.oppId);
    if (!next?.oppId) return null;
    const foe = teamById(game, next.oppId);
    const tips = nextMatchAdvice({ team: playerTeam(game), foe, double: (weeks[0]?.items.length ?? 0) >= 2 });
    return { foe: foe.name, tips: tips.slice(0, 3) };
  }, [result, game]);
}

export function VerdictPanel({ result, setup }: { result: MatchResult; setup?: MatchSetup }) {
  const { t, lang } = useT();
  const game = useGame((s) => s.game);
  const before = useSetup(result, setup);
  const v = useMemo(() => explainMatch(result, 0, before), [result, before]);
  const next = useNextTips(result, game);
  // Lessons of the match first; at most five tips in all, with something about the next opponent when there is.
  const lessons = next?.tips.length ? v.tips.filter((x) => x.key !== 'keepGoing').slice(0, 5 - Math.min(2, next.tips.length)) : v.tips;
  const ahead = next ? next.tips.filter((x) => !lessons.some((l) => l.key === 'rest' && x.key === 'nextRest')).slice(0, 5 - lessons.length) : [];
  const order = (a: string | number | undefined) => (a === 'cautious' || a === 'balanced' || a === 'aggressive' ? t(`orders.${a}`) : String(a ?? ''));
  const vars = (x: Record<string, string | number>) => ({
    ...x,
    casters: t('target.casters'),
    weakest: t('target.weakest'),
    strongest: t('target.strongest'),
    cautious: t('orders.cautious'),
    ours: order(x.ours),
    theirs: order(x.theirs),
    counter: order(x.counter),
    effect: x.effect ? effectText(String(x.effect), lang).name : '',
    rating: typeof x.rating === 'string' && lang === 'fr' ? x.rating.replace('.', ',') : x.rating,
  });
  const TipList = ({ tips }: { tips: Tip[] }) => (
    <ul className="verdict-list tips">
      {tips.map((tip) => (
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
  );
  const go = (to: TipTarget) => {
    if (to === 'encyclopedia') useGame.getState().setScreen('encyclopedia');
    else if (game) useGame.getState().setScreen(to);
  };
  return (
    <section className={`panel verdict ${v.won ? 'won' : 'lost'}`} data-tip="report">
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
          {v.counterpoint && (
            <div className={`verdict-counter ${v.counterpoint.tone}`}>
              <span className="faint">{v.won ? t('verdict.butWin') : t('verdict.butLoss')}</span>{' '}
              {t(`verdict.f.${v.counterpoint.key}` as StringKey, vars(v.counterpoint.vars))}
            </div>
          )}
        </div>
        <div>
          <h3><UiIcon name="tip" /> {t('verdict.next')}</h3>
          {ahead.length > 0 && lessons.length > 0 && <div className="faint small">{t('verdict.lesson')}</div>}
          <TipList tips={lessons} />
          {ahead.length > 0 && (
            <>
              <div className="faint small">{t('verdict.ahead')} — {next!.foe}</div>
              <TipList tips={ahead} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
