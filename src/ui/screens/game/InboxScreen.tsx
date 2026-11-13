import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
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
import { BadgeIcon, UiIcon } from '../../icons/Icon.tsx';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { medalDesc, medalName } from '../../components/CreatureRecord.tsx';
import { levelOfAbility, totalXpOfAbility } from '../../../engine/progression/levels.ts';

/** Message families: each has a colour and a symbol in the inbox. */
export type MessageCategory = 'match' | 'medical' | 'market' | 'club' | 'squad' | 'competition' | 'scouting';

const CATEGORY_STYLE: Record<MessageCategory, { color: string; icon: string }> = {
  match: { color: 'var(--accent)', icon: 'versus' },
  medical: { color: 'var(--bad)', icon: 'injury' },
  market: { color: 'var(--warn)', icon: 'nav-finances' },
  club: { color: 'var(--info)', icon: 'nav-club' },
  squad: { color: 'var(--good)', icon: 'nav-squad' },
  competition: { color: 'color-mix(in srgb, var(--info) 55%, var(--bad))', icon: 'nav-competitions' },
  scouting: { color: 'color-mix(in srgb, var(--info) 50%, var(--good))', icon: 'scout' },
};

/** A game-icon per kind of message (the category's icon otherwise). */
function messageIcon(m: InboxMessage): string {
  switch (m.kind) {
    case 'death':
      return 'memorial';
    case 'recovered':
      return 'fac-infirmary';
    case 'tired':
      return 'stamina';
    case 'offerReceived':
    case 'offerExpired':
    case 'transferIn':
    case 'transferOut':
    case 'marketNews':
    case 'emergencySigning':
      return 'nav-recruit';
    case 'trainingReport':
      return 'nav-training';
    case 'levelUp':
      return 'power';
    case 'abilityUnlocked':
      return 'kind-spell';
    case 'coachHired':
      return 'nav-staff';
    case 'medal':
      return `medal-${m.family}`;
    case 'bestiary':
      return 'bestiary';
    case 'arenaIntro':
      return 'arena-clear';
    case 'promoted':
      return 'news-promotion';
    case 'relegated':
      return 'news-relegation';
    case 'retired':
      return 'news-retirement';
    case 'seasonEnd':
    case 'seasonPrize':
    case 'cupWon':
      return 'honours';
    case 'ambition':
      return 'help-goal';
    case 'boardObjective':
    case 'boardVerdict':
    case 'boardWarning':
      return 'board';
    case 'facilityDone':
      return 'nav-facilities';
    case 'relation':
    case 'friendLeft':
      return 'nav-stable';
    default:
      return CATEGORY_STYLE[messageCategory(m)].icon;
  }
}

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
        body: [
          m.gains?.length
            ? t('msg.levelUp.gains', {
                list: m.gains.map((g) => `+${g.d} ${attributeText(g.k, tr.lang).name}`).join(', '),
                n: m.gains.reduce((s, g) => s + g.d, 0),
              })
            : '',
          t('msg.levelUp.body', { name: m.name, n: m.level, p: m.points }),
        ]
          .filter(Boolean)
          .join('\n'),
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
      if (m.more?.length) {
        const names = [m.name, ...m.more.map((x) => x.name)];
        return {
          title: t('msg.medal.titleMany', { n: names.length, medal: medalName(tr, m.family, m.tier) }),
          body: t('msg.medal.bodyMany', { names: names.join(', '), desc: medalDesc(tr, m.family, DEFAULT_CONFIG.collection.medals[m.family][m.tier - 1] ?? 0) }),
          tone: 'good',
        };
      }
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
      <div className="stack" style={{ gap: 8 }}>
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
  if (m.kind === 'medal' && m.more?.length) {
    const who = [{ creatureId: m.creatureId, name: m.name }, ...m.more].filter((x) => locate(game, x.creatureId));
    return (
      <div className="row wrap" style={{ gap: 6 }}>
        {who.map((x) => (
          <button key={x.creatureId} className="btn small ghost" onClick={() => openSheet(x.creatureId)}>
            {x.name}
          </button>
        ))}
      </div>
    );
  }
  const sheetId = m.kind === 'scoutReport' && m.target === 'creature' ? m.targetId : m.kind === 'transferIn' || m.kind === 'medal' ? m.creatureId : null;
  if (sheetId && locate(game, sheetId))
    return (
      <button className="btn small ghost" onClick={() => openSheet(sheetId)}>
        {t('msg.openSheet')}
      </button>
    );
  if (m.kind === 'arenaIntro')
    return (
      <button className="btn small ghost" onClick={() => useGame.getState().openEncyclopedia('rules', 'arena')}>
        {t('arena.open')}
      </button>
    );
  if (m.kind === 'bestiary')
    return (
      <button className="btn small ghost" onClick={() => useGame.getState().openBestiary()}>
        {t('bestiary.open')}
      </button>
    );
  if (m.kind === 'youthIntake')
    return (
      <button className="btn small ghost" onClick={() => setScreen('recruit')}>
        {t('msg.openRecruit')}
      </button>
    );
  if (m.kind === 'scoutReport' || m.kind === 'contractExpiring')
    return (
      <button className="btn small ghost" onClick={() => setScreen(m.kind === 'scoutReport' ? 'recruit' : 'finances')}>
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

/** Body text of a message: plain lines become paragraphs, « • » lines a list. */
function MessageBody({ text, list }: { text: string; list?: boolean }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = !!list || line.startsWith('• ');
    const last = blocks.at(-1);
    if (last && bullet && last.list) last.lines.push(line.replace(/^• /, ''));
    else blocks.push({ list: bullet, lines: [line.replace(/^• /, '')] });
  }
  return (
    <div className="jr-text">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i}>
            {b.lines.map((l, j) => (
              <li key={j}>
                <Gold>{l}</Gold>
              </li>
            ))}
          </ul>
        ) : (
          b.lines.map((l, j) => (
            <p key={`${i}-${j}`}>
              <Gold>{l}</Gold>
            </p>
          ))
        ),
      )}
    </div>
  );
}

