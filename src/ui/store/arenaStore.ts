/**
 * UI state for the Arena sandbox (phase 1). Holds the two teams being edited,
 * the match seed and the last result. Game logic stays in src/engine.
 */
import { create } from 'zustand';
import { Rng } from '../../core/rng.ts';
import type { QualityId } from '../../data/config/index.ts';
import { generateCreature } from '../../engine/creature/generate.ts';
import { generateTeam } from '../../engine/team/team.ts';
import { replaceCreature } from '../../engine/team/edit.ts';
import type { Team } from '../../engine/model.ts';
import type { MatchResult } from '../../engine/combat/types.ts';
import { randomSeed } from '../format.ts';
import { useSettings } from '../i18n/index.ts';

export type ArenaMode = 'setup' | 'live' | 'report';

interface ArenaState {
  teams: [Team, Team];
  quality: [QualityId, QualityId];
  seed: string;
  /** The player manages the home team at breaks (otherwise the assistant does). */
  playerControls: boolean;
  mode: ArenaMode;
  /** Bumped to restart the live view (rematch). */
  liveKey: number;
  result: MatchResult | null;
  setTeam: (side: 0 | 1, team: Team) => void;
  setQuality: (side: 0 | 1, q: QualityId) => void;
  regenerate: (side: 0 | 1) => void;
  swapSpecies: (side: 0 | 1, creatureId: string, speciesId: string) => void;
  setSeed: (seed: string) => void;
  rollSeed: () => void;
  setPlayerControls: (v: boolean) => void;
  start: () => void;
  finish: (result: MatchResult) => void;
  rematch: (newSeed?: boolean) => void;
  backToSetup: () => void;
}

const freshRng = () => new Rng(randomSeed() + ':' + randomSeed());
const lang = () => useSettings.getState().lang;

export const useArena = create<ArenaState>()((set, get) => ({
  teams: [generateTeam(freshRng(), { quality: 'professional', lang: lang() }), generateTeam(freshRng(), { quality: 'professional', lang: lang() })],
  quality: ['professional', 'professional'],
  seed: randomSeed(),
  playerControls: true,
  mode: 'setup',
  liveKey: 0,
  result: null,
  setTeam: (side, team) => set((s) => ({ teams: side === 0 ? [team, s.teams[1]] : [s.teams[0], team] })),
  setQuality: (side, q) => set((s) => ({ quality: side === 0 ? [q, s.quality[1]] : [s.quality[0], q] })),
  regenerate: (side) => {
    const team = generateTeam(freshRng(), { quality: get().quality[side], lang: lang() });
    get().setTeam(side, team);
  },
  swapSpecies: (side, creatureId, speciesId) => {
    const team = get().teams[side];
    const c = generateCreature(freshRng(), { speciesId, quality: get().quality[side], stableId: team.id, lang: lang() });
    get().setTeam(side, replaceCreature(team, creatureId, c));
  },
  setSeed: (seed) => set({ seed }),
  rollSeed: () => set({ seed: randomSeed() }),
  setPlayerControls: (v) => set({ playerControls: v }),
  start: () => set((s) => ({ mode: 'live', result: null, liveKey: s.liveKey + 1 })),
  finish: (result) => set({ mode: 'report', result }),
  rematch: (newSeed) => set((s) => ({ mode: 'live', result: null, liveKey: s.liveKey + 1, seed: newSeed ? randomSeed() : s.seed })),
  backToSetup: () => set({ mode: 'setup' }),
}));
