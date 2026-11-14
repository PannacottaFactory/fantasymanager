/**
 * Transfer market, free agents, contracts and scouting missions (pure: every function mutates the
 * GameState it is given; callers clone first). All randomness comes from seeded streams.
 */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { generateCreature } from '../creature/generate.ts';
import { matchdayCount } from '../league/schedule.ts';
import { divisionOf } from '../league/divisions.ts';
import { pushMessage } from '../league/messages.ts';
import { addNews } from '../league/news.ts';
import { friendsMourn } from '../club/relations.ts';
import type { GameState, TransferMove } from '../league/types.ts';
import type { Creature, Team } from '../model.ts';
import { autoTactic, repairTactic } from '../team/team.ts';
import { favouredSpecies } from '../team/identity.ts';
import { clubOf, earn, spend, weeklyBill } from './finance.ts';
import { isOwn, knowledgeOf, learn, scoutVerdict } from './scouting.ts';
import { askingWage, creatureValue, roundTo } from './value.ts';

// ——— Lookups ———

export interface Located {
  creature: Creature;
  /** null = free agent. */
  team: Team | null;
}

export function locate(state: GameState, creatureId: string): Located | null {
  for (const team of state.teams) {
    const creature = team.creatures.find((c) => c.id === creatureId);
    if (creature) return { creature, team };
  }
  const free = state.freeAgents.find((c) => c.id === creatureId);
  return free ? { creature: free, team: null } : null;
}

export const isPlayerTeam = (state: GameState, team: Team | null) => !!team && team.id === state.playerTeamId;

/** 1 = in the strongest five, 0.5 = next three, 0 = reserve. */
export function importance(team: Team, creatureId: string): number {
  const rank = [...team.creatures].sort((a, b) => b.ability - a.ability || a.id.localeCompare(b.id)).findIndex((c) => c.id === creatureId);
  return rank < 0 ? 0 : rank < 5 ? 1 : rank < 8 ? 0.5 : 0;
}

/**
 * A shortlist of offers from the other stables: creatures they would let go (outside their best five) from divisions
 * around the player's, within reach of its treasury (relaxed when too few), plus a few « dream » creatures — the most
 * valuable of the divisions above, starters included, whatever their price. Most valuable first.
 */
export function transferOffers(state: GameState, cfg: GameConfig = DEFAULT_CONFIG): { creature: Creature; team: Team }[] {
  const f = cfg.economy.freeAgents;
  const me = divisionOf(state, state.playerTeamId);
  const balance = Math.max(0, clubOf(state, state.playerTeamId).balance);
  const value = (c: Creature) => creatureValue(c, cfg);
  const byValue = (a: { creature: Creature }, b: { creature: Creature }) => value(b.creature) - value(a.creature) || a.creature.id.localeCompare(b.creature.id);
  const others = state.teams.filter((t) => t.id !== state.playerTeamId);
  // Dreams: the best of the stronger divisions (or of the player's own when it is already at the top).
  const above = others.filter((t) => divisionOf(state, t.id) < me || (me === 0 && divisionOf(state, t.id) === 0));
  const dreams = above.flatMap((team) => team.creatures.map((creature) => ({ creature, team }))).sort(byValue).slice(0, f.dreamOffers);
  const taken = new Set(dreams.map((d) => d.creature.id));
  const near = others
    .filter((t) => Math.abs(divisionOf(state, t.id) - me) <= f.offerDivisions && canLose(t, cfg))
    .flatMap((team) => team.creatures.filter((c) => importance(team, c.id) < 1 && !taken.has(c.id)).map((creature) => ({ creature, team, price: askingPrice(team, creature, cfg) })));
  const want = f.offers - dreams.length;
  let picks: typeof near = [];
  for (const reach of [1.2, 2.5, Infinity]) {
    picks = near.filter((x) => x.price <= balance * reach).sort(byValue);
    if (picks.length >= want) break;
  }
  return [...picks.slice(0, want), ...dreams].sort(byValue).map(({ creature, team }) => ({ creature, team }));
}

/** What an AI stable wants for one of its creatures. */
export function askingPrice(team: Team, c: Creature, cfg: GameConfig = DEFAULT_CONFIG): number {
  const t = cfg.economy.transfers;
  return roundTo(creatureValue(c, cfg) * (t.askBase + importance(team, c.id) * t.importanceWeight), cfg.economy.value.round);
}

export const signingBonus = (c: Creature, cfg: GameConfig = DEFAULT_CONFIG) =>
  roundTo(creatureValue(c, cfg) * cfg.economy.transfers.signingBonus, cfg.economy.value.round);

