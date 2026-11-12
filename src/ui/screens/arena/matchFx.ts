/**
 * Visual reactions of the fighter cards, derived from match events (display only: no game logic).
 */
import { ABILITIES } from '../../../data/abilities.ts';
import { EFFECTS } from '../../../data/effects.ts';
import { ELEMENTS } from '../../../data/elements.ts';
import type { ElementId } from '../../../data/schema.ts';
import type { MatchEvent } from '../../../engine/combat/types.ts';
import { effectsOn } from '../../i18n/index.ts';

export type FxKind = 'hit' | 'crit' | 'miss' | 'heal' | 'ko' | 'dot' | 'buff' | 'debuff' | 'revive';

export interface CardFx {
  kind: FxKind;
  /** Floating text ("-14", "+8", "KO", "Miss"…); empty for none. */
  text: string;
  /** Changes on every new reaction so animations replay. */
  nonce: number;
}

/** Something flying from one card to another (arrow, spell orb, healing light…). */
export type ShotStyle = 'melee' | 'ranged' | 'spell' | 'heal' | 'buff' | 'debuff';
export interface Shot {
  from: string;
  to: string;
  style: ShotStyle;
  color: string;
  /** Element of the projectile (drives its particles). */
  element: ElementId | 'physical';
  miss: boolean;
  crit: boolean;
  /** The blow knocked the target out. */
  ko?: boolean;
}

const PHYSICAL_COLOR = '#e9e1cf';
const STYLE_COLOR: Partial<Record<ShotStyle, string>> = { heal: '#6fd17a', buff: '#e6c55a', debuff: '#a77be0' };

function shotElement(abilityId: string, elementsOf: (id: string) => readonly ElementId[], actor: string): ElementId | 'physical' {
  const el = ABILITIES[abilityId]?.element;
  const id = el === 'innate' ? elementsOf(actor)[0] : el;
  return id ?? 'physical';
}

/** Colour of an ability's projectile: its element, or the user's first element for innate attacks. */
function shotColor(element: ElementId | 'physical', style: ShotStyle): string {
  return STYLE_COLOR[style] ?? (element !== 'physical' ? ELEMENTS[element].color : PHYSICAL_COLOR);
}

export interface FxBatch {
  /** Creature acting (glows and lunges towards the centre). */
  actor: { id: string; nonce: number } | null;
  targets: Record<string, CardFx>;
  shots: Shot[];
  /** Ability just paid for (its chip pulses on the actor's card). */
  cast: { actor: string; ability: string; nonce: number } | null;
  /** Big moments drawn on the card by the particle engine. */
  bursts: { id: string; kind: 'ko' | 'revive' }[];
}

const PRIORITY: Record<FxKind, number> = { revive: 7, ko: 6, crit: 5, hit: 4, heal: 3, debuff: 2, dot: 2, buff: 1, miss: 0 };

let counter = 0;

/** Animations off: the viewer chose reduced effects (defaults to the system setting). */
export const reducedMotion = () => !effectsOn();

/** Colour family of a commentary line. */
export type LineTone = 'heal' | 'buff' | 'debuff' | 'dot' | 'ko' | 'miss' | 'crit' | 'info';

export function lineTone(e: MatchEvent): LineTone | undefined {
  switch (e.type) {
    case 'attack':
      return !e.hit ? 'miss' : e.crit ? 'crit' : undefined;
    case 'heal':
    case 'cleanse':
      return 'heal';
    case 'effectTick':
      return e.amount > 0 ? 'heal' : 'dot';
    case 'buff':
    case 'guard':
    case 'rest':
      return 'buff';
    case 'debuff':
    case 'stunned':
    case 'hesitate':
    case 'drain':
      return 'debuff';
    case 'thorns':
    case 'sacrifice':
      return 'dot';
    case 'revive':
      return 'buff';
    case 'effectApplied': {
      const def = EFFECTS[e.effect];
      return def?.beneficial ? 'buff' : def?.kind === 'dot' ? 'dot' : 'debuff';
    }
    case 'ko':
    case 'flee':
    case 'injury':
      return 'ko';
    case 'enrage':
    case 'transform':
      return 'crit';
    case 'substitution':
    case 'ordersChanged':
    case 'break':
      return 'info';
    default:
      return undefined;
  }
}

