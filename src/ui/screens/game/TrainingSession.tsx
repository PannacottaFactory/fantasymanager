import { useEffect, useRef, useState } from 'react';
import type { AttributeKey } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import {
  jackpotChance,
  runSession,
  sessionPool,
  sessionState,
  sessionTargets,
  sessionsPerMatch,
  type SessionResult,
} from '../../../engine/progression/sessions.ts';
import { attributeText, categoryName } from '../../../engine/text/localize.ts';
import { Crest, Modal } from '../../components/common.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { effectsOn, useT } from '../../i18n/index.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';

interface Spin {
  /** Session number (a new show for each). */
  n: number;
  result: SessionResult;
  /** Creatures the first roulette runs over. */
  pool: { id: string; name: string; speciesId: string }[];
  /** Attributes of the drawn creature's program the second roulette runs over, with their values. */
  targets: { k: AttributeKey; v: number }[];
  /** Chance of a +2 (coach of that category). */
  chance: number;
}

type Phase = 'creature' | 'pause' | 'attr' | 'done';

/** Sessions the player can spend now (and somebody to train). */
export function sessionsReady(game: GameState): number {
  return sessionPool(game).length ? sessionState(game).available : 0;
}

/** Sessions in reserve as tokens (lit = available). */
function Tokens({ n, max }: { n: number; max: number }) {
  const { t } = useT();
  return (
    <span className="sess-tokens" title={t('sess.left', { n, max })}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
      <b>
        {n}/{max}
      </b>
    </span>
  );
}

/**
 * Training sessions: one button; a roulette runs over the squad and stops on a creature (which stays lit), then a second
 * one runs over the attributes of its program and stops on the one that goes up. The engine draws; the roulettes show.
 */
