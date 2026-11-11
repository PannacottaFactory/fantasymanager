import { useState } from 'react';
import type { TargetPriority } from '../../../data/schema.ts';
import type { Combat } from '../../../engine/combat/combat.ts';
import { aiBreakDecision, DEFAULT_AI_STYLE, readTarget } from '../../../engine/combat/decisions.ts';
import { hpFraction, staminaFraction } from '../../../engine/combat/formulas.ts';
import type { BreakDecision, SubstitutionDecision } from '../../../engine/combat/types.ts';
import type { Aggression, Risk, Stance, TeamOrders } from '../../../engine/model.ts';
import { roleText, speciesName } from '../../../engine/text/localize.ts';
import { Bar, Crest, Modal } from '../../components/common.tsx';
import { hpColor, moraleKey, moraleColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { RoleLabel } from '../../icons/Icon.tsx';

const TARGETS: TargetPriority[] = ['nearest', 'weakest', 'strongest', 'casters', 'threat'];

interface Props {
  combat: Combat;
  onResume: (d: BreakDecision) => void;
}

/** Manager decisions at a break: substitutions, team orders, individual stances. */
export function BreakPanel({ combat, onResume }: Props) {
  const { t, lang } = useT();
  const side = 0;
  const cfg = combat.cfg;
  const subsLeft = cfg.match.maxSubstitutions - combat.sides[side].subsUsed;
  const mine = combat.combatants.filter((c) => c.side === side && !c.replaced && c.state !== 'bench' && c.state !== 'withdrawn');
  const bench = combat.bench(side);
  const [subs, setSubs] = useState<SubstitutionDecision[]>([]);
  const [orders, setOrders] = useState<TeamOrders>({ ...combat.sides[side].orders });
  const [stances, setStances] = useState<Record<string, Stance>>(() => Object.fromEntries(mine.map((c) => [c.id, c.stance])));

  const outIds = new Set(subs.map((s) => s.outId));
  const inIds = new Set(subs.map((s) => s.inId));
  const suggest = () => {
    // The assistant reads the visible line-up (target) but, like you, cannot see the opponent's approach.
    const d = aiBreakDecision(combat, side, DEFAULT_AI_STYLE);
    setSubs(d.substitutions ?? []);
    setOrders({ ...(d.orders ?? orders), target: readTarget(combat, side) });
  };
  const toggleOut = (id: string) => {
    if (outIds.has(id)) setSubs(subs.filter((s) => s.outId !== id));
    else {
      const free = bench.find((b) => !inIds.has(b.id));
      if (free && subs.length < subsLeft) setSubs([...subs, { outId: id, inId: free.id }]);
    }
  };
  const setIn = (outId: string, inId: string) => setSubs(subs.map((s) => (s.outId === outId ? { ...s, inId } : s)));
  const resume = () => {
    const stanceChanges = Object.entries(stances)
      .filter(([id, st]) => combat.get(id).stance !== st && !outIds.has(id))
      .map(([id, stance]) => ({ id, stance }));
    onResume({ substitutions: subs, orders, stanceChanges });
  };

  const ours = combat.teamHealth(0);
  const theirs = combat.teamHealth(1);
  const stateTag = (s: string) => (s === 'ko' ? t('tag.ko') : s === 'fled' ? t('tag.fled') : s.toUpperCase());

  return (
    <Modal
      title={t('break.title', { n: combat.round })}
      onClose={resume}
      actions={
        <button className="btn small" onClick={suggest} title={t('break.advice.title')}>
          {t('break.advice')}
        </button>
      }
    >
      <div className="stack">
        <div className="row muted" style={{ fontSize: '0.929rem' }}>
          {t('break.teamHealth')} <b className="home-text">{Math.round(ours * 100)} %</b> {t('common.vs')} <b className="away-text">{Math.round(theirs * 100)} %</b>
          <span className="spacer" />
          {t('break.subsLeft')} <b>{subsLeft - subs.length}</b>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('col.creature')}</th>
                <th>{t('col.role')}</th>
                <th>{t('col.health')}</th>
                <th>{t('col.stamina')}</th>
                <th>{t('col.morale')}</th>
                <th>{t('col.orders')}</th>
                <th>{t('col.substitute')}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((c) => {
                const down = c.state !== 'active';
                const sub = subs.find((s) => s.outId === c.id);
                return (
                  <tr key={c.id} className={down ? 'dim' : ''}>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Crest speciesId={c.speciesId} name={c.name} /> {c.name} {down && <span className="tag">{stateTag(c.state)}</span>}
                      </span>
                    </td>
                    <td>
                      <RoleLabel role={c.role} />
                    </td>
                    <td style={{ width: 120 }}>
                      <Bar value={c.hp} max={c.maxHp} color={hpColor(hpFraction(c))} title={`${Math.round(c.hp)}/${c.maxHp}`} />
                    </td>
                    <td style={{ width: 100 }}>
                      <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" title={`${Math.round(staminaFraction(c) * 100)} %`} />
                    </td>
                    <td style={{ color: down ? undefined : moraleColor(c.morale) }}>{down ? '—' : t(moraleKey(c.morale))}</td>
                    <td>
                      {!down && (
                        <select className="compact" value={stances[c.id]} onChange={(e) => setStances({ ...stances, [c.id]: e.target.value as Stance })}>
                          <option value="normal">{t('stance.normal')}</option>
                          <option value="conserve">{t('stance.conserve')}</option>
                          <option value="allOut">{t('stance.allOut')}</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span className="row" style={{ gap: 4 }}>
                        <button className={`btn small ${sub ? 'active' : ''}`} disabled={!sub && (subs.length >= subsLeft || bench.length <= subs.length)} onClick={() => toggleOut(c.id)}>
                          {sub ? t('break.replacing') : t('break.replace')}
                        </button>
                        {sub && (
                          <select className="compact" value={sub.inId} onChange={(e) => setIn(c.id, e.target.value)}>
                            {bench
                              .filter((b) => b.id === sub.inId || !inIds.has(b.id))
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({speciesName(b.speciesId, lang)}, {roleText(b.role, lang).name})
                                </option>
                              ))}
                          </select>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {bench.length === 0 && <div className="muted">{t('break.noBench')}</div>}

        <div className="row wrap" style={{ gap: 14 }}>
          <label className="field">
            <span title={t('orders.approach.title')}>{t('orders.approach')} ⓘ</span>
            <select value={orders.aggression} onChange={(e) => setOrders({ ...orders, aggression: e.target.value as Aggression })}>
              <option value="cautious">{t('orders.cautious')}</option>
              <option value="balanced">{t('orders.balanced')}</option>
              <option value="aggressive">{t('orders.aggressive')}</option>
            </select>
          </label>
          <AscendancyHint />
          <label className="field">
            {t('orders.target')}
            <select value={orders.target} onChange={(e) => setOrders({ ...orders, target: e.target.value as TargetPriority })}>
              {TARGETS.map((x) => (
                <option key={x} value={x}>
                  {t(`target.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('orders.risk')}
            <select value={orders.risk} onChange={(e) => setOrders({ ...orders, risk: e.target.value as Risk })}>
              <option value="low">{t('risk.low')}</option>
              <option value="normal">{t('risk.normal')}</option>
              <option value="high">{t('risk.high')}</option>
            </select>
          </label>
          <span className="spacer" />
          <button className="btn primary" onClick={resume} data-tip="break">
            {t('break.resume')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** The approach cycle as a reminder: the opponent's approach stays hidden, you have to guess it. */
function AscendancyHint() {
  const { t } = useT();
  return (
    <span className="muted" style={{ fontSize: '0.857rem', maxWidth: 280, alignSelf: 'center' }} title={t('orders.ascendancy.title')}>
      {t('break.hiddenApproach')}
    </span>
  );
}
