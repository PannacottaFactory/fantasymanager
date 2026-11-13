import { useMemo, useState, type CSSProperties } from 'react';
import { ELEMENTS } from '../../../data/elements.ts';
import { SPECIES } from '../../../data/species.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { recallScout, sendScout } from '../../../engine/economy/actions.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { locate, signingBonus, transferOffers } from '../../../engine/economy/market.ts';
import { estimatedBestRole, estimatedValue, knowledgeOf, overallRange, potentialLevel } from '../../../engine/economy/scouting.ts';
import { askingWage } from '../../../engine/economy/value.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, ElementDots, Knowledge, PotentialStars, Seg, Gold, Money } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';
import { RoleLabel, SpeciesIcon } from '../../icons/Icon.tsx';
import { UiIcon } from '../../icons/Icon.tsx';

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
const CARD_SORTS = ['value', 'ovr', 'pot', 'role', 'age', 'wage'] as const;

interface Row {
  c: Creature;
  team: string | null;
  k: number;
}

/** A free agent that arrived with this week's market. */
const isNew = (game: GameState, r: Row) => !r.team && !!game.freeAgentsBefore && !game.freeAgentsBefore.includes(r.c.id);

function NewBadge() {
  const { t } = useT();
  return <span className="new-badge">{t('recruit.new')}</span>;
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
          {game.scouting.missions.some((m) => m.targetId === r.c.id) && <span title={t('scout.onIt')}><UiIcon name="scout" /></span>}
          {isNew(game, r) && <NewBadge />}
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
    { key: 'role', label: t('col.bestRole'), sort: (r) => estimatedBestRole(r.c, r.k), render: (r) => <RoleLabel role={estimatedBestRole(r.c, r.k)} /> },
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
      sort: (r) => potentialLevel(r.c, r.k),
      render: (r) => <PotentialStars c={r.c} k={r.k} />,
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
/** Colour of a species' first / second element (card art). */
function colorOf(speciesId: string, i: 0 | 1): string {
  const els = SPECIES[speciesId]?.elements ?? [];
  const e = els[i] ?? els[0];
  return e ? ELEMENTS[e].color : '#8a7a62';
}

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
            <div
              key={r.c.id}
              className="recruit-card"
              style={{ '--c1': colorOf(r.c.speciesId, 0), '--c2': colorOf(r.c.speciesId, 1) } as CSSProperties}
              onClick={() => openSheet(r.c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openSheet(r.c.id)}
            >
              {isNew(game, r) && <NewBadge />}
              <div className="rc-top">
                <span className="rc-medal">
                  <SpeciesIcon id={r.c.speciesId} size="1.9em" />
                </span>
                <div className="rc-who">
                  <b title={r.c.name}>{r.c.name}</b>
                  <span className="rc-species">
                    <span className="ellipsis">{speciesName(r.c.speciesId, lang)}</span>
                    <span className="rc-dots">
                      <ElementDots speciesId={r.c.speciesId} />
                    </span>
                    <span className="rc-age">· {t('sheet.age', { age: r.c.age })}</span>
                  </span>
                  {!free && r.team && <span className="rc-team">{r.team}</span>}
                </div>
                <span className="rc-ovr" title={t('col.ovr.title')}>
                  <b>{o.low === o.high ? o.low : `${o.low}–${o.high}`}</b>
                  <small>{t('col.ovr')}</small>
                </span>
              </div>
              <div className="rc-mid">
                <span className="rc-role" title={t('col.bestRole')}>
                  <RoleLabel role={estimatedBestRole(r.c, r.k)} />
                </span>
                <PotentialStars c={r.c} k={r.k} />
                <span className="rc-known" title={t('col.known.title')}>
                  {scouting && <UiIcon name="scout" />}
                  <small>{t('col.known')}</small>
                  <Knowledge k={r.k} />
                </span>
              </div>
              <div className={`rc-stats ${free ? 'three' : ''}`}>
                <span title={t('col.value.title')}>
                  <small>{t('col.value')}</small>
                  <b><Money v={estimatedValue(r.c, r.k)} compact /></b>
                </span>
                {free && (
                  <span title={t('col.bonus.title')}>
                    <small>{t('col.bonus')}</small>
                    <b><Money v={signingBonus(r.c)} compact /></b>
                  </span>
                )}
                <span title={t('col.wage.title')}>
                  <small>{t('col.wage')}{t('recruit.perWeek')}</small>
                  <b><Money v={askingWage(r.c, rep)} compact /></b>
                </span>
              </div>
              <button
                className="btn rc-act"
                onClick={(e) => {
                  e.stopPropagation();
                  openSheet(r.c.id);
                }}
              >
                {free ? t('act.sign') : t('act.offer')}
              </button>
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
              <span><UiIcon name="scout" /> {m.target === 'creature' ? t('scout.mission.creature', { name }) : t('scout.mission.team', { name })}</span>
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
  const [teamFilter, setTeamFilter] = useState<string>('picks');
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
  // By default a short selection of offers; one stable (or all of them) on demand.
  const teamRows = useMemo<Row[]>(
    () =>
      teamFilter === 'picks'
        ? transferOffers(game).map(({ creature, team }) => ({ c: creature, team: team.name, k: knowledgeOf(game, creature.id) }))
        : others
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
                <option value="picks">{t('recruit.filter.picks')}</option>
                <option value="all">{t('recruit.filter.all')}</option>
                {others.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              {teamFilter !== 'all' && teamFilter !== 'picks' && (
                <button
                  className="btn small"
                  onClick={() => {
                    const o = useGame.getState().act((g) => sendScout(g, 'team', teamFilter));
                    if (o) setNote(o.kind === 'sent' ? t('scout.sent', { weeks: tr.weeks(o.weeks) }) : errorText(tr, o.error));
                  }}
                >
                  <UiIcon name="scout" /> {t('act.scoutTeam')}
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
              {teamFilter === 'picks' ? t('recruit.stables.picks') : t('recruit.stables.intro')}
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