/** Big score of a match result, from the player's side, with both crests. */
function ResultBoard({ game, m }: { game: GameState; m: Extract<InboxMessage, { kind: 'matchResult' }> }) {
  const { t } = useT();
  const f = game.fixtures.find((x) => x.id === m.fixtureId);
  const me = teamById(game, game.playerTeamId);
  const oppId = f ? (f.home === game.playerTeamId ? f.away : f.home) : null;
  const opp = oppId ? teamById(game, oppId) : { id: m.opponent, name: m.opponent };
  return (
    <div className={`jr-score ${m.won ? 'won' : 'lost'}`}>
      <span className="jr-team">
        <StableCrest team={me} size={52} />
        <b>{me.name}</b>
      </span>
      <span className="jr-points">
        <span className="jr-digits">
          <b>{m.score[0]}</b>
          <i>–</i>
          <b>{m.score[1]}</b>
        </span>
        <small>{m.method === 'ko' ? t('inbox.method.ko', { n: m.rounds }) : t('inbox.method.points')}</small>
      </span>
      <span className="jr-team away">
        <StableCrest team={opp} size={52} />
        <b>{opp.name}</b>
      </span>
    </div>
  );
}

function weekLabel(tr: Translator, m: InboxMessage): string {
  return m.matchday > 0 ? tr.t('inbox.week', { season: m.season, d: m.matchday }) : tr.t('inbox.weekZero', { season: m.season });
}

