import type { InjuryDef } from './schema.ts';

const list: InjuryDef[] = [
  { id: 'bruises', name: 'Heavy bruising', weeks: [1, 1], severity: 'minor', relapseRisk: 0, cause: 'any', weight: 8 },
  { id: 'gash', name: 'Deep gash', weeks: [1, 3], severity: 'minor', relapseRisk: 0.05, cause: 'physical', weight: 6 },
  { id: 'sprained-limb', name: 'Sprained limb', weeks: [2, 4], severity: 'moderate', relapseRisk: 0.15, cause: 'any', weight: 5 },
  { id: 'cracked-ribs', name: 'Cracked ribs', weeks: [3, 6], severity: 'moderate', relapseRisk: 0.1, cause: 'physical', weight: 4 },
  { id: 'torn-wing', name: 'Torn wing membrane', weeks: [3, 7], severity: 'moderate', relapseRisk: 0.2, cause: 'any', weight: 2 },
  { id: 'burns', name: 'Severe burns', weeks: [2, 5], severity: 'moderate', relapseRisk: 0.05, cause: 'fire', weight: 5 },
  { id: 'frostbite', name: 'Waterlogged lungs', weeks: [1, 3], severity: 'minor', relapseRisk: 0.05, cause: 'water', weight: 4 },
  { id: 'soul-wound', name: 'Soul wound', weeks: [2, 6], severity: 'moderate', relapseRisk: 0.15, cause: 'shadow', weight: 4 },
  { id: 'concussion', name: 'Concussion', weeks: [1, 4], severity: 'moderate', relapseRisk: 0.2, cause: 'earth', weight: 4 },
  { id: 'broken-limb', name: 'Broken limb', weeks: [6, 12], severity: 'severe', relapseRisk: 0.15, cause: 'any', weight: 2 },
  { id: 'shattered-horn', name: 'Shattered horn or tusk', weeks: [4, 8], severity: 'severe', relapseRisk: 0.05, cause: 'physical', weight: 1 },
  { id: 'crippling-wound', name: 'Crippling wound', weeks: [20, 40], severity: 'career', relapseRisk: 0.4, cause: 'any', weight: 0.3 },
];

export const INJURIES: Record<string, InjuryDef> = Object.fromEntries(list.map((i) => [i.id, i]));