/** Remaining weeks of a contract (current season included). */
export function remainingWeeks(state: GameState, c: Creature): number {
  if (!c.contract) return 0;
  const perSeason = matchdayCount(state.fixtures);
  const left = Math.max(0, perSeason - state.matchday + 1);
  return left + Math.max(0, c.contract.untilSeason - state.season) * perSeason;
}

// ——— Moving creatures ———

/** Removes a creature from a team and keeps its tactic valid. */
function detach(state: GameState, team: Team, creatureId: string, cfg: GameConfig, quiet = false): string[] {
  const leaving = team.creatures.find((c) => c.id === creatureId);
  let friends: string[] = [];
  if (leaving) {
    friends = friendsMourn(team, leaving, cfg);
    if (!quiet && team.id === state.playerTeamId && friends.length) pushMessage(state, { kind: 'friendLeft', name: leaving.name, friends });
  }
  team.creatures = team.creatures.filter((c) => c.id !== creatureId);
  const t = team.tactic;
  t.lineup = t.lineup.filter((s) => s.creatureId !== creatureId);
  t.bench = t.bench.filter((id) => id !== creatureId);
  if (t.favorites) delete t.favorites[creatureId];
  team.tactic = team.id === state.playerTeamId ? repairTactic(team, cfg).tactic : autoTactic(team.creatures, cfg, t.orders);
  state.forSale = state.forSale.filter((id) => id !== creatureId);
  state.offers = state.offers.filter((o) => o.creatureId !== creatureId);
  return friends;
}

/** A creature dies: it leaves its stable for good (mutates). Returns the names of the friends who mourn it. */
export function bury(state: GameState, team: Team, creatureId: string, cfg: GameConfig = DEFAULT_CONFIG): string[] {
  const friends = detach(state, team, creatureId, cfg, true);
  state.scouting.missions = state.scouting.missions.filter((m) => m.targetId !== creatureId);
  delete state.training[creatureId];
  return friends;
}

/**
 * Moves a creature to another stable (or to the free agent pool when `toId` is null), paying the fee
 * to the seller and setting a new contract. Does no validation: callers check money and squad sizes.
 */
export function transfer(
  state: GameState,
  creatureId: string,
  toId: string | null,
  fee: number,
  contract: { wage: number; years: number } | null,
  cfg: GameConfig = DEFAULT_CONFIG,
): TransferMove | null {
  const loc = locate(state, creatureId);
  if (!loc) return null;
  const { creature: c, team: from } = loc;
  if (from) detach(state, from, c.id, cfg);
  else state.freeAgents = state.freeAgents.filter((x) => x.id !== c.id);
  const to = toId ? state.teams.find((t) => t.id === toId) ?? null : null;
  if (fee > 0) {
    if (to) spend(state, to.id, 'purchases', fee);
    if (from) earn(state, from.id, 'sales', fee);
  }
  if (to) {
    c.stableId = to.id;
    c.contract = contract ? { wage: contract.wage, untilSeason: state.season + contract.years - 1 } : c.contract;
    c.condition.morale = Math.min(100, c.condition.morale + 5);
    to.creatures.push(c);
    if (to.id === state.playerTeamId) to.tactic = repairTactic(to, cfg).tactic;
    else to.tactic = autoTactic(to.creatures, cfg, to.tactic.orders);
  } else {
    c.stableId = null;
    delete c.contract;
    state.freeAgents.push(c);
  }
  if (to && fee >= cfg.club.news.bigFee) addNews(state, { kind: 'bigTransfer', name: c.name, from: from?.name ?? null, to: to.name, fee }, cfg);
  return { name: c.name, speciesId: c.speciesId, from: from?.name ?? null, to: to?.name ?? null, fee };
}

/** Can this team take one more creature / let one go? */
export const canAdd = (team: Team, cfg: GameConfig = DEFAULT_CONFIG) => team.creatures.length < cfg.economy.club.maxSquad;
export const canLose = (team: Team, cfg: GameConfig = DEFAULT_CONFIG) => team.creatures.length > cfg.economy.club.minSquad;

// ——— Free agents ———

function newFreeAgent(state: GameState, rng: Rng, cfg: GameConfig): Creature {
  const weights = cfg.economy.freeAgents.qualityWeights;
  const quality = rng.weighted(Object.keys(weights) as QualityId[], (q) => weights[q as keyof typeof weights] ?? 0);
  return generateCreature(rng, { quality, stableId: null, lang: state.lang }, cfg);
}

export function fillFreeAgents(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  while (state.freeAgents.length < cfg.economy.freeAgents.pool) state.freeAgents.push(newFreeAgent(state, rng, cfg));
}

