import type { Text } from './types';

export type MaterialId =
  | 'wood' | 'iron' | 'tin' | 'copper'
  | 'magma' | 'gold' | 'silver' | 'diamond' | 'gem';

export interface Material {
  id: MaterialId;
  name: Text;
  rare: boolean;
  /** Merchant prices in gold: what he sells it for, and what he pays for it. */
  sell: number;
  buy: number;
}

/** Materials and their merchant prices, from the "Kupiec" table. */
export const MATERIALS: Record<MaterialId, Material> = {
  wood: { id: 'wood', name: { pl: 'Drewno', en: 'Wood' }, rare: false, sell: 1, buy: 0.5 },
  iron: { id: 'iron', name: { pl: 'Żelazo', en: 'Iron' }, rare: false, sell: 2, buy: 1 },
  tin: { id: 'tin', name: { pl: 'Cyna', en: 'Tin' }, rare: false, sell: 1.5, buy: 0.75 },
  copper: { id: 'copper', name: { pl: 'Miedź', en: 'Copper' }, rare: false, sell: 1, buy: 0.5 },
  magma: { id: 'magma', name: { pl: 'Magma', en: 'Magma' }, rare: true, sell: 5, buy: 2.5 },
  gold: { id: 'gold', name: { pl: 'Złoto', en: 'Gold ore' }, rare: true, sell: 10, buy: 5 },
  silver: { id: 'silver', name: { pl: 'Srebro', en: 'Silver' }, rare: true, sell: 7, buy: 3.5 },
  diamond: { id: 'diamond', name: { pl: 'Diament', en: 'Diamond' }, rare: true, sell: 15, buy: 7.5 },
  gem: { id: 'gem', name: { pl: 'Kamień szlachetny', en: 'Gemstone' }, rare: true, sell: 6, buy: 3 },
};

export const COMMON_ORES: MaterialId[] = ['iron', 'tin', 'copper'];
export const RARE_ORES: MaterialId[] = ['magma', 'gold', 'silver', 'diamond', 'gem'];

export type HerbId = 'mountainFlower' | 'forestHerb' | 'fullMoonFruit' | 'lifeLeaf' | 'fieldRose';

export interface Herb {
  id: HerbId;
  name: Text;
  sell: number;
  buy: number;
}

/** Herbs, from the "Zielarz" table. */
export const HERBS: Record<HerbId, Herb> = {
  mountainFlower: { id: 'mountainFlower', name: { pl: 'Kwiat górski', en: 'Mountain flower' }, sell: 1.5, buy: 0.75 },
  forestHerb: { id: 'forestHerb', name: { pl: 'Ziele leśne', en: 'Forest herb' }, sell: 1, buy: 0.5 },
  fullMoonFruit: { id: 'fullMoonFruit', name: { pl: 'Owoc pełni', en: 'Full moon fruit' }, sell: 2.5, buy: 1.25 },
  lifeLeaf: { id: 'lifeLeaf', name: { pl: 'Liść życia', en: 'Leaf of life' }, sell: 5, buy: 2.5 },
  fieldRose: { id: 'fieldRose', name: { pl: 'Róża polna', en: 'Field rose' }, sell: 2.5, buy: 1.25 },
};

export const HERB_IDS = Object.keys(HERBS) as HerbId[];
