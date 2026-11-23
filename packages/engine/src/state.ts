import type { Attribute, Attributes, TerrainAction } from '@hp/content';
import type { Character } from './character';
import type { CombatEvent, CombatMove, CombatResult, CombatState } from './combat';
import type { GameConfig } from './config';
import type { TestResult } from './dice';
import type { GameMap } from './mapgen';
import type { Condition, Effect, Inventory, TerrainOutcome } from './terrain';

export interface PlayerState {
  id: string;
  character: Character;
  position: number;
  start: number;
  /** Where the hero wakes after dying: the start, or the last city visited (Fountain of rebirth). */
  respawnAt: number;
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
  conditions: Condition[];
  /** Achievement and rule counters: successful hunts, meditations per monument, and so on. */
  counters: Record<string, number>;
  crossedRiver: boolean;
  /** An event card waiting for the player's choice. */
  pendingEvent: { card: number; step: string } | null;
  combat: CombatState | null;
  /** Carries the Stone of Beginnings back to a city. */
  hasStone: boolean;
}

/** A change to a hero's stats or belongings, for the log and the app's floating numbers. */
export type Change =
  | { what: 'gold' | 'food' | 'xp' | 'vitality' | 'maxVitality' | 'herbs'; amount: number }
  | { what: 'attribute'; attribute: Attribute; amount: number }
  | { what: 'effect'; target: string; amount: number; rounds: number }
  | { what: 'skill'; skill: string; amount: number }
  | { what: 'item'; item: string; amount: number }
  | { what: 'rune'; rune: string }
  | { what: 'stuck'; rounds: number }
  | { what: 'lostEverything' };

export type LogEntry =
  | { type: 'moved'; player: string; from: number; to: number; cost: number; pushed?: boolean }
  | { type: 'revealed'; player: string; cell: number; xp: number }
  | { type: 'eventDrawn'; player: string; cell: number; card: number }
  | { type: 'eventStep'; player: string; card: number; step: string }
  | { type: 'eventChoice'; player: string; card: number; step: string; option: number }
  | { type: 'eventEnded'; player: string; card: number }
  | { type: 'check'; player: string; attribute: Attribute; result: TestResult }
  | { type: 'roll'; player: string; die: number; value: number }
  | { type: 'change'; player: string; change: Change }
  | { type: 'condition'; player: string; id: string; added: boolean }
  | { type: 'combatStarted'; player: string; foes: string[] }
  | ({ type: 'combat'; player: string; event: CombatEvent })
  | { type: 'combatEnded'; player: string; result: CombatResult; xp: number }
  | { type: 'camped'; player: string; cell: number; healed: number }
  | { type: 'ate'; player: string; foodLeft: number }
  | { type: 'hungry'; player: string; rounds: number; vitalityLost: number }
  | { type: 'died'; player: string }
  | { type: 'respawned'; player: string; cell: number }
  | { type: 'levelUp'; player: string; level: number }
  | { type: 'service'; player: string; service: string; cost: number }
  | { type: 'traded'; player: string; item: string; gold: number; bought: boolean }
  | { type: 'stoneTaken'; player: string; cell: number }
  | { type: 'won'; player: string; mode: string; xp: number }
  | { type: 'timedOut'; player: string }
  /** A skill card was used or fired: `ok` says whether it worked, `roll` is its d6 or test roll. */
  | { type: 'card'; player: string; card: string; ok?: boolean; roll?: number; amount?: number }
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
  /** Event cards not drawn yet. Refilled from the whole deck when empty. */
  eventDeck: number[];
  /** Set when someone reaches the goal. */
  winner: string | null;
  /** Increases with every applied action; the server uses it to reject stale or double submits. */
  version: number;
  /** The most recent log entries (the server keeps the full history). */
  log: LogEntry[];
  /** Log entries written since the game began, so the app can tell which ones an action added. */
  logSeq: number;
}

/** Town services that cost gold or Stamina. */
export type Service = 'meal' | 'stay' | 'gossip' | 'train' | 'sharpen';

export type Action =
  | { type: 'move'; to: number }
  /** `research`: the Mystic's Researcher card, 1 more Stamina for a permanent +1 Intelligence. */
  | { type: 'camp'; research?: boolean }
  /** Play a skill card outside a fight. */
  | { type: 'card'; card: string }
  | { type: 'terrain'; action: TerrainAction }
  | { type: 'event'; option: number }
  | { type: 'combat'; move: CombatMove }
  | { type: 'use'; item: string }
  | { type: 'equip'; item: string }
  | { type: 'read'; item: string }
  | { type: 'service'; service: Service }
  /** `item` is 'food', a material, a herb or an item id. */
  | { type: 'buy'; item: string }
  | { type: 'sell'; item: string }
  | { type: 'portal'; to: number }
  | { type: 'spend'; bonus: Partial<Attributes> }
  | { type: 'endTurn' };

export interface NewPlayer {
  id: string;
  character: import('./character').CharacterInput;
}