// ——— Contracts ———

/** Initial contract for a creature already in a stable (new game / save migration). */
export function initialContract(state: GameState, c: Creature, reputation: number, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const years = rng.int(1, 3);
  const wage = roundTo(askingWage(c, reputation, years, cfg) * rng.range(0.9, 1.1), 10);
  c.contract = { wage, untilSeason: state.season + years - 1 };
}

/** Wage the creature asks to extend its contract with the player. */
export function renewalDemand(state: GameState, c: Creature, years: number, cfg: GameConfig = DEFAULT_CONFIG): number {
  const team = state.teams.find((t) => t.id === state.playerTeamId)!;
  const bonus = 1 + importance(team, c.id) * 0.1;
  return roundTo(askingWage(c, clubOf(state, team.id).reputation, years, cfg) * bonus, 10);
}

/** Season change: contracts that ran out end (player) or are renewed / released (AI). */
export function contractsTurnover(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const left: string[] = [];
  const moves: TransferMove[] = [];
  for (const team of state.teams) {
    const expiring = team.creatures.filter((c) => c.contract && c.contract.untilSeason < state.season);
    for (const c of expiring) {
      if (team.id === state.playerTeamId) {
        left.push(c.name);
        transfer(state, c.id, null, 0, null, cfg);
        continue;
      }
      // AI: keep useful creatures it can afford, release the rest.
      const club = clubOf(state, team.id);
      const keep = importance(team, c.id) > 0 && club.balance > 0;
      if (keep || !canLose(team, cfg)) initialContract(state, c, club.reputation, rng, cfg);
      else {
        const m = transfer(state, c.id, null, 0, null, cfg);
        if (m) moves.push(m);
      }
    }
  }
  if (left.length) pushMessage(state, { kind: 'contractLeft', names: left });
  if (moves.length) pushMessage(state, { kind: 'marketNews', moves });
}

/** A few matchdays before the end of the season, warns about the player's expiring contracts. */
export function contractWarning(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  if (state.matchday !== matchdayCount(state.fixtures) - cfg.economy.contractWarningMatchdays) return;
  const team = state.teams.find((t) => t.id === state.playerTeamId)!;
  const names = team.creatures.filter((c) => c.contract && c.contract.untilSeason <= state.season).map((c) => c.name);
  if (names.length) pushMessage(state, { kind: 'contractExpiring', names });
}

// ——— Weekly AI market activity ———

function aiBudget(state: GameState, team: Team, cfg: GameConfig): number {
  return clubOf(state, team.id).balance - cfg.economy.transfers.aiReserve - weeklyBill(state, team.id);
}

/** Cheapest free agents first (by signing bonus), best ability on ties. */
const cheapest = (cfg: GameConfig) => (a: Creature, b: Creature) => signingBonus(a, cfg) - signingBonus(b, cfg) || b.ability - a.ability;

/**
 * Keeps every stable able to field a team: below the minimum, stables sign the cheapest free agents
 * whatever their money (the player's assistant does it too, with a message).
 */
export function ensureSquads(state: GameState, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const floor = Math.max(cfg.match.starters + cfg.match.benchSize, cfg.economy.club.minSquad);
  for (const team of state.teams) {
    const isPlayer = team.id === state.playerTeamId;
    const signed: string[] = [];
    while (team.creatures.length < floor) {
      if (state.freeAgents.length === 0) fillFreeAgents(state, rng, cfg);
      const pick = [...state.freeAgents].sort(cheapest(cfg))[0];
      if (!pick) break;
      const fee = signingBonus(pick, cfg);
      spend(state, team.id, 'purchases', fee);
      transfer(state, pick.id, team.id, 0, { wage: askingWage(pick, clubOf(state, team.id).reputation, 1, cfg), years: 1 }, cfg);
      signed.push(pick.name);
    }
    if (isPlayer && signed.length) pushMessage(state, { kind: 'emergencySigning', names: signed });
  }
}

/** Ability of the n-th best creature of a team (0 if fewer). */
function nthAbility(team: Team, n: number): number {
  return [...team.creatures].sort((a, b) => b.ability - a.ability)[n - 1]?.ability ?? 0;
}

