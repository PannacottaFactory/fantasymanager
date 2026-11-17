/**
 * Recruitment › Sell: the player's creatures in one table, listed for sale or not in one click, with the offers
 * received from other stables (accept / decline) beside each creature.
 */
import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { overallRating } from '../../../engine/creature/derived.ts';
import { answerOffer, toggleForSale } from '../../../engine/economy/actions.ts';
import { creatureValue } from '../../../engine/economy/value.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, ElementDots, Gold, LevelBadge, Money } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import { SpeciesIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';
import { levelOf } from '../../../engine/progression/levels.ts';
import { errorText } from './CreatureSheet.tsx';

export function SaleList({ game }: { game: GameState }) {
  const tr = useT();
  const { t, lang, money } = tr;
  const [error, setError] = useState<string | null>(null);
  const team = playerTeam(game);
  const { act, update, openSheet } = useGame.getState();
  const listed = (c: Creature) => game.forSale.includes(c.id);
  const offersOf = (c: Creature) => game.offers.filter((o) => o.creatureId === c.id).sort((a, b) => b.fee - a.fee);
  const minSquad = DEFAULT_CONFIG.economy.club.minSquad;

  const columns: Column<Creature>[] = [
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
              <SpeciesIcon id={c.speciesId} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} />
            </small>
          </span>
        </span>
      ),
    },
    { key: 'level', label: t('col.level'), sort: (c) => c.ability, render: (c) => <LevelBadge c={c} compact bare /> },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    { key: 'value', label: t('col.value'), num: true, sort: (c) => creatureValue(c), render: (c) => <Money v={creatureValue(c)} /> },
    { key: 'wage', label: t('col.wage'), num: true, sort: (c) => c.contract?.wage ?? 0, render: (c) => <Money v={c.contract?.wage ?? 0} /> },
    {
      key: 'contract',
      label: t('col.contract'),
      sort: (c) => c.contract?.untilSeason ?? 0,
      render: (c) => <span className={c.contract && c.contract.untilSeason <= game.season ? 'bad-text' : ''}>{c.contract ? t('contract.until', { s: c.contract.untilSeason }) : '—'}</span>,
    },
    {
      key: 'offers',
      label: t('sale.col.offers'),
      sort: (c) => offersOf(c)[0]?.fee ?? 0,
      render: (c) => {
        const offers = offersOf(c);
        if (!offers.length) return <span className="faint">—</span>;
        return (
          <span className="sale-offers">
            {offers.map((o) => (
              <span key={o.id} className="sale-offer">
                <span className="muted ellipsis" title={game.teams.find((x) => x.id === o.fromTeamId)?.name}>
                  {game.teams.find((x) => x.id === o.fromTeamId)?.name}
                </span>
                <button
                  className="btn small primary"
                  onClick={() => {
                    const r = act((g) => answerOffer(g, o.id, true));
                    setError(r?.kind === 'error' ? errorText(tr, r.error) : null);
                  }}
                >
                  <Gold>{t('offer.accept', { fee: money(o.fee) })}</Gold>
                </button>
                <button className="btn small ghost" onClick={() => act((g) => answerOffer(g, o.id, false))}>
                  {t('offer.decline')}
                </button>
              </span>
            ))}
          </span>
        );
      },
    },
    {
      key: 'sale',
      label: t('sale.col.status'),
      sort: (c) => (listed(c) ? 1 : 0),
      render: (c) => (
        <button className={`btn small ${listed(c) ? 'active' : ''}`} onClick={() => update((g) => toggleForSale(g, c.id))}>
          {listed(c) ? t('sale.unlist') : t('sale.list')}
        </button>
      ),
    },
  ];

  const nListed = team.creatures.filter(listed).length;
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('sale.intro', { n: nListed, offers: game.offers.length })}
        {team.creatures.length <= minSquad && <span className="bad-text"> {t('sale.squadMin', { n: minSquad })}</span>}
      </p>
      {error && <div className="answer bad"><Gold>{error}</Gold></div>}
      <SortableTable rows={team.creatures} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'value', dir: -1 }} rowClass={(c) => (listed(c) ? 'sale-listed' : '')} />
    </>
  );
}