export function TrainingSession() {
  const { t, lang } = useT();
  const game = useGame((s) => s.game)!;
  const { act, openSheet } = useGame.getState();
  const team = playerTeam(game);
  const s = sessionState(game);
  const ready = sessionsReady(game);
  const per = sessionsPerMatch(game, team.id);
  const [spin, setSpin] = useState<Spin | null>(null);
  const [phase, setPhase] = useState<Phase>('done');
  const busy = !!spin && phase !== 'done';
  const nameOf = (id: string) => team.creatures.find((c) => c.id === id)?.name ?? '?';
  const max = DEFAULT_CONFIG.training.sessions.maxStored;

  const train = () => {
    const pool = sessionPool(game);
    const outcome = act((g) => runSession(g));
    if (outcome?.kind !== 'trained') return;
    const c = pool.find((x) => x.id === outcome.result.creatureId);
    setSpin({
      n: s.total,
      result: outcome.result,
      pool: pool.map((x) => ({ id: x.id, name: x.name, speciesId: x.speciesId })),
      targets: c ? sessionTargets(c, outcome.result.category).map((k) => ({ k, v: c.attributes[k] })) : [{ k: outcome.result.attr, v: outcome.result.from }],
      chance: jackpotChance(game, team.id, outcome.result.category),
    });
    setPhase(effectsOn() ? 'creature' : 'done');
  };

  return (
    <section className={`panel session ${ready > 0 && !busy ? 'ready' : ''}`} data-tip="session">
      <div className="sess-head">
        <span className="sess-emblem">
          <UiIcon name="nav-training" size="1.4em" />
        </span>
        <div className="sess-titles">
          <h2>{t('sess.title')}</h2>
          <span className="muted">{t('sess.how', { n: per, max })}</span>
        </div>
        <Tokens n={ready} max={max} />
      </div>

      <div className="session-stage">
        {spin && <Show key={spin.n} spin={spin} phase={phase} setPhase={setPhase} />}
        {!busy && (
          <button className="session-go" disabled={ready <= 0} onClick={train}>
            <UiIcon name="nav-training" size="1.3em" />
            <span>{ready > 0 ? t('sess.go') : t('sess.afterMatch')}</span>
          </button>
        )}
        {!spin && <span className="faint sess-coach">{t('sess.coach')}</span>}
      </div>

      {s.recent.length > 0 && !busy && (
        <div className="session-log">
          <span className="muted">{t('sess.recent')}</span>
          {[...s.recent].reverse().map((r, i) => (
            <button key={i} className={`session-log-chip ${r.d > 1 ? 'jackpot' : ''}`} onClick={() => openSheet(r.creatureId)}>
              <UiIcon name={`dom-${r.category}`} /> {nameOf(r.creatureId)} <b>+{r.d} {attributeText(r.attr, lang).name}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Index lit by a roulette that lands on `target` after `turns` full turns, each step slower than the previous. */
function useReel(len: number, target: number, active: boolean, onEnd: () => void, slowest: number, turns = 1) {
  const total = len * turns + target;
  const [step, setStep] = useState(0);
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  });
  useEffect(() => {
    if (!active) return;
    if (step >= total) {
      end.current();
      return;
    }
    const k = step / Math.max(1, total);
    const id = window.setTimeout(() => setStep((s) => s + 1), 60 + slowest * k * k * k);
    return () => window.clearTimeout(id);
  }, [step, active, total, slowest]);
  return active ? step % Math.max(1, len) : target;
}

function Show({ spin, phase, setPhase }: { spin: Spin; phase: Phase; setPhase: (p: Phase) => void }) {
  const { t, lang } = useT();
  const { result, pool, targets } = spin;
  const who = Math.max(0, pool.findIndex((p) => p.id === result.creatureId));
  const what = Math.max(0, targets.findIndex((x) => x.k === result.attr));
  const litCreature = useReel(pool.length, who, phase === 'creature', () => setPhase('pause'), 360);
  // Few attributes: several turns, so the suspense lasts (at least ~14 steps).
  const litAttr = useReel(targets.length, what, phase === 'attr', () => setPhase('done'), 560, Math.max(2, Math.ceil(14 / Math.max(1, targets.length))));
  const won = useRef<HTMLDivElement>(null);
  const picked = phase !== 'creature';
  const winner = pool[who];

  // A short breath on the drawn creature, then the attributes of its program.
  useEffect(() => {
    if (phase !== 'pause') return;
    const at = centreOf(document.querySelector('.reel-card.win'));
    if (at) fxLayer()?.sparkle(at.x, at.y, false);
    const id = window.setTimeout(() => setPhase('attr'), 650);
    return () => window.clearTimeout(id);
  }, [phase, setPhase]);
  useEffect(() => {
    if (phase !== 'done') return;
    const at = centreOf(won.current);
    const fx = fxLayer();
    if (fx && at) fx.sparkle(at.x, at.y, true);
    if (fx && result.d > 1) fx.confetti(1800);
  }, [phase, result.d]);

  return (
    <div className={`reel-show ${phase} ${result.d > 1 ? 'jackpot' : ''}`}>
      <div className={`reel-grid ${picked ? 'settled' : ''}`}>
        {pool.map((p, i) => (
          <span key={p.id} className={`reel-card ${!picked && i === litCreature ? 'lit' : ''} ${picked && i === who ? 'win' : ''}`}>
            <Crest speciesId={p.speciesId} name={p.name} size={24} />
            <span className="reel-name">{p.name}</span>
          </span>
        ))}
      </div>
      {(phase === 'attr' || phase === 'done') && (
        <div className={`reel-slot cat-${result.category}`}>
          <div className="reel-cat">
            <UiIcon name={`dom-${result.category}`} /> {categoryName(result.category, lang)}
            <span className="reel-odds">{t('sess.chance', { p: Math.round(spin.chance * 100) })}</span>
          </div>
          <div className="reel-attrs">
            {targets.map(({ k, v }, i) => {
              const win = phase === 'done' && k === result.attr;
              return (
                <span key={k} className={`reel-attr ${phase === 'attr' && i === litAttr ? 'lit' : ''} ${win ? 'win' : ''}`}>
                  <span className="ra-name">{attributeText(k, lang).name}</span>
                  <b className="ra-val">{win ? v + result.d : v}</b>
                  {win && <i className="ra-plus">+{result.d}</i>}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="reel-outcome" ref={won}>
        {phase === 'done' && winner && (
          <div className="sess-result">
            <button className="sr-crest" onClick={() => useGame.getState().openSheet(winner.id)} title={t('sess.openSheet')}>
              <Crest speciesId={winner.speciesId} name={winner.name} size={34} />
            </button>
            <div className="sr-text">
              <button className="sr-who link" onClick={() => useGame.getState().openSheet(winner.id)} title={t('sess.openSheet')}>
                {winner.name}
              </button>
              <span className="sr-gain">
                {attributeText(result.attr, lang).name} <b>{result.from}</b> → <b className="sr-to">{result.from + result.d}</b>
              </span>
            </div>
            {result.d > 1 ? <span className="sr-badge jackpot">{t('sess.jackpot')}</span> : <span className="sr-badge">+1</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Dashboard: sessions are waiting. */
export function SessionCard({ game }: { game: GameState }) {
  const { t } = useT();
  const ready = sessionsReady(game);
  if (ready <= 0) return null;
  return (
    <section className="panel dash-card dash-session">
      <div className="dash-card-head">
        <h3>
          <UiIcon name="nav-training" /> {t('sess.title')}
        </h3>
        <Tokens n={ready} max={DEFAULT_CONFIG.training.sessions.maxStored} />
      </div>
      <span className="muted">{t('sess.dash')}</span>
      <button className="btn primary small" onClick={() => useGame.getState().setScreen('training')}>
        {t('sess.go')}
      </button>
    </section>
  );
}

/** After every match: the training window (opened by `closeMatch` when sessions are waiting), before the week's summary. */
export function AfterMatchTraining() {
  const { t } = useT();
  const drill = useGame((s) => s.drill);
  const match = useGame((s) => s.match);
  const game = useGame((s) => s.game);
  if (!drill || match || !game) return null;
  const close = () => useGame.getState().closeDrill();
  const left = sessionsReady(game);
  return (
    <Modal
      title={t('drill.title')}
      onClose={close}
      className="drill-dialog"
      actions={
        <button className={`btn ${left > 0 ? 'ghost' : 'primary'}`} onClick={close} autoFocus={left <= 0}>
          {left > 0 ? t('drill.later') : t('drill.done')}
        </button>
      }
    >
      <p className="muted drill-intro">{t('drill.intro')}</p>
      <TrainingSession />
    </Modal>
  );
}
