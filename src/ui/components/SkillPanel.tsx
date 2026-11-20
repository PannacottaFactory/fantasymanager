/**
 * A creature's kit: its basic attack(s), then its five skills in unlock order (level badge, locked / equipped).
 * The basic attack is a choice like the others. When `onEquip` is given (own creatures), clicking an equipped skill
 * takes it off, clicking another one equips it (in place of the one equipped longest ago when the slots are full).
 */
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { equippedSkills, getSpecies, skillLevel } from '../../engine/creature/derived.ts';
import { levelOf } from '../../engine/progression/levels.ts';
import { abilityText } from '../../engine/text/localize.ts';
import type { Creature } from '../../engine/model.ts';
import { useT } from '../i18n/index.ts';
import { AbilityCard } from './AbilityCard.tsx';

interface Props {
  creature: Creature;
  /** The manager's choice (undefined = not set yet: the default one); equipped skills are shown when given or editable. */
  chosen?: readonly string[];
  /** Equipped skills are shown (own creatures, live match). */
  showEquipped?: boolean;
  onEquip?: (abilityId: string) => void;
  /** The creature's level is known (own creatures): locked skills say how far it is. */
  knowsLevel?: boolean;
}

export function SkillPanel({ creature, chosen, showEquipped, onEquip, knowsLevel = true }: Props) {
  const { t, lang } = useT();
  const sp = getSpecies(creature);
  const lv = levelOf(creature);
  const max = DEFAULT_CONFIG.combat.skills.equipped;
  const shown = showEquipped || !!onEquip;
  const equipped = shown ? equippedSkills(creature, chosen) : [];
  const card = (id: string, at: number | null) => {
    const locked = at !== null && at > lv;
    const on = equipped.includes(id);
    const replaced = equipped.length >= max ? equipped[0] : undefined;
    return (
      <AbilityCard
        key={id}
        id={id}
        elements={sp.elements}
        locked={locked}
        unlockAt={at ?? undefined}
        current={knowsLevel ? lv : undefined}
        badge={at === null ? t('sk.basic') : t('sk.level', { n: at })}
        badgeTitle={at === null ? t('sk.basicTitle') : undefined}
        equipped={on}
        onEquip={onEquip && !locked ? () => onEquip(id) : undefined}
        equipTitle={on ? t('sk.unequip') : replaced ? t('sk.equipFor', { old: abilityText(replaced, lang).name }) : t('sk.equip')}
      />
    );
  };
  return (
    <div className="skill-panel">
      {shown && (
        <div className={`skill-sub ${equipped.length ? '' : 'bad-text'}`}>
          <span>{equipped.length ? t('sk.count', { k: equipped.length, n: max }) : t('sk.none')}</span>
        </div>
      )}
      <div className="ability-grid" data-tip="sheet-abilities">
        {sp.basic.map((id) => card(id, null))}
        {sp.skills.map((id, i) => card(id, skillLevel(i)))}
      </div>
    </div>
  );
}
