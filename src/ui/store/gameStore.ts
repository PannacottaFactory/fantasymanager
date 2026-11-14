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
import { currentSlot, deleteGame, listSlots, loadGame, saveGame, setCurrentSlot, type SlotId, type SlotMeta } from './saves.ts';
import { completedWeek } from '../season.ts';
import type { InboxMessage } from '../../engine/league/types.ts';

/** Inbox messages that open a board meeting. */
export const BOARD_NOTE_KINDS = new Set<InboxMessage['kind']>(['boardObjective', 'ultimatum', 'ultimatumOver', 'boardVerdict']);
import { sessionPool, sessionState } from '../../engine/progression/sessions.ts';

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
  newGame: (teamName: string, seed?: string, difficulty?: DifficultyId, crest?: TeamCrest, slot?: SlotId) => void;
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
  /** Back to the start screen (save slots, new game) from a game. */
  openLaunch: () => void;
  /** Save slot of the game in play (it autosaves there). */
  slot: SlotId;
  /** Summaries of the save slots (null until listed). */
  slots: Record<SlotId, SlotMeta | null> | null;
  refreshSlots: () => Promise<void>;
  /** Loads the game saved in a slot and plays it. */
  loadSlot: (slot: SlotId) => Promise<void>;
  /** Deletes a slot (the game in play is closed if it was that one). */
  deleteSlot: (slot: SlotId) => Promise<void>;
  /** Welcome window of a new game (not saved: shown once, right after the game is created). */
  intro: boolean;
  closeIntro: () => void;
  /** State when the current week started (not saved: a reload starts a new one). */
  weekStart: GameState | null;
  /** End-of-week summary to show: the week's first and last states. */
  recap: { before: GameState; after: GameState } | null;
  closeRecap: () => void;
  /** After-match training window (not saved): opens when a match report is closed and sessions are waiting. */
  drill: boolean;
  closeDrill: () => void;
  /** Scout reports waiting for their reveal window (inbox message ids, not saved), shown once nothing else is open. */
  reveals: string[];
  openReveal: (messageId: string) => void;
  closeReveal: () => void;
  /** Board meetings waiting (inbox message ids: season objective, ultimatum, its outcome, verdict), not saved. */
  boardNotes: string[];
  closeBoardNote: () => void;
  /** The board's rules window. */
  boardRules: boolean;
  openBoardRules: () => void;
  closeBoardRules: () => void;
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
    saveGame(game, get().slot).then(
      () => get().saveError && set({ saveError: false }),
      () => set({ saveError: true }),
    );
  };
  /** Commits a state that may end the week: then shows its summary and starts a new week. */
  /** Board moments that just happened get their meeting. */
  const queueBoard = (prev: GameState | null, next: GameState) => {
    const known = new Set(prev?.inbox.map((m) => m.id) ?? []);
    const fresh = next.inbox.filter((m) => !known.has(m.id) && BOARD_NOTE_KINDS.has(m.kind)).map((m) => m.id);
    if (fresh.length) set({ boardNotes: [...get().boardNotes, ...fresh] });
  };
  const advance = (prev: GameState, next: GameState): boolean => {
    commit(next);
    // Scout reports that just came in get their reveal.
    const known = new Set(prev.inbox.map((m) => m.id));
    const fresh = next.inbox.filter((m) => !known.has(m.id) && m.kind === 'scoutReport' && m.target === 'creature' && m.verdict).map((m) => m.id);
    if (fresh.length) set({ reveals: [...get().reveals, ...fresh] });
    queueBoard(prev, next);
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
    slot: currentSlot(),
    slots: null,

    init: async () => {
      const slot = currentSlot();
      const game = await loadGame(slot);
      set({ game, slot, ready: true, screen: game ? 'dashboard' : get().screen, launch: !!game, weekStart: game });
      void get().refreshSlots();
    },

    newGame: (teamName, seed, difficulty, crest, slot) => {
      const game = newGame({ seed: seed?.trim() || randomSeed(), teamName, lang: useSettings.getState().lang, difficulty, crest });
      const target = slot ?? get().slot;
      setCurrentSlot(target);
      set({ slot: target, match: null, viewing: null, replaying: null, screen: 'dashboard', intro: true, launch: false, weekStart: game, recap: null, drill: false, reveals: [], boardNotes: game.inbox.filter((m) => BOARD_NOTE_KINDS.has(m.kind)).map((m) => m.id), boardRules: false, sheet: null });
      commit(game);
      void get().refreshSlots();
    },

    openLaunch: () => {
      set({ launch: true, viewing: null, sheet: null });
      void get().refreshSlots();
    },
    refreshSlots: async () => {
      try {
        set({ slots: await listSlots() });
      } catch {
        set({ slots: null });
      }
    },
    loadSlot: async (slot) => {
      // Leaving the game in play: it is already saved in its own slot.
      const game = await loadGame(slot);
      if (!game) return;
      setCurrentSlot(slot);
      set({ game, slot, match: null, viewing: null, replaying: null, screen: 'dashboard', launch: false, intro: false, weekStart: game, recap: null, drill: false, reveals: [], boardNotes: [], boardRules: false, sheet: null });
    },
    deleteSlot: async (slot) => {
      await deleteGame(slot);
      if (slot === get().slot) set({ game: null, match: null, viewing: null, replaying: null, recap: null, sheet: null, weekStart: null });
      await get().refreshSlots();
    },

    setScreen: (screen) => set({ screen, viewing: null, launch: false }),

    setPlayerTeam: (team) => mapPlayerTeam(() => team),
    autoPick: () => mapPlayerTeam((t) => aiPrepare(t)),
    repair: () => mapPlayerTeam((t) => repairTactic(t)),

    continueGame: () => {
      const g = get().game;
      if (!g) return;
      // The after-match training and the summary of the week that just ended come first.
      if (get().drill || get().recap) return;
      if (seasonOver(g)) {
        const next = startNextSeason(g);
        commit(next);
        queueBoard(g, next);
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

    closeMatch: () => {
      const g = get().game;
      // Every match is followed by a training session (the window opens before the end-of-week summary).
      const drill = !!g && sessionPool(g).length > 0 && sessionState(g).available > 0;
      set({ match: null, screen: 'league', drill });
    },

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
    boardNotes: [],
    closeBoardNote: () => set({ boardNotes: get().boardNotes.slice(1) }),
    boardRules: false,
    openBoardRules: () => set({ boardRules: true }),
    closeBoardRules: () => set({ boardRules: false }),
    reveals: [],
    openReveal: (id) => set({ reveals: [id, ...get().reveals.filter((x) => x !== id)] }),
    closeReveal: () => set({ reveals: get().reveals.slice(1) }),
    drill: false,
    closeDrill: () => {
      const { game, recap } = get();
      // The week's summary then shows the session's gains too (and the next week starts after them).
      if (recap && game) set({ drill: false, recap: { ...recap, after: game }, weekStart: game });
      else set({ drill: false });
    },
    leagueTab: null,
    openLeague: (tab) => set({ leagueTab: tab, screen: 'league', viewing: null, launch: false }),
    encTab: null,
    openBestiary: () => set({ encTab: { tab: 'bestiary' }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null }),
    openEncyclopedia: (tab, id) => set({ encTab: { tab, id }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null }),
  };
});

// Dev only: lets the headless checks (scripts/*.mjs) read the store.
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __fm: useGame });
