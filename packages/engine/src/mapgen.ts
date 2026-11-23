import { TERRAINS, TERRAIN_IDS, type Region, type RaceId, type TerrainId, RACES } from '@hp/content';
import { SIZE_PRESETS, type SizePreset } from './config';
import { Rng } from './rng';

/** The centre fragment holds the Stone of Beginnings inside the void. */
export type CellTerrain = TerrainId | 'core';

export interface Cell {
  index: number;
  x: number;
  y: number;
  terrain: CellTerrain;
  region: Region;
  /** Distance from the centre in fragments (0 = centre). */
  ring: number;
}

export interface GameMap {
  width: number;
  height: number;
  cells: Cell[];
  maxRing: number;
}

const DECK_TOTAL = TERRAIN_IDS.reduce((sum, id) => sum + TERRAINS[id].deckCount, 0);
const SECTORS: Region[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

/** Compass region of a cell, with north at the top of the grid. */
export function regionOf(x: number, y: number, width: number, height: number): Region {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return 'C';
  const angle = Math.atan2(-dy, dx);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[sector]!;
}

export function neighbours(map: Pick<GameMap, 'width' | 'height'>, index: number): number[] {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  const out: number[] = [];
  if (y > 0) out.push(index - map.width);
  if (x < map.width - 1) out.push(index + 1);
  if (y < map.height - 1) out.push(index + map.width);
  if (x > 0) out.push(index - 1);
  return out;
}

/**
 * How many of each terrain a map of `slots` fragments gets: the original deck scaled down
 * (largest remainder), with at least 1 city and 2 villages.
 */
export function terrainPool(slots: number): Record<TerrainId, number> {
  const exact = TERRAIN_IDS.map((id) => ({ id, value: (TERRAINS[id].deckCount * slots) / DECK_TOTAL }));
  const pool = Object.fromEntries(exact.map((e) => [e.id, Math.floor(e.value)])) as Record<TerrainId, number>;
  let left = slots - Object.values(pool).reduce((a, b) => a + b, 0);
  const byRemainder = [...exact].sort((a, b) => (b.value % 1) - (a.value % 1));
  for (let i = 0; left > 0; i++, left--) pool[byRemainder[i % byRemainder.length]!.id]++;

  const ensure = (id: TerrainId, min: number) => {
    while (pool[id] < min) {
      const donor = (['forest', 'fields', 'mountains'] as TerrainId[]).find((d) => pool[d] > 1)!;
      pool[donor]--;
      pool[id]++;
    }
  };
  ensure('city', 1);
  ensure('village', 2);
  return pool;
}

/** Builds a map from a seed. The same seed and size always give the same map. */
export function generateMap(size: SizePreset, rng: Rng): GameMap {
  const { width, height } = SIZE_PRESETS[size];
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({
        index: y * width + x,
        x,
        y,
        terrain: 'core',
        region: regionOf(x, y, width, height),
        ring: Math.max(Math.abs(x - cx), Math.abs(y - cy)),
      });
    }
  }
  const map: GameMap = { width, height, cells, maxRing: Math.max(cx, cy) };
  const pool = terrainPool(cells.length - 1);
  const placed = new Set<number>();
  const centre = cy * width + cx;
  placed.add(centre);

  // Outer cells first so regional terrain settles at the edges where the races live.
  const order = rng.shuffle(cells.filter((c) => c.index !== centre)).sort((a, b) => b.ring - a.ring);
  for (const cell of order) {
    const near = neighbours(map, cell.index).filter((n) => placed.has(n)).map((n) => cells[n]!.terrain);
    const weights = TERRAIN_IDS.map((id) => {
      const count = pool[id];
      if (count <= 0) return 0;
      const t = TERRAINS[id];
      let w = count * (t.regions.includes(cell.region) ? 3 : 1);
      if (id === 'river' && near.includes('river')) w *= 4; // keep rivers flowing
      if (t.settlement && near.some((n) => n !== 'core' && TERRAINS[n].settlement)) w *= 0.2; // spread towns out
      return w;
    });
    const pick = TERRAIN_IDS[rng.weighted(weights)]!;
    pool[pick]--;
    cell.terrain = pick;
    placed.add(cell.index);
  }
  return map;
}

/** Start fragment for a race: an easy fragment on the outer ring of its homeland, else any easy outer fragment. */
export function startCell(map: GameMap, race: RaceId, taken: number[] = []): number {
  const home = RACES[race].homeland;
  const easy = (c: Cell) => c.terrain !== 'core' && !TERRAINS[c.terrain].hard && !taken.includes(c.index);
  const candidates = map.cells.filter((c) => easy(c) && c.region === home);
  const pool = candidates.length > 0 ? candidates : map.cells.filter(easy);
  pool.sort((a, b) => b.ring - a.ring || a.index - b.index);
  return pool[0]!.index;
}
