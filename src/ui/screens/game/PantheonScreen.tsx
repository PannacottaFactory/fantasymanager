/**
 * Pantheon: the player's creatures that left the arena for good. Retired legends (snapshot taken at the season change,
 * `GameState.retired`) and the fallen (`GameState.fallen`), with their record, medals, trophies, traits and scars, plus
 * the stable's all-time records among every creature that wore its colours. Reads only what the game stores.
 */
import type { CSSProperties, ReactNode } from 'react';
import { capitalize } from '../../../core/text.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { FallenCreature, RetiredCreature } from '../../../engine/league/types.ts';
import type { CreatureRecord, Scar } from '../../../engine/model.ts';
import { levelOf } from '../../../engine/progression/levels.ts';
import { averageRating, MEDAL_FAMILIES, medalsOf } from '../../../engine/team/record.ts';
import { injuryText, speciesName } from '../../../engine/text/localize.ts';
import { compName, divName } from '../../competitions.ts';
import { Crest, ScarChip, TraitChip } from '../../components/common.tsx';
import { Medal, medalName } from '../../components/CreatureRecord.tsx';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { CompIcon, DivIcon, UiIcon } from '../../icons/Icon.tsx';
import { useT, type Translator } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';

type Status = 'active' | 'retired' | 'fallen';

/** Everyone the records compare: the current squad, the retired, the fallen. */
interface Entry {
  id: string;
  name: string;
  speciesId: string;
  level: number;
  status: Status;
  record?: CreatureRecord;
}

/** Whole number with the language's thousands separator. */
const num = (tr: Translator, n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, tr.lang === 'fr' ? ' ' : ',');

/** How much a career weighs: decides the order of the hall and its greatest legend. */
const legacy = (r?: CreatureRecord) => (r ? r.mvp * 5 + r.kos * 2 + r.matches * 0.3 + r.trophies.length * 12 + averageRating(r) * 2 : 0);

