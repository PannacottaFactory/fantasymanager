import { useEffect, useState } from 'react';
import { ArenaScreen } from './screens/arena/ArenaScreen.tsx';

/** Screens planned for later phases are shown disabled so the final structure is visible. */
const SCREENS: { id: string; label: string; phase?: number }[] = [
  { id: 'arena', label: 'Training Arena' },
  { id: 'inbox', label: 'Inbox', phase: 2 },
  { id: 'squad', label: 'Squad', phase: 2 },
  { id: 'tactics', label: 'Tactics', phase: 2 },
  { id: 'league', label: 'League', phase: 2 },
  { id: 'scouting', label: 'Scouting', phase: 3 },
  { id: 'finances', label: 'Finances', phase: 3 },
  { id: 'training', label: 'Training', phase: 4 },
  { id: 'staff', label: 'Staff', phase: 4 },
  { id: 'facilities', label: 'Facilities', phase: 5 },
  { id: 'history', label: 'History', phase: 5 },
];

type Theme = 'dark' | 'parchment';
const THEME_KEY = 'ui.theme';

function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'parchment' ? 'parchment' : 'dark';
  } catch {
    return 'dark';
  }
}

export function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="var(--accent)" />
            <path d="M11 21 L21 11 M11 11 L21 21" stroke="var(--panel)" strokeWidth="3" />
          </svg>
          <div>
            <h1>Shadow Arenas</h1>
            <small>Arena league manager</small>
          </div>
        </div>
        <nav className="nav" aria-label="Screens">
          {SCREENS.map((s) => (
            <button key={s.id} className={s.id === 'arena' ? 'on' : ''} disabled={!!s.phase} title={s.phase ? `Coming in phase ${s.phase}` : undefined}>
              {s.label}
            </button>
          ))}
        </nav>
        <button className="btn small ghost" onClick={() => setTheme(theme === 'dark' ? 'parchment' : 'dark')} title="Switch theme">
          {theme === 'dark' ? '☀ Parchment' : '☾ Dark'}
        </button>
      </header>
      <main className="main">
        <ArenaScreen />
      </main>
    </div>
  );
}
