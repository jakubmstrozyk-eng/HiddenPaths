import { TERRAINS, type TerrainAction } from '@hp/content';
import { createCharacter, levelForXp, type Character, type CharacterInput } from './character';
import { DIFFICULTIES, dangerLevel, type GameConfig } from './config';
import { EngineError } from './errors';
import { generateMap, neighbours, startCell, type GameMap } from './mapgen';
import { Rng, seedFromString } from './rng';
import { availableTerrainActions, runTerrainAction, type Effect, type Inventory, type TerrainOutcome, type WorldView } from './terrain';

export interface PlayerState {
  id: string;
  character: Character;
  position: number;
  start: number;
  /** Fragments this player has revealed (each player has their own fog of war). */
  revealed: number[];
  speedLeft: number;
  staminaLeft: number;
  /** Fragment the hero came from, so events can say "left" or "back". */
  cameFrom: number | null;
  roundsWithoutFood: number;
  actionsSinceCamp: number;
  inventory: Inventory;
  effects: Effect[];
  /** Achievement and rule counters: successful hunts, meditations per monument, and so on. */
  counters: Record<string, number>;
  crossedRiver: boolean;
}

export type LogEntry =
  | { type: 'moved'; player: string; from: number; to: number; cost: number }
  | { type: 'revealed'; player: string; cell: number; xp: number }
  | { type: 'eventDrawn'; player: string; cell: number }
  | { type: 'camped'; player: string; cell: number; healed: number }
  | { type: 'ate'; player: string; foodLeft: number }
  | { type: 'hungry'; player: string; rounds: number; vitalityLost: number }
  | { type: 'respawned'; player: string; cell: number }
  | { type: 'levelUp'; player: string; level: number }
  | { type: 'turnEnded'; player: string; next: string; round: number }
  | ({ player: string } & TerrainOutcome);

export interface GameState {
  seed: string;
  rng: number;
  config: GameConfig;
  map: GameMap;
  players: PlayerState[];
  /** Player ids in turn order (highest Dexterity first). */
  turnOrder: string[];
  turnIndex: number;
  round: number;
  /** Increases with every applied action; the server uses it to reject stale or double submits. */
  version: number;
  log: LogEntry[];
}

export interface NewPlayer {
  id: string;
  character: CharacterInput;
}

export type Action =
  | { type: 'move'; to: number }
  | { type: 'camp' }
  | { type: 'terrain'; action: TerrainAction }
  | { type: 'endTurn' };

export function createGame(seed: string, config: GameConfig, newPlayers: NewPlayer[]): GameState {
  if (newPlayers.length < 1 || newPlayers.length > 4) throw new EngineError('game.players', 'A game has 1 to 4 players.');
  if (!config.multiplayer && newPlayers.length !== 1) throw new EngineError('game.players', 'A single player game has 1 player.');
  const rng = new Rng(seedFromString(seed));
  const map = generateMap(config.size, rng);
  const settings = DIFFICULTIES[config.difficulty];
  const taken: number[] = [];
  const players = newPlayers.map((p): PlayerState => {
    const character = createCharacter(p.character, settings.startFood);
    const start = startCell(map, character.race, taken);
    taken.push(start);
    return {
      id: p.id,
      character,
      position: start,
      start,
      revealed: [start],
      speedLeft: character.speed,
      staminaLeft: character.stamina,
      cameFrom: null,
      roundsWithoutFood: 0,
      actionsSinceCamp: 0,
      inventory: { materials: {}, herbs: {} },
      effects: [],
      counters: {},
      crossedRiver: false,
    };
  });
  // Initiative: higher Dexterity acts first; seat order breaks ties.
  const turnOrder = players
    .map((p, seat) => ({ id: p.id, dex: p.character.attributes.dex, seat }))
    .sort((a, b) => b.dex - a.dex || a.seat - b.seat)
    .map((p) => p.id);
  return { seed, rng: rng.state, config, map, players, turnOrder, turnIndex: 0, round: 1, version: 0, log: [] };
}

export function currentPlayer(state: GameState): PlayerState {
  const id = state.turnOrder[state.turnIndex]!;
  return state.players.find((p) => p.id === id)!;
}

export function worldView(state: GameState): WorldView {
  return {
    round: state.round,
    difficulty: state.config.difficulty,
    terrainAt: (cell) => state.map.cells[cell]!.terrain,
    ringAt: (cell) => state.map.cells[cell]!.ring,
    maxRing: state.map.maxRing,
  };
}

/** A river blocks onward travel until the hero swims across; going back the way they came is always allowed. */
function blockedByRiver(state: GameState, player: PlayerState, to: number): boolean {
  if (state.map.cells[player.position]!.terrain !== 'river' || player.crossedRiver) return false;
  if (to === player.cameFrom || player.cameFrom === null) return false;
  return state.map.cells[to]!.terrain !== 'river';
}

function moveCost(state: GameState, to: number): number {
  const terrain = state.map.cells[to]!.terrain;
  return terrain === 'core' ? 2 : TERRAINS[terrain].hard ? 2 : 1;
}

function canCamp(state: GameState, player: PlayerState): { ok: boolean; cost: number } {
  const terrain = state.map.cells[player.position]!.terrain;
  if (terrain === 'core' || !TERRAINS[terrain].actions.includes('camp')) return { ok: false, cost: 0 };
  const cost = terrain === 'cave' || TERRAINS[terrain].settlement ? 0 : 1;
  return { ok: player.staminaLeft >= cost, cost };
}

