/**
 * The board, made visible: its chair, its mood (delighted → angry) and what that mood does (recruitment budget,
 * facility works), the confidence gauge with its zones and trend, the objective against the current place, a running
 * ultimatum. The « board meeting » window stages the moments that matter (season objective, ultimatum, its outcome,
 * the season's verdict). Display only: the rules live in `engine/club/board.ts`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { boardMood, moodOf, objectiveTarget, playerPosition, recruitmentBudget, worksFactor } from '../../../engine/club/board.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import type { BoardMood, GameState, InboxMessage } from '../../../engine/league/types.ts';
import { managerName } from '../../../engine/team/identity.ts';
import { Gold, Modal } from '../../components/common.tsx';
import { divName } from '../../competitions.ts';
import { useT, type Translator } from '../../i18n/index.ts';
import { BadgeIcon } from '../../icons/Icon.tsx';
import { BOARD_NOTE_KINDS, useGame } from '../../store/gameStore.ts';
import { objectiveText } from './InboxScreen.tsx';

const B = DEFAULT_CONFIG.club.board;
export const MOODS: BoardMood[] = ['delighted', 'content', 'uneasy', 'angry'];
export const MOOD_COLOR: Record<BoardMood, string> = { delighted: 'var(--gold)', content: 'var(--good)', uneasy: 'var(--warn)', angry: 'var(--bad)' };

/** Name of the board's chair (fantasy name drawn from the stable id, no RNG of the world). */
export const chairName = (game: GameState) => managerName({ id: `${game.playerTeamId}:board` });

export function MoodPill({ mood }: { mood: BoardMood }) {
  const { t } = useT();
  return (
    <span className={`mood-pill mood-${mood}`} style={{ '--mood': MOOD_COLOR[mood] } as CSSProperties}>
      {t(`board.mood.${mood}`)}
    </span>
  );
}

/** What the current mood does, as short chips. */
function effects(tr: Translator, game: GameState): { text: string; tone: 'good' | 'bad' | 'info' }[] {
  const { t, money } = tr;
  const mood = boardMood(game);
  const out: { text: string; tone: 'good' | 'bad' | 'info' }[] = [];
  if (game.board.frozen) out.push({ text: t('board.fx.frozen', { weeks: tr.weeks(game.board.frozen) }), tone: 'bad' });
  else
    out.push({
      text: t('board.fx.budget', { pct: Math.round(B.budget[mood] * 100), v: money(recruitmentBudget(game)) }),
      tone: mood === 'delighted' ? 'good' : mood === 'content' ? 'info' : 'bad',
    });
  const w = worksFactor(game);
  if (w === null) out.push({ text: t('board.fx.worksFrozen'), tone: 'bad' });
  else if (w < 1) out.push({ text: t('board.fx.works', { pct: Math.round((1 - w) * 100) }), tone: 'good' });
  return out;
}

/** Where the stable stands against the objective. */
function course(tr: Translator, game: GameState): { text: string; tone: 'good' | 'bad' | 'info' } {
  const { t } = tr;
  if (game.matchday <= 1) return { text: t('board.course.start'), tone: 'info' };
  const { position, size } = playerPosition(game);
  const target = objectiveTarget(game.board.objective, size);
  if (position <= target) return { text: t('board.course.on', { pos: tr.ordinal(position) }), tone: 'good' };
  const gap = position - target;
  return { text: t('board.course.off', { pos: tr.ordinal(position), n: gap }), tone: gap >= B.standing.behind ? 'bad' : 'info' };
}

