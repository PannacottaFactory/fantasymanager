/** Inbox helper shared by the season flow and the economy (mutates the state it is given). */
import { matchdayCount } from './schedule.ts';
import type { GameState, InboxMessage } from './types.ts';

export type MessageBody = InboxMessage extends infer M ? (M extends InboxMessage ? Omit<M, 'id' | 'matchday' | 'season' | 'read'> : never) : never;

export function pushMessage(state: GameState, body: MessageBody) {
  const matchday = Math.max(1, Math.min(state.matchday, matchdayCount(state.fixtures)));
  state.inbox.push({ ...body, id: `m${state.nextMessageId++}`, matchday, season: state.season, read: false } as InboxMessage);
}

/** Current week for bookkeeping: the matchday about to be played (clamped to the season). */
export const currentWeek = (state: GameState) => Math.max(1, Math.min(state.matchday, matchdayCount(state.fixtures)));
