import { useState } from 'react';
import { FACILITY_IDS, type FacilityId } from '../../../data/config/club.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { facilityLevel, startBuilding, upgradeCost, upgradeWeeks } from '../../../engine/club/facilities.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { Gold } from '../../components/common.tsx';

const ICON: Record<FacilityId, string> = { training: '🏟', infirmary: '✚', stands: '🎟' };

function effectValue(id: FacilityId): number {
  const f = DEFAULT_CONFIG.club.facilities;
  if (id === 'training') return Math.round(f.training.growth * 100);
  if (id === 'infirmary') return Math.round(-f.infirmary.injuryWeeks * 100);
  return Math.round(f.stands.tickets * 100);
}

export function FacilitiesScreen() {
  const tr = useT();
  const { t, money } = tr;
  const game = useGame((s) => s.game)!;
  const [note, setNote] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const fac = game.facilities[game.playerTeamId]!;
  const max = DEFAULT_CONFIG.club.facilities.maxLevel;
  const balance = clubOf(game, game.playerTeamId).balance;
  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ marginBottom: 6 }}>{t('fac.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          <Gold>{t('fac.intro', { upkeep: money(DEFAULT_CONFIG.club.facilities.upkeepPerLevel) })}</Gold>
        </p>
        <div className="facility-grid">
          {FACILITY_IDS.map((id) => {
            const level = facilityLevel(game, game.playerTeamId, id);
            const b = fac[id].building;
            const nextLevel = level + 1;
            const cost = upgradeCost(nextLevel);
            return (
              <div key={id} className="facility">
                <div className="row" style={{ gap: 8 }}>
                  <span className="facility-icon">{ICON[id]}</span>
                  <b className="grow">{t(`fac.${id}` as StringKey)}</b>
                  <span className="tag">{t('fac.level', { n: level, max })}</span>
                </div>
                <div className="facility-levels">
                  {Array.from({ length: max }, (_, i) => (
                    <i key={i} className={i < level ? 'on' : b && i === level ? 'building' : ''} />
                  ))}
                </div>
                <div className="muted" style={{ fontSize: '0.929rem' }}>
                  {t(`fac.${id}.desc` as StringKey, { n: effectValue(id) })}
                </div>
                {b ? (
                  <div className="answer info">{t('fac.building', { n: b.level, weeks: tr.weeks(b.weeksLeft) })}</div>
                ) : level >= max ? (
                  <div className="faint">{t('fac.max')}</div>
                ) : (
                  <button
                    className="btn"
                    disabled={cost > balance}
                    onClick={() => {
                      const o = useGame.getState().act((g) => startBuilding(g, id));
                      if (!o) return;
                      if (o.kind === 'started') setNote({ text: t('fac.started', { weeks: tr.weeks(o.weeks) }), tone: 'good' });
                      else setNote({ text: t(o.error === 'noMoney' ? 'err.noMoney' : 'fac.max'), tone: 'bad' });
                    }}
                  >
                    <Gold>{t('fac.upgrade', { n: nextLevel, cost: money(cost), weeks: tr.weeks(upgradeWeeks(nextLevel)) })}</Gold>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {note && (
          <div className={`answer ${note.tone}`} style={{ marginTop: 10 }}>
            {note.text}
          </div>
        )}
      </section>
    </div>
  );
}
