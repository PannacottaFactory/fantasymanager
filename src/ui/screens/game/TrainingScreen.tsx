import { useState } from 'react';
import { INTENSITY_IDS, PROGRAM_IDS, type IntensityId, type ProgramId } from '../../../data/config/training.ts';
import { overallRating } from '../../../engine/creature/derived.ts';
import { potentialStars } from '../../../engine/economy/scouting.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import type { Creature } from '../../../engine/model.ts';
import { coachFactor, dismissYouth, keepYouth, lifeStage, planOf, setPlan, youthWage } from '../../../engine/progression/training.ts';
import { categoryName, speciesName } from '../../../engine/text/localize.ts';
import { clubOf } from '../../../engine/economy/finance.ts';
import { Bar, Crest, ElementDots, Stars } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { fatigueColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';
import { SpeciesIcon } from '../../icons/Icon.tsx';

const STAGE_KEY = { young: 'cr.developing', prime: 'cr.prime', declining: 'cr.declining' } as const;

export function ProgramSelect({ value, onChange }: { value: ProgramId; onChange: (p: ProgramId) => void }) {
  const { t } = useT();
  return (
    <select className="compact" value={value} onChange={(e) => onChange(e.target.value as ProgramId)} title={t(`prog.${value}.desc` as StringKey)}>
      {PROGRAM_IDS.map((p) => (
        <option key={p} value={p} title={t(`prog.${p}.desc` as StringKey)}>
          {t(`prog.${p}` as StringKey)}
        </option>
      ))}
    </select>
  );
}

export function IntensitySelect({ value, onChange }: { value: IntensityId; onChange: (p: IntensityId) => void }) {
  const { t } = useT();
  return (
    <select className="compact" value={value} onChange={(e) => onChange(e.target.value as IntensityId)} title={t(`int.${value}.desc` as StringKey)}>
      {INTENSITY_IDS.map((p) => (
        <option key={p} value={p}>
          {t(`int.${p}` as StringKey)}
        </option>
      ))}
    </select>
  );
}

function Youth({ game }: { game: GameState }) {
  const tr = useT();
  const { t, lang, money } = tr;
  const [error, setError] = useState<string | null>(null);
  const { act, update, openSheet } = useGame.getState();
  const rep = clubOf(game, game.playerTeamId).reputation;
  if (!game.youth.length) return null;
  return (
    <section className="panel youth" data-tip="youth">
      <h3 style={{ marginBottom: 4 }}>🥚 {t('youth.title')}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('youth.intro')}
      </p>
      <div className="youth-grid">
        {game.youth.map((c) => (
          <div key={c.id} className="youth-card">
            <div className="row" style={{ gap: 8 }}>
              <Crest speciesId={c.speciesId} name={c.name} size={28} />
              <div>
                <b>{c.name}</b>
                <div className="muted" style={{ fontSize: '0.857rem' }}>
                  <SpeciesIcon id={c.speciesId} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} /> · {t('col.age')} {c.age}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 10, fontSize: '0.929rem' }}>
              <span>
                {t('col.ovr')} <b>{overallRating(c)}</b>
              </span>
              <span className="row" style={{ gap: 4 }}>
                {t('cr.potentialEst')} <Stars value={potentialStars(c, 100)} />
              </span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="btn small primary"
                onClick={() => {
                  const o = act((g) => keepYouth(g, c.id));
                  if (o?.kind === 'error') setError(errorText(tr, o.error === 'taken' ? 'notFound' : o.error));
                }}
              >
                {t('youth.keep', { wage: money(youthWage(c, rep)) })}
              </button>
              <button className="btn small" onClick={() => update((g) => dismissYouth(g, c.id))}>
                {t('youth.release')}
              </button>
              <span className="spacer" />
              <button className="btn small ghost" onClick={() => openSheet(c.id)}>
                {t('msg.openSheet')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="answer bad">{error}</div>}
    </section>
  );
}

