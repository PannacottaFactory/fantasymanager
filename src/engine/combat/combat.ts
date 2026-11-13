/**
 * Turn-based arena combat. Deterministic for a given seed + break decisions.
 *
 * Usage:
 *   const c = new Combat(setup);
 *   while (c.phase !== 'ended') {
 *     c.advance();                       // plays rounds until a break or the end
 *     if (c.phase === 'break') { c.applyBreakDecision(0, …); c.applyBreakDecision(1, …); c.resume(); }
 *   }
 *   const result = c.result();
 */
import { clamp, round } from '../../core/math.ts';
import { Rng, normalizeSeed } from '../../core/rng.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { EFFECTS } from '../../data/effects.ts';
import { INJURIES } from '../../data/injuries.ts';
import { SPECIES } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import { ATTRIBUTE_KEYS, type Attributes } from '../../data/attributes.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { AbilityDef } from '../../data/schema.ts';
import type { ArenaCondition, ArenaConditionId } from '../../data/config/arena.ts';
import { bestRole, getAbilities, maxHp, maxStamina, roleFit } from '../creature/derived.ts';
import { relationMorale } from '../club/relations.ts';
import { ROLES } from '../../data/roles.ts';
import type { AiManagerStyle, Creature, TeamOrders } from '../model.ts';
import { chooseAction, instinctPriority, type AiContext, type ChosenAction } from './ai.ts';
import {
  attackKind,
  critChance,
  disobeyChance,
  effectMod,
  coverMult,
  executeMult,
  lineTargets,
  packMult,
  isCleansable,
  elementMultiplier,
  hasEffect,
  hasEffectFlag,
  arenaCostMult,
  arenaElementMult,
  hitChance,
  hpFraction,
  healAmount,
  initiative,
  interceptChance,
  coverPoints,
  mitigation,
  rawDamage,
  resolveElement,
  scaledMoraleDelta,
  staminaCost,
  staminaFraction,
  staminaRegen,
  traitSum,
} from './formulas.ts';
import type {
  BreakDecision,
  Combatant,
  CombatantSnapshot,
  MatchEvent,
  MatchOutcome,
  MatchResult,
  MatchSetup,
  PostMatchCreature,
  RosterEntry,
  Side,
} from './types.ts';

interface SideState {
  teamId: string;
  name: string;
  orders: TeamOrders;
  subsUsed: number;
  /** AI manager behaviour of this side, when it has one. */
  ai?: AiManagerStyle;
  /** Orders the side started with (what break decisions come back to when the score is level). */
  baseOrders: TeamOrders;
}

export type CombatPhase = 'running' | 'break' | 'ended';

export class Combat {
  readonly cfg: GameConfig;
  readonly seed: number;
  readonly combatants: Combatant[] = [];
  readonly sides: [SideState, SideState];
  readonly events: MatchEvent[] = [];
  readonly decisions: MatchResult['decisions'] = [];
  round = 0;
  phase: CombatPhase = 'running';
  outcome: MatchOutcome | null = null;
  private readonly rng: Rng;
  private readonly byId = new Map<string, Combatant>();
  private readonly roster: Record<string, RosterEntry> = {};
  private breakIndex = 0;
  private readonly injuries = new Map<string, { injuryId: string; weeks: number }[]>();
  /** target id → ids of attackers who hit it this round. */
  private hitThisRound = new Map<string, Set<string>>();
  private readonly ai: AiContext;
  /** Arena condition of the match (weather, hour), if any. */
  readonly arena: ArenaCondition | undefined;
  readonly arenaId: ArenaConditionId | undefined;

  constructor(setup: MatchSetup, cfg: GameConfig = DEFAULT_CONFIG) {
    this.cfg = cfg;
    this.arenaId = setup.arena;
    this.arena = setup.arena ? cfg.arena.conditions[setup.arena] : undefined;
    this.seed = normalizeSeed(setup.seed);
    this.rng = new Rng(this.seed);
    const [t0, t1] = setup.teams;
    this.sides = [
      { teamId: t0.id, name: t0.name, orders: { ...t0.tactic.orders }, subsUsed: 0, ai: t0.tactic.ai, baseOrders: { ...t0.tactic.orders } },
      { teamId: t1.id, name: t1.name, orders: { ...t1.tactic.orders }, subsUsed: 0, ai: t1.tactic.ai, baseOrders: { ...t1.tactic.orders } },
    ];
    setup.teams.forEach((team, i) => {
      const side = i as Side;
      const byCreature = new Map(team.creatures.map((c) => [c.id, c]));
      for (const slot of team.tactic.lineup) {
        const cr = byCreature.get(slot.creatureId);
        if (!cr) throw new Error(`Lineup creature ${slot.creatureId} not in team ${team.name}`);
        this.addCombatant(cr, side, slot.role, slot.line, slot.stance, true, team.tactic.favorites?.[cr.id]);
      }
      for (const id of team.tactic.bench) {
        const cr = byCreature.get(id);
        if (!cr) throw new Error(`Bench creature ${id} not in team ${team.name}`);
        const role = bestRole(cr);
        this.addCombatant(cr, side, role, ROLES[role].defaultLine, 'normal', false, team.tactic.favorites?.[cr.id]);
      }
      // Friends lift each other before the first blow; rivals sap the mood.
      const starters = team.tactic.lineup.map((sl) => byCreature.get(sl.creatureId)!);
      for (const cr of starters) {
        const c = this.byId.get(cr.id);
        if (c) c.morale = clamp(c.morale + relationMorale(cr, starters, cfg), 5, 100);
      }
    });

    this.ai = {
      cfg,
      rng: this.rng,
      allies: (c) => this.active(c.side),
      enemies: (c) => this.active(other(c.side)),
      orders: (c) => this.sides[c.side].orders,
      alliesOn: (attacker, target) => {
        const set = this.hitThisRound.get(target.id);
        let n = 0;
        if (set) for (const id of set) if (id !== attacker.id && this.byId.get(id)?.side === attacker.side) n++;
        return n;
      },
      comboOn: (attacker, target) => {
        const set = this.hitThisRound.get(target.id);
        if (!set) return false;
        for (const id of set) if (id !== attacker.id && this.byId.get(id)?.side === attacker.side) return true;
        return false;
      },
      behind: (c) => Math.max(0, this.teamHealth(other(c.side)) - this.teamHealth(c.side)),
      coverPoints: (side) => this.coverPoints(side),
      arena: this.arena,
    };

    for (const c of this.combatants) {
      if (c.state === 'active') for (const p of SPECIES[c.speciesId]?.passives ?? []) this.addEffect(c, p, 999, undefined, true);
    }
    this.emit({ type: 'matchStart', round: 0, teams: [t0.name, t1.name], snapshot: this.snapshot(), ...(setup.arena ? { arena: setup.arena } : {}) });
  }

