/** A stable's crest (heraldic shield), and the editor used when starting a new game. */
import { useId } from 'react';
import { CREST_CHARGES, CREST_COLORS, CREST_EMBLEMS, CREST_PATTERNS, type CrestPattern, type TeamCrest } from '../../data/crest.ts';
import { defaultCrest } from '../../engine/team/crest.ts';
import { useT } from '../i18n/index.ts';
import type { StringKey } from '../i18n/strings.ts';
import { CREST_ICONS, ICON_VIEWBOX } from '../icons/gameIcons.ts';
import { randomSeed } from '../format.ts';
import { UiIcon } from '../icons/Icon.tsx';

const SHIELD = 'M2.5 2.5 H21.5 V11.5 C21.5 17.5 12 22.5 12 22.5 C12 22.5 2.5 17.5 2.5 11.5 Z';

/** The second colour's area for each pattern (the first fills the whole shield). */
function Division({ pattern, color }: { pattern: CrestPattern; color: string }) {
  switch (pattern) {
    case 'pale':
      return <rect x="12" y="0" width="12" height="24" fill={color} />;
    case 'fess':
      return <rect x="0" y="12" width="24" height="12" fill={color} />;
    case 'bend':
      return <polygon points="0,0 24,24 24,0" fill={color} />;
    case 'quarterly':
      return (
        <>
          <rect x="12" y="0" width="12" height="12" fill={color} />
          <rect x="0" y="12" width="12" height="12" fill={color} />
        </>
      );
    case 'chevron':
      return <polygon points="0,17 12,8 24,17 24,22 12,13 0,22" fill={color} />;
    default:
      return null;
  }
}

export function CrestShield({ crest, size = 24, title }: { crest: TeamCrest; size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const body = CREST_ICONS[crest.emblem];
  return (
    <svg className="team-crest" width={size} height={size} viewBox="0 0 24 24" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`shield-${id}`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#shield-${id})`}>
        <rect x="0" y="0" width="24" height="24" fill={crest.field[0]} />
        <Division pattern={crest.pattern} color={crest.field[1]} />
      </g>
      <path d={SHIELD} fill="none" stroke="rgb(0 0 0 / 0.5)" strokeWidth="1" />
      <path d="M4.5 4.5 H19.5 V11.5 C19.5 16 12 20.2 12 20.2 C12 20.2 4.5 16 4.5 11.5 Z" fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="0.7" />
      {body && (
        <svg x="5.6" y="4.8" width="12.8" height="12.8" viewBox={ICON_VIEWBOX} style={{ color: crest.charge }}>
          <g dangerouslySetInnerHTML={{ __html: body }} style={{ filter: 'drop-shadow(0 0 12px rgb(0 0 0 / 0.55))' }} />
        </svg>
      )}
    </svg>
  );
}

/** Crest of a stable (its own, or the one drawn from its id). */
export function StableCrest({ team, size = 20 }: { team: { id: string; name: string; crest?: TeamCrest }; size?: number }) {
  return <CrestShield crest={team.crest ?? defaultCrest(team.id)} size={size} title={team.name} />;
}

export function CrestEditor({ value, onChange }: { value: TeamCrest; onChange: (c: TeamCrest) => void }) {
  const { t } = useT();
  const set = (p: Partial<TeamCrest>) => onChange({ ...value, ...p });
  return (
    <div className="crest-editor">
      <div className="crest-preview">
        <CrestShield crest={value} size={84} />
        <button type="button" className="btn small" onClick={() => onChange(defaultCrest(randomSeed()))}>
          <UiIcon name="dice" /> {t('crest.random')}
        </button>
      </div>
      <div className="crest-controls">
        <div className="crest-row">
          <span className="crest-label">{t('crest.emblem')}</span>
          <div className="crest-emblems">
            {CREST_EMBLEMS.map((e) => (
              <button key={e} type="button" className={`crest-emblem ${value.emblem === e ? 'on' : ''}`} onClick={() => set({ emblem: e })} aria-label={e}>
                <svg viewBox={ICON_VIEWBOX} width="22" height="22" aria-hidden="true">
                  <g dangerouslySetInnerHTML={{ __html: CREST_ICONS[e] ?? '' }} />
                </svg>
              </button>
            ))}
          </div>
        </div>
        <div className="crest-row">
          <span className="crest-label">{t('crest.colors')}</span>
          <div className="crest-swatches">
            {CREST_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch-btn ${value.field[0] === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ field: [c, value.field[1]] })} aria-label={c} />
            ))}
          </div>
          <div className="crest-swatches">
            {CREST_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch-btn ${value.field[1] === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ field: [value.field[0], c] })} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="crest-row">
          <span className="crest-label">{t('crest.pattern')}</span>
          <div className="crest-patterns">
            {CREST_PATTERNS.map((p) => (
              <button key={p} type="button" className={`crest-pattern ${value.pattern === p ? 'on' : ''}`} onClick={() => set({ pattern: p })} title={t(`crest.p.${p}` as StringKey)}>
                <CrestShield crest={{ ...value, pattern: p, emblem: '' }} size={26} />
              </button>
            ))}
          </div>
          <span className="crest-label">{t('crest.charge')}</span>
          <div className="crest-swatches">
            {CREST_CHARGES.map((c) => (
              <button key={c} type="button" className={`swatch-btn ${value.charge === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ charge: c })} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
