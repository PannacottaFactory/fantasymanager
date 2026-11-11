/**
 * TV-style news ticker along the bottom of the screen: next match, last result, leaders, cup, infirmary and the
 * latest league news, scrolling in a loop (static when effects are off). Display only.
 */
import { Fragment } from 'react';
import { divisionOf } from '../../engine/league/divisions.ts';
import { lastMatchday, playerFixture, playerTeam, seasonOver, standings, teamById } from '../../engine/league/season.ts';
import type { GameState } from '../../engine/league/types.ts';
import { useT, type Translator } from '../i18n/index.ts';
import { divName } from '../competitions.ts';
import { useGame } from '../store/gameStore.ts';
import { newsText } from '../screens/game/NewsScreen.tsx';
import { Gold } from './common.tsx';

function items(tr: Translator, game: GameState): string[] {
  const { t } = tr;
  const out: string[] = [];
  const me = playerTeam(game);
  const f = playerFixture(game);
  if (f && !seasonOver(game)) {
    const opp = teamById(game, f.home === me.id ? f.away : f.home);
    out.push(t('ticker.next', { a: me.name, b: opp.name, where: f.home === me.id ? t('common.home') : t('common.away') }));
  }
  const last = game.fixtures.filter((x) => x.result && (x.home === me.id || x.away === me.id)).at(-1);
  if (last?.result) {
    const side = last.home === me.id ? 0 : 1;
    const opp = teamById(game, side === 0 ? last.away : last.home).name;
    const won = last.result.winner === side;
    out.push(t(won ? 'ticker.lastWin' : 'ticker.lastLoss', { team: opp, a: last.result.score[side], b: last.result.score[side === 0 ? 1 : 0] }));
  }
  game.divisions.forEach((_, d) => {
    const top = standings(game, d)[0];
    if (top && top.played > 0) out.push(t('ticker.leader', { div: divName(t, d), team: teamById(game, top.teamId).name, pts: top.points }));
  });
  const mine = standings(game, divisionOf(game, me.id));
  const pos = mine.findIndex((r) => r.teamId === me.id) + 1;
  if (mine[pos - 1]?.played) out.push(t('ticker.position', { team: me.name, pos: tr.ordinal(pos), d: Math.min(game.matchday, lastMatchday(game)) }));
  if (game.cup.winner) out.push(t('ticker.cupWinner', { team: teamById(game, game.cup.winner).name }));
  else if (game.cup.round > 0) out.push(t('ticker.cupAlive', { n: game.cup.alive.length, in: game.cup.alive.includes(me.id) ? t('ticker.cupIn') : t('ticker.cupOut') }));
  const injured = me.creatures.filter((c) => c.condition.injuries.some((i) => i.weeksLeft > 0)).length;
  if (injured) out.push(t('ticker.injured', { n: injured }));
  for (const n of [...game.news].slice(-8).reverse()) out.push(newsText(tr, n));
  return out;
}

export function NewsTicker() {
  const tr = useT();
  const game = useGame((s) => s.game);
  if (!game) return null;
  const list = items(tr, game);
  if (!list.length) return null;
  const row = (k: string) => (
    <span className="ticker-row" key={k} aria-hidden={k === 'b'}>
      {list.map((x, i) => (
        <Fragment key={i}>
          <span className="ticker-item">
            <Gold>{x}</Gold>
          </span>
          <span className="ticker-sep">◆</span>
        </Fragment>
      ))}
    </span>
  );
  // Speed in proportion to the length, so it always reads at the same pace.
  const seconds = Math.max(30, list.join(' ').length / 7);
  return (
    <div className="ticker" role="marquee" aria-label={tr.t('ticker.label')}>
      <span className="ticker-tag">{tr.t('ticker.tag')}</span>
      <div className="ticker-track">
        <div className="ticker-move" style={{ animationDuration: `${seconds}s` }}>
          {row('a')}
          {row('b')}
        </div>
      </div>
    </div>
  );
}
