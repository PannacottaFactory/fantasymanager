/**
 * Detailed action log of a match (report): every event worded plainly, round by round — who did what to whom, the
 * damage, the stamina paid. No commentary: the events themselves, filterable by side, creature and effects.
 */
import { useMemo, useState } from 'react';
import type { MatchEvent, MatchResult, Side } from '../../../engine/combat/types.ts';
import { abilityText, effectText, injuryText } from '../../../engine/text/localize.ts';
import { useT } from '../../i18n/index.ts';
import { logT } from '../../i18n/actionLog.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { Crest } from '../../components/common.tsx';

type Tone = 'good' | 'bad' | 'heal' | 'info' | '';

interface Head {
  k: 'head';
  text: string;
  major: boolean;
}
interface Act {
  k: 'act';
  round: number;
  side: Side | null;
  actor?: string;
  action: string;
  target?: string;
  result: string;
  tone: Tone;
  cost?: string;
  /** Status / effect bookkeeping (hidden unless asked for). */
  effect: boolean;
  /** Creatures involved (creature filter). */
  ids: string[];
}
type Row = Head | Act;

const ACTOR_EVENTS = new Set<MatchEvent['type']>(['attack', 'heal', 'buff', 'debuff', 'guard', 'drain', 'cleanse', 'dispel', 'sacrifice']);

