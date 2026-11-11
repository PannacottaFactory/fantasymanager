/**
 * Creature sheet inside a league game: the creature modal plus what the manager can do with it
 * (contract, sale, release for their own; offer or signing and scouting for the others).
 */
import { useState } from 'react';
import type { AttributeKey } from '../../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { bid, release, releaseCost, renew, sendScout, signFreeAgent, toggleForSale, type MarketError } from '../../../engine/economy/actions.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { isPlayerTeam, locate, renewalDemand, signingBonus } from '../../../engine/economy/market.ts';
import { estimatedValue, knowledgeOf, potentialStars } from '../../../engine/economy/scouting.ts';
import { askingWage, creatureValue } from '../../../engine/economy/value.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature, Team } from '../../../engine/model.ts';
import { toggleFavorite } from '../../../engine/team/edit.ts';
import { Knowledge, Stars, Gold, Money } from '../../components/common.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';
import { CreatureModal } from '../arena/CreatureModal.tsx';
import { planOf, setPlan, spendFreePoint } from '../../../engine/progression/training.ts';
import { IntensitySelect, ProgramSelect } from './TrainingScreen.tsx';

const YEARS = [1, 2, 3];

export function errorText(tr: Translator, e: MarketError): string {
  const eco = DEFAULT_CONFIG.economy.club;
  return tr.t(`err.${e}`, { max: eco.maxSquad, min: eco.minSquad });
}

function YearsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return (
    <label className="field">
      <span>{t('bid.years')}</span>
      <select className="compact" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {YEARS.map((n) => (
          <option key={n} value={n}>
            {t('bid.yearsN', { n })}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoutButton({ game, creature }: { game: GameState; creature: Creature }) {
  const tr = useT();
  const [msg, setMsg] = useState<string | null>(null);
  const onIt = game.scouting.missions.some((m) => m.targetId === creature.id);
  if (knowledgeOf(game, creature.id) >= DEFAULT_CONFIG.economy.scouting.creatureKnowledge) return null;
  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        className="btn small"
        disabled={onIt}
        onClick={() => {
          const o = useGame.getState().act((g) => sendScout(g, 'creature', creature.id));
          if (o) setMsg(o.kind === 'sent' ? tr.t('scout.sent', { weeks: tr.weeks(o.weeks) }) : errorText(tr, o.error));
        }}
      >
        🔍 {onIt ? tr.t('scout.onIt') : tr.t('act.scout')}
      </button>
      {msg && <span className="muted" style={{ fontSize: '0.857rem' }}>{msg}</span>}
    </span>
  );
}

function BidPanel({ game, creature, team }: { game: GameState; creature: Creature; team: Team }) {
  const tr = useT();
  const { t, money } = tr;
  const est = estimatedValue(creature, knowledgeOf(game, creature.id));
  const [fee, setFee] = useState(est);
  const [years, setYears] = useState(2);
  const [answer, setAnswer] = useState<{ text: string; tone: 'good' | 'bad' | 'info'; counter?: number } | null>(null);
  const rep = clubOf(game, game.playerTeamId).reputation;
  const send = (amount: number) => {
    const o = useGame.getState().act((g) => bid(g, creature.id, amount, years));
    if (!o) return;
    if (o.kind === 'accepted') setAnswer({ text: t('bid.accepted', { name: creature.name, fee: money(o.fee) }), tone: 'good' });
    else if (o.kind === 'counter') {
      setFee(o.fee);
      setAnswer({ text: t('bid.counter', { team: team.name, fee: money(o.fee) }), tone: 'info', counter: o.fee });
    } else if (o.kind === 'rejected') setAnswer({ text: t('bid.rejected', { team: team.name }), tone: 'bad' });
    else setAnswer({ text: errorText(tr, o.error), tone: 'bad' });
  };
  return (
    <div className="market-panel">
      <div className="muted" style={{ fontSize: '0.929rem' }}>
        <Gold>{t('bid.asking', { v: money(est) })}</Gold>
      </div>
      <div className="row wrap" style={{ gap: 12, alignItems: 'end' }}>
        <label className="field">
          <span>{t('bid.fee')}</span>
          <input type="number" min={0} step={500} value={fee} onChange={(e) => setFee(Math.max(0, Math.round(Number(e.target.value) || 0)))} style={{ width: 120 }} />
        </label>
        <YearsPicker value={years} onChange={setYears} />
        <button className="btn primary" onClick={() => send(fee)}>
          {t('bid.send')}
        </button>
        {answer?.counter !== undefined && (
          <button className="btn" onClick={() => send(answer.counter!)}>
            <Gold>{t('bid.payCounter', { fee: money(answer.counter) })}</Gold>
          </button>
        )}
      </div>
      <div className="muted" style={{ fontSize: '0.857rem' }}>
        <Gold>{t('bid.wage', { wage: money(askingWage(creature, rep, years)) })}</Gold> · {t('topbar.balance')} <Money v={clubOf(game, game.playerTeamId).balance} />
      </div>
      {answer && <div className={`answer ${answer.tone}`}><Gold>{answer.text}</Gold></div>}
    </div>
  );
}

function SignPanel({ game, creature }: { game: GameState; creature: Creature }) {
  const tr = useT();
  const { t, money } = tr;
  const [years, setYears] = useState(1);
  const [answer, setAnswer] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const rep = clubOf(game, game.playerTeamId).reputation;
  const fee = signingBonus(creature);
  const wage = askingWage(creature, rep, years);
  return (
    <div className="market-panel">
      <div className="row wrap" style={{ gap: 12, alignItems: 'end' }}>
        <YearsPicker value={years} onChange={setYears} />
        <span className="muted" style={{ fontSize: '0.929rem' }}>
          <Gold>{t('sign.body', { fee: money(fee), wage: money(wage) })}</Gold>
        </span>
        <button
          className="btn primary"
          onClick={() => {
            const o = useGame.getState().act((g) => signFreeAgent(g, creature.id, years));
            if (!o) return;
            if (o.kind === 'signed') setAnswer({ text: t('sign.done', { name: creature.name }), tone: 'good' });
            else setAnswer({ text: o.error === 'refused' ? t('sign.refused', { name: creature.name }) : errorText(tr, o.error), tone: 'bad' });
          }}
        >
          <Gold>{t('sign.confirm', { fee: money(fee) })}</Gold>
        </button>
      </div>
      {answer && <div className={`answer ${answer.tone}`}><Gold>{answer.text}</Gold></div>}
    </div>
  );
}

function ContractPanel({ game, creature }: { game: GameState; creature: Creature }) {
  const tr = useT();
  const { t, money } = tr;
  const [years, setYears] = useState(2);
  const [answer, setAnswer] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const c = creature.contract;
  const listed = game.forSale.includes(creature.id);
  const cost = releaseCost(game, creature.id);
  return (
    <div className="market-panel">
      <div className="row wrap" style={{ gap: 10 }}>
        <b>{t('contract.title')}</b>
        {c && <span><Gold>{t('contract.current', { wage: money(c.wage), s: c.untilSeason })}</Gold></span>}
        {c && c.untilSeason <= game.season && <span className="tag bad">{t('contract.expiring')}</span>}
        <span className="muted"><Gold>{t('cr.value', { v: money(creatureValue(creature)) })}</Gold></span>
      </div>
      <div className="row wrap" style={{ gap: 12, alignItems: 'end' }}>
        <YearsPicker value={years} onChange={setYears} />
        <span className="muted" style={{ fontSize: '0.929rem' }}>
          <Gold>{t('contract.renewAsk', { wage: money(renewalDemand(game, creature, years)), n: years })}</Gold>
        </span>
        <button
          className="btn"
          onClick={() => {
            const o = useGame.getState().act((g) => renew(g, creature.id, years));
            if (!o) return;
            if (o.kind === 'renewed') setAnswer({ text: t('contract.renewed', { s: o.untilSeason, wage: money(o.wage) }), tone: 'good' });
            else setAnswer({ text: o.error === 'refused' ? t('contract.refused') : errorText(tr, o.error), tone: 'bad' });
          }}
        >
          {t('contract.renew')}
        </button>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className={`btn small ${listed ? 'active' : ''}`} onClick={() => useGame.getState().update((g) => toggleForSale(g, creature.id))}>
          {listed ? t('sale.unlist') : t('sale.list')}
        </button>
        {listed && <span className="muted" style={{ fontSize: '0.857rem' }}>{t('sale.listed')}</span>}
        <span className="spacer" />
        <button
          className={`btn small ${confirmRelease ? 'danger' : 'ghost'}`}
          onClick={() => {
            if (!confirmRelease) return setConfirmRelease(true);
            const o = useGame.getState().act((g) => release(g, creature.id));
            if (o?.kind === 'released') useGame.getState().openSheet(null);
            else if (o) setAnswer({ text: errorText(tr, o.error), tone: 'bad' });
          }}
        >
          <Gold>{t('release.btn', { cost: money(cost) })}</Gold>
        </button>
      </div>
      {confirmRelease && <div className="answer bad"><Gold>{t('release.confirm', { name: creature.name, cost: money(cost) })}</Gold></div>}
      {answer && <div className={`answer ${answer.tone}`}><Gold>{answer.text}</Gold></div>}
    </div>
  );
}

function RelationsRow({ team, creature }: { team: Team; creature: Creature }) {
  const { t } = useT();
  const r = DEFAULT_CONFIG.club.relations;
  const mates = team.creatures.filter((c) => c.id !== creature.id).map((c) => ({ c, v: creature.relations[c.id] ?? 0 }));
  const friends = mates.filter((x) => x.v >= r.friend).sort((a, b) => b.v - a.v);
  const rivals = mates.filter((x) => x.v <= r.rival).sort((a, b) => a.v - b.v);
  const open = useGame.getState().openSheet;
  const chip = (x: { c: Creature; v: number }, cls: string) => (
    <button key={x.c.id} className={`rel-chip ${cls}`} onClick={() => open(x.c.id)} title={String(x.v)}>
      {x.c.name}
    </button>
  );
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <b>{t('cr.relations')}</b>
      {friends.length === 0 && rivals.length === 0 && <span className="faint">{t('cr.noRelations')}</span>}
      {friends.length > 0 && <span className="muted">{t('cr.friends')} :</span>}
      {friends.map((x) => chip(x, 'friend'))}
      {rivals.length > 0 && <span className="muted">{t('cr.rivals')} :</span>}
      {rivals.map((x) => chip(x, 'rival'))}
    </div>
  );
}

/** Training plan of an own creature, on one line (the ▲ next to the attributes show what it brought). */
function TrainingRow({ game, creature }: { game: GameState; creature: Creature }) {
  const { t } = useT();
  const plan = planOf(game, creature.id);
  const update = useGame.getState().update;
  const gain = creature.growth?.season ?? 0;
  return (
    <div className="row wrap training-row">
      <b>{t('cr.training')}</b>
      <ProgramSelect value={plan.program} onChange={(program) => update((g) => setPlan(g, [creature.id], { program }))} />
      <IntensitySelect value={plan.intensity} onChange={(intensity) => update((g) => setPlan(g, [creature.id], { intensity }))} />
      <span className="spacer" />
      <span className={gain > 0 ? 'good-text' : 'muted'} style={{ fontSize: '0.857rem' }}>
        {t('cr.seasonGain', { n: gain > 0 ? `+${gain}` : gain })}
      </span>
    </div>
  );
}

/** Attribute changes since the season started (own creatures). */
function seasonDeltas(c: Creature): Partial<Record<AttributeKey, number>> | undefined {
  const start = c.growth?.seasonStart;
  if (!start) return undefined;
  const out: Partial<Record<AttributeKey, number>> = {};
  for (const [k, v] of Object.entries(start) as [AttributeKey, number][]) if (c.attributes[k] !== v) out[k] = c.attributes[k] - v;
  return out;
}

function Sheet({ id }: { id: string }) {
  const tr = useT();
  const { t, money } = tr;
  const game = useGame((s) => s.game)!;
  const { openSheet, setPlayerTeam, update } = useGame.getState();
  const kid = game.youth.find((c) => c.id === id);
  if (kid) return <CreatureModal creature={kid} onClose={() => openSheet(null)} showHidden={false} />;
  const loc = locate(game, id);
  if (!loc) return null;
  const { creature, team } = loc;
  const own = isPlayerTeam(game, team);
  const k = knowledgeOf(game, id);
  const favorites = own ? (team!.tactic.favorites?.[id] ?? []) : [];

  const extra = (
    <div className="stack" style={{ gap: 8 }}>
      {!own && (
        <div className="row wrap market-info">
          <span className="tag">{team ? t('cr.stable', { team: team.name }) : t('cr.freeAgent')}</span>
          <span className="row" style={{ gap: 6 }}>
            <Knowledge k={k} /> <span className="muted">{t('cr.knowledge', { k })}</span>
          </span>
          <span><Gold>{t('cr.valueEst', { v: money(estimatedValue(creature, k)) })}</Gold></span>
          <span className="row" style={{ gap: 4 }}>
            {t('cr.potentialEst')} <Stars value={potentialStars(creature, k)} />
          </span>
          <ScoutButton game={game} creature={creature} />
        </div>
      )}
      {!own && k < 100 && <div className="faint" style={{ fontSize: '0.857rem' }}>{t('cr.estimate')}</div>}
    </div>
  );
  const footer = (
    <div className="stack sheet-footer" style={{ gap: 10 }}>
      {own && (
        <div className="market-panel">
          <TrainingRow game={game} creature={creature} />
        </div>
      )}
      {own && <RelationsRow team={team!} creature={creature} />}
      {own && <ContractPanel game={game} creature={creature} />}
      {!own && team && <BidPanel key={id} game={game} creature={creature} team={team} />}
      {!own && !team && <SignPanel key={id} game={game} creature={creature} />}
    </div>
  );

  return (
    <CreatureModal
      creature={creature}
      onClose={() => openSheet(null)}
      showHidden={false}
      knowledge={k}
      deltas={own ? seasonDeltas(creature) : undefined}
      onSpendPoint={own ? (k) => update((g) => spendFreePoint(g, id, k)) : undefined}
      favorites={favorites}
      onToggleFavorite={own ? (a) => setPlayerTeam(toggleFavorite(team!, id, a)) : undefined}
      extra={own ? undefined : extra}
      footer={footer}
    />
  );
}

/** Mounted once in the app: shows the sheet of `useGame().sheet`. */
export function GameSheet() {
  const id = useGame((s) => s.sheet);
  const game = useGame((s) => s.game);
  if (!id || !game) return null;
  return <Sheet id={id} />;
}
