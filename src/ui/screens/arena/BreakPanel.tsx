import { useState } from 'react';
import type { TargetPriority } from '../../../data/schema.ts';
import type { Combat } from '../../../engine/combat/combat.ts';
import { aiBreakDecision } from '../../../engine/combat/decisions.ts';
import { hpFraction, staminaFraction } from '../../../engine/combat/formulas.ts';
import type { BreakDecision, SubstitutionDecision } from '../../../engine/combat/types.ts';
import type { Aggression, Risk, Stance, TeamOrders } from '../../../engine/model.ts';
import { Bar, Modal, Sigil } from '../../components/common.tsx';
import { hpColor, moraleLabel, roleName, speciesName } from '../../format.ts';

interface Props {
  combat: Combat;
  onResume: (d: BreakDecision) => void;
}

/** Manager decisions at a break: substitutions, team orders, individual stances. */
export function BreakPanel({ combat, onResume }: Props) {
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
    const d = aiBreakDecision(combat, side);
    setSubs(d.substitutions ?? []);
    if (d.orders) setOrders(d.orders);
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

  return (
    <Modal
      title={`Break after round ${combat.round}`}
      onClose={resume}
      actions={
        <button className="btn small" onClick={suggest} title="Let your assistant propose changes">
          Assistant’s advice
        </button>
      }
    >
      <div className="stack">
        <div className="row muted" style={{ fontSize: 13 }}>
          Team health: <b className="home-text">{Math.round(ours * 100)}%</b> vs <b className="away-text">{Math.round(theirs * 100)}%</b>
          <span className="spacer" />
          Substitutions left: <b>{subsLeft - subs.length}</b>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Creature</th>
              <th>Role</th>
              <th>Health</th>
              <th>Stamina</th>
              <th>Morale</th>
              <th>Orders</th>
              <th>Substitute</th>
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
                      <Sigil speciesId={c.speciesId} /> {c.name} {down && <span className="tag">{c.state.toUpperCase()}</span>}
                    </span>
                  </td>
                  <td>{roleName(c.role)}</td>
                  <td style={{ width: 120 }}>
                    <Bar value={c.hp} max={c.maxHp} color={hpColor(hpFraction(c))} title={`${Math.round(c.hp)}/${c.maxHp}`} />
                  </td>
                  <td style={{ width: 100 }}>
                    <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" title={`${Math.round(staminaFraction(c) * 100)}%`} />
                  </td>
                  <td>{down ? '—' : moraleLabel(c.morale)}</td>
                  <td>
                    {!down && (
                      <select className="compact" value={stances[c.id]} onChange={(e) => setStances({ ...stances, [c.id]: e.target.value as Stance })}>
                        <option value="normal">Normal</option>
                        <option value="conserve">Pace yourself</option>
                        <option value="allOut">All out</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <span className="row" style={{ gap: 4 }}>
                      <button className={`btn small ${sub ? 'active' : ''}`} disabled={!sub && (subs.length >= subsLeft || bench.length <= subs.length)} onClick={() => toggleOut(c.id)}>
                        {sub ? 'Replacing' : 'Replace'}
                      </button>
                      {sub && (
                        <select className="compact" value={sub.inId} onChange={(e) => setIn(c.id, e.target.value)}>
                          {bench
                            .filter((b) => b.id === sub.inId || !inIds.has(b.id))
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({speciesName(b.speciesId)}, {roleName(b.role)})
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
        {bench.length === 0 && <div className="muted">No creatures left on the bench.</div>}

        <div className="row wrap" style={{ gap: 14 }}>
          <label className="field">
            Approach
            <select value={orders.aggression} onChange={(e) => setOrders({ ...orders, aggression: e.target.value as Aggression })}>
              <option value="cautious">Cautious</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label className="field">
            Target priority
            <select value={orders.target} onChange={(e) => setOrders({ ...orders, target: e.target.value as TargetPriority })}>
              <option value="nearest">Nearest</option>
              <option value="weakest">Weakest</option>
              <option value="strongest">Strongest</option>
              <option value="casters">Casters & healers</option>
              <option value="threat">Biggest threat</option>
            </select>
          </label>
          <label className="field">
            Risk taking
            <select value={orders.risk} onChange={(e) => setOrders({ ...orders, risk: e.target.value as Risk })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <span className="spacer" />
          <button className="btn primary" onClick={resume}>
            Resume the fight
          </button>
        </div>
      </div>
    </Modal>
  );
}
