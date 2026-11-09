import { ATTRIBUTE_KEYS } from '../../../data/attributes.ts';
import { bestRole, isInjured, overallRating } from '../../../engine/creature/derived.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import { isStarter } from '../../../engine/team/edit.ts';
import { attributeText, injuryText, roleText, speciesName } from '../../../engine/text/localize.ts';
import type { Creature } from '../../../engine/model.ts';
import { Attr, Bar, Crest, ElementDots, TraitChip } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { fatigueColor, moraleKey } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

export function SquadScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const team = playerTeam(game);
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
          <ElementDots speciesId={c.speciesId} /> {speciesName(c.speciesId, lang)}
        </span>
      ),
    },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    { key: 'best', label: t('col.bestRole'), sort: (c) => bestRole(c), render: (c) => roleText(bestRole(c), lang).name },
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
    { key: 'morale', label: t('col.morale'), sort: (c) => c.condition.morale, render: (c) => <span title={String(c.condition.morale)}>{t(moraleKey(c.condition.morale))}</span> },
    { key: 'form', label: t('col.form'), num: true, sort: (c) => c.condition.form, render: (c) => <Attr v={c.condition.form} /> },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.contract?.wage ?? 0, render: (c) => tr.money(c.contract?.wage ?? 0) },
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
        <SortableTable rows={team.creatures} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'sel', dir: 1 }} rowClass={(c) => (isInjured(c) ? 'dim' : '')} />
      </section>
    </div>
  );
}
