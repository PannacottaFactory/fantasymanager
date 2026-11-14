/** The supporters, shown: tier, mood gauge, what it does to home tickets, the current run. Display only. */
import type { CSSProperties } from 'react';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { fansOf, fansTicketFactor, tierOf } from '../../engine/club/fans.ts';
import type { FansTier, GameState } from '../../engine/league/types.ts';
import { useT } from '../i18n/index.ts';
import { UiIcon } from '../icons/Icon.tsx';

export const FANS_COLOR: Record<FansTier, string> = {
  euphoric: 'var(--gold)',
  enthusiastic: 'var(--good)',
  loyal: 'var(--info)',
  grumbling: 'var(--warn)',
  furious: 'var(--bad)',
};

export function FansPill({ tier }: { tier: FansTier }) {
  const { t } = useT();
  return (
    <span className="mood-pill" style={{ '--mood': FANS_COLOR[tier] } as CSSProperties}>
      {t(`fans.tier.${tier}`)}
    </span>
  );
}

/** Ticket multiplier as a signed percentage (« +12 % », « −8 % »). */
export function ticketDelta(game: GameState): number {
  return Math.round((fansTicketFactor(game) - 1) * 100);
}

export function FansMeter({ game, compact }: { game: GameState; compact?: boolean }) {
  const { t } = useT();
  const f = fansOf(game);
  const tier = tierOf(f.mood);
  const d = ticketDelta(game);
  const trend = f.trend ?? [];
  const pts = trend.length > 1 ? trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${30 - (v / 100) * 28}`).join(' ') : '';
  return (
    <div className="fans-meter" style={{ '--mood': FANS_COLOR[tier] } as CSSProperties} title={t('fans.title.hint')}>
      <div className="fans-top">
        <span className="fans-icon">
          <UiIcon name="fans" size="1.4em" />
        </span>
        <FansPill tier={tier} />
        <span className="spacer" />
        <span className={`fans-tickets ${d > 0 ? 'good-text' : d < 0 ? 'bad-text' : 'muted'}`}>{t('fans.tickets', { d: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}` })}</span>
      </div>
      <div className="fans-bar">
        {pts && !compact && (
          <svg className="board-trend" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
            <polyline points={pts} />
          </svg>
        )}
        <span className="fans-track">
          <i style={{ width: `${f.mood}%` }} />
        </span>
      </div>
      {!compact && (
        <div className="fans-sub muted">
          {f.streak >= DEFAULT_CONFIG.club.fans.streak.from
            ? t('fans.streak.win', { n: f.streak })
            : f.streak <= -DEFAULT_CONFIG.club.fans.streak.from
              ? t('fans.streak.loss', { n: -f.streak })
              : t(`fans.say.${tier}`)}
        </div>
      )}
    </div>
  );
}
