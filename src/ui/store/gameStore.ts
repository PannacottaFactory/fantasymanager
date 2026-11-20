/**
 * UI state of a league game: the current GameState (saved to IndexedDB after every change),
 * the screen shown and the match-day flow. Game rules live in src/engine/league.
 */
import type { TeamCrest } from '../../data/crest.ts';
import { create } from 'zustand';
import type { MatchResult, MatchSetup } from '../../engine/combat/types.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import { replayMatch } from '../../engine/combat/simulate.ts';
import { aiPrepare, fixtureSetup, newGame, playMatchday, playerFixture, seasonOver, startNextSeason, cupDue, type StartingSquad } from '../../engine/league/season.ts';
import type { GameState, MatchRecord } from '../../engine/league/types.ts';
import type { Team } from '../../engine/model.ts';
import { repairTactic } from '../../engine/team/team.ts';
import { randomSeed } from '../format.ts';
import { useSettings } from '../i18n/index.ts';
import { currentSlot, deleteGame, listSlots, loadGame, saveGame, savePlayTime, setCurrentSlot, type SlotId, type SlotMeta } from './saves.ts';
import { completedWeek } from '../season.ts';
import { weekGrowth } from '../growth.ts';
import type { InboxMessage } from '../../engine/league/types.ts';

/** Inbox messages that open a board meeting. */
export const BOARD_NOTE_KINDS = new Set<InboxMessage['kind']>(['boardObjective', 'ultimatum', 'ultimatumOver', 'boardVerdict']);
import { sessionPool, sessionState } from '../../engine/progression/sessions.ts';
import { knowledgeOf } from '../../engine/economy/scouting.ts';
import { resetPlayClock, setPlayClockActive } from './playClock.ts';

export type Screen = 'dashboard' | 'inbox' | 'squad' | 'tactics' | 'league' | 'recruit' | 'finances' | 'training' | 'staff' | 'facilities' | 'career' | 'news' | 'help' | 'encyclopedia' | 'arena' | 'match';

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
  newGame: (teamName: string, seed?: string, difficulty?: DifficultyId, crest?: TeamCrest, slot?: SlotId, mode?: { career?: boolean; ironman?: boolean; managerName?: string; squad?: StartingSquad }) => void;
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
  /** States just before and after the player's last match (not saved), for its progress window. */
  afterMatch: { before: GameState; after: GameState } | null;
  /** After-match progress window (not saved): XP bars filling, opened when the report is closed, before the training. */
  progress: { before: GameState; after: GameState } | null;
  closeProgress: () => void;
  /** After-match training window (not saved): opens when a match report is closed and sessions are waiting. */
  drill: boolean;
  closeDrill: () => void;
  /** Scout reports waiting for their reveal window (inbox message ids, not saved), shown once nothing else is open. */
  reveals: string[];
  openReveal: (messageId: string) => void;
  closeReveal: () => void;
  /** Creatures that just joined the player's stable, with how well they were known before (not saved): their stats unveil. */
  signings: { id: string; before: number }[];
  closeSigning: () => void;
  /** The contract talks window (season's expiring contracts), opened by the contract warning or from the Journal. */
  contractTalks: boolean;
  openContractTalks: () => void;
  closeContractTalks: () => void;
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

/** A match is being played or its report is open (the pre-match screen, left open while the manager looks around, is not). */
export const matchUnderway = (s: { match: MatchFlow | null }) => !!s.match && s.match.phase !== 'pre';

