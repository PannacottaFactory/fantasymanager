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
  { id: 'welcome', anchor: 'dashboard', placement: 'center' },
  { id: 'board', anchor: 'board' },
  { id: 'continue', anchor: 'continue' },
  { id: 'nav', anchor: 'nav' },
  { id: 'help', anchor: 'help-btn' },
  { id: 'inbox', anchor: 'inbox' },
  { id: 'squad', anchor: 'squad' },
  { id: 'lineup', anchor: 'lineup', placement: 'above' },
  { id: 'orders', anchor: 'orders' },
  { id: 'prematch', anchor: 'prematch' },
  { id: 'liveCards', anchor: 'live-cards', placement: 'right' },
  { id: 'liveFeed', anchor: 'live-feed', placement: 'left' },
  { id: 'liveSpeed', anchor: 'live-speed' },
  { id: 'break', anchor: 'break' },
  { id: 'report', anchor: 'report' },
  { id: 'league', anchor: 'league-tabs' },
  { id: 'recruit', anchor: 'recruit' },
  { id: 'finances', anchor: 'finances' },
  { id: 'training', anchor: 'training' },
  { id: 'youth', anchor: 'youth' },
];

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
    set({ enabled: true, seen: [] });
  },
  setEnabled: (enabled) => {
    write(ENABLED_KEY, String(enabled));
    set({ enabled });
  },
}));
