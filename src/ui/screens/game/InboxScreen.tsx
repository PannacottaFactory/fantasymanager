import { useEffect, useState } from 'react';
import { playerFixture, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState, InboxMessage, ObjectiveId } from '../../../engine/league/types.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { Bar } from '../../components/common.tsx';
import type { StringKey } from '../../i18n/strings.ts';
import { cupRoundKey } from './LeagueScreen.tsx';
import { answerOffer } from '../../../engine/economy/actions.ts';
import { estimatedValue, knowledgeOf } from '../../../engine/economy/scouting.ts';
import { locate } from '../../../engine/economy/market.ts';
import { categoryName, injuryText, speciesName } from '../../../engine/text/localize.ts';
import { errorText } from './CreatureSheet.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

export function objectiveText(tr: Translator, o: ObjectiveId): string {
  return tr.t(`obj.${o}` as StringKey, { n: DEFAULT_CONFIG.league.promoted });
}

function wording(tr: Translator, m: InboxMessage, cupRounds: number): { title: string; body: string; tone: 'good' | 'bad' | 'info' } {
  const { t } = tr;
  const cupRound = (r: number) => t(cupRoundKey(r, cupRounds));
  switch (m.kind) {
    case 'welcome':
      return { title: t('msg.welcome.title', { team: m.teamName }), body: t('msg.welcome.body', { teams: m.teams, matchdays: m.matchdays }), tone: 'info' };
    case 'matchResult': {
      const score = `${m.score[0]}–${m.score[1]}`;
      return {
        title: t(m.won ? 'msg.win.title' : 'msg.loss.title', { opp: m.opponent }),
        body: m.method === 'ko' ? t('msg.result.ko', { round: m.rounds }) : t('msg.result.points', { score }),
        tone: m.won ? 'good' : 'bad',
      };
    }
    case 'injury':
      return { title: t('msg.injury.title', { name: m.name }), body: t('msg.injury.body', { injury: injuryText(m.injuryId, tr.lang).name, weeks: tr.weeks(m.weeks) }), tone: 'bad' };
    case 'recovered':
      return { title: t('msg.recovered.title', { name: m.name }), body: t('msg.recovered.body', { name: m.name }), tone: 'good' };
    case 'tired':
      return { title: t('msg.tired.title'), body: t('msg.tired.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'seasonEnd':
      return { title: t('msg.seasonEnd.title'), body: t('msg.seasonEnd.body', { pos: tr.ordinal(m.position), points: m.points, champion: m.champion }), tone: m.position === 1 ? 'good' : 'info' };
    case 'newSeason':
      return { title: t('msg.newSeason.title', { season: m.season }), body: t('msg.newSeason.body'), tone: 'info' };
    case 'offerReceived':
      return { title: t('msg.offerReceived.title', { team: m.fromTeam, name: m.name }), body: '', tone: 'info' };
    case 'offerExpired':
      return { title: t('msg.offerExpired.title'), body: t('msg.offerExpired.body', { team: m.fromTeam, name: m.name }), tone: 'info' };
    case 'transferIn':
      return {
        title: t('msg.transferIn.title', { name: m.name }),
        body: m.fromTeam
          ? t('msg.transferIn.team', { team: m.fromTeam, fee: tr.money(m.fee), wage: tr.money(m.wage) })
          : t('msg.transferIn.free', { fee: tr.money(m.fee), wage: tr.money(m.wage) }),
        tone: 'good',
      };
    case 'transferOut':
      return {
        title: t('msg.transferOut.title', { name: m.name }),
        body: m.toTeam ? t('msg.transferOut.sold', { team: m.toTeam, fee: tr.money(m.fee) }) : t('msg.transferOut.released'),
        tone: 'info',
      };
    case 'scoutReport':
      return {
        title: t('msg.scoutReport.title', { name: m.name }),
        body: m.target === 'creature' ? t('msg.scoutReport.creature', { name: m.name }) : t('msg.scoutReport.team', { name: m.name }),
        tone: 'good',
      };
    case 'contractExpiring':
      return { title: t('msg.contractExpiring.title'), body: t('msg.contractExpiring.body', { names: m.names.join(', ') }), tone: 'bad' };
    case 'contractLeft':
      return { title: t('msg.contractLeft.title'), body: t('msg.contractLeft.body', { names: m.names.join(', ') }), tone: 'bad' };
    case 'seasonPrize':
      return { title: t('msg.seasonPrize.title'), body: t('msg.seasonPrize.body', { pos: tr.ordinal(m.position), amount: tr.money(m.amount) }), tone: 'good' };
    case 'financeWarning':
      return { title: t('msg.financeWarning.title'), body: t('msg.financeWarning.body', { v: tr.money(m.balance) }), tone: 'bad' };
    case 'marketNews': {
      const free = t('msg.marketNews.free');
      const lines = m.moves.map((x) => `${x.name} (${speciesName(x.speciesId, tr.lang)}) : ${x.from ?? free} → ${x.to ?? free}${x.fee ? ` · ${tr.money(x.fee, true)}` : ''}`);
      return { title: t('msg.marketNews.title'), body: lines.join('\n'), tone: 'info' };
    }
    case 'youthIntake':
      return { title: t('msg.youthIntake.title'), body: t('msg.youthIntake.body', { names: m.names.join(', ') }), tone: 'good' };
    case 'youthReleased':
      return { title: t('msg.youthReleased.title'), body: t('msg.youthReleased.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'retired':
      return { title: t('msg.retired.title'), body: t('msg.retired.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'trainingReport':
      return {
        title: t('msg.trainingReport.title'),
        body: t('msg.trainingReport.body', { list: m.items.map((x) => `${x.name} (+${x.gain})`).join(', ') }),
        tone: 'good',
      };
    case 'coachHired':
      return { title: t('msg.coachHired.title', { name: m.name }), body: t('msg.coachHired.body', { domain: categoryName(m.domain, tr.lang).toLowerCase(), q: m.quality }), tone: 'good' };
    case 'cupDraw':
      return {
        title: t('msg.cupDraw.title', { round: cupRound(m.round) }),
        body: m.home ? t('msg.cupDraw.home', { opp: m.opponent }) : t('msg.cupDraw.away', { opp: m.opponent }),
        tone: 'info',
      };
    case 'cupOut':
      return { title: t('msg.cupOut.title'), body: t('msg.cupOut.body', { by: m.by, round: cupRound(m.round).toLowerCase() }), tone: 'bad' };
    case 'cupWon':
      return { title: t('msg.cupWon.title'), body: t('msg.cupWon.body', { prize: tr.money(m.prize) }), tone: 'good' };
    case 'promoted':
      return { title: t('msg.promoted.title'), body: t('msg.promoted.body', { n: m.division + 1 }), tone: 'good' };
    case 'relegated':
      return { title: t('msg.relegated.title'), body: t('msg.relegated.body', { n: m.division + 1 }), tone: 'bad' };
    case 'boardObjective':
      return { title: t('msg.boardObjective.title'), body: t('msg.boardObjective.body', { n: m.division + 1, objective: objectiveText(tr, m.objective) }), tone: 'info' };
    case 'boardVerdict':
      return {
        title: t(m.met ? 'msg.boardVerdict.met' : 'msg.boardVerdict.missed'),
        body: m.met
          ? t('msg.boardVerdict.metBody', { pos: tr.ordinal(m.position), bonus: tr.money(m.bonus), c: m.confidence })
          : t('msg.boardVerdict.missedBody', { pos: tr.ordinal(m.position), c: m.confidence }),
        tone: m.met ? 'good' : 'bad',
      };
    case 'boardWarning':
      return { title: t('msg.boardWarning.title'), body: t('msg.boardWarning.body', { c: m.confidence }), tone: 'bad' };
    case 'facilityDone':
      return { title: t('msg.facilityDone.title', { facility: t(`fac.${m.facility}` as StringKey), n: m.level }), body: t('msg.facilityDone.body'), tone: 'good' };
    case 'friendLeft':
      return { title: t('msg.friendLeft.title', { name: m.name }), body: t('msg.friendLeft.body', { friends: m.friends.join(', ') }), tone: 'bad' };
    case 'relation':
      return m.bond === 'friends'
        ? { title: t('msg.relation.friends'), body: t('msg.relation.friendsBody', { a: m.a, b: m.b }), tone: 'good' }
        : { title: t('msg.relation.rivals'), body: t('msg.relation.rivalsBody', { a: m.a, b: m.b }), tone: 'bad' };
    case 'emergencySigning':
      return { title: t('msg.emergencySigning.title'), body: t('msg.emergencySigning.body', { names: m.names.join(', ') }), tone: 'bad' };
  }
}

/** Buttons under a message: answer an offer, open a creature sheet. */
function MessageActions({ game, m }: { game: GameState; m: InboxMessage }) {
  const tr = useT();
  const { t, money } = tr;
  const { act, openSheet, setScreen } = useGame.getState();
  const [error, setError] = useState<string | null>(null);
  if (m.kind === 'offerReceived') {
    const open = game.offers.some((o) => o.id === m.offerId);
    const c = locate(game, m.creatureId)?.creature;
    return (
      <div className="stack" style={{ gap: 6, marginTop: 4 }}>
        <div className="muted">{t('msg.offerReceived.body', { fee: money(m.fee), value: c ? money(estimatedValue(c, knowledgeOf(game, c.id))) : '?' })}</div>
        {open ? (
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn small primary"
              onClick={() => {
                const o = act((g) => answerOffer(g, m.offerId, true));
                if (o?.kind === 'error') setError(errorText(tr, o.error));
              }}
            >
              {t('offer.accept', { fee: money(m.fee) })}
            </button>
            <button className="btn small" onClick={() => act((g) => answerOffer(g, m.offerId, false))}>
              {t('offer.decline')}
            </button>
            {c && (
              <button className="btn small ghost" onClick={() => openSheet(c.id)}>
                {t('msg.openSheet')}
              </button>
            )}
          </div>
        ) : (
          <span className="faint">{t('offer.closed')}</span>
        )}
        {error && <div className="answer bad">{error}</div>}
      </div>
    );
  }
  const sheetId = m.kind === 'scoutReport' && m.target === 'creature' ? m.targetId : m.kind === 'transferIn' ? m.creatureId : null;
  if (sheetId && locate(game, sheetId))
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => openSheet(sheetId)}>
        {t('msg.openSheet')}
      </button>
    );
  if (m.kind === 'youthIntake' && game.youth.length)
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => setScreen('training')}>
        {t('msg.openTraining')}
      </button>
    );
  if (m.kind === 'scoutReport' || m.kind === 'contractExpiring')
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => setScreen(m.kind === 'scoutReport' ? 'recruit' : 'finances')}>
        {m.kind === 'scoutReport' ? t('msg.openRecruit') : t('nav.finances')}
      </button>
    );
  return null;
}