export function InboxScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const { reportOf, watchAgain, markAllRead } = useGame.getState();
  const [filter, setFilter] = useState<MessageCategory | null>(null);
  const all = useMemo(() => [...game.inbox].reverse(), [game.inbox]);
  // Unread on arrival: the marks stay for this visit until the message is opened (the save marks them read).
  const [fresh, setFresh] = useState(() => new Set(game.inbox.filter((m) => !m.read).map((m) => m.id)));
  const counts = new Map<MessageCategory, number>();
  const unreadCounts = new Map<MessageCategory, number>();
  for (const m of all) {
    const c = messageCategory(m);
    counts.set(c, (counts.get(c) ?? 0) + 1);
    if (fresh.has(m.id)) unreadCounts.set(c, (unreadCounts.get(c) ?? 0) + 1);
  }
  const messages = filter ? all.filter((m) => messageCategory(m) === filter) : all;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(markAllRead, 1500);
    return () => clearTimeout(id);
  }, [game.inbox.length, markAllRead]);
  useEffect(() => {
    listRef.current?.querySelector('.jr-row.on')?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  const pick = (id: string) => {
    setSelectedId(id);
    if (fresh.has(id)) setFresh((s) => new Set([...s].filter((x) => x !== id)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = messages.findIndex((m) => m.id === selected?.id);
    const next = messages[Math.max(0, Math.min(messages.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) pick(next.id);
  };

  // The list, grouped by week (newest first).
  const groups: { key: string; label: string; items: InboxMessage[] }[] = [];
  for (const m of messages) {
    const key = `${m.season}-${m.matchday}`;
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(m);
    else groups.push({ key, label: weekLabel(tr, m), items: [m] });
  }
  const totalUnread = fresh.size;
  const folder = (c: MessageCategory | null) => {
    const n = c ? (counts.get(c) ?? 0) : all.length;
    const u = c ? (unreadCounts.get(c) ?? 0) : totalUnread;
    return (
      <button
        key={c ?? 'all'}
        className={`jr-folder ${filter === c ? 'on' : ''}`}
        style={c ? ({ '--cat': CATEGORY_STYLE[c].color } as CSSProperties) : undefined}
        onClick={() => {
          setFilter(c);
          setSelectedId(null);
        }}
      >
        <span className="jr-folder-ico">
          <UiIcon name={c ? CATEGORY_STYLE[c].icon : 'nav-inbox'} />
        </span>
        <span className="jr-folder-name">{t(c ? (`inbox.cat.${c}` as StringKey) : 'inbox.cat.all')}</span>
        {u > 0 ? <span className="jr-badge">{u}</span> : <span className="jr-count">{n}</span>}
      </button>
    );
  };

  const w = selected ? wording(tr, selected, game.cup.rounds) : null;
  const cat = selected ? messageCategory(selected) : null;
  const recorded = selected?.kind === 'matchResult' && !!game.matchHistory?.some((x) => x.fixtureId === selected.fixtureId);
  const canReport = selected?.kind === 'matchResult' && (game.lastMatch?.fixtureId === selected.fixtureId || recorded);

  return (
    <div className="journal" data-tip="inbox">
      <nav className="panel jr-folders" aria-label={t('inbox.title')}>
        <div className="jr-heading">
          <h2>{t('inbox.title')}</h2>
          <span className={totalUnread > 0 ? 'jr-sub on' : 'jr-sub'}>{totalUnread > 0 ? t('inbox.unread', { n: totalUnread }) : t('inbox.allRead')}</span>
          {totalUnread > 0 && (
            <button
              className="btn small ghost jr-readall"
              onClick={() => {
                markAllRead();
                setFresh(new Set());
              }}
            >
              {t('inbox.markAllRead')}
            </button>
          )}
        </div>
        <div className="jr-folder-list">
          {folder(null)}
          {(Object.keys(CATEGORY_STYLE) as MessageCategory[]).filter((c) => counts.has(c)).map((c) => folder(c))}
        </div>
      </nav>
      <div className="panel jr-list" ref={listRef} tabIndex={0} onKeyDown={onKey} role="listbox" aria-label={t('inbox.title')}>
        {messages.length === 0 && <div className="muted jr-empty">{t('inbox.empty')}</div>}
        {groups.map((g) => (
          <div key={g.key} className="jr-group">
            <div className="jr-week">{g.label}</div>
            {g.items.map((m) => {
              const mw = wording(tr, m, game.cup.rounds);
              const c = messageCategory(m);
              const preview = (mw.body.split('\n')[0] ?? '').replace(/^• /, '');
              return (
                <button
                  key={m.id}
                  role="option"
                  aria-selected={m.id === selected?.id}
                  className={`jr-row ${mw.tone} ${m.id === selected?.id ? 'on' : ''} ${fresh.has(m.id) ? 'unread' : ''}`}
                  style={{ '--cat': CATEGORY_STYLE[c].color } as CSSProperties}
                  onClick={() => pick(m.id)}
                >
                  <span className="jr-ico">
                    <UiIcon name={messageIcon(m)} />
                  </span>
                  <span className="jr-row-text">
                    <b>{mw.title}</b>
                    {preview && <small>{preview}</small>}
                  </span>
                  {m.kind === 'matchResult' && (
                    <span className={`jr-pill ${m.won ? 'won' : 'lost'}`}>
                      {m.score[0]}–{m.score[1]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <article className="panel jr-reader" key={selected?.id}>
        {selected && w && cat ? (
          <>
            <header className="jr-reader-head" style={{ '--cat': CATEGORY_STYLE[cat].color } as CSSProperties}>
              <span className="jr-big-ico">
                <UiIcon name={messageIcon(selected)} size="1.9rem" />
              </span>
              <span className="jr-reader-meta">
                <span className="jr-tags">
                  <span className="jr-cat">
                    <UiIcon name={CATEGORY_STYLE[cat].icon} /> {t(`inbox.cat.${cat}` as StringKey)}
                  </span>
                  <span className="faint">{weekLabel(tr, selected)}</span>
                </span>
                <h3 className={`jr-title ${w.tone}`}>
                  <Gold>{w.title}</Gold>
                </h3>
              </span>
            </header>
            {selected.kind === 'matchResult' && <ResultBoard game={game} m={selected} />}
            {w.body && selected.kind !== 'matchResult' && <MessageBody text={w.body} list={selected.kind === 'marketNews'} />}
            <div className="jr-actions">
              <MessageActions game={game} m={selected} />
              {selected.kind === 'matchResult' && canReport && (
                <button className="btn" onClick={() => reportOf(selected.fixtureId)}>
                  {t('msg.report')}
                </button>
              )}
              {selected.kind === 'matchResult' && recorded && (
                <button className="btn primary" onClick={() => watchAgain(selected.fixtureId)}>
                  <UiIcon name="versus" /> {t('msg.watchAgain')}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="muted jr-empty">{t('inbox.pick')}</div>
        )}
        <span className="jr-keys faint">{t('inbox.keys')}</span>
      </article>
    </div>
  );
}
