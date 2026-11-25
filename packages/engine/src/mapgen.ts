import { TERRAINS, TERRAIN_IDS, type Region, type RaceId, type TerrainId, RACES } from '@hp/content';
import { MAP_SHAPES, MAX_TILES, MIN_TILES, SIZE_PRESETS, type MapSetup, type MapShape, type SizePreset } from './config';
import { EngineError } from './errors';
import { Rng } from './rng';

/**
 * The centre fragment holds the Stone of Beginnings inside the void. 'void' marks a square of the
 * grid that lies outside the map's outline: nobody can step on it, see it or count it.
 */
export type CellTerrain = TerrainId | 'core' | 'void';

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
  /** The outline the player chose; left out on the square maps of the size presets. */
  shape?: MapShape;
}

/** Terrain of a fragment that is part of the map. */
export type LandTerrain = TerrainId | 'core';

/** The terrain of a fragment heroes can stand on; a square outside the outline is an error. */
export function landAt(map: Pick<GameMap, 'cells'>, index: number): LandTerrain {
  const t = map.cells[index]?.terrain;
  if (t === undefined || t === 'void') throw new EngineError('map.void', `Fragment ${index} is not on the map.`);
  return t;
}

/** True for a fragment that is part of the map, false for a square outside its outline. */
export const insideMap = (cell: Pick<Cell, 'terrain'>) => cell.terrain !== 'void';

