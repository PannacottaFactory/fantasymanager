/**
 * Dashboard: the stable at a glance — next match, board, table position, squad status, best creatures,
 * money, recent results, messages and news. Every card leads to the screen that deals with it.
 */
import { FansMeter } from '../../components/Fans.tsx';
import { SessionCard } from './TrainingSession.tsx';
import { weekText } from '../../season.ts';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { ReputationLine } from '../../components/Reputation.tsx';
import { useState, type ReactNode } from 'react';
import { FirstSteps } from '../../tutorial/FirstSteps.tsx';
import { overallRating } from '../../../engine/creature/derived.ts';
import { AMBITION_IDS, ambitionProgress } from '../../../engine/club/ambitions.ts';
import { clubOf, weeklyBill } from '../../../engine/economy/finance.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { playerTeam, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { Bar, Crest, Gold, LevelBadge, Attr, RollingMoney } from '../../components/common.tsx';
import { SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { useT } from '../../i18n/index.ts';
import { levelOf, maxLevelOf } from '../../../engine/progression/levels.ts';
import { divName } from '../../competitions.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame, type Screen } from '../../store/gameStore.ts';
import { NextMatch, wording } from './InboxScreen.tsx';
import { BoardCard } from './Board.tsx';
import { ManagerCard } from './Career.tsx';
import { FormDots } from './LeagueScreen.tsx';
import { NewsIcon, newsText } from './NewsScreen.tsx';
import { bestiaryTiers, ownedSpecies, seenSpecies } from '../../../engine/team/record.ts';
import { SPECIES_IDS } from '../../../data/species.ts';

function Card({ title, to, link, children, className = '' }: { title: string; to?: Screen; link?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel dash-card ${className}`}>
      <div className="dash-card-head">
        <h3>{title}</h3>
        {to && (
          <button className="link" onClick={() => useGame.getState().setScreen(to)}>
            {link} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Hero({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const team = playerTeam(game);
  const d = divisionOf(game, team.id);
  const table = standings(game, d);
  const pos = table.findIndex((r) => r.teamId === team.id) + 1;
  const row = table[pos - 1];
  return (
    <section className="panel dash-hero">
      <StableCrest team={team} size={60} />
      <div className="grow">
        <h2>{team.name}</h2>
        <div className="muted">
          {divName(t, d)} · {t('dash.season', { s: game.season, w: weekText(t, game) })} ·{' '}
          {t(`diff.${game.difficulty ?? 'normal'}` as StringKey)}
        </div>
        <ReputationLine game={game} />
      </div>
      {row && (
        <div className="dash-rank" title={t('dash.rank.title')}>
          <b>{tr.ordinal(pos)}</b>
          <span className="muted">{t('dash.points', { n: row.points })}</span>
        </div>
      )}
    </section>
  );
}

function MiniTable({ game }: { game: GameState }) {
  const { t } = useT();
  const d = divisionOf(game, game.playerTeamId);
  const rows = standings(game, d);
  const me = rows.findIndex((r) => r.teamId === game.playerTeamId);
  const from = Math.max(0, Math.min(me - 2, rows.length - 5));
  const promoted = DEFAULT_CONFIG.league.promoted;
  const last = game.divisions.length - 1;
  return (
    <Card title={t('dash.table')} to="league" link={t('dash.seeTable')}>
      <table className="data standings compact">
        <tbody>
          {rows.slice(from, from + 5).map((r, k) => {
            const i = from + k;
            const zone = (d > 0 && i < promoted) || (d === 0 && i === 0) ? 'top' : d < last && i >= rows.length - promoted ? 'bottom' : '';
            return (
              <tr key={r.teamId} className={`${r.teamId === game.playerTeamId ? 'mine' : ''} ${zone}`}>
                <td className="num">{i + 1}</td>
                <td>{teamById(game, r.teamId).name}</td>
                <td>
                  <FormDots form={r.form} />
                </td>
                <td className="num">
                  <b>{r.points}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function SquadStatus({ game }: { game: GameState }) {
  const { t } = useT();
  const team = playerTeam(game);
  const injured = team.creatures.filter((c) => c.condition.injuries.some((i) => i.weeksLeft > 0)).length;
  const tired = team.creatures.filter((c) => c.condition.fatigue >= 50).length;
  const expiring = team.creatures.filter((c) => c.contract && c.contract.untilSeason <= game.season).length;
  const points = team.creatures.reduce((s, c) => s + (c.growth?.freePoints ?? 0), 0);
  const tiles: { n: number; label: StringKey; to: Screen; tone: 'good' | 'warn' | 'bad' | 'info' }[] = [
    { n: team.creatures.length - injured, label: 'dash.available', to: 'squad', tone: 'good' },
    { n: injured, label: 'dash.injured', to: 'squad', tone: injured ? 'bad' : 'info' },
    { n: tired, label: 'dash.tired', to: 'tactics', tone: tired ? 'warn' : 'info' },
    { n: expiring, label: 'dash.expiring', to: 'finances', tone: expiring ? 'warn' : 'info' },
    { n: points, label: 'dash.freePoints', to: 'squad', tone: points ? 'good' : 'info' },
    { n: team.creatures.filter((c) => levelOf(c) < maxLevelOf(c)).length, label: 'dash.growing', to: 'training', tone: 'good' },
  ];
  return (
    <Card title={t('dash.squad')} to="squad" link={t('nav.squad')}>
      <div className="dash-tiles">
        {tiles.map((x) => (
          <button key={x.label} className={`dash-tile ${x.tone} ${x.n ? '' : 'zero'}`} onClick={() => useGame.getState().setScreen(x.to)}>
            <b>{x.n}</b>
            <span>{t(x.label)}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Stars({ game }: { game: GameState }) {
  const { t, lang } = useT();
  const team = playerTeam(game);
  const top = [...team.creatures].sort((a, b) => overallRating(b) - overallRating(a)).slice(0, 4);
  return (
    <Card title={t('dash.stars')} to="squad" link={t('nav.squad')}>
      <ul className="dash-list">
        {top.map((c) => (
          <li key={c.id}>
            <Crest speciesId={c.speciesId} name={c.name} size={28} level={levelOf(c)} />
            <span className="grow dash-who">
              <button className="link" onClick={() => useGame.getState().openSheet(c.id)}>
                {c.name}
              </button>
              <span className="faint">{speciesName(c.speciesId, lang)}</span>
            </span>
            <LevelBadge c={c} compact />
            <b className="mono" title={t('cr.overall')}>
              {overallRating(c)}
            </b>
            <span title={t('col.form')}>
              <Attr v={c.condition.form} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Fans({ game }: { game: GameState }) {
  const { t } = useT();
  return (
    <Card title={t('fans.title')} to="finances" link={t('nav.finances')} className="dash-fans">
      <FansMeter game={game} />
    </Card>
  );
}

function Money({ game }: { game: GameState }) {
  const tr = useT();
  const { t, money } = tr;
  const club = clubOf(game, game.playerTeamId);
  const season = club.ledger.filter((e) => e.season === game.season);
  const last = season[season.length - 1];
  const net = last ? Object.values(last.income).reduce((s, v) => s + (v ?? 0), 0) - Object.values(last.expense).reduce((s, v) => s + (v ?? 0), 0) : 0;
  const values = season.map((e) => e.balance);
  const W = 220;
  const H = 46;
  const lo = Math.min(...values, club.balance);
  const hi = Math.max(...values, club.balance);
  const path =
    values.length > 1
      ? values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`).join(' ')
      : '';
  return (
    <Card title={t('dash.money')} to="finances" link={t('nav.finances')}>
      <div className="dash-money">
        <b className={club.balance < 0 ? 'bad-text' : ''}>
          <RollingMoney v={club.balance} />
        </b>
        {path && (
          <svg viewBox={`0 0 ${W} ${H}`} className="chart dash-spark" aria-hidden="true">
            <path d={path} className="line draw" pathLength={1} />
          </svg>
        )}
      </div>
      <div className="muted" style={{ fontSize: '0.857rem' }}>
        <Gold>{t('dash.moneyLine', { bill: money(weeklyBill(game, game.playerTeamId)), rep: club.reputation })}</Gold>
        {last && (
          <>
            {' · '}
            <span className={net >= 0 ? 'good-text' : 'bad-text'}>{t('dash.lastWeek', { v: `${net >= 0 ? '+' : '−'}${money(Math.abs(net))}` })}</span>
          </>
        )}
      </div>
    </Card>
  );
}

function Results({ game }: { game: GameState }) {
  const { t } = useT();
  const me = game.playerTeamId;
  const played = game.fixtures.filter((f) => f.result && (f.home === me || f.away === me)).slice(-5).reverse();
  return (
    <Card title={t('dash.results')} to="league" link={t('nav.league')}>
      {played.length === 0 && <div className="faint">{t('dash.noResults')}</div>}
      <ul className="dash-list">
        {played.map((f) => {
          const side = f.home === me ? 0 : 1;
          const r = f.result!;
          const won = r.winner === side;
          const opp = teamById(game, side === 0 ? f.away : f.home).name;
          return (
            <li key={f.id}>
              <span className={`result-chip ${won ? 'win' : 'loss'}`}>{won ? t('dash.w') : t('dash.l')}</span>
              <span className="grow">
                {opp} {f.competition === 'cup' && <span className="tag">{t('dash.cup')}</span>}
              </span>
              <span className="mono">
                {r.score[side]}–{r.score[side === 0 ? 1 : 0]}
              </span>
              <span className="faint" style={{ fontSize: '0.857rem', minWidth: 54, textAlign: 'right' }}>
                {r.method === 'ko' ? t('league.koRound', { n: r.rounds }) : t('league.pts')}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Messages({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const unread = game.inbox.filter((m) => !m.read);
  const list = [...(unread.length ? unread : game.inbox)].reverse().slice(0, 4);
  return (
    <Card title={unread.length ? t('dash.unread', { n: unread.length }) : t('dash.messages')} to="inbox" link={t('nav.inbox')}>
      <ul className="dash-list">
        {list.map((m) => {
          const w = wording(tr, m, game.cup.rounds);
          return (
            <li key={m.id} className={`tone-${w.tone}`}>
              <span className="dash-dot" />
              <span className="grow">
                <Gold>{w.title}</Gold>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function News({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const list = [...game.news].slice(-4).reverse();
  if (!list.length) return null;
  return (
    <Card title={t('dash.news')} to="news" link={t('nav.news')}>
      <ul className="dash-list">
        {list.map((n) => (
          <li key={n.id}>
            <NewsIcon kind={n.kind} />
            <span className="grow">
              <Gold>{newsText(tr, n)}</Gold>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Long-term goals of the career: the next ones to reach, the others on demand. */
function Ambitions({ game }: { game: GameState }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const done = game.ambitions ?? {};
  const count = AMBITION_IDS.filter((id) => done[id] !== undefined).length;
  const next = AMBITION_IDS.filter((id) => done[id] === undefined);
  const shown = open ? AMBITION_IDS : next.slice(0, 3);
  // Closed: a single line with the current ambition.
  if (!open) {
    const cur = next[0];
    const p = cur ? ambitionProgress(game, cur) : null;
    return (
      <section className="panel dash-ambitions compact">
        <b className="amb-title">{t('amb.title')}</b>
        <span className="amb-bar" aria-hidden="true">
          <span style={{ width: `${(count / AMBITION_IDS.length) * 100}%` }} />
        </span>
        <span className="faint mono amb-count">{t('amb.count', { n: count, of: AMBITION_IDS.length })}</span>
        <span className="amb-cur grow">
          {cur ? (
            <>
              <span className="amb-ico">➤</span> <b>{t(`amb.${cur}` as StringKey)}</b>
              <span className="muted"> — {t(`amb.${cur}.desc` as StringKey)}</span>
              {p && <span className="faint mono"> ({p.n}/{p.of})</span>}
            </>
          ) : (
            t('amb.all')
          )}
        </span>
        <button className="link amb-more" onClick={() => setOpen(true)}>
          {t('amb.seeAll')} ▾
        </button>
      </section>
    );
  }
  return (
    <section className="panel dash-card dash-ambitions">
      <div className="dash-card-head">
        <h3>{t('amb.title')}</h3>
        <span className="faint mono">{t('amb.count', { n: count, of: AMBITION_IDS.length })}</span>
      </div>
      <div className="amb-bar" aria-hidden="true">
        <span style={{ width: `${(count / AMBITION_IDS.length) * 100}%` }} />
      </div>
      <ul className="amb-list">
        {shown.map((id) => {
          const reached = done[id];
          const p = ambitionProgress(game, id);
          return (
            <li key={id} className={`${reached !== undefined ? 'done' : ''} ${id === next[0] ? 'current' : ''}`}>
              <span className="amb-ico">{reached !== undefined ? '✓' : id === next[0] ? '➤' : '○'}</span>
              <span className="grow">
                <b>{t(`amb.${id}` as StringKey)}</b>
                <span className="muted"> — {t(`amb.${id}.desc` as StringKey)}</span>
                {p && reached === undefined && <span className="faint mono"> ({p.n}/{p.of})</span>}
              </span>
              {reached !== undefined && <span className="faint">{t('amb.season', { s: reached })}</span>}
            </li>
          );
        })}
        {!open && next.length === 0 && <li className="done">{t('amb.all')}</li>}
      </ul>
      <button className="link" onClick={() => setOpen((x) => !x)}>
        {open ? t('dash.showLess') : t('amb.seeAll')}
      </button>
    </section>
  );
}

/** The bestiary in a glance: species met / owned, the next reward, the latest discoveries. */
function Bestiary({ game }: { game: GameState }) {
  const { t, money } = useT();
  const seen = seenSpecies(game);
  const owned = ownedSpecies(game);
  const total = SPECIES_IDS.length;
  const b = game.bestiary;
  const latest = Object.keys(b?.seen ?? {}).slice(-8).reverse();
  const next = (list: 'seen' | 'owned', n: number) => bestiaryTiers(list).find((x) => x.n > n);
  const ns = next('seen', seen.size);
  const no = next('owned', owned.size);
  return (
    <section className="panel dash-card dash-bestiary">
      <div className="dash-card-head">
        <h3>{t('bestiary.title')}</h3>
        <button className="link" onClick={() => useGame.getState().openBestiary()}>
          {t('bestiary.open')} →
        </button>
      </div>
      <div className="dash-bst-row">
        <UiIcon name="bestiary-seen" />
        <span>{t('bestiary.seen')}</span>
        <b>{seen.size}<small className="faint">/{total}</small></b>
      </div>
      <Bar value={seen.size} max={total} color="var(--accent)" thin />
      {ns && <small className="muted">{t('bestiary.nextTier', { n: ns.n })} · <span className="gold-text">{money(ns.gold)}</span></small>}
      <div className="dash-bst-row">
        <UiIcon name="bestiary-owned" />
        <span>{t('bestiary.owned')}</span>
        <b>{owned.size}<small className="faint">/{total}</small></b>
      </div>
      <Bar value={owned.size} max={total} color="var(--gold)" thin />
      {no && <small className="muted">{t('bestiary.nextTier', { n: no.n })} · <span className="gold-text">{money(no.gold)}</span></small>}
      {latest.length > 0 && (
        <div className="dash-bst-latest" title={t('bestiary.latest')}>
          {latest.map((id) => (
            <SpeciesIcon key={id} id={id} size="1.5em" />
          ))}
        </div>
      )}
    </section>
  );
}

export function DashboardScreen() {
  const game = useGame((s) => s.game)!;
  return (
    <div className="stack dash" data-tip="dashboard">
      <Hero game={game} />
      <div className="dash-top">
        <FirstSteps />
        <NextMatch game={game} />
      </div>
      <Ambitions game={game} />
      <div className={`dash-pair ${game.manager?.career ? 'two' : ''}`}>
        <BoardCard game={game} />
        <ManagerCard game={game} />
      </div>
      <div className="dash-grid">
        <SessionCard game={game} />
        <SquadStatus game={game} />
        <MiniTable game={game} />
        <Money game={game} />
        <Fans game={game} />
        <Stars game={game} />
        <Results game={game} />
        <Messages game={game} />
        <News game={game} />
        <Bestiary game={game} />
      </div>
    </div>
  );
}
