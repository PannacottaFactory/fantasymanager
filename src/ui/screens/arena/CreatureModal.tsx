import { ATTRIBUTE_CATEGORIES, ATTRIBUTE_INFO, CATEGORY_LABELS, type AttributeCategory } from '../../../data/attributes.ts';
import { ABILITIES } from '../../../data/abilities.ts';
import { ELEMENTS } from '../../../data/elements.ts';
import { EFFECTS } from '../../../data/effects.ts';
import { ROLE_IDS } from '../../../data/roles.ts';
import { TRAITS } from '../../../data/traits.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { getSpecies, maxHp, maxStamina, overallRating, roleFit } from '../../../engine/creature/derived.ts';
import type { Creature } from '../../../engine/model.ts';
import { Attr, Bar, ElementDots, Modal, Sigil, TraitChip } from '../../components/common.tsx';
import { moraleLabel, roleName } from '../../format.ts';

export function CreatureModal({ creature, onClose }: { creature: Creature; onClose: () => void }) {
  const sp = getSpecies(creature);
  const lc = sp.lifeCurve;
  const stage = creature.age < lc.peakStart ? 'Developing' : creature.age <= lc.peakEnd ? 'In its prime' : 'Declining';
  return (
    <Modal
      title={
        <span className="row">
          <Sigil speciesId={sp.id} /> {creature.name}
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="row wrap" style={{ gap: 16 }}>
          <span>
            {sp.name} · <ElementDots speciesId={sp.id} /> {sp.elements.map((e) => ELEMENTS[e].name).join(' / ')} · {sp.size}
            {sp.flying ? ' · flying' : ''}
          </span>
          <span className="muted">
            Age {creature.age} ({stage}; prime {lc.peakStart}–{lc.peakEnd})
          </span>
          <span>
            Overall <b>{overallRating(creature)}</b>
          </span>
          <span className="muted">
            HP {maxHp(creature, DEFAULT_CONFIG)} · Stamina {maxStamina(creature, DEFAULT_CONFIG)}
          </span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {sp.description}
        </p>

        <div className="attr-grid">
          {(Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).map((cat) => (
            <div key={cat}>
              <h4 style={{ marginBottom: 6 }}>{CATEGORY_LABELS[cat]}</h4>
              <div className="attr-list">
                {ATTRIBUTE_CATEGORIES[cat].map((k) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <span title={ATTRIBUTE_INFO[k].description}>{ATTRIBUTE_INFO[k].name}</span>
                    <Attr v={creature.attributes[k]} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="attr-grid">
          <div>
            <h4 style={{ marginBottom: 6 }}>Traits</h4>
            {creature.traits.length === 0 && <span className="faint">No notable traits.</span>}
            {creature.traits.map((t) => (
              <div key={t} style={{ marginBottom: 4 }}>
                <TraitChip id={t} /> <span className="muted" style={{ fontSize: 12 }}>{TRAITS[t]?.description}</span>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ marginBottom: 6 }}>Abilities</h4>
            {sp.abilities.map((a) => {
              const def = ABILITIES[a.id]!;
              const unlocked = (a.minAbility ?? 0) <= creature.ability;
              return (
                <div key={a.id} style={{ marginBottom: 4, opacity: unlocked ? 1 : 0.45 }} title={def.description}>
                  <b>{def.name}</b> <span className="faint">{unlocked ? '' : '(locked — needs more experience)'}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {def.kind} · {def.element === 'innate' ? 'innate' : def.element} · power {def.power} · cost {def.staminaCost}
                    {def.cooldown ? ` · cooldown ${def.cooldown}` : ''}
                    {def.effects?.length ? ` · ${def.effects.map((e) => `${EFFECTS[e.effect]?.name} ${Math.round(e.chance * 100)}%`).join(', ')}` : ''}
                  </div>
                </div>
              );
            })}
            {sp.passives?.map((p) => (
              <div key={p} style={{ marginBottom: 4 }}>
                <b>{EFFECTS[p]?.name}</b> <span className="muted" style={{ fontSize: 12 }}>(passive) {EFFECTS[p]?.description}</span>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ marginBottom: 6 }}>Role suitability</h4>
            {ROLE_IDS.map((r) => (
              <div key={r} className="row" style={{ fontSize: 12, marginBottom: 3 }}>
                <span style={{ width: 80 }}>{roleName(r)}</span>
                <span className="grow">
                  <Bar value={roleFit(creature, r)} max={20} color="var(--accent)" thin />
                </span>
                <span className="mono" style={{ width: 28, textAlign: 'right' }}>
                  {roleFit(creature, r).toFixed(1)}
                </span>
              </div>
            ))}
            <h4 style={{ margin: '10px 0 6px' }}>Condition</h4>
            <dl className="kv">
              <dt>Form</dt>
              <dd>{creature.condition.form}/20</dd>
              <dt>Morale</dt>
              <dd>
                {moraleLabel(creature.condition.morale)} ({creature.condition.morale})
              </dd>
              <dt>Fatigue</dt>
              <dd>{creature.condition.fatigue}%</dd>
            </dl>
          </div>
        </div>

        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>
            Hidden values (sandbox only — scouts will never show these)
          </summary>
          <dl className="kv" style={{ marginTop: 6 }}>
            <dt>Current ability</dt>
            <dd>{creature.ability} / 200</dd>
            <dt>Potential</dt>
            <dd>{creature.potential} / 200</dd>
            {Object.entries(creature.hidden).map(([k, v]) => (
              <span key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
          </dl>
        </details>
      </div>
    </Modal>
  );
}
