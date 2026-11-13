import { useState } from 'react';
import { PROGRAM_IDS, type ProgramId } from '../../../data/config/training.ts';
import { overallRating } from '../../../engine/creature/derived.ts';
import { playerTeam } from '../../../engine/league/season.ts';
import type { Creature } from '../../../engine/model.ts';
import { jackpotChance } from '../../../engine/progression/sessions.ts';
import { coachFactor, lifeStage, programCategory, setPlan } from '../../../engine/progression/training.ts';
import { attributeText, categoryName, speciesName } from '../../../engine/text/localize.ts';
import { Crest, ElementDots, LevelBadge, StageMark, Stars } from '../../components/common.tsx';
import { SortableTable, type Column } from '../../components/SortableTable.tsx';
import { useT } from '../../i18n/index.ts';
import type { StringKey } from '../../i18n/strings.ts';
import { useGame } from '../../store/gameStore.ts';
import { SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { TrainingGuide } from './TrainingGuide.tsx';
import { TrainingSession } from './TrainingSession.tsx';
import { maxLevelOf } from '../../../engine/progression/levels.ts';

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

/** Training: the sessions on top, then each creature's program (which attributes its level-ups and sessions raise). */
export function TrainingScreen() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game)!;
  const { update, openSheet, setScreen } = useGame.getState();
  const team = playerTeam(game);
  const [allProgram, setAllProgram] = useState<ProgramId>('role');
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
    {
      key: 'stage',
      label: t('col.stageShort'),
      title: t('col.stage.title'),
      sort: (c) => ['young', 'prime', 'declining'].indexOf(lifeStage(c)),
      render: (c) => <StageMark c={c} />,
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
      key: 'program',
      label: t('train.program'),
      sort: (c) => programCategory(game, c),
      render: (c) => <ProgramSelect value={programCategory(game, c)} onChange={(program) => update((g) => setPlan(g, [c.id], { program }))} />,
    },
  ];

  return (
    <div className="stack">
      <TrainingSession />
      <section className="panel">
        <div className="panel-head">
          <h2>{t('train.title')}</h2>
          <span className="spacer" />
          <span className="row wrap" style={{ gap: 8 }}>
            <span className="muted">{t('train.coaches')} :</span>
            {(['physical', 'combat', 'mental'] as const).map((d) => (
              <button
                key={d}
                className="tag coach-chip"
                onClick={() => setScreen('staff')}
                title={t('staff.effectFull', { xp: tr.dec(coachFactor(game, team.id, d), 2), p: Math.round(jackpotChance(game, team.id, d) * 100) })}
              >
                <UiIcon name={`dom-${d}`} /> {categoryName(d, lang)} {staff[d] ? `${staff[d]!.quality}/20` : '—'}
              </button>
            ))}
          </span>
        </div>
        <TrainingGuide />
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          <select className="compact" value={allProgram} onChange={(e) => setAllProgram(e.target.value as ProgramId)}>
            <option value="role">{t('prog.byRole')}</option>
            {PROGRAM_IDS.map((p) => (
              <option key={p} value={p}>
                {t(`prog.${p}` as StringKey)}
              </option>
            ))}
          </select>
          <button className="btn small" onClick={() => update((g) => setPlan(g, team.creatures.map((c) => c.id), { program: allProgram }))}>
            {t('train.applyAll')}
          </button>
        </div>
        <div data-tip="training">
          <SortableTable rows={team.creatures} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'level', dir: -1 }} />
        </div>
      </section>
    </div>
  );
}