function useRows(result: MatchResult): Row[] {
  const { t, lang, dec } = useT();
  return useMemo(() => {
    const L = logT(lang);
    const name = (id: string | undefined) => (id ? (result.roster[id]?.name ?? id) : '');
    const sideOf = (id: string | undefined): Side | null => (id ? (result.roster[id]?.side ?? null) : null);
    const ab = (id: string) => abilityText(id, lang).name;
    const ef = (id: string) => effectText(id, lang).name;
    const efs = (ids: string[]) => ids.map(ef).join(', ');
    const names = (ids: string[]) => ids.map(name).join(', ');
    const rows: Row[] = [];
    const pending = new Map<string, { cost: number; stamina: number }>();
    const act = (r: Omit<Act, 'k' | 'effect' | 'ids'> & { effect?: boolean; ids?: string[] }) => {
      let cost: string | undefined;
      if (r.actor && pending.has(r.actor)) {
        const p = pending.get(r.actor)!;
        pending.delete(r.actor);
        if (p.cost > 0) cost = `−${p.cost} → ${p.stamina}`;
      }
      rows.push({ k: 'act', effect: false, ids: [r.actor, r.target].filter((x): x is string => !!x), cost, ...r });
    };
    for (const e of result.events) {
      switch (e.type) {
        case 'matchStart':
          rows.push({ k: 'head', text: L('start'), major: true });
          break;
        case 'roundStart':
          rows.push({ k: 'head', text: L('round', { n: e.round }), major: false });
          break;
        case 'break':
          rows.push({ k: 'head', text: L('break', { n: e.index + 1 }), major: true });
          break;
        case 'matchEnd':
          rows.push({
            k: 'head',
            major: true,
            text: L('end', { winner: result.teams[e.winner].name, method: L(e.method === 'ko' ? 'end.ko' : 'end.points'), a: e.score[0], b: e.score[1] }),
          });
          break;
        case 'spend':
          // Paid just before the action: shown on that action's row.
          if (e.ability !== null || e.cost > 0) pending.set(e.actor, { cost: e.cost, stamina: e.stamina });
          break;
        case 'attack': {
          const parts: string[] = [];
          if (!e.hit) parts.push(L('miss'));
          else {
            parts.push(L('hit', { n: e.damage }));
            if (e.crit) parts.push(L('crit'));
            if (e.elementMult >= 1.2) parts.push(L('effective', { m: dec(e.elementMult, 2) }));
            else if (e.elementMult <= 0.85) parts.push(L('resisted', { m: dec(e.elementMult, 2) }));
            if (e.absorbed > 0) parts.push(L('absorbed', { n: e.absorbed }));
            if (e.execute) parts.push(L('execute'));
            if (e.pack) parts.push(L('pack', { n: e.pack }));
            if (e.undying) parts.push(L('undying'));
            if (e.healed) parts.push(L('lifesteal', { n: e.healed }));
            if (!e.decoy) parts.push(L('hpLeft', { n: e.targetHp }));
          }
          if (e.interceptedFrom) parts.push(L('intercepted', { name: name(e.interceptedFrom) }));
          if (e.decoy) parts.push(L('decoy'));
          if (e.aoe) parts.push(L('area'));
          if (e.flank) parts.push(L('flank'));
          if (e.ambush) parts.push(L('ambush'));
          if (e.chain) parts.push(L('chain', { n: e.chain }));
          if (e.charmed) parts.push(L('charmed'));
          const action = e.riposte ? `${L('riposte')} (${ab(e.ability)})` : ab(e.ability);
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action, target: e.target, result: parts.join(', '), tone: e.hit ? (e.crit ? 'bad' : '') : 'info' });
          break;
        }
        case 'heal':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), target: e.target, result: `${L('heal', { n: e.amount })}, ${e.targetHp}`, tone: 'heal' });
          break;
        case 'buff':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), result: L('buff', { names: e.targets.length === 1 && e.targets[0] === e.actor ? L('self') : names(e.targets) }), tone: 'info', ids: [e.actor, ...e.targets] });
          break;
        case 'debuff':
          act({
            round: e.round,
            side: sideOf(e.actor),
            actor: e.actor,
            action: ab(e.ability),
            result: e.affected.length ? L('debuff', { names: names(e.affected) }) : L('debuffNone'),
            tone: e.affected.length ? 'info' : '',
            ids: [e.actor, ...e.targets],
          });
          break;
        case 'guard':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('guard'), result: '', tone: '' });
          break;
        case 'rest':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('rest'), result: L('restGain', { n: e.gained }), tone: '' });
          break;
        case 'hesitate':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('hesitate'), result: '', tone: 'info' });
          break;
        case 'flee':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('flee'), result: '', tone: 'bad' });
          break;
        case 'stunned':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: e.effect ? L('stunnedBy', { effect: ef(e.effect) }) : L('stunned'), result: '', tone: 'info' });
          break;
        case 'showboat':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('showboat'), result: '', tone: 'info' });
          break;
        case 'disobey':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('disobey'), target: e.chose, result: L('disobeyText', { ordered: name(e.ordered), chose: name(e.chose) }), tone: 'info', ids: [e.actor, e.ordered, e.chose] });
          break;
        case 'effectApplied':
          act({
            round: e.round,
            side: sideOf(e.target),
            actor: e.target,
            action: e.stacks && e.stacks > 1 ? L('appliedStacks', { effect: ef(e.effect), n: e.stacks }) : L('applied', { effect: ef(e.effect) }),
            result: e.source && e.source !== e.target ? name(e.source) : '',
            tone: '',
            effect: true,
            ids: [e.target, ...(e.source ? [e.source] : [])],
          });
          break;
        case 'effectTick':
          act({
            round: e.round,
            side: sideOf(e.target),
            actor: e.target,
            action: L('tick', { effect: ef(e.effect) }),
            // Negative = damage over time, positive = regeneration.
            result: e.amount < 0 ? L('tickDmg', { n: -e.amount, hp: e.hp }) : L('tickHeal', { n: e.amount, hp: e.hp }),
            tone: e.amount < 0 ? '' : 'heal',
            effect: true,
          });
          break;
        case 'effectExpired':
          act({ round: e.round, side: sideOf(e.target), actor: e.target, action: L('expired', { effect: ef(e.effect) }), result: '', tone: '', effect: true });
          break;
        case 'cleanse':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), target: e.target, result: L('cleanse', { effects: efs(e.removed) }), tone: 'heal' });
          break;
        case 'dispel':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), target: e.target, result: L(e.stolen ? 'steal' : 'dispel', { effects: efs(e.removed) }), tone: 'info' });
          break;
        case 'sacrifice':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), result: L('sacrifice', { n: e.amount, hp: e.hp }), tone: '' });
          break;
        case 'thorns':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L(e.spell ? 'mirror' : 'thorns'), target: e.target, result: `${L('hit', { n: e.amount })}, ${L('hpLeft', { n: e.hp })}`, tone: '' });
          break;
        case 'transform':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('transform'), result: ef(e.effect), tone: 'info' });
          break;
        case 'drain':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: ab(e.ability), target: e.target, result: L('drain', { n: e.amount, s: e.stamina }), tone: 'info' });
          break;
        case 'enrage':
          act({
            round: e.round,
            side: sideOf(e.actor),
            actor: e.actor,
            action: L('enrage'),
            result: e.reason === 'friendKo' ? L('enrage.friendKo', { name: name(e.friend) }) : L(e.reason === 'lowHp' ? 'enrage.lowHp' : 'enrage.allyKo'),
            tone: 'info',
            effect: true,
          });
          break;
        case 'grace':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('grace'), result: L('graceText', { hp: e.hp, s: e.stamina, m: e.morale }), tone: 'good' });
          break;
        case 'exhausted':
          act({ round: e.round, side: sideOf(e.actor), actor: e.actor, action: L('exhausted'), result: '', tone: 'info', effect: true });
          break;
        case 'moraleShift':
          act({ round: e.round, side: e.side, actor: e.actor, action: L('leader'), result: '', tone: 'good', effect: true });
          break;
        case 'ko':
          act({ round: e.round, side: sideOf(e.target), actor: e.target, action: L('ko'), result: e.by ? L('koBy', { name: name(e.by) }) : '', tone: 'bad', ids: [e.target, ...(e.by ? [e.by] : [])] });
          break;
        case 'revive':
          act({ round: e.round, side: sideOf(e.target), actor: e.target, action: L('revive'), result: [e.by ? `${name(e.by)} (${e.ability ? ab(e.ability) : ''})` : ef(e.effect), L('reviveHp', { hp: e.hp })].join(', '), tone: 'heal', ids: [e.target, ...(e.by ? [e.by] : [])] });
          break;
        case 'injury':
          act({ round: e.round, side: sideOf(e.target), actor: e.target, action: L('injury', { injury: injuryText(e.injuryId, lang).name }), result: L('injuryWeeks', { n: e.weeks }), tone: 'bad' });
          break;
        case 'substitution':
          act({ round: e.round, side: e.side, actor: e.inId, action: L('sub'), result: L('subText', { in: name(e.inId), out: name(e.outId) }), tone: '', ids: [e.inId, e.outId] });
          break;
        case 'ordersChanged':
          act({ round: e.round, side: e.side, action: L('orders'), result: `${t(`orders.${e.orders.aggression}` as StringKey)}, ${t(`target.${e.orders.target}` as StringKey)}`, tone: '' });
          break;
        case 'teamTalk':
          act({ round: e.round, side: e.side, action: L('talk', { talk: t(`talk.${e.talk}` as StringKey) }), result: '', tone: '', ids: e.changes.map((c) => c.id) });
          break;
        default:
          break;
      }
      // An actor's stamina paid for an action that never came (should not happen) is not carried further.
      if (e.type !== 'spend' && 'actor' in e && ACTOR_EVENTS.has(e.type)) pending.delete(e.actor);
    }
    return rows;
  }, [result, lang, t, dec]);
}

