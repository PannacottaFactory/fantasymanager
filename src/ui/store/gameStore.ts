/**
 * UI state of a league game: the current GameState (saved to IndexedDB after every change),
 * the screen shown and the match-day flow. Game rules live in src/engine/league.
 */
import { create } from 'zustand';
import type { MatchResult, MatchSetup } from '../../engine/combat/types.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import { replayMatch } from '../../engine/combat/simulate.ts';
import { aiPrepare, fixtureSetup, newGame, playMatchday, playerFixture, seasonOver, startNextSeason } from '../../engine/league/season.ts';
import type { GameState, MatchRecord } from '../../engine/league/types.ts';
import type { Team } from '../../engine/model.ts';
import { repairTactic } from '../../engine/team/team.ts';
import { randomSeed } from '../format.ts';
import { useSettings } from '../i18n/index.ts';
import { loadGame, saveGame } from './saves.ts';

export type Screen = 'inbox' | 'squad' | 'tactics' | 'league' | 'recruit' | 'finances' | 'training' | 'staff' | 'facilities' | 'news' | 'help' | 'encyclopedia' | 'arena' | 'match';

export interface MatchFlow {
  fixtureId: string;
  matchday: number;
  phase: 'pre' | 'live' | 'report';
  setup: MatchSetup | null;
  result: MatchResult | null;
  /** Bumped to restart the live view. */
  liveKey: number;
}

interface GameStore {
  ready: boolean;
  game: GameState | null;
  screen: Screen;
  match: MatchFlow | null;
  /** A stored report opened from the inbox or the league screen. */
  viewing: MatchResult | null;
  /** A past match being watched again. */
  replaying: MatchRecord | null;
  watchAgain: (fixtureId: string) => void;
  /** Report of one of the recorded matches (rebuilt by replaying it). */
  reportOf: (fixtureId: string) => void;
  stopReplay: () => void;
  saveError: boolean;
  playerControls: boolean;
  init: () => Promise<void>;
  newGame: (teamName: string, seed?: string, difficulty?: DifficultyId) => void;
  setScreen: (s: Screen) => void;
  setPlayerTeam: (team: Team) => void;
  autoPick: () => void;
  repair: () => void;
  continueGame: () => void;
  setPlayerControls: (v: boolean) => void;
  playLive: () => void;
  simulate: () => void;
  finishLive: (r: MatchResult) => void;
  closeMatch: () => void;
  markAllRead: () => void;
  viewReport: (r: MatchResult | null) => void;
  /** Applies a market action (bid, signing, renewal…), saves, and returns its outcome. */
  act: <O>(f: (g: GameState) => { state: GameState; outcome: O }) => O | null;
  /** Applies a plain state change and saves. */
  update: (f: (g: GameState) => GameState) => void;
  /** Creature sheet opened from anywhere (inbox, recruitment…). */
  sheet: string | null;
  /** Welcome window of a new game (not saved: shown once, right after the game is created). */
  intro: boolean;
  closeIntro: () => void;
  openSheet: (id: string | null) => void;
}

export const useGame = create<GameStore>()((set, get) => {
  /** Replaces the game state and saves it (errors are surfaced, never thrown). */
  const commit = (game: GameState) => {
    set({ game });
    saveGame(game).then(
      () => get().saveError && set({ saveError: false }),
      () => set({ saveError: true }),
    );
  };
  const mapPlayerTeam = (f: (t: Team) => Team) => {
    const g = get().game;
    if (!g) return;
    commit({ ...g, teams: g.teams.map((t) => (t.id === g.playerTeamId ? f(t) : t)) });
  };

  return {
    ready: false,
    game: null,
    screen: 'inbox',
    match: null,
    viewing: null,
    replaying: null,
    saveError: false,
    playerControls: true,

    init: async () => {
      const game = await loadGame();
      set({ game, ready: true, screen: game ? 'inbox' : get().screen });
    },

    newGame: (teamName, seed, difficulty) => {
      const game = newGame({ seed: seed?.trim() || randomSeed(), teamName, lang: useSettings.getState().lang, difficulty });
      set({ match: null, viewing: null, screen: 'inbox', intro: true });
      commit(game);
    },

    setScreen: (screen) => set({ screen, viewing: null }),

    setPlayerTeam: (team) => mapPlayerTeam(() => team),
    autoPick: () => mapPlayerTeam((t) => aiPrepare(t)),
    repair: () => mapPlayerTeam((t) => repairTactic(t)),

    continueGame: () => {
      const g = get().game;
      if (!g) return;
      if (seasonOver(g)) {
        commit(startNextSeason(g));
        set({ screen: 'inbox', match: null });
        return;
      }
      const f = playerFixture(g);
      if (!f) {
        commit(playMatchday(g));
        return;
      }
      set({ screen: 'match', viewing: null, match: { fixtureId: f.id, matchday: g.matchday, phase: 'pre', setup: null, result: null, liveKey: 0 } });
    },

    setPlayerControls: (v) => set({ playerControls: v }),

    playLive: () => {
      const { game: g, match } = get();
      if (!g || !match) return;
      const f = g.fixtures.find((x) => x.id === match.fixtureId);
      if (!f) return;
      const { setup } = fixtureSetup(g, f);
      set({ match: { ...match, phase: 'live', setup: structuredClone(setup), liveKey: match.liveKey + 1 } });
    },

    simulate: () => {
      const { game: g, match } = get();
      if (!g || !match) return;
      const next = playMatchday(g);
      commit(next);
      set({ match: { ...match, phase: 'report', result: next.lastMatch?.result ?? null } });
    },

    finishLive: (result) => {
      const { game: g, match } = get();
      if (!g || !match) return;
      commit(playMatchday(g, result));
      set({ match: { ...match, phase: 'report', result } });
    },

    closeMatch: () => set({ match: null, screen: 'league' }),

    markAllRead: () => {
      const g = get().game;
      if (!g || g.inbox.every((m) => m.read)) return;
      commit({ ...g, inbox: g.inbox.map((m) => (m.read ? m : { ...m, read: true })) });
    },

    viewReport: (viewing) => set({ viewing }),

    watchAgain: (fixtureId) => {
      const rec = get().game?.matchHistory?.find((m) => m.fixtureId === fixtureId);
      if (rec) set({ replaying: structuredClone(rec), viewing: null });
    },

    reportOf: (fixtureId) => {
      const g = get().game;
      if (!g) return;
      if (g.lastMatch?.fixtureId === fixtureId) return set({ viewing: g.lastMatch.result });
      const rec = g.matchHistory?.find((m) => m.fixtureId === fixtureId);
      if (rec) set({ viewing: replayMatch(structuredClone(rec.setup), rec.decisions) });
    },

    stopReplay: () => set({ replaying: null }),

    act: (f) => {
      const g = get().game;
      if (!g) return null;
      const { state, outcome } = f(g);
      if (state !== g) commit(state);
      return outcome;
    },

    update: (f) => {
      const g = get().game;
      if (g) commit(f(g));
    },

    sheet: null,
    openSheet: (sheet) => set({ sheet }),
    intro: false,
    closeIntro: () => set({ intro: false }),
  };
});