function BoardCard({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const c = game.board.confidence;
  return (
    <section className="panel board-card" title={t('board.confidence.title')} data-tip="board">
      <div className="row wrap" style={{ gap: 12 }}>
        <b>🏛 {t('board.title')}</b>
        <span>
          {t('league.division', { n: divisionOf(game, game.playerTeamId) + 1 })} — {t('board.objective', { objective: objectiveText(tr, game.board.objective) })}
        </span>
        <span className="spacer" />
        <span className="muted">{t('board.confidence')}</span>
        <span style={{ width: 120 }}>
          <Bar value={c} max={100} color={c >= 60 ? 'var(--good)' : c >= 30 ? 'var(--warn)' : 'var(--bad)'} />
        </span>
        <b className="mono">{c} %</b>
      </div>
    </section>
  );
}

function NextMatch({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const f = playerFixture(game);
  if (!f || seasonOver(game)) return null;
  const home = f.home === game.playerTeamId;
  const opp = teamById(game, home ? f.away : f.home);
  const table = standings(game);
  const pos = table.findIndex((r) => r.teamId === opp.id) + 1;
  const row = table[pos - 1]!;
  return (
    <section className="panel next-match">
      <h4>{t('inbox.nextMatch')}</h4>
      <div className="row wrap" style={{ gap: 10 }}>
        <span className="tag">{home ? t('common.home') : t('common.away')}</span>
        <b style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem' }}>{opp.name}</b>
        <span className="muted">{t('match.position', { pos: tr.ordinal(pos), pts: row.points })}</span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => useGame.getState().continueGame()}>
          {t('continue')} ▶
        </button>
      </div>
    </section>
  );
}

export function InboxScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const { viewReport, markAllRead } = useGame.getState();
  const messages = [...game.inbox].reverse();
  // Unread markers are shown once, then cleared.
  const unread = new Set(game.inbox.filter((m) => !m.read).map((m) => m.id));
  useEffect(() => {
    const id = setTimeout(markAllRead, 1500);
    return () => clearTimeout(id);
  }, [game.inbox.length, markAllRead]);

  return (
    <div className="stack narrow" data-tip="inbox">
      <BoardCard game={game} />
      <NextMatch game={game} />
      <section className="panel">
        <h2 style={{ marginBottom: 10 }}>{t('inbox.title')}</h2>
        {messages.length === 0 && <div className="muted">{t('inbox.empty')}</div>}
        <ul className="inbox">
          {messages.map((m) => {
            const w = wording(tr, m, game.cup.rounds);
            const canReport = m.kind === 'matchResult' && game.lastMatch?.fixtureId === m.fixtureId;
            return (
              <li key={m.id} className={`msg ${w.tone} ${unread.has(m.id) ? 'unread' : ''}`}>
                <div className="msg-head">
                  <b>{w.title}</b>
                  <span className="spacer" />
                  <span className="faint mono" style={{ fontSize: '0.786rem' }}>
                    {t('inbox.matchday', { season: m.season, d: m.matchday })}
                  </span>
                </div>
                {w.body && <div className="muted msg-body">{w.body}</div>}
                <MessageActions game={game} m={m} />
                {canReport && (
                  <button className="btn small" style={{ marginTop: 6 }} onClick={() => viewReport(game.lastMatch!.result)}>
                    {t('msg.report')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
