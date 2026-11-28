import type { Terrain, TerrainId } from './types';

/** Fragment types and their deck counts, from the "Fragmenty" chapter. 104 fragments in total. */
export const TERRAINS: Record<TerrainId, Terrain> = {
  forest: {
    id: 'forest', name: { pl: 'Las', en: 'Forest' }, deckCount: 30, hard: false, drawsEvent: true,
    actions: ['hunt', 'gather', 'camp', 'mine'], regions: ['W', 'NW', 'SW', 'N'],
  },
  mountains: {
    id: 'mountains', name: { pl: 'Góry', en: 'Mountains' }, deckCount: 15, hard: true, drawsEvent: true,
    actions: ['hunt', 'herbalism', 'camp', 'mine'], regions: ['NW', 'N'],
  },
  fields: {
    id: 'fields', name: { pl: 'Pola', en: 'Fields' }, deckCount: 15, hard: false, drawsEvent: true,
    actions: ['hunt', 'camp', 'build'], regions: ['S', 'NE', 'E'],
  },
  river: {
    id: 'river', name: { pl: 'Rzeka', en: 'River' }, deckCount: 6, hard: true, drawsEvent: true,
    actions: ['hunt', 'camp', 'swim'], regions: ['SW', 'SE', 'S'],
  },
  lake: {
    id: 'lake', name: { pl: 'Jezioro', en: 'Lake' }, deckCount: 6, hard: true, drawsEvent: true,
    actions: ['hunt', 'camp', 'herbalism'], regions: ['W', 'SE', 'E'],
  },
  desert: {
    id: 'desert', name: { pl: 'Pustynia', en: 'Desert' }, deckCount: 6, hard: true, drawsEvent: true,
    actions: [], regions: ['SW'],
  },
  inn: {
    id: 'inn', name: { pl: 'Gospoda', en: 'Inn' }, deckCount: 5, hard: false, drawsEvent: false,
    actions: ['meal', 'stay', 'gossip'], regions: [],
  },
  monument: {
    id: 'monument', name: { pl: 'Monument', en: 'Monument' }, deckCount: 6, hard: false, drawsEvent: true,
    actions: ['meditate'], regions: [],
  },
  cave: {
    id: 'cave', name: { pl: 'Jaskinia', en: 'Cave' }, deckCount: 6, hard: true, drawsEvent: true,
    actions: ['mine', 'camp'], regions: ['NW', 'N'],
  },
  village: {
    id: 'village', name: { pl: 'Wioska', en: 'Village' }, deckCount: 6, hard: false, drawsEvent: false, settlement: true,
    actions: ['meal', 'stay', 'gossip', 'camp', 'market', 'smith', 'merchant', 'quartermaster', 'herbalist', 'train', 'scholar', 'board'],
    regions: [],
  },
  city: {
    id: 'city', name: { pl: 'Miasto', en: 'City' }, deckCount: 3, hard: false, drawsEvent: false, settlement: true,
    actions: ['meal', 'stay', 'gossip', 'camp', 'market', 'smith', 'merchant', 'quartermaster', 'herbalist', 'train', 'scholar', 'mystic', 'board', 'portal'],
    regions: ['S'],
  },
};

export const TERRAIN_IDS = Object.keys(TERRAINS) as TerrainId[];
