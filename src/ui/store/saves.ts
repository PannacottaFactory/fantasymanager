/**
 * Save games in IndexedDB (one autosave slot for now; slots & import/export come in phase 6).
 */
import { openDB, type IDBPDatabase } from 'idb';
import { migrateGame } from '../../engine/league/migrate.ts';
import type { GameState } from '../../engine/league/types.ts';

const DB_NAME = 'shadow-arenas';
const STORE = 'saves';
export const AUTOSAVE = 'auto';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

export async function saveGame(state: GameState, slot = AUTOSAVE): Promise<void> {
  await (await db()).put(STORE, state, slot);
}

export async function loadGame(slot = AUTOSAVE): Promise<GameState | null> {
  try {
    // Older saves are upgraded in place (phase 2 → 3 adds the economy).
    return migrateGame(await (await db()).get(STORE, slot));
  } catch {
    return null;
  }
}

export async function deleteGame(slot = AUTOSAVE): Promise<void> {
  await (await db()).delete(STORE, slot);
}
