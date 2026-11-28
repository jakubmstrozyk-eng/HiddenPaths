import { describe, expect, it } from 'vitest';
import { TERRAIN_IDS, type TerrainId } from '@hp/content';
import {
  adjustPool, applyAction, BUILDING_IDS, buildingCap, createGame, entryCell, fitPool, generateMap, insideMap, legalActions, MAP_SHAPES, MAX_TILES,
  MIN_TILES, neighbours, poolProblem, Rng, seedFromString, shapeLayout, sizeForTiles, SIDES, terrainLimits, terrainPool, validateMapSetup,
  type GameConfig, type MapSetup,
} from '../src';

const hero = { name: 'A', race: 'humans' as const, profession: 'warrior' as const, bonus: { com: 10 }, missions: ['hunter'] };
const config = (map: MapSetup): GameConfig => ({ size: sizeForTiles(map.tiles), map, difficulty: 'normal', winMode: 'exploration', multiplayer: false });
const sum = (pool: Partial<Record<TerrainId, number>>) => Object.values(pool).reduce((a, b) => a + (b ?? 0), 0);

describe('map outlines', () => {
  for (const shape of MAP_SHAPES) {
    it(`lays out a ${shape} of any size in one piece, without holes or thin strips`, () => {
      for (let tiles = MIN_TILES; tiles <= MAX_TILES; tiles++) {
        const l = shapeLayout(shape, tiles);
        const land = l.inside.flatMap((v, i) => (v ? [i] : []));
        expect(land).toHaveLength(tiles);
        // Proportions: the long side at most twice the short one (a rectangle is 3:2).
        expect(Math.max(l.width, l.height) / Math.min(l.width, l.height)).toBeLessThanOrEqual(shape === 'rectangle' ? 2 : 1.5);
        expect(l.width).toBeGreaterThanOrEqual(5);
        expect(l.height).toBeGreaterThanOrEqual(5);
        // One piece: every fragment reachable from the first.
        const map = { width: l.width, height: l.height };
        const seen = new Set([land[0]!]);
        const queue = [land[0]!];
        while (queue.length) for (const n of neighbours(map, queue.pop()!)) if (l.inside[n] && !seen.has(n)) { seen.add(n); queue.push(n); }
        expect(seen.size).toBe(tiles);
        // No holes: every square outside the outline is reachable from the board's edge through other such squares.
        const gaps = l.inside.flatMap((v, i) => (v ? [] : [i]));
        const edge = gaps.filter((i) => i % l.width === 0 || i % l.width === l.width - 1 || i < l.width || i >= l.width * (l.height - 1));
        const out = new Set(edge);
        const q2 = [...edge];
        while (q2.length) for (const n of neighbours(map, q2.pop()!)) if (!l.inside[n] && !out.has(n)) { out.add(n); q2.push(n); }
        expect(out.size).toBe(gaps.length);
        expect(l.ring.some((r) => r === 0)).toBe(true);
      }
    });
  }

  it('makes the size presets full squares, as before', () => {
    for (const side of [5, 6, 7, 8]) {
      const l = shapeLayout('square', side * side);
      expect([l.width, l.height]).toEqual([side, side]);
      expect(l.inside.every(Boolean)).toBe(true);
    }
  });

  it('builds the same map from a preset and from the same square setup', () => {
    const a = generateMap('medium', new Rng(seedFromString('same')));
    const b = generateMap({ tiles: 36, shape: 'square' }, new Rng(seedFromString('same')));
    expect(b.cells).toEqual(a.cells);
  });
});

describe('terrain mix', () => {
  it('recommends a mix that fits every limit', () => {
    for (let slots = MIN_TILES - 1; slots < MAX_TILES; slots++) {
      expect(poolProblem(slots, terrainPool(slots))).toBeNull();
    }
  });

  it('carries any mix over to another size within the limits', () => {
    const odd: Record<TerrainId, number> = Object.fromEntries(TERRAIN_IDS.map((id) => [id, 0])) as Record<TerrainId, number>;
    odd.mountains = 30;
    odd.city = 9;
    odd.inn = 9;
    for (let slots = MIN_TILES - 1; slots < MAX_TILES; slots += 7) {
      for (const weights of [odd, terrainPool(100), { desert: 1 }]) {
        const pool = fitPool(slots, weights);
        expect(poolProblem(slots, pool)).toBeNull();
      }
    }
  });

  it('keeps the total when one terrain changes, and caps the buildings', () => {
    const slots = 47;
    let pool = terrainPool(slots);
    const more = adjustPool(slots, pool, 'lake', 1)!;
    expect(more.lake).toBe(pool.lake + 1);
    expect(sum(more)).toBe(slots);
    const less = adjustPool(slots, pool, 'mountains', -1)!;
    expect(less.mountains).toBe(pool.mountains - 1);
    expect(less.forest).toBe(pool.forest + 1);
    // Buildings stop at their own limit and at the cap for all of them.
    for (let i = 0; i < 40; i++) for (const b of BUILDING_IDS) pool = adjustPool(slots, pool, b, 1) ?? pool;
    const limits = terrainLimits(slots);
    expect(BUILDING_IDS.every((b) => pool[b] <= limits[b].max)).toBe(true);
    expect(BUILDING_IDS.reduce((s, b) => s + pool[b], 0)).toBeLessThanOrEqual(buildingCap(slots));
    expect(adjustPool(slots, terrainPool(slots), 'city', -1)?.city ?? 1).toBeGreaterThanOrEqual(1);
  });

  it('places exactly the chosen mix', () => {
    const terrain = fitPool(39, { forest: 10, lake: 10, city: 1, village: 2 });
    const map = generateMap({ tiles: 40, shape: 'rhombus', terrain }, new Rng(5));
    for (const id of TERRAIN_IDS) expect(map.cells.filter((c) => c.terrain === id)).toHaveLength(terrain[id]);
    expect(map.cells.filter((c) => c.terrain === 'core')).toHaveLength(1);
  });
});

describe('custom maps in a game', () => {
  it('refuses fewer than 25 fragments, an unknown shape or a mix that breaks the limits', () => {
    expect(() => validateMapSetup({ tiles: 24, shape: 'square' })).toThrow(/25/);
    expect(() => validateMapSetup({ tiles: 30, shape: 'strip' as never })).toThrow(/shape/);
    expect(() => validateMapSetup({ tiles: 30, shape: 'circle', terrain: { forest: 29 } })).toThrow(/must be/);
    expect(() => createGame('x', config({ tiles: 20, shape: 'square' }), [{ id: 'p', character: hero }])).toThrow();
  });

  for (const shape of MAP_SHAPES) {
    it(`lets a hero step onto a ${shape} map from every side`, () => {
      const g = createGame(`shape-${shape}`, config({ tiles: 41, shape }), [{ id: 'p', character: hero }]);
      expect(g.map.cells.filter(insideMap)).toHaveLength(41);
      expect(g.map.shape).toBe(shape);
      expect(g.map.cells.filter((c) => c.terrain === 'core')).toHaveLength(1);
      for (const side of SIDES) expect(insideMap(g.map.cells[entryCell(g.map, side)]!)).toBe(true);
      const enter = legalActions(g, 'p').find((a) => a.type === 'enter')!;
      const after = applyAction(g, 'p', enter);
      const p = after.players[0]!;
      for (const n of neighbours(after.map, p.position)) expect(insideMap(after.map.cells[n]!)).toBe(true);
      for (const a of legalActions(after, 'p')) if (a.type === 'move') expect(insideMap(after.map.cells[a.to]!)).toBe(true);
    });
  }
});
