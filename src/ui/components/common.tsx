import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useScarEffects, useTraitEffects } from '../traitEffects.ts';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { SCARS } from '../../data/scars.ts';
import { TRAITS } from '../../data/traits.ts';
import type { ElementId } from '../../data/schema.ts';
import { elementName, injuryText, scarText, speciesName, traitText } from '../../engine/text/localize.ts';
import { attrClass, fatigueColor, initials } from '../format.ts';
import { effectsOn, useT } from '../i18n/index.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from '../icons/gameIcons.ts';
import { UiIcon } from '../icons/Icon.tsx';
import { levelOf, maxLevelOf, xpInLevel } from '../../engine/progression/levels.ts';
import { lifeStage } from '../../engine/progression/training.ts';
import { potentialLevelRange } from '../../engine/economy/scouting.ts';
import type { Creature } from '../../engine/model.ts';
import { newTraits } from '../../engine/progression/traitEvolution.ts';
import { useGame } from '../store/gameStore.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';

/** An attribute value coloured by tier; `cell` = a filled box (dense tables, manager-game style). */
export function Attr({ v, cell }: { v: number; cell?: boolean }) {
  return <span className={`attr ${attrClass(v)}${cell ? ' cell' : ''}`}>{v}</span>;
}

/** Estimated attribute: a range coloured by its middle. */
export function AttrRange({ r }: { r: { low: number; high: number } }) {
  if (r.low === r.high) return <Attr v={r.low} />;
  return <span className={`attr range ${attrClass((r.low + r.high) / 2)}`}>{r.low}–{r.high}</span>;
}

/** A rating out of 10 written « 8★ » (potential = the highest level reachable, coach quality…), coloured by tier. */
export function Stars({ n, max, title }: { n: number; max?: number; title?: string }) {
  const { t } = useT();
  const v = Math.max(1, Math.min(10, Math.round(n)));
  const hi = max === undefined ? v : Math.max(v, Math.min(10, Math.round(max)));
  // A range is coloured by its middle.
  const mid = (v + hi) / 2;
  const tier = mid >= 9 ? 'legend' : mid >= 7 ? 'high' : mid >= 4 ? 'mid' : 'low';
  const label = hi > v ? `${v}–${hi}` : `${v}`;
  return (
    <span className={`stars-n ${tier} ${hi > v ? 'range' : ''}`} title={title ?? t('stars.title', { n: label })} aria-label={t('stars.title', { n: label })}>
      {label}
      <i>★</i>
    </span>
  );
}

/** Potential of a creature as the player knows it: exact for its own, a range for the others. */
export function PotentialStars({ c, k }: { c: Creature; k: number }) {
  const { t } = useT();
  if (k >= 100) {
    const n = maxLevelOf(c);
    return <Stars n={n} title={t('stars.potential', { n })} />;
  }
  const r = potentialLevelRange(c, k);
  return <Stars n={r.low} max={r.high} title={t(r.high > r.low ? 'stars.potentialRange' : 'stars.potential', { n: r.low, m: r.high })} />;
}

/** Knowledge gauge (0–100). */
export function Knowledge({ k }: { k: number }) {
  return (
    <span className="knowledge" title={`${k} %`}>
      <i style={{ width: `${k}%` }} />
    </span>
  );
}

/**
 * Horizontal gauge. With `ghost`, a lighter layer trails behind when the value drops
 * (fighting-game style), so recent damage stays visible for a moment.
 */
