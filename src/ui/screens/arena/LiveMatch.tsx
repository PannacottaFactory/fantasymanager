import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Combat } from '../../../engine/combat/combat.ts';
import { aiBreakDecision } from '../../../engine/combat/decisions.ts';
import type { BreakDecision, MatchEvent, MatchResult, MatchSetup, RosterEntry } from '../../../engine/combat/types.ts';
import { applyEvent, initialView, type MatchView } from '../../../engine/combat/view.ts';
import { Commentator, type CommentaryLine } from '../../../engine/commentary/commentator.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { SPECIES } from '../../../data/species.ts';
import { Bar, Seg } from '../../components/common.tsx';
import { hpColor } from '../../format.ts';
import { CreatureModal } from './CreatureModal.tsx';
import { useT } from '../../i18n/index.ts';
import { BreakPanel } from './BreakPanel.tsx';
import { addEventFx, emptyFx, reducedMotion, type FxBatch } from './matchFx.ts';
import { Projectiles } from './Projectiles.tsx';
import { Scoreboard, type Focus } from './Scoreboard.tsx';

type Speed = 'slow' | 'normal' | 'fast' | 'instant';
const DELAY: Record<Speed, number> = {
  slow: 1500,
  normal: 750,
  fast: 220,
  instant: 0,
};
/** Projectile flight time; the target reacts (and its health drops) when it lands. */
const FLIGHT: Record<Speed, number> = { slow: 560, normal: 420, fast: 180, instant: 0 };
const SPEED_KEY = 'arena.speed';

function loadSpeed(): Speed {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    if (v === 'slow' || v === 'normal' || v === 'fast' || v === 'instant') return v;
  } catch {
    /* storage unavailable */
  }
  return 'normal';
}

interface Session {
  combat: Combat;
  commentator: Commentator;
  queue: MatchEvent[];
  /** Index of the next combat event not yet queued for display. */
  cursor: number;
  /** Opponent's decision, computed on the same information as the player's. */
  aiDecision: BreakDecision | null;
}

/** Splits a commentary line so that creature names are coloured by side. */
function useNameHighlighter(roster: Record<string, RosterEntry>) {
  return useMemo(() => {
    const sideOf = new Map<string, number>();
    for (const r of Object.values(roster)) {
      if (!sideOf.has(r.name)) sideOf.set(r.name, r.side);
      const first = r.name.split(' ')[0]!;
      if (first.length >= 3 && !sideOf.has(first)) sideOf.set(first, r.side);
    }
    const names = [...sideOf.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!names.length) return (text: string): ReactNode => text;
    const re = new RegExp(`(?<!\\p{L})(${names.join('|')})(?!\\p{L})`, 'gu');
    return (text: string): ReactNode => {
      const parts = text.split(re);
      return parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className={sideOf.get(p) === 0 ? 'home-text name-ref' : 'away-text name-ref'}>
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      );
    };
  }, [roster]);
}

interface Props {
  setup: MatchSetup;
  playerControls: boolean;
  onFinish: (r: MatchResult) => void;
}