  // ——— Public API ———

  get(id: string): Combatant {
    const c = this.byId.get(id);
    if (!c) throw new Error(`Unknown combatant ${id}`);
    return c;
  }

  active(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && c.state === 'active');
  }

  bench(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && c.state === 'bench');
  }

  getRoster(): Record<string, RosterEntry> {
    return this.roster;
  }

  /** Plays rounds until the next break or the end of the match. Returns the new events. */
  advance(): MatchEvent[] {
    if (this.phase === 'break') throw new Error('Combat is at a break: apply decisions and call resume()');
    const start = this.events.length;
    while (this.phase === 'running') {
      this.playRound();
      if (this.phase !== 'running') break;
      if (this.cfg.match.breakRounds.includes(this.round)) {
        this.liftCurses();
        this.rechargeWards();
        this.phase = 'break';
        this.emit({ type: 'break', round: this.round, index: this.breakIndex++ });
      }
    }
    return this.events.slice(start);
  }

  resume(): void {
    if (this.phase === 'break') this.phase = 'running';
  }

  /** Validates and applies a manager's decisions at a break. Returns error messages (empty = ok). */
  applyBreakDecision(side: Side, d: BreakDecision): string[] {
    const errors: string[] = [];
    if (this.phase !== 'break') return ['Decisions can only be made during a break.'];
    const st = this.sides[side];
    const applied: BreakDecision = {};
    for (const sub of d.substitutions ?? []) {
      const out = this.byId.get(sub.outId);
      const inc = this.byId.get(sub.inId);
      if (st.subsUsed >= this.cfg.match.maxSubstitutions) {
        errors.push('No substitutions left.');
        break;
      }
      if (!out || !inc || out.side !== side || inc.side !== side) {
        errors.push('Invalid substitution.');
        continue;
      }
      if (inc.state !== 'bench') {
        errors.push(`${inc.name} is not on the bench.`);
        continue;
      }
      if (out.replaced || !(out.state === 'active' || out.state === 'ko' || out.state === 'fled')) {
        errors.push(`${out.name} cannot be substituted.`);
        continue;
      }
      if (out.state === 'active') {
        out.state = 'withdrawn';
        out.leftRound = this.round;
      }
      out.replaced = true;
      inc.state = 'active';
      inc.line = sub.line ?? out.line;
      if (sub.role && sub.role !== inc.role) this.setRole(inc, sub.role);
      inc.enteredRound = this.round + 1;
      for (const p of SPECIES[inc.speciesId]?.passives ?? []) this.addEffect(inc, p, 999, undefined, true);
      st.subsUsed++;
      (applied.substitutions ??= []).push(sub);
      this.emit({ type: 'substitution', round: this.round, side, outId: out.id, inId: inc.id, role: inc.role, line: inc.line });
    }
    if (d.orders) {
      const changed = JSON.stringify(d.orders) !== JSON.stringify(st.orders);
      st.orders = { ...d.orders };
      if (changed) {
        applied.orders = { ...d.orders };
        this.emit({ type: 'ordersChanged', round: this.round, side, orders: { ...d.orders } });
      }
    }
    for (const lc of d.lineChanges ?? []) {
      const c = this.byId.get(lc.id);
      if (c && c.side === side && c.state === 'active') {
        c.line = lc.line;
        (applied.lineChanges ??= []).push(lc);
      }
    }
    for (const sc of d.stanceChanges ?? []) {
      const c = this.byId.get(sc.id);
      if (c && c.side === side && c.state === 'active') {
        c.stance = sc.stance;
        (applied.stanceChanges ??= []).push(sc);
      }
    }
    if (Object.keys(applied).length) this.decisions.push({ round: this.round, side, decision: applied });
    return errors;
  }

  result(): MatchResult {
    if (!this.outcome) throw new Error('Match not finished');
    const postMatch: PostMatchCreature[] = this.combatants.map((c) => {
      const played = c.enteredRound !== null;
      const pm = this.cfg.combat.postMatch;
      return {
        creatureId: c.id,
        played,
        fatigueGained: played ? Math.round(pm.fatigueBase + (1 - staminaFraction(c)) * pm.fatigueFromStamina) : 0,
        injuries: this.injuries.get(c.id) ?? [],
      };
    });
    return {
      seed: this.seed,
      teams: [
        { id: this.sides[0].teamId, name: this.sides[0].name },
        { id: this.sides[1].teamId, name: this.sides[1].name },
      ],
      roster: this.roster,
      events: this.events,
      outcome: this.outcome,
      decisions: this.decisions,
      postMatch,
    };
  }

  /** Average HP fraction of a side, counting everyone who has entered the arena. */
  teamHealth(side: Side): number {
    const entered = this.combatants.filter((c) => c.side === side && c.enteredRound !== null && !c.replaced);
    if (!entered.length) return 0;
    return entered.reduce((s, c) => s + (c.state === 'active' ? hpFraction(c) : 0), 0) / entered.length;
  }

  snapshot(): CombatantSnapshot[] {
    return this.combatants.map((c) => ({
      id: c.id,
      hp: Math.round(c.hp),
      stamina: Math.round(c.stamina),
      morale: Math.round(c.morale),
      state: c.state,
      line: c.line,
      effects: c.effects.map((e) => e.id),
      ...(c.effects.some((e) => (e.stacks ?? 1) > 1)
        ? { stacks: Object.fromEntries(c.effects.filter((e) => (e.stacks ?? 1) > 1).map((e) => [e.id, e.stacks!])) }
        : {}),
      cooldowns: Object.fromEntries(Object.entries(c.cooldowns).filter(([, v]) => v > 0)),
    }));
  }

  /** A substitute brought on in another role: role fit and natural role follow. */
  private setRole(c: Combatant, role: Combatant['role']) {
    const rf = this.cfg.combat.roleFit;
    c.role = role;
    c.roleFactor = clamp(1 + (roleFit({ attributes: c.attrs } as Creature, role) - 10) * rf.perPoint, rf.min, rf.max);
    c.naturalRole = SPECIES[c.speciesId]?.roles.includes(role) ?? false;
    const entry = this.roster[c.id];
    if (entry) entry.role = role;
  }

  // ——— Setup ———

  private addCombatant(
    cr: Creature,
    side: Side,
    role: Combatant['role'],
    line: Combatant['line'],
    stance: Combatant['stance'],
    starter: boolean,
    favorites: readonly string[] = [],
  ) {
    const species = SPECIES[cr.speciesId];
    if (!species) throw new Error(`Unknown species ${cr.speciesId}`);
    const rf = this.cfg.combat.roleFit;
    const attrs = effectiveAttributes(cr);
    const mHp = maxHp({ ...cr, attributes: attrs }, this.cfg);
    const mSt = maxStamina({ ...cr, attributes: attrs }, this.cfg);
    const m = this.cfg.combat.morale;
    const c: Combatant = {
      id: cr.id,
      side,
      name: cr.name,
      speciesId: cr.speciesId,
      size: species.size,
      elements: species.elements,
      flying: Boolean(species.flying),
      role,
      line,
      stance,
      attrs,
      traits: cr.traits,
      abilities: getAbilities(cr).map((a) => a.id),
      favorites: [],
      roleFactor: clamp(1 + (roleFit({ ...cr, attributes: attrs }, role) - 10) * rf.perPoint, rf.min, rf.max),
      naturalRole: species.roles.includes(role),
      ability: cr.ability,
      injuryProneness: cr.hidden.injuryProneness,
      preFatigue: cr.condition.fatigue,
      cooldowns: {},
      maxHp: mHp,
      hp: mHp,
      maxStamina: mSt,
      stamina: Math.round(mSt * (1 - (cr.condition.fatigue / 100) * this.cfg.combat.stamina.preMatchFatigueLoss)),
      morale: clamp(50 + (cr.condition.morale - 50) * m.startWeight + (cr.condition.form - 10) * m.formWeight, 5, 100),
      effects: [],
      state: starter ? 'active' : 'bench',
      guarding: false,
      exhaustedAnnounced: false,
      lowHpRageUsed: false,
      replaced: false,
      enteredRound: starter ? 1 : null,
      leftRound: null,
      damageDealt: 0,
      lastDamageElement: 'physical',
    };
    c.favorites = favorites.filter((id) => c.abilities.includes(id)).slice(0, this.cfg.combat.favorites.max);
    // Ids index the whole fight (targets, effect sources, the report): two creatures can never share one.
    if (this.byId.has(c.id)) throw new Error(`Duplicate creature id ${c.id} in a match`);
    this.combatants.push(c);
    this.byId.set(c.id, c);
    this.roster[c.id] = {
      id: c.id, side, name: c.name, speciesId: c.speciesId, role, line, maxHp: mHp, maxStamina: mSt, starter, traits: cr.traits,
      abilities: [...c.abilities], favorites: [...c.favorites],
    };
  }

  // ——— Round flow ———

  private emitSpend(actor: Combatant, ability: string | null, before: number, cooldown: number) {
    const stamina = Math.round(actor.stamina);
    this.emit({ type: 'spend', round: this.round, actor: actor.id, ability, cost: Math.round(before) - stamina, stamina, cooldown });
  }

  private emit(e: MatchEvent) {
    this.events.push(e);
  }

  private playRound() {
    this.round++;
    this.hitThisRound = new Map();
    this.emit({ type: 'roundStart', round: this.round });
    this.startOfRoundEffects();
    if (this.checkVictory()) return;

    const order = this.combatants
      .filter((c) => c.state === 'active')
      .map((c) => ({ c, init: initiative(c, this.rng.range(0, this.cfg.combat.initiative.noise), this.cfg) }))
      .sort((a, b) => b.init - a.init)
      .map((x) => x.c);

    for (const actor of order) {
      if (actor.state !== 'active') continue;
      this.takeTurn(actor);
      if (this.checkVictory()) return;
    }
    this.endOfRound();
    if (this.round >= this.cfg.match.maxRounds) this.endByPoints();
  }

  private startOfRoundEffects() {
    for (const c of this.combatants) {
      if (c.state !== 'active') continue;
      for (const e of [...c.effects]) {
        const def = EFFECTS[e.id];
        if (!def) continue;
        if (def.kind === 'dot') {
          const dmg = Math.max(1, Math.round(c.maxHp * (def.magnitude ?? 0) * (e.stacks ?? 1) * (this.arena?.dot ?? 1)));
          const real = Math.min(dmg, c.hp);
          c.hp -= real;
          const src = e.sourceId ? this.byId.get(e.sourceId) : undefined;
          if (src && src.side !== c.side) src.damageDealt += real;
          this.emit({ type: 'effectTick', round: this.round, target: c.id, effect: e.id, amount: -real, hp: c.hp });
          if (c.hp <= 0) {
            this.knockOut(c, src);
            break;
          }
          this.checkTransform(c);
        } else if (def.kind === 'hot') {
          const heal = Math.min(c.maxHp - c.hp, Math.round(c.maxHp * (def.magnitude ?? 0) * effectMod(c, 'healingTaken') * (this.arena?.healing ?? 1)));
          if (heal > 0) {
            c.hp += heal;
            this.emit({ type: 'effectTick', round: this.round, target: c.id, effect: e.id, amount: heal, hp: c.hp });
          }
        }
        if (def.moralePerRound) this.changeMorale(c, def.moralePerRound);
      }
    }
  }

  private endOfRound() {
    const cfg = this.cfg;
    for (const c of this.combatants) {
      if (c.state !== 'active') continue;
      c.stamina = Math.min(c.maxStamina, c.stamina + staminaRegen(c, cfg) * (this.arena?.staminaRegen ?? 1));
      // A crowd in a frenzy lifts (or a hostile one sinks) every creature on the sand.
      if (this.arena?.moralePerRound) this.changeMorale(c, this.arena.moralePerRound);
      for (const k of Object.keys(c.cooldowns)) if (c.cooldowns[k]! > 0) c.cooldowns[k]!--;
      for (const e of [...c.effects]) {
        const def = EFFECTS[e.id];
        if (!def || def.kind === 'stun' || def.curse || e.remaining >= 999) continue;
        e.remaining--;
        if (e.remaining <= 0) {
          c.effects = c.effects.filter((x) => x !== e);
          this.emit({ type: 'effectExpired', round: this.round, target: c.id, effect: e.id });
        }
      }
      // Morale drifts back toward neutral.
      const m = cfg.combat.morale;
      c.morale += c.morale < 50 ? Math.min(m.driftPerRound, 50 - c.morale) : -Math.min(m.driftPerRound, c.morale - 50);
      if (!c.exhaustedAnnounced && staminaFraction(c) < cfg.combat.fatigue.exhaustedBelow) {
        c.exhaustedAnnounced = true;
        this.emit({ type: 'exhausted', round: this.round, actor: c.id });
      }
    }
    // Leadership: the best leader on each side steadies allies.
    for (const side of [0, 1] as Side[]) {
      const team = this.active(side);
      if (!team.length) continue;
      const leader = team.reduce((a, b) => (b.attrs.leadership > a.attrs.leadership ? b : a));
      const m = cfg.combat.morale;
      const aura = traitSum(leader, 'auraMorale');
      if (leader.attrs.leadership >= m.minLeadership || aura > 0) {
        const boost = Math.max(0, leader.attrs.leadership - m.minLeadership + 1) * m.leadershipAuraPerPoint + aura;
        let lifted = false;
        for (const c of team) {
          if (c.id === leader.id) continue;
          if (c.morale < 50) lifted = true;
          this.changeMorale(c, boost);
        }
        if (lifted && this.rng.chance(0.25)) this.emit({ type: 'moraleShift', round: this.round, side, reason: 'leader', actor: leader.id });
      }
    }
    this.emit({
      type: 'roundEnd',
      round: this.round,
      snapshot: this.snapshot(),
    });
  }

  // ——— A creature's turn ———

  private takeTurn(actor: Combatant) {
    const cfg = this.cfg;
    const m = cfg.combat.morale;
    actor.guarding = false;

    const stun = actor.effects.find((e) => EFFECTS[e.id]?.kind === 'stun');
    if (stun) {
      stun.remaining--;
      if (stun.remaining <= 0) actor.effects = actor.effects.filter((e) => e !== stun);
      this.emit({ type: 'stunned', round: this.round, actor: actor.id, effect: stun.id });
      return;
    }

    const breakMod = traitSum(actor, 'breakThresholdMod');
    const enraged = hasEffect(actor, 'enraged');
    if (!enraged) {
      const fleeBelow = m.fleeBelow + breakMod;
      if (actor.morale < fleeBelow && hpFraction(actor) < m.fleeHpBelow) {
        const p = m.fleeMaxChance * (1 - actor.attrs.courage / 20) * (1 + breakMod / 20);
        if (this.rng.chance(clamp(p, 0, 0.9))) {
          actor.state = 'fled';
          actor.leftRound = this.round;
          actor.effects = [];
          this.emit({ type: 'flee', round: this.round, actor: actor.id });
          for (const ally of this.active(actor.side)) this.changeMorale(ally, m.allyKo / 2);
          return;
        }
      }
      const hesBelow = m.hesitateBelow + breakMod;
      if (actor.morale < hesBelow) {
        const p = m.hesitateMaxChance * ((hesBelow - actor.morale) / hesBelow) * Math.max(0.1, 1 - actor.attrs.composure * m.composureReductionPerPoint);
        if (this.rng.chance(p)) {
          this.emit({ type: 'hesitate', round: this.round, actor: actor.id });
          return;
        }
      }
      const show = traitSum(actor, 'showboatChance');
      if (show > 0 && this.rng.chance(show)) {
        this.emit({ type: 'showboat', round: this.round, actor: actor.id });
        this.changeMorale(actor, 4);
        return;
      }
    }

    // Orders vs instinct.
    const orders = this.sides[actor.side].orders;
    const instinct = instinctPriority(actor);
    let priority = orders.target;
    let disobeyed = false;
    if (enraged) priority = instinct;
    else if (instinct !== orders.target && this.rng.chance(disobeyChance(actor, cfg))) {
      priority = instinct;
      disobeyed = true;
    }
    const action = chooseAction(this.ai, actor, { priority, attackOnly: enraged });
    if (disobeyed && action.type === 'ability' && action.target && action.target.side !== actor.side) {
      const wanted = chooseAction(this.ai, actor, { priority: orders.target, deterministic: true });
      if (wanted.type === 'ability' && wanted.target && wanted.target.id !== action.target.id && wanted.target.side !== actor.side) {
        this.emit({ type: 'disobey', round: this.round, actor: actor.id, ordered: wanted.target.id, chose: action.target.id });
      }
    }
    this.execute(actor, action);
  }

  private execute(actor: Combatant, action: ChosenAction) {
    const cfg = this.cfg;
    if (action.type === 'rest') {
      const gained = Math.round(Math.min(actor.maxStamina - actor.stamina, staminaRegen(actor, cfg) * cfg.combat.stamina.restMult * (this.arena?.staminaRegen ?? 1)));
      actor.stamina += gained;
      this.emit({ type: 'rest', round: this.round, actor: actor.id, gained });
      return;
    }
    if (action.type === 'guard') {
      actor.guarding = true;
      const before = actor.stamina;
      actor.stamina = Math.max(0, actor.stamina - cfg.combat.guard.staminaCost);
      this.emitSpend(actor, null, before, 0);
      this.emit({ type: 'guard', round: this.round, actor: actor.id });
      return;
    }
    const ability = action.ability;
    const orders = this.sides[actor.side].orders;
    const before = actor.stamina;
    actor.stamina = Math.max(0, actor.stamina - staminaCost(actor, ability, orders, cfg) * arenaCostMult(this.arena));
    if (ability.cooldown > 0) actor.cooldowns[ability.id] = ability.cooldown + 1; // +1: decremented at end of this round
    this.emitSpend(actor, ability.id, before, ability.cooldown);
    if (ability.hpCost) {
      const pay = Math.max(0, Math.min(Math.round(actor.maxHp * ability.hpCost), Math.ceil(actor.hp) - 1));
      if (pay > 0) {
        actor.hp -= pay;
        this.emit({ type: 'sacrifice', round: this.round, actor: actor.id, ability: ability.id, amount: pay, hp: Math.round(actor.hp) });
      }
    }

    const hostile = ability.target === 'enemy' || ability.target === 'enemyFront' || ability.target === 'enemyBack' || ability.target === 'allEnemies';
    this.resolveAbility(actor, action, ability);
    // Striking from cover gives the hidden creature away.
    if (hostile && actor.state === 'active') this.reveal(actor);
  }

  /** Camouflage ends: the creature is in plain sight again. */
  private reveal(c: Combatant) {
    for (const e of c.effects.filter((x) => EFFECTS[x.id]?.hidden)) {
      c.effects = c.effects.filter((x) => x !== e);
      this.emit({ type: 'effectExpired', round: this.round, target: c.id, effect: e.id });
    }
  }

  private resolveAbility(actor: Combatant, action: Extract<ChosenAction, { type: 'ability' }>, ability: AbilityDef) {
    const cfg = this.cfg;
    const enemies = this.active(other(actor.side));
    const allies = this.active(actor.side);
    switch (ability.target) {
      case 'enemy': {
        if (!action.target || action.target.state !== 'active') return;
        if (ability.power > 0) {
          // Multi-strike abilities hit again while both are still standing.
          for (let i = 0; i < (ability.hits ?? 1); i++) {
            if (action.target.state !== 'active' || actor.state !== 'active') break;
            this.attack(actor, action.target, ability, false, action.flank);
          }
        } else this.debuff(actor, ability, [action.target]);
        return;
      }
      case 'enemyFront':
      case 'enemyBack':
      case 'allEnemies': {
        const targets = lineTargets(ability.target, enemies);
        if (ability.power > 0) for (const t of targets) if (t.state === 'active') this.attack(actor, t, ability, true, false);
        if (ability.power <= 0) this.debuff(actor, ability, targets);
        return;
      }
      case 'ally':
      case 'allAllies':
      case 'self': {
        const targets = ability.target === 'self' ? [actor] : ability.target === 'allAllies' ? allies : action.target ? [action.target] : [];
        if (ability.kind === 'heal') {
          for (const t of targets) {
            const roll = healAmount(actor, ability, cfg) * this.rng.range(0.9, 1.1) * effectMod(t, 'healingTaken') * (this.arena?.healing ?? 1);
            const amount = Math.round(Math.min(t.maxHp - t.hp, roll));
            t.hp += amount;
            this.emit({ type: 'heal', round: this.round, actor: actor.id, target: t.id, ability: ability.id, amount, targetHp: Math.round(t.hp) });
            if (ability.cleanse) this.cleanse(actor, ability, t);
            this.stopOnHeal(t);
            this.applyAbilityEffects(actor, ability, t, 'target');
          }
        } else {
          this.emit({ type: 'buff', round: this.round, actor: actor.id, ability: ability.id, targets: targets.map((t) => t.id) });
          for (const t of targets) {
            if (ability.cleanse) this.cleanse(actor, ability, t);
            this.applyAbilityEffects(actor, ability, t, 'target');
          }
        }
        this.applyAbilityEffects(actor, ability, actor, 'self');
        return;
      }
    }
  }

  private debuff(actor: Combatant, ability: AbilityDef, targets: Combatant[]) {
    // `affected` is filled below; the event keeps the same array reference.
    const affected: string[] = [];
    this.emit({ type: 'debuff', round: this.round, actor: actor.id, ability: ability.id, targets: targets.map((t) => t.id), affected });
    for (const t of targets) {
      if (t.state !== 'active') continue;
      let hit = false;
      if (ability.fear) {
        this.changeMorale(t, -ability.fear);
        hit = true;
      }
      if (this.applyAbilityEffects(actor, ability, t, 'target')) hit = true;
      if (ability.staminaDrain && this.drainStamina(actor, ability, t)) hit = true;
      if (hit) affected.push(t.id);
    }
    this.applyAbilityEffects(actor, ability, actor, 'self');
  }

  /** Applies an ability's effects; resistible by focus for harmful ones. Returns true if any landed. */
  private applyAbilityEffects(actor: Combatant, ability: AbilityDef, target: Combatant, on: 'target' | 'self'): boolean {
    let any = false;
    for (const ref of ability.effects ?? []) {
      if (ref.on !== on || target.state !== 'active') continue;
      const def = EFFECTS[ref.effect];
      if (!def) continue;
      let p = ref.chance;
      if (!def.beneficial && target.side !== actor.side) p *= 1 - target.attrs.focus * 0.015;
      if (this.rng.chance(p)) {
        this.addEffect(target, ref.effect, ref.duration ?? def.defaultDuration, actor.id, false, ref.stacks ?? 1);
        any = true;
      }
    }
    return any;
  }

  private addEffect(target: Combatant, id: string, duration: number, sourceId?: string, silent = false, stacks = 1) {
    const def = EFFECTS[id];
    if (!def) return;
    // A frozen creature cannot gather more cold.
    if (def.onMaxStacks && target.effects.some((e) => e.id === def.onMaxStacks)) return;
    const existing = target.effects.find((e) => e.id === id);
    const shieldHp = def.kind === 'shield' ? Math.round(target.maxHp * (def.magnitude ?? 0)) : undefined;
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
      if (shieldHp !== undefined) existing.shieldHp = Math.max(existing.shieldHp ?? 0, shieldHp);
      if (!def.maxStacks) return;
      const before = existing.stacks ?? 1;
      existing.stacks = Math.min(def.maxStacks, before + stacks);
      if (sourceId) existing.sourceId = sourceId;
      if (existing.stacks === before) return;
      if (!silent) this.emit({ type: 'effectApplied', round: this.round, target: target.id, effect: id, source: sourceId, stacks: existing.stacks });
      this.checkMaxStacks(target, existing, sourceId);
      return;
    }
    const n = def.maxStacks ? Math.min(def.maxStacks, stacks) : undefined;
    const fx = { id, remaining: duration, shieldHp, sourceId, ...(n ? { stacks: n } : {}) };
    target.effects.push(fx);
    if (!silent) this.emit({ type: 'effectApplied', round: this.round, target: target.id, effect: id, source: sourceId, ...(n ? { stacks: n } : {}) });
    this.checkMaxStacks(target, fx, sourceId);
  }

  /** Chill at full charge turns into a freeze. */
  private checkMaxStacks(target: Combatant, fx: Combatant['effects'][number], sourceId?: string) {
    const def = EFFECTS[fx.id];
    if (!def?.onMaxStacks || !def.maxStacks || (fx.stacks ?? 1) < def.maxStacks) return;
    target.effects = target.effects.filter((e) => e !== fx);
    this.emit({ type: 'effectExpired', round: this.round, target: target.id, effect: fx.id });
    const next = EFFECTS[def.onMaxStacks];
    if (next) this.addEffect(target, next.id, next.defaultDuration, sourceId);
  }

  /** Removes every cleansable harmful effect from an ally. */
  private cleanse(actor: Combatant, ability: AbilityDef, target: Combatant) {
    const removed = target.effects.filter((e) => isCleansable(e.id, e.remaining)).map((e) => e.id);
    if (!removed.length) return;
    target.effects = target.effects.filter((e) => !removed.includes(e.id));
    this.emit({ type: 'cleanse', round: this.round, actor: actor.id, target: target.id, ability: ability.id, removed });
  }

  /** Passive wards (runic golem) come back at full strength at each break. */
  private rechargeWards() {
    for (const c of this.combatants) {
      if (c.state !== 'active') continue;
      for (const p of SPECIES[c.speciesId]?.passives ?? []) {
        const def = EFFECTS[p];
        if (!def?.rechargeAtBreak) continue;
        const full = Math.round(c.maxHp * (def.magnitude ?? 0));
        const cur = c.effects.find((e) => e.id === p);
        if (cur && (cur.shieldHp ?? 0) >= full) continue;
        this.addEffect(c, p, 999, undefined, false);
      }
    }
  }

  /** Curses fade at each break. */
  private liftCurses() {
    for (const c of this.combatants) {
      if (c.state !== 'active') continue;
      for (const e of c.effects.filter((x) => EFFECTS[x.id]?.curse)) {
        c.effects = c.effects.filter((x) => x !== e);
        this.emit({ type: 'effectExpired', round: this.round, target: c.id, effect: e.id });
      }
    }
  }

  private attack(actor: Combatant, initialTarget: Combatant, ability: AbilityDef, aoe: boolean, flank: boolean) {
    const cfg = this.cfg;
    const kind = attackKind(ability);
    const orders = this.sides[actor.side].orders;
    let target = initialTarget;
    let interceptedFrom: string | undefined;

    // A guard may throw itself in front of a single-target physical attack.
    if (!aoe && kind !== 'spell' && !(target.role === 'tank' && target.line === 'front')) {
      const guards = this.active(target.side)
        .filter((g) => g.id !== target.id && g.role === 'tank' && g.line === 'front' && !hasEffect(g, 'stunned'))
        .sort((a, b) => Number(b.guarding) - Number(a.guarding));
      for (const g of guards) {
        if (this.rng.chance(interceptChance(g, cfg))) {
          interceptedFrom = target.id;
          target = g;
          flank = false;
          break;
        }
      }
    }

    const combo = this.ai.comboOn(actor, target);
    let p = hitChance(actor, target, ability, { flank, combo, orders }, cfg);
    const arenaHit = kind === 'ranged' ? (this.arena?.rangedHit ?? 0) : kind === 'melee' ? (this.arena?.meleeHit ?? 0) : 0;
    if (arenaHit) p = clamp(p + arenaHit, cfg.combat.hit.min, cfg.combat.hit.max);
    const ambush = hasEffectFlag(actor, 'hidden');
    const base = {
      type: 'attack' as const,
      round: this.round,
      actor: actor.id,
      target: target.id,
      ability: ability.id,
      kind,
      aoe,
      flank,
      interceptedFrom,
      ...(ambush ? { ambush: true } : {}),
    };
    if (!this.rng.chance(p)) {
      this.emit({ ...base, hit: false, damage: 0, crit: false, elementMult: 1, absorbed: 0, targetHp: Math.round(target.hp) });
      return;
    }

    const element = resolveElement(ability.element, actor);
    const elementMult = elementMultiplier(element, target.elements, cfg);
    const crit = this.rng.chance(critChance(actor, ability, orders, cfg) + (this.arena?.critBonus ?? 0));
    const d = cfg.combat.damage;
    let dmg = rawDamage(actor, ability, { orders, foeOrders: this.sides[target.side].orders, behind: this.ai.behind(actor), solo: !combo }, cfg);
    dmg *= this.rng.range(1 - d.variance, 1 + d.variance);
    dmg *= elementMult;
    dmg *= arenaElementMult(this.arena, element) * (this.arena?.kinds?.[kind] ?? 1);
    if (crit) dmg *= d.critMult;
    if (aoe) dmg *= d.aoeFactor;
    const exec = executeMult(ability, target, cfg);
    dmg *= exec;
    dmg *= coverMult(kind, target, this.coverPoints(target.side), cfg);
    const pack = ability.pack ? this.ai.alliesOn(actor, target) : 0;
    dmg *= packMult(ability, pack, cfg);
    dmg *= 1 - mitigation(target, kind, this.sides[target.side].orders, cfg);
    let damage = Math.max(1, Math.round(dmg));

    let absorbed = 0;
    const shield = target.effects.find((e) => e.shieldHp && e.shieldHp > 0);
    if (shield) {
      absorbed = Math.min(shield.shieldHp!, damage);
      shield.shieldHp! -= absorbed;
      damage -= absorbed;
      if (shield.shieldHp! <= 0) {
        target.effects = target.effects.filter((e) => e !== shield);
        this.emit({ type: 'effectExpired', round: this.round, target: target.id, effect: shield.id });
      }
    }
    const real = Math.min(damage, target.hp);
    target.hp -= real;
    actor.damageDealt += real;
    target.lastDamageElement = element;

    let healed: number | undefined;
    if (ability.lifesteal && real > 0) {
      healed = Math.round(Math.min(actor.maxHp - actor.hp, real * ability.lifesteal * effectMod(actor, 'healingTaken') * (this.arena?.healing ?? 1)));
      actor.hp += healed;
    }

    if (!this.hitThisRound.has(target.id)) this.hitThisRound.set(target.id, new Set());
    this.hitThisRound.get(target.id)!.add(actor.id);

    this.emit({ ...base, hit: true, damage: real, crit, elementMult: round(elementMult, 2), absorbed, targetHp: Math.round(target.hp), healed, ...(exec > 1 ? { execute: true } : {}), ...(pack > 0 ? { pack } : {}) });
    // Thorns: part of a melee blow comes back to the attacker.
    const thorns = kind === 'melee' && real > 0 ? Math.round(real * effectMod(target, 'thorns')) : 0;
    if (thorns > 0) this.reflect(target, actor, thorns);
    // A spell mirror sends part of a spell back to its caster.
    const mirror = kind === 'spell' && real > 0 && actor.state === 'active' ? Math.round(real * effectMod(target, 'spellReflect')) : 0;
    if (mirror > 0) this.reflect(target, actor, mirror, true);

    const m = cfg.combat.morale;
    if (crit) this.changeMorale(actor, m.critDealt);
    if (real >= target.maxHp * m.heavyHitFraction) {
      this.changeMorale(target, m.heavyHitTaken);
      if (target.hp > 0) this.maybeInjure(target, cfg.combat.injury.onHeavyHit);
    }

    if (target.hp <= 0) {
      this.knockOut(target, actor);
      return;
    }
    if (ability.fear) this.changeMorale(target, -ability.fear);
    if (ability.staminaDrain) this.drainStamina(actor, ability, target);
    this.applyAbilityEffects(actor, ability, target, 'target');
    if (!aoe && actor.state === 'active') this.applyAbilityEffects(actor, ability, actor, 'self');
    this.checkLowHpRage(target);
    this.checkTransform(target);
    if (actor.state === 'active') {
      this.checkLowHpRage(actor);
      this.checkTransform(actor);
    }
  }

  /** Metamorphosis: below the threshold, the passive gives way to the creature's true form (once). */
  private checkTransform(c: Combatant) {
    if (c.state !== 'active') return;
    const shift = c.effects.find((e) => {
      const def = EFFECTS[e.id];
      return def?.transformBelow !== undefined && def.transformInto && hpFraction(c) < def.transformBelow;
    });
    if (!shift) return;
    const into = EFFECTS[shift.id]!.transformInto!;
    c.effects = c.effects.filter((e) => e !== shift);
    this.emit({ type: 'effectExpired', round: this.round, target: c.id, effect: shift.id });
    this.addEffect(c, into, 999, undefined, true);
    this.emit({ type: 'transform', round: this.round, actor: c.id, effect: into });
  }

  /** Cover points of a side: its creatures standing in the front line (tanks count more). */
  coverPoints(side: Side): number {
    return coverPoints(this.combatants.filter((c) => c.side === side && c.state === 'active' && c.line === 'front'), this.cfg);
  }

  private reflect(from: Combatant, to: Combatant, amount: number, spell = false) {
    if (to.state !== 'active') return;
    const real = Math.min(amount, to.hp);
    to.hp -= real;
    from.damageDealt += real;
    this.emit({ type: 'thorns', round: this.round, actor: from.id, target: to.id, amount: real, hp: Math.round(to.hp), ...(spell ? { spell: true } : {}) });
    if (to.hp <= 0) this.knockOut(to, from);
  }

  /** Removes stamina from a target. Returns true if any was drained. */
  private drainStamina(actor: Combatant, ability: AbilityDef, target: Combatant): boolean {
    if (target.state !== 'active') return false;
    const amount = Math.round(Math.min(target.stamina, ability.staminaDrain ?? 0));
    if (amount <= 0) return false;
    target.stamina -= amount;
    this.emit({ type: 'drain', round: this.round, actor: actor.id, target: target.id, ability: ability.id, amount, stamina: Math.round(target.stamina) });
    return true;
  }

  /** Healing stops effects such as bleeding. */
  private stopOnHeal(target: Combatant) {
    for (const e of target.effects.filter((x) => EFFECTS[x.id]?.endsOnHeal)) {
      target.effects = target.effects.filter((x) => x !== e);
      this.emit({ type: 'effectExpired', round: this.round, target: target.id, effect: e.id });
    }
  }

  private checkLowHpRage(c: Combatant) {
    if (c.lowHpRageUsed || c.state !== 'active') return;
    let threshold = 0;
    for (const t of c.traits) threshold = Math.max(threshold, TRAITS[t]?.combat?.enrageBelowHp ?? 0);
    if (threshold > 0 && hpFraction(c) < threshold) {
      c.lowHpRageUsed = true;
      this.addEffect(c, 'enraged', this.cfg.combat.rage.duration, undefined, true);
      this.emit({ type: 'enrage', round: this.round, actor: c.id, reason: 'lowHp' });
    }
  }

  private knockOut(target: Combatant, by?: Combatant) {
    const cfg = this.cfg;
    // A one-time passive (skeleton) puts it back on its feet instead.
    const revive = target.effects.find((e) => EFFECTS[e.id]?.revive);
    if (revive) {
      target.effects = target.effects.filter((e) => e !== revive);
      target.hp = Math.max(1, Math.round(target.maxHp * EFFECTS[revive.id]!.revive!));
      this.emit({ type: 'revive', round: this.round, target: target.id, effect: revive.id, hp: target.hp });
      return;
    }
    target.hp = 0;
    target.state = 'ko';
    target.leftRound = this.round;
    target.effects = [];
    this.emit({ type: 'ko', round: this.round, target: target.id, by: by?.id });
    this.maybeInjure(target, cfg.combat.injury.onKo);
    const m = cfg.combat.morale;
    for (const ally of this.active(target.side)) {
      this.changeMorale(ally, m.allyKo);
      if (ally.traits.some((t) => TRAITS[t]?.combat?.enrageOnAllyKo) && !hasEffect(ally, 'enraged')) {
        this.addEffect(ally, 'enraged', cfg.combat.rage.duration, undefined, true);
        this.emit({ type: 'enrage', round: this.round, actor: ally.id, reason: 'allyKo' });
      }
    }
    for (const enemy of this.active(other(target.side))) this.changeMorale(enemy, m.enemyKo);
  }

  private maybeInjure(c: Combatant, baseChance: number) {
    let mult = (0.5 + c.injuryProneness / 20) * (1 + (c.preFatigue / 100) * this.cfg.combat.fatigue.injuryFromFatigue);
    for (const t of c.traits) mult *= TRAITS[t]?.training?.injuryMult ?? 1;
    if (!this.rng.chance(baseChance * mult * this.cfg.combat.injury.pronenessWeight)) return;
    const pool = Object.values(INJURIES).filter((i) => i.cause === 'any' || i.cause === c.lastDamageElement);
    const inj = this.rng.weighted(pool, (i) => i.weight * (i.cause === c.lastDamageElement ? 2 : 1));
    const weeks = this.rng.int(inj.weeks[0], inj.weeks[1]);
    const list = this.injuries.get(c.id) ?? [];
    if (list.some((x) => x.injuryId === inj.id)) return;
    list.push({ injuryId: inj.id, weeks });
    this.injuries.set(c.id, list);
    this.emit({ type: 'injury', round: this.round, target: c.id, injuryId: inj.id, weeks });
  }

  private changeMorale(c: Combatant, delta: number) {
    c.morale = clamp(c.morale + scaledMoraleDelta(c, delta, this.cfg), 0, 100);
  }

  // ——— Ending ———

  private checkVictory(): boolean {
    const alive0 = this.active(0).length;
    const alive1 = this.active(1).length;
    if (alive0 > 0 && alive1 > 0) return false;
    let winner: Side;
    if (alive0 === 0 && alive1 === 0) winner = this.pointsWinner();
    else winner = alive0 > 0 ? 0 : 1;
    this.finish(winner, 'ko');
    return true;
  }

  private judgeScore(side: Side): number {
    const opp = this.combatants.filter((c) => c.side === other(side) && c.enteredRound !== null);
    const total = opp.reduce((s, c) => s + c.maxHp, 0);
    const dealt = this.combatants.filter((c) => c.side === side).reduce((s, c) => s + c.damageDealt, 0);
    return total ? Math.min(100, Math.round((100 * dealt) / total)) : 0;
  }

  private pointsWinner(): Side {
    const s0 = this.judgeScore(0);
    const s1 = this.judgeScore(1);
    if (s0 !== s1) return s0 > s1 ? 0 : 1;
    const h0 = this.teamHealth(0);
    const h1 = this.teamHealth(1);
    if (h0 !== h1) return h0 > h1 ? 0 : 1;
    return this.rng.chance(0.5) ? 0 : 1;
  }

  private endByPoints() {
    this.finish(this.pointsWinner(), 'points');
  }

  private finish(winner: Side, method: MatchOutcome['method']) {
    const score: [number, number] = [this.judgeScore(0), this.judgeScore(1)];
    this.outcome = { winner, method, rounds: this.round, score };
    this.phase = 'ended';
    if (!this.events.some((e) => e.type === 'roundEnd' && e.round === this.round)) {
      this.emit({
        type: 'roundEnd',
        round: this.round,
        snapshot: this.snapshot(),
      });
    }
    this.emit({ type: 'matchEnd', round: this.round, winner, method, score });
  }
}

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

/** Visible attributes + trait modifiers, clamped to 1–20. */
export function effectiveAttributes(cr: Creature): Attributes {
  const out = { ...cr.attributes };
  for (const t of cr.traits) {
    const mods = TRAITS[t]?.combat?.attrMods;
    if (!mods) continue;
    for (const k of ATTRIBUTE_KEYS) if (mods[k]) out[k] = clamp(out[k] + mods[k]!, 1, 20);
  }
  return out;
}

export function abilityDef(id: string): AbilityDef {
  const a = ABILITIES[id];
  if (!a) throw new Error(`Unknown ability ${id}`);
  return a;
}
