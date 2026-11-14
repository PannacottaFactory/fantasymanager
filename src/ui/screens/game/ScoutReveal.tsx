/**
 * The scout's report, staged: the card turns over, the potential range closes in star by star, the rating and the
 * strongest attributes sharpen, then the scout's word and the verdict land. Only what the player's knowledge allows
 * is ever shown (ranges from `knowledgeOf`), animated from the knowledge before the report to the knowledge after.
 * Display only.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { hashString } from '../../../core/rng.ts';
import { ATTRIBUTE_KEYS } from '../../../data/attributes.ts';
import { ELEMENTS } from '../../../data/elements.ts';
import { SPECIES } from '../../../data/species.ts';
import { locate } from '../../../engine/economy/market.ts';
import { attributeRange, knowledgeOf, overallRange, potentialLevelRange } from '../../../engine/economy/scouting.ts';
import type { InboxMessage, ScoutVerdict } from '../../../engine/league/types.ts';
import { attributeText, speciesName } from '../../../engine/text/localize.ts';
import { ElementDots, Modal } from '../../components/common.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { effectsOn, useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';

type Report = Extract<InboxMessage, { kind: 'scoutReport' }>;

const FLIP_MS = 750;
const NARROW_MS = 2600;
const LINES = 3;

function colorOf(speciesId: string, i: 0 | 1): string {
  const els = SPECIES[speciesId]?.elements ?? [];
  const e = els[i] ?? els[0];
  return e ? ELEMENTS[e].color : '#8a7a62';
}

/** Knowledge shown on screen: from `from` to `to`, eased, once the card has turned. */
function useKnowledgeTween(from: number, to: number, key: string): { k: number; flipped: boolean; done: boolean } {
  const still = !effectsOn();
  const [state, setState] = useState(() => (still ? { k: to, flipped: true, done: true } : { k: from, flipped: false, done: false }));
  useEffect(() => {
    if (still) {
      setState({ k: to, flipped: true, done: true });
      return;
    }
    setState({ k: from, flipped: false, done: false });
    let raf = 0;
    const flip = window.setTimeout(() => {
      setState((s) => ({ ...s, flipped: true }));
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / NARROW_MS);
        const eased = 1 - Math.pow(1 - p, 2.2);
        setState({ k: from + (to - from) * eased, flipped: true, done: p >= 1 });
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, FLIP_MS);
    return () => {
      window.clearTimeout(flip);
      cancelAnimationFrame(raf);
    };
  }, [from, to, key, still]);
  return state;
}

function StarRange({ low, high }: { low: number; high: number }) {
  return (
    <span className="reveal-stars" aria-label={`${low}–${high}★`}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        return (
          <i key={n} className={n >= low && n <= high ? 'in' : 'out'}>
            ★
          </i>
        );
      })}
      <b>{low === high ? `${low}★` : `${low}–${high}★`}</b>
    </span>
  );
}

function RangeBar({ low, high, max }: { low: number; high: number; max: number }) {
  return (
    <span className="reveal-bar">
      <i style={{ left: `${((low - 1) / (max - 1)) * 100}%`, width: `${Math.max(2.5, ((high - low) / (max - 1)) * 100)}%` }} />
    </span>
  );
}

