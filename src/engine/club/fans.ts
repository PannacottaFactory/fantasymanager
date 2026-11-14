/**
 * The supporters of the player's stable: a mood (0–100) that rises with wins — above all KO wins at home — and
 * streaks, falls with defeats, drifts slowly back to normal, and sets the ticket revenue of home matches.
 * Pure: functions mutate the state they are given.
 */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import { pushMessage } from '../league/messages.ts';
import type { FansState, FansTier, Fixture, GameState } from '../league/types.ts';

export function fansOf(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): FansState {
  return state.fans ?? { mood: cfg.club.fans.start, streak: 0 };
}

export function tierOf(mood: number, cfg: GameConfig = DEFAULT_CONFIG): FansTier {
  const t = cfg.club.fans.tiers;
  return mood >= t.euphoric ? 'euphoric' : mood >= t.enthusiastic ? 'enthusiastic' : mood >= t.loyal ? 'loyal' : mood >= t.grumbling ? 'grumbling' : 'furious';
}

/** Ticket revenue multiplier of the player's home matches. */
export function fansTicketFactor(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): number {
  const t = cfg.club.fans.tickets;
  return t.min + (fansOf(state, cfg).mood / 100) * (t.max - t.min);
}

/** Moves the mood and announces a new tier. */
export function moveFans(state: GameState, d: number, cfg: GameConfig = DEFAULT_CONFIG) {
  const f = (state.fans = { ...fansOf(state, cfg) });
  const before = f.tier ?? tierOf(f.mood, cfg);
  f.mood = clamp(Math.round((f.mood + d) * 10) / 10, 0, 100);
  const after = tierOf(f.mood, cfg);
  if (after !== before) pushMessage(state, { kind: 'fansMood', from: before, to: after, mood: Math.round(f.mood) });
  f.tier = after;
}

/** The player's matches of the week: result, venue and streak move the supporters. */
export function weeklyFans(state: GameState, played: Fixture[], cfg: GameConfig = DEFAULT_CONFIG) {
  const c = cfg.club.fans;
  let any = false;
  for (const fx of played) {
    const side = fx.home === state.playerTeamId ? 0 : fx.away === state.playerTeamId ? 1 : -1;
    if (side < 0 || !fx.result) continue;
    any = true;
    const won = fx.result.winner === side;
    const ko = fx.result.method === 'ko';
    const r = side === 0 ? c.result.home : c.result.away;
    const f = fansOf(state, cfg);
    const streak = won ? Math.max(0, f.streak) + 1 : Math.min(0, f.streak) - 1;
    state.fans = { ...f, streak };
    const run = Math.abs(streak) >= c.streak.from ? c.streak.bonus * Math.sign(streak) : 0;
    moveFans(state, (won ? (ko ? r.koWin : r.pointsWin) : ko ? r.koLoss : r.pointsLoss) + run, cfg);
  }
  if (!any) return;
  const f = fansOf(state, cfg);
  state.fans = { ...f, trend: [...(f.trend ?? []), Math.round(f.mood)].slice(-c.trendWeeks) };
}

/** Each league week the mood drifts a little back towards normal (old glories and grudges fade). */
export function fansDrift(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const f = fansOf(state, cfg);
  moveFans(state, (cfg.club.fans.start - f.mood) * cfg.club.fans.drift, cfg);
}
