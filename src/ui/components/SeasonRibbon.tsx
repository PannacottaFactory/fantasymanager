/**
 * Band under the top bar: the season as a row of week tiles (pre-season, weeks 1…n, the end). Each tile carries the
 * week number; a played league match colours it (green win, red defeat, « KO » corner when it ended by KO), the next
 * match is filled with the accent colour, cup / tournament matches are small badges in their competition's colour.
 * On the right, the next match in words. Click = the schedule.
 */
import { lastMatchday, teamById } from '../../engine/league/season.ts';
import type { GameState } from '../../engine/league/types.ts';
import { useT } from '../i18n/index.ts';
import { byWeek, currentWeek, itemLabel, playerSeason, type SeasonItem } from '../season.ts';
import { useGame } from '../store/gameStore.ts';
import { StableCrest } from './TeamCrest.tsx';
import { UiIcon } from '../icons/Icon.tsx';

export function SeasonRibbon({ game }: { game: GameState }) {
  const { t } = useT();
  const items = playerSeason(game);
  const weeks = new Map(byWeek(items).map((w) => [w.week, w.items]));
  const n = lastMatchday(game);
  const next = items.find((x) => !x.played && !x.maybe);
  const current = currentWeek(game);
  const mid = Math.ceil(n / 2);
  const played = items.filter((x) => x.played);
  const wins = played.filter((x) => x.outcome === 'win').length;
  const tip = (x: SeasonItem, week: number) => {
    const when = week === 0 ? t('cal.before') : t('cal.week', { d: week });
    const vs = x.opp ? ` · ${t('common.vs')} ${x.opp}` : '';
    const res = x.played && x.score ? ` · ${t(x.outcome === 'win' ? 'ribbon.win' : 'ribbon.loss')} ${x.score[0]}–${x.score[1]}` : x.maybe ? ` · ${t('ribbon.ifThrough')}` : ` · ${t('ribbon.toPlay')}`;
    return `${when} — ${itemLabel(t, x)}${vs}${res}`;
  };
  const state = (x: SeasonItem) => (x.played ? x.outcome! : x.maybe ? 'maybe' : 'todo');
  const oppTeam = next?.oppId ? teamById(game, next.oppId) : undefined;
  return (
    <button className="season-ribbon" onClick={() => useGame.getState().openLeague('comps')} title={t('ribbon.hint')}>
      <span className="sr-label">
        <b>{t('ribbon.season', { s: game.season })}</b>
        <small>{current === 0 ? t('cal.before') : current > n ? t('ribbon.end') : t('ribbon.week', { d: current, n })}</small>
        {played.length > 0 && <small className="sr-record">{t('ribbon.record', { w: wins, l: played.length - wins })}</small>}
      </span>
      <span className="sr-track">
        {Array.from({ length: n + 2 }, (_, w) => {
          const end = w === n + 1;
          const list = end ? [] : (weeks.get(w) ?? []);
          const league = list.find((x) => x.league);
          const comps = list.filter((x) => !x.league);
          const when = w < current ? 'past' : w === current ? 'now' : 'later';
          const isNext = !!next && list.includes(next);
          const cls = ['sr-week', when, league ? state(league) : 'free', isNext ? 'next' : '', w === mid + 1 ? 'mid' : '', end ? 'end' : '', w === 0 ? 'pre' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <span key={w} className={cls} title={league ? tip(league, w) : end ? t('ribbon.end') : w === 0 ? t('cal.before') : undefined}>
              <span className="sr-num">{end ? <UiIcon name="flag" size="1em" /> : w === 0 ? t('ribbon.pre') : w}</span>
              {league?.played && league.ko && <span className="sr-ko">KO</span>}
              {comps.length > 0 && (
                <span className="sr-comps">
                  {comps.map((x, i) => (
                    <i key={i} className={`sr-comp def-${x.def} ${state(x)} ${x === next ? 'next' : ''}`} title={tip(x, w)} />
                  ))}
                </span>
              )}
            </span>
          );
        })}
      </span>
      {next && (
        <span className={`sr-next ${next.league ? '' : `def-${next.def}`}`}>
          <small>
            {t('ribbon.next')} · {next.week === 0 ? t('cal.before') : t('cal.week', { d: next.week })}
          </small>
          <span className="sr-next-line">
            {oppTeam && <StableCrest team={oppTeam} size={16} />}
            <b>{next.opp ?? t('ribbon.tbd')}</b>
          </span>
          <small className="sr-next-comp">{itemLabel(t, next)}</small>
        </span>
      )}
    </button>
  );
}
