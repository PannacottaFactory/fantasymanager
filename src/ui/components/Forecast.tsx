/**
 * The assistant's forecast before a match (band + split gauge) and, after it, what the result meant against it
 * (exploit / slip). Display only: `engine/report/forecast.ts` does the sums.
 */
import type { Forecast, Upset } from '../../engine/report/forecast.ts';
import { upsetOf } from '../../engine/report/forecast.ts';
import { useT } from '../i18n/index.ts';

const pctOf = (p: number) => Math.round(p * 100);

export function ForecastGauge({ f }: { f: Forecast }) {
  const { t } = useT();
  const p = pctOf(f.win);
  const title = `${t('fc.hint')}${f.unsure ? ` ${t('fc.unsure')}` : ''}`;
  return (
    <div className={`forecast fc-${f.band}`} title={title}>
      <span className="fc-head">
        <span className="fc-label">{t('fc.title')}</span>
        <b className="fc-band">{t(`fc.band.${f.band}`)}</b>
        <span className="fc-chance">
          {f.unsure && '~ '}
          {t('fc.chance', { p })}
        </span>
      </span>
      <span className="fc-bar" aria-hidden="true">
        <i className="fc-mine" style={{ width: `${p}%` }} />
        <i className="fc-theirs" />
      </span>
    </div>
  );
}

export function UpsetStamp({ won, forecast, upset }: { won: boolean; forecast: number | undefined; upset?: Upset | null }) {
  const { t } = useT();
  const u = upset ?? upsetOf(won, forecast);
  if (!u || forecast === undefined) return null;
  return (
    <span className={`upset-stamp up-${u}`} title={t('up.detail', { p: pctOf(forecast) })}>
      <b>{t(`up.${u}`)}</b>
      <small>{t('up.detail', { p: pctOf(forecast) })}</small>
    </span>
  );
}
