/**
 * UI state of a league game: the current GameState (saved to IndexedDB after every change),
 * the screen shown and the match-day flow. Game rules live in src/engine/league.
 */
import type { TeamCrest } from '../../data/crest.ts';
import { create } from 'zustand';
import type { MatchResult, MatchSetup } from '../../engine/combat/types.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import { replayMatch } from '../../engine/combat/simulate.ts';
import { aiPrepare, fixtureSetup, newGame, playMatchday, playerFixture, seasonOver, startNextSeason, cupDue } from '../../engine/league/season.ts';
import type { GameState, MatchRecord } from '../../engine/league/types.ts';
import type { Team } from '../../engine/model.ts';
import { repairTactic } from '../../engine/team/team.ts';
import { randomSeed } from '../format.ts';
import { useSettings } from '../i18n/index.ts';
import { loadGame, saveGame } from './saves.ts';
import { completedWeek } from '../season.ts';

export type Screen = 'dashboard' | 'inbox' | 'squad' | 'tactics' | 'league' | 'recruit' | 'finances' | 'training' | 'staff' | 'facilities' | 'news' | 'help' | 'encyclopedia' | 'arena' | 'match';

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
  newGame: (teamName: string, seed?: string, difficulty?: DifficultyId, crest?: TeamCrest) => void;
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
  /** Just opened with a saved game: the start screen offers to continue it or start a new one. */
  launch: boolean;
  /** Welcome window of a new game (not saved: shown once, right after the game is created). */
  intro: boolean;
  closeIntro: () => void;
  /** State when the current week started (not saved: a reload starts a new one). */
  weekStart: GameState | null;
  /** End-of-week summary to show: the week's first and last states. */
  recap: { before: GameState; after: GameState } | null;
  closeRecap: () => void;
  /** Tab to open on the League screen (consumed by it). */
  leagueTab: 'table' | 'comps' | 'honours' | null;
  openLeague: (tab: 'table' | 'comps' | 'honours') => void;
  /** Tab to open in the Encyclopedia (consumed by it). */
  encTab: { tab: string; id?: string } | null;
  openBestiary: () => void;
  openEncyclopedia: (tab: string, id?: string) => void;
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
  /** Commits a state that may end the week: then shows its summary and starts a new week. */
  const advance = (prev: GameState, next: GameState): boolean => {
    commit(next);
    if (completedWeek(next) <= completedWeek(prev)) return false;
    set({ recap: { before: get().weekStart ?? prev, after: next }, weekStart: next });
    return true;
  };
  const mapPlayerTeam = (f: (t: Team) => Team) => {
    const g = get().game;
    if (!g) return;
    commit({ ...g, teams: g.teams.map((t) => (t.id === g.playerTeamId ? f(t) : t)) });
  };

  return {
    ready: false,
    game: null,
    screen: 'dashboard',
    match: null,
    viewing: null,
    replaying: null,
    saveError: false,
    playerControls: true,

    init: async () => {
      const game = await loadGame();
      set({ game, ready: true, screen: game ? 'dashboard' : get().screen, launch: !!game, weekStart: game });
    },

    newGame: (teamName, seed, difficulty, crest) => {
      const game = newGame({ seed: seed?.trim() || randomSeed(), teamName, lang: useSettings.getState().lang, difficulty, crest });
      set({ match: null, viewing: null, screen: 'dashboard', intro: true, launch: false, weekStart: game, recap: null });
      commit(game);
    },

    setScreen: (screen) => set({ screen, viewing: null, launch: false }),

    setPlayerTeam: (team) => mapPlayerTeam(() => team),
    autoPick: () => mapPlayerTeam((t) => aiPrepare(t)),
    repair: () => mapPlayerTeam((t) => repairTactic(t)),

    continueGame: () => {
      const g = get().game;
      if (!g) return;
      // The summary of the week that just ended comes first.
      if (get().recap) return;
      if (seasonOver(g)) {
        const next = startNextSeason(g);
        commit(next);
        set({ screen: 'inbox', match: null, weekStart: next });
        return;
      }
      let f = playerFixture(g);
      let cur = g;
      if (!f) {
        // Midweeks the stable does not play in pass on their own, up to the next match.
        cur = playMatchday(cur);
        while (!seasonOver(cur) && cupDue(cur) && !playerFixture(cur)) cur = playMatchday(cur);
        if (advance(g, cur)) return;
        f = seasonOver(cur) ? undefined : playerFixture(cur);
        if (!f) return;
      }
      set({ screen: 'match', viewing: null, match: { fixtureId: f.id, matchday: cur.matchday, phase: 'pre', setup: null, result: null, liveKey: 0 } });
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
      advance(g, next);
      set({ match: { ...match, phase: 'report', result: next.lastMatch?.result ?? null } });
    },

    finishLive: (result) => {
      const { game: g, match } = get();
      if (!g || !match) return;
      advance(g, playMatchday(g, result));
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
    launch: false,
    closeIntro: () => set({ intro: false }),
    weekStart: null,
    recap: null,
    closeRecap: () => set({ recap: null }),
    leagueTab: null,
    openLeague: (tab) => set({ leagueTab: tab, screen: 'league', viewing: null, launch: false }),
    encTab: null,
    openBestiary: () => set({ encTab: { tab: 'bestiary' }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null }),
    openEncyclopedia: (tab, id) => set({ encTab: { tab, id }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null }),
  };
});
