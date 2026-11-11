/**
 * Band under the top bar: the season as a rail from pre-season to the end. The rail fills up to the current week;
 * each week is a medallion (league result: green win, red defeat, hollow = to play) with a small diamond per cup or
 * tournament match in its colour; the current week is enlarged, mid-season is marked. Click = the schedule.
 */
import type { CSSProperties } from 'react';
import { lastMatchday } from '../../engine/league/season.ts';
import type { GameState } from '../../engine/league/types.ts';
import { useT } from '../i18n/index.ts';
import { byWeek, itemLabel, playerSeason, type SeasonItem } from '../season.ts';
import { useGame } from '../store/gameStore.ts';

export function SeasonRibbon({ game }: { game: GameState }) {
  const { t } = useT();
  const items = playerSeason(game);
  const weeks = new Map(byWeek(items).map((w) => [w.week, w.items]));
  const n = lastMatchday(game);
  const next = items.find((x) => !x.played && !x.maybe);
  const current = next ? next.week : n + 1;
  // Columns: pre-season, weeks 1…n, the end.
  const cols = n + 2;
  const fill = Math.min(1, current / (cols - 1));
  const mid = Math.ceil(n / 2);
  const tip = (x: SeasonItem, week: number) => {
    const when = week === 0 ? t('cal.before') : t('cal.week', { d: week });
    const vs = x.opp ? ` · ${t('common.vs')} ${x.opp}` : '';
    const res = x.played && x.score ? ` · ${t(x.outcome === 'win' ? 'ribbon.win' : 'ribbon.loss')} ${x.score[0]}–${x.score[1]}` : x.maybe ? ` · ${t('ribbon.ifThrough')}` : ` · ${t('ribbon.toPlay')}`;
    return `${when} — ${itemLabel(t, x)}${vs}${res}`;
  };
  const state = (x: SeasonItem) => (x.played ? x.outcome! : x.maybe ? 'maybe' : 'todo');
  return (
    <button className="season-ribbon" onClick={() => useGame.getState().openLeague('comps')} title={t('ribbon.hint')}>
      <span className="sr-label">
        <b>{t('ribbon.season', { s: game.season })}</b>
        <small>{current === 0 ? t('cal.before') : current > n ? t('ribbon.end') : t('ribbon.week', { d: current, n })}</small>
      </span>
      <span className="sr-track" style={{ '--cols': cols, '--fill': fill } as CSSProperties}>
        <span className="sr-rail">
          <i />
        </span>
        {Array.from({ length: cols }, (_, w) => {
          const end = w === cols - 1;
          const list = end ? [] : (weeks.get(w) ?? []);
          const league = list.find((x) => x.league);
          const comps = list.filter((x) => !x.league);
          const when = w < current ? 'past' : w === current ? 'now' : 'later';
          return (
            <span key={w} className={`sr-col ${when} ${w === mid ? 'mid' : ''} ${end ? 'end' : ''} ${w === 0 ? 'pre' : ''}`}>
              {w === mid && <span className="sr-mid">{t('ribbon.mid')}</span>}
              <span className="sr-node-wrap">
                {end ? (
                  <span className="sr-node flag">⚑</span>
                ) : league ? (
                  <span className={`sr-node ${state(league)} ${league === next ? 'next' : ''}`} title={tip(league, w)} />
                ) : (
                  <span className={`sr-node blank ${comps.some((x) => x === next) ? 'next' : ''}`} />
                )}
                {comps.length > 0 && (
                  <span className="sr-comps">
                    {comps.map((x, i) => (
                      <i key={i} className={`sr-comp def-${x.def} ${state(x)} ${x === next ? 'next' : ''}`} title={tip(x, w)} />
                    ))}
                  </span>
                )}
              </span>
              <span className="sr-num">{end ? t('ribbon.end') : w === 0 ? t('ribbon.pre') : w}</span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
