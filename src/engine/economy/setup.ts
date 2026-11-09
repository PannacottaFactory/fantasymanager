/** Economy at the start of a game, and upgrade of phase-2 saves (pure). */
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import type { GameState } from '../league/types.ts';
import type { Team } from '../model.ts';
import { fillFreeAgents, initialContract } from './market.ts';

/** Quality tier closest to a team's average potential (to guess reputation for old saves). */
export function guessQuality(avgPotential: number, cfg: GameConfig): QualityId {
  let best: QualityId = 'professional';
  let gap = Infinity;
  for (const [id, q] of Object.entries(cfg.generation.qualities)) {
    const d = Math.abs(q.potentialMean - avgPotential);
    if (d < gap) {
      gap = d;
      best = id as QualityId;
    }
  }
  return best;
}

/** Treasury, reputation and contracts of one stable (mutates). */
export function initClub(state: GameState, team: Team, quality: QualityId, rng: Rng, cfg: GameConfig = DEFAULT_CONFIG) {
  const eco = cfg.economy.club;
  const reputation = eco.reputation[quality as keyof typeof eco.reputation] ?? 50;
  state.clubs[team.id] = { balance: eco.startBalance[quality as keyof typeof eco.startBalance] ?? 40000, reputation, ledger: [] };
  for (const c of team.creatures) if (!c.contract) initialContract(state, c, reputation, rng, cfg);
}

/** Clubs, contracts, free agents and scouting for a state that has none (mutates). */
export function initEconomy(state: GameState, qualities: Record<string, QualityId>, cfg: GameConfig = DEFAULT_CONFIG) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'economy', state.season));
  state.clubs = {};
  for (const team of state.teams) initClub(state, team, qualities[team.id] ?? 'professional', rng, cfg);
  state.freeAgents = [];
  fillFreeAgents(state, rng, cfg);
  state.scouting = { knowledge: {}, missions: [] };
  state.offers = [];
  state.bids = {};
  state.forSale = [];
  state.nextId = state.nextId ?? 1;
}
