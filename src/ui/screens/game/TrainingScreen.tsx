import { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { INTENSITY_IDS, PROGRAM_IDS, type IntensityId, type ProgramId } from '../../../data/config/training.ts';
import { overallRating } from '../../../engine/creature/derived.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { Creature } from '../../../engine/model.ts';
import { coachFactor, lifeStage, planOf, setPlan } from '../../../engine/progression/training.ts';
import { abilityText, attributeText, categoryName, speciesName } from '../../../engine/text/localize.ts';
import { SPECIES } from '../../../data/species.ts';
import { Bar, Crest, ElementDots, LevelBadge, Stars } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { fatigueColor } from '../../format.ts';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { SpeciesIcon } from '../../icons/Icon.tsx';
import { TrainingGuide } from './TrainingGuide.tsx';
import { levelOf, maxLevelOf, unlockLevel } from '../../../engine/progression/levels.ts';

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

/** What an intensity does, with the numbers of the config. */
export function intensityDesc(t: ReturnType<typeof useT>['t'], lang: string, id: IntensityId): string {
  const x = DEFAULT_CONFIG.training.intensity[id];
  const n = (v: number) => (lang === 'fr' ? String(v).replace('.', ',') : String(v));
  const signed = (v: number) => (v < 0 ? `−${n(-v)}` : n(v));
  return t(`int.${id}.desc` as StringKey, { g: n(x.growth), f: signed(x.fatigue), m: signed(x.morale), i: n(Math.round(x.injury * 1000) / 10) });
}

export function IntensitySelect({ value, onChange }: { value: IntensityId; onChange: (p: IntensityId) => void }) {
  const { t, lang } = useT();
  return (
    <select className="compact" value={value} onChange={(e) => onChange(e.target.value as IntensityId)} title={intensityDesc(t, lang, value)}>
      {INTENSITY_IDS.map((p) => (
        <option key={p} value={p} title={intensityDesc(t, lang, p)}>
          {t(`int.${p}` as StringKey)}
        </option>
      ))}
    </select>
  );
}

export function TrainingScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const { update, openSheet, setScreen } = useGame.getState();
  const team = playerTeam(game);
  const [allProgram, setAllProgram] = useState<ProgramId>('role');
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
    {
      key: 'species',
      label: t('col.species'),
      sort: (c) => speciesName(c.speciesId, lang),
      render: (c) => (
        <span className="row" style={{ gap: 4 }}>
          <SpeciesIcon id={c.speciesId} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} />
        </span>
      ),
    },
    { key: 'age', label: t('col.age'), num: true, sort: (c) => c.age, render: (c) => c.age },
    {
      key: 'stage',
      label: t('col.stage'),
      sort: (c) => ['young', 'prime', 'declining'].indexOf(lifeStage(c)),
      render: (c) => <span className={`stage ${lifeStage(c)}`}>{t(STAGE_KEY[lifeStage(c)])}</span>,
    },
    { key: 'ovr', label: t('col.ovr'), title: t('col.ovr.title'), num: true, sort: (c) => overallRating(c), render: (c) => <b>{overallRating(c)}</b> },
    { key: 'pot', label: t('col.potential'), title: t('col.potential.title'), sort: (c) => c.potential, render: (c) => <Stars n={maxLevelOf(c)} title={t('stars.potential', { n: maxLevelOf(c) })} /> },
    {
      key: 'level',
      label: t('col.level'),
      title: t('col.level.title'),
      sort: (c) => c.ability,
      render: (c) => <LevelBadge c={c} />,
    },
    {
      key: 'next',
      label: t('col.nextAbility'),
      title: t('col.nextAbility.title'),
      sort: (c) => nextUnlock(c)?.level ?? 99,
      render: (c) => {
        const n = nextUnlock(c);
        if (!n) return <span className="faint">{t('train.allUnlocked')}</span>;
        const out = n.level > maxLevelOf(c);
        return (
          <span title={t('train.nextTip', { ability: abilityText(n.id, lang).name, n: n.level })} className={out ? 'faint' : ''}>
            {abilityText(n.id, lang).name} <span className="faint">({out ? t('train.beyondMax', { n: n.level }) : t('lvl.short', { n: n.level })})</span>
          </span>
        );
      },
    },
    {
      key: 'progress',
      label: t('col.progress'),
      title: t('col.progress.title'),
      num: true,
      sort: (c) => c.growth?.season ?? 0,
      render: (c) => {
        const n = c.growth?.season ?? 0;
        const moves = (c.growth?.recent ?? [])
          .filter((r) => r.s === game.season)
          .map((r) => `${attributeText(r.k, lang).name} ${r.d > 0 ? '+' : ''}${r.d}`)
          .join(', ');
        return (
          <span className={n > 0 ? 'good-text' : n < 0 ? 'bad-text' : 'faint'} title={moves || undefined}>
            {n > 0 ? t('train.points', { n: `+${n}` }) : n < 0 ? t('train.points', { n }) : '—'}
          </span>
        );
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
        <TrainingGuide />
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

/** The next ability this creature will unlock, and at which level. */
function nextUnlock(c: Creature): { id: string; level: number } | null {
  const lv = levelOf(c);
  const next = (SPECIES[c.speciesId]?.abilities ?? [])
    .map((a) => ({ id: a.id, level: unlockLevel(a.minAbility) }))
    .filter((a) => a.level > lv)
    .sort((a, b) => a.level - b.level)[0];
  return next ?? null;
}
