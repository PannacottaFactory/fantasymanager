/**
 * A creature just joined the stable: its card turns over and every figure the player only knew as a range closes in
 * on the truth, attribute after attribute, then the rating and the potential, and a stamp says whether the stable got
 * lucky compared to what it expected. Display only: the creature is already signed.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ATTRIBUTE_CATEGORIES, type AttributeCategory } from '../../../data/attributes.ts';
import { locate } from '../../../engine/economy/market.ts';
import { attributeRange, overallRange, potentialLevelRange } from '../../../engine/economy/scouting.ts';
import type { Creature } from '../../../engine/model.ts';
import { attributeText, speciesName } from '../../../engine/text/localize.ts';
import { ElementDots, Modal } from '../../components/common.tsx';
import { centreOf, fxLayer } from '../../fx/FxLayer.tsx';
import { attrClass } from '../../format.ts';
import { effectsOn, useT } from '../../i18n/index.ts';
import { SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { matchUnderway, useGame } from '../../store/gameStore.ts';
import { colorOf, RangeBar, StarRange } from './ScoutReveal.tsx';

const FLIP_MS = 750;
/** Each attribute takes SETTLE_MS to close in, STAGGER_MS after the previous one. */
const SETTLE_MS = 1300;
const STAGGER_MS = 55;
const OVR_AT = 700;
const POT_AT = 1700;
const END_MS = POT_AT + SETTLE_MS + 200;
const CATS: AttributeCategory[] = ['physical', 'combat', 'mental'];

type Luck = 'lucky' | 'fair' | 'unlucky';

const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 2.2);

/** Milliseconds since the card turned (null before), END_MS straight away when effects are off. */
function useClock(key: string): { t: number; flipped: boolean } {
  const still = !effectsOn();
  const [t, setT] = useState<number | null>(still ? END_MS : null);
  useEffect(() => {
    if (still) return setT(END_MS);
    setT(null);
    let raf = 0;
    const flip = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const e = now - start;
        setT(Math.min(e, END_MS));
        if (e < END_MS) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, FLIP_MS);
    return () => {
      window.clearTimeout(flip);
      cancelAnimationFrame(raf);
    };
  }, [key, still]);
  return { t: t ?? 0, flipped: t !== null };
}

/** Once a figure is known exactly, its bar fills up to it. */
function Gauge({ v, max }: { v: number; max: number }) {
  return (
    <span className="reveal-bar gauge">
      <i style={{ left: 0, width: `${(v / max) * 100}%` }} />
    </span>
  );
}

/** Where the truth sat in the range the player knew: 0 = bottom, 1 = top. */
const placeIn = (v: number, r: { low: number; high: number }) => (r.high > r.low ? (v - r.low) / (r.high - r.low) : 0.5);

/** Better or worse than the middle of what the player expected (rating and potential). */
function luckOf(c: Creature, before: number): Luck {
  const ovr = placeIn(overallRange(c, 100).low, overallRange(c, before));
  const pot = placeIn(potentialLevelRange(c, 100).low, potentialLevelRange(c, before));
  const score = (ovr + pot) / 2;
  return score >= 0.6 ? 'lucky' : score <= 0.4 ? 'unlucky' : 'fair';
}

