/**
 * Star requests in the UI: the choices in the Journal (each with its known consequence), the answer once given, the
 * note on the creature sheet (pending request, promise in progress). Display only: rules in engine/club/requests.ts.
 */
import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { REQUEST_CHOICES, answerRequest, requestOf } from '../../../engine/club/requests.ts';
import { roundTo } from '../../../engine/economy/value.ts';
import type { CreatureRequest, GameState, InboxMessage, RequestChoice } from '../../../engine/league/types.ts';
import { Gold } from '../../components/common.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

const Q = DEFAULT_CONFIG.club.requests;
const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** Label and consequence of a choice. */
export function choiceText(tr: Translator, r: Pick<CreatureRequest, 'kind' | 'wage' | 'asked' | 'fee'>, choice: RequestChoice): { label: string; hint: string } {
  const { t, money } = tr;
  const wage = r.wage ?? 0;
  const asked = r.asked ?? 0;
  switch (r.kind) {
    case 'playtime':
      if (choice === 'promise') return { label: t('req.c.promise'), hint: t('req.h.promise', { need: Q.playtime.need, of: Q.playtime.of, kept: signed(Q.playtime.kept), broken: signed(Q.playtime.broken), friends: signed(Q.playtime.friendsBroken) }) };
      if (choice === 'list') return { label: t('req.c.list'), hint: t('req.h.list', { m: signed(Q.playtime.listed) }) };
      return { label: t('req.c.refusePlay'), hint: t('req.h.morale', { m: signed(Q.playtime.refused) }) };
    case 'raise':
      if (choice === 'accept') return { label: t('req.c.accept', { v: money(asked) }), hint: t('req.h.morale', { m: signed(Q.raise.accepted) }) };
      if (choice === 'compromise') return { label: t('req.c.compromise', { v: money(roundTo((wage + asked) / 2, 10)) }), hint: t('req.h.morale', { m: signed(Q.raise.compromise) }) };
      return { label: t('req.c.refuseRaise'), hint: t('req.h.friends', { m: signed(Q.raise.refused), f: signed(Q.raise.friendsRefused) }) };
    case 'leave':
      if (choice === 'raise') return { label: t('req.c.keep', { v: money(roundTo(wage * Q.leave.raiseMult, 10)) }), hint: t('req.h.morale', { m: signed(Q.leave.kept) }) };
      if (choice === 'sell') return { label: t('req.c.sell', { v: money(r.fee ?? 0) }), hint: t('req.h.sell') };
      return { label: t('req.c.refuseLeave'), hint: t('req.h.friends', { m: signed(Q.leave.refused), f: signed(Q.leave.friendsRefused) }) };
  }
}

/** Progress of a playing-time promise. */
function promiseText(tr: Translator, r: CreatureRequest): string {
  return tr.t('req.promise', { starts: r.starts ?? 0, need: Q.playtime.need, left: Q.playtime.of - (r.seen ?? 0) });
}

type RequestMessage = Extract<InboxMessage, { kind: 'request' }>;

/** The Journal's reading pane: the choices while open, then the answer given. */
export function RequestActions({ game, m }: { game: GameState; m: RequestMessage }) {
  const tr = useT();
  const { t } = tr;
  const [error, setError] = useState<string | null>(null);
  const r = game.requests?.find((x) => x.id === m.requestId);
  if (!r) return null;
  if (r.status === 'open')
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="muted">{t('req.until', { d: r.until })}</div>
        <div className="req-choices">
          {REQUEST_CHOICES[r.kind].map((choice, i) => {
            const c = choiceText(tr, { ...r, wage: m.wage ?? r.wage }, choice);
            return (
              <button
                key={choice}
                className={`req-choice ${i === 0 ? 'first' : ''}`}
                onClick={() => {
                  const o = useGame.getState().act((g) => answerRequest(g, r.id, choice));
                  if (o?.kind === 'error') setError(t(`req.err.${o.error}`));
                }}
              >
                <b>
                  <Gold>{c.label}</Gold>
                </b>
                <small>{c.hint}</small>
              </button>
            );
          })}
        </div>
        <button className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => useGame.getState().openSheet(r.creatureId)}>
          {t('msg.openSheet')}
        </button>
        {error && <div className="answer bad">{error}</div>}
      </div>
    );
  const answer = r.choice ? choiceText(tr, r, r.choice).label : '';
  return (
    <div className="stack" style={{ gap: 6 }}>
      {r.status === 'expired' ? (
        <span className="answer bad">{t('req.expired')}</span>
      ) : (
        <span className="answer info">
          <Gold>{t('req.answered', { a: answer })}</Gold>
        </span>
      )}
      {r.status === 'promised' && <span className="muted">{promiseText(tr, r)}</span>}
      {r.status === 'kept' && <span className="good-text">{t('req.kept')}</span>}
      {r.status === 'broken' && <span className="bad-text">{t('req.broken')}</span>}
    </div>
  );
}

/** On the creature sheet: a request waiting for an answer, or a promise in progress. */
export function RequestNote({ game, creatureId }: { game: GameState; creatureId: string }) {
  const tr = useT();
  const { t } = tr;
  const r = requestOf(game, creatureId);
  if (!r) return null;
  const msg = game.inbox.find((m) => m.kind === 'request' && m.requestId === r.id);
  return (
    <div className={`req-note ${r.status === 'open' ? 'open' : ''}`}>
      <b>{r.status === 'open' ? t(`req.note.${r.kind}`) : t('req.note.promise')}</b>
      <span className="muted">{r.status === 'open' ? t('req.note.answer', { d: r.until }) : promiseText(tr, r)}</span>
      {r.status === 'open' && msg && (
        <button
          className="btn small"
          onClick={() => {
            const st = useGame.getState();
            st.openSheet(null);
            st.setScreen('inbox');
          }}
        >
          {t('req.note.go')}
        </button>
      )}
    </div>
  );
}
