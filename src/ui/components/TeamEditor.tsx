import { useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { ROLE_IDS } from '../../data/roles.ts';
import { SPECIES_IDS } from '../../data/species.ts';
import type { Line, RoleId, TargetPriority } from '../../data/schema.ts';
import { isInjured, maxHp, overallRating } from '../../engine/creature/derived.ts';
import { isStarter, setOrders, toggleBench, toggleFavorite, toggleStarter, updateSlot } from '../../engine/team/edit.ts';
import { validateTactic, type TacticIssue } from '../../engine/team/team.ts';
import { abilityText, attributeText, roleText, speciesName } from '../../engine/text/localize.ts';
import { getSpecies } from '../../engine/creature/derived.ts';
import { KIND_GLYPH, abilityColor } from './AbilityCard.tsx';
import { ABILITIES } from '../../data/abilities.ts';
import type { Aggression, Creature, Risk, Stance, Team } from '../../engine/model.ts';
import { fatigueColor } from '../format.ts';
import { useT, type Translator } from '../i18n/index.ts';
import { CreatureModal } from '../screens/arena/CreatureModal.tsx';
import { Attr, Bar, Crest, ElementDots, TraitChip } from './common.tsx';
import { SortableTable, type Column } from './SortableTable.tsx';

const TARGETS: TargetPriority[] = ['nearest', 'weakest', 'strongest', 'casters', 'threat'];
const ATTR_COLUMNS = ['strength', 'toughness', 'speed', 'stamina', 'attack', 'defense', 'magic', 'courage', 'discipline'] as const;

export function issueText(tr: Translator, team: Team, issue: TacticIssue): string {
  switch (issue.code) {
    case 'lineupSize':
    case 'benchSize':
      return tr.t(issue.code === 'lineupSize' ? 'issue.lineupSize' : 'issue.benchSize', { n: issue.n });
    case 'unknown':
      return tr.t('issue.unknown');
    case 'duplicate':
      return tr.t('issue.duplicate');
    case 'injured':
      return tr.t('issue.injured', { name: team.creatures.find((c) => c.id === issue.id)?.name ?? '?' });
  }
}

/** Team orders: approach, target priority, risk. */
export function OrdersFields({ team, onChange }: { team: Team; onChange: (t: Team) => void }) {
  const { t } = useT();
  const o = team.tactic.orders;
  return (
    <>
      <label className="field">
        {t('orders.approach')}
        <select value={o.aggression} onChange={(e) => onChange(setOrders(team, { aggression: e.target.value as Aggression }))}>
          <option value="cautious">{t('orders.cautious')}</option>
          <option value="balanced">{t('orders.balanced')}</option>
          <option value="aggressive">{t('orders.aggressive')}</option>
        </select>
      </label>
      <label className="field">
        {t('orders.target')}
        <select value={o.target} onChange={(e) => onChange(setOrders(team, { target: e.target.value as TargetPriority }))}>
          {TARGETS.map((x) => (
            <option key={x} value={x}>
              {t(`target.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t('orders.risk')}
        <select value={o.risk} onChange={(e) => onChange(setOrders(team, { risk: e.target.value as Risk }))}>
          <option value="low">{t('risk.low')}</option>
          <option value="normal">{t('risk.normal')}</option>
          <option value="high">{t('risk.high')}</option>
        </select>
      </label>
    </>
  );
}

interface Props {
  team: Team;
  onChange: (t: Team) => void;
  /** Header content (team name, buttons…). */
  header?: ReactNode;
  /** League mode: shows condition columns and flags injured creatures as errors. */
  league?: boolean;
  /** Sandbox only: replace a creature by a new one of another species. */
  onSwapSpecies?: (creatureId: string, speciesId: string) => void;
  className?: string;
  /** League: opens the game's creature sheet instead of the local one. */
  onOpenCreature?: (creatureId: string) => void;
}

export function TeamEditor({ team, onChange, header, league, onSwapSpecies, className, onOpenCreature }: Props) {
  const tr = useT();
  const { t, lang } = tr;
  const [openLocal, setOpenLocal] = useState<string | null>(null);
  const openId = onOpenCreature ? null : openLocal;
  const setOpenId = (id: string | null) => (onOpenCreature && id ? onOpenCreature(id) : setOpenLocal(id));
  const open = openId ? (team.creatures.find((c) => c.id === openId) ?? null) : null;
  const favs = (id: string) => team.tactic.favorites?.[id] ?? [];
  const issues = validateTactic(team, DEFAULT_CONFIG, !!league);
  const slot = (id: string) => team.tactic.lineup.find((s) => s.creatureId === id);
  const status = (c: Creature) => (isStarter(team, c.id) ? 0 : team.tactic.bench.includes(c.id) ? 1 : 2);
  const m = DEFAULT_CONFIG.match;

  const columns: Column<Creature>[] = [
    {
      key: 'status',
      label: t('col.selection'),
      sort: status,
      render: (c) => {
        const st = status(c);
        return (
          <span className="row" style={{ gap: 4 }}>
            <button className={`btn small ${st === 0 ? 'active' : ''}`} title={t('sel.toggleStarter')} onClick={() => onChange(toggleStarter(team, c.id))}>
              {st === 0 ? t('sel.starter') : t('sel.toStarter')}
            </button>
            {st !== 0 && (
              <button className={`btn small ${st === 1 ? 'active' : ''}`} title={t('sel.toggleBench')} onClick={() => onChange(toggleBench(team, c.id))}>
                {st === 1 ? t('sel.bench') : t('sel.toBench')}
              </button>
            )}
          </span>
        );
      },
    },
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={c.speciesId} name={c.name} />
          <button className="link" onClick={() => setOpenId(c.id)}>
            {c.name}
          </button>
        </span>
      ),
    },
    {
      key: 'species',
      label: t('col.species'),
      sort: (c) => speciesName(c.speciesId, lang),
      render: (c) => (
        <span className="row" style={{ gap: 4 }}>
          <ElementDots speciesId={c.speciesId} />
          {onSwapSpecies ? (
            <select className="compact" value={c.speciesId} title={t('arena.swapSpecies')} onChange={(e) => onSwapSpecies(c.id, e.target.value)}>
              {SPECIES_IDS.map((id) => (
                <option key={id} value={id}>
                  {speciesName(id, lang)}
                </option>
              ))}
            </select>
          ) : (
            speciesName(c.speciesId, lang)
          )}
        </span>
      ),
    },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
  ];
  if (league) {
    columns.push(
      {
        key: 'cond',
        label: t('col.status'),
        sort: (c) => (isInjured(c) ? 200 : 0) + c.condition.fatigue,
        render: (c) => {
          const inj = c.condition.injuries.find((i) => i.weeksLeft > 0);
          if (inj) return <span className="tag bad">{t('status.injured', { weeks: tr.weeks(inj.weeksLeft) })}</span>;
          return (
            <span className="row" style={{ gap: 4 }} title={`${t('col.fatigue')} ${c.condition.fatigue}%`}>
              <span style={{ width: 46 }}>
                <Bar value={c.condition.fatigue} max={100} color={fatigueColor(c.condition.fatigue)} thin />
              </span>
              <span className="mono faint" style={{ fontSize: '0.786rem' }}>
                {c.condition.fatigue}
              </span>
            </span>
          );
        },
      },
    );
  }
  columns.push(
    {
      key: 'role',
      label: t('col.role'),
      sort: (c) => slot(c.id)?.role ?? 'zz',
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.role} onChange={(e) => onChange(updateSlot(team, c.id, { role: e.target.value as RoleId }))}>
            {ROLE_IDS.map((r) => (
              <option key={r} value={r}>
                {roleText(r, lang).name}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'line',
      label: t('col.line'),
      sort: (c) => slot(c.id)?.line ?? 'zz',
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.line} onChange={(e) => onChange(updateSlot(team, c.id, { line: e.target.value as Line }))}>
            <option value="front">{t('line.front')}</option>
            <option value="back">{t('line.back')}</option>
          </select>
        );
      },
    },
    {
      key: 'stance',
      label: t('col.orders'),
      title: t('col.orders.title'),
      render: (c) => {
        const s = slot(c.id);
        if (!s) return <span className="faint">—</span>;
        return (
          <select className="compact" value={s.stance} onChange={(e) => onChange(updateSlot(team, c.id, { stance: e.target.value as Stance }))}>
            <option value="normal">{t('stance.normal')}</option>
            <option value="conserve">{t('stance.conserve')}</option>
            <option value="allOut">{t('stance.allOut')}</option>
          </select>
        );
      },
    },
    {
      key: 'build',
      label: t('col.build'),
      title: t('col.build.title'),
      sort: (c) => favs(c.id).length,
      render: (c) => {
        const f = favs(c.id);
        const els = getSpecies(c).elements;
        return (
          <button className="build-cell" onClick={() => setOpenId(c.id)} title={t('col.build.title')}>
            {f.length ? (
              f.map((a) => (
                <span key={a} className="build-chip" style={{ ['--c' as string]: abilityColor(a, els) }}>
                  {KIND_GLYPH[ABILITIES[a]!.kind]} {abilityText(a, lang).name}
                </span>
              ))
            ) : (
              <span className="faint" title={t('col.build.title')}>
                {t('build.free')}
              </span>
            )}
          </button>
        );
      },
    },
    { key: 'hp', label: t('col.hp'), num: true, sort: (c) => maxHp(c, DEFAULT_CONFIG), render: (c) => maxHp(c, DEFAULT_CONFIG) },
    ...ATTR_COLUMNS.map(
      (k): Column<Creature> => ({
        key: k,
        label: attributeText(k, lang).short,
        title: attributeText(k, lang).name,
        num: true,
        sort: (c) => c.attributes[k],
        render: (c) => <Attr v={c.attributes[k]} />,
      }),
    ),
    { key: 'traits', label: t('col.traits'), render: (c) => c.traits.map((x) => <TraitChip key={x} id={x} />) },
  );

  return (
    <section className={`panel ${className ?? ''}`}>
      {header && <div className="panel-head">{header}</div>}
      <div className="row wrap" style={{ marginBottom: 10, gap: 14 }}>
        <span data-tip={league ? 'orders' : undefined} className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
          <OrdersFields team={team} onChange={onChange} />
        </span>
        <span className="muted" style={{ fontSize: '0.857rem', alignSelf: 'end' }}>
          {t('tactics.count', { s: team.tactic.lineup.length, smax: m.starters, b: team.tactic.bench.length, bmax: m.benchSize })}
        </span>
        {issues.length > 0 && (
          <span className="error" style={{ alignSelf: 'end' }}>
            {issueText(tr, team, issues[0]!)}
          </span>
        )}
      </div>
      <div data-tip={league ? 'lineup' : undefined}>
      <SortableTable
        rows={team.creatures}
        columns={columns}
        rowKey={(c) => c.id}
        initialSort={{ key: 'status', dir: 1 }}
        rowClass={(c, i, sorted) => {
          const st = status(c);
          const prev = i > 0 ? status(sorted[i - 1]!) : st;
          const injured = league && isInjured(c) && st !== 2;
          return `${st === 2 ? 'dim' : ''} ${st !== prev ? 'sep' : ''} ${injured ? 'warn-row' : ''}`;
        }}
      />
      </div>
      {open && (
        <CreatureModal
          creature={open}
          onClose={() => setOpenId(null)}
          showHidden={!league}
          favorites={favs(open.id)}
          onToggleFavorite={(a) => onChange(toggleFavorite(team, open.id, a))}
        />
      )}
    </section>
  );
}
