import { useMemo, useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { recallScout, sendScout } from '../../../engine/economy/actions.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { locate, signingBonus } from '../../../engine/economy/market.ts';
import { estimatedValue, knowledgeOf, overallRange, potentialStars } from '../../../engine/economy/scouting.ts';
import { askingWage } from '../../../engine/economy/value.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, ElementDots, Knowledge, Seg, Stars, Gold, Money } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';

type Tab = 'free' | 'stables' | 'scouts';
type View = 'cards' | 'table';
const VIEW_KEY = 'fm.recruitView';
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};
const CARD_SORTS = ['value', 'ovr', 'pot', 'age', 'wage'] as const;

interface Row {
  c: Creature;
  team: string | null;
  k: number;
}

function useColumns(game: GameState, free: boolean): Column<Row>[] {
  const tr = useT();
  const { t, lang } = tr;
  const rep = clubOf(game, game.playerTeamId).reputation;
  const { openSheet } = useGame.getState();
  const cols: Column<Row>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (r) => r.c.name,
      render: (r) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={r.c.speciesId} name={r.c.name} />
          <button className="link" onClick={() => openSheet(r.c.id)}>
            {r.c.name}
          </button>
          {game.scouting.missions.some((m) => m.targetId === r.c.id) && <span title={t('scout.onIt')}>🔍</span>}
        </span>
      ),
    },
    {
      key: 'species',
      label: t('col.species'),
      sort: (r) => speciesName(r.c.speciesId, lang),
      render: (r) => (
        <span className="row" style={{ gap: 4 }}>
          <SpeciesIcon id={r.c.speciesId} /> {speciesName(r.c.speciesId, lang)} <ElementDots speciesId={r.c.speciesId} />
        </span>
      ),
    },
  ];
  if (!free) cols.push({ key: 'team', label: t('col.team'), sort: (r) => r.team ?? '', render: (r) => <span className="muted">{r.team}</span> });
  cols.push(
    { key: 'age', label: t('col.age'), num: true, sort: (r) => r.c.age, render: (r) => r.c.age },
    {
      key: 'ovr',
      label: t('col.ovr'),
      title: t('col.ovr.title'),
      num: true,
      sort: (r) => {
        const o = overallRange(r.c, r.k);
        return (o.low + o.high) / 2;
      },
      render: (r) => {
        const o = overallRange(r.c, r.k);
        return o.low === o.high ? <b>{o.low}</b> : <span className="range-text">{`${o.low}–${o.high}`}</span>;
      },
    },
    {
      key: 'pot',
      label: t('col.potential'),
      title: t('col.potential.title'),
      sort: (r) => potentialStars(r.c, r.k),
      render: (r) => <Stars value={potentialStars(r.c, r.k)} />,
    },
    { key: 'value', label: t('col.value'), title: t('col.value.title'), num: true, sort: (r) => estimatedValue(r.c, r.k), render: (r) => <Money v={estimatedValue(r.c, r.k)} compact /> },
  );
  if (free) cols.push({ key: 'bonus', label: t('col.bonus'), title: t('col.bonus.title'), num: true, sort: (r) => signingBonus(r.c), render: (r) => <Money v={signingBonus(r.c)} compact /> });
  cols.push(
    { key: 'wage', label: t('col.wage'), title: t('col.wage.title'), num: true, sort: (r) => askingWage(r.c, rep), render: (r) => <Money v={askingWage(r.c, rep)} /> },
    {
      key: 'known',
      label: t('col.known'),
      title: t('col.known.title'),
      sort: (r) => r.k,
      render: (r) => (
        <span className="row" style={{ gap: 6 }}>
          <Knowledge k={r.k} />
          <span className="faint mono" style={{ fontSize: '0.786rem' }}>
            {r.k}
          </span>
        </span>
      ),
    },
    {
      key: 'act',
      label: '',
      render: (r) => (
        <button className="btn small" onClick={() => openSheet(r.c.id)}>
          {free ? t('act.sign') : t('act.offer')}
        </button>
      ),
    },
  );
  return cols;
}

