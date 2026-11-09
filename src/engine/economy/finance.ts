/** Treasury & ledger of every stable (pure; functions mutate the state they are given). */
import { clamp } from '../../core/math.ts';
import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { MatchOutcome } from '../combat/types.ts';
import { isInjured } from '../creature/derived.ts';
import { currentWeek, pushMessage } from '../league/messages.ts';
import { computeStandings } from '../league/standings.ts';
import type { Club, ExpenseKind, Fixture, GameState, IncomeKind, LedgerEntry } from '../league/types.ts';
import { weeklyCost } from './value.ts';

export function clubOf(state: GameState, teamId: string): Club {
  const c = state.clubs[teamId];
  if (!c) throw new Error(`No club for team ${teamId}`);
  return c;
}

function entry(state: GameState, club: Club, matchday = currentWeek(state)): LedgerEntry {
  let e = club.ledger.find((x) => x.season === state.season && x.matchday === matchday);
  if (!e) {
    e = { season: state.season, matchday, income: {}, expense: {}, balance: club.balance };
    club.ledger.push(e);
    club.ledger.sort((a, b) => a.season - b.season || a.matchday - b.matchday);
  }
  return e;
}

export function earn(state: GameState, teamId: string, kind: IncomeKind, amount: number, matchday?: number) {
  if (!amount) return;
  const club = clubOf(state, teamId);
  const e = entry(state, club, matchday);
  e.income[kind] = (e.income[kind] ?? 0) + amount;
  club.balance += amount;
  e.balance = club.balance;
}

export function spend(state: GameState, teamId: string, kind: ExpenseKind, amount: number, matchday?: number) {
  if (!amount) return;
  const club = clubOf(state, teamId);
  const e = entry(state, club, matchday);
  e.expense[kind] = (e.expense[kind] ?? 0) + amount;
  club.balance -= amount;
  e.balance = club.balance;
}

export function ticketRevenue(home: Club, away: Club, cfg: GameConfig = DEFAULT_CONFIG): number {
  const i = cfg.economy.income;
  return Math.round((i.ticketsBase * (0.6 + (home.reputation / 100) * 0.8) * (1 + (away.reputation / 100) * 0.3)) / 10) * 10;
}

export function matchPrize(won: boolean, method: MatchOutcome['method'], cfg: GameConfig = DEFAULT_CONFIG): number {
  const p = cfg.economy.income.matchPrize;
  return won ? (method === 'ko' ? p.koWin : p.pointsWin) : method === 'ko' ? p.koLoss : p.pointsLoss;
}

/** Money of one played matchday for every stable: tickets, prizes, sponsor, wages, upkeep, medical care, scouts. */
export function weeklyFinances(state: GameState, played: Fixture[], cfg: GameConfig = DEFAULT_CONFIG) {
  const md = currentWeek(state);
  const eco = cfg.economy;
  for (const f of played) {
    const r = f.result;
    if (!r) continue;
    earn(state, f.home, 'tickets', ticketRevenue(clubOf(state, f.home), clubOf(state, f.away), cfg), md);
    earn(state, f.home, 'prizes', matchPrize(r.winner === 0, r.method, cfg), md);
    earn(state, f.away, 'prizes', matchPrize(r.winner === 1, r.method, cfg), md);
  }
  for (const team of state.teams) {
    const club = clubOf(state, team.id);
    earn(state, team.id, 'sponsor', eco.income.sponsorBase + Math.round(club.reputation * eco.income.sponsorPerReputation), md);
    let wages = 0;
    let upkeep = 0;
    let injured = 0;
    for (const c of team.creatures) {
      const cost = weeklyCost(c);
      wages += cost.wage;
      upkeep += cost.upkeep;
      if (isInjured(c)) injured++;
    }
    spend(state, team.id, 'wages', wages, md);
    spend(state, team.id, 'upkeep', upkeep, md);
    spend(state, team.id, 'medical', injured * eco.expense.medicalPerInjury, md);
    if (team.id === state.playerTeamId) spend(state, team.id, 'scouting', state.scouting.missions.length * eco.expense.scoutPerWeek, md);
  }
  const player = clubOf(state, state.playerTeamId);
  if (player.balance < 0) pushMessage(state, { kind: 'financeWarning', balance: player.balance });
}

/** End of season: prize money by final position and reputation changes. */
export function seasonPrizes(state: GameState, cfg: GameConfig = DEFAULT_CONFIG) {
  const eco = cfg.economy;
  const table = computeStandings(state.teams.map((t) => t.id), state.fixtures, cfg);
  const middle = (table.length + 1) / 2;
  table.forEach((row, i) => {
    const pos = i + 1;
    const amount = eco.income.seasonPrize[i] ?? eco.income.seasonPrize[eco.income.seasonPrize.length - 1]!;
    earn(state, row.teamId, 'prizes', amount);
    const club = clubOf(state, row.teamId);
    club.reputation = clamp(Math.round(club.reputation + (middle - pos) * eco.club.reputationPerPlace), 10, 100);
    if (row.teamId === state.playerTeamId) pushMessage(state, { kind: 'seasonPrize', position: pos, amount });
  });
}

/** Keeps the ledger to the current and previous season. */
export function trimLedgers(state: GameState) {
  for (const club of Object.values(state.clubs)) club.ledger = club.ledger.filter((e) => e.season >= state.season - 1);
}

/** Weekly wage bill + upkeep of a team (for display and AI budgeting). */
export function weeklyBill(state: GameState, teamId: string): number {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return 0;
  return team.creatures.reduce((s, c) => {
    const w = weeklyCost(c);
    return s + w.wage + w.upkeep;
  }, 0);
}
