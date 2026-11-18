/**
 * Facilities: a key-figures strip (upkeep, levels built, works, board), then one card per facility — emblem in its
 * colour, the level ladder 0 → max, what it does now against the next level, where the stable stands in its league,
 * and the works (progress bar) or the way to build the next level.
 */
import { useState } from 'react';
import { FACILITY_IDS, type FacilityId } from '../../../data/config/club.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { boardMood } from '../../../engine/club/board.ts';
import { facilitiesUpkeep, facilityLevel, playerUpgradeCost, startBuilding, upgradeCost, upgradeWeeks } from '../../../engine/club/facilities.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { Gold, Money } from '../../components/common.tsx';
import { UiIcon } from '../../icons/Icon.tsx';

const F = DEFAULT_CONFIG.club.facilities;

/** What a facility does at a given level: label key and the value, worded. */
function effectsAt(id: FacilityId, level: number): { label: StringKey; value: string; zero: boolean }[] {
  const pct = (v: number, sign: '+' | '−') => (v === 0 ? '0 %' : `${sign}${Math.round(v)} %`);
  if (id === 'training')
    return [
      { label: 'fac.eff.xp', value: pct(level * F.training.growth * 100, '+'), zero: level === 0 },
      { label: 'fac.eff.session', value: `${Math.round((DEFAULT_CONFIG.training.sessions.extraChance[level] ?? 0) * 100)} %`, zero: level === 0 },
    ];
  if (id === 'infirmary')
    return [
      { label: 'fac.eff.injury', value: pct(-level * F.infirmary.injuryWeeks * 100, '−'), zero: level === 0 },
      { label: 'fac.eff.medical', value: pct(-level * F.infirmary.medicalCost * 100, '−'), zero: level === 0 },
    ];
  return [{ label: 'fac.eff.tickets', value: pct(level * F.stands.tickets * 100, '+'), zero: level === 0 }];
}

/** The stable's place among its league for one facility: average level and rank (1 = best equipped). */
function leagueStanding(game: GameState, id: FacilityId) {
  const ids = game.divisions?.[divisionOf(game, game.playerTeamId)] ?? [game.playerTeamId];
  const levels = ids.map((t) => facilityLevel(game, t, id));
  const mine = facilityLevel(game, game.playerTeamId, id);
  return {
    avg: levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length),
    rank: 1 + levels.filter((l) => l > mine).length,
    size: levels.length,
    // Every stable at the same level: no rank to speak of (it used to say « 1st of 10 » with nothing built).
    level: levels.every((l) => l === mine),
  };
}