export function TrainingScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const { update, openSheet, setScreen } = useGame.getState();
  const team = playerTeam(game);
  const [allProgram, setAllProgram] = useState<ProgramId>('balanced');
  const [allIntensity, setAllIntensity] = useState<IntensityId>('normal');
  const staff = game.staff[team.id] ?? {};

  const cols: Column<Creature>[] = [
    {
      key: 'name',
      label: t('col.name'),
      sort: (c) => c.name,
      render: (c) => (
        <span className="row" style={{ gap: 6 }}>
          <Crest speciesId={c.speciesId} name={c.name} />
          <button className="link" onClick={() => openSheet(c.id)}>
            {c.name}
          </button>
        </span>
      ),
    },
    { key: 'species', label: t('col.species'), sort: (c) => speciesName(c.speciesId, lang), render: (c) => speciesName(c.speciesId, lang) },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    {
      key: 'stage',
      label: t('col.stage'),
      sort: (c) => ['young', 'prime', 'declining'].indexOf(lifeStage(c)),
      render: (c) => <span className={`stage ${lifeStage(c)}`}>{t(STAGE_KEY[lifeStage(c)])}</span>,
    },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    { key: 'pot', label: t('col.potential'), title: t('col.potential.title'), sort: (c) => c.potential, render: (c) => <Stars value={potentialStars(c, 100)} /> },
    {
      key: 'progress',
      label: t('col.progress'),
      title: t('col.progress.title'),
      num: true,
      sort: (c) => c.growth?.season ?? 0,
      render: (c) => {
        const n = c.growth?.season ?? 0;
        return <span className={n > 0 ? 'good-text' : n < 0 ? 'bad-text' : 'faint'}>{n > 0 ? `+${n}` : n}</span>;
      },
    },
    {
      key: 'fatigue',
      label: t('col.fatigue'),
      num: true,
      sort: (c) => c.condition.fatigue,
      render: (c) => (
        <span style={{ display: 'inline-block', width: 50 }}>
          <Bar value={c.condition.fatigue} max={100} color={fatigueColor(c.condition.fatigue)} thin title={`${c.condition.fatigue} %`} />
        </span>
      ),
    },
    {
      key: 'program',
      label: t('train.program'),
      sort: (c) => planOf(game, c.id).program,
      render: (c) => <ProgramSelect value={planOf(game, c.id).program} onChange={(program) => update((g) => setPlan(g, [c.id], { program }))} />,
    },
    {
      key: 'intensity',
      label: t('train.intensity'),
      sort: (c) => INTENSITY_IDS.indexOf(planOf(game, c.id).intensity),
      render: (c) => <IntensitySelect value={planOf(game, c.id).intensity} onChange={(intensity) => update((g) => setPlan(g, [c.id], { intensity }))} />,
    },
  ];

  return (
    <div className="stack">
      <Youth game={game} />
      <section className="panel">
        <div className="panel-head">
          <h2>{t('train.title')}</h2>
          <span className="spacer" />
          <span className="row wrap" style={{ gap: 8 }}>
            <span className="muted">{t('train.coaches')} :</span>
            {(['physical', 'combat', 'mental'] as const).map((d) => (
              <button key={d} className="tag coach-chip" onClick={() => setScreen('staff')} title={t('staff.effect', { f: tr.dec(coachFactor(game, team.id, d), 2) })}>
                {categoryName(d, lang)} {staff[d] ? `${staff[d]!.quality}/20` : '—'}
              </button>
            ))}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('train.intro')}
        </p>
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          <ProgramSelect value={allProgram} onChange={setAllProgram} />
          <IntensitySelect value={allIntensity} onChange={setAllIntensity} />
          <button
            className="btn small"
            onClick={() =>
              update((g) =>
                setPlan(
                  g,
                  team.creatures.map((c) => c.id),
                  { program: allProgram, intensity: allIntensity },
                ),
              )
            }
          >
            {t('train.applyAll')}
          </button>
        </div>
        <div data-tip="training">
        <SortableTable rows={team.creatures} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'age', dir: 1 }} />
        </div>
      </section>
    </div>
  );
}