const RECORDS: { key: StringKey; value: (r: CreatureRecord) => number; show: (tr: Translator, v: number) => string }[] = [
  { key: 'pan.rec.matches', value: (r) => r.matches, show: (tr, v) => num(tr, v) },
  { key: 'pan.rec.kos', value: (r) => r.kos, show: (tr, v) => num(tr, v) },
  { key: 'pan.rec.mvp', value: (r) => r.mvp, show: (tr, v) => num(tr, v) },
  { key: 'pan.rec.damage', value: (r) => r.damage, show: (tr, v) => num(tr, v) },
  { key: 'pan.rec.best', value: (r) => r.best, show: (tr, v) => tr.dec(v / 10) },
  { key: 'pan.rec.trophies', value: (r) => r.trophies.length, show: (tr, v) => num(tr, v) },
];

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tile pan-tile">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** The few numbers of a career, then its medals and trophies. */
function Career({ r }: { r?: CreatureRecord }) {
  const tr = useT();
  const { t } = tr;
  if (!r || r.matches === 0) return <p className="faint pan-none">{t('pan.noRecord')}</p>;
  const medals = medalsOf(r);
  const stat = (k: StringKey, v: string | number, cls = '') => (
    <span className={`pan-stat ${cls}`}>
      <b>{v}</b>
      <small>{t(k)}</small>
    </span>
  );
  const won = MEDAL_FAMILIES.filter((f) => medals[f] > 0);
  return (
    <>
      <div className="pan-stats">
        {stat('rec.matches', r.matches)}
        {stat('rec.wins', r.wins)}
        {stat('rec.kos', r.kos)}
        {stat('rec.mvp', r.mvp, r.mvp ? 'gold-text' : '')}
        {stat('rec.avg', tr.dec(averageRating(r)))}
      </div>
      {(won.length > 0 || r.trophies.length > 0) && (
        <div className="pan-honours">
          {won.map((f) => (
            <Medal key={f} family={f} tier={medals[f]} size="sm" title={medalName(tr, f, medals[f])} />
          ))}
          {r.trophies.map((x, i) => (
            <span key={i} className="pan-trophy" title={x.def === 'league' ? t('rec.leagueTitle', { div: divName(t, x.division ?? 0) }) : compName(t, x.tournament)}>
              {x.def === 'league' ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />}
              <small>{t('rec.seasonShort', { s: x.season })}</small>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Marks({ traits, scars }: { traits?: string[]; scars?: Scar[] }) {
  if (!traits?.length && !scars?.length) return null;
  return (
    <div className="pan-marks">
      {(scars ?? []).map((x) => (
        <ScarChip key={x.id} id={x.id} />
      ))}
      {(traits ?? []).map((id) => (
        <TraitChip key={id} id={id} />
      ))}
    </div>
  );
}

function Card({ kind, speciesId, name, level, lines, children, greatest, index }: { kind: 'legend' | 'fallen'; speciesId: string; name: string; level: number; lines: ReactNode[]; children: ReactNode; greatest?: boolean; index: number }) {
  const { t, lang } = useT();
  return (
    <article className={`panel pan-card ${kind} ${greatest ? 'greatest' : ''}`} style={{ '--i': index } as CSSProperties}>
      {greatest && (
        <span className="pan-ribbon">
          <UiIcon name="laurels" size="1.1em" /> {t('pan.greatest')}
        </span>
      )}
      <header className="pan-card-head">
        <span className="pan-portrait">
          <Crest speciesId={speciesId} name={name} size={64} level={level} />
        </span>
        <div className="pan-id">
          <h4 className="pan-name">{name}</h4>
          <span className="muted">
            {speciesName(speciesId, lang)}, {t('pan.level', { level }).toLowerCase()}
          </span>
          {lines.map((l, i) => (
            <small key={i} className="faint">
              {l}
            </small>
          ))}
        </div>
      </header>
      {children}
    </article>
  );
}

const span = (t: Translator['t'], from: number | undefined, to: number) => (from === undefined ? null : from === to ? t('pan.span.one', { s: to }) : t('pan.span', { a: from, b: to }));

export function PantheonScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const me = playerTeam(game);
  const retired: RetiredCreature[] = [...(game.retired ?? [])].sort((a, b) => legacy(b.record) - legacy(a.record));
  const fallen: FallenCreature[] = [...(game.fallen ?? [])].reverse();
  const gone = [...retired.map((c) => c.record), ...fallen.map((c) => c.record)];
  const matches = gone.reduce((s, r) => s + (r?.matches ?? 0), 0);
  const kos = gone.reduce((s, r) => s + (r?.kos ?? 0), 0);

  const everyone: Entry[] = [
    ...me.creatures.map((c) => ({ id: c.id, name: c.name, speciesId: c.speciesId, level: levelOf(c, DEFAULT_CONFIG), status: 'active' as const, record: c.record })),
    ...retired.map((c) => ({ ...c, status: 'retired' as const })),
    ...fallen.map((c) => ({ ...c, status: 'fallen' as const })),
  ];
  const records = RECORDS.map((rec) => {
    let best: Entry | null = null;
    let v = 0;
    for (const e of everyone) {
      const x = e.record ? rec.value(e.record) : 0;
      if (x > v) {
        v = x;
        best = e;
      }
    }
    return { rec, best, v };
  }).filter((x) => x.best);

  const empty = !retired.length && !fallen.length;

  return (
    <div className="stack pantheon-screen">
      <section className="panel pan-hero" data-tip="pantheon">
        <span className="pan-temple">
          <UiIcon name="nav-pantheon" size="2.6em" />
        </span>
        <div className="pan-who">
          <h2>{t('pan.title')}</h2>
          <span className="pan-team">
            <StableCrest team={me} size={20} /> {me.name}
          </span>
          <em className="muted">{t('pan.motto')}</em>
        </div>
        <span className="spacer" />
        <div className="pan-tiles">
          <Tile label={t('pan.legends')} value={retired.length} />
          <Tile label={t('pan.fallen')} value={fallen.length} />
          <Tile label={t('pan.matches')} value={num(tr, matches)} />
          <Tile label={t('pan.kos')} value={num(tr, kos)} />
        </div>
      </section>

      {empty && (
        <section className="panel pan-empty">
          <UiIcon name="laurels" size="2.4em" />
          <h3>{t('pan.empty.title')}</h3>
          <p className="muted">{t('pan.empty.body')}</p>
        </section>
      )}

      {records.length > 0 && (
        <section className="panel">
          <h3>{t('pan.records')}</h3>
          <p className="muted pan-hint">{t('pan.records.hint')}</p>
          <div className="pan-records">
            {records.map(({ rec, best, v }) => (
              <div key={rec.key} className={`tile pan-record ${best!.status}`}>
                <span className="pan-record-top">
                  <span className="pan-record-label">{t(rec.key)}</span>
                  <span className={`tag pan-status ${best!.status}`}>{t(`pan.status.${best!.status}` as StringKey)}</span>
                </span>
                <b className="pan-record-value">{rec.show(tr, v)}</b>
                <span className="pan-record-holder">
                  <Crest speciesId={best!.speciesId} name={best!.name} size={22} level={best!.level} />
                  <span>{best!.name}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!empty && (
        <section className="pan-section">
          <header className="pan-section-head">
            <h3>
              <UiIcon name="laurels" /> {t('pan.hall')}
            </h3>
            <span className="muted">{t('pan.hall.hint')}</span>
          </header>
          {retired.length ? (
            <div className="pan-grid">
              {retired.map((c, i) => (
                <Card
                  key={c.id}
                  kind="legend"
                  index={i}
                  greatest={i === 0 && legacy(c.record) > 0}
                  speciesId={c.speciesId}
                  name={c.name}
                  level={c.level}
                  lines={[t('pan.retiredLine', { age: c.age, s: c.season }), span(t, c.record?.since, c.season)].filter(Boolean)}
                >
                  <Career r={c.record} />
                  <Marks traits={c.traits} scars={c.scars} />
                </Card>
              ))}
            </div>
          ) : (
            <p className="muted">{t('pan.hall.empty')}</p>
          )}
        </section>
      )}

      {fallen.length > 0 && (
        <section className="pan-section pan-memorial">
          <header className="pan-section-head">
            <h3>
              <UiIcon name="memorial" /> {t('pan.memorial')}
            </h3>
            <span className="muted">{t('pan.memorial.hint')}</span>
          </header>
          <div className="pan-grid">
            {fallen.map((c, i) => (
              <Card
                key={c.id}
                kind="fallen"
                index={i}
                speciesId={c.speciesId}
                name={c.name}
                level={c.level}
                lines={[
                  t('pan.fallLine', { s: c.season, w: c.matchday, opponent: c.opponent }),
                  <span key="inj" className="pan-cause">
                    <UiIcon name="injury" /> {capitalize(injuryText(c.injuryId, lang).short)}, {t('pan.age', { age: c.age }).toLowerCase()}
                  </span>,
                ]}
              >
                <Career r={c.record} />
                <Marks traits={c.traits} scars={c.scars} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