function Unveil({ id, before }: { id: string; before: number }) {
  const { t, lang } = useT();
  const game = useGame((s) => s.game)!;
  const more = useGame((s) => s.signings.length - 1);
  const { closeSigning, openSheet } = useGame.getState();
  const { t: ms, flipped } = useClock(id);
  const stampRef = useRef<HTMLDivElement>(null);
  const loc = locate(game, id);
  const c = loc?.creature;
  const luck = c ? luckOf(c, before) : 'fair';
  const done = ms >= END_MS;
  const k = (start: number) => Math.round(before + (100 - before) * ease((ms - start) / SETTLE_MS));

  useEffect(() => {
    if (!done || !effectsOn()) return;
    const at = centreOf(stampRef.current);
    const fx = fxLayer();
    if (!at || !fx) return;
    if (luck === 'lucky') {
      fx.sparkle(at.x, at.y, true);
      fx.confetti(1200);
    } else if (luck === 'fair') fx.sparkle(at.x, at.y, false);
  }, [done, luck]);

  if (!c) return null;
  const pot = potentialLevelRange(c, k(POT_AT));
  const potBefore = potentialLevelRange(c, before);
  const ovr = overallRange(c, k(OVR_AT));
  const ovrBefore = overallRange(c, before);
  let i = 0;

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 8 }}>
          <UiIcon name="nav-recruit" /> {t('signing.title')}
        </span>
      }
      onClose={closeSigning}
      className="reveal-dialog signing-dialog"
    >
      <div className={`reveal signing l-${luck} ${done ? 'done' : ''}`}>
        <div className={`reveal-card ${flipped ? 'flipped' : ''}`} style={{ '--c1': colorOf(c.speciesId, 0), '--c2': colorOf(c.speciesId, 1) } as CSSProperties}>
          <div className="reveal-inner">
            <div className="reveal-back">
              <SpeciesIcon id={c.speciesId} size="3.2em" />
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
              <span className="reveal-team">{t('signing.joined')}</span>
            </div>
          </div>
        </div>
        <div className="reveal-body">
          <div className="signing-head">
            <div className="reveal-line">
              <small>{t('scout.reveal.potential')}</small>
              <StarRange low={pot.low} high={pot.high} />
              <span className="faint signing-was">{t('signing.expected', { v: potBefore.low === potBefore.high ? `${potBefore.low}★` : `${potBefore.low}–${potBefore.high}★` })}</span>
            </div>
            <div className="reveal-line">
              <small>{t('scout.reveal.rating')}</small>
              <span className="reveal-ovr">
                {ovr.low === ovr.high ? <Gauge v={ovr.low} max={100} /> : <RangeBar low={ovr.low} high={ovr.high} max={100} />}
                <b>{ovr.low === ovr.high ? ovr.low : `${ovr.low}–${ovr.high}`}</b>
              </span>
              <span className="faint signing-was">{t('signing.expected', { v: `${ovrBefore.low}–${ovrBefore.high}` })}</span>
            </div>
          </div>
          <div className="signing-attrs">
            {CATS.map((cat) => (
              <div key={cat} className={`signing-cat sec-${cat}`}>
                <small>{t(`prog.${cat}`)}</small>
                {ATTRIBUTE_CATEGORIES[cat].map((key) => {
                  const r = attributeRange(c, key, k(i++ * STAGGER_MS));
                  const exact = r.low === r.high;
                  return (
                    <span key={key} className={`reveal-attr ${exact ? 'exact' : ''}`}>
                      <span className="ellipsis">{attributeText(key, lang).name}</span>
                      {exact ? <Gauge v={r.low} max={20} /> : <RangeBar low={r.low} high={r.high} max={20} />}
                      <b className={exact ? attrClass(r.low) : undefined}>{exact ? r.low : `${r.low}–${r.high}`}</b>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="reveal-foot">
            <div ref={stampRef} className={`reveal-verdict signing-verdict l-${luck}`}>
              {t(`signing.luck.${luck}`)}
            </div>
            {done && <span className="muted">{t(`signing.luckNote.${luck}`)}</span>}
          </div>
        </div>
      </div>
      <div className="row reveal-actions">
        <button
          className="btn primary"
          onClick={() => {
            closeSigning();
            openSheet(c.id);
          }}
        >
          {t('msg.openSheet')}
        </button>
        <span className="spacer" />
        <button className="btn ghost" onClick={closeSigning}>
          {more > 0 ? t('scout.reveal.next', { n: more }) : t('scout.reveal.close')}
        </button>
      </div>
    </Modal>
  );
}

/** Shows the first new signing waiting, over the creature sheet but after the match, training and weekly windows. */
export function SigningReveal() {
  const game = useGame((s) => s.game);
  const next = useGame((s) => s.signings[0]);
  const blocked = useGame((s) => matchUnderway(s) || s.drill || !!s.progress || !!s.recap);
  if (!game || blocked || !next) return null;
  if (!locate(game, next.id)) {
    queueMicrotask(() => useGame.getState().closeSigning());
    return null;
  }
  return <Unveil key={next.id} id={next.id} before={next.before} />;
}
