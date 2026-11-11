/**
 * Guided tutorial: contextual tips anchored to elements marked with `data-tip="…"`.
 * Progress is a per-viewer preference (localStorage); the game state is never touched.
 */
import { create } from 'zustand';

export type Placement = 'below' | 'above' | 'right' | 'left' | 'center';

export interface TutorialStep {
  id: string;
  /** Value of the `data-tip` attribute of the element to point at. */
  anchor: string;
  placement?: Placement;
}

/** In order: a tip shows when it is the first unseen one whose anchor is on screen. */
export const STEPS: TutorialStep[] = [
  { id: 'continue', anchor: 'continue' },
  { id: 'squad', anchor: 'squad' },
  { id: 'lineup', anchor: 'lineup', placement: 'above' },
  { id: 'prematch', anchor: 'prematch' },
  { id: 'liveCards', anchor: 'live-cards', placement: 'right' },
  { id: 'break', anchor: 'break' },
  { id: 'report', anchor: 'report' },
  { id: 'inbox', anchor: 'inbox' },
  { id: 'training', anchor: 'training' },
  { id: 'youth', anchor: 'youth' },
  { id: 'league', anchor: 'league-tabs' },
  { id: 'recruit', anchor: 'recruit' },
  { id: 'finances', anchor: 'finances' },
];

/** First steps: a short list of things to do, ticked as the player does them. */
export const QUESTS = ['creature', 'tactics', 'match', 'report', 'training', 'recruit'] as const;
export type QuestId = (typeof QUESTS)[number];
const QUESTS_KEY = 'tutorial.quests';
const QUESTS_HIDDEN_KEY = 'tutorial.questsHidden';

const SEEN_KEY = 'tutorial.seen';
const ENABLED_KEY = 'tutorial.enabled';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the tutorial simply restarts next time */
  }
}

interface TutorialState {
  enabled: boolean;
  seen: string[];
  /** First steps done, and whether the player closed the list. */
  quests: QuestId[];
  questsHidden: boolean;
  markQuest: (id: QuestId) => void;
  hideQuests: () => void;
  markSeen: (id: string) => void;
  skip: () => void;
  restart: () => void;
  setEnabled: (v: boolean) => void;
}

export const useTutorial = create<TutorialState>()((set, get) => ({
  enabled: read(ENABLED_KEY) !== 'false',
  seen: (() => {
    try {
      const v = JSON.parse(read(SEEN_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })(),
  quests: (() => {
    try {
      const v = JSON.parse(read(QUESTS_KEY) ?? '[]');
      return Array.isArray(v) ? (v.filter((x) => (QUESTS as readonly string[]).includes(x)) as QuestId[]) : [];
    } catch {
      return [];
    }
  })(),
  questsHidden: read(QUESTS_HIDDEN_KEY) === 'true',
  markQuest: (id) => {
    if (get().quests.includes(id)) return;
    const quests = [...get().quests, id];
    write(QUESTS_KEY, JSON.stringify(quests));
    set({ quests });
  },
  hideQuests: () => {
    write(QUESTS_HIDDEN_KEY, 'true');
    set({ questsHidden: true });
  },
  markSeen: (id) => {
    const seen = [...new Set([...get().seen, id])];
    write(SEEN_KEY, JSON.stringify(seen));
    set({ seen });
  },
  skip: () => {
    write(ENABLED_KEY, 'false');
    set({ enabled: false });
  },
  restart: () => {
    write(ENABLED_KEY, 'true');
    write(SEEN_KEY, '[]');
    write(QUESTS_KEY, '[]');
    write(QUESTS_HIDDEN_KEY, 'false');
    set({ enabled: true, seen: [], quests: [], questsHidden: false });
  },
  setEnabled: (enabled) => {
    write(ENABLED_KEY, String(enabled));
    set({ enabled });
  },
}));
