/**
 * « Flash info »: TV-style band along the bottom of the screen, scrolling in a loop (static when effects are off).
 * Every item has a category (icon + colour) and a tone: money gained in green, lost in red, alerts in amber.
 * Built from what the player can see (own club, tables, competitions, market, news). Display only.
 */
import { moodOf } from '../../engine/club/board.ts';
import { Fragment, type CSSProperties } from 'react';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { AMBITION_IDS } from '../../engine/club/ambitions.ts';
import { divisionOf } from '../../engine/league/divisions.ts';
import { arenaActive, arenaFor } from '../../engine/league/arena.ts';
import { playerFixture, playerTeam, seasonOver, standings, teamById } from '../../engine/league/season.ts';
import type { GameState } from '../../engine/league/types.ts';
import { useT, type Translator } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { compName, divName } from '../competitions.ts';
import { useGame } from '../store/gameStore.ts';
import { newsText } from '../screens/game/NewsScreen.tsx';
import { UiIcon } from '../icons/Icon.tsx';
import { Gold } from './common.tsx';

type Cat = 'match' | 'league' | 'cup' | 'money' | 'squad' | 'market' | 'club' | 'news';
type Tone = 'good' | 'bad' | 'warn' | 'neutral';
interface Item {
  cat: Cat;
  tone: Tone;
  text: string;
  /** Icon overriding the category's (news kinds). */
  icon?: string;
}

const CAT_ICON: Record<Cat, string> = {
  match: 'versus',
  league: 'nav-league',
  cup: 'nav-competitions',
  money: 'nav-finances',
  squad: 'nav-squad',
  market: 'nav-recruit',
  club: 'nav-club',
  news: 'nav-news',
};