/** `ticks`: discreet marks at 25 / 50 / 75 %. */
export function Bar({ value, max, color, thin, title, ghost, ticks }: { value: number; max: number; color: string; thin?: boolean; title?: string; ghost?: boolean; ticks?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;
  return (
    <div className={`bar${thin ? ' thin' : ''}${ticks ? ' ticks' : ''}`} title={title} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      {ghost && <i className="ghost" style={{ width: `${pct}%` }} />}
      <i className="fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * « Fatigue » of an own creature in one cell: injured → « Injury · n weeks »; otherwise a fatigue bar (as wide as
 * the injury label, so the column stays aligned): a small green sliver when rested, longer and amber → red as fatigue grows.
 * Exact fatigue in the tooltip.
 */
/** Width (%) of the fatigue bar of a rested creature, so the gauge is never invisible. */
const FATIGUE_SLIVER = 5;

export function ConditionCell({ c }: { c: Creature }) {
  const tr = useT();
  const { t, lang } = tr;
  const inj = c.condition.injuries.find((i) => i.weeksLeft > 0);
  if (inj)
    return (
      <span className="cond-cell">
        <span className="tag bad" title={injuryText(inj.injuryId, lang).short}>
          {t('status.injured', { weeks: tr.weeks(inj.weeksLeft) })}
        </span>
      </span>
    );
  const f = c.condition.fatigue;
  return (
    <span className="cond-cell" title={`${t('col.fatigue')} ${f} %`}>
      {/* Fatigue gauge: a small green sliver when rested, longer and amber → red as fatigue grows. */}
      <Bar value={Math.max(f, FATIGUE_SLIVER)} max={100} color={fatigueColor(f)} />
    </span>
  );
}

/** How many creatures the stable owns out of the most allowed, beside the Squad / Tactics titles. */
export function SquadCount({ n }: { n: number }) {
  const { t } = useT();
  const max = DEFAULT_CONFIG.economy.club.maxSquad;
  const level = n >= max ? 'full' : n >= max - 2 ? 'near' : 'ok';
  return (
    <span className={`squad-count ${level}`} title={t('squad.count.title')}>
      <span className="sc-num">
        <b>{n}</b>
        <span className="sc-max">/{max}</span>
      </span>
      <span className="sc-label">{t('squad.count')}</span>
    </span>
  );
}

/** Sort key of the condition: available, then more and more tired, then injured (longest last). */
export const conditionSort = (c: Creature) => {
  const inj = c.condition.injuries.find((i) => i.weeksLeft > 0);
  return inj ? 200 + inj.weeksLeft : c.condition.fatigue;
};

/** Metal of a creature's level frame (bronze 1–3, silver 4–6, gold 7–9, legend 10); iron when the level is not known. */
export type FrameMetal = 'iron' | 'bronze' | 'silver' | 'gold' | 'legend';
export const frameOfLevel = (level: number): Exclude<FrameMetal, 'iron'> => (level >= 10 ? 'legend' : level >= 7 ? 'gold' : level >= 4 ? 'silver' : 'bronze');
const METAL: Record<FrameMetal, [string, string]> = {
  iron: ['#8a8a92', '#3c3c43'],
  bronze: ['#c98f5a', '#6e4524'],
  silver: ['#c8d0d8', '#6a737c'],
  gold: ['#f0c64a', '#8a6410'],
  legend: ['#b48cf0', '#4b2d85'],
};

/** A hex colour mixed with white (share 0–1). */
function lighten(hex: string, share: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * share);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Creature emblem: its species icon, flat, in the colours of its elements (top to bottom), on a dark disc framed by
 * a metal ring that tells its level (bronze, silver, gold, legend) — iron when the level is not known (other stables,
 * the arena). Style guide: docs/style-guide.md § 6.
 */
export function Crest({ speciesId, name, size = 24, level }: { speciesId: string; name?: string; size?: number; level?: number }) {
  const { lang } = useT();
  const els = SPECIES[speciesId]?.elements ?? [];
  const c1 = els[0] ? ELEMENTS[els[0]].color : '#9a9aa2';
  const c2 = els[1] ? ELEMENTS[els[1]].color : c1;
  const sp = speciesName(speciesId, lang);
  const metal: FrameMetal = level === undefined ? 'iron' : frameOfLevel(level);
  const [m1, m2] = METAL[metal];
  const gid = `crest-${els.join('-') || 'none'}`;
  return (
    <svg className={`crest metal-${metal}`} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={name ? `${name} (${sp})` : sp}>
      <title>{name ? `${name} — ${sp}` : sp}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(c1, 0.15)} />
          <stop offset="1" stopColor={c2 === c1 ? c1 : c2} />
        </linearGradient>
        <radialGradient id="crest-disc" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#2a2420" />
          <stop offset="1" stopColor="#0d0b0a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11.2" fill={m2} />
      <circle cx="12" cy="12" r="10.4" fill={m1} />
      <circle cx="12" cy="12" r="9" fill="url(#crest-disc)" />
      {SPECIES_ICONS[speciesId] ? (
        <svg x="5" y="5" width="14" height="14" viewBox={ICON_VIEWBOX} className="crest-icon">
          <g fill={`url(#${gid})`} dangerouslySetInnerHTML={{ __html: SPECIES_ICONS[speciesId]!.replaceAll('fill="currentColor"', '') }} />
        </svg>
      ) : (
        <text x="12" y="15" textAnchor="middle" className="crest-text">
          {initials(name ?? sp)}
        </text>
      )}
    </svg>
  );
}

export function ElementDots({ speciesId }: { speciesId: string }) {
  const { lang } = useT();
  const els = SPECIES[speciesId]?.elements ?? [];
  return (
    <span className="elem-dots" title={els.map((e) => elementName(e, lang)).join(' / ')}>
      {els.map((e: ElementId) => (
        <i key={e} className="elem" style={{ background: ELEMENTS[e].color }} />
      ))}
    </span>
  );
}

/** A trait as a chip; hovering (or focusing) it opens a card with what it does exactly, numbers included. */
export function TraitChip({ id, fresh }: { id: string; /** Earned in a recent match: a « new » tag. */ fresh?: boolean }) {
  const { t, lang } = useT();
  const effects = useTraitEffects();
  const def = TRAITS[id];
  if (!def) return null;
  const txt = traitText(id, lang);
  const cls = def.polarity === 'positive' ? 'pos' : def.polarity === 'negative' ? 'neg' : 'mixed';
  return <HoverChip cls={cls} name={txt.name} kind={t(`trait.kind.${def.polarity}`)} desc={txt.description} lines={effects(id)} fresh={fresh} />;
}

/** A scar (permanent mark of a healed injury) as a chip, with the same hover card as traits. */
export function ScarChip({ id }: { id: string }) {
  const { t, lang } = useT();
  const effects = useScarEffects();
  if (!SCARS[id]) return null;
  const txt = scarText(id, lang);
  return <HoverChip cls="scar" icon="injury" name={txt.name} kind={t('scar.kind')} desc={txt.description} lines={effects(id)} />;
}

/** Chip + hover card (portal on <body>): name, kind, description, effect lines. */
function HoverChip({ cls, name, kind, desc, lines, fresh, icon }: { cls: string; name: string; kind: string; desc: string; lines: string[]; fresh?: boolean; icon?: string }) {
  const { t } = useT();
  const [at, setAt] = useState<DOMRect | null>(null);
  const show = (el: HTMLElement) => setAt(el.getBoundingClientRect());
  // Below the chip, or above it when it sits low on the screen; kept inside the viewport.
  const below = at ? at.bottom + 150 < window.innerHeight : true;
  const left = at ? Math.max(8, Math.min(at.left, window.innerWidth - 270)) : 0;
  return (
    <>
      <span
        className={`chip ${cls} trait-chip`}
        tabIndex={0}
        aria-label={`${name}: ${[desc, ...lines].join(' · ')}`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setAt(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setAt(null)}
      >
        {icon && <UiIcon name={icon} size="0.9em" />}
        {name}
        {fresh && (
          <span className="new-badge" title={t('trait.newTip')}>
            {t('trait.new')}
          </span>
        )}
      </span>
      {at &&
        createPortal(
          <div className={`trait-pop ${cls}`} role="tooltip" style={below ? { left, top: at.bottom + 6 } : { left, bottom: window.innerHeight - at.top + 6 }}>
            <div className="trait-pop-head">
              <b>{name}</b>
              <span className="trait-pop-kind">{kind}</span>
            </div>
            <div className="trait-pop-desc">{desc}</div>
            {lines.length > 0 && (
              <ul className="trait-pop-fx">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function TraitChips({ c }: { c: Creature }) {
  const game = useGame((s) => s.game);
  const fresh = game ? newTraits(c, game.season, game.matchday) : null;
  return (
    <>
      {c.traits.map((x) => (
        <TraitChip key={x} id={x} fresh={fresh?.has(x)} />
      ))}
      {(c.scars ?? []).map((x) => (
        <ScarChip key={x.id} id={x.id} />
      ))}
    </>
  );
}

/** `locked`: only the dialog's own buttons close it (no click outside, no Escape, no ✕) — for windows whose closing
 *  is an action, like the break panel. */
export function Modal({ title, onClose, children, actions, wide, className, locked }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean; className?: string; locked?: boolean }) {
  const { t } = useT();
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, locked]);
  return (
    <div className="overlay" onMouseDown={(e) => !locked && e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        <div className="dialog-head">
          <h2>{title}</h2>
          <span className="spacer" />
          {actions}
          {!locked && (
            <button className="btn small ghost" onClick={onClose} aria-label={t('common.close')}>
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="radio" aria-checked={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Level 1–10 with the XP bar of the current level and the creature's maximum level (own creatures). */
/** `bare`: the level as a plain number (tables whose column is already named « Level »). */
export function LevelBadge({ c, compact, bare }: { c: Creature; compact?: boolean; bare?: boolean }) {
  const { t } = useT();
  const lv = levelOf(c);
  const max = maxLevelOf(c);
  const xp = xpInLevel(c);
  const atMax = lv >= max;
  const per = DEFAULT_CONFIG.training.levels.xpPerLevel;
  return (
    <span className="level-badge" title={atMax ? t('lvl.atMax', { n: lv }) : t('lvl.tip', { n: lv, xp, per, max })}>
      <b>{bare ? lv : t('lvl.short', { n: lv })}</b>
      <span className="xp-bar">
        <i style={{ width: atMax ? '100%' : `${(100 * xp) / per}%` }} className={atMax ? 'max' : ''} />
      </span>
      {!compact && <span className="faint">{atMax ? t('lvl.max') : t('lvl.of', { max })}</span>}
    </span>
  );
}

/**
 * The XP track of an own creature (sheet): level → next level and the thin blue XP bar filling (how it works in the
 * tooltip).
 */
export function XpTrack({ c }: { c: Creature }) {
  const { t } = useT();
  const lv = levelOf(c);
  const per = DEFAULT_CONFIG.training.levels.xpPerLevel;
  const xp = xpInLevel(c);
  const next = lv < maxLevelOf(c);
  return (
    <div className="xp-track" title={next ? t('xp.how') : t('xp.done')}>
      <div className="xp-track-head">
        <b>{next ? t('xp.track', { n: lv, next: lv + 1 }) : t('xp.trackMax', { n: lv })}</b>
        <span className={`xp-big ${next ? '' : 'max'}`}>
          <i style={{ width: next ? `${(100 * xp) / per}%` : '100%' }} />
        </span>
        {next && <span className="xp-amount">{t('xp.amount', { xp, per })}</span>}
      </div>
    </div>
  );
}

const STAGE_KEY = { young: 'cr.developing', prime: 'cr.prime', declining: 'cr.declining' } as const;
const STAGE_SYMBOL = { young: '▲', prime: '◆', declining: '▼' } as const;

/** Life stage as one symbol (▲ developing, ◆ prime, ▼ veteran); the stage and its XP multiplier on hover. */
export function StageMark({ c }: { c: Creature }) {
  const { t, lang } = useT();
  const st = lifeStage(c);
  const m = DEFAULT_CONFIG.training.stage[st];
  const mult = lang === 'fr' ? String(m).replace('.', ',') : String(m);
  return (
    <span className={`stage-mark ${st}`} title={`${t(STAGE_KEY[st])} — ${st === 'declining' ? t('stage.decline', { m: mult }) : m > 0 ? t('stage.xp', { m: mult }) : t('stage.none')}`}>
      {STAGE_SYMBOL[st]}
    </span>
  );
}

/** Amounts as `money()` writes them: digits (thin-space or comma groups, optional "k"), a no-break space, po / gp. */
const MONEY_RE = /([−+-]?\d[\d\u202f,.]*(?:\u202fk)?\u00a0(?:po|gp))/;

/** Text with every amount of gold in gold colour (other children are rendered as they are). */
export function Gold({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>;
  const parts = children.split(MONEY_RE);
  if (parts.length === 1) return <>{children}</>;
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="gold">{p}</span> : p))}</>;
}

/** An amount of gold. */
export function Money({ v, compact }: { v: number; compact?: boolean }) {
  const { money } = useT();
  return <span className="gold">{money(v, compact)}</span>;
}

/** A number that rolls towards its new value (instantly when effects are off). */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value || !effectsOn()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** An amount of gold that rolls when it changes. */
export function RollingMoney({ v, compact }: { v: number; compact?: boolean }) {
  const { money } = useT();
  const shown = useCountUp(v, 900);
  return <span className="gold">{money(shown, compact)}</span>;
}
