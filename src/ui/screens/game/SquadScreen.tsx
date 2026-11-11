import { ATTRIBUTE_KEYS } from '../../../data/attributes.ts';
import { bestRole, isInjured, overallRating } from '../../../engine/creature/derived.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { isStarter } from '../../../engine/team/edit.ts';
import { attributeText, injuryText, speciesName } from '../../../engine/text/localize.ts';
import type { Creature } from '../../../engine/model.ts';
import { Attr, Bar, Crest, ElementDots, LevelBadge, Money, Stars, TraitChip } from '../../components/common.tsx';
import { maxLevelOf } from '../../../engine/progression/levels.ts';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { fatigueColor, moraleKey, moraleColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { RoleLabel } from '../../icons/Icon.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';

export function SquadScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const team = playerTeam(game);
  const openSheet = (id: string) => useGame.getState().openSheet(id);
  const waiting = team.creatures.filter((c) => (c.growth?.freePoints ?? 0) > 0);
  const selection = (c: Creature) => (isStarter(team, c.id) ? 0 : team.tactic.bench.includes(c.id) ? 1 : 2);

  const columns: Column<Creature>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={c.speciesId} name={c.name} />
          <button className="link" onClick={() => useGame.getState().openSheet(c.id)}>
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
          <SpeciesIcon id={c.speciesId} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} />
        </span>
      ),
    },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    {
      key: 'level',
      label: t('col.level'),
      title: t('col.level.title'),
      sort: (c) => c.ability,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <LevelBadge c={c} compact />
          {(c.growth?.freePoints ?? 0) > 0 && (
            <button className="point-chip" title={t('points.chip.title')} onClick={() => openSheet(c.id)}>
              +{c.growth!.freePoints}
            </button>
          )}
        </span>
      ),
    },
    { key: 'pot', label: t('col.potential'), title: t('stars.potentialCol'), sort: (c) => c.potential, render: (c) => <Stars n={maxLevelOf(c)} title={t('stars.potential', { n: maxLevelOf(c) })} /> },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    { key: 'best', label: t('col.bestRole'), sort: (c) => bestRole(c), render: (c) => <RoleLabel role={bestRole(c)} /> },
    {
      key: 'sel',
      label: t('col.selection'),
      sort: selection,
      render: (c) => {
        const s = selection(c);
        return <span className={`tag ${s === 0 ? 'accent' : ''}`}>{s === 0 ? t('sel.starter') : s === 1 ? t('sel.bench') : t('sel.reserve')}</span>;
      },
    },
    {
      key: 'status',
      label: t('col.status'),
      sort: (c) => (isInjured(c) ? 1 : 0),
      render: (c) => {
        const inj = c.condition.injuries.find((i) => i.weeksLeft > 0);
        if (inj)
          return (
            <span className="tag bad" title={injuryText(inj.injuryId, lang).short}>
              {t('status.injured', { weeks: tr.weeks(inj.weeksLeft) })}
            </span>
          );
        return c.condition.fatigue >= 50 ? <span className="tag warn">{t('status.tired')}</span> : <span className="faint">{t('status.available')}</span>;
      },
    },
    {
      key: 'fatigue',
      label: t('col.fatigue'),
      num: true,
      sort: (c) => c.condition.fatigue,
      render: (c) => (
        <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          <span style={{ width: 50 }}>
            <Bar value={c.condition.fatigue} max={100} color={fatigueColor(c.condition.fatigue)} thin />
          </span>
          <span className="mono" style={{ width: 22 }}>
            {c.condition.fatigue}
          </span>
        </span>
      ),
    },
    { key: 'morale', label: t('col.morale'), sort: (c) => c.condition.morale, render: (c) => <span title={String(c.condition.morale)} style={{ color: moraleColor(c.condition.morale) }}>{t(moraleKey(c.condition.morale))}</span> },
    { key: 'form', label: t('col.form'), num: true, sort: (c) => c.condition.form, render: (c) => <Attr v={c.condition.form} /> },
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
    ...(['strength', 'toughness', 'speed', 'stamina', 'attack', 'defense', 'magic', 'courage'] as const)
      .filter((k) => ATTRIBUTE_KEYS.includes(k))
      .map(
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
  ];

  return (
    <div className="stack">
      <section className="panel side-home" data-tip="squad">
        <div className="panel-head">
          <h2>
            {t('squad.title')} — {team.name}
          </h2>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.929rem' }}>
          {t('squad.hint')}
        </p>
        {waiting.length > 0 && (
          <div className="points-banner">
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
        <SortableTable rows={team.creatures} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'sel', dir: 1 }} rowClass={(c) => (isInjured(c) ? 'dim' : '')} />
      </section>
      {(game.fallen?.length ?? 0) > 0 && (
        <section className="panel memorial">
          <h3>🕯 {t('memorial.title')}</h3>
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