export function weeklyMarket(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const t = cfg.economy.transfers;
  const rng = new Rng(deriveSeed(state.worldSeed, 'market', state.season, state.matchday));
  const moves: TransferMove[] = [];
  const target = cfg.league.squadSize;

  // Who was on the market before this week's moves (the UI marks the newcomers).
  state.freeAgentsBefore = state.freeAgents.map((c) => c.id);
  // Free agents drift away; newcomers arrive. A crowded market keeps only its most valuable creatures.
  state.freeAgents = state.freeAgents.filter(() => !rng.chance(cfg.economy.freeAgents.leaveChance));
  if (state.freeAgents.length > cfg.economy.freeAgents.max)
    state.freeAgents = [...state.freeAgents].sort((a, b) => creatureValue(b, cfg) - creatureValue(a, cfg) || a.id.localeCompare(b.id)).slice(0, cfg.economy.freeAgents.max);

  const ai = state.teams.filter((x) => x.id !== state.playerTeamId);
  const styleBias = cfg.identity.difficulties[state.difficulty ?? 'normal'].styleBias;
  for (const team of rng.shuffle(ai)) {
    const club = clubOf(state, team.id);
    // A stable looks harder at creatures that fit its style.
    const style = favouredSpecies(team, cfg);
    const focus = team.identity?.focus ?? 0.5;
    // …and at the gems everyone is talking about.
    const fit = (c: Creature) => c.ability + (style.includes(c.speciesId) ? styleBias * focus * 2 : 0) + (c.hype ? cfg.economy.scouting.gem.aiFit : 0);
    // Sign a free agent when short-handed, or a clear upgrade when rich.
    const need = team.creatures.length < target;
    const room = team.creatures.length <= target;
    if (room && rng.chance(need ? t.aiNeedChance : t.aiSignChance)) {
      const bar = need ? 0 : nthAbility(team, 8) + 15;
      const budget = need ? club.balance - 2000 : aiBudget(state, team, cfg);
      const pick = state.freeAgents
        .filter((c) => fit(c) > bar && signingBonus(c, cfg) <= budget)
        .sort((a, b) => fit(b) - fit(a))[0];
      if (pick) {
        const fee = signingBonus(pick, cfg);
        spend(state, team.id, 'purchases', fee);
        const m = transfer(state, pick.id, team.id, 0, { wage: askingWage(pick, club.reputation, 2, cfg), years: 2 }, cfg);
        if (m) moves.push({ ...m, fee });
      }
    }
    // Occasionally buy from another AI stable (rich stables shop more, for smaller upgrades).
    const rich = club.balance > t.richBalance;
    if (team.creatures.length <= target && rng.chance(t.aiBuyChance * (rich ? t.richBuyFactor : 1))) {
      const bar = nthAbility(team, 5) + (rich ? 0 : 10);
      const budget = aiBudget(state, team, cfg);
      const options: { c: Creature; seller: Team; price: number }[] = [];
      for (const seller of ai) {
        if (seller.id === team.id || !canLose(seller, cfg)) continue;
        for (const c of seller.creatures) {
          if (fit(c) <= bar || importance(seller, c.id) === 1) continue;
          const price = askingPrice(seller, c, cfg);
          if (price <= budget) options.push({ c, seller, price });
        }
      }
      if (options.length) {
        const o = rng.weighted(options, (x) => (style.includes(x.c.speciesId) ? 1 + 4 * focus : 1));
        const m = transfer(state, o.c.id, team.id, o.price, { wage: askingWage(o.c, club.reputation, 2, cfg), years: 2 }, cfg);
        if (m) moves.push(m);
      }
    }
  }
  // Stables in the red sell one of their better creatures to the richest stable that can afford it.
  for (const seller of ai) {
    if (clubOf(state, seller.id).balance >= 0 || !canLose(seller, cfg) || !rng.chance(t.distressSellChance)) continue;
    const forSale = [...seller.creatures].sort((a, b) => creatureValue(b, cfg) - creatureValue(a, cfg)).slice(1, 6);
    for (const c of forSale) {
      const fee = roundTo(creatureValue(c, cfg) * t.distressPrice, cfg.economy.value.round);
      const buyer = ai
        .filter((b) => b.id !== seller.id && canAdd(b, cfg) && aiBudget(state, b, cfg) >= fee)
        .sort((a, b) => clubOf(state, b.id).balance - clubOf(state, a.id).balance)[0];
      if (!buyer) continue;
      const m = transfer(state, c.id, buyer.id, fee, { wage: askingWage(c, clubOf(state, buyer.id).reputation, 2, cfg), years: 2 }, cfg);
      if (m) moves.push(m);
      break;
    }
  }
  fillFreeAgents(state, rng, cfg);
  ensureSquads(state, rng, cfg);

  // Offers for the player's creatures.
  state.offers = state.offers.filter((o) => {
    const alive = o.season === state.season && o.expires >= state.matchday;
    if (!alive) {
      const c = locate(state, o.creatureId)?.creature;
      const from = state.teams.find((x) => x.id === o.fromTeamId);
      if (c && from) pushMessage(state, { kind: 'offerExpired', name: c.name, fromTeam: from.name });
    }
    return alive;
  });
  const player = state.teams.find((x) => x.id === state.playerTeamId)!;
  const chance = t.aiOfferChance + state.forSale.length * t.aiOfferChanceListed;
  if (canLose(player, cfg) && rng.chance(Math.min(0.9, chance))) {
    const listed = player.creatures.filter((c) => state.forSale.includes(c.id));
    const pool = listed.length && rng.chance(0.75) ? listed : player.creatures;
    const c = rng.weighted(pool, (x) => creatureValue(x, cfg));
    const isListed = state.forSale.includes(c.id);
    const [lo, hi] = isListed ? t.aiOfferRangeListed : t.aiOfferRange;
    const fee = roundTo(creatureValue(c, cfg) * rng.range(lo, hi), cfg.economy.value.round);
    const buyers = ai.filter((b) => canAdd(b, cfg) && aiBudget(state, b, cfg) >= fee && !state.offers.some((o) => o.creatureId === c.id && o.fromTeamId === b.id));
    if (buyers.length) {
      const buyer = rng.pick(buyers);
      const id = `of${state.nextId++}`;
      state.offers.push({ id, creatureId: c.id, fromTeamId: buyer.id, fee, season: state.season, expires: state.matchday + t.offerWeeks });
      pushMessage(state, { kind: 'offerReceived', offerId: id, creatureId: c.id, name: c.name, fromTeam: buyer.name, fee });
    }
  }
  if (moves.length) pushMessage(state, { kind: 'marketNews', moves });
}

