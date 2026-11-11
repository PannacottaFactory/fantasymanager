import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import type { Screen } from '../store/gameStore.ts';
import { UiIcon } from '../icons/Icon.tsx';

interface Item {
  id: Screen;
  label: StringKey;
  needsGame?: boolean;
  badge?: number;
}

interface Group {
  label: StringKey;
  icon: string;
  items: Item[];
}

/** Icon of a screen in the navigation. */
const ICON: Partial<Record<Screen, string>> = {
  dashboard: 'nav-dashboard', inbox: 'nav-inbox', squad: 'nav-squad', tactics: 'nav-tactics', training: 'nav-training',
  league: 'nav-league', news: 'nav-news', recruit: 'nav-recruit', finances: 'nav-finances', staff: 'nav-staff',
  facilities: 'nav-facilities', encyclopedia: 'nav-encyclopedia', arena: 'nav-arena',
};

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
  // Not enough room for every name (window width, text size): inactive tabs keep only their icon.
  const [compact, setCompact] = useState(false);
  // An invisible copy of the tabs with every name gives the width they need (it follows the text size).
  const measure = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const m = measure.current;
    if (!el || !m) return;
    // + room for the unread badges, which the copy does not have.
    const check = () => setCompact(m.scrollWidth + 40 > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    ro.observe(m);
    return () => ro.disconnect();
  }, []);

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
    { id: 'dashboard', label: 'nav.dashboard', needsGame: true },
    { id: 'inbox', label: 'nav.inbox', needsGame: true },
    {
      label: 'nav.group.stable',
      icon: 'nav-stable',
      items: [
        { id: 'squad', label: 'nav.squad', needsGame: true },
        { id: 'tactics', label: 'nav.tactics', needsGame: true },
        { id: 'training', label: 'nav.training', needsGame: true },
      ],
    },
    {
      label: 'nav.group.competitions',
      icon: 'nav-competitions',
      items: [
        { id: 'league', label: 'nav.league', needsGame: true },
        { id: 'news', label: 'nav.news', needsGame: true },
      ],
    },
    { id: 'recruit', label: 'nav.scouting', needsGame: true },
    {
      label: 'nav.group.club',
      icon: 'nav-club',
      items: [
        { id: 'finances', label: 'nav.finances', needsGame: true },
        { id: 'staff', label: 'nav.staff', needsGame: true },
        { id: 'facilities', label: 'nav.facilities', needsGame: true },
      ],
    },
    {
      label: 'nav.group.tools',
      icon: 'nav-tools',
      items: [
        { id: 'encyclopedia', label: 'nav.encyclopedia' },
        { id: 'arena', label: 'nav.arena' },
      ],
    },
  ];

  const badge = (n?: number, gold = false) => (n ? <span className={`badge ${gold ? 'gold-badge' : ''}`}>{gold ? `+${n}` : n}</span> : null);
  const pick = (id: Screen) => {
    setOpen(null);
    onSelect(id);
  };

  return (
    <nav className={`nav ${compact ? 'compact' : ''}`} aria-label="Screens" ref={ref} data-tip="nav">
      <div className="nav-measure" ref={measure} aria-hidden="true">
        {entries.map((e) => (
          <span key={isGroup(e) ? e.label : e.id} className="nav-tab">
            <UiIcon name={isGroup(e) ? e.icon : (ICON[e.id] ?? '')} size="1.05em" />
            <span className="nav-label">{t(isGroup(e) ? (e.items.find((i) => i.id === screen)?.label ?? e.label) : e.label)}</span>
            {isGroup(e) && <i className="nav-chevron">▾</i>}
          </span>
        ))}
      </div>
      {entries.map((e) => {
        if (!isGroup(e)) {
          const disabled = e.needsGame && !hasGame;
          return (
            <button key={e.id} className={`nav-tab ${e.id === screen ? 'on' : ''}`} disabled={disabled} title={disabled ? t('nav.needsGame') : t(e.label)} onClick={() => pick(e.id)}>
              <UiIcon name={ICON[e.id] ?? ''} size="1.05em" />
              <span className="nav-label">{t(e.label)}</span>
              {badge(badges[e.id])}
            </button>
          );
        }
        const active = e.items.some((i) => i.id === screen);
        const current = e.items.find((i) => i.id === screen);
        const total = e.items.reduce((s, i) => s + (badges[i.id] ?? 0), 0);
        const gold = e.items.some((i) => i.id === 'squad' && badges.squad);
        return (
          <div key={e.label} className="nav-group">
            <button
              className={`nav-tab ${active ? 'on' : ''} ${open === e.label ? 'open' : ''}`}
              disabled={!hasGame && e.items.every((i) => i.needsGame)}
              aria-haspopup="menu"
              aria-expanded={open === e.label}
              title={current ? t(current.label) : t(e.label)}
              onClick={() => setOpen(open === e.label ? null : e.label)}
            >
              <UiIcon name={current ? (ICON[current.id] ?? e.icon) : e.icon} size="1.05em" />
              <span className="nav-label">{current ? t(current.label) : t(e.label)}</span>
              <i className="nav-chevron" aria-hidden="true">
                ▾
              </i>
              {badge(total, gold)}
            </button>
            {open === e.label && (
              <div className="nav-menu" role="menu">
                {e.items.map((i, k) => (
                  <button
                    key={i.id}
                    role="menuitem"
                    className={i.id === screen ? 'on' : ''}
                    disabled={i.needsGame && !hasGame}
                    onClick={() => pick(i.id)}
                    style={{ animationDelay: `${40 + k * 35}ms` }}
                  >
                    <span className="nm-icon">
                      <UiIcon name={ICON[i.id] ?? ''} size="1.2em" />
                    </span>
                    <span className="nm-text">
                      <b>{t(i.label)}</b>
                      <small>{t(`nav.hint.${i.id}` as StringKey)}</small>
                    </span>
                    {badge(badges[i.id], i.id === 'squad')}
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
