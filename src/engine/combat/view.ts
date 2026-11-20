/**
 * Display state rebuilt from events, so a UI can replay a match event by event
 * without touching the Combat object (and without containing any game logic).
 */
import type { CombatantSnapshot, CombatantState, MatchEvent, RosterEntry, Side } from './types.ts';
import type { Line } from '../../data/schema.ts';

export interface CombatantView {
  id: string;
  side: Side;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  morale: number;
  state: CombatantState;
  line: Line;
  effects: string[];
  /** Stacks of stacking effects (poison doses, chill charges), when above 1. */
  stacks: Record<string, number>;
  abilities: string[];
  /** Rounds left before each ability is available again. */
  cooldowns: Record<string, number>;
  /** Total cooldown of the ability when it was last used (to draw the refill). */
  cooldownMax: Record<string, number>;
}

export interface MatchView {
  round: number;
  creatures: Record<string, CombatantView>;
  subsUsed: [number, number];
  ended: boolean;
}

/** Judges' score of a side so far, as the engine counts it: health removed from every opponent that entered, healing deducted. */
export function judgesScore(view: MatchView, side: 0 | 1): number {
  const opp = Object.values(view.creatures).filter((c) => c.side !== side && c.state !== 'bench');
  const total = opp.reduce((s, c) => s + c.maxHp, 0);
  const left = opp.reduce((s, c) => s + (c.state === 'ko' ? 0 : Math.max(0, Math.round(c.hp))), 0);
  return total ? Math.min(100, Math.max(0, Math.round((100 * (total - left)) / total))) : 0;
}

export function initialView(roster: Record<string, RosterEntry>): MatchView {
  const creatures: Record<string, CombatantView> = {};
  for (const r of Object.values(roster)) {
    creatures[r.id] = {
      id: r.id, side: r.side, hp: r.maxHp, maxHp: r.maxHp, stamina: r.maxStamina, maxStamina: r.maxStamina,
      morale: 50, state: r.starter ? 'active' : 'bench', line: r.line, effects: [], stacks: {},
      abilities: r.abilities ?? [], cooldowns: {}, cooldownMax: {},
    };
  }
  return { round: 0, creatures, subsUsed: [0, 0], ended: false };
}

function applySnapshot(view: MatchView, snapshot: CombatantSnapshot[]) {
  for (const s of snapshot) {
    const c = view.creatures[s.id];
    if (!c) continue;
    Object.assign(c, { hp: s.hp, stamina: s.stamina, morale: s.morale, state: s.state, line: s.line, effects: [...s.effects], stacks: { ...(s.stacks ?? {}) } });
    // Older stored matches have no cooldowns in their snapshots.
    if (s.cooldowns) c.cooldowns = { ...s.cooldowns };
  }
}

/** Returns a new view with the event applied (shallow-copies touched creatures). */
export function applyEvent(prev: MatchView, e: MatchEvent): MatchView {
  const view: MatchView = { ...prev, creatures: { ...prev.creatures }, subsUsed: [...prev.subsUsed] };
  const touch = (id: string): CombatantView | undefined => {
    const c = view.creatures[id];
    if (!c) return undefined;
    const copy = { ...c, effects: [...c.effects] };
    view.creatures[id] = copy;
    return copy;
  };
  switch (e.type) {
    case 'matchStart':
    case 'roundEnd':
      for (const id of Object.keys(view.creatures)) touch(id);
      applySnapshot(view, e.snapshot);
      break;
    case 'roundStart':
      view.round = e.round;
      break;
    case 'teamTalk':
      for (const ch of e.changes) {
        const c = touch(ch.id);
        if (c) Object.assign(c, { morale: ch.morale, stamina: ch.stamina });
      }
      break;
    case 'spend': {
      const a = touch(e.actor);
      if (a) {
        a.stamina = e.stamina;
        if (e.ability && e.cooldown > 0) {
          a.cooldowns = { ...a.cooldowns, [e.ability]: e.cooldown + 1 };
          a.cooldownMax = { ...a.cooldownMax, [e.ability]: e.cooldown };
        }
      }
      break;
    }
    case 'attack': {
      const t = touch(e.target);
      if (t) t.hp = e.targetHp;
      if (e.healed) {
        const a = touch(e.actor);
        if (a) a.hp = Math.min(a.maxHp, a.hp + e.healed);
      }
      break;
    }
    case 'heal': {
      const t = touch(e.target);
      if (t) t.hp = e.targetHp;
      break;
    }
    case 'sacrifice': {
      const a = touch(e.actor);
      if (a) a.hp = e.hp;
      break;
    }
    case 'revive': {
      const t = touch(e.target);
      if (t) {
        t.hp = e.hp;
        t.effects = t.effects.filter((x) => x !== e.effect);
      }
      break;
    }
    case 'thorns': {
      const t = touch(e.target);
      if (t) t.hp = e.hp;
      break;
    }
    case 'transform': {
      const a = touch(e.actor);
      if (a && !a.effects.includes(e.effect)) a.effects.push(e.effect);
      break;
    }
    case 'drain': {
      const t = touch(e.target);
      if (t) t.stamina = e.stamina;
      break;
    }
    case 'effectTick': {
      const t = touch(e.target);
      if (t) t.hp = e.hp;
      break;
    }
    case 'effectApplied': {
      const t = touch(e.target);
      if (t && !t.effects.includes(e.effect)) t.effects.push(e.effect);
      if (t && e.stacks) t.stacks = { ...t.stacks, [e.effect]: e.stacks };
      break;
    }
    case 'effectExpired': {
      const t = touch(e.target);
      if (t) {
        t.effects = t.effects.filter((x) => x !== e.effect);
        if (t.stacks[e.effect]) t.stacks = Object.fromEntries(Object.entries(t.stacks).filter(([k]) => k !== e.effect));
      }
      break;
    }
    case 'cleanse': {
      const t = touch(e.target);
      if (t) {
        t.effects = t.effects.filter((x) => !e.removed.includes(x));
        t.stacks = Object.fromEntries(Object.entries(t.stacks).filter(([k]) => !e.removed.includes(k)));
      }
      break;
    }
    case 'rest': {
      const a = touch(e.actor);
      if (a) a.stamina = Math.min(a.maxStamina, a.stamina + e.gained);
      break;
    }
    case 'ko': {
      const t = touch(e.target);
      if (t) {
        t.hp = 0;
        t.state = 'ko';
        t.effects = [];
        t.stacks = {};
      }
      break;
    }
    case 'flee': {
      const a = touch(e.actor);
      if (a) a.state = 'fled';
      break;
    }
    case 'substitution': {
      const out = touch(e.outId);
      const inc = touch(e.inId);
      if (out && out.state === 'active') out.state = 'withdrawn';
      if (inc) {
        inc.state = 'active';
        inc.line = e.line;
      }
      view.subsUsed[e.side]++;
      break;
    }
    case 'matchEnd':
      view.ended = true;
      break;
    default:
      break;
  }
  return view;
}
