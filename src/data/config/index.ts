import { COMBAT_CONFIG } from './combat.ts';
import { ELEMENT_CONFIG } from './elements.ts';
import { GENERATION_CONFIG } from './generation.ts';
import { LEAGUE_CONFIG } from './league.ts';
import { MATCH_CONFIG } from './match.ts';
import { REPORT_CONFIG } from './report.ts';

/**
 * Single entry point for every balancing value.
 * Engine functions receive a GameConfig so balancing sims can run with variants.
 */
export const DEFAULT_CONFIG = {
  combat: COMBAT_CONFIG,
  elements: ELEMENT_CONFIG,
  generation: GENERATION_CONFIG,
  match: MATCH_CONFIG,
  report: REPORT_CONFIG,
  league: LEAGUE_CONFIG,
};

export type GameConfig = typeof DEFAULT_CONFIG;
export type { QualityId } from './generation.ts';
