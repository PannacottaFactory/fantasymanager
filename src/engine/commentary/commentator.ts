/**
 * Turns structured match events into lively text.
 * Uses its own RNG stream (derived from the match seed) so the wording never changes the result,
 * and remembers recently used templates to avoid robotic repetition.
 */
import type { Lang } from '../../core/i18n.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { capitalize, fill } from '../../core/text.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { EFFECTS } from '../../data/effects.ts';
import { INJURIES } from '../../data/injuries.ts';
import { COMMENTARY, type Template } from '../../data/text/commentary.ts';
import { COMMENTARY_FR } from '../../data/text/commentary.fr.ts';
import { abilityText, effectText, injuryText, speciesText } from '../text/localize.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { MatchEvent, RosterEntry, Side } from '../combat/types.ts';

export interface CommentaryLine {
  round: number;
  text: string;
  /** 0 = flavour, 1 = normal, 2 = major (KO, crit, flee…). */
  importance: 0 | 1 | 2;
  side: Side | null;
  kind: MatchEvent['type'] | 'crowd';
  /** Creature acting in this line (attacker, healer, KO author…), if any. */
  actor?: string;
  /** Creature on the receiving end, if any. */
  target?: string;
}

/** Templates per language. */
export const COMMENTARY_BY_LANG: Record<Lang, Record<string, readonly Template[]>> = { en: COMMENTARY, fr: COMMENTARY_FR };

const WORDS: Record<Lang, { someone: string; anAlly: string; theEnemy: string; wounds: string; anInjury: string }> = {
  en: { someone: 'someone', anAlly: 'an ally', theEnemy: 'the enemy', wounds: 'wounds', anInjury: 'an injury' },
  fr: { someone: 'quelqu’un', anAlly: 'un allié', theEnemy: 'l’ennemi', wounds: 'la douleur', anInjury: 'une blessure' },
};

/** Who acts / who suffers in an event (used by the UI to highlight creatures). */
export function eventParticipants(e: MatchEvent): { actor?: string; target?: string } {
  switch (e.type) {
    case 'attack':
    case 'heal':
    case 'cleanse':
    case 'thorns':
    case 'drain':
      return { actor: e.actor, target: e.target };
    case 'buff':
    case 'debuff':
      return { actor: e.actor, target: e.targets.length === 1 ? e.targets[0] : undefined };
    case 'disobey':
      return { actor: e.actor, target: e.chose };
    case 'ko':
      return { actor: e.by, target: e.target };
    case 'injury':
    case 'effectApplied':
    case 'effectTick':
      return { target: e.target };
    case 'substitution':
      return { actor: e.inId, target: e.outId };
    case 'guard':
    case 'rest':
    case 'hesitate':
    case 'flee':
    case 'stunned':
    case 'showboat':
    case 'enrage':
    case 'exhausted':
    case 'moraleShift':
      return { actor: e.actor };
    default:
      return {};
  }
}

type Vars = Record<string, string | number | undefined>;

export class Commentator {
  private readonly rng: Rng;
  private readonly recent = new Map<string, number[]>();
  private readonly mentioned = new Set<string>();
  private readonly onField = new Set<string>();
  private prev: MatchEvent | null = null;
  /** actor|ability|round of the multi-target action being narrated. */
  private groupKey = '';
  private readonly cfg: GameConfig;
  /** Language of the next lines (may be switched mid-match). */
  lang: Lang;

  constructor(
    seed: number,
    private readonly roster: Record<string, RosterEntry>,
    private readonly teams: [string, string],
    cfg: GameConfig = DEFAULT_CONFIG,
    lang: Lang = 'en',
  ) {
    this.rng = new Rng(deriveSeed(seed, 'commentary'));
    this.cfg = cfg;
    this.lang = lang;
    for (const r of Object.values(roster)) if (r.starter) this.onField.add(r.id);
  }

  narrateAll(events: readonly MatchEvent[]): CommentaryLine[] {
    return events.flatMap((e) => this.narrate(e));
  }