function Reveal({ m }: { m: Report }) {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const { closeReveal, openSheet, reveals } = useGame.getState();
  const loc = locate(game, m.targetId);
  const after = knowledgeOf(game, m.targetId);
  const before = Math.min(after, m.before ?? after);
  const { k, flipped, done } = useKnowledgeTween(before, after, m.id);
  const stampRef = useRef<HTMLDivElement>(null);
  const verdict: ScoutVerdict = m.verdict ?? 'good';

  // The strongest points as the scout can tell them now (middle of each range at the report's knowledge).
  const best = useMemo(() => {
    if (!loc) return [];
    return ATTRIBUTE_KEYS.map((key) => {
      const r = attributeRange(loc.creature, key, after);
      return { key, mid: (r.low + r.high) / 2 };
    })
      .sort((a, b) => b.mid - a.mid || a.key.localeCompare(b.key))
      .slice(0, 5)
      .map((x) => x.key);
  }, [loc, after]);

  // The verdict lands with a little burst.
  useEffect(() => {
    if (!done || !effectsOn()) return;
    const at = centreOf(stampRef.current);
    const fx = fxLayer();
    if (!at || !fx) return;
    if (verdict === 'gem') {
      fx.sparkle(at.x, at.y, true);
      fx.confetti(1400);
    } else if (verdict !== 'below') fx.sparkle(at.x, at.y, verdict === 'star');
  }, [done, verdict]);

  if (!loc) return null;
  const c = loc.creature;
  const pot = potentialLevelRange(c, Math.round(k));
  const ovr = overallRange(c, Math.round(k));
  const line = hashString(m.id) % LINES;
  const firstAttr = best[0] ? attributeText(best[0], lang).name.toLocaleLowerCase(lang) : '';
  const quote = t(`scout.line.${verdict}.${line}` as StringKey, { name: c.name, attr: firstAttr });
  const gem = game.scouting.gems?.find((g) => g.creatureId === c.id);
  const more = reveals.length - 1;
  const close = () => closeReveal();

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 8 }}>
          <UiIcon name="scout" /> {t('scout.reveal.title')}
        </span>
      }
      onClose={close}
      className="reveal-dialog"
    >
      <div className={`reveal v-${verdict} ${done ? 'done' : ''}`}>
        <div className={`reveal-card ${flipped ? 'flipped' : ''}`} style={{ '--c1': colorOf(c.speciesId, 0), '--c2': colorOf(c.speciesId, 1) } as CSSProperties}>
          <div className="reveal-inner">
            <div className="reveal-back">
              <UiIcon name="scout" size="3.2em" />
              <span>?</span>
            </div>
            <div className="reveal-face">
              <span className="reveal-medal">
                <SpeciesIcon id={c.speciesId} size="2.6em" />
              </span>
              <b className="reveal-name">{c.name}</b>
              <span className="reveal-species">
                {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} />
              </span>
              <span className="muted">{t('sheet.age', { age: c.age })}</span>
              <span className="reveal-team">{loc.team ? loc.team.name : t('scout.reveal.freeAgent')}</span>
            </div>
          </div>
        </div>
        <div className="reveal-body">
          <div className="reveal-line">
            <small>{t('scout.reveal.potential')}</small>
            <StarRange low={pot.low} high={pot.high} />
          </div>
          <div className="reveal-line">
            <small>{t('scout.reveal.rating')}</small>
            <span className="reveal-ovr">
              <RangeBar low={ovr.low} high={ovr.high} max={100} />
              <b>{ovr.low === ovr.high ? ovr.low : `${ovr.low}–${ovr.high}`}</b>
            </span>
          </div>
          <div className="reveal-attrs">
            <small>{t('scout.reveal.best')}</small>
            {best.map((key) => {
              const r = attributeRange(c, key, Math.round(k));
              return (
                <span key={key} className="reveal-attr">
                  <span className="ellipsis">{attributeText(key, lang).name}</span>
                  <RangeBar low={r.low} high={r.high} max={20} />
                  <b>{r.low === r.high ? r.low : `${r.low}–${r.high}`}</b>
                </span>
              );
            })}
          </div>
          <div className="reveal-known faint">{t('scout.reveal.known', { from: before, to: Math.round(k) })}</div>
          <blockquote className="reveal-quote">
            « {quote} »<cite>— {t('scout.reveal.signed')}</cite>
          </blockquote>
          <div className="reveal-foot">
            <div ref={stampRef} className={`reveal-verdict v-${verdict}`}>
              {t(`scout.verdict.${verdict}`)}
            </div>
            {gem?.phase === 'quiet' && <span className="reveal-window">{t('scout.reveal.window', { weeks: tr.weeks(gem.weeksLeft) })}</span>}
            {c.hype && <span className="reveal-window hot">{t('scout.reveal.hyped')}</span>}
          </div>
        </div>
      </div>
      <div className="row reveal-actions">
        <button
          className="btn primary"
          onClick={() => {
            close();
            openSheet(c.id);
          }}
        >
          {loc.team?.id === game.playerTeamId ? t('msg.openSheet') : loc.team ? t('act.offer') : t('act.sign')}
        </button>
        <span className="spacer" />
        <button className="btn ghost" onClick={close}>
          {more > 0 ? t('scout.reveal.next', { n: more }) : t('scout.reveal.close')}
        </button>
      </div>
    </Modal>
  );
}

/** Shows the first scout report waiting, once no match, training window or weekly summary is open. */
export function ScoutReveal() {
  const game = useGame((s) => s.game);
  const reveals = useGame((s) => s.reveals);
  const blocked = useGame((s) => !!s.match || s.drill || !!s.recap || !!s.sheet);
  if (!game || blocked || !reveals.length) return null;
  const m = game.inbox.find((x): x is Report => x.id === reveals[0] && x.kind === 'scoutReport');
  if (!m || !locate(game, m.targetId)) {
    // Gone (or not a report): skip it.
    queueMicrotask(() => useGame.getState().closeReveal());
    return null;
  }
  return <Reveal key={m.id} m={m} />;
}
