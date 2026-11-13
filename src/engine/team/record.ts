/**
 * Career records of creatures (matches, wins, KOs, damage, healing, best of the match, trophies), the medals they
 * give, and the player's bestiary (species met in a match / owned). Pure bookkeeping: never changes a result.
 */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig, type MedalFamily } from '../../data/config/index.ts';
import { SPECIES } from '../../data/species.ts';
import type { MatchResult, Side } from '../combat/types.ts';
import { earn } from '../economy/finance.ts';
import type { Bestiary, BestiaryReward, GameState } from '../league/types.ts';
import { currentWeek, pushMessage } from '../league/messages.ts';
import type { Creature, CreatureRecord, Team } from '../model.ts';
import type { CreatureMatchStats } from '../report/report.ts';

export const MEDAL_FAMILIES: MedalFamily[] = ['matches', 'wins', 'kos', 'mvp', 'damage', 'healing', 'trophies'];

export function emptyRecord(): CreatureRecord {
  return { matches: 0, starts: 0, wins: 0, kos: 0, downs: 0, damage: 0, healing: 0, mvp: 0, best: 0, ratingSum: 0, trophies: [] };
}

/** The value a medal family counts. */
export function medalValue(r: CreatureRecord, f: MedalFamily): number {
  return f === 'trophies' ? r.trophies.length : r[f];
}

/** Tier reached in each family (0 = none, 1 = bronze, 2 = silver, 3 = gold, 4 = legend). */
export function medalsOf(r: CreatureRecord | undefined, cfg: GameConfig = DEFAULT_CONFIG): Record<MedalFamily, number> {
  const out = {} as Record<MedalFamily, number>;
  for (const f of MEDAL_FAMILIES) {
    const v = r ? medalValue(r, f) : 0;
    out[f] = cfg.collection.medals[f].filter((n) => v >= n).length;
  }
  return out;
}

/** The next threshold of a family (undefined = all reached). */
export function nextMedal(r: CreatureRecord | undefined, f: MedalFamily, cfg: GameConfig = DEFAULT_CONFIG): number | undefined {
  const v = r ? medalValue(r, f) : 0;
  return cfg.collection.medals[f].find((n) => v < n);
}

/** Medals gained between two records: [family, tier] for each new tier. */
function newMedals(before: Record<MedalFamily, number>, after: Record<MedalFamily, number>): [MedalFamily, number][] {
  const out: [MedalFamily, number][] = [];
  for (const f of MEDAL_FAMILIES) for (let t = before[f] + 1; t <= after[f]; t++) out.push([f, t]);
  return out;
}

/** Adds one match to a creature's record (mutates). Returns the medals it just earned. */
export function recordMatch(c: Creature, st: CreatureMatchStats, p: { starter: boolean; won: boolean; mvp: boolean; season: number }, cfg: GameConfig = DEFAULT_CONFIG) {
  const r = (c.record ??= emptyRecord());
  const before = medalsOf(r, cfg);
  r.since ??= p.season;
  r.matches++;
  if (p.starter) r.starts++;
  if (p.won) r.wins++;
  r.kos += st.kos;
  if (st.knockedOut) r.downs++;
  r.damage += Math.round(st.damageDealt);
  r.healing += Math.round(st.healing);
  if (p.mvp) r.mvp++;
  const rating = Math.round(st.rating * 10);
  r.best = Math.max(r.best, rating);
  r.ratingSum += rating;
  return newMedals(before, medalsOf(r, cfg));
}

/**
 * A medal for one of the player's creatures: joins this week's message for the same medal when there is one
 * (« three creatures reach … ») instead of a message each.
 */
function pushMedal(state: GameState, c: Creature, family: MedalFamily, tier: number) {
  const week = currentWeek(state);
  for (let i = state.inbox.length - 1; i >= 0; i--) {
    const m = state.inbox[i]!;
    if (m.season !== state.season || m.matchday !== week) break;
    if (m.kind === 'medal' && m.family === family && m.tier === tier && !m.read) {
      if (m.creatureId !== c.id && !m.more?.some((x) => x.creatureId === c.id)) (m.more ??= []).push({ creatureId: c.id, name: c.name });
      return;
    }
  }
  pushMessage(state, { kind: 'medal', creatureId: c.id, name: c.name, family, tier });
}

/** Records one match for a side's creatures (mutates). For the player's team, new medals become inbox messages. */
export function recordSide(state: GameState, team: Team, result: MatchResult, side: Side, stats: CreatureMatchStats[], mvp: string | null, cfg: GameConfig = DEFAULT_CONFIG) {
  const won = result.outcome.winner === side;
  for (const st of stats) {
    if (st.side !== side || !st.played) continue;
    const c = team.creatures.find((x) => x.id === st.id);
    if (!c) continue;
    const medals = recordMatch(c, st, { starter: !!result.roster[c.id]?.starter, won, mvp: mvp === c.id, season: state.season }, cfg);
    if (team.id === state.playerTeamId) for (const [family, tier] of medals) pushMedal(state, c, family, tier);
  }
}