  narrate(e: MatchEvent): CommentaryLine[] {
    // Bookkeeping only (stamina gauges): never narrated, and invisible to the "previous event" context.
    if (e.type === 'spend') return [];
    const lines = this.lines(e);
    this.track(e);
    this.prev = e;
    return lines;
  }

  // ——— helpers ———

  private track(e: MatchEvent) {
    if (e.type === 'ko') this.onField.delete(e.target);
    if (e.type === 'flee') this.onField.delete(e.actor);
    if (e.type === 'substitution') {
      this.onField.delete(e.outId);
      this.onField.add(e.inId);
    }
  }

  /** How to refer to a creature: full name first, then short name or "the troll". */
  private ref(id: string | undefined): string {
    const w = WORDS[this.lang];
    if (!id) return w.someone;
    const r = this.roster[id];
    if (!r) return w.someone;
    if (!this.mentioned.has(id)) {
      this.mentioned.add(id);
      return r.name;
    }
    const sameSpecies = [...this.onField].filter((x) => this.roster[x]?.speciesId === r.speciesId).length;
    const roll = this.rng.next();
    if (sameSpecies <= 1 && roll < 0.25) return speciesText(r.speciesId, this.lang).the;
    const short = r.name.split(' ')[0]!;
    return roll < 0.75 ? short : r.name;
  }

  /** "e" when the creature's species noun is feminine (French adjective agreement). */
  private fem(id: string | undefined): string {
    const r = id ? this.roster[id] : undefined;
    return r && speciesText(r.speciesId, this.lang).fem ? 'e' : '';
  }

