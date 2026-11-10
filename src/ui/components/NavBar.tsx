import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import type { Screen } from '../store/gameStore.ts';

interface Item {
  id: Screen;
  label: StringKey;
  needsGame?: boolean;
  badge?: number;
}

interface Group {
  label: StringKey;
  items: Item[];
}

type Entry = Item | Group;
const isGroup = (e: Entry): e is Group => 'items' in e;

interface Props {
  screen: Screen | null;
  hasGame: boolean;
  badges: Partial<Record<Screen, number>>;
  onSelect: (s: Screen) => void;
}

/** Top navigation: single screens and drop-down groups (stable, competitions, club). */
export function NavBar({ screen, hasGame, badges, onSelect }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const entries: Entry[] = [
    { id: 'inbox', label: 'nav.inbox', needsGame: true },
    {
      label: 'nav.group.stable',
      items: [
        { id: 'squad', label: 'nav.squad', needsGame: true },
        { id: 'tactics', label: 'nav.tactics', needsGame: true },
        { id: 'training', label: 'nav.training', needsGame: true },
      ],
    },
    {
      label: 'nav.group.competitions',
      items: [
        { id: 'league', label: 'nav.league', needsGame: true },
        { id: 'news', label: 'nav.news', needsGame: true },
      ],
    },
    { id: 'recruit', label: 'nav.scouting', needsGame: true },
    {
      label: 'nav.group.club',
      items: [
        { id: 'finances', label: 'nav.finances', needsGame: true },
        { id: 'staff', label: 'nav.staff', needsGame: true },
        { id: 'facilities', label: 'nav.facilities', needsGame: true },
      ],
    },
    { id: 'encyclopedia', label: 'nav.encyclopedia' },
    { id: 'arena', label: 'nav.arena' },
  ];

  const badge = (n?: number) => (n ? <span className="badge">{n}</span> : null);
  const pick = (id: Screen) => {
    setOpen(null);
    onSelect(id);
  };

  return (
    <nav className="nav" aria-label="Screens" ref={ref} data-tip="nav">
      {entries.map((e) => {
        if (!isGroup(e)) {
          const disabled = e.needsGame && !hasGame;
          return (
            <button key={e.id} className={e.id === screen ? 'on' : ''} disabled={disabled} title={disabled ? t('nav.needsGame') : undefined} onClick={() => pick(e.id)}>
              {t(e.label)}
              {badge(badges[e.id])}
            </button>
          );
        }
        const active = e.items.some((i) => i.id === screen);
        const current = e.items.find((i) => i.id === screen);
        const total = e.items.reduce((s, i) => s + (badges[i.id] ?? 0), 0);
        return (
          <div key={e.label} className="nav-group">
            <button
              className={active ? 'on' : ''}
              disabled={!hasGame}
              aria-haspopup="menu"
              aria-expanded={open === e.label}
              onClick={() => setOpen(open === e.label ? null : e.label)}
            >
              {current ? t(current.label) : t(e.label)} ▾{badge(total)}
            </button>
            {open === e.label && (
              <div className="nav-menu" role="menu">
                {e.items.map((i) => (
                  <button key={i.id} role="menuitem" className={i.id === screen ? 'on' : ''} onClick={() => pick(i.id)}>
                    {t(i.label)}
                    {badge(badges[i.id])}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
