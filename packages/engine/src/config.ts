/** Game setup choices: how long and how hard a game is. */
import type { TerrainId } from '@hp/content';

export type SizePreset = 'short' | 'medium' | 'long' | 'epic';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';
export type WinMode = 'stone' | 'exploration';

/** Square maps. On even sides the Stone of Beginnings sits on one of the 4 middle fragments. */
export const SIZE_PRESETS: Record<SizePreset, { width: number; height: number }> = {
  short: { width: 5, height: 5 }, // 25
  medium: { width: 6, height: 6 }, // 36
  long: { width: 7, height: 7 }, // 49
  epic: { width: 8, height: 8 }, // 64
};

export interface DifficultySettings {
  testModifier: number;
  /** "Harder towards the centre": -10 to tests per danger level, more XP. */
  dangerRings: boolean;
  enemyVitality: number;
  startFood: number;
  /** Weight of hostile event cards compared with the deck as written. */
  hostileEvents: number;
  xp: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: { testModifier: 10, dangerRings: false, enemyVitality: 0.8, startFood: 7, hostileEvents: 0.7, xp: 0.75 },
  normal: { testModifier: 0, dangerRings: false, enemyVitality: 1, startFood: 5, hostileEvents: 1, xp: 1 },
  hard: { testModifier: 0, dangerRings: true, enemyVitality: 1.2, startFood: 4, hostileEvents: 1.3, xp: 1.5 },
  nightmare: { testModifier: -10, dangerRings: true, enemyVitality: 1.4, startFood: 3, hostileEvents: 1.6, xp: 2 },
};

/** Outlines a map can take. Each grows evenly from the middle, so no shape ends up as a thin strip. */
export type MapShape = 'square' | 'rectangle' | 'rhombus' | 'circle' | 'pentagon' | 'hexagon';
export const MAP_SHAPES: MapShape[] = ['square', 'rectangle', 'rhombus', 'circle', 'pentagon', 'hexagon'];

/** Jacob (2026-11-25): any number of fragments, but no fewer than 25. */
export const MIN_TILES = 25;
export const MAX_TILES = 144;

/** The player's own map: how many fragments, in what outline, and how many of each terrain (the Stone's fragment not counted). */
export interface MapSetup {
  tiles: number;
  shape: MapShape;
  /** Left out: the game's recommended mix for this many fragments. */
  terrain?: Partial<Record<TerrainId, number>>;
}

/** The size band a number of fragments falls in; missions scale their targets by it. */
export function sizeForTiles(tiles: number): SizePreset {
  if (tiles <= 30) return 'short';
  if (tiles <= 42) return 'medium';
  if (tiles <= 56) return 'long';
  return 'epic';
}

export interface GameConfig {
  size: SizePreset;
  /** A custom map. Without it the map is the square of the size preset. */
  map?: MapSetup;
  difficulty: Difficulty;
  winMode: WinMode;
  multiplayer: boolean;
}

/** Danger level of a fragment: +1 for every 2 rings closer to the centre than the outer edge. */
export function dangerLevel(ring: number, maxRing: number, settings: DifficultySettings): number {
  if (!settings.dangerRings) return 0;
  return Math.floor((maxRing - ring) / 2);
}
