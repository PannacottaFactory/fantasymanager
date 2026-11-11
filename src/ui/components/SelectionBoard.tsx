/**
 * Line-up board: drag a creature between the front line, the back line, the bench and the reserve.
 * Dropping on another creature swaps their places. Touch / keyboard: click a creature, then click where it goes.
 */
import { useState, type DragEvent } from 'react';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { isInjured, overallRating } from '../../engine/creature/derived.ts';
import type { Creature, Team } from '../../engine/model.ts';
import { levelOf } from '../../engine/progression/levels.ts';
import { dropOnCreature, moveToZone, zoneOf, type Zone } from '../../engine/team/edit.ts';
import { fatigueColor } from '../format.ts';
import { useT } from '../i18n/index.ts';
import { RoleIcon } from '../icons/Icon.tsx';
import { Bar, Crest } from './common.tsx';

const ZONES: Zone[] = ['front', 'back', 'bench', 'reserve'];

export function SelectionBoard({ team, onChange, league, onOpen }: { team: Team; onChange: (t: Team) => void; league?: boolean; onOpen: (id: string) => void }) {
  const { t } = useT();
  const m = DEFAULT_CONFIG.match;
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const starters = team.tactic.lineup.length;
  const inZone = (z: Zone) =>
    team.creatures
      .filter((c) => zoneOf(team, c.id) === z)
      .sort((x, y) => (z === 'bench' ? team.tactic.bench.indexOf(x.id) - team.tactic.bench.indexOf(y.id) : overallRating(y) - overallRating(x)));
  const full = (z: Zone, id: string | null) => {
    const from = id ? zoneOf(team, id) : null;
    if (z === 'front' || z === 'back') return starters >= m.starters && from !== 'front' && from !== 'back';
    if (z === 'bench') return team.tactic.bench.length >= m.benchSize && from !== 'bench';
    return false;
  };
  const moving = dragging ?? picked;
  const apply = (next: Team) => {
    if (next !== team) onChange(next);
    setPicked(null);
    setOver(null);
    setDragging(null);
  };
  const toZone = (z: Zone) => moving && apply(moveToZone(team, moving, z));
  const toCreature = (on: string) => moving && apply(dropOnCreature(team, moving, on));

  const allow = (key: string) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== key) setOver(key);
  };

  const chip = (c: Creature) => {
    const slot = team.tactic.lineup.find((s) => s.creatureId === c.id);
    const injured = isInjured(c);
    return (
      <div
        key={c.id}
        className={`sb-chip ${picked === c.id ? 'picked' : ''} ${dragging === c.id ? 'dragging' : ''} ${over === `c:${c.id}` && moving !== c.id ? 'over' : ''} ${injured && league ? 'injured' : ''}`}
        draggable
        role="button"
        tabIndex={0}
        title={t('sb.chip.title')}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', c.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(c.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        onDragOver={(e) => {
          e.stopPropagation();
          allow(`c:${c.id}`)(e);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toCreature(c.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (picked && picked !== c.id) toCreature(c.id);
          else setPicked(picked === c.id ? null : c.id);
        }}
        onDoubleClick={() => onOpen(c.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (picked && picked !== c.id) toCreature(c.id);
            else setPicked(picked === c.id ? null : c.id);
          }
        }}
      >
        <Crest speciesId={c.speciesId} name={c.name} />
        <span className="sb-name ellipsis">{c.name}</span>
        {slot && <RoleIcon role={slot.role} />}
        <span className="sb-ovr mono" title={t('col.ovr.title')}>
          {overallRating(c)}
        </span>
        <span className="sb-lv mono faint">{t('sb.level', { n: levelOf(c) })}</span>
        {league &&
          (injured ? (
            <span className="tag bad sb-inj">✚</span>
          ) : (
            <span className="sb-fat" title={`${t('col.fatigue')} ${c.condition.fatigue}%`}>
              <Bar value={c.condition.fatigue} max={100} color={fatigueColor(c.condition.fatigue)} thin />
            </span>
          ))}
      </div>
    );
  };

  const count = (z: Zone) =>
    z === 'front' || z === 'back' ? `${inZone(z).length}` : z === 'bench' ? `${team.tactic.bench.length}/${m.benchSize}` : `${inZone(z).length}`;

  return (
    <div className={`sb ${moving ? 'moving' : ''}`} data-tip={league ? 'lineup' : undefined}>
      <div className="sb-head">
        <b>{t('sb.title', { s: starters, n: m.starters })}</b>
        <span className="faint">{picked ? t('sb.hintPicked') : t('sb.hint')}</span>
      </div>
      <div className="sb-grid">
        {ZONES.map((z) => {
          const blocked = !!moving && full(z, moving);
          return (
            <div
              key={z}
              className={`sb-zone sb-${z} ${over === z && !blocked ? 'over' : ''} ${blocked ? 'blocked' : ''}`}
              onDragOver={allow(z)}
              onDragLeave={() => over === z && setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                toZone(z);
              }}
              onClick={() => picked && toZone(z)}
            >
              <div className="sb-zone-head">
                <span>{t(`sb.${z}`)}</span>
                <span className="faint mono">{count(z)}</span>
              </div>
              <div className="sb-chips">
                {inZone(z).map(chip)}
                {inZone(z).length === 0 && <div className="sb-empty faint">{t('sb.empty')}</div>}
              </div>
              {blocked && <div className="sb-full">{t(z === 'bench' ? 'sb.fullBench' : 'sb.fullStarters')}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
