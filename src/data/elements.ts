import type { ElementDef, ElementId } from './schema.ts';

export const ELEMENTS: Record<ElementId, ElementDef> = {
  fire: { id: 'fire', name: 'Fire', color: '#d9622b' },
  water: { id: 'water', name: 'Water', color: '#3f8fc9' },
  earth: { id: 'earth', name: 'Earth', color: '#9a7a4a' },
  air: { id: 'air', name: 'Air', color: '#9fc4d6' },
  nature: { id: 'nature', name: 'Nature', color: '#5f9e4a' },
  shadow: { id: 'shadow', name: 'Shadow', color: '#8a62b8' },
  light: { id: 'light', name: 'Light', color: '#e6c55a' },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS) as ElementId[];