/** Compact cards: crest, species, overall, potential, price, knowledge and the action — sorted like the table. */
function RecruitCards({ rows, columns, free, game }: { rows: Row[]; columns: Column<Row>[]; free: boolean; game: GameState }) {
  const tr = useT();
  const { t, lang } = tr;
  const { openSheet } = useGame.getState();
  const rep = clubOf(game, game.playerTeamId).reputation;
  const [by, setBy] = useState<(typeof CARD_SORTS)[number]>('value');
  const [dir, setDir] = useState<1 | -1>(-1);
  const sorted = useMemo(() => {
    const get = columns.find((c) => c.key === by)?.sort;
    if (!get) return rows;
    return rows.slice().sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [rows, columns, by, dir]);
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: '0.857rem' }}>{t('recruit.sortBy')}</span>
        <select className="compact" value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
          {CARD_SORTS.map((k) => (
            <option key={k} value={k}>
              {columns.find((c) => c.key === k)?.label}
            </option>
          ))}
        </select>
        <button className="btn small ghost" onClick={() => setDir((d) => (d === 1 ? -1 : 1))} title={t('recruit.sortDir')}>
          {dir === -1 ? '↓' : '↑'}
        </button>
        <span className="faint" style={{ fontSize: '0.857rem' }}>{t('recruit.count', { n: rows.length })}</span>
      </div>
      <div className="recruit-cards">
        {sorted.map((r) => {
          const o = overallRange(r.c, r.k);
          const scouting = game.scouting.missions.some((m) => m.targetId === r.c.id);
          return (
            <div key={r.c.id} className="recruit-card" onClick={() => openSheet(r.c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openSheet(r.c.id)}>
              <div className="rc-head">
                <Crest speciesId={r.c.speciesId} name={r.c.name} size={30} />
                <div className="rc-who">
                  <b title={r.c.name}>{r.c.name}</b>
                  <span className="faint">
                    <SpeciesIcon id={r.c.speciesId} size="1em" /> {speciesName(r.c.speciesId, lang)} <ElementDots speciesId={r.c.speciesId} /> · {t('sheet.age', { age: r.c.age })}
                  </span>
                </div>
                <span className="rc-ovr" title={t('col.ovr.title')}>
                  {o.low === o.high ? o.low : `${o.low}–${o.high}`}
                </span>
              </div>
              {!free && r.team && <div className="faint rc-team">{r.team}</div>}
              <div className="rc-row">
                <Stars value={potentialStars(r.c, r.k)} title={t('col.potential.title')} />
                <span title={t('col.known.title')} className="row" style={{ gap: 4 }}>
                  {scouting && '🔍'}
                  <Knowledge k={r.k} />
                </span>
                <span className="spacer" />
                <button
                  className="btn small rc-act"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSheet(r.c.id);
                  }}
                >
                  {free ? t('act.sign') : t('act.offer')}
                </button>
              </div>
              <div className="rc-row rc-money">
                <span title={t('col.value.title')}>
                  <Money v={estimatedValue(r.c, r.k)} compact />
                </span>
                {free && (
                  <span className="faint" title={t('col.bonus.title')}>
                    {t('col.bonus')} <Money v={signingBonus(r.c)} compact />
                  </span>
                )}
                <span className="spacer" />
                <span className="faint" title={t('col.wage.title')}>
                  <Money v={askingWage(r.c, rep)} />
                  {t('recruit.perWeek')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Scouts({ game }: { game: GameState }) {
  const tr = useT();
  const { t, money } = tr;
  const s = DEFAULT_CONFIG.economy.scouting;
  const missions = game.scouting.missions;
  return (
    <section className="panel">
      <h3 style={{ marginBottom: 6 }}>{t('scout.title', { n: missions.length, max: s.scouts })}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        <Gold>
          {t('scout.intro', {
          cw: s.creatureWeeks,
          ck: s.creatureKnowledge,
          tw: s.teamWeeks,
          tk: s.teamKnowledge,
          cost: money(DEFAULT_CONFIG.economy.expense.scoutPerWeek),
        })}
        </Gold>
      </p>
      {missions.length === 0 && <div className="faint">{t('scout.none')}</div>}
      <ul className="inbox">
        {missions.map((m) => {
          const name = m.target === 'creature' ? (locate(game, m.targetId)?.creature.name ?? '?') : (game.teams.find((x) => x.id === m.targetId)?.name ?? '?');
          return (
            <li key={m.id} className="msg info row" style={{ gap: 10 }}>
              <span>🔍 {m.target === 'creature' ? t('scout.mission.creature', { name }) : t('scout.mission.team', { name })}</span>
              <span className="muted">{t('scout.weeksLeft', { weeks: tr.weeks(m.weeksLeft) })}</span>
              <span className="spacer" />
              {m.target === 'creature' && (
                <button className="btn small ghost" onClick={() => useGame.getState().openSheet(m.targetId)}>
                  {t('msg.openSheet')}
                </button>
              )}
              <button className="btn small" onClick={() => useGame.getState().update((g) => recallScout(g, m.id))}>
                {t('scout.recall')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RecruitScreen() {
  const tr = useT();
  const { t, money } = tr;
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState<Tab>('free');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [note, setNote] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* per-viewer convenience only */
    }
  };
  const mine = playerTeam(game);
  const others = game.teams.filter((x) => x.id !== game.playerTeamId);

  const freeRows = useMemo<Row[]>(() => game.freeAgents.map((c) => ({ c, team: null, k: knowledgeOf(game, c.id) })), [game]);
  const teamRows = useMemo<Row[]>(
    () =>
      others
        .filter((x) => teamFilter === 'all' || x.id === teamFilter)
        .flatMap((x) => x.creatures.map((c) => ({ c, team: x.name, k: knowledgeOf(game, c.id) }))),
    [game, others, teamFilter],
  );
  const freeCols = useColumns(game, true);
  const teamCols = useColumns(game, false);

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <h2>{t('recruit.title')}</h2>
          <span className="spacer" />
          <span className="muted">
            <Gold>{t('recruit.squad', { n: mine.creatures.length, max: DEFAULT_CONFIG.economy.club.maxSquad, money: money(clubOf(game, game.playerTeamId).balance) })}</Gold>
          </span>
        </div>
        <div className="row wrap" style={{ gap: 12, marginBottom: 10 }} data-tip="recruit">
          <Seg<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'free', label: t('recruit.tab.free') },
              { value: 'stables', label: t('recruit.tab.stables') },
              { value: 'scouts', label: `${t('recruit.tab.scouts')} (${game.scouting.missions.length})` },
            ]}
          />
          {tab === 'stables' && (
            <>
              <select className="compact" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="all">{t('recruit.filter.all')}</option>
                {others.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              {teamFilter !== 'all' && (
                <button
                  className="btn small"
                  onClick={() => {
                    const o = useGame.getState().act((g) => sendScout(g, 'team', teamFilter));
                    if (o) setNote(o.kind === 'sent' ? t('scout.sent', { weeks: tr.weeks(o.weeks) }) : errorText(tr, o.error));
                  }}
                >
                  🔍 {t('act.scoutTeam')}
                </button>
              )}
              {note && <span className="muted" style={{ fontSize: '0.857rem' }}>{note}</span>}
            </>
          )}
          {tab !== 'scouts' && (
            <>
              <span className="spacer" />
              <Seg<View>
                value={view}
                onChange={setView}
                options={[
                  { value: 'cards', label: `▦ ${t('recruit.view.cards')}` },
                  { value: 'table', label: `☰ ${t('recruit.view.table')}` },
                ]}
              />
            </>
          )}
        </div>
        {tab === 'free' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t('recruit.free.intro')}
            </p>
            {view === 'cards' ? (
              <RecruitCards rows={freeRows} columns={freeCols} free game={game} />
            ) : (
              <SortableTable rows={freeRows} columns={freeCols} rowKey={(r) => r.c.id} initialSort={{ key: 'value', dir: -1 }} />
            )}
          </>
        )}
        {tab === 'stables' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t('recruit.stables.intro')}
            </p>
            {view === 'cards' ? (
              <RecruitCards rows={teamRows} columns={teamCols} free={false} game={game} />
            ) : (
              <SortableTable rows={teamRows} columns={teamCols} rowKey={(r) => r.c.id} initialSort={{ key: 'value', dir: -1 }} />
            )}
          </>
        )}
      </section>
      {tab === 'scouts' && <Scouts game={game} />}
    </div>
  );
}
