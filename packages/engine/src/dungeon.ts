import {
  DUNGEON_LENGTH, DUNGEON_THEMES, dungeonCardId,
  type DungeonThemeId, type RoomKind, type RoomSlot, type TerrainId,
} from '@hp/content';
import type { GameConfig, SizePreset } from './config';
import { EngineError } from './errors';
import { insideMap, type GameMap } from './mapgen';
import type { Rng } from './rng';
import type { GameState, PlayerState } from './state';

/**
 * One small dungeon per map (Jacob, 2026-11-26). Its entrance is a fragment of the map; the rooms
 * behind it are a short path with one fork, a shrine, the lord of the dungeon and the vault.
 * Rooms cleared by anyone stay cleared for everyone; the first hero to open the vault takes it.
 */
export interface DungeonRoom {
  kind: RoomKind;
  /** The room's card (an event card the app shows like any other). */
  card: number;
  /** Rooms that lead on from here. */
  next: number[];
  cleared: boolean;
  /** Players who have stood in this room: they know what it holds. Others see a dark doorway. */
  seenBy: string[];
}

export interface Dungeon {
  /** The fragment with the entrance. */
  cell: number;
  theme: DungeonThemeId;
  /** Rooms the entrance leads to: the first room, or both sides of the fork. */
  entry: number[];
  rooms: DungeonRoom[];
  /** The vault has been opened: nobody can go down any more. */
  plundered: boolean;
  /** Players who have noticed the way down (Jacob, 2026-11-26: found by a test on the fragment). */
  foundBy: string[];
  /** The lord's Vitality after a hero fled or fell: the wounds stay for the next attempt. */
  bossVitality?: number;
}

/** Where a hero is inside the dungeon: the room, and the rooms walked through to reach it. */
export interface Delve {
  room: number;
  path: number[];
}

const SIZES: SizePreset[] = ['short', 'medium', 'long', 'epic'];

/** Steps in a dungeon cost what a step on the map costs: 1 Speed and 1 Stamina. Climbing out costs 1 Speed. */
export const ROOM_SPEED = 1;
export const ROOM_STAMINA = 1;
export const EXIT_SPEED = 1;

/** Ground where the entrance may lie: not a settlement, inn or monument, and not the Stone. */
const OPEN: TerrainId[] = ['forest', 'mountains', 'fields', 'river', 'lake', 'desert', 'cave'];

/** The fragments that open the map from each side (the hero's first step): never the entrance. */
function entryCells(map: GameMap): number[] {
  const midX = Math.floor((map.width - 1) / 2);
  const midY = Math.floor((map.height - 1) / 2);
  return [midX, (map.height - 1) * map.width + midX, midY * map.width, midY * map.width + map.width - 1];
}

/** Picks the entrance and lays out the rooms. Its own rng, so a map without a dungeon plays as before. */
export function placeDungeon(map: GameMap, config: GameConfig, rng: Rng): Dungeon | undefined {
  const starts = entryCells(map);
  const inner = map.maxRing >= 3;
  const candidates = map.cells.filter((c) => insideMap(c) && c.terrain !== 'core' && c.terrain !== 'void' && OPEN.includes(c.terrain)
    && !starts.includes(c.index) && c.ring >= 1 && (c.ring < map.maxRing || map.maxRing <= 1));
  if (candidates.length === 0) return undefined;
  // Caves and mountains are the natural way down; the middle rings are favoured over the edge.
  const weights = candidates.map((c) => (c.terrain === 'cave' ? 3 : c.terrain === 'mountains' ? 2 : 1) * (c.ring < map.maxRing - 1 || !inner ? 2 : 1));
  const cell = candidates[rng.weighted(weights)]!;
  const theme = themeFor(cell.terrain as TerrainId, inner && cell.ring <= 1);
  const tier = Math.max(0, SIZES.indexOf(config.size));
  return { cell: cell.index, theme, ...layout(theme, tier, rng), plundered: false, foundBy: [] };
}

function themeFor(terrain: TerrainId, nearCore: boolean): DungeonThemeId {
  if (nearCore) return 'rift';
  for (const id of Object.keys(DUNGEON_THEMES) as DungeonThemeId[]) if (DUNGEON_THEMES[id].terrains.includes(terrain)) return id;
  return 'mine';
}

/**
 * The rooms, by the number walked from the entrance to the vault (vault included):
 * 4: fork · shrine · lord · vault; 5 adds a trap first; 6 adds a special room after the fork;
 * 7 adds a patrol before the fork. The fork is a puzzle on one side and a guard room on the other,
 * and the guard room has a side treasury off it.
 */
