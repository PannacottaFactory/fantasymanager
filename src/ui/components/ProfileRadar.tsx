/**
 * Combat profile of a creature as a six-axis radar (creature sheet header): power, speed, defence, magic, mind and
 * endurance, each the average of a few attributes (1–20). An optional reference (the league's average starter) is drawn
 * dashed behind. Display only; estimated creatures pass the middle of their ranges. The same axes are the profile
 * columns of the Squad and Tactics tables (`useAxisColumns`).
 */
import type { AttributeKey } from '../../data/attributes.ts';
import { MENTAL_ATTRIBUTES } from '../../data/attributes.ts';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { attributeText } from '../../engine/text/localize.ts';
import { Attr } from './common.tsx';
import type { Column } from './SortableTable.tsx';

type Values = Record<AttributeKey, number>;

export const RADAR_AXES: { key: string; attrs: readonly AttributeKey[] }[] = [
  { key: 'power', attrs: ['strength', 'attack', 'technique'] },
  { key: 'speed', attrs: ['speed', 'agility', 'accuracy'] },
  { key: 'defence', attrs: ['defense', 'toughness'] },
  { key: 'magic', attrs: ['magic', 'focus'] },
  { key: 'mind', attrs: MENTAL_ATTRIBUTES },
  { key: 'endurance', attrs: ['stamina', 'recovery'] },
];

export const axisValue = (v: Values, attrs: readonly AttributeKey[]) => attrs.reduce((s, k) => s + v[k], 0) / attrs.length;

const R = 54;
const point = (i: number, r: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_AXES.length;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
};
const polygon = (vals: number[]) => vals.map((v, i) => point(i, (R * Math.max(0, Math.min(20, v))) / 20).map((x) => x.toFixed(1)).join(',')).join(' ');

export function ProfileRadar({ values, reference }: { values: Values; reference?: Values }) {
  const { t, dec } = useT();
  const mine = RADAR_AXES.map((a) => axisValue(values, a.attrs));
  const ref = reference ? RADAR_AXES.map((a) => axisValue(reference, a.attrs)) : null;
  const label = (k: string) => t(`radar.${k}` as StringKey);
  const summary = RADAR_AXES.map((a, i) => `${label(a.key)} ${dec(mine[i]!)}`).join(', ');
  return (
    <figure className="radar" title={t('radar.title')}>
      <svg viewBox="-112 -78 224 154" role="img" aria-label={`${t('radar.title')} : ${summary}`}>
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon key={f} className="radar-grid" points={polygon(RADAR_AXES.map(() => 20 * f))} />
        ))}
        {RADAR_AXES.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} className="radar-grid" x1={0} y1={0} x2={x} y2={y} />;
        })}
        {ref && <polygon className="radar-ref" points={polygon(ref)} />}
        <polygon className="radar-me" points={polygon(mine)} />
        {RADAR_AXES.map((a, i) => {
          const [x, y] = point(i, R + 12);
          return (
            <text key={a.key} className="radar-label" fontSize={10} x={x} y={y + 3} textAnchor={Math.abs(x) < 4 ? 'middle' : x > 0 ? 'start' : 'end'}>
              {label(a.key)}
            </text>
          );
        })}
      </svg>
      {ref && (
        <figcaption className="radar-key">
          <span>
            <i className="me" /> {t('radar.self')}
          </span>
          <span>
            <i className="ref" /> {t('radar.league')}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** The six profile axes as table columns (Squad, Tactics): one coloured box each, the attributes behind in the tooltip. */
export function useAxisColumns<T extends { attributes: Values }>(): Column<T>[] {
  const { t, lang } = useT();
  return RADAR_AXES.map((a, i) => ({
    key: `axis-${a.key}`,
    label: t(`radar.short.${a.key}` as StringKey),
    title: `${t(`radar.${a.key}` as StringKey)} : ${a.attrs.map((k) => attributeText(k, lang).name).join(', ')}`,
    num: true,
    className: i === 0 ? 'col-attr col-cat' : 'col-attr',
    sort: (c: T) => axisValue(c.attributes, a.attrs),
    render: (c: T) => <Attr v={Math.round(axisValue(c.attributes, a.attrs))} cell />,
  }));
}
