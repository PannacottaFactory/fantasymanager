/**
 * Toasts for the big moments of a week (level-ups, new abilities, signings, trophies, deaths…), worded like the
 * inbox, with particles in proportion to the moment. Only messages that arrive while playing are shown: the ones
 * already in a loaded save are not replayed. They go away by themselves after a while on screen (longer for the big
 * moments; the count pauses while the pointer is over them, a window is open or the tab is hidden), or when clicked
 * (opens the matter) or dismissed (✕, or « close all »).
 * Display only.
 */
import { useEffect, useRef, useState } from 'react';
import type { InboxMessage } from '../../engine/league/types.ts';
import { locate } from '../../engine/economy/market.ts';
import { Crest, Gold } from '../components/common.tsx';
import { effectsOn, useT } from '../i18n/index.ts';
import { useGame } from '../store/gameStore.ts';
import { wording } from '../screens/game/InboxScreen.tsx';
import { centreOf, fxLayer } from './FxLayer.tsx';
import { BadgeIcon, UiIcon } from '../icons/Icon.tsx';
import { Medal } from '../components/CreatureRecord.tsx';
import { play } from '../sound/sfx.ts';
import { TRAITS } from '../../data/traits.ts';

type Moment = 'small' | 'big' | 'huge' | 'sad';

/** Which inbox messages deserve a toast, and how loud. */
function momentOf(m: InboxMessage): Moment | null {
  switch (m.kind) {
    case 'levelUp':
    case 'abilityUnlocked':
    case 'medal':
    case 'arenaIntro':
    case 'gemNoticed':
    case 'boardMood':
    case 'fansMood':
      return 'small';
    case 'trait':
      // Only good news gets a toast: a quality earned or a flaw shaken off.
      return (TRAITS[m.traitId]?.polarity === 'positive' && m.gained) || (TRAITS[m.traitId]?.polarity === 'negative' && !m.gained) ? 'small' : null;
    case 'scoutReport':
      return m.target !== 'creature' || !m.verdict ? null : m.verdict === 'gem' ? 'big' : 'small';
    case 'bestiary':
      return m.rewards.length ? 'big' : m.owned.length ? 'small' : null;
    case 'transferIn':
    case 'ambition':
    case 'request':
    case 'newJob':
      return 'big';
    case 'jobOffer':
      // Out of a job, the offers are already in the job window.
      return m.reason === 'rescue' ? null : 'big';
    case 'requestOutcome':
      return 'small';
    case 'promoted':
    case 'cupWon':
      return 'huge';
    case 'seasonEnd':
      return m.position === 1 ? 'huge' : null;
    case 'boardVerdict':
      return m.met ? 'big' : null;
    case 'death':
      return 'sad';
    case 'relegated':
      return 'sad';
    default:
      return null;
  }
}

const ORDER: Record<Moment, number> = { huge: 0, sad: 1, big: 2, small: 3 };
/** Toasts shown at once; the others wait behind (counted on the « close all » button). */
const MAX_TOASTS = 4;
/** Toasts kept waiting at most, newest first (the older ones stay in the journal). */
const MAX_QUEUED = 12;
/** Time on screen (ms) before a toast goes away by itself: small news first, trophies and deaths stay longest. */
const LIFE: Record<Moment, number> = { small: 10_000, big: 15_000, huge: 22_000, sad: 22_000 };
const TICK = 500;

interface Toast {
  id: string;
  moment: Moment;
  message: InboxMessage;
}

function creatureOf(m: InboxMessage): string | undefined {
  if (m.kind === 'scoutReport') return m.target === 'creature' ? m.targetId : undefined;
  return 'creatureId' in m ? m.creatureId : undefined;
}

