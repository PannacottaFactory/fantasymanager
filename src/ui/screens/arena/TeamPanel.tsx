import { useState } from 'react';
import { DEFAULT_CONFIG, type QualityId } from '../../../data/config/index.ts';
import { ROLE_IDS } from '../../../data/roles.ts';
import { SPECIES, SPECIES_IDS } from '../../../data/species.ts';
import type { Line, RoleId, TargetPriority } from '../../../data/schema.ts';
import { maxHp, overallRating } from '../../../engine/creature/derived.ts';
import { isStarter, setOrders, toggleBench, toggleStarter, updateSlot } from '../../../engine/team/edit.ts';
import { validateTactic } from '../../../engine/team/team.ts';
import type { Aggression, Creature, Risk, Stance, Team } from '../../../engine/model.ts';
import { Attr, ElementDots, Sigil, TraitChip } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { roleName } from '../../format.ts';
import { useArena } from '../../store/arenaStore.ts';
import { CreatureModal } from './CreatureModal.tsx';

const TARGETS: { value: TargetPriority; label: string }[] = [
  { value: 'nearest', label: 'Nearest (front line)' },
  { value: 'weakest', label: 'Weakest (finish them)' },
  { value: 'strongest', label: 'Strongest' },
  { value: 'casters', label: 'Casters & healers' },
  { value: 'threat', label: 'Biggest threat' },
];

