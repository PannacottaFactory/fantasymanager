import type { RoleId } from '../../data/schema.ts';
import { roleText, speciesName } from '../../engine/text/localize.ts';
import { useT } from '../i18n/index.ts';
import { ELEMENTS } from '../../data/elements.ts';
import { SPECIES } from '../../data/species.ts';
import { COMP_ICONS, DIV_ICONS, ICON_VIEWBOX, ROLE_ICONS, SPECIES_ICONS, UI_ICONS } from './gameIcons.ts';

/** A monochrome game icon (inherits the text colour). */
function GameIcon({ body, size, title, className }: { body: string; size: number | string; title?: string; className?: string }) {
  return (
    <svg className={`gicon ${className ?? ''}`} width={size} height={size} viewBox={ICON_VIEWBOX} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <g dangerouslySetInnerHTML={{ __html: body }} />
    </svg>
  );
}

export function SpeciesIcon({ id, size = '1.3em' }: { id: string; size?: number | string }) {
  const { lang } = useT();
  const body = SPECIES_ICONS[id];
  const el = SPECIES[id]?.elements[0];
  if (!body) return null;
  return (
    <span className="species-icon" style={{ color: el ? ELEMENTS[el].color : undefined }}>
      <GameIcon body={body} size={size} title={speciesName(id, lang)} />
    </span>
  );
}

/** An interface icon in a round badge (board, …). */
export function BadgeIcon({ name, title }: { name: string; title?: string }) {
  const body = UI_ICONS[name];
  return body ? (
    <span className="badge-icon">
      <GameIcon body={body} size="1.1em" title={title} />
    </span>
  ) : null;
}

export function RoleIcon({ role, size = '1.1em' }: { role: RoleId; size?: number | string }) {
  const { lang } = useT();
  const body = ROLE_ICONS[role];
  return body ? <GameIcon body={body} size={size} title={roleText(role, lang).name} className={`role-icon role-${role}`} /> : null;
}

/** Role icon followed by its name (or short name). */
export function RoleLabel({ role, short }: { role: RoleId; short?: boolean }) {
  const { lang } = useT();
  const txt = roleText(role, lang);
  return (
    <span className="role-label" title={txt.name}>
      <RoleIcon role={role} />
      {short ? txt.short : txt.name}
    </span>
  );
}

/** Emblem of a competition (definition id: shadow, division, champions, preseason, marches, argent, or), in its colour. */
export function CompIcon({ def, size = '1.15em', title }: { def: string; size?: number | string; title?: string }) {
  const body = COMP_ICONS[def] ?? COMP_ICONS.shadow!;
  return (
    <span className={`comp-ico def-${def}`}>
      <GameIcon body={body} size={size} title={title} />
    </span>
  );
}

/** Emblem of a division (0 = the top one), in its colour. */
export function DivIcon({ d, size = '1.15em', title }: { d: number; size?: number | string; title?: string }) {
  const i = Math.max(0, Math.min(DIV_ICONS.length - 1, d));
  return (
    <span className={`div-ico tier-${i}`}>
      <GameIcon body={DIV_ICONS[i]!} size={size} title={title} />
    </span>
  );
}

/** An interface icon inline (inherits the text colour). */
export function UiIcon({ name, size = '1.1em' }: { name: string; size?: number | string }) {
  const body = UI_ICONS[name];
  return body ? <GameIcon body={body} size={size} /> : null;
}
