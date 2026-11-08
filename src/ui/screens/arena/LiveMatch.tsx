import { useEffect, useMemo, useRef, useState } from 'react';
import { Combat } from '../../../engine/combat/combat.ts';
import { aiBreakDecision } from '../../../engine/combat/decisions.ts';
import type { BreakDecision, MatchEvent, MatchResult, MatchSetup } from '../../../engine/combat/types.ts';
import { applyEvent, initialView, type MatchView } from '../../../engine/combat/view.ts';
import { Commentator, type CommentaryLine } from '../../../engine/commentary/commentator.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { Bar, Seg } from '../../components/common.tsx';
import { BreakPanel } from './BreakPanel.tsx';
import { Scoreboard } from './Scoreboard.tsx';

type Speed = 'slow' | 'normal' | 'fast' | 'instant';
const DELAY: Record<Speed, number> = { slow: 1500, normal: 750, fast: 220, instant: 0 };
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

interface Props {
  setup: MatchSetup;
  playerControls: boolean;
  onFinish: (r: MatchResult) => void;
}

export function LiveMatch({ setup, playerControls, onFinish }: Props) {
  const session = useMemo<Session>(() => {
    const combat = new Combat(setup);
    combat.advance();
    return {
      combat,
      commentator: new Commentator(combat.seed, combat.getRoster(), [setup.teams[0].name, setup.teams[1].name]),
      queue: [...combat.events],
      cursor: combat.events.length,
      aiDecision: null,
    };
  }, [setup]);
  const roster = session.combat.getRoster();
  const [view, setView] = useState<MatchView>(() => initialView(roster));
  const viewRef = useRef(view);
  const [lines, setLines] = useState<CommentaryLine[]>([]);
  const [speed, setSpeedState] = useState<Speed>(loadSpeed);
  const [paused, setPaused] = useState(false);
  const [atBreak, setAtBreak] = useState(false);
  const [ended, setEnded] = useState(false);
  const [tick, setTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

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
      const ls = commentator.narrate(e);
      out.push(...ls);
      if (ls.length) shown++;
    }
    viewRef.current = v;
    setView(v);
    if (out.length) setLines((l) => [...l, ...out]);
  };

  useEffect(() => {
    if (paused || atBreak || ended) return;
    const t = setTimeout(
      () => {
        pump(speed === 'instant' ? Infinity : 1);
        setTick((x) => x + 1);
      },
      tick === 0 ? 300 : DELAY[speed],
    );
    return () => clearTimeout(t);
    // pump reads refs/session only; re-run on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, paused, atBreak, ended, speed]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    return mine.reduce((s, c) => s + c.hp, 0) / Math.max(1, mine.reduce((s, c) => s + c.maxHp, 0));
  };

  let lastRound = -1;
  return (
    <div className="live">
      <Scoreboard side={0} name={setup.teams[0].name} roster={roster} view={view} />
      <section className="panel">
        <div className="round-banner">
          <div className="big">
            {ended && outcome ? (outcome.winner === 0 ? 'Victory' : 'Defeat') : view.round === 0 ? 'Prepare' : `Round ${view.round}`}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {ended && outcome
              ? outcome.method === 'ko'
                ? `By knockout in round ${outcome.rounds}`
                : `On points ${outcome.score[0]}–${outcome.score[1]}`
              : `of ${DEFAULT_CONFIG.match.maxRounds} · breaks after rounds ${DEFAULT_CONFIG.match.breakRounds.join(', ')}`}
          </div>
          <div className="health-duel" style={{ margin: '8px 0' }}>
            <Bar value={health(0)} max={1} color="var(--home)" title="Your team’s remaining health" />
            <div style={{ transform: 'scaleX(-1)' }}>
              <Bar value={health(1)} max={1} color="var(--away)" title="Opponent’s remaining health" />
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <Seg
            value={speed}
            onChange={setSpeed}
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
              { value: 'instant', label: 'Instant' },
            ]}
          />
          <button className="btn small" onClick={() => setPaused((p) => !p)} disabled={ended}>
            {paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
          <span className="spacer" />
          {!ended && (
            <button className="btn small" onClick={skip} title="Your assistant handles the remaining breaks">
              Skip to result ⏭
            </button>
          )}
          {ended && (
            <button className="btn primary" onClick={() => onFinish(session.combat.result())}>
              Match report →
            </button>
          )}
        </div>
        <div className="feed" ref={feedRef} aria-live="polite">
          {lines.map((l, i) => {
            const sep = l.round !== lastRound && l.round > 0;
            lastRound = l.round;
            return (
              <div key={i}>
                {sep && <div className="round-sep">Round {l.round}</div>}
                <div className={`line i${l.importance} ${l.side === null ? '' : `s${l.side}`}`}>{l.text}</div>
              </div>
            );
          })}
        </div>
      </section>
      <Scoreboard side={1} name={setup.teams[1].name} roster={roster} view={view} />
      {atBreak && <BreakPanel combat={session.combat} onResume={resumeFromBreak} />}
    </div>
  );
}
