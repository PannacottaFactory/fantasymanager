import { useEffect, useState, type CSSProperties } from 'react';
import { playerFixture, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState, InboxMessage, ObjectiveId } from '../../../engine/league/types.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { Bar, Gold } from '../../components/common.tsx';
import type { StringKey } from '../../i18n/strings.ts';
import { compName, divName, roundKey } from '../../competitions.ts';
import { answerOffer } from '../../../engine/economy/actions.ts';
import { estimatedValue, knowledgeOf } from '../../../engine/economy/scouting.ts';
import { locate } from '../../../engine/economy/market.ts';
import { abilityText, attributeText, categoryName, injuryText, speciesName } from '../../../engine/text/localize.ts';
import { errorText } from './CreatureSheet.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { BadgeIcon } from '../../icons/Icon.tsx';
import { medalDesc, medalName } from '../../components/CreatureRecord.tsx';
import { levelOfAbility, totalXpOfAbility } from '../../../engine/progression/levels.ts';

/** Message families: each has a colour and a symbol in the inbox. */
export type MessageCategory = 'match' | 'medical' | 'market' | 'club' | 'squad' | 'competition' | 'scouting';

const CATEGORY_STYLE: Record<MessageCategory, { color: string; glyph: string }> = {
  match: { color: 'var(--accent)', glyph: '⚔' },
  medical: { color: 'var(--bad)', glyph: '✚' },
  market: { color: 'var(--warn)', glyph: '⚖' },
  club: { color: 'var(--info)', glyph: '♜' },
  squad: { color: 'var(--good)', glyph: '❦' },
  competition: { color: 'color-mix(in srgb, var(--info) 55%, var(--bad))', glyph: '♛' },
  scouting: { color: 'color-mix(in srgb, var(--info) 50%, var(--good))', glyph: '◉' },
};

export function messageCategory(m: InboxMessage): MessageCategory {
  switch (m.kind) {
    case 'matchResult':
      return 'match';
    case 'injury':
    case 'death':
    case 'recovered':
    case 'tired':
      return 'medical';
    case 'offerReceived':
    case 'offerExpired':
    case 'transferIn':
    case 'transferOut':
    case 'marketNews':
    case 'contractExpiring':
    case 'contractLeft':
    case 'emergencySigning':
      return 'market';
    case 'scoutReport':
      return 'scouting';
    case 'youthIntake':
    case 'youthReleased':
    case 'retired':
    case 'trainingReport':
    case 'abilityUnlocked':
    case 'levelUp':
    case 'coachHired':
    case 'friendLeft':
    case 'relation':
    case 'medal':
      return 'squad';
    case 'seasonEnd':
    case 'seasonPrize':
    case 'cupDraw':
    case 'cupOut':
    case 'cupWon':
    case 'tournamentInvite':
    case 'championsQualified':
    case 'promoted':
    case 'relegated':
    case 'ambition':
    case 'bestiary':
    case 'arenaIntro':
      return 'competition';
    default:
      return 'club';
  }
}

export function objectiveText(tr: Translator, o: ObjectiveId): string {
  return tr.t(`obj.${o}` as StringKey, { n: DEFAULT_CONFIG.league.promoted });
}