// ——— Scouting ———

/** Missions progress; facing creatures in a match teaches a little about them. */
export function weeklyScouting(state: GameState, opponentsSeen: string[], cfg: GameConfig = DEFAULT_CONFIG) {
  const s = cfg.economy.scouting;
  for (const id of opponentsSeen) {
    const k = state.scouting.knowledge[id] ?? s.leagueBaseline;
    if (k < s.matchCap) learn(state, id, Math.min(s.matchCap, k + s.perMatch), cfg);
  }
  const done: typeof state.scouting.missions = [];
  for (const m of state.scouting.missions) {
    m.weeksLeft--;
    if (m.weeksLeft <= 0) done.push(m);
  }
  state.scouting.missions = state.scouting.missions.filter((m) => m.weeksLeft > 0);
  // Gems found earlier: quiet weeks, then the world notices them, then the excitement fades.
  const gems = (state.scouting.gems ??= []);
  for (const g of gems) g.weeksLeft--;
  for (const g of gems.filter((x) => x.weeksLeft <= 0)) {
    const c = locate(state, g.creatureId)?.creature;
    if (g.phase === 'quiet' && c && !isOwn(state, c.id)) {
      c.hype = s.gem.hype;
      g.phase = 'hyped';
      g.weeksLeft = s.gem.hypeWeeks;
      pushMessage(state, { kind: 'gemNoticed', creatureId: c.id, name: c.name });
    } else if (c) delete c.hype;
  }
  state.scouting.gems = gems.filter((g) => g.weeksLeft > 0 && locate(state, g.creatureId) && !(g.phase === 'quiet' && isOwn(state, g.creatureId)));
  for (const m of done) {
    if (m.target === 'creature') {
      const c = locate(state, m.targetId)?.creature;
      if (!c) continue;
      const before = knowledgeOf(state, c.id, cfg);
      learn(state, c.id, s.creatureKnowledge, cfg);
      const verdict = scoutVerdict(state, c, knowledgeOf(state, c.id, cfg), cfg);
      // A gem nobody else has spotted yet: a window before its price climbs.
      const quiet = verdict === 'gem' && !c.hype && !state.scouting.gems.some((g) => g.creatureId === c.id) ? s.gem.quietWeeks : undefined;
      if (quiet) state.scouting.gems.push({ creatureId: c.id, phase: 'quiet', weeksLeft: quiet });
      pushMessage(state, { kind: 'scoutReport', target: 'creature', targetId: c.id, name: c.name, before, verdict, ...(quiet ? { quiet } : {}) });
    } else {
      const team = state.teams.find((x) => x.id === m.targetId);
      if (!team) continue;
      for (const c of team.creatures) learn(state, c.id, s.teamKnowledge, cfg);
      pushMessage(state, { kind: 'scoutReport', target: 'team', targetId: team.id, name: team.name });
    }
  }
}