export function LiveMatch({ setup, playerControls, onFinish }: Props) {
  const tr = useT();
  const { t, lang } = tr;
  const session = useMemo<Session>(() => {
    const combat = new Combat(setup);
    combat.advance();
    return {
      combat,
      commentator: new Commentator(combat.seed, combat.getRoster(), [setup.teams[0].name, setup.teams[1].name], DEFAULT_CONFIG, lang),
      queue: [...combat.events],
      cursor: combat.events.length,
      aiDecision: null,
    };
    // The language can change mid-match: handled below without restarting the fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);
  session.commentator.lang = lang;
  const roster = session.combat.getRoster();
  const highlight = useNameHighlighter(roster);
  const [view, setView] = useState<MatchView>(() => initialView(roster));
  const viewRef = useRef(view);
  const [lines, setLines] = useState<CommentaryLine[]>([]);
  const [speed, setSpeedState] = useState<Speed>(loadSpeed);
  const [paused, setPaused] = useState(false);
  const [atBreak, setAtBreak] = useState(false);
  const [ended, setEnded] = useState(false);
  const [tick, setTick] = useState(0);
  const [fx, setFx] = useState<FxBatch>(emptyFx);
  const [focus, setFocus] = useState<Focus | null>(null);
  /** Creature whose sheet is open (the match pauses meanwhile). */
  const [selected, setSelected] = useState<{
    id: string;
    wasPaused: boolean;
  } | null>(null);
  const select = (id: string) => {
    setSelected({ id, wasPaused: paused });
    setPaused(true);
  };
  const closeSheet = () => {
    if (selected && !selected.wasPaused) setPaused(false);
    setSelected(null);
  };
  const feedRef = useRef<HTMLDivElement>(null);
  const landing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (landing.current) clearTimeout(landing.current);
    },
    [],
  );

  const setSpeed = (s: Speed) => {
    setSpeedState(s);
    try {
      localStorage.setItem(SPEED_KEY, s);
    } catch {
      /* ignore */
    }
  };

  /** Queues every combat event emitted since the last pull (including break decisions). */
  const pull = () => {
    const { combat } = session;
    session.queue.push(...combat.events.slice(session.cursor));
    session.cursor = combat.events.length;
  };

  /** Handles a break when the queue is drained. Returns true if play can continue immediately. */
  const handleBreak = (forceAi: boolean): boolean => {
    const { combat } = session;
    if (playerControls && !forceAi) {
      session.aiDecision = aiBreakDecision(combat, 1);
      setAtBreak(true);
      return false;
    }
    const d0 = aiBreakDecision(combat, 0);
    const d1 = aiBreakDecision(combat, 1);
    combat.applyBreakDecision(0, d0);
    combat.applyBreakDecision(1, d1);
    combat.resume();
    combat.advance();
    pull();
    return true;
  };

  /** Processes queued events; `budget` = number of commentary-producing events to show. */
  const pump = (budget: number, forceAi = false) => {
    const { combat, commentator, queue } = session;
    let v = viewRef.current;
    const out: CommentaryLine[] = [];
    const batch = emptyFx();
    let shown = 0;
    let stop = false;
    while (shown < budget && !stop) {
      if (!queue.length) {
        if (combat.phase === 'break') {
          if (!handleBreak(forceAi)) stop = true;
          continue;
        }
        if (combat.phase === 'ended') {
          setEnded(true);
          stop = true;
          continue;
        }
        combat.advance();
        pull();
        continue;
      }
      const e = queue.shift()!;
      v = applyEvent(v, e);
      if (budget !== Infinity) addEventFx(batch, e, t('fx.miss'), t('fx.ko'), (id) => SPECIES[roster[id]?.speciesId ?? '']?.elements ?? []);
      const ls = commentator.narrate(e);
      out.push(...ls);
      if (ls.length) shown++;
    }
    viewRef.current = v;
    if (landing.current) {
      clearTimeout(landing.current);
      landing.current = null;
    }
    const flight = budget === Infinity || reducedMotion() ? 0 : FLIGHT[speed];
    if (flight && batch.shots.length) {
      // Launch first; the hit lands (reaction, health bar) when the projectile arrives.
      setFx({ ...batch, targets: {} });
      landing.current = setTimeout(() => {
        landing.current = null;
        setView(viewRef.current);
        setFx({ ...batch, shots: [] });
      }, flight);
    } else {
      setView(v);
      setFx(batch);
    }
    if (out.length) setLines((l) => [...l, ...out]);
  };

  useEffect(() => {
    if (paused || atBreak || ended) return;
    const timer = setTimeout(
      () => {
        pump(speed === 'instant' ? Infinity : 1);
        setTick((x) => x + 1);
      },
      tick === 0 ? 300 : DELAY[speed],
    );
    return () => clearTimeout(timer);
    // pump reads refs/session only; re-run on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, paused, atBreak, ended, speed]);

  useEffect(() => {
    const el = feedRef.current;
    if (el && !focus) el.scrollTop = el.scrollHeight;
    // Only follow new lines, not hover changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const resumeFromBreak = (d: BreakDecision) => {
    const { combat } = session;
    combat.applyBreakDecision(0, d);
    combat.applyBreakDecision(1, session.aiDecision ?? aiBreakDecision(combat, 1));
    combat.resume();
    combat.advance();
    pull();
    setAtBreak(false);
    setTick((x) => x + 1);
  };

  const skip = () => {
    if (atBreak) {
      resumeFromBreak(aiBreakDecision(session.combat, 0));
    }
    pump(Infinity, true);
    setAtBreak(false);
  };

  const outcome = session.combat.outcome;
  const health = (side: 0 | 1) => {
    const mine = Object.values(view.creatures).filter((c) => c.side === side && c.state !== 'bench' && c.state !== 'withdrawn');
    return (
      mine.reduce((s, c) => s + c.hp, 0) /
      Math.max(
        1,
        mine.reduce((s, c) => s + c.maxHp, 0),
      )
    );
  };
  const m = DEFAULT_CONFIG.match;

  let lastRound = -1;
  return (
    <>
      <Projectiles shots={fx.shots} flight={FLIGHT[speed]} />
      <div className="live">
        <Scoreboard side={0} name={setup.teams[0].name} roster={roster} view={view} fx={fx} focus={focus} onSelect={select} />
        <section className="panel">
          <div className="round-banner">
            <div className="big">
              {ended && outcome
                ? outcome.winner === 0
                  ? t('live.victory')
                  : t('live.defeat')
                : view.round === 0
                  ? t('live.prepare')
                  : t('live.round', { n: view.round })}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {ended && outcome
                ? outcome.method === 'ko'
                  ? t('live.byKo', { n: outcome.rounds })
                  : t('live.onPoints', {
                      a: outcome.score[0],
                      b: outcome.score[1],
                    })
                : t('live.of', {
                    max: m.maxRounds,
                    list: m.breakRounds.join(', '),
                  })}
            </div>
            <div className="health-duel" style={{ margin: '8px 0' }}>
              <Bar value={health(0)} max={1} color="var(--home)" title={t('live.ourHealth')} ghost />
              <div style={{ transform: 'scaleX(-1)' }}>
                <Bar value={health(1)} max={1} color="var(--away)" title={t('live.theirHealth')} ghost />
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ marginBottom: 8 }}>
            <Seg
              value={speed}
              onChange={setSpeed}
              options={(['slow', 'normal', 'fast', 'instant'] as const).map((s) => ({ value: s, label: t(`speed.${s}`) }))}
            />
            <button className="btn small" onClick={() => setPaused((p) => !p)} disabled={ended}>
              {paused ? t('live.resume') : t('live.pause')}
            </button>
            <span className="spacer" />
            {!ended && (
              <button className="btn small" onClick={skip} title={t('live.skip.title')}>
                {t('live.skip')}
              </button>
            )}
            {ended && (
              <button className="btn primary" onClick={() => onFinish(session.combat.result())}>
                {t('live.report')}
              </button>
            )}
          </div>
          <div className="feed" ref={feedRef} aria-live="polite" onMouseLeave={() => setFocus(null)}>
            {lines.map((l, i) => {
              const sep = l.round !== lastRound && l.round > 0;
              lastRound = l.round;
              const hoverable = !!(l.actor || l.target);
              return (
                <div key={i}>
                  {sep && <div className="round-sep">{t('live.round', { n: l.round })}</div>}
                  <div
                    className={`line i${l.importance} ${l.side === null ? '' : `s${l.side}`} ${hoverable ? 'hoverable' : ''}`}
                    onMouseEnter={hoverable ? () => setFocus({ actor: l.actor, target: l.target }) : undefined}
                  >
                    {highlight(l.text)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <Scoreboard side={1} name={setup.teams[1].name} roster={roster} view={view} fx={fx} focus={focus} onSelect={select} />
        {atBreak && <BreakPanel combat={session.combat} onResume={resumeFromBreak} />}
        {selected && <LiveSheet id={selected.id} setup={setup} view={view} roster={roster} onClose={closeSheet} />}
      </div>
    </>
  );
}

/** Creature sheet opened from a fighter card, with its live match state on top. */
function LiveSheet({
  id,
  setup,
  view,
  roster,
  onClose,
}: {
  id: string;
  setup: MatchSetup;
  view: MatchView;
  roster: Record<string, RosterEntry>;
  onClose: () => void;
}) {
  const { t } = useT();
  const creature = setup.teams.flatMap((tm) => tm.creatures).find((c) => c.id === id);
  const c = view.creatures[id];
  if (!creature || !c) return null;
  return (
    <CreatureModal
      creature={creature}
      onClose={onClose}
      showHidden={false}
      favorites={roster[id]?.favorites ?? []}
      extra={
        <div className="live-sheet">
          <Bar value={c.hp} max={c.maxHp} color={hpColor(c.hp / c.maxHp)} title={t('bar.health', { v: c.hp, max: c.maxHp })} />
          <span className="mono">
            {c.hp}/{c.maxHp}
          </span>
          <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" title={t('bar.stamina', { v: c.stamina, max: c.maxStamina })} />
          <span className="mono">
            ⚡ {c.stamina}/{c.maxStamina}
          </span>
        </div>
      }
    />
  );
}
