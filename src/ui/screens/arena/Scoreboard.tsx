import { useEffect, useRef, useState } from 'react';
import { ABILITIES } from '../../../data/abilities.ts';
import { EFFECTS } from '../../../data/effects.ts';
import { SPECIES } from '../../../data/species.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import type { RosterEntry, Side } from '../../../engine/combat/types.ts';
import type { CombatantView, MatchView } from '../../../engine/combat/view.ts';
import { abilityText, effectText, roleText, speciesName } from '../../../engine/text/localize.ts';
import { AbilityCard, AbilityTip, KIND_GLYPH, abilityColor } from '../../components/AbilityCard.tsx';
import { Bar, Crest } from '../../components/common.tsx';
import { hpColor, moraleKey } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { reducedMotion, type CardFx, type FxBatch } from './matchFx.ts';

const ORDER: Record<string, number> = { active: 0, ko: 1, fled: 1, withdrawn: 2, bench: 3 };


/** Highlight requested by hovering a commentary line. */
export interface Focus {
  actor?: string;
  target?: string;
}

interface CardProps {
  c: CombatantView;
  r: RosterEntry;
  side: Side;
  fx?: CardFx;
  acting: number | null;
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
            <i className="glyph">{KIND_GLYPH[def.kind]}</i>
            <span className="label">{name}</span>
            {cd > 0 && <b className="cdn">{cd}</b>}
          </span>
        );
      })}
    </div>
  );
}

function FighterCard({ c, r, side, fx, acting, cast, focus, onSelect }: CardProps) {
  const { t, lang } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const down = c.state === 'ko' || c.state === 'fled' || c.state === 'withdrawn';
  // Towards the centre of the screen: home cards are on the left.
  const dir = side === 0 ? 1 : -1;

  useEffect(() => {
    const el = ref.current;
    if (!el || acting === null || reducedMotion() || !el.animate) return;
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${16 * dir}px) scale(1.02)`, offset: 0.35 }, { transform: 'translateX(0)' }],
      { duration: 380, easing: 'ease-out' },
    );
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
    } else if (fx.kind === 'miss') {
      el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-8 * dir}px)`, offset: 0.4 }, { transform: 'translateX(0)' }], {
        duration: 320,
        easing: 'ease-out',
      });
    }
  }, [fx, dir]);

  const cls = [
    'fighter',
    down ? 'down' : '',
    c.state === 'bench' ? 'bench' : '',
    acting !== null ? 'acting' : '',
    focus === 'actor' ? 'focus-actor' : '',
    focus === 'target' ? 'focus-target' : '',
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
      <Crest speciesId={r.speciesId} name={r.name} />
      <div style={{ minWidth: 0 }}>
        <div className="top">
          <span className="name" title={r.name}>
            {r.name}
          </span>
          <span className="tag" title={roleText(r.role, lang).name}>
            {roleText(r.role, lang).short}
          </span>
          {c.state === 'active' && <span className="tag">{c.line === 'front' ? t('tag.front') : t('tag.back')}</span>}
          {c.state === 'ko' && <span className="tag bad">{t('tag.ko')}</span>}
          {c.state === 'fled' && <span className="tag bad">{t('tag.fled')}</span>}
          {c.state === 'withdrawn' && <span className="tag">{t('tag.off')}</span>}
          {c.state === 'bench' && <span className="tag">{t('tag.bench')}</span>}
          <span className="spacer" />
          <span className="faint" style={{ fontSize: 11 }}>
            {speciesName(r.speciesId, lang)}
          </span>
        </div>
        {c.state !== 'bench' && (
          <div className="bars">
            <Bar value={c.hp} max={c.maxHp} color={hpColor(c.hp / c.maxHp)} title={t('bar.health', { v: c.hp, max: c.maxHp })} ghost />
            <span className="mono">
              {c.hp}/{c.maxHp}
            </span>
            <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" thin ghost title={t('bar.stamina', { v: c.stamina, max: c.maxStamina })} />
            <span title={t('col.morale')} style={{ color: c.morale < 30 ? 'var(--bad)' : c.morale >= 70 ? 'var(--good)' : undefined }}>
              {t(moraleKey(c.morale))}
            </span>
          </div>
        )}
        {c.state === 'active' && <SkillRow c={c} r={r} cast={cast} />}
        {c.effects.length > 0 && c.state === 'active' && (
          <div className="fx">
            {c.effects.map((e) => (
              <span key={e} className={EFFECTS[e]?.beneficial ? 'good' : 'bad'} title={effectText(e, lang).description}>
                {effectText(e, lang).name}
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
  name: string;
  roster: Record<string, RosterEntry>;
  view: MatchView;
  fx: FxBatch;
  focus: Focus | null;
  onSelect: (id: string) => void;
}

export function Scoreboard({ side, name, roster, view, fx, focus, onSelect }: Props) {
  const { t } = useT();
  const mine = Object.values(view.creatures)
    .filter((c) => c.side === side)
    .sort((a, b) => ORDER[a.state]! - ORDER[b.state]! || (a.line === b.line ? 0 : a.line === 'front' ? -1 : 1));
  const standing = mine.filter((c) => c.state === 'active').length;
  return (
    <section className={`panel ${side === 0 ? 'side-home' : 'side-away'}`}>
      <div className="panel-head" style={{ marginBottom: 6 }}>
        <h3 className={side === 0 ? 'home-text' : 'away-text'}>{name}</h3>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          {t('board.standing', { n: standing, u: view.subsUsed[side], m: DEFAULT_CONFIG.match.maxSubstitutions })}
        </span>
      </div>
      <div className="scoreboard">
        {mine.map((c) => (
          <FighterCard
            key={c.id}
            c={c}
            r={roster[c.id]!}
            side={side}
            fx={fx.targets[c.id]}
            acting={fx.actor?.id === c.id ? fx.actor.nonce : null}
            cast={fx.cast?.actor === c.id ? fx.cast : null}
            onSelect={onSelect}
            focus={focus?.actor === c.id ? 'actor' : focus?.target === c.id ? 'target' : null}
          />
        ))}
      </div>
    </section>
  );
}