export function ActionLog({ result, withEffects = false }: { result: MatchResult; withEffects?: boolean }) {
  const { lang } = useT();
  const L = logT(lang);
  const rows = useRows(result);
  const [side, setSide] = useState<'all' | Side>('all');
  const [creature, setCreature] = useState('');
  const [effects, setEffects] = useState(withEffects);
  const shown = useMemo(() => {
    const keep = rows.filter((r) => r.k === 'head' || ((effects || !r.effect) && (side === 'all' || r.side === side) && (!creature || r.ids.includes(creature))));
    // Headings with nothing under them are dropped (a round where the filters left no action).
    return keep.filter((r, i) => r.k === 'act' || r.major || keep[i + 1]?.k === 'act');
  }, [rows, side, creature, effects]);
  const creatures = Object.values(result.roster).filter((r) => rows.some((x) => x.k === 'act' && x.actor === r.id));
  const sideClass = (s: Side | null) => (s === 0 ? 'home-text' : s === 1 ? 'away-text' : '');
  const empty = !shown.some((r) => r.k === 'act');
  return (
    <div className="action-log">
      <div className="row wrap action-log-filters">
        <div className="seg">
          <button className={side === 'all' ? 'on' : ''} onClick={() => setSide('all')}>{L('f.all')}</button>
          <button className={side === 0 ? 'on' : ''} onClick={() => setSide(0)}>{result.teams[0].name}</button>
          <button className={side === 1 ? 'on' : ''} onClick={() => setSide(1)}>{result.teams[1].name}</button>
        </div>
        <select value={creature} onChange={(ev) => setCreature(ev.target.value)}>
          <option value="">{L('f.creature')}</option>
          {creatures.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="row" style={{ gap: 'var(--sp-1)' }}>
          <input type="checkbox" checked={effects} onChange={(ev) => setEffects(ev.target.checked)} /> {L('f.effects')}
        </label>
      </div>
      <div className="action-log-scroll">
        <table className="data action-log-table">
          <thead>
            <tr>
              <th className="num">{L('col.round')}</th>
              <th>{L('col.actor')}</th>
              <th>{L('col.action')}</th>
              <th>{L('col.target')}</th>
              <th>{L('col.result')}</th>
              <th className="num" title={L('col.cost.title')}>{L('col.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {empty && (
              <tr><td colSpan={6} className="muted">{L('none')}</td></tr>
            )}
            {!empty && shown.map((r, i) =>
              r.k === 'head' ? (
                <tr key={i} className={`al-head ${r.major ? 'major' : ''}`}>
                  <td colSpan={6}>{r.text}</td>
                </tr>
              ) : (
                <tr key={i} className={`al-row t-${r.tone || 'plain'} ${r.effect ? 'al-effect' : ''}`}>
                  <td className="num faint">{r.round}</td>
                  <td>
                    {r.actor ? (
                      <span className="al-who">
                        <Crest speciesId={result.roster[r.actor]?.speciesId ?? ''} name={result.roster[r.actor]?.name ?? ''} size={16} />
                        <span className={sideClass(r.side)}>{result.roster[r.actor]?.name}</span>
                      </span>
                    ) : (
                      <span className={sideClass(r.side)}>{r.side !== null ? result.teams[r.side].name : ''}</span>
                    )}
                  </td>
                  <td>{r.action}</td>
                  <td className={sideClass(r.target ? (result.roster[r.target]?.side ?? null) : null)}>{r.target ? result.roster[r.target]?.name : ''}</td>
                  <td className="al-result">{r.result}</td>
                  <td className="num faint">{r.cost ?? ''}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