const DECK_TOTAL = TERRAIN_IDS.reduce((sum, id) => sum + TERRAINS[id].deckCount, 0);
const SECTORS: Region[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

/** Compass region of a cell, with north at the top of the grid. */
export function regionOf(x: number, y: number, width: number, height: number): Region {
  return regionAround(x, y, (width - 1) / 2, (height - 1) / 2);
}

/** Compass region of a cell seen from a middle point (cx, cy). */
function regionAround(x: number, y: number, cx: number, cy: number): Region {
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return 'C';
  const angle = Math.atan2(-dy, dx);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[sector]!;
}

/** The fragments next to a fragment, left, right, up and down. Squares outside the map's outline are left out. */
export function neighbours(map: Pick<GameMap, 'width' | 'height'> & { cells?: Cell[] }, index: number): number[] {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  const out: number[] = [];
  if (y > 0) out.push(index - map.width);
  if (x < map.width - 1) out.push(index + 1);
  if (y < map.height - 1) out.push(index + map.width);
  if (x > 0) out.push(index - 1);
  return map.cells ? out.filter((n) => insideMap(map.cells![n]!)) : out;
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

/* ---------- Outlines ---------- */

/** A regular polygon's "distance" from its middle, with the apothem as 1: equal values trace the polygon's outline. */
function polygonGauge(sides: number, first: number) {
  const normals = Array.from({ length: sides }, (_, i) => first + (2 * Math.PI * i) / sides).map((a) => [Math.cos(a), Math.sin(a)] as const);
  return (x: number, y: number) => Math.max(...normals.map(([a, b]) => x * a + y * b));
}

/**
 * How far a point (x right, y up, in fragments from the middle) lies from the middle in each outline.
 * Equal values make the outline's shape, so the map grows from the middle in that shape.
 */
const GAUGES: Record<MapShape, (x: number, y: number) => number> = {
  square: (x, y) => Math.max(Math.abs(x), Math.abs(y)),
  rectangle: (x, y) => Math.max(Math.abs(x) / 1.5, Math.abs(y)),
  rhombus: (x, y) => Math.abs(x) + Math.abs(y),
  circle: (x, y) => Math.hypot(x, y),
  pentagon: polygonGauge(5, -Math.PI / 2), // flat side at the bottom, a point at the top
  hexagon: polygonGauge(6, Math.PI / 2), // flat top and bottom
};

/** Which squares of a half-filled outer ring come first: the roundest, so corners fill last. A rectangle keeps its 3:2 stretch. */
const ROUNDNESS: Partial<Record<MapShape, (x: number, y: number) => number>> = {
  rectangle: (x, y) => Math.hypot(x / 1.5, y),
};

export interface ShapeLayout {
  width: number;
  height: number;
  /** Per grid square (row by row): is it part of the map? */
  inside: boolean[];
  /** Per grid square: rings from the middle (0 = middle), -1 outside the outline. */
  ring: number[];
  /** The middle point in grid coordinates (may fall between squares). */
  cx: number;
  cy: number;
}

/**
 * Lays out exactly `tiles` fragments in an outline. The map grows from the middle one fragment at a
 * time, always taking the neighbouring square nearest the middle in that outline, so the map is in one
 * piece, has no holes and keeps the outline's proportions (a rhombus stays a rhombus, never a strip).
 */
export function shapeLayout(shape: MapShape, tiles: number): ShapeLayout {
  const gauge = GAUGES[shape];
  const round = ROUNDNESS[shape] ?? Math.hypot;
  const R = Math.ceil(Math.sqrt(tiles) * 1.6) + 3;
  const side = 2 * R + 1;
  const id = (x: number, y: number) => (y + R) * side + (x + R);
  let best: { picked: [number, number][]; worst: number; ox: number; oy: number } | null = null;
  // The middle may sit on a fragment or between two or four of them: whichever keeps the outline tightest.
  for (const [ox, oy] of [[0, 0], [0.5, 0.5], [0.5, 0], [0, 0.5]] as const) {
    const key = (x: number, y: number) => {
      const dx = x - ox;
      const dy = oy - y;
      return [gauge(dx, dy), round(dx, dy), (Math.atan2(dx, dy) + 2 * Math.PI) % (2 * Math.PI)] as const;
    };
    const less = (a: readonly number[], b: readonly number[]) => {
      for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > 1e-9) return a[i]! < b[i]!;
      return false;
    };
    const chosen = new Set<number>();
    const frontier = new Map<number, [number, number]>([[id(0, 0), [0, 0]]]);
    const picked: [number, number][] = [];
    let worst = 0;
    while (picked.length < tiles) {
      let pick: [number, number] | null = null;
      let pickKey: readonly number[] = [];
      for (const cell of frontier.values()) {
        const k = key(cell[0], cell[1]);
        if (!pick || less(k, pickKey)) { pick = cell; pickKey = k; }
      }
      const [x, y] = pick!;
      frontier.delete(id(x, y));
      chosen.add(id(x, y));
      picked.push([x, y]);
      worst = Math.max(worst, pickKey[0]!);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (Math.abs(nx) > R || Math.abs(ny) > R || chosen.has(id(nx, ny))) continue;
        frontier.set(id(nx, ny), [nx, ny]);
      }
    }
    if (!best || worst < best.worst - 1e-9) best = { picked, worst, ox, oy };
  }
  const { picked, ox, oy } = best!;
  const minX = Math.min(...picked.map((p) => p[0]));
  const minY = Math.min(...picked.map((p) => p[1]));
  const width = Math.max(...picked.map((p) => p[0])) - minX + 1;
  const height = Math.max(...picked.map((p) => p[1])) - minY + 1;
  const inside = new Array<boolean>(width * height).fill(false);
  const ring = new Array<number>(width * height).fill(-1);
  for (const [x, y] of picked) {
    const i = (y - minY) * width + (x - minX);
    inside[i] = true;
    ring[i] = Math.floor(gauge(x - ox, oy - y) + 1e-9);
  }
  return { width, height, inside, ring, cx: ox - minX, cy: oy - minY };
}

/* ---------- Terrain mix ---------- */

/** Fragments with buildings on them: their number is capped. */
export const BUILDING_IDS: TerrainId[] = ['city', 'village', 'inn', 'monument'];
/** Open, easy ground where heroes can start and walk. */
export const OPEN_GROUND: TerrainId[] = ['forest', 'fields'];

export interface TerrainLimit { min: number; max: number }

/** How many buildings a map of `slots` fragments may hold in all. */
export const buildingCap = (slots: number) => Math.ceil(slots * 0.3);
/** At least this many fragments of forest and fields together. */
export const openGroundMin = (slots: number) => Math.ceil(slots / 5);