export function wording(tr: Translator, m: InboxMessage, cupRounds: number): { title: string; body: string; tone: 'good' | 'bad' | 'info' } {
  const { t } = tr;
  const cupRound = (r: number, rounds = cupRounds) => t(roundKey(r, rounds));
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
      return { title: t('msg.youthIntake.title'), body: t('msg.youthIntake.body', { names: m.names.join(', '), n: m.count ?? m.names.length }), tone: 'good' };
    case 'youthReleased':
      return { title: t('msg.youthReleased.title'), body: t('msg.youthReleased.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'retired':
      return { title: t('msg.retired.title'), body: t('msg.retired.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'trainingReport':
      return {
        title: t('msg.trainingReport.title'),
        body: [
          t('msg.trainingReport.intro', { weeks: m.weeks ?? 6 }),
          ...m.items.map((x) => {
            const moves = (x.attrs ?? []).map((a) => `${attributeText(a.k, tr.lang).name} ${a.d > 0 ? '+' : ''}${a.d}`).join(', ');
            const apt =
              x.abilityFrom !== undefined && x.abilityTo !== undefined
                ? t('msg.trainingReport.xp', {
                    xp: totalXpOfAbility(x.abilityTo) - totalXpOfAbility(x.abilityFrom),
                    from: levelOfAbility(x.abilityFrom),
                    to: levelOfAbility(x.abilityTo),
                  })
                : '';
            return `• ${t('msg.trainingReport.line', { name: x.name, n: x.gain, attrs: moves || '—', aptitude: apt })}`;
          }),
          t('msg.trainingReport.outro'),
        ].join('\n'),
        tone: 'good',
      };
    case 'levelUp':
      return {
        title: t('msg.levelUp.title', { name: m.name, n: m.level }),
        body: t('msg.levelUp.body', { name: m.name, n: m.level, p: m.points }),
        tone: 'good',
      };
    case 'abilityUnlocked':
      return {
        title: t('msg.abilityUnlocked.title', { name: m.name }),
        body: t('msg.abilityUnlocked.body', { name: m.name, n: m.ability, ability: abilityText(m.abilityId, tr.lang).name }),
        tone: 'good',
      };
    case 'coachHired':
      return { title: t('msg.coachHired.title', { name: m.name }), body: t('msg.coachHired.body', { domain: categoryName(m.domain, tr.lang).toLowerCase(), q: m.quality }), tone: 'good' };
    case 'cupDraw':
      return {
        title: t('msg.cupDraw.title', { comp: compName(t, m.tournament), round: cupRound(m.round, m.rounds) }),
        body: m.home ? t('msg.cupDraw.home', { opp: m.opponent }) : t('msg.cupDraw.away', { opp: m.opponent }),
        tone: 'info',
      };
    case 'cupOut':
      return { title: t('msg.cupOut.title', { comp: compName(t, m.tournament) }), body: t('msg.cupOut.body', { by: m.by, round: cupRound(m.round, m.rounds).toLowerCase() }), tone: 'bad' };
    case 'cupWon':
      return { title: t('msg.cupWon.title', { comp: compName(t, m.tournament) }), body: t('msg.cupWon.body', { comp: compName(t, m.tournament), prize: tr.money(m.prize) }), tone: 'good' };
    case 'tournamentInvite':
      return { title: t('msg.tournamentInvite.title', { comp: compName(t, m.tournament) }), body: t('msg.tournamentInvite.body', { comp: compName(t, m.tournament), fee: tr.money(m.fee) }), tone: 'info' };
    case 'championsQualified':
      return { title: t('msg.championsQualified.title'), body: t('msg.championsQualified.body'), tone: 'good' };
    case 'promoted':
      return { title: t('msg.promoted.title'), body: t('msg.promoted.body', { div: divName(t, m.division) }), tone: 'good' };
    case 'relegated':
      return { title: t('msg.relegated.title'), body: t('msg.relegated.body', { div: divName(t, m.division) }), tone: 'bad' };
    case 'boardObjective':
      return { title: t('msg.boardObjective.title'), body: t('msg.boardObjective.body', { div: divName(t, m.division), objective: objectiveText(tr, m.objective) }), tone: 'info' };
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
    case 'death':
      return {
        title: t('msg.death.title', { name: m.name }),
        body: [
          t('msg.death.body', { name: m.name, species: speciesName(m.speciesId, tr.lang), opponent: m.opponent, injury: injuryText(m.injuryId, tr.lang).name }),
          m.friends.length ? t('msg.death.friends', { friends: m.friends.join(', ') }) : '',
        ].filter(Boolean).join('\n'),
        tone: 'bad',
      };
    case 'friendLeft':
      return { title: t('msg.friendLeft.title', { name: m.name }), body: t('msg.friendLeft.body', { friends: m.friends.join(', ') }), tone: 'bad' };
    case 'relation':
      return m.bond === 'friends'
        ? { title: t('msg.relation.friends'), body: t('msg.relation.friendsBody', { a: m.a, b: m.b }), tone: 'good' }
        : { title: t('msg.relation.rivals'), body: t('msg.relation.rivalsBody', { a: m.a, b: m.b }), tone: 'bad' };
    case 'ambition':
      return { title: t('msg.ambition.title', { a: t(`amb.${m.ambition}`) }), body: t('msg.ambition.body', { a: t(`amb.${m.ambition}`), desc: t(`amb.${m.ambition}.desc`) }), tone: 'good' };
    case 'emergencySigning':
      return { title: t('msg.emergencySigning.title'), body: t('msg.emergencySigning.body', { names: m.names.join(', ') }), tone: 'bad' };
    case 'arenaIntro':
      return { title: t('msg.arenaIntro.title'), body: t('msg.arenaIntro.body'), tone: 'info' };
    case 'medal':
      return {
        title: t('msg.medal.title', { name: m.name, medal: medalName(tr, m.family, m.tier) }),
        body: t('msg.medal.body', { name: m.name, desc: medalDesc(tr, m.family, DEFAULT_CONFIG.collection.medals[m.family][m.tier - 1] ?? 0) }),
        tone: 'good',
      };
    case 'bestiary': {
      const names = (ids: string[]) => ids.map((id) => speciesName(id, tr.lang)).join(', ');
      const n = m.seen.length + m.owned.length;
      return {
        title: m.rewards.length ? t('msg.bestiary.tier', { n: m.rewards.at(-1)!.n }) : t(n === 1 ? 'msg.bestiary.one' : 'msg.bestiary.many', { n }),
        body: [
          m.seen.length ? t('msg.bestiary.seen', { list: names(m.seen) }) : '',
          m.owned.length ? t('msg.bestiary.owned', { list: names(m.owned) }) : '',
          ...m.rewards.map((r) =>
            t(r.list === 'seen' ? 'msg.bestiary.rewardSeen' : 'msg.bestiary.rewardOwned', { n: r.n, gold: tr.money(r.gold) }) + (r.rep ? ` ${t('msg.bestiary.rep', { rep: r.rep })}` : ''),
          ),
        ].filter(Boolean).join('\n'),
        tone: 'good',
      };
    }
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
        <div className="muted"><Gold>{t('msg.offerReceived.body', { fee: money(m.fee), value: c ? money(estimatedValue(c, knowledgeOf(game, c.id))) : '?' })}</Gold></div>
        {open ? (
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn small primary"
              onClick={() => {
                const o = act((g) => answerOffer(g, m.offerId, true));
                if (o?.kind === 'error') setError(errorText(tr, o.error));
              }}
            >
              <Gold>{t('offer.accept', { fee: money(m.fee) })}</Gold>
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
  const sheetId = m.kind === 'scoutReport' && m.target === 'creature' ? m.targetId : m.kind === 'transferIn' || m.kind === 'medal' ? m.creatureId : null;
  if (sheetId && locate(game, sheetId))
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => openSheet(sheetId)}>
        {t('msg.openSheet')}
      </button>
    );
  if (m.kind === 'arenaIntro')
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => useGame.getState().openEncyclopedia('rules', 'arena')}>
        {t('arena.open')}
      </button>
    );
  if (m.kind === 'bestiary')
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => useGame.getState().openBestiary()}>
        {t('bestiary.open')}
      </button>
    );
  if (m.kind === 'youthIntake')
    return (
      <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => setScreen('recruit')}>
        {t('msg.openRecruit')}
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

export function BoardCard({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const c = game.board.confidence;
  return (
    <section className="panel board-card" title={t('board.confidence.title')} data-tip="board">
      <div className="row wrap" style={{ gap: 12 }}>
        <span className="row" style={{ gap: 8 }}>
          <BadgeIcon name="board" />
          <b>{t('board.title')}</b>
        </span>
        <span>
          {divName(t, divisionOf(game, game.playerTeamId))} — {t('board.objective', { objective: objectiveText(tr, game.board.objective) })}
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

export function NextMatch({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const f = playerFixture(game);
  if (!f || seasonOver(game)) return null;
  const home = f.home === game.playerTeamId;
  const opp = teamById(game, home ? f.away : f.home);
  // The opponent may play in another division (cups): its own table.
  const table = standings(game, divisionOf(game, opp.id));
  const pos = table.findIndex((r) => r.teamId === opp.id) + 1;
  const row = table[pos - 1];
  return (
    <section className="panel next-match">
      <div className="row wrap" style={{ gap: 10 }}>
        <h4 className="nm-label">{t('inbox.nextMatch')}</h4>
        <span className="tag">{home ? t('common.home') : t('common.away')}</span>
        <b style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem' }}>{opp.name}</b>
        {row && (
          <span className="muted">
            {divisionOf(game, opp.id) !== divisionOf(game, game.playerTeamId) && `${divName(t, divisionOf(game, opp.id))} · `}
            {t('match.position', { pos: tr.ordinal(pos), pts: row.points })}
          </span>
        )}
        <span className="spacer" />
        <button className="btn primary" onClick={() => useGame.getState().continueGame()}>
          {t('continue.next')} ▶
        </button>
      </div>
    </section>
  );
}

export function InboxScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const { reportOf, watchAgain, markAllRead } = useGame.getState();
  const [filter, setFilter] = useState<MessageCategory | null>(null);
  const all = [...game.inbox].reverse();
  const counts = new Map<MessageCategory, number>();
  for (const m of all) counts.set(messageCategory(m), (counts.get(messageCategory(m)) ?? 0) + 1);
  const messages = filter ? all.filter((m) => messageCategory(m) === filter) : all;
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
        {all.length > 0 && (
          <div className="msg-filters">
            <button className={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>
              {t('inbox.cat.all')} <span className="faint">{all.length}</span>
            </button>
            {(Object.keys(CATEGORY_STYLE) as MessageCategory[])
              .filter((c) => counts.has(c))
              .map((c) => (
                <button
                  key={c}
                  className={`chip ${filter === c ? 'on' : ''}`}
                  style={{ '--cat': CATEGORY_STYLE[c].color } as CSSProperties}
                  onClick={() => setFilter(filter === c ? null : c)}
                >
                  <span className="cat-glyph">{CATEGORY_STYLE[c].glyph}</span> {t(`inbox.cat.${c}` as StringKey)} <span className="faint">{counts.get(c)}</span>
                </button>
              ))}
          </div>
        )}
        {messages.length === 0 && <div className="muted">{t('inbox.empty')}</div>}
        <ul className="inbox">
          {messages.map((m) => {
            const w = wording(tr, m, game.cup.rounds);
            const recorded = m.kind === 'matchResult' && !!game.matchHistory?.some((x) => x.fixtureId === m.fixtureId);
            const canReport = m.kind === 'matchResult' && (game.lastMatch?.fixtureId === m.fixtureId || recorded);
            const cat = messageCategory(m);
            return (
              <li
                key={m.id}
                className={`msg ${w.tone} ${unread.has(m.id) ? 'unread' : ''}`}
                style={{ '--cat': CATEGORY_STYLE[cat].color } as CSSProperties}
              >
                <div className="msg-head">
                  <span className="msg-cat" title={t(`inbox.cat.${cat}` as StringKey)}>
                    {CATEGORY_STYLE[cat].glyph}
                  </span>
                  <b className="msg-title"><Gold>{w.title}</Gold></b>
                  <span className="spacer" />
                  <span className="faint mono" style={{ fontSize: '0.786rem' }}>
                    {t('inbox.matchday', { season: m.season, d: m.matchday })}
                  </span>
                </div>
                {w.body && <div className="muted msg-body"><Gold>{w.body}</Gold></div>}
                <MessageActions game={game} m={m} />
                {m.kind === 'matchResult' && (canReport || recorded) && (
                  <span className="row" style={{ gap: 6, marginTop: 6 }}>
                    {canReport && (
                      <button className="btn small" onClick={() => reportOf(m.fixtureId)}>
                        {t('msg.report')}
                      </button>
                    )}
                    {recorded && (
                      <button className="btn small" onClick={() => watchAgain(m.fixtureId)}>
                        ▶ {t('msg.watchAgain')}
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