export const emptyFx = (): FxBatch => ({ actor: null, targets: {}, shots: [], cast: null, bursts: [] });

/** Adds an event's reactions to a batch (later, more important reactions win). */
export function addEventFx(
  batch: FxBatch,
  e: MatchEvent,
  missLabel: string,
  koLabel: string,
  elementsOf: (id: string) => readonly ElementId[] = () => [],
): FxBatch {
  const shoot = (from: string, to: string, ability: string, style: ShotStyle, miss = false, crit = false) => {
    if (to === from) return;
    const element = shotElement(ability, elementsOf, from);
    batch.shots.push({ from, to, style, color: shotColor(element, style), element, miss, crit });
  };
  const put = (id: string, kind: FxKind, text: string) => {
    const prev = batch.targets[id];
    if (prev && PRIORITY[prev.kind] > PRIORITY[kind]) return;
    batch.targets[id] = { kind, text, nonce: ++counter };
  };
  switch (e.type) {
    case 'spend':
      if (e.ability) batch.cast = { actor: e.actor, ability: e.ability, nonce: ++counter };
      break;
    case 'attack':
      batch.actor = { id: e.actor, nonce: ++counter };
      shoot(e.actor, e.target, e.ability, e.kind === 'melee' ? 'melee' : e.kind === 'ranged' ? 'ranged' : 'spell', !e.hit, e.crit);
      if (!e.hit) put(e.target, 'miss', missLabel);
      else put(e.target, e.crit ? 'crit' : 'hit', `-${e.damage}`);
      if (e.healed) put(e.actor, 'heal', `+${e.healed}`);
      break;
    case 'heal':
      batch.actor = { id: e.actor, nonce: ++counter };
      shoot(e.actor, e.target, e.ability, 'heal');
      put(e.target, 'heal', `+${e.amount}`);
      break;
    case 'buff':
      batch.actor = { id: e.actor, nonce: ++counter };
      for (const id of e.targets) {
        shoot(e.actor, id, e.ability, 'buff');
        put(id, 'buff', '');
      }
      break;
    case 'debuff':
      batch.actor = { id: e.actor, nonce: ++counter };
      for (const id of e.affected) {
        shoot(e.actor, id, e.ability, 'debuff');
        put(id, 'debuff', '');
      }
      break;
    case 'cleanse':
      put(e.target, 'buff', '');
      break;
    case 'thorns':
      put(e.target, 'dot', `-${e.amount}`);
      break;
    case 'sacrifice':
      put(e.actor, 'dot', `-${e.amount}`);
      break;
    case 'revive':
      put(e.target, 'revive', `+${e.hp}`);
      batch.bursts.push({ id: e.target, kind: 'revive' });
      break;
    case 'drain':
      put(e.target, 'debuff', `-${e.amount}⚡`);
      break;
    case 'guard':
    case 'rest':
    case 'showboat':
    case 'enrage':
      batch.actor = { id: e.actor, nonce: ++counter };
      break;
    case 'transform':
      batch.actor = { id: e.actor, nonce: ++counter };
      put(e.actor, 'buff', '');
      break;
    case 'effectTick':
      if (e.amount < 0) put(e.target, 'dot', `${e.amount}`);
      else if (e.amount > 0) put(e.target, 'heal', `+${e.amount}`);
      break;
    case 'ko': {
      put(e.target, 'ko', koLabel);
      batch.bursts.push({ id: e.target, kind: 'ko' });
      const shot = [...batch.shots].reverse().find((x) => x.to === e.target);
      if (shot) shot.ko = true;
      break;
    }
    default:
      break;
  }
  return batch;
}
