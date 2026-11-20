/**
 * Time spent playing the game in hand (ms): counted while a game is open, the tab visible and the start screen
 * closed. Reset to the save's `playTime` when a game is loaded or created; `saveGame` writes the total into the save.
 * Display only: the engine never reads it.
 */
let base = 0;
let since: number | null = null;
let active = false;

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function pause() {
  if (since !== null) base += Date.now() - since;
  since = null;
}

function resumeIfActive() {
  if (active && visible() && since === null) since = Date.now();
}

/** A game was loaded or created: its time so far. */
export function resetPlayClock(ms: number) {
  base = Math.max(0, ms);
  since = null;
  resumeIfActive();
}

/** Counting on (a game is open and the start screen closed) or off. */
export function setPlayClockActive(on: boolean) {
  if (on === active) return;
  active = on;
  if (on) resumeIfActive();
  else pause();
}

export function playTime(): number {
  return base + (since !== null ? Date.now() - since : 0);
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => (visible() ? resumeIfActive() : pause()));
