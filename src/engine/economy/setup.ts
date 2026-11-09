/** Economy at the start of a game, and upgrade of phase-2 saves (pure). */
import { DEFAULT_LANG, isLang } from '../../core/i18n.ts';
import { Rng, deriveSeed } from '../../core/rng.ts';
import { DEFAULT_CONFIG, type GameConfig, type QualityId } from '../../data/config/index.ts';
import type { GameState } from '../league/types.ts';
import { fillFreeAgents, initialContract } from './market.ts';

/** Quality tier closest to a team's average potential (to guess reputation for old saves). */
function guessQuality(avgPotential: number, cfg: GameConfig): QualityId {
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

/** Clubs, contracts, free agents and scouting for a state that has none (mutates). */
export function initEconomy(state: GameState, qualities: Record<string, QualityId>, cfg: GameConfig = DEFAULT_CONFIG) {
  const rng = new Rng(deriveSeed(state.worldSeed, 'economy', state.season));
  const eco = cfg.economy.club;
  state.clubs = {};
  for (const team of state.teams) {
    const q = qualities[team.id] ?? 'professional';
    const reputation = eco.reputation[q as keyof typeof eco.reputation] ?? 50;
    state.clubs[team.id] = { balance: eco.startBalance[q as keyof typeof eco.startBalance] ?? 40000, reputation, ledger: [] };
    for (const c of team.creatures) if (!c.contract) initialContract(state, c, reputation, rng, cfg);
  }
  state.freeAgents = [];
  fillFreeAgents(state, rng, cfg);
  state.scouting = { knowledge: {}, missions: [] };
  state.offers = [];
  state.bids = {};
  state.forSale = [];
  state.nextId = state.nextId ?? 1;
}

/** Upgrades any older save to the current version. */
export function migrateGame(raw: unknown, cfg: GameConfig = DEFAULT_CONFIG): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Omit<GameState, 'version'> & { version: number; lang?: unknown };
  if (s.version === 1) {
    const state = s as unknown as GameState;
    state.version = 2;
    state.lang = isLang(s.lang) ? s.lang : DEFAULT_LANG;
    const qualities: Record<string, QualityId> = {};
    for (const t of state.teams) {
      const avg = t.creatures.reduce((sum, c) => sum + c.potential, 0) / Math.max(1, t.creatures.length);
      qualities[t.id] = guessQuality(avg, cfg);
    }
    initEconomy(state, qualities, cfg);
    return state;
  }
  return s.version === 2 ? (s as GameState) : null;
}