export const useGame = create<GameStore>()((set, get) => {
  /** Replaces the game state and saves it (errors are surfaced, never thrown). */
  const commit = (game: GameState) => {
    queueSignings(get().game, game);
    set({ game });
    saveGame(game, get().slot).then(
      () => get().saveError && set({ saveError: false }),
      () => set({ saveError: true }),
    );
  };
  /** Creatures that joined the player's stable since `prev` get their unveiling (not on a change of stable). */
  function queueSignings(prev: GameState | null, next: GameState) {
    if (!prev || prev.playerTeamId !== next.playerTeamId || prev.worldSeed !== next.worldSeed) return;
    const had = new Set(prev.teams.find((t) => t.id === prev.playerTeamId)?.creatures.map((c) => c.id) ?? []);
    const fresh = (next.teams.find((t) => t.id === next.playerTeamId)?.creatures ?? [])
      .filter((c) => !had.has(c.id))
      .map((c) => ({ id: c.id, before: knowledgeOf(prev, c.id) }))
      .filter((x) => x.before < 100);
    if (fresh.length) set({ signings: [...get().signings, ...fresh] });
  }
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
    // The contract warning (a few weeks before the end of the season) opens the contract talks.
    if (next.inbox.some((m) => !known.has(m.id) && m.kind === 'contractExpiring')) set({ contractTalks: true });
    queueBoard(prev, next);
    if (completedWeek(next) <= completedWeek(prev)) return false;
    // A week finished by a stable the manager just took over: nothing of it was theirs, no summary.
    const job = next.manager?.jobs.at(-1);
    if (job && next.manager!.jobs.length > 1 && job.from.season === next.season && job.from.matchday > 1 && job.from.matchday === next.matchday) {
      set({ weekStart: next });
      return false;
    }
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
      // Dev size test (the game shown in a frame): straight back into the game, no start screen.
      const framed = import.meta.env.DEV && window.self !== window.top;
      resetPlayClock(game?.playTime ?? 0);
      set({ game, slot, ready: true, screen: game ? 'dashboard' : get().screen, launch: !!game && !framed, weekStart: game });
      void get().refreshSlots();
    },

    newGame: (teamName, seed, difficulty, crest, slot, mode) => {
      resetPlayClock(0);
      const game = newGame({ seed: seed?.trim() || randomSeed(), teamName, lang: useSettings.getState().lang, difficulty, crest, career: mode?.career, ironman: mode?.ironman, managerName: mode?.managerName, squad: mode?.squad });
      const target = slot ?? get().slot;
      setCurrentSlot(target);
      set({ slot: target, match: null, viewing: null, replaying: null, screen: 'dashboard', intro: true, launch: false, weekStart: game, recap: null, drill: false, progress: null, afterMatch: null, reveals: [], signings: [], contractTalks: false, boardNotes: game.inbox.filter((m) => BOARD_NOTE_KINDS.has(m.kind)).map((m) => m.id), boardRules: false, sheet: null });
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
      // Leaving the game in play: it is already saved in its own slot (only its time played is brought up to date).
      const prev = get().game;
      if (prev) await savePlayTime(get().slot, prev.worldSeed);
      const game = await loadGame(slot);
      if (!game) return;
      setCurrentSlot(slot);
      resetPlayClock(game.playTime ?? 0);
      set({ game, slot, match: null, viewing: null, replaying: null, screen: 'dashboard', launch: false, intro: false, weekStart: game, recap: null, drill: false, progress: null, afterMatch: null, reveals: [], signings: [], contractTalks: false, boardNotes: [], boardRules: false, sheet: null });
    },
    deleteSlot: async (slot) => {
      await deleteGame(slot);
      if (slot === get().slot) set({ game: null, match: null, viewing: null, replaying: null, recap: null, sheet: null, weekStart: null });
      await get().refreshSlots();
    },

    setScreen: (screen) => {
      // Leaving a finished match's report by any other way still closes it (and opens the after-match training).
      if (screen !== 'match' && get().match?.phase === 'report') get().closeMatch();
      set({ screen, viewing: null, launch: false });
    },

    setPlayerTeam: (team) => mapPlayerTeam(() => team),
    autoPick: () => mapPlayerTeam((t) => aiPrepare(t)),
    repair: () => mapPlayerTeam((t) => repairTactic(t)),

    continueGame: () => {
      const g = get().game;
      if (!g) return;
      // A report still open is closed first (whatever button led here), so its training window is never skipped.
      if (get().match?.phase === 'report') get().closeMatch();
      // The after-match training and the summary of the week that just ended come first.
      if (get().progress || get().drill || get().recap) return;
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
      // Ironman: the save already holds the match as played (simulated); finishing it live replaces that. Leaving the
      // live match (closing the page) therefore never gives a second chance.
      if (g.manager?.ironman) saveGame(playMatchday(g), get().slot).catch(() => set({ saveError: true }));
      set({ match: { ...match, phase: 'live', setup: structuredClone(setup), liveKey: match.liveKey + 1 } });
    },

    simulate: () => {
      const { game: g, match } = get();
      if (!g || !match) return;
      const next = playMatchday(g);
      advance(g, next);
      set({ afterMatch: { before: g, after: next } });
      set({ match: { ...match, phase: 'report', result: next.lastMatch?.result ?? null } });
    },

    finishLive: (result) => {
      const { game: g, match } = get();
      if (!g || !match) return;
      const next = playMatchday(g, result);
      advance(g, next);
      set({ afterMatch: { before: g, after: next } });
      set({ match: { ...match, phase: 'report', result } });
    },

    closeMatch: () => {
      const g = get().game;
      // Every match is followed by a training session (the window opens before the end-of-week summary).
      const drill = !!g && sessionPool(g).length > 0 && sessionState(g).available > 0;
      // The match's progress (XP bars filling) comes first, when there is any.
      const am = get().afterMatch;
      const progress = am && weekGrowth(am.before, am.after).length > 0 ? am : null;
      set({ match: null, screen: 'league', drill, progress, afterMatch: null });
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
    signings: [],
    closeSigning: () => set({ signings: get().signings.slice(1) }),
    contractTalks: false,
    openContractTalks: () => set({ contractTalks: true }),
    closeContractTalks: () => set({ contractTalks: false }),
    reveals: [],
    openReveal: (id) => set({ reveals: [id, ...get().reveals.filter((x) => x !== id)] }),
    closeReveal: () => set({ reveals: get().reveals.slice(1) }),
    afterMatch: null,
    progress: null,
    closeProgress: () => set({ progress: null }),
    drill: false,
    closeDrill: () => {
      const { game, recap } = get();
      // The week's summary then shows the session's gains too (and the next week starts after them).
      if (recap && game) set({ drill: false, recap: { ...recap, after: game }, weekStart: game });
      else set({ drill: false });
    },
    leagueTab: null,
    openLeague: (tab) => {
      if (get().match?.phase === 'report') get().closeMatch();
      set({ leagueTab: tab, screen: 'league', viewing: null, launch: false });
    },
    encTab: null,
    openBestiary: () => {
      if (get().match?.phase === 'report') get().closeMatch();
      set({ encTab: { tab: 'bestiary' }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null });
    },
    openEncyclopedia: (tab, id) => {
      if (get().match?.phase === 'report') get().closeMatch();
      set({ encTab: { tab, id }, screen: 'encyclopedia', viewing: null, launch: false, sheet: null });
    },
  };
});

// Play time runs while a game is open and the start screen closed (and the tab visible: see playClock).
useGame.subscribe((s, prev) => {
  setPlayClockActive(!!s.game && !s.launch);
  // Back on the start screen: the save shows the time played up to now (then the slots are listed again).
  if (s.launch && !prev.launch && s.game) void savePlayTime(s.slot, s.game.worldSeed).then(() => useGame.getState().refreshSlots());
});
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    const s = useGame.getState();
    if (document.visibilityState === 'hidden' && s.game) void savePlayTime(s.slot, s.game.worldSeed);
  });

// Dev only: lets the headless checks (scripts/*.mjs) read the store.
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __fm: useGame });
