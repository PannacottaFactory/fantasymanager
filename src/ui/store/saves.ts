/**
 * Save games in IndexedDB: three slots, each with a small summary (`meta`) so the start screen can list them without
 * loading whole games. The game autosaves into the slot it was loaded from / created in (`currentSlot`, a per-viewer
 * preference in localStorage). The first slot keeps the key of the former single autosave, so old saves show up there.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { TeamCrest } from '../../data/crest.ts';
import type { DifficultyId } from '../../data/config/identity.ts';
import { divisionOf } from '../../engine/league/divisions.ts';
import { migrateGame } from '../../engine/league/migrate.ts';
import { lastMatchday, playerTeam, standings } from '../../engine/league/season.ts';
import type { GameState } from '../../engine/league/types.ts';
import { currentWeek } from '../season.ts';

const DB_NAME = 'shadow-arenas';
const STORE = 'saves';
/** Summaries live in the same store under their own keys: no database upgrade (an upgrade waits for every other
 * open tab / stale connection to close, and the game would hang on « Loading… »). */
const metaKey = (slot: SlotId) => `meta:${slot}`;
export const AUTOSAVE = 'auto';
export const SLOTS = [AUTOSAVE, 'slot-2', 'slot-3'] as const;
export type SlotId = (typeof SLOTS)[number];
const SLOT_KEY = 'fm.slot';

/** What the start screen shows of a saved game. */
export interface SlotMeta {
  slot: SlotId;
  teamName: string;
  crest?: TeamCrest;
  teamId: string;
  season: number;
  /** Week of the player's next match (0 = pre-season, above `weeks` = season over). */
  week: number;
  weeks: number;
  division: number;
  position: number;
  difficulty: DifficultyId;
  /** When it was last saved (ms since 1970). */
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  // No version: open the base as it is (v1, or v2 if a test build upgraded it); a new base is created at v1.
  dbPromise ??= openDB(DB_NAME, undefined, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    },
    // Another tab wants a newer version: let it through instead of blocking it.
    blocking(_current, _next, event) {
      (event.target as IDBDatabase | null)?.close();
      dbPromise = null;
    },
  });
  return dbPromise;
}

function metaOf(state: GameState, slot: SlotId, savedAt: number): SlotMeta {
  const me = playerTeam(state);
  const division = divisionOf(state, me.id);
  return {
    slot,
    teamName: me.name,
    crest: me.crest,
    teamId: me.id,
    season: state.season,
    week: currentWeek(state),
    weeks: lastMatchday(state),
    division,
    position: standings(state, division).findIndex((r) => r.teamId === me.id) + 1,
    difficulty: state.difficulty ?? 'normal',
    savedAt,
  };
}

/** Slot the game in play autosaves into. */
export function currentSlot(): SlotId {
  try {
    const v = localStorage.getItem(SLOT_KEY);
    if (v && (SLOTS as readonly string[]).includes(v)) return v as SlotId;
  } catch {
    /* storage unavailable */
  }
  return AUTOSAVE;
}

export function setCurrentSlot(slot: SlotId) {
  try {
    localStorage.setItem(SLOT_KEY, slot);
  } catch {
    /* storage unavailable */
  }
}

export async function saveGame(state: GameState, slot: SlotId = currentSlot()): Promise<void> {
  const d = await db();
  await d.put(STORE, state, slot);
  try {
    await d.put(STORE, metaOf(state, slot, Date.now()), metaKey(slot));
  } catch {
    /* the summary is a convenience: never lose the save for it */
  }
}

export async function loadGame(slot: SlotId = currentSlot()): Promise<GameState | null> {
  try {
    // Older saves are upgraded in place (phase 2 → 3 adds the economy).
    return migrateGame(await (await db()).get(STORE, slot));
  } catch {
    return null;
  }
}

export async function deleteGame(slot: SlotId = currentSlot()): Promise<void> {
  const d = await db();
  await d.delete(STORE, slot);
  await d.delete(STORE, metaKey(slot));
}

/** Every slot with its summary (null = empty). Saves made before summaries existed get one now. */
export async function listSlots(): Promise<Record<SlotId, SlotMeta | null>> {
  const d = await db();
  const out = {} as Record<SlotId, SlotMeta | null>;
  for (const slot of SLOTS) {
    let meta = ((await d.get(STORE, metaKey(slot))) as SlotMeta | undefined) ?? null;
    if (!meta) {
      const state = await loadGame(slot);
      if (state) {
        try {
          meta = metaOf(state, slot, 0);
          await d.put(STORE, meta, metaKey(slot));
        } catch {
          meta = null;
        }
      }
    }
    out[slot] = meta;
  }
  return out;
}