export function Celebrations() {
  const tr = useT();
  const game = useGame((s) => s.game);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const gameId = useRef<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const shown = useRef(new Map<string, number>());
  const hover = useRef(false);

  // The toasts on screen age while they can be read: not under the pointer, not behind a window, not in a hidden tab.
  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setInterval(() => {
      if (hover.current || document.hidden || document.querySelector('.overlay')) return;
      const expired = new Set<string>();
      for (const x of toasts.slice(0, MAX_TOASTS)) {
        const age = (shown.current.get(x.id) ?? 0) + TICK;
        shown.current.set(x.id, age);
        if (age >= LIFE[x.moment]) expired.add(x.id);
      }
      if (!expired.size) return;
      for (const k of expired) shown.current.delete(k);
      setToasts((old) => old.filter((t) => !expired.has(t.id)));
    }, TICK);
    return () => window.clearInterval(timer);
  }, [toasts]);

  useEffect(() => {
    if (!game) {
      seen.current = null;
      return;
    }
    // A new or loaded game: what is already in the inbox is history.
    if (!seen.current || gameId.current !== game.worldSeed) {
      seen.current = new Set(game.inbox.map((m) => m.id));
      gameId.current = game.worldSeed;
      return;
    }
    const fresh = game.inbox.filter((m) => !seen.current!.has(m.id));
    for (const m of fresh) seen.current.add(m.id);
    const picked = fresh
      .flatMap((m) => {
        const moment = momentOf(m);
        return moment ? [{ id: m.id, moment, message: m }] : [];
      })
      .sort((a, b) => ORDER[a.moment] - ORDER[b.moment]);
    if (!picked.length) return;
    setToasts((old) => [...picked, ...old].slice(0, MAX_QUEUED));
    const top = picked[0]!;
    play(
      top.moment === 'huge' ? 'fanfare'
      : top.moment === 'sad' ? 'sad'
      : top.message.kind === 'medal' ? 'medal'
      : top.message.kind === 'bestiary' ? 'discover'
      : top.message.kind === 'levelUp' || top.message.kind === 'abilityUnlocked' ? 'levelUp'
      : top.moment === 'big' ? 'medal' : 'discover',
    );
    // Particles once the toasts are on screen.
    window.setTimeout(() => {
      const fx = fxLayer();
      if (!fx) return;
      if (picked.some((p) => p.moment === 'huge')) {
        fx.fireworks(8);
        fx.confetti(2600);
      }
      for (const p of picked) {
        const at = centreOf(refs.current.get(p.id));
        if (!at) continue;
        if (p.moment === 'small' || p.moment === 'big') fx.sparkle(at.x - 120, at.y, p.moment === 'big');
      }
    }, 120);
  }, [game]);

  if (!game || !toasts.length) return null;
  const open = (m: InboxMessage) => {
    const id = creatureOf(m);
    if (m.kind === 'scoutReport' && m.verdict && id && locate(game, id)) useGame.getState().openReveal(m.id);
    else if (m.kind === 'request') useGame.getState().setScreen('inbox');
    else if (id && locate(game, id)) useGame.getState().openSheet(id);
    else useGame.getState().setScreen('inbox');
  };
  const dismiss = (id: string) => setToasts((old) => old.filter((t) => t.id !== id));
  return (
    <div className="toasts" aria-live="polite" onMouseEnter={() => (hover.current = true)} onMouseLeave={() => (hover.current = false)}>
      {toasts.slice(0, MAX_TOASTS).map((x) => {
        const w = wording(tr, x.message, game.cup.rounds);
        const cid = creatureOf(x.message);
        const c = cid ? locate(game, cid)?.creature : undefined;
        const species = c?.speciesId ?? (x.message.kind === 'death' ? x.message.speciesId : undefined);
        return (
          <div
            key={x.id}
            ref={(el) => {
              if (el) refs.current.set(x.id, el);
              else refs.current.delete(x.id);
            }}
            className={`toast toast-${x.moment} ${x.message.kind === 'transferIn' && effectsOn() ? 'flip' : ''}`}
            role="status"
            onClick={() => {
              open(x.message);
              dismiss(x.id);
            }}
          >
            <span className="toast-icon">
              {x.moment === 'sad' ? <UiIcon name="memorial" size="1.4em" /> : x.message.kind === 'medal' ? <Medal family={x.message.family} tier={x.message.tier} size="sm" /> : species ? <Crest speciesId={species} name={c?.name ?? ''} size={30} /> : x.message.kind === 'bestiary' ? <UiIcon name="bestiary" size="1.4em" /> : x.message.kind === 'boardMood' ? <BadgeIcon name="board" /> : x.message.kind === 'fansMood' ? <UiIcon name="fans" size="1.4em" /> : x.moment === 'huge' ? <UiIcon name="help-competitions" size="1.4em" /> : '✦'}
            </span>
            <span className="toast-text">
              <b>
                <Gold>{w.title}</Gold>
              </b>
              {x.moment !== 'small' && w.body && (
                <span className="muted">
                  <Gold>{w.body.split('\n')[0]!}</Gold>
                </span>
              )}
            </span>
            <button
              className="toast-close"
              aria-label={tr.t('toast.dismiss')}
              title={tr.t('toast.dismiss')}
              onClick={(e) => {
                e.stopPropagation();
                dismiss(x.id);
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
      {toasts.length > 1 && (
        <button className="toast-all" onClick={() => setToasts([])}>
          {tr.t('toast.closeAll', { n: toasts.length })}
        </button>
      )}
    </div>
  );
}