/** A stable won a trophy: every creature in its squad keeps it in its record (mutates). */
export function awardTrophy(state: GameState, teamId: string, trophy: { def: string; tournament?: string; division?: number }, cfg: GameConfig = DEFAULT_CONFIG) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  for (const c of team.creatures) {
    const r = (c.record ??= emptyRecord());
    const before = medalsOf(r, cfg);
    r.trophies.push({ season: state.season, ...trophy });
    if (teamId !== state.playerTeamId) continue;
    for (const [family, tier] of newMedals(before, medalsOf(r, cfg))) pushMedal(state, c, family, tier);
  }
}

/** Average rating of a record (0 when it has never played). */
export function averageRating(r: CreatureRecord | undefined): number {
  return r && r.matches ? r.ratingSum / r.matches / 10 : 0;
}

// ——— Bestiary ———

export function bestiaryOf(state: GameState): Bestiary {
  return (state.bestiary ??= { seen: {}, owned: {}, paid: { seen: 0, owned: 0 } });
}

/** Species owned now or before (the current squad counts at once, before the weekly bookkeeping). */
export function ownedSpecies(state: GameState): Set<string> {
  const b = state.bestiary;
  const out = new Set(Object.keys(b?.owned ?? {}));
  for (const c of state.teams.find((t) => t.id === state.playerTeamId)?.creatures ?? []) out.add(c.speciesId);
  return out;
}

/** Species met (faced or owned). */
export function seenSpecies(state: GameState): Set<string> {
  const out = ownedSpecies(state);
  for (const id of Object.keys(state.bestiary?.seen ?? {})) out.add(id);
  return out;
}

/** Reward tiers of a list, the last one being every species. */
export function bestiaryTiers(list: 'seen' | 'owned', cfg: GameConfig = DEFAULT_CONFIG) {
  const total = Object.keys(SPECIES).length;
  return cfg.collection.bestiary[list].map((x) => ({ ...x, n: Math.min(x.n, total) }));
}

/**
 * Notes the species of the player's last match (opponents met) and of its squad (owned), pays the tiers reached and
 * sends one message for the week (mutates). `met` = creature species seen in the player's matches this week.
 */
export function updateBestiary(state: GameState, met: string[], cfg: GameConfig = DEFAULT_CONFIG) {
  // Older saves: the squad they already have is a start, not a reward.
  if (!state.bestiary) initBestiary(state);
  const b = bestiaryOf(state);
  const newSeen: string[] = [];
  const newOwned: string[] = [];
  for (const c of state.teams.find((t) => t.id === state.playerTeamId)?.creatures ?? []) {
    if (b.owned[c.speciesId] === undefined) {
      b.owned[c.speciesId] = state.season;
      newOwned.push(c.speciesId);
    }
  }
  for (const s of met) {
    if (b.seen[s] === undefined && b.owned[s] === undefined && !newSeen.includes(s)) {
      b.seen[s] = state.season;
      newSeen.push(s);
    }
  }
  // Owned species count as met.
  for (const s of Object.keys(b.owned)) b.seen[s] ??= b.owned[s]!;
  const rewards: BestiaryReward[] = [];
  const counts = { seen: Object.keys(b.seen).length, owned: Object.keys(b.owned).length };
  for (const list of ['seen', 'owned'] as const) {
    for (const tier of bestiaryTiers(list, cfg)) {
      if (tier.n <= b.paid[list] || counts[list] < tier.n) continue;
      b.paid[list] = tier.n;
      rewards.push({ list, n: tier.n, gold: tier.gold, rep: tier.rep });
      if (tier.gold) earn(state, state.playerTeamId, 'prizes', tier.gold);
      const club = state.clubs[state.playerTeamId];
      if (club && tier.rep) club.reputation = clamp(club.reputation + tier.rep, 0, 100);
    }
  }
  if (newSeen.length || newOwned.length || rewards.length) pushMessage(state, { kind: 'bestiary', seen: newSeen, owned: newOwned, rewards });
}

/** Starts a game's bestiary from the player's squad, silently (mutates). */
export function initBestiary(state: GameState) {
  const b = bestiaryOf(state);
  for (const c of state.teams.find((t) => t.id === state.playerTeamId)?.creatures ?? []) {
    b.owned[c.speciesId] ??= state.season;
    b.seen[c.speciesId] ??= state.season;
  }
  b.paid.seen = Math.max(b.paid.seen, ...bestiaryTiers('seen').filter((x) => x.n <= Object.keys(b.seen).length).map((x) => x.n), 0);
  b.paid.owned = Math.max(b.paid.owned, ...bestiaryTiers('owned').filter((x) => x.n <= Object.keys(b.owned).length).map((x) => x.n), 0);
}
