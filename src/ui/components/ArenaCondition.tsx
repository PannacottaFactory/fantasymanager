/**
 * Arena conditions in the UI: name, icon and what each one changes, worded from the config (pre-match banner,
 * Encyclopedia). Display only.
 */
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import type { ArenaConditionId } from '../../data/config/arena.ts';
import type { ElementId } from '../../data/schema.ts';
import { ELEMENTS } from '../../data/elements.ts';
import { elementName } from '../../engine/text/localize.ts';
import type { Translator } from '../i18n/index.ts';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { UiIcon } from '../icons/Icon.tsx';

/** What a condition changes, one line per rule. */
export function arenaLines(tr: Translator, id: ArenaConditionId): { text: string; good: boolean; color?: string }[] {
  const c = DEFAULT_CONFIG.arena.conditions[id];
  const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
  const out: { text: string; good: boolean; color?: string }[] = [];
  for (const [el, m] of Object.entries(c.elements ?? {}) as [ElementId, number][]) {
    out.push({ text: tr.t('arena.fx.element', { el: elementName(el, tr.lang), v: pct(m - 1) }), good: m > 1, color: ELEMENTS[el].color });
  }
  for (const [kind, m] of Object.entries(c.kinds ?? {}) as ['melee' | 'ranged' | 'spell', number][]) {
    out.push({ text: tr.t('arena.fx.kind', { kind: tr.t(`arena.kind.${kind}` as StringKey), v: pct(m - 1) }), good: m > 1 });
  }
  if (c.rangedHit) out.push({ text: tr.t('arena.fx.ranged', { v: pct(c.rangedHit) }), good: c.rangedHit > 0 });
  if (c.meleeHit) out.push({ text: tr.t('arena.fx.melee', { v: pct(c.meleeHit) }), good: c.meleeHit > 0 });
  if (c.staminaCost) out.push({ text: tr.t('arena.fx.stamina', { v: pct(c.staminaCost - 1) }), good: c.staminaCost < 1 });
  if (c.staminaRegen) out.push({ text: tr.t('arena.fx.regen', { v: pct(c.staminaRegen - 1) }), good: c.staminaRegen > 1 });
  if (c.healing) out.push({ text: tr.t('arena.fx.healing', { v: pct(c.healing - 1) }), good: c.healing > 1 });
  if (c.dot) out.push({ text: tr.t('arena.fx.dot', { v: pct(c.dot - 1) }), good: c.dot < 1 });
  if (c.critBonus) out.push({ text: tr.t('arena.fx.crit', { v: pct(c.critBonus) }), good: c.critBonus > 0 });
  if (c.moralePerRound) out.push({ text: tr.t('arena.fx.morale', { v: `${c.moralePerRound > 0 ? '+' : '−'}${Math.abs(c.moralePerRound)}` }), good: c.moralePerRound > 0 });
  return out;
}

export function arenaName(tr: Translator, id: ArenaConditionId | undefined): string {
  return tr.t(`arena.cond.${id ?? 'clear'}` as StringKey);
}

/** Icon + name + rules of a condition (or « clear day »). */
export function ArenaConditionCard({ id, compact }: { id: ArenaConditionId | undefined; compact?: boolean }) {
  const tr = useT();
  const lines = id ? arenaLines(tr, id) : [];
  return (
    <div className={`arena-cond ${id ? `ac-${id}` : 'ac-clear'} ${compact ? 'compact' : ''}`}>
      <span className="ac-icon">
        <UiIcon name={`arena-${id ?? 'clear'}`} size="1.6em" />
      </span>
      <span className="ac-text">
        <b>{arenaName(tr, id)}</b>
        {lines.length > 0 ? (
          <span className="ac-lines">
            {lines.map((l, i) => (
              <span key={i} className={l.good ? 'good-text' : 'bad-text'} style={l.color ? { borderColor: l.color } : undefined}>
                {l.text}
              </span>
            ))}
          </span>
        ) : (
          <small className="muted">{tr.t('arena.clear.desc')}</small>
        )}
      </span>
    </div>
  );
}

/** Every condition, with what it changes (Encyclopedia). */
export function ArenaConditionList() {
  return (
    <div className="arena-cond-list">
      {(Object.keys(DEFAULT_CONFIG.arena.conditions) as ArenaConditionId[]).map((id) => (
        <ArenaConditionCard key={id} id={id} />
      ))}
    </div>
  );
}