/** Lowest and highest count of each terrain on a map of `slots` fragments. */
export function terrainLimits(slots: number): Record<TerrainId, TerrainLimit> {
  const out = Object.fromEntries(TERRAIN_IDS.map((id) => [id, { min: 0, max: slots }])) as Record<TerrainId, TerrainLimit>;
  out.city = { min: 1, max: Math.max(1, Math.ceil(slots / 30)) };
  out.village = { min: 2, max: Math.ceil(slots / 8) };
  out.inn = { min: 0, max: Math.ceil(slots / 12) };
  out.monument = { min: 0, max: Math.ceil(slots / 12) };
  return out;
}

const total = (pool: Partial<Record<TerrainId, number>>, ids: TerrainId[] = TERRAIN_IDS) => ids.reduce((sum, id) => sum + (pool[id] ?? 0), 0);

/** Why a terrain mix does not fit a map of `slots` fragments, or null when it does. */
export function poolProblem(slots: number, pool: Partial<Record<TerrainId, number>>): string | null {
  const limits = terrainLimits(slots);
  for (const id of TERRAIN_IDS) {
    const n = pool[id] ?? 0;
    if (!Number.isInteger(n) || n < limits[id].min || n > limits[id].max) return `${id} must be ${limits[id].min} to ${limits[id].max}.`;
  }
  if (total(pool) !== slots) return `The terrain must add up to ${slots} fragments.`;
  if (total(pool, BUILDING_IDS) > buildingCap(slots)) return `At most ${buildingCap(slots)} buildings.`;
  if (total(pool, OPEN_GROUND) < openGroundMin(slots)) return `At least ${openGroundMin(slots)} forest and fields.`;
  return null;
}

/** Checks a custom map before a game starts on it. */
export function validateMapSetup(setup: MapSetup): void {
  if (!setup || !Number.isInteger(setup.tiles) || setup.tiles < MIN_TILES || setup.tiles > MAX_TILES) {
    throw new EngineError('map.tiles', `A map has ${MIN_TILES} to ${MAX_TILES} fragments.`);
  }
  if (!MAP_SHAPES.includes(setup.shape)) throw new EngineError('map.shape', 'Unknown map shape.');
  if (setup.terrain) {
    const unknown = Object.keys(setup.terrain).find((k) => !TERRAIN_IDS.includes(k as TerrainId));
    if (unknown) throw new EngineError('map.terrain', `Unknown terrain ${unknown}.`);
    const problem = poolProblem(setup.tiles - 1, setup.terrain);
    if (problem) throw new EngineError('map.terrain', problem);
  }
}

/**
 * Changes one terrain by one fragment and keeps the total: an extra fragment is taken from the
 * most plentiful natural terrain, a removed one turns into forest (or fields, when forest is removed).
 * Null when the change would break a limit.
 */
export function adjustPool(slots: number, pool: Record<TerrainId, number>, id: TerrainId, delta: 1 | -1): Record<TerrainId, number> | null {
  const limits = terrainLimits(slots);
  const next = { ...pool };
  const other: TerrainId = id === 'forest' ? 'fields' : 'forest';
  if (delta === 1) {
    if (next[id] >= limits[id].max) return null;
    if (BUILDING_IDS.includes(id) && total(next, BUILDING_IDS) >= buildingCap(slots)) return null;
    const donors = TERRAIN_IDS.filter((d) => d !== id && !BUILDING_IDS.includes(d) && next[d] > limits[d].min)
      .filter((d) => !(OPEN_GROUND.includes(d) && !OPEN_GROUND.includes(id) && total(next, OPEN_GROUND) <= openGroundMin(slots)))
      .sort((a, b) => next[b] - next[a] || TERRAIN_IDS.indexOf(a) - TERRAIN_IDS.indexOf(b));
    const donor = donors[0];
    if (!donor) return null;
    next[donor]--;
    next[id]++;
  } else {
    if (next[id] <= limits[id].min) return null;
    next[id]--;
    next[other]++;
  }
  return poolProblem(slots, next) ? null : next;
}

/**
 * Carries a terrain mix over to a map of another size: the same proportions, then nudged back
 * within every limit.
 */