/** Everything the player may do right now. The app builds its buttons from this list. */
export function legalActions(state: GameState, playerId: string): Action[] {
  const player = currentPlayer(state);
  if (player.id !== playerId) return [];
  const actions: Action[] = [];
  for (const n of neighbours(state.map, player.position)) {
    if (moveCost(state, n) <= player.speedLeft && !blockedByRiver(state, player, n)) actions.push({ type: 'move', to: n });
  }
  for (const action of availableTerrainActions(worldView(state), player)) actions.push({ type: 'terrain', action });
  if (canCamp(state, player).ok) actions.push({ type: 'camp' });
  actions.push({ type: 'endTurn' });
  return actions;
}

/**
 * Applies one action and returns the new state. The input state is never changed,
 * so the server can keep the old version until the new one is saved.
 */
export function applyAction(prev: GameState, playerId: string, action: Action): GameState {
  const state = structuredClone(prev);
  const rng = new Rng(state.rng);
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new EngineError('turn.notYours', 'It is not your turn.');

  switch (action.type) {
    case 'move': {
      if (!neighbours(state.map, player.position).includes(action.to)) {
        throw new EngineError('move.notAdjacent', 'You can only move to a neighbouring fragment.');
      }
      const cost = moveCost(state, action.to);
      if (cost > player.speedLeft) throw new EngineError('move.noSpeed', 'Not enough Speed left.');
      if (blockedByRiver(state, player, action.to)) throw new EngineError('move.river', 'Swim across the river first.');
      player.crossedRiver = false;
      state.log.push({ type: 'moved', player: player.id, from: player.position, to: action.to, cost });
      player.speedLeft -= cost;
      player.cameFrom = player.position;
      player.position = action.to;
      if (!player.revealed.includes(action.to)) {
        player.revealed.push(action.to);
        const cell = state.map.cells[action.to]!;
        const settings = DIFFICULTIES[state.config.difficulty];
        const xp = 1 * settings.xp * (1 + dangerLevel(cell.ring, state.map.maxRing, settings));
        gainXp(state, player, xp);
        state.log.push({ type: 'revealed', player: player.id, cell: action.to, xp });
        if (cell.terrain !== 'core' && TERRAINS[cell.terrain].drawsEvent) {
          // Event cards arrive in milestone 2; the draw is recorded so replays stay stable.
          state.log.push({ type: 'eventDrawn', player: player.id, cell: action.to });
        }
      }
      break;
    }
    case 'camp': {
      const { ok, cost } = canCamp(state, player);
      if (!ok) throw new EngineError('camp.notHere', 'You cannot camp here.');
      player.staminaLeft -= cost;
      const healed = Math.min(2, player.character.maxVitality - player.character.vitality);
      player.character.vitality += healed;
      player.actionsSinceCamp = 0;
      state.log.push({ type: 'camped', player: player.id, cell: player.position, healed });
      endTurn(state, player);
      break;
    }
    case 'terrain': {
      const outcome = runTerrainAction(worldView(state), player, action.action, rng);
      state.log.push({ player: player.id, ...outcome });
      break;
    }
    case 'endTurn':
      endTurn(state, player);
      break;
    default:
      throw new EngineError('action.unknown', 'Unknown action.');
  }

  state.rng = rng.state;
  state.version++;
  return state;
}

function gainXp(state: GameState, player: PlayerState, xp: number) {
  const before = player.character.level;
  player.character.xp += xp;
  const after = levelForXp(player.character.xp);
  if (after > before) {
    player.character.level = after;
    state.log.push({ type: 'levelUp', player: player.id, level: after });
  }
}

/** End-of-turn upkeep for one player, then the turn passes on. */
function endTurn(state: GameState, player: PlayerState) {
  const c = player.character;
  // Sunborn need food only every second round.
  const needsFood = c.race !== 'sunborn' || state.round % 2 === 1;
  // Staying in the desert costs double food.
  const meals = state.map.cells[player.position]!.terrain === 'desert' ? 2 : 1;
  if (needsFood) {
    if (c.food >= meals) {
      c.food -= meals;
      player.roundsWithoutFood = 0;
      state.log.push({ type: 'ate', player: player.id, foodLeft: c.food });
    } else {
      player.roundsWithoutFood++;
      const lost = player.roundsWithoutFood === 3 ? 5 : player.roundsWithoutFood === 6 ? 10 : 0;
      if (player.roundsWithoutFood >= 9) c.vitality = 0;
      else c.vitality -= lost;
      state.log.push({ type: 'hungry', player: player.id, rounds: player.roundsWithoutFood, vitalityLost: lost });
    }
  }
  if (c.vitality <= 0) {
    player.position = player.start;
    player.cameFrom = null;
    c.vitality = Math.ceil(c.maxVitality / 2);
    player.roundsWithoutFood = 0;
    state.log.push({ type: 'respawned', player: player.id, cell: player.start });
  }

  state.turnIndex++;
  if (state.turnIndex >= state.turnOrder.length) {
    state.turnIndex = 0;
    state.round++;
    for (const p of state.players) p.effects = p.effects.filter((e) => e.untilRound >= state.round);
  }
  const next = currentPlayer(state);
  next.speedLeft = next.character.speed;
  next.staminaLeft = next.character.stamina;
  state.log.push({ type: 'turnEnded', player: player.id, next: next.id, round: state.round });
}

/** True once the hero has a reason to stop: no Speed for any move. */
export function isStuck(state: GameState): boolean {
  return !legalActions(state, currentPlayer(state).id).some((a) => a.type === 'move');
}

