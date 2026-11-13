import { useEffect, useRef, useState } from 'react';
import { ABILITIES } from '../../../data/abilities.ts';
import { EFFECTS } from '../../../data/effects.ts';
import { SPECIES } from '../../../data/species.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import type { RosterEntry, Side } from '../../../engine/combat/types.ts';
import type { CombatantView, MatchView } from '../../../engine/combat/view.ts';
import { abilityText, effectText, speciesName } from '../../../engine/text/localize.ts';
import { AbilityCard, AbilityTip, KindIcon, abilityColor } from '../../components/AbilityCard.tsx';
import { Bar, Crest } from '../../components/common.tsx';
import { hpColor, moraleKey, moraleColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { reducedMotion, type CardFx, type FxBatch } from './matchFx.ts';
import { RoleLabel, SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { coverPoints, coverReduction } from '../../../engine/combat/formulas.ts';

const ORDER: Record<string, number> = { active: 0, ko: 1, fled: 1, withdrawn: 2, bench: 3 };
const byState = (a: CombatantView, b: CombatantView) => ORDER[a.state]! - ORDER[b.state]!;


/** Highlight requested by hovering a commentary line. */
export interface Focus {
  actor?: string;
  target?: string;
}

interface CardProps {
  /** Just came on as a substitute (slides in with a golden edge). */
  entering?: boolean;
  c: CombatantView;
  r: RosterEntry;
  side: Side;
  fx?: CardFx;
  acting: number | null;
  /** How far the actor moves: a charge lunges far, a self buff stays put. */
  lunge: FxBatch['lunge'];
  /** Ability just used by this creature (its chip pulses). */
  cast: { ability: string; nonce: number } | null;
  focus: 'actor' | 'target' | null;
  onSelect: (id: string) => void;
}

/** The creature's abilities as small gauges: cooldown refilling, too tired, favourite, just used. */
function SkillRow({ c, r, cast }: { c: CombatantView; r: RosterEntry; cast: CardProps['cast'] }) {
  const { t, lang } = useT();
  const els = SPECIES[r.speciesId]?.elements ?? [];
  const [tip, setTip] = useState<{ id: string; rect: DOMRect } | null>(null);
  const tipDef = tip ? ABILITIES[tip.id] : undefined;
  const tipCd = tip && tipDef ? Math.min(c.cooldowns[tip.id] ?? 0, tipDef.cooldown) : 0;
  return (
    <div className="skills" onMouseLeave={() => setTip(null)}>
      {tip && tipDef && (
        <AbilityTip anchor={tip.rect}>
          <AbilityCard id={tip.id} elements={els} favorite={c.favorites.includes(tip.id)} />
          <div className={`tip-status ${tipCd > 0 ? 'cd' : tipDef.staminaCost > c.stamina ? 'tired' : 'ready'}`}>
            {tipCd > 0
              ? t('ab.recharging', { name: abilityText(tip.id, lang).name, n: tipCd })
              : tipDef.staminaCost > c.stamina
                ? t('ab.tooTired', { name: abilityText(tip.id, lang).name, cost: tipDef.staminaCost })
                : t('ab.ready', { name: abilityText(tip.id, lang).name })}
            <span className="muted"> · ⚡ {c.stamina}/{c.maxStamina}</span>
          </div>
        </AbilityTip>
      )}
      {c.abilities.map((id) => {
        const def = ABILITIES[id];
        if (!def) return null;
        const cd = Math.min(c.cooldowns[id] ?? 0, def.cooldown);
        const tired = def.staminaCost > c.stamina;
        const name = abilityText(id, lang).name;
        const title = cd > 0 ? t('ab.recharging', { name, n: cd }) : tired ? t('ab.tooTired', { name, cost: def.staminaCost }) : t('ab.ready', { name });
        const used = cast?.ability === id;
        return (
          <span
            key={used ? `${id}-${cast.nonce}` : id}
            className={`skill ${cd > 0 ? 'cd' : ''} ${tired && cd === 0 ? 'tired' : ''} ${c.favorites.includes(id) ? 'fav' : ''} ${used ? 'used' : ''}`}
            style={{ ['--c' as string]: abilityColor(id, els), ['--cd' as string]: def.cooldown ? cd / def.cooldown : 0 }}
            aria-label={title}
            onMouseEnter={(e) => setTip({ id, rect: e.currentTarget.getBoundingClientRect() })}
          >
            <i className="glyph">
              <KindIcon kind={def.kind} />
            </i>
            <span className="label">{name}</span>
            {cd > 0 && <b className="cdn">{cd}</b>}
          </span>
        );
      })}
    </div>
  );
}

/** Status effects drawn on the card itself (passives that last the whole match are left out). */
const AURA: Record<string, string> = {
  burning: 'burn', poisoned: 'poison', bleeding: 'bleed', chilled: 'chill', frozen: 'frozen', stunned: 'stun',
  shielded: 'shield', fortified: 'stone', enraged: 'rage', frenzied: 'rage', terrified: 'fear', evasive: 'evasive',
  regenerating: 'regen', rallied: 'rally', hexed: 'curse', frailty: 'curse', blighted: 'curse', jinxed: 'curse', sapped: 'sapped',
};
function auras(c: CombatantView): string[] {
  if (c.state !== 'active') return [];
  const out = new Set<string>();
  for (const e of c.effects) if (AURA[e] && (EFFECTS[e]?.defaultDuration ?? 0) < 999) out.add(AURA[e]!);
  return [...out];
}

function FighterCard({ c, r, side, fx, acting, lunge, cast, focus, onSelect, entering }: CardProps) {
  const { t, lang } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const down = c.state === 'ko' || c.state === 'fled' || c.state === 'withdrawn';
  // Towards the centre of the screen: home cards are on the left.
  const dir = side === 0 ? 1 : -1;

  useEffect(() => {
    const el = ref.current;
    if (!el || acting === null || reducedMotion() || !el.animate || lunge === 'still') return;
    if (lunge === 'none') {
      // Staying put: the card swells a little (buff, guard, rest, rage).
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      return;
    }
    const d = lunge === 'big' ? 34 : 16;
    el.animate(
      lunge === 'big'
        ? [
            { transform: 'translateX(0)' },
            { transform: `translateX(${-6 * dir}px) scale(0.98)`, offset: 0.2 },
            { transform: `translateX(${d * dir}px) scale(1.04)`, offset: 0.45 },
            { transform: 'translateX(0)' },
          ]
        : [{ transform: 'translateX(0)' }, { transform: `translateX(${d * dir}px) scale(1.02)`, offset: 0.35 }, { transform: 'translateX(0)' }],
      { duration: lunge === 'big' ? 520 : 380, easing: 'ease-out' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting, dir]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !fx || reducedMotion() || !el.animate) return;
    if (fx.kind === 'hit' || fx.kind === 'crit' || fx.kind === 'ko') {
      const a = fx.kind === 'crit' || fx.kind === 'ko' ? 11 : 6;
      el.animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(${-a}px)` },
          { transform: `translateX(${a}px)` },
          { transform: `translateX(${-a / 2}px)` },
          { transform: 'translateX(0)' },
        ],
        { duration: fx.kind === 'hit' ? 280 : 420, easing: 'ease-in-out' },
      );
    } else if (fx.kind === 'revive') {
      el.animate(
        [
          { transform: 'translateY(6px) scale(0.96)', filter: 'grayscale(1) brightness(0.6)' },
          { transform: 'translateY(-4px) scale(1.04)', filter: 'grayscale(0) brightness(1.6)', offset: 0.55 },
          { transform: 'none', filter: 'none' },
        ],
        { duration: 900, easing: 'ease-out' },
      );
    } else if (fx.kind === 'miss') {
      el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-8 * dir}px)`, offset: 0.4 }, { transform: 'translateX(0)' }], {
        duration: 320,
        easing: 'ease-out',
      });
    }
  }, [fx, dir]);

  const cls = [
    'fighter',
    `line-${c.line}`,
    down ? 'down' : '',
    c.state === 'ko' ? 'is-ko' : '',
    c.state === 'bench' ? 'bench' : '',
    acting !== null ? 'acting' : '',
    focus === 'actor' ? 'focus-actor' : '',
    focus === 'target' ? 'focus-target' : '',
    entering ? 'sub-in' : '',
  ].join(' ');

  return (
    <div
      ref={ref}
      className={cls}
      data-cid={c.id}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(c.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(c.id))}
    >
      {fx && <span key={`flash${fx.nonce}`} className={`flash ${fx.kind}`} aria-hidden="true" />}
      {acting !== null && <span key={`glow${acting}`} className="flash act" aria-hidden="true" />}
      {fx?.text && (
        <span key={`num${fx.nonce}`} className={`float ${fx.kind}`} aria-hidden="true">
          {fx.text}
        </span>
      )}
      {fx?.kind === 'crit' && (
        <span key={`crit${fx.nonce}`} className="float crit-label" aria-hidden="true">
          {t('fx.crit')}
        </span>
      )}
      {auras(c).map((a) => (
        <span key={a} className={`aura aura-${a}`} aria-hidden="true" />
      ))}
      <Crest speciesId={r.speciesId} name={r.name} />
      <div style={{ minWidth: 0 }}>
        <div className="top">
          <span className="name" title={r.name}>
            {r.name}
          </span>
          <span className="tag">
            <RoleLabel role={r.role} short />
          </span>
          {c.state === 'ko' && <span className="tag bad">{t('tag.ko')}</span>}
          {c.state === 'fled' && <span className="tag bad">{t('tag.fled')}</span>}
          {c.state === 'withdrawn' && <span className="tag">{t('tag.off')}</span>}
          {c.state === 'bench' && <span className="tag">{t('tag.bench')}</span>}
          <span className="spacer" />
          <span className="faint" style={{ fontSize: '0.786rem' }}>
            <SpeciesIcon id={r.speciesId} /> {speciesName(r.speciesId, lang)}
          </span>
        </div>
        {c.state !== 'bench' && (
          // Morale and health first, the health bar last: on the side facing the commentary (mirrored for the opponent).
          <div className="bars">
            <span title={t('col.morale')} style={{ color: moraleColor(c.morale) }}>
              {t(moraleKey(c.morale))}
            </span>
            <span className="mono">
              {c.hp}/{c.maxHp}
            </span>
            <div className="vital">
              <Bar value={c.hp} max={c.maxHp} color={hpColor(c.hp / c.maxHp)} title={t('bar.health', { v: c.hp, max: c.maxHp })} ghost />
              <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" thin ghost title={t('bar.stamina', { v: c.stamina, max: c.maxStamina })} />
            </div>
          </div>
        )}
        {c.state === 'active' && <SkillRow c={c} r={r} cast={cast} />}
        {c.effects.length > 0 && c.state === 'active' && (
          <div className="fx">
            {c.effects.map((e) => (
              <span key={e} className={EFFECTS[e]?.beneficial ? 'good' : 'bad'} title={effectText(e, lang).description}>
                {effectText(e, lang).name}
                {c.stacks[e] ? ` ×${c.stacks[e]}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  side: Side;
  /** Knocked-out creatures taken to the bench at a break (display only, they stay KO). */
  retired: ReadonlySet<string>;
  name: string;
  roster: Record<string, RosterEntry>;
  view: MatchView;
  fx: FxBatch;
  focus: Focus | null;
  onSelect: (id: string) => void;
}

/** A substitute (or a creature taken off): one quiet line, still clickable. */
function BenchRow({ c, r, fx, onSelect }: { c: CombatantView; r: RosterEntry; fx?: CardFx; onSelect: (id: string) => void }) {
  const { t, lang } = useT();
  return (
    <div
      className={`bench-row ${c.state === 'withdrawn' ? 'withdrawn' : ''} ${c.state === 'ko' || c.state === 'fled' ? 'fallen' : ''}`}
      data-cid={c.id}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(c.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(c.id))}
    >
      {fx && <span key={`flash${fx.nonce}`} className={`flash ${fx.kind}`} aria-hidden="true" />}
      <Crest speciesId={r.speciesId} name={r.name} />
      <span className="name" title={r.name}>{r.name}</span>
      <span className="tag">
        <RoleLabel role={r.role} short />
      </span>
      {c.state === 'withdrawn' && <span className="tag">{t('tag.off')}</span>}
      {c.state === 'ko' && <span className="tag bad">{t('tag.ko')}</span>}
      {c.state === 'fled' && <span className="tag bad">{t('tag.fled')}</span>}
      <span className="spacer" />
      {c.state === 'withdrawn' || c.state === 'ko' || c.state === 'fled' ? (
        <span className="mono faint">{c.hp}/{c.maxHp}</span>
      ) : (
        <span className="faint species">
          <SpeciesIcon id={r.speciesId} /> {speciesName(r.speciesId, lang)}
        </span>
      )}
    </div>
  );
}

export function Scoreboard({ side, name, roster, view, fx, focus, onSelect, retired }: Props) {
  const { t } = useT();
  const mine = Object.values(view.creatures).filter((c) => c.side === side);
  // Creatures in play stay in their line, even knocked out (they fell there); the bench keeps its own quiet strip.
  const inPlay = mine.filter((c) => (c.state === 'active' || c.state === 'ko' || c.state === 'fled') && !retired.has(c.id));
  const front = inPlay.filter((c) => c.line === 'front').sort(byState);
  const back = inPlay.filter((c) => c.line === 'back').sort(byState);
  // Available substitutes first, then those taken off, then the fallen carried off at a break.
  const BENCH_ORDER: Record<string, number> = { bench: 0, withdrawn: 1, ko: 2, fled: 2 };
  const bench = mine
    .filter((c) => c.state === 'bench' || c.state === 'withdrawn' || retired.has(c.id))
    .sort((a, b) => (BENCH_ORDER[a.state] ?? 3) - (BENCH_ORDER[b.state] ?? 3));
  const standing = inPlay.filter((c) => c.state === 'active').length;
  const frontUp = front.filter((c) => c.state === 'active');
  const cover = coverReduction(coverPoints(frontUp.map((c) => ({ role: roster[c.id]?.role ?? '' })), DEFAULT_CONFIG), DEFAULT_CONFIG);
  // Red when thin, amber, then green when the wall is solid.
  const strength = cover / DEFAULT_CONFIG.combat.cover.max;
  const coverColor = `hsl(${Math.round(4 + strength * 112)} 62% 54%)`;
  const card = (c: CombatantView) => (
    <FighterCard
      key={c.id}
      c={c}
      r={roster[c.id]!}
      side={side}
      fx={fx.targets[c.id]}
      acting={fx.actor?.id === c.id ? fx.actor.nonce : null}
      lunge={fx.lunge}
      entering={fx.marks.some((m) => m.kind === 'swapIn' && m.id === c.id)}
      cast={fx.cast?.actor === c.id ? fx.cast : null}
      onSelect={onSelect}
      focus={focus?.actor === c.id ? 'actor' : focus?.target === c.id ? 'target' : null}
    />
  );
  const block = (kind: 'front' | 'back', list: CombatantView[]) => (
    <div className={`line-block ${kind}`}>
      <div className="line-head">
        <UiIcon name={kind === 'front' ? 'kind-melee' : 'kind-ranged'} />
        <span>{t(kind === 'front' ? 'live.front' : 'live.back')}</span>
        <span className="line-count">{list.filter((c) => c.state === 'active').length}</span>
      </div>
      {list.length ? list.map(card) : <div className="line-empty">{t('live.lineEmpty')}</div>}
    </div>
  );
  return (
    <section className={`panel fighters ${side === 0 ? 'side-home' : 'side-away mirror'}`} data-tip={side === 0 ? 'live-cards' : undefined}>
      <div className="panel-head" style={{ marginBottom: 6 }}>
        <h3 className={side === 0 ? 'home-text' : 'away-text'}>{name}</h3>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: '0.857rem' }}>
          {t('board.standing', { n: standing, u: view.subsUsed[side], m: DEFAULT_CONFIG.match.maxSubstitutions })}
        </span>
      </div>
      <div className="scoreboard">
        {block('front', front)}
        <div className={`rampart ${cover > 0 ? '' : 'broken'}`} title={t('live.coverTip')} style={{ ['--rc' as string]: coverColor }}>
          <span className="rampart-wall" aria-hidden="true">
            <i style={{ width: `${Math.round((cover / DEFAULT_CONFIG.combat.cover.max) * 100)}%` }} />
          </span>
          <span className="rampart-label">{cover > 0 ? t('live.cover', { n: Math.round(cover * 100) }) : t('live.noCover')}</span>
        </div>
        {block('back', back)}
        {bench.length > 0 && (
          <div className="bench-block">
            <div className="line-head">
              <span>{t('live.bench')}</span>
              <span className="line-count">{bench.filter((c) => c.state === 'bench').length}</span>
            </div>
            {bench.map((c) => (
              <BenchRow key={c.id} c={c} r={roster[c.id]!} fx={fx.targets[c.id]} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