/** Confidence gauge: the four zones, a marker, the last weeks as a thin line above. */
function Gauge({ value, trend }: { value: number; trend: number[] }) {
  const m = B.moods;
  const zones: [BoardMood, number, number][] = [
    ['angry', 0, m.uneasy],
    ['uneasy', m.uneasy, m.content],
    ['content', m.content, m.delighted],
    ['delighted', m.delighted, 100],
  ];
  const pts = trend.length > 1 ? trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${30 - (v / 100) * 28}`).join(' ') : '';
  return (
    <div className="board-gauge">
      {pts && (
        <svg className="board-trend" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
          <polyline points={pts} />
        </svg>
      )}
      <div className="board-zones">
        {zones.map(([mood, a, b]) => (
          <i key={mood} className={moodOf(value) === mood ? 'on' : ''} style={{ left: `${a}%`, width: `${b - a}%`, '--mood': MOOD_COLOR[mood] } as CSSProperties} />
        ))}
        <b className="board-marker" style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

/** Pips of a running ultimatum: wins, losses, still to play. */
export function UltimatumPips({ game }: { game: GameState }) {
  const tr = useT();
  const u = game.board.ultimatum;
  if (!u) return null;
  return (
    <span className="ult-pips" title={tr.t('board.ultimatum.rule', { need: u.need, of: u.of })}>
      {Array.from({ length: u.of }, (_, i) => (
        <i key={i} className={i < u.wins ? 'win' : i < u.played ? 'loss' : ''} />
      ))}
      <b>{tr.t('board.ultimatum.count', { wins: u.wins, need: u.need, left: u.of - u.played })}</b>
    </span>
  );
}

export function BoardCard({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const c = game.board.confidence;
  const mood = boardMood(game);
  const trend = game.board.trend ?? [];
  const delta = trend.length > 1 ? trend[trend.length - 1]! - trend[trend.length - 2]! : 0;
  const crs = course(tr, game);
  return (
    <section className={`panel board-card mood-${mood}`} style={{ '--mood': MOOD_COLOR[mood] } as CSSProperties} data-tip="board">
      <div className="board-head">
        <span className="board-seal">
          <BadgeIcon name="board" />
        </span>
        <div className="board-who">
          <b>{t('board.title')}</b>
          <small className="muted">{t('board.chair', { name: chairName(game) })}</small>
        </div>
        <MoodPill mood={mood} />
        <span className="spacer" />
        <span className="board-conf" title={t('board.confidence.title')}>
          <small>{t('board.confidence')}</small>
          <b>{c} %</b>
          {delta !== 0 && <em className={delta > 0 ? 'good-text' : 'bad-text'}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</em>}
        </span>
      </div>
      <Gauge value={c} trend={trend} />
      <div className="board-lines">
        <span>
          <b>{t('board.objective', { objective: objectiveText(tr, game.board.objective) })}</b>
          <span className="muted"> · {divName(t, divisionOf(game, game.playerTeamId))}</span>
        </span>
        <span className={`${crs.tone}-text`}>{crs.text}</span>
      </div>
      <div className="board-fx">
        {effects(tr, game).map((e) => (
          <span key={e.text} className={`board-chip ${e.tone}`}>
            <Gold>{e.text}</Gold>
          </span>
        ))}
        {game.board.ultimatum && (
          <span className="board-chip bad ult">
            {t('board.ultimatum.short')} <UltimatumPips game={game} />
          </span>
        )}
        <button className="btn small ghost board-rules-btn" onClick={() => useGame.getState().openBoardRules()}>
          {t('board.rules.open')}
        </button>
      </div>
    </section>
  );
}

/** Before a match: the ultimatum is on. */
export function UltimatumBanner({ game, league }: { game: GameState; league: boolean }) {
  const { t } = useT();
  if (!game.board.ultimatum) return null;
  return (
    <div className="remark bad ult-banner">
      <BadgeIcon name="board" /> <b>{t('board.ultimatum.short')}</b> <UltimatumPips game={game} />
      <span className="muted">{league ? t('board.ultimatum.thisCounts') : t('board.ultimatum.cupDoesnt')}</span>
    </div>
  );
}

/** The ladder of moods with their effects and the rules of confidence (meeting window, rules window). */
function Rules({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const loss = DEFAULT_CONFIG.identity.difficulties[game.difficulty ?? 'normal'].boardLoss;
  const r = B.result;
  const u = B.ultimatum;
  const mood = boardMood(game);
  const line = (m: BoardMood) => {
    const parts = [t('board.fx.budgetShort', { pct: Math.round(B.budget[m] * 100) })];
    if (m === 'delighted') parts.push(t('board.fx.works', { pct: Math.round((1 - B.worksDelighted) * 100) }));
    if (m === 'angry') parts.push(t('board.fx.worksFrozen'), t('board.fx.ultimatum', { need: u.need, of: u.of }));
    return parts.join(' · ');
  };
  const from = (m: BoardMood) => (m === 'angry' ? `< ${B.moods.uneasy}` : `≥ ${B.moods[m]}`);
  return (
    <div className="board-rules">
      <h4>{t('board.rules.moves')}</h4>
      <ul>
        <li>{t('board.rules.results', { kw: r.koWin, w: r.pointsWin, l: Math.round(r.pointsLoss * loss * 10) / 10, kl: Math.round(r.koLoss * loss * 10) / 10 })}</li>
        <li>{t('board.rules.table', { from: B.standing.from, on: B.standing.onTarget, n: B.standing.behind, off: Math.round(B.standing.offTarget * loss * 10) / 10 })}</li>
        <li>{t('board.rules.season', { met: B.met, missed: Math.round(B.missed * loss) })}</li>
      </ul>
      <h4>{t('board.rules.moods')}</h4>
      <div className="mood-ladder">
        {MOODS.map((m) => (
          <div key={m} className={`mood-row ${m === mood ? 'now' : ''}`} style={{ '--mood': MOOD_COLOR[m] } as CSSProperties}>
            <span className="mood-at">{from(m)}</span>
            <MoodPill mood={m} />
            <span className="mood-fx">{line(m)}</span>
          </div>
        ))}
      </div>
      <p className="muted board-rules-ult">{t('board.rules.ultimatum', { need: u.need, of: u.of, reward: u.reward, rep: u.reputation, weeks: tr.weeks(u.frozenWeeks) })}</p>
      {game.manager?.career ? (
        <>
          <h4>{t('career.rules.title')}</h4>
          <p className="muted">{t('career.rules.body', { grace: DEFAULT_CONFIG.career.sack.graceWeeks })}</p>
        </>
      ) : (
        <p className="faint">{t('board.rules.noSack')}</p>
      )}
    </div>
  );
}

type Note = Extract<InboxMessage, { kind: 'boardObjective' | 'ultimatum' | 'ultimatumOver' | 'boardVerdict' }>;

function noteText(tr: Translator, m: Note): { title: string; speech: string; tone: 'good' | 'bad' | 'info'; rules: boolean } {
  const { t, money } = tr;
  const u = B.ultimatum;
  switch (m.kind) {
    case 'boardObjective':
      return { title: t('meet.objective.title'), speech: t('meet.objective.speech', { div: divName(t, m.division), objective: objectiveText(tr, m.objective) }), tone: 'info', rules: true };
    case 'ultimatum':
      return { title: t('meet.ultimatum.title'), speech: t('meet.ultimatum.speech', { need: m.need, of: m.of, rep: u.reputation, weeks: tr.weeks(u.frozenWeeks) }), tone: 'bad', rules: false };
    case 'ultimatumOver':
      return m.met
        ? { title: t('meet.ultMet.title'), speech: t('meet.ultMet.speech', { reward: u.reward }), tone: 'good', rules: false }
        : { title: t('meet.ultMissed.title'), speech: t(m.sacked ? 'meet.ultMissed.sacked' : 'meet.ultMissed.speech', { rep: m.reputation, weeks: tr.weeks(m.frozen) }) + (m.warning ? ` ${t('meet.ultMissed.warning')}` : ''), tone: 'bad', rules: false };
    case 'boardVerdict':
      return m.met
        ? { title: t('meet.verdictMet.title'), speech: t('meet.verdictMet.speech', { pos: tr.ordinal(m.position), bonus: money(m.bonus) }), tone: 'good', rules: false }
        : { title: t('meet.verdictMissed.title'), speech: t('meet.verdictMissed.speech', { pos: tr.ordinal(m.position) }), tone: 'bad', rules: false };
  }
}

function Meeting({ title, tone, children, onClose, closeLabel }: { title: string; tone: string; children: ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <Modal
      title={
        <span className="row" style={{ gap: 8 }}>
          <BadgeIcon name="board" /> {title}
        </span>
      }
      onClose={onClose}
      className={`meeting-dialog tone-${tone}`}
    >
      {children}
      <div className="row" style={{ marginTop: 14 }}>
        <span className="spacer" />
        <button className="btn primary" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </Modal>
  );
}

/** The chair speaks: a moment of the season with the board (queued like the scout reports). */
export function BoardMeeting() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game);
  const notes = useGame((s) => s.boardNotes);
  const rules = useGame((s) => s.boardRules);
  const blocked = useGame((s) => !!s.match || s.drill || !!s.recap || !!s.sheet || s.intro || s.reveals.length > 0);
  if (!game) return null;
  const st = useGame.getState();
  if (rules)
    return (
      <Meeting title={t('board.rules.title')} tone="info" onClose={st.closeBoardRules} closeLabel={t('common.close')}>
        <Rules game={game} />
      </Meeting>
    );
  if (blocked || !notes.length) return null;
  const m = game.inbox.find((x): x is Note => x.id === notes[0] && BOARD_NOTE_KINDS.has(x.kind));
  if (!m) {
    queueMicrotask(() => useGame.getState().closeBoardNote());
    return null;
  }
  const n = noteText(tr, m);
  const mood = boardMood(game);
  return (
    <Meeting title={n.title} tone={n.tone} onClose={st.closeBoardNote} closeLabel={t('meet.ok')}>
      <div className="meeting">
        <div className="meeting-chair" style={{ '--mood': MOOD_COLOR[mood] } as CSSProperties}>
          <span className="board-seal big">
            <BadgeIcon name="board" />
          </span>
          <b>{chairName(game)}</b>
          <small className="muted">{t('board.chairRole')}</small>
          <MoodPill mood={mood} />
          <span className="meeting-conf">
            {t('board.confidence')} <b>{game.board.confidence} %</b>
          </span>
          {game.board.ultimatum && <UltimatumPips game={game} />}
        </div>
        <div className="meeting-body">
          <blockquote className={`meeting-speech ${n.tone}`}>
            <Gold>{`« ${n.speech} »`}</Gold>
          </blockquote>
          {n.rules && <Rules game={game} />}
        </div>
      </div>
    </Meeting>
  );
}