export function TeamPanel({ side }: { side: 0 | 1 }) {
  const team = useArena((s) => s.teams[side]);
  const quality = useArena((s) => s.quality[side]);
  const { setTeam, setQuality, regenerate, swapSpecies } = useArena.getState();
  const [open, setOpen] = useState<Creature | null>(null);
  const errors = validateTactic(team);
  const slot = (id: string) => team.tactic.lineup.find((s) => s.creatureId === id);
  const status = (c: Creature) => (isStarter(team, c.id) ? 0 : team.tactic.bench.includes(c.id) ? 1 : 2);
  const update = (t: Team) => setTeam(side, t);

  const columns: Column<Creature>[] = [
    {
      key: 'status',
      label: 'Squad',
      sort: status,
      render: (c) => {
        const st = status(c);
        return (
          <span className="row" style={{ gap: 4 }}>
            <button className={`btn small ${st === 0 ? 'active' : ''}`} title="Toggle starter" onClick={() => update(toggleStarter(team, c.id))}>
              {st === 0 ? 'Starter' : 'Start'}
            </button>
            {st !== 0 && (
              <button className={`btn small ${st === 1 ? 'active' : ''}`} title="Toggle bench" onClick={() => update(toggleBench(team, c.id))}>
                {st === 1 ? 'Bench' : 'Rest'}
              </button>
            )}
          </span>
        );
      },
    },
    {
      key: 'name',
      label: 'Name',
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Sigil speciesId={c.speciesId} />
          <button className="link" onClick={() => setOpen(c)}>
            {c.name}
          </button>
        </span>
      ),
    },
    {
      key: 'species',
      label: 'Species',
      sort: (c) => c.speciesId,
      render: (c) => (
        <span className="row" style={{ gap: 4 }}>
          <ElementDots speciesId={c.speciesId} />
          <select className="compact" value={c.speciesId} title="Replace with a new creature of this species" onChange={(e) => swapSpecies(side, c.id, e.target.value)}>
            {SPECIES_IDS.map((id) => (
              <option key={id} value={id}>
                {SPECIES[id]!.name}
              </option>
            ))}
          </select>
        </span>
      ),
    },
    { key: 'age', label: 'Age', num: true, sort: (c) => c.age, render: (c) => c.age },
    { key: 'ovr', label: 'Ovr', title: 'Overall rating (1–100)', num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    {
      key: 'role',
      label: 'Role',
      sort: (c) => slot(c.id)?.role ?? 'zz',
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.role} onChange={(e) => update(updateSlot(team, c.id, { role: e.target.value as RoleId }))}>
            {ROLE_IDS.map((r) => (
              <option key={r} value={r}>
                {roleName(r)}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'line',
      label: 'Line',
      sort: (c) => slot(c.id)?.line ?? 'zz',
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.line} onChange={(e) => update(updateSlot(team, c.id, { line: e.target.value as Line }))}>
            <option value="front">Front</option>
            <option value="back">Back</option>
          </select>
        );
      },
    },
    {
      key: 'stance',
      label: 'Orders',
      title: 'Individual instruction',
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.stance} onChange={(e) => update(updateSlot(team, c.id, { stance: e.target.value as Stance }))}>
            <option value="normal">Normal</option>
            <option value="conserve">Pace yourself</option>
            <option value="allOut">All out</option>
          </select>
        );
      },
    },
    { key: 'hp', label: 'HP', num: true, sort: (c) => maxHp(c, DEFAULT_CONFIG), render: (c) => maxHp(c, DEFAULT_CONFIG) },
    { key: 'str', label: 'Str', num: true, sort: (c) => c.attributes.strength, render: (c) => <Attr v={c.attributes.strength} /> },
    { key: 'tgh', label: 'Tgh', num: true, sort: (c) => c.attributes.toughness, render: (c) => <Attr v={c.attributes.toughness} /> },
    { key: 'spd', label: 'Spd', num: true, sort: (c) => c.attributes.speed, render: (c) => <Attr v={c.attributes.speed} /> },
    { key: 'sta', label: 'Sta', num: true, sort: (c) => c.attributes.stamina, render: (c) => <Attr v={c.attributes.stamina} /> },
    { key: 'atk', label: 'Atk', num: true, sort: (c) => c.attributes.attack, render: (c) => <Attr v={c.attributes.attack} /> },
    { key: 'def', label: 'Def', num: true, sort: (c) => c.attributes.defense, render: (c) => <Attr v={c.attributes.defense} /> },
    { key: 'mag', label: 'Mag', num: true, sort: (c) => c.attributes.magic, render: (c) => <Attr v={c.attributes.magic} /> },
    { key: 'cou', label: 'Cou', num: true, sort: (c) => c.attributes.courage, render: (c) => <Attr v={c.attributes.courage} /> },
    { key: 'dis', label: 'Dis', num: true, sort: (c) => c.attributes.discipline, render: (c) => <Attr v={c.attributes.discipline} /> },
    { key: 'traits', label: 'Traits', render: (c) => c.traits.map((t) => <TraitChip key={t} id={t} />) },
  ];

  return (
    <section className={`panel ${side === 0 ? 'side-home' : 'side-away'}`}>
      <div className="panel-head">
        <span className={side === 0 ? 'home-text' : 'away-text'} style={{ fontWeight: 700, fontSize: 12 }}>
          {side === 0 ? 'YOUR TEAM' : 'OPPONENT'}
        </span>
        <input
          className="team-name-input"
          value={team.name}
          aria-label="Team name"
          onChange={(e) => update({ ...team, name: e.target.value })}
        />
        <span className="spacer" />
        <select value={quality} onChange={(e) => setQuality(side, e.target.value as QualityId)} aria-label="Quality of generated creatures">
          {Object.entries(DEFAULT_CONFIG.generation.qualities).map(([id, q]) => (
            <option key={id} value={id}>
              {q.label}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => regenerate(side)}>
          Generate new team
        </button>
      </div>

      <div className="row wrap" style={{ marginBottom: 10, gap: 14 }}>
        <label className="field">
          Approach
          <select value={team.tactic.orders.aggression} onChange={(e) => update(setOrders(team, { aggression: e.target.value as Aggression }))}>
            <option value="cautious">Cautious</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label className="field">
          Target priority
          <select value={team.tactic.orders.target} onChange={(e) => update(setOrders(team, { target: e.target.value as TargetPriority }))}>
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Risk taking
          <select value={team.tactic.orders.risk} onChange={(e) => update(setOrders(team, { risk: e.target.value as Risk }))}>
            <option value="low">Low — steady</option>
            <option value="normal">Normal</option>
            <option value="high">High — go for big moves</option>
          </select>
        </label>
        <span className="muted" style={{ fontSize: 12, alignSelf: 'end' }}>
          {team.tactic.lineup.length}/{DEFAULT_CONFIG.match.starters} starters · {team.tactic.bench.length}/{DEFAULT_CONFIG.match.benchSize} bench
        </span>
        {errors.length > 0 && (
          <span className="error" style={{ alignSelf: 'end' }}>
            {errors[0]}
          </span>
        )}
      </div>

      <SortableTable
        rows={team.creatures}
        columns={columns}
        rowKey={(c) => c.id}
        initialSort={{ key: 'status', dir: 1 }}
        rowClass={(c, i, sorted) => {
          const st = status(c);
          const prev = i > 0 ? status(sorted[i - 1]!) : st;
          return `${st === 2 ? 'dim' : ''} ${st !== prev ? 'sep' : ''}`;
        }}
      />
      {open && <CreatureModal creature={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