  private pick(key: string, tags: string[], vars: Vars): string | null {
    const list = COMMENTARY_BY_LANG[this.lang][key];
    if (!list?.length) return null;
    const eligible = list
      .map((tpl, i) => ({ i, tags: tpl[0].split(' ').filter(Boolean), text: tpl[1] }))
      .filter((t) => t.tags.every((tag) => tags.includes(tag)));
    if (!eligible.length) return null;
    const recent = this.recent.get(key) ?? [];
    const fresh = eligible.filter((t) => !recent.includes(t.i));
    const pool = fresh.length ? fresh : eligible;
    const choice = this.rng.weighted(pool, (t) => 1 + t.tags.length * 2.5);
    recent.push(choice.i);
    const memory = Math.max(1, Math.floor(list.length / 2));
    while (recent.length > memory) recent.shift();
    this.recent.set(key, recent);
    // Capitalize every sentence start ("…the sand. the minotaur…" → "The minotaur").
    return capitalize(fill(choice.text, vars)).replace(/([.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  }

  private line(e: MatchEvent, key: string, tags: string[], vars: Vars, importance: 0 | 1 | 2, side: Side | null): CommentaryLine[] {
    const text = this.pick(key, tags, vars);
    return text ? [{ round: e.round, text, importance, side, kind: e.type, ...eventParticipants(e) }] : [];
  }

  private crowd(e: MatchEvent, chance: number): CommentaryLine[] {
    if (!this.rng.chance(chance)) return [];
    return this.line(e, 'crowd', [], {}, 0, null).map((l) => ({ ...l, kind: 'crowd' as const, actor: undefined, target: undefined }));
  }

  private sideOf(id: string | undefined): Side | null {
    return id ? (this.roster[id]?.side ?? null) : null;
  }

  private lines(e: MatchEvent): CommentaryLine[] {
    const lang = this.lang;
    const words = WORDS[lang];
    switch (e.type) {
      case 'spend':
        return [];
      case 'matchStart':
        return this.line(e, 'matchStart', [], { home: e.teams[0], away: e.teams[1] }, 1, null);
      case 'roundStart': {
        if (e.round === 1) return this.line(e, 'roundFirst', [], {}, 0, null);
        if (e.round === this.cfg.match.maxRounds) return this.line(e, 'roundLast', [], {}, 1, null);
        if (!this.rng.chance(0.45)) return [];
        return this.line(e, 'roundOpen', e.round >= 12 ? ['late'] : [], { round: e.round }, 0, null);
      }
      case 'attack': {
        const ab = abilityText(e.ability, lang);
        const r = this.roster[e.target];
        const tags: string[] = [e.kind];
        if (e.crit) tags.push('crit');
        if (r && e.damage >= r.maxHp * 0.22) tags.push('heavy');
        else if (r && e.hit && e.damage < r.maxHp * 0.07) tags.push('light');
        if (e.elementMult >= 1.2) tags.push('strong');
        if (e.elementMult <= 0.85) tags.push('resisted');
        if (e.interceptedFrom) tags.push('intercepted');
        if (e.flank) tags.push('flank');
        if (e.absorbed > 0) tags.push('shielded');
        if (e.healed) tags.push('lifesteal');
        if (e.execute) tags.push('execute');
        if (r && e.targetHp > 0 && e.targetHp < r.maxHp * 0.2) tags.push('finishing');
        const vars: Vars = {
          a: this.ref(e.actor),
          t: this.ref(e.target),
          ab: ab.name,
          verb: ab.verb,
          dmg: e.damage,
          hp: e.targetHp,
          protected: e.interceptedFrom ? this.ref(e.interceptedFrom) : undefined,
          absorbed: e.absorbed,
          healed: e.healed,
          aE: this.fem(e.actor),
          tE: this.fem(e.target),
        };
        const importance: 0 | 1 | 2 = !e.hit ? 0 : e.crit || tags.includes('heavy') ? 2 : 1;
        const side = this.sideOf(e.actor);
        if (e.aoe) {
          const key = `${e.actor}|${e.ability}|${e.round}`;
          const out: CommentaryLine[] = [];
          if (key !== this.groupKey) out.push(...this.line(e, 'aoe.open', [e.kind], vars, 1, side));
          this.groupKey = key;
          out.push(...this.line(e, e.hit ? 'aoe.hit' : 'aoe.miss', tags, vars, importance, side));
          return out;
        }
        const key = e.interceptedFrom ? 'attack.intercept' : e.hit ? 'attack.hit' : 'attack.miss';
        const out = this.line(e, key, e.interceptedFrom ? [...tags, e.hit ? 'hit' : 'miss'] : tags, vars, importance, side);
        if (e.crit && tags.includes('heavy')) out.push(...this.crowd(e, 0.35));
        return out;
      }
      case 'heal': {
        const ab = ABILITIES[e.ability];
        const verb = abilityText(e.ability, lang).verb;
        const r = this.roster[e.target];
        if (ab?.target === 'allAllies') {
          const key = `${e.actor}|${e.ability}|${e.round}`;
          if (key === this.groupKey) return [];
          this.groupKey = key;
          return this.line(e, 'heal.group', [], { a: this.ref(e.actor), verb, aE: this.fem(e.actor) }, 1, this.sideOf(e.actor));
        }
        const tags: string[] = [];
        if (e.actor === e.target) tags.push('self');
        if (r && e.amount >= r.maxHp * 0.25) tags.push('big');
        if (e.amount < 3) tags.push('wasted');
        const vars: Vars = { a: this.ref(e.actor), t: this.ref(e.target), verb, n: e.amount, aE: this.fem(e.actor), tE: this.fem(e.target) };
        return this.line(e, 'heal', tags, vars, 1, this.sideOf(e.actor));
      }
      case 'buff': {
        const ab = ABILITIES[e.ability];
        const tags: string[] = [];
        if (ab?.target === 'allAllies') tags.push('allies');
        else if (ab?.target === 'self') tags.push('self');
        else tags.push('ally');
        const t = e.targets[0];
        const side = this.sideOf(e.actor);
        const vars: Vars = {
          a: this.ref(e.actor),
          t: t ? this.ref(t) : words.anAlly,
          verb: abilityText(e.ability, lang).verb,
          aTeam: side !== null ? this.teams[side] : '',
          aE: this.fem(e.actor),
          tE: this.fem(t),
        };
        return this.line(e, 'buff', tags, vars, 1, side);
      }
      case 'debuff': {
        const tags: string[] = [];
        if (e.targets.length > 1) tags.push('all');
        if (e.affected.length === 0) tags.push('resisted');
        const t = e.targets[0];
        const vars: Vars = { a: this.ref(e.actor), t: t ? this.ref(t) : words.theEnemy, verb: abilityText(e.ability, lang).verb, aE: this.fem(e.actor), tE: this.fem(t) };
        return this.line(e, 'debuff', tags, vars, 1, this.sideOf(e.actor));
      }
      case 'guard':
        return this.rng.chance(0.6) ? this.line(e, 'guard', [], this.actorVars(e.actor), 0, this.sideOf(e.actor)) : [];
      case 'rest': {
        const r = this.roster[e.actor];
        return this.line(e, 'rest', r && e.gained > r.maxStamina * 0.3 ? ['tired'] : [], this.actorVars(e.actor), 0, this.sideOf(e.actor));
      }
      case 'hesitate':
        return this.line(e, 'hesitate', [], this.actorVars(e.actor), 1, this.sideOf(e.actor));
      case 'flee':
        return [...this.line(e, 'flee', [], this.actorVars(e.actor), 2, this.sideOf(e.actor)), ...this.crowd(e, 0.5)];
      case 'stunned':
        if (e.effect === 'frozen') return this.line(e, 'frozen', [], this.actorVars(e.actor), 1, this.sideOf(e.actor));
        return this.line(e, 'stunned', [], this.actorVars(e.actor), 0, this.sideOf(e.actor));
      case 'thorns': {
        const vars: Vars = { a: this.ref(e.actor), t: this.ref(e.target), n: e.amount, aE: this.fem(e.actor), tE: this.fem(e.target) };
        return this.rng.chance(0.6) || e.hp <= 0 ? this.line(e, 'thorns', [], vars, 0, this.sideOf(e.actor)) : [];
      }
      case 'drain': {
        const vars: Vars = { a: this.ref(e.actor), t: this.ref(e.target), n: e.amount, aE: this.fem(e.actor), tE: this.fem(e.target) };
        return this.rng.chance(0.5) || e.stamina <= 0 ? this.line(e, 'drain', e.stamina <= 5 ? ['empty'] : [], vars, 0, this.sideOf(e.actor)) : [];
      }
      case 'cleanse': {
        const vars: Vars = { a: this.ref(e.actor), t: this.ref(e.target), aE: this.fem(e.actor), tE: this.fem(e.target) };
        return this.line(e, 'cleanse', e.actor === e.target ? ['self'] : [], vars, 1, this.sideOf(e.actor));
      }
      case 'showboat':
        return this.line(e, 'showboat', [], this.actorVars(e.actor), 1, this.sideOf(e.actor));
      case 'disobey':
        return this.line(e, 'disobey', [], { ...this.actorVars(e.actor), chose: this.ref(e.chose), ordered: this.ref(e.ordered) }, 1, this.sideOf(e.actor));
      case 'enrage':
        return this.line(e, 'enrage', [e.reason], this.actorVars(e.actor), 2, this.sideOf(e.actor));
      case 'exhausted':
        return this.line(e, 'exhausted', e.round <= 6 ? ['early'] : [], { ...this.actorVars(e.actor), round: e.round }, 1, this.sideOf(e.actor));
      case 'moraleShift':
        return this.line(e, 'moraleShift', [], { ...this.actorVars(e.actor), aTeam: this.teams[e.side] }, 0, e.side);
      case 'ko': {
        const r = this.roster[e.target];
        const tags: string[] = [];
        if (!e.by) tags.push('effect');
        const remaining = [...this.onField].filter((id) => id !== e.target && this.roster[id]?.side === r?.side).length;
        if (remaining === 0) tags.push('last');
        const lastTick = this.prev && this.prev.type === 'effectTick' && this.prev.target === e.target ? this.prev.effect : undefined;
        const vars: Vars = {
          a: this.ref(e.by),
          t: this.ref(e.target),
          tTeam: r ? this.teams[r.side] : '',
          effect: lastTick && EFFECTS[lastTick] ? effectText(lastTick, lang).noun : words.wounds,
          aE: this.fem(e.by),
          tE: this.fem(e.target),
        };
        return [...this.line(e, 'ko', tags, vars, 2, this.sideOf(e.by) ?? null), ...this.crowd(e, 0.3)];
      }
      case 'injury': {
        const inj = INJURIES[e.injuryId];
        const tags = inj && (inj.severity === 'severe' || inj.severity === 'career') ? ['severe'] : [];
        const injury = inj ? injuryText(e.injuryId, lang).name : words.anInjury;
        return this.line(e, 'injury', tags, { t: this.ref(e.target), injury, weeks: e.weeks, tE: this.fem(e.target) }, 2, this.sideOf(e.target));
      }
      case 'effectApplied': {
        // Beneficial effects are already told by the buff/heal line that caused them.
        if (EFFECTS[e.effect]?.beneficial) return [];
        const key = COMMENTARY_BY_LANG[lang][`effect.${e.effect}`] ? `effect.${e.effect}` : 'effect.generic';
        const def = EFFECTS[e.effect];
        const stacked = (e.stacks ?? 1) > 1;
        const tags = stacked ? (e.stacks === def?.maxStacks ? ['stack', 'max'] : ['stack']) : [];
        const vars: Vars = { t: this.ref(e.target), effect: effectText(e.effect, lang).noun, n: e.stacks, tE: this.fem(e.target) };
        return this.line(e, key, tags, vars, e.effect === 'frozen' || (stacked && e.stacks === def?.maxStacks) ? 1 : 0, this.sideOf(e.target));
      }
      case 'effectTick': {
        const def = EFFECTS[e.effect];
        if (!def) return [];
        if (def.kind === 'dot' && this.rng.chance(0.35)) {
          const vars: Vars = { t: this.ref(e.target), effect: effectText(e.effect, lang).noun, n: -e.amount, tE: this.fem(e.target) };
          return this.line(e, 'tick', ['dot'], vars, 0, this.sideOf(e.target));
        }
        if (def.kind === 'hot' && e.amount >= 4 && this.rng.chance(0.2)) {
          return this.line(e, 'tick', ['hot'], { t: this.ref(e.target), n: e.amount, tE: this.fem(e.target) }, 0, this.sideOf(e.target));
        }
        return [];
      }
      case 'break':
        return this.line(e, 'break', [], { round: e.round }, 1, null);
      case 'substitution': {
        const wasDown = this.prev !== null && !this.onField.has(e.outId);
        const vars: Vars = { aTeam: this.teams[e.side], in: this.ref(e.inId), out: this.ref(e.outId), oE: this.fem(e.outId) };
        return this.line(e, 'substitution', wasDown ? ['ko'] : [], vars, 1, e.side);
      }
      case 'ordersChanged':
        return this.line(e, 'ordersChanged', [e.orders.aggression], { aTeam: this.teams[e.side] }, 0, e.side);
      case 'matchEnd': {
        const tags: string[] = [e.method];
        const loser = e.winner === 0 ? 1 : 0;
        const diff = e.score[e.winner] - e.score[loser];
        if (e.method === 'points' && Math.abs(diff) <= 6) tags.push('close');
        if (e.method === 'ko' && (e.round <= 10 || diff >= 50)) tags.push('dominant');
        const vars: Vars = { winner: this.teams[e.winner], loser: this.teams[loser], round: e.round, score: `${e.score[e.winner]}–${e.score[loser]}` };
        return this.line(e, 'matchEnd', tags, vars, 2, e.winner);
      }
      case 'effectExpired':
      case 'roundEnd':
        return [];
    }
  }

  private actorVars(id: string): Vars {
    return { a: this.ref(id), aE: this.fem(id) };
  }
}
