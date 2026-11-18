import { ATTRIBUTE_CATEGORIES, type AttributeCategory, type AttributeKey } from '../../../data/attributes.ts';
import { bestRole, isInjured, maxHp, overallRating } from '../../../engine/creature/derived.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { attributeText, injuryText, speciesName } from '../../../engine/text/localize.ts';
import type { Creature } from '../../../engine/model.ts';
import { Attr, ConditionCell, conditionSort, Crest, ElementDots, LevelBadge, Money, Seg, SquadCount, StageMark, Stars, TraitChip } from '../../components/common.tsx';
import { useAxisColumns } from '../../components/ProfileRadar.tsx';
import { creatureValue } from '../../../engine/economy/value.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { useState } from 'react';
import { maxLevelOf } from '../../../engine/progression/levels.ts';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { moraleKey, moraleColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { RoleLabel } from '../../icons/Icon.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';
import { UiIcon } from '../../icons/Icon.tsx';
import { levelOf } from '../../../engine/progression/levels.ts';

const VIEW_KEY = 'fm.squadView';
type SquadView = 'general' | 'attrs' | 'contracts';

export function SquadScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const team = playerTeam(game);
  const openSheet = (id: string) => useGame.getState().openSheet(id);
  const waiting = team.creatures.filter((c) => (c.growth?.freePoints ?? 0) > 0);
  const [view, setView] = useState<SquadView>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'attrs' || v === 'contracts' ? v : 'general';
    } catch {
      return 'general';
    }
  });
  const pickView = (v: SquadView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private window: the choice is not kept */
    }
  };
  const axisColumns = useAxisColumns<Creature>();

  // Columns shared by both table views: who, level, potential, rating.
  const idColumns: Column<Creature>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="sq-who">
          <Crest speciesId={c.speciesId} name={c.name} level={levelOf(c)} />
          <span className="sq-who-text">
            <button className="link" onClick={() => openSheet(c.id)}>
              {c.name}
            </button>
            <small>
              <SpeciesIcon id={c.speciesId} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} /> <StageMark c={c} />
            </small>
          </span>
        </span>
      ),
    },
    {
      key: 'level',
      label: t('col.level'),
      title: t('col.level.title'),
      sort: (c) => c.ability,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <LevelBadge c={c} compact bare />
          {(c.growth?.freePoints ?? 0) > 0 && (
            <button className="point-chip" title={t('points.chip.title')} onClick={() => openSheet(c.id)}>
              +{c.growth!.freePoints}
            </button>
          )}
        </span>
      ),
    },
    { key: 'pot', label: t('col.potential'), title: t('stars.potentialCol'), sort: (c) => c.potential, render: (c) => <Stars n={maxLevelOf(c)} title={t('stars.potential', { n: maxLevelOf(c) })} /> },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b className="sq-ovr">{overallRating(c)}</b> },
  ];
  const attrColumn = (k: AttributeKey, first = false): Column<Creature> => ({
    key: k,
    label: attributeText(k, lang).short,
    title: attributeText(k, lang).name,
    num: true,
    className: first ? 'col-attr col-cat' : 'col-attr',
    sort: (c) => c.attributes[k],
    render: (c) => <Attr v={c.attributes[k]} cell />,
  });

  // General view: role, condition, morale, health, the six profile axes, traits.
  const columns: Column<Creature>[] = [
    ...idColumns,
    { key: 'best', label: t('col.bestRole'), sort: (c) => bestRole(c), render: (c) => <RoleLabel role={bestRole(c)} /> },
    { key: 'cond', label: t('col.condition'), title: t('col.condition.title'), sort: conditionSort, render: (c) => <ConditionCell c={c} /> },
    { key: 'morale', label: t('col.morale'), sort: (c) => c.condition.morale, render: (c) => <span title={String(c.condition.morale)} style={{ color: moraleColor(c.condition.morale) }}>{t(moraleKey(c.condition.morale))}</span> },
    { key: 'hp', label: t('col.hp'), num: true, className: 'col-hp', sort: (c) => maxHp(c, DEFAULT_CONFIG), render: (c) => maxHp(c, DEFAULT_CONFIG) },
    ...axisColumns,
    { key: 'traits', label: t('col.traits'), className: 'col-cat', render: (c) => c.traits.map((x) => <TraitChip key={x} id={x} />) },
  ];
  // Contracts view: age, value, wage, end of contract, for sale.
  const contractColumns: Column<Creature>[] = [
    ...idColumns,
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    { key: 'value', label: t('col.value'), num: true, sort: (c) => creatureValue(c), render: (c) => <Money v={creatureValue(c)} /> },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.contract?.wage ?? 0, render: (c) => <Money v={c.contract?.wage ?? 0} /> },
    {
      key: 'contract',
      label: t('col.contract'),
      sort: (c) => c.contract?.untilSeason ?? 0,
      render: (c) => (
        <span className="row" style={{ gap: 4 }}>
          <span className={c.contract && c.contract.untilSeason <= game.season ? 'bad-text' : ''}>{c.contract ? t('contract.until', { s: c.contract.untilSeason }) : '—'}</span>
          {game.forSale.includes(c.id) && <span className="tag">{t('tag.forSale')}</span>}
        </span>
      ),
    },
  ];
  // Attributes view: every attribute, physical | combat | mental.
  const attrColumns: Column<Creature>[] = [
    ...idColumns,
    ...(Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).flatMap((cat) => ATTRIBUTE_CATEGORIES[cat].map((k, i) => attrColumn(k, i === 0))),
  ];
  return (
    <div className="stack">
      <section className="panel side-home" data-tip="squad">
        <div className="panel-head">
          <h2>
            {t('squad.title')} — {team.name}
          </h2>
          <SquadCount n={team.creatures.length} />
        </div>
        {waiting.length > 0 && (
          <div className="points-banner" data-tip="points">
            <span className="pb-icon">+{waiting.reduce((n, c) => n + (c.growth?.freePoints ?? 0), 0)}</span>
            <div className="grow">
              <b>{t('points.banner.title')}</b>
              <div className="muted">{t('points.banner.body')}</div>
              <div className="pb-list">
                {waiting.map((c) => (
                  <button key={c.id} className="point-chip wide" onClick={() => openSheet(c.id)}>
                    {c.name} +{c.growth!.freePoints}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="grow-hint">
          <span className="grow-hint-ico">▲</span>
          <span className="grow">{t('grow.hint')}</span>
          <button className="link" onClick={() => useGame.getState().setScreen('training')}>
            {t('grow.link')}
          </button>
        </p>
        <div className="row squad-view-bar">
          <Seg<SquadView>
            value={view}
            onChange={pickView}
            options={[
              { value: 'general', label: t('squad.view.general') },
              { value: 'attrs', label: t('squad.view.attrs') },
              { value: 'contracts', label: t('squad.view.contracts') },
            ]}
          />
        </div>
        <div className="squad-table">
          <SortableTable
            key={view}
            rows={team.creatures}
            columns={view === 'attrs' ? attrColumns : view === 'contracts' ? contractColumns : columns}
            rowKey={(c) => c.id}
            initialSort={{ key: 'ovr', dir: -1 }}
            rowClass={(c) => (isInjured(c) ? 'dim' : '')}
          />
        </div>
      </section>
      {(game.fallen?.length ?? 0) > 0 && (
        <section className="panel memorial">
          <h3><UiIcon name="memorial" /> {t('memorial.title')}</h3>
          <ul>
            {[...game.fallen!].reverse().map((f) => (
              <li key={f.id}>
                <SpeciesIcon id={f.speciesId} size="1.2em" /> <b>{f.name}</b>{' '}
                <span className="muted">
                  {t('memorial.line', { species: speciesName(f.speciesId, lang), age: f.age, level: f.level, s: f.season, w: f.matchday, opponent: f.opponent, injury: injuryText(f.injuryId, lang).short })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