export function fitPool(slots: number, weights: Partial<Record<TerrainId, number>>): Record<TerrainId, number> {
  const sum = total(weights);
  if (sum <= 0) return terrainPool(slots);
  const limits = terrainLimits(slots);
  const exact = TERRAIN_IDS.map((id) => ({ id, value: ((weights[id] ?? 0) * slots) / sum }));
  const pool = Object.fromEntries(exact.map((e) => [e.id, Math.floor(e.value)])) as Record<TerrainId, number>;
  const byRemainder = [...exact].sort((a, b) => (b.value % 1) - (a.value % 1));
  for (let i = 0, left = slots - total(pool); left > 0; i++, left--) pool[byRemainder[i % byRemainder.length]!.id]++;
  for (const id of TERRAIN_IDS) pool[id] = Math.min(limits[id].max, Math.max(limits[id].min, pool[id]));
  // Too many buildings: trim the largest building group first.
  while (total(pool, BUILDING_IDS) > buildingCap(slots)) {
    const b = BUILDING_IDS.filter((x) => pool[x] > limits[x].min).sort((x, y) => pool[y] - pool[x])[0]!;
    pool[b]--;
    pool.forest++;
  }
  const naturals = TERRAIN_IDS.filter((x) => !BUILDING_IDS.includes(x));
  // Back to the exact total, through the natural terrain.
  while (total(pool) > slots) {
    const d = naturals.filter((x) => pool[x] > limits[x].min).sort((x, y) => pool[y] - pool[x])[0]!;
    pool[d]--;
  }
  while (total(pool) < slots) pool.forest++;
  // Enough open ground to walk on.
  while (total(pool, OPEN_GROUND) < openGroundMin(slots)) {
    const d = naturals.filter((x) => !OPEN_GROUND.includes(x) && pool[x] > 0).sort((x, y) => pool[y] - pool[x])[0]!;
    pool[d]--;
    pool.forest++;
  }
  return pool;
}

/* ---------- The map ---------- */

/**
 * Builds a map from a seed. The same seed and size always give the same map. A size preset makes a
 * full square; a map setup makes the player's own outline and terrain mix.
 */
export function generateMap(size: SizePreset | MapSetup, rng: Rng): GameMap {
  const setup: MapSetup = typeof size === 'string'
    ? { tiles: SIZE_PRESETS[size].width * SIZE_PRESETS[size].height, shape: 'square' }
    : size;
  const layout = shapeLayout(setup.shape, setup.tiles);
  const { width, height } = layout;
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const inside = layout.inside[index]!;
      cells.push({
        index,
        x,
        y,
        terrain: inside ? 'core' : 'void',
        region: regionAround(x, y, layout.cx, layout.cy),
        // Whole rings: the 1 to 4 middle fragments are ring 0.
        ring: Math.max(0, layout.ring[index]!),
      });
    }
  }
  const land = cells.filter(insideMap);
  for (const c of land) if (c.ring === 0) c.region = 'C';
  const map: GameMap = { width, height, cells, maxRing: Math.max(...land.map((c) => c.ring)) };
  if (typeof size !== 'string') map.shape = setup.shape;
  const pool: Record<TerrainId, number> = setup.terrain
    ? { ...(Object.fromEntries(TERRAIN_IDS.map((id) => [id, 0])) as Record<TerrainId, number>), ...setup.terrain }
    : terrainPool(land.length - 1);
  const placed = new Set<number>();
  const middle = land.filter((c) => c.ring === 0);
  const centre = middle[rng.int(middle.length)]!.index;
  placed.add(centre);

  // Outer cells first so regional terrain settles at the edges where the races live.
  const order = rng.shuffle(land.filter((c) => c.index !== centre)).sort((a, b) => b.ring - a.ring);
  for (const cell of order) {
    const near = neighbours(map, cell.index).filter((n) => placed.has(n)).map((n) => cells[n]!.terrain as TerrainId | 'core');
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
  const easy = (c: Cell) => c.terrain !== 'core' && c.terrain !== 'void' && !TERRAINS[c.terrain].hard && !taken.includes(c.index);
  const candidates = map.cells.filter((c) => easy(c) && c.region === home);
  const pool = candidates.length > 0 ? candidates : map.cells.filter(easy);
  pool.sort((a, b) => b.ring - a.ring || a.index - b.index);
  return pool[0]!.index;
}