function layout(theme: DungeonThemeId, tier: number, rng: Rng): { entry: number[]; rooms: DungeonRoom[] } {
  const length = DUNGEON_LENGTH[tier] ?? 5;
  const rooms: DungeonRoom[] = [];
  const add = (kind: RoomKind, slot: RoomSlot) => {
    rooms.push({ kind, card: dungeonCardId(theme, slot, tier), next: [], cleared: false, seenBy: [] });
    return rooms.length - 1;
  };
  const before: number[] = [];
  if (length >= 5) before.push(add('trap', 'trap'));
  if (length >= 7) before.push(add('guard', 'guard2'));
  const puzzle = add('puzzle', rng.int(2) === 0 ? 'puzzleRunes' : 'puzzleRiddle');
  const guard = add('guard', 'guard');
  const side = add('side', 'side');
  const after: number[] = [];
  if (length >= 6) after.push(add('special', 'special'));
  after.push(add('shrine', 'shrine'), add('boss', 'boss'), add('vault', 'vault'));
  // Which side of the fork is which is hidden: the order of the two corridors is shuffled.
  const fork = rng.int(2) === 0 ? [puzzle, guard] : [guard, puzzle];
  for (let i = 0; i + 1 < before.length; i++) rooms[before[i]!]!.next = [before[i + 1]!];
  if (before.length) rooms[before[before.length - 1]!]!.next = fork;
  rooms[guard]!.next = [after[0]!, side];
  rooms[puzzle]!.next = [after[0]!];
  for (let i = 0; i + 1 < after.length; i++) rooms[after[i]!]!.next = [after[i + 1]!];
  return { entry: before.length ? [before[0]!] : fork, rooms };
}

/** Which rooms the hero can walk to now: onwards through the doors of a cleared room, or back the way they came. */
export function roomMoves(state: GameState, player: PlayerState): number[] {
  const d = state.dungeon;
  if (!d) return [];
  if (!player.delve) return [];
  const here = d.rooms[player.delve.room]!;
  if (!here.cleared) return [];
  const back = player.delve.path[player.delve.path.length - 1];
  return [...here.next, ...(back !== undefined ? [back] : [])];
}

/** True when the hero stands on the entrance and may go down. */
export function canDescend(state: GameState, player: PlayerState): boolean {
  const d = state.dungeon;
  return !!d && !d.plundered && !player.delve && player.position === d.cell && d.foundBy.includes(player.id);
}

export function canAfford(player: PlayerState): boolean {
  return player.speedLeft >= ROOM_SPEED && player.staminaLeft >= ROOM_STAMINA;
}

/** Steps into a room: costs Speed and Stamina, and an uncleared room plays its card. Returns the card to start, if any. */
export function enterRoom(state: GameState, player: PlayerState, to: number): number | null {
  const d = state.dungeon;
  if (!d) throw new EngineError('dungeon.none', 'There is no dungeon on this map.');
  if (!canAfford(player)) throw new EngineError('move.noSpeed', 'Not enough Speed or Stamina left.');
  if (player.delve) {
    if (!roomMoves(state, player).includes(to)) throw new EngineError('dungeon.door', 'There is no way from here to that room.');
    const path = player.delve.path;
    if (path[path.length - 1] === to) path.pop();
    else path.push(player.delve.room);
    player.delve.room = to;
  } else {
    if (!canDescend(state, player)) throw new EngineError('dungeon.entrance', 'There is no way down here.');
    if (!d.entry.includes(to)) throw new EngineError('dungeon.door', 'That is not a way in.');
    player.delve = { room: to, path: [] };
  }
  player.speedLeft -= ROOM_SPEED;
  player.staminaLeft -= ROOM_STAMINA;
  const room = d.rooms[to]!;
  if (!room.seenBy.includes(player.id)) room.seenBy.push(player.id);
  return room.cleared ? null : room.card;
}

/** Back to the previous room after fleeing a fight, or out to the entrance from the first room. */
export function retreat(player: PlayerState) {
  if (!player.delve) return;
  const back = player.delve.path.pop();
  if (back === undefined) player.delve = null;
  else player.delve.room = back;
}

/** After each action: a room whose card is over, with the hero still standing in it, is cleared. */
export function settleRoom(state: GameState, player: PlayerState): boolean {
  const d = state.dungeon;
  if (!d || !player.delve || player.pendingEvent || player.combat || player.character.vitality <= 0) return false;
  const room = d.rooms[player.delve.room]!;
  if (room.cleared) return false;
  room.cleared = true;
  if (room.kind === 'vault') d.plundered = true;
  return true;
}

/** Whether a fragment has the entrance and what it looks like to a player who has revealed it. */
export function dungeonAt(state: GameState, cell: number) {
  const d = state.dungeon;
  return d && d.cell === cell ? d : undefined;
}

/** True when the hero is fighting in the lord's room. */
function inBossFight(state: GameState, player: PlayerState): boolean {
  const d = state.dungeon;
  return !!d && !!player.delve && !!player.combat && d.rooms[player.delve.room]!.kind === 'boss';
}

/** A fight with the lord has just begun: it starts with the wounds earlier heroes gave it. */
export function woundBoss(state: GameState, player: PlayerState) {
  const d = state.dungeon!;
  if (!inBossFight(state, player) || d.bossVitality === undefined) return;
  const lord = player.combat!.foes[0];
  if (lord && lord.vitality === lord.maxVitality) lord.vitality = Math.max(1, Math.min(lord.maxVitality, d.bossVitality));
}

/** The hero leaves a fight with the lord unfinished: its wounds are kept. */
export function rememberBoss(state: GameState, player: PlayerState) {
  if (!inBossFight(state, player)) return;
  const lord = player.combat!.foes[0];
  if (lord && lord.vitality > 0) state.dungeon!.bossVitality = lord.vitality;
}