function items(tr: Translator, game: GameState): Item[] {
  const { t, money } = tr;
  const out: Item[] = [];
  const add = (cat: Cat, tone: Tone, text: string, icon?: string) => out.push({ cat, tone, text, icon });
  const me = playerTeam(game);
  const club = game.clubs[me.id];
  const myDiv = divisionOf(game, me.id);

  // ——— Matches ———
  const f = playerFixture(game);
  if (f && !seasonOver(game)) {
    const opp = teamById(game, f.home === me.id ? f.away : f.home);
    const comp = f.competition ? compName(t, f.tournamentId) : divName(t, f.division ?? myDiv);
    add('match', 'neutral', t('ticker.next', { a: me.name, b: opp.name, where: f.home === me.id ? t('common.home') : t('common.away') }) + ` · ${comp}`);
    if (arenaActive(game, f.matchday)) {
      const cond = arenaFor(game, f);
      if (cond) add('match', 'warn', t('ticker.arena', { cond: t(`arena.cond.${cond}` as StringKey) }), `arena-${cond}`);
    }
  }
  const played = game.fixtures.filter((x) => x.result && (x.home === me.id || x.away === me.id));
  const last = played.at(-1);
  if (last?.result) {
    const side = last.home === me.id ? 0 : 1;
    const opp = teamById(game, side === 0 ? last.away : last.home).name;
    const won = last.result.winner === side;
    add('match', won ? 'good' : 'bad', t(won ? 'ticker.lastWin' : 'ticker.lastLoss', { team: opp, a: last.result.score[side], b: last.result.score[side === 0 ? 1 : 0] }));
  }
  // Streak of wins or defeats.
  let streak = 0;
  for (let i = played.length - 1; i >= 0; i--) {
    const x = played[i]!;
    const won = x.result!.winner === (x.home === me.id ? 0 : 1);
    if (i === played.length - 1) streak = won ? 1 : -1;
    else if (won && streak > 0) streak++;
    else if (!won && streak < 0) streak--;
    else break;
  }
  if (streak >= 3) add('match', 'good', t('ticker.winStreak', { n: streak }));
  if (streak <= -3) add('match', 'bad', t('ticker.lossStreak', { n: -streak }));

  // ——— League ———
  const mine = standings(game, myDiv);
  const pos = mine.findIndex((r) => r.teamId === me.id) + 1;
  const row = mine[pos - 1];
  if (row?.played) {
    const promoted = DEFAULT_CONFIG.league.promoted;
    const up = myDiv > 0 ? mine[promoted - 1] : undefined;
    const tone: Tone = pos <= promoted && myDiv > 0 ? 'good' : pos > mine.length - promoted && myDiv < game.divisions.length - 1 ? 'bad' : 'neutral';
    add('league', tone, t('ticker.position', { team: me.name, pos: tr.ordinal(pos), d: row.played }));
    if (up && pos > promoted) add('league', 'neutral', t('ticker.gapUp', { n: up.points - row.points }));
  }
  game.divisions.forEach((_, d) => {
    const top = standings(game, d)[0];
    if (top && top.played > 0) add('league', 'neutral', t('ticker.leader', { div: divName(t, d), team: teamById(game, top.teamId).name, pts: top.points }), 'news-leader');
  });

  // ——— Competitions ———
  if (game.cup.winner) add('cup', game.cup.winner === me.id ? 'good' : 'neutral', t('ticker.cupWinner', { team: teamById(game, game.cup.winner).name }));
  else if (game.cup.round > 0) add('cup', game.cup.alive.includes(me.id) ? 'good' : 'neutral', t('ticker.cupAlive', { n: game.cup.alive.length, in: game.cup.alive.includes(me.id) ? t('ticker.cupIn') : t('ticker.cupOut') }));
  for (const tm of game.tournaments) {
    const name = compName(t, tm.id);
    if (tm.winner) add('cup', tm.winner === me.id ? 'good' : 'neutral', t('ticker.compWinner', { comp: name, team: teamById(game, tm.winner).name }));
    else if (tm.round > 0 && tm.entrants.includes(me.id)) add('cup', tm.alive.includes(me.id) ? 'good' : 'bad', t(tm.alive.includes(me.id) ? 'ticker.compIn' : 'ticker.compOut', { comp: name, n: tm.alive.length }));
  }

  // ——— Money ———
  if (club) {
    add('money', club.balance >= 0 ? 'neutral' : 'bad', t('ticker.treasury', { v: money(club.balance) }));
    const week = club.ledger.at(-1);
    if (week) {
      const inc = Object.values(week.income).reduce((s, v) => s + (v ?? 0), 0);
      const exp = Object.values(week.expense).reduce((s, v) => s + (v ?? 0), 0);
      const net = inc - exp;
      if (net !== 0) add('money', net > 0 ? 'good' : 'bad', t(net > 0 ? 'ticker.weekGain' : 'ticker.weekLoss', { v: money(Math.abs(net)) }));
      if (inc > 0) add('money', 'good', t('ticker.income', { v: money(inc) }));
    }
    const wages = me.creatures.reduce((s, c) => s + (c.contract?.wage ?? 0), 0);
    if (wages > 0) add('money', 'bad', t('ticker.wages', { v: money(wages) }));
  }

  // ——— Squad ———
  const injured = me.creatures.filter((c) => c.condition.injuries.some((i) => i.weeksLeft > 0)).length;
  if (injured) add('squad', 'bad', t('ticker.injured', { n: injured }));
  const tired = me.creatures.filter((c) => c.condition.fatigue >= 50).length;
  if (tired) add('squad', 'warn', t('ticker.tired', { n: tired }));
  const points = me.creatures.reduce((s, c) => s + (c.growth?.freePoints ?? 0), 0);
  if (points) add('squad', 'good', t('ticker.points', { n: points }));
  const expiring = me.creatures.filter((c) => c.contract && c.contract.untilSeason <= game.season).length;
  if (expiring) add('squad', 'warn', t('ticker.contracts', { n: expiring }));

  // ——— Market ———
  for (const o of game.offers.slice(0, 3)) {
    const c = me.creatures.find((x) => x.id === o.creatureId);
    if (c) add('market', 'good', t('ticker.offer', { team: teamById(game, o.fromTeamId).name, name: c.name, v: money(o.fee) }));
  }
  const before = new Set(game.freeAgentsBefore ?? []);
  const fresh = game.freeAgentsBefore ? game.freeAgents.filter((c) => !before.has(c.id)).length : 0;
  if (game.freeAgents.length) add('market', fresh ? 'good' : 'neutral', t(fresh ? 'ticker.freeAgentsNew' : 'ticker.freeAgents', { n: game.freeAgents.length, fresh }));

  // ——— Club ———
  const c = game.board.confidence;
  const mood = moodOf(c);
  add('club', mood === 'delighted' || mood === 'content' ? 'good' : mood === 'uneasy' ? 'warn' : 'bad', t('ticker.board', { c, mood: t(`board.mood.${mood}`) }), 'board');
  const ult = game.board.ultimatum;
  if (ult) add('club', 'bad', t('ticker.ultimatum', { wins: ult.wins, need: ult.need, left: ult.of - ult.played }), 'board');
  if (game.board.frozen) add('club', 'bad', t('recruit.frozen', { weeks: tr.weeks(game.board.frozen) }), 'board');
  if (club) add('club', 'neutral', t('ticker.reputation', { r: Math.round(club.reputation) }));
  const fac = game.facilities[me.id];
  if (fac)
    for (const [id, st] of Object.entries(fac))
      if (st.building) add('club', 'neutral', t('ticker.works', { f: t(`fac.${id}` as StringKey), n: st.building.level, w: tr.weeks(st.building.weeksLeft) }), `fac-${id}`);
  const nextAmb = AMBITION_IDS.find((id) => !(game.ambitions ?? {})[id]);
  if (nextAmb) add('club', 'neutral', t('ticker.ambition', { a: t(`amb.${nextAmb}` as StringKey) }), 'help-goal');
  if (game.bestiary) add('club', 'neutral', t('ticker.bestiary', { n: Object.keys(game.bestiary.seen).length }), 'bestiary');

  // ——— League news ———
  for (const n of [...game.news].slice(-10).reverse()) add('news', n.kind === 'death' || n.kind === 'starInjury' ? 'bad' : 'neutral', newsText(tr, n), `news-${n.kind}`);
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
          <span className={`ticker-item c-${x.cat} t-${x.tone}`} style={{ '--tc': `var(--tk-${x.cat})` } as CSSProperties}>
            <span className="ticker-ico">
              <UiIcon name={x.icon ?? CAT_ICON[x.cat]} size="1.05em" />
            </span>
            <span className="ticker-cat">{tr.t(`ticker.cat.${x.cat}` as StringKey)}</span>
            <span className="ticker-text">{x.cat === 'money' ? x.text : <Gold>{x.text}</Gold>}</span>
          </span>
          <span className="ticker-sep" />
        </Fragment>
      ))}
    </span>
  );
  // Speed in proportion to the length, so it always reads at the same pace.
  const seconds = Math.max(80, list.reduce((s, x) => s + x.text.length + 14, 0) / 3.4);
  return (
    <div className="ticker" role="marquee" aria-label={tr.t('ticker.label')}>
      <span className="ticker-tag">
        <i className="ticker-dot" aria-hidden="true" />
        {tr.t('ticker.tag')}
      </span>
      <div className="ticker-track">
        <div className="ticker-move" style={{ animationDuration: `${seconds}s` }}>
          {row('a')}
          {row('b')}
        </div>
      </div>
    </div>
  );
}
