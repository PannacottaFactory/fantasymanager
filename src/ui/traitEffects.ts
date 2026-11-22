/**
 * What a trait does, line by line, with the numbers the engine uses (data + config): shared by the Encyclopedia and
 * the trait chips' hover card. Only effects the engine actually applies are listed.
 */
import type { AttributeKey } from '../data/attributes.ts';
import { DEFAULT_CONFIG } from '../data/config/index.ts';
import { EFFECTS } from '../data/effects.ts';
import type { TraitCombatEffects } from '../data/schema.ts';
import { TRAITS } from '../data/traits.ts';
import { attributeText } from '../engine/text/localize.ts';
import { encT, type EncKey } from './i18n/encyclopedia.ts';
import { useT } from './i18n/index.ts';

export function useTraitEffects(): (id: string) => string[] {
  const { lang, dec } = useT();
  const e = encT(lang);
  const pct = (v: number) => {
    const n = Math.round(v * 1000) / 10;
    return Number.isInteger(n) ? String(Math.abs(n)) : dec(Math.abs(n), 1);
  };
  const mult = (v: number) => (Number.isInteger(v) ? String(v) : dec(v, 2).replace(/0$/, ''));
  const rage = () => {
    const m = EFFECTS['enraged']?.mods ?? {};
    return e('trc.rage', {
      d: mult(m.damageMult ?? 1),
      a: `${(m.mitigation ?? 0) < 0 ? '−' : '+'}${pct(m.mitigation ?? 0)}`,
      c: pct(m.critBonus ?? 0),
      n: DEFAULT_CONFIG.combat.rage.duration,
    });
  };
  return (id) => {
    const tdef = TRAITS[id];
    if (!tdef) return [];
    const c: TraitCombatEffects = tdef.combat ?? {};
    const lines: string[] = [];
    for (const [k, v] of Object.entries(c.attrMods ?? {})) lines.push(e('trc.attr', { attr: attributeText(k as AttributeKey, lang).name, v: `${v! > 0 ? '+' : '−'}${Math.abs(v!)}` }));
    if (c.moraleLossMult) lines.push(e('trc.moraleLossMult', { v: mult(c.moraleLossMult) }));
    if (c.moraleGainMult) lines.push(e('trc.moraleGainMult', { v: mult(c.moraleGainMult) }));
    if (c.disobeyMult) lines.push(e('trc.disobeyMult', { v: mult(c.disobeyMult) }));
    if (c.enrageBelowHp) lines.push(e('trc.enrageBelowHp', { v: Math.round(c.enrageBelowHp * 100) }));
    if (c.enrageOnAllyKo) lines.push(e('trc.enrageOnAllyKo'));
    if (c.enrageBelowHp || c.enrageOnAllyKo) lines.push(rage());
    if (c.auraMorale) lines.push(e('trc.auraMorale', { v: c.auraMorale }));
    if (c.interceptBonus) lines.push(e('trc.interceptBonus', { v: pct(c.interceptBonus) }));
    if (c.critBonus) lines.push(e('trc.critBonus', { v: pct(c.critBonus) }));
    if (c.damageMult) lines.push(e('trc.damageMult', { v: mult(c.damageMult) }));
    if (c.breakThresholdMod) lines.push(e('trc.breakThresholdMod', { v: Math.abs(c.breakThresholdMod), dir: e(c.breakThresholdMod > 0 ? 'trc.sooner' : 'trc.later') }));
    if (c.instinctTarget) lines.push(e('trc.instinctTarget', { v: e(`prio.${c.instinctTarget}` as EncKey) }));
    if (c.showboatChance) lines.push(e('trc.showboatChance', { v: Math.round(c.showboatChance * 100) }));
    if (c.soloDamageMult) lines.push(e('trc.soloDamageMult', { v: mult(c.soloDamageMult) }));
    if (c.comboBonus) lines.push(e('trc.comboBonus', { v: pct(c.comboBonus) }));
    if (c.hitBonus) lines.push(e('trc.hitBonus', { v: `${c.hitBonus > 0 ? '+' : '−'}${pct(c.hitBonus)}` }));
    if (c.dodgeBonus) lines.push(e('trc.dodgeBonus', { v: pct(c.dodgeBonus) }));
    if (c.mitigationBonus) lines.push(e('trc.mitigationBonus', { v: `${c.mitigationBonus > 0 ? '+' : '−'}${pct(c.mitigationBonus)}` }));
    if (c.healMult) lines.push(e('trc.healMult', { v: mult(c.healMult) }));
    if (c.staminaRegenMult) lines.push(e('trc.staminaRegenMult', { v: mult(c.staminaRegenMult) }));
    if (c.staminaCostMult) lines.push(e('trc.staminaCostMult', { v: mult(c.staminaCostMult) }));
    if (c.woundedTargetMult) lines.push(e('trc.woundedTargetMult', { v: mult(c.woundedTargetMult), t: Math.round(DEFAULT_CONFIG.combat.damage.woundedBelow * 100) }));
    if (tdef.training?.injuryMult) lines.push(e('trc.injuryMult', { v: mult(tdef.training.injuryMult) }));
    if (tdef.training?.gainMult) lines.push(e('trc.gainMult', { v: mult(tdef.training.gainMult) }));
    if (tdef.personality?.ambitionMod) lines.push(e('trc.ambitionMod', { v: tdef.personality.ambitionMod }));
    if (tdef.personality?.loyaltyMod) lines.push(e('trc.loyaltyMod'));
    if (tdef.personality?.moraleVolatility) lines.push(e('trc.moraleVolatility', { v: mult(tdef.personality.moraleVolatility) }));
    return lines;
  };
}
