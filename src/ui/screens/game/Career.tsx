/**
 * Career mode in the UI: job offers (Journal actions, and the window a sacked manager cannot close before taking a
 * job). Zero game rules: everything comes from `engine/club/career.ts`.
 */
import { useState } from 'react';
import { acceptJob, declineJob, lastWarning, resign } from '../../../engine/club/career.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import type { GameState, InboxMessage, JobOffer } from '../../../engine/league/types.ts';
import { lastMatchday, standings } from '../../../engine/league/season.ts';
import { divName } from '../../competitions.ts';
import { Modal, Money } from '../../components/common.tsx';
import { BadgeIcon } from '../../icons/Icon.tsx';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { useT } from '../../i18n/index.ts';
import { BOARD_NOTE_KINDS, useGame } from '../../store/gameStore.ts';

/** Takes the job: the manager moves, the new board's objective is announced, a new week starts there. */
function take(game: GameState, offerId: string) {
  const { state } = acceptJob(game, offerId);
  if (state === game) return;
  const known = new Set(game.inbox.map((m) => m.id));
  const notes = state.inbox.filter((m) => !known.has(m.id) && BOARD_NOTE_KINDS.has(m.kind)).map((m) => m.id);
  useGame.getState().update(() => state);
  useGame.setState({ weekStart: state, boardNotes: notes, screen: 'dashboard', sheet: null });
}

function OfferCard({ game, offer, canDecline }: { game: GameState; offer: JobOffer; canDecline: boolean }) {
  const { t, ordinal } = useT();
  const team = game.teams.find((x) => x.id === offer.teamId);
  if (!team) return null;
  const club = clubOf(game, team.id);
  const d = divisionOf(game, team.id);
  const place = standings(game, d).findIndex((r) => r.teamId === team.id) + 1;
  const confirmTake = () => {
    if (game.manager?.unemployed || window.confirm(t('job.confirm', { team: team.name, from: game.teams.find((x) => x.id === game.playerTeamId)!.name }))) take(game, offer.id);
  };
  return (
    <div className="job-card panel">
      <div className="row" style={{ gap: 10 }}>
        <StableCrest team={team} size={40} />
        <div>
          <b>{team.name}</b>
          <div className="muted">{divName(t, d)}</div>
        </div>
      </div>
      <div className="job-stats">
        <span>
          {t('job.reputation')} <b>{Math.round(club.reputation)}</b>
        </span>
        <span>
          {t('job.treasury')} <Money v={club.balance} compact />
        </span>
        <span>
          {t('job.place')} <b>{place > 0 ? ordinal(place) : '—'}</b>
        </span>
      </div>
      <p className="muted job-why">{t(`job.why.${offer.reason}`)}</p>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn primary small" onClick={confirmTake}>
          {t('job.take')}
        </button>
        {canDecline && (
          <button className="btn small ghost" onClick={() => useGame.getState().update((g) => declineJob(g, offer.id))}>
            {t('job.decline')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Under a `jobOffer` message: take it or turn it down while it stands. */
export function JobOfferActions({ game, m }: { game: GameState; m: Extract<InboxMessage, { kind: 'jobOffer' }> }) {
  const { t } = useT();
  const offer = game.manager?.offers.find((o) => o.id === m.offerId);
  if (!offer) return <span className="faint">{t('job.closed')}</span>;
  const canDecline = !game.manager?.unemployed || (game.manager?.offers.length ?? 0) > 1;
  return <OfferCard game={game} offer={offer} canDecline={canDecline} />;
}

/** A sacked manager: offers to choose from, nothing else can be done before. */
export function JobCentre() {
  const { t } = useT();
  const game = useGame((s) => s.game);
  const blocked = useGame((s) => !!s.match || s.drill || !!s.recap);
  const [, refresh] = useState(0);
  const m = game?.manager;
  if (!game || !m?.unemployed || blocked) return null;
  const why = [...game.inbox].reverse().find((x) => x.kind === 'sacked' || x.kind === 'resigned');
  return (
    <Modal title={t('job.centre.title')} onClose={() => refresh((n) => n + 1)} locked wide>
      <p>
        {why?.kind === 'sacked'
          ? t(`msg.sacked.${why.reason}`, { team: why.team, rep: why.reputation })
          : why?.kind === 'resigned'
            ? t('msg.resigned.body', { team: why.team, rep: why.reputation })
            : t('job.centre.body', { rep: m.reputation })}
      </p>
      <div className="job-list">
        {m.offers.map((o) => (
          <OfferCard key={o.id} game={game} offer={o} canDecline={m.offers.length > 1} />
        ))}
      </div>
    </Modal>
  );
}

/** Dashboard (career mode): the manager's reputation, warnings, offers waiting, stables managed, resignation. */
export function ManagerCard({ game }: { game: GameState }) {
  const { t } = useT();
  const m = game.manager;
  if (!m?.career) return null;
  const trend = m.trend ?? [];
  const delta = trend.length > 1 ? trend[trend.length - 1]! - trend[trend.length - 2]! : 0;
  const job = m.jobs.at(-1);
  const team = game.teams.find((x) => x.id === game.playerTeamId)!;
  const offers = m.unemployed ? 0 : m.offers.length;
  const onResign = () => {
    if (!window.confirm(t('career.resign.confirm', { team: team.name }))) return;
    useGame.getState().update((g) => resign(g));
  };
  const week = (w: number) => (w <= 1 ? t('week.pre') : t('week.of', { d: w, n: lastMatchday(game) }));
  return (
    <section className="panel career-card">
      <div className="career-head">
        <span className="board-seal">
          <BadgeIcon name="board" />
        </span>
        <div className="career-who">
          <b>{m.name ?? t('career.title')}</b>
          {m.name && <small className="muted">{t('career.title')}</small>}
        </div>
        {m.ironman && <span className="career-tag">{t('career.ironman')}</span>}
        <button className="link" onClick={() => useGame.getState().setScreen('career')}>
          {t('cs.open')} →
        </button>
        <span className="spacer" />
        <span className="career-rep" title={t('career.reputation.title')}>
          <small>{t('career.reputation')}</small>
          <b>{m.reputation}</b>
          {delta !== 0 && <em className={delta > 0 ? 'good-text' : 'bad-text'}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</em>}
        </span>
      </div>
      <div className="career-bar" title={t('career.reputation.title')}>
        <i style={{ width: `${m.reputation}%` }} />
      </div>
      <div className="career-lines">
        {job && <span className="muted">{t('career.since', { team: job.teamName, s: job.from.season, w: week(job.from.matchday) })}</span>}
        {lastWarning(game) && <span className="board-chip bad">{t('career.warning')}</span>}
        {offers > 0 && (
          <button className="board-chip good link-chip" onClick={() => useGame.getState().setScreen('inbox')}>
            {t('career.offers', { n: offers })} · {t('career.offers.open')} →
          </button>
        )}
      </div>
      {m.jobs.length > 1 && (
        <div className="career-history">
          <small className="muted">{t('career.history')}</small>
          <ol>
            {m.jobs.map((j, i) => (
              <li key={`${j.teamId}-${i}`}>
                <b>{j.teamName}</b>{' '}
                <span className="muted">
                  {!j.to ? t('career.fromSeason', { s: j.from.season }) : j.to.season === j.from.season ? t('career.season', { s: j.from.season }) : t('career.seasons', { a: j.from.season, b: j.to.season })} ·{' '}
                  {j.end ? t(`career.end.${j.end}`) : t('career.now')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {!m.unemployed && (
        <button className="btn small ghost career-resign" onClick={onResign}>
          {t('career.resign')}
        </button>
      )}
    </section>
  );
}
