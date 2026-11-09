/** Club facilities: levels 0–3 that take weeks to build and improve one system each (pure, mutating). */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { FACILITY_IDS, type FacilityId } from '../../data/config/club.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import { clubOf, spend } from '../economy/finance.ts';
import { pushMessage } from '../league/messages.ts';
import type { Facilities, GameState } from '../league/types.ts';

export function startingFacilities(quality: QualityId, cfg: GameConfig = DEFAULT_CONFIG): Facilities {
  const level = cfg.club.facilities.start[quality as keyof typeof cfg.club.facilities.start] ?? 0;
  const out = {} as Facilities;
  for (const id of FACILITY_IDS) out[id] = { level, building: null };
  return out;
}

export function facilityLevel(state: GameState, teamId: string, id: FacilityId): number {
  return state.facilities?.[teamId]?.[id]?.level ?? 0;
}

export const upgradeCost = (level: number, cfg: GameConfig = DEFAULT_CONFIG) => cfg.club.facilities.cost[level - 1] ?? Infinity;
export const upgradeWeeks = (level: number, cfg: GameConfig = DEFAULT_CONFIG) => cfg.club.facilities.weeks[level - 1] ?? 0;

// ——— Effects ———

export function injuryWeeksFactor(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG) {
  return 1 + facilityLevel(state, teamId, 'infirmary') * cfg.club.facilities.infirmary.injuryWeeks;
}
export function medicalFactor(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG) {
  return 1 + facilityLevel(state, teamId, 'infirmary') * cfg.club.facilities.infirmary.medicalCost;
}
export function trainingFactor(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG) {
  return 1 + facilityLevel(state, teamId, 'training') * cfg.club.facilities.training.growth;
}
export function ticketsFactor(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG) {
  return 1 + facilityLevel(state, teamId, 'stands') * cfg.club.facilities.stands.tickets;
}
export function nurseryBonus(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG) {
  const level = facilityLevel(state, teamId, 'nursery');
  const n = cfg.club.facilities.nursery;
  return { extra: Math.floor(level / 2) * n.extraYouthPerTwoLevels, potential: level * n.potential };
}

/** Weekly upkeep of a stable's facilities. */
export function facilitiesUpkeep(state: GameState, teamId: string, cfg: GameConfig = DEFAULT_CONFIG): number {
  return FACILITY_IDS.reduce((s, id) => s + facilityLevel(state, teamId, id), 0) * cfg.club.facilities.upkeepPerLevel;
}

// ——— Building ———

export type BuildOutcome = { kind: 'started'; cost: number; weeks: number } | { kind: 'error'; error: 'maxLevel' | 'busy' | 'noMoney' };

/** Player starts the next level of a facility (paid now). */
export function startBuilding(state: GameState, id: FacilityId, cfg: GameConfig = DEFAULT_CONFIG): { state: GameState; outcome: BuildOutcome } {
  const f = state.facilities[state.playerTeamId]![id];
  if (f.building) return { state, outcome: { kind: 'error', error: 'busy' } };
  const level = f.level + 1;
  if (level > cfg.club.facilities.maxLevel) return { state, outcome: { kind: 'error', error: 'maxLevel' } };
  const cost = upgradeCost(level, cfg);
  if (clubOf(state, state.playerTeamId).balance < cost) return { state, outcome: { kind: 'error', error: 'noMoney' } };
  const next = structuredClone(state);
  next.facilities[next.playerTeamId]![id].building = { level, weeksLeft: upgradeWeeks(level, cfg) };
  spend(next, next.playerTeamId, 'facilities', cost);
  return { state: next, outcome: { kind: 'started', cost, weeks: upgradeWeeks(level, cfg) } };
}

/** Works progress; AI stables sometimes start building; upkeep is charged by the weekly finances. */
export function weeklyFacilities(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'facilities', state.season, state.matchday));
  const fc = cfg.club.facilities;
  for (const team of state.teams) {
    const fac = state.facilities[team.id];
    if (!fac) continue;
    for (const id of FACILITY_IDS) {
      const b = fac[id].building;
      if (!b) continue;
      b.weeksLeft--;
      if (b.weeksLeft <= 0) {
        fac[id] = { level: b.level, building: null };
        if (team.id === state.playerTeamId) pushMessage(state, { kind: 'facilityDone', facility: id, level: b.level });
      }
    }
    if (team.id === state.playerTeamId || !rng.chance(fc.aiChance)) continue;
    const id = rng.pick(FACILITY_IDS);
    const f = fac[id];
    const level = f.level + 1;
    if (f.building || level > fc.maxLevel) continue;
    const cost = upgradeCost(level, cfg);
    if (clubOf(state, team.id).balance - cost < fc.aiReserve) continue;
    f.building = { level, weeksLeft: upgradeWeeks(level, cfg) };
    spend(state, team.id, 'facilities', cost);
  }
}