function FacilityCard({ game, id, onNote }: { game: GameState; id: FacilityId; onNote: (n: { text: string; tone: 'good' | 'bad' }) => void }) {
  const tr = useT();
  const { t, money } = tr;
  const level = facilityLevel(game, game.playerTeamId, id);
  const b = game.facilities[game.playerTeamId]![id].building;
  const max = F.maxLevel;
  const next = level + 1;
  const base = upgradeCost(next);
  const cost = level < max ? playerUpgradeCost(game, next) : null;
  const balance = clubOf(game, game.playerTeamId).balance;
  const now = effectsAt(id, level);
  const after = level < max ? effectsAt(id, next) : null;
  const st = leagueStanding(game, id);
  const build = () => {
    const o = useGame.getState().act((g) => startBuilding(g, id));
    if (!o) return;
    if (o.kind === 'started') onNote({ text: t('fac.started', { weeks: tr.weeks(o.weeks) }), tone: 'good' });
    else onNote({ text: t(o.error === 'noMoney' ? 'err.noMoney' : o.error === 'board' ? 'fac.frozen' : 'fac.max'), tone: 'bad' });
  };
  return (
    <article className={`fac-card fac-${id} ${b ? 'is-building' : ''} ${level >= max ? 'is-max' : ''}`}>
      <header className="fac-banner">
        <span className="fac-watermark" aria-hidden="true">
          <UiIcon name={`fac-${id}`} size="7em" />
        </span>
        <span className="fac-emblem" aria-hidden="true">
          <UiIcon name={`fac-${id}`} size="2.4em" />
        </span>
        <div className="fac-title">
          <h3>{t(`fac.${id}` as StringKey)}</h3>
          <small>{t(`fac.tagline.${id}` as StringKey)}</small>
        </div>
        <span className="fac-level" title={t('fac.level', { n: level, max })}>
          <b>{level}</b>
          <small>/{max}</small>
        </span>
      </header>

      <ol className="fac-ladder" aria-label={t('fac.level', { n: level, max })}>
        {Array.from({ length: max + 1 }, (_, l) => (
          <li key={l} className={l <= level ? 'done' : b && l === b.level ? 'building' : l === next ? 'next' : ''}>
            <i />
            <span>{l === 0 ? t('fac.base') : t('fac.lvlShort', { n: l })}</span>
          </li>
        ))}
      </ol>

      <div className="fac-effects">
        <span />
        <span className="fac-col-head">{t('fac.now')}</span>
        <span className="fac-col-head">{after ? t('fac.lvlShort', { n: next }) : ''}</span>
        {now.map((e, i) => (
          <div key={e.label} className="fac-effect">
            <span className="fac-eff-label">{t(e.label)}</span>
            <b className={e.zero ? 'faint' : ''}>{e.value}</b>
            {after ? (
              <span className="fac-eff-next">
                <span aria-hidden="true">→</span> <b>{after[i]!.value}</b>
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      <div className="fac-rivals">
        <span>{st.level ? t('fac.rivals.level', { avg: tr.dec(st.avg) }) : t('fac.rivals', { avg: tr.dec(st.avg), rank: tr.ordinal(st.rank), n: st.size })}</span>
        <span className="fac-rivals-bar" aria-hidden="true">
          <i style={{ width: `${(st.avg / max) * 100}%` }} className="avg" />
          <i style={{ width: `${(level / max) * 100}%` }} className="mine" />
        </span>
      </div>

      <footer className="fac-foot">
        {b ? (
          <div className="fac-works">
            <div className="fac-works-text">
              <UiIcon name="nav-facilities" />
              <span>{t('fac.building', { n: b.level, weeks: tr.weeks(b.weeksLeft) })}</span>
            </div>
            <span className="fac-progress" aria-hidden="true">
              <i style={{ width: `${Math.round((1 - b.weeksLeft / Math.max(1, upgradeWeeks(b.level))) * 100)}%` }} />
            </span>
          </div>
        ) : level >= max ? (
          <div className="fac-max">{t('fac.max')}</div>
        ) : cost === null ? (
          <div className="answer bad">{t('fac.frozen')}</div>
        ) : (
          <>
            <button className="btn primary fac-build" disabled={cost > balance} onClick={build}>
              {t('fac.build', { n: next })}
            </button>
            <span className="fac-price">
              <Money v={cost} />
              {cost < base && <span className="good-text" title={t('fac.boardDiscount', { pct: Math.round((1 - cost / base) * 100) })}> −{Math.round((1 - cost / base) * 100)} %</span>}
              <span className="faint">
                {' '}
                · {tr.weeks(upgradeWeeks(next))} · <Gold>{t('fac.upkeepAt', { v: money(F.upkeepPerLevel) })}</Gold>
              </span>
              {cost > balance && <span className="bad-text"> · <Gold>{t('fac.missing', { v: money(cost - balance) })}</Gold></span>}
            </span>
          </>
        )}
      </footer>
    </article>
  );
}

export function FacilitiesScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const [note, setNote] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const fac = game.facilities[game.playerTeamId]!;
  const built = FACILITY_IDS.reduce((s, id) => s + facilityLevel(game, game.playerTeamId, id), 0);
  const works = FACILITY_IDS.filter((id) => fac[id].building).length;
  const mood = boardMood(game);
  const boardText =
    mood === 'angry' ? t('fac.kpi.board.frozen') : mood === 'delighted' ? t('fac.kpi.board.discount', { pct: Math.round((1 - DEFAULT_CONFIG.club.board.worksDelighted) * 100) }) : t('fac.kpi.board.normal');
  return (
    <div className="stack">
      <section className="panel fac-screen">
        <div className="panel-head">
          <h2>{t('fac.title')}</h2>
        </div>
        <div className="kpis fac-kpis">
          <div className="kpi">
            <span className="kpi-label">{t('fac.kpi.levels')}</span>
            <b className="kpi-value">
              {built}
              <small>/{FACILITY_IDS.length * F.maxLevel}</small>
            </b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('fac.kpi.upkeep')}</span>
            <b className="kpi-value gold-text">
              <Money v={facilitiesUpkeep(game, game.playerTeamId)} />
            </b>
            <span className="kpi-sub">
              <Gold>{t('fac.kpi.upkeepSub', { v: tr.money(F.upkeepPerLevel) })}</Gold>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('fac.kpi.works')}</span>
            <b className="kpi-value">{works ? t('fac.kpi.worksN', { n: works }) : t('fac.kpi.worksNone')}</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('fac.kpi.board')}</span>
            <b className={`kpi-value ${mood === 'angry' ? 'bad-text' : mood === 'delighted' ? 'good-text' : ''}`}>{boardText}</b>
          </div>
        </div>
        {note && <div className={`answer ${note.tone}`}>{note.text}</div>}
        <div className="fac-grid">
          {FACILITY_IDS.map((id) => (
            <FacilityCard key={id} game={game} id={id} onNote={setNote} />
          ))}
        </div>
        <p className="faint fac-intro">
          <Gold>{t('fac.intro', { upkeep: tr.money(F.upkeepPerLevel) })}</Gold>
        </p>
      </section>
    </div>
  );
}

