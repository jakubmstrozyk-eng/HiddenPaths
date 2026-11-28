import type { ArmourSlot, Attribute, Attributes, TerrainAction } from '@hp/content';
import type { Character } from './character';
import type { CombatEvent, CombatMove, CombatResult, CombatState } from './combat';
import type { GameConfig } from './config';
import type { TestResult } from './dice';
import type { Delve, Dungeon } from './dungeon';
import type { GameJournal, JournalWrite } from './journal';
import type { GameMap } from './mapgen';
import type { PuzzleAnswer, PuzzleState } from './puzzles';
import type { Companion, Condition, Effect, Inventory, TerrainOutcome } from './terrain';

/**
 * A portion of food made better before it is eaten: prepared by a Myrmid (+2 to all attributes for a round),
 * maybe seasoned by a Gourmet (+5 more to one attribute), or a Gourmet's healing stew (+2 Vitality).
 * Each counts as one of the hero's food portions.
 */
export interface Meal {
  kind: 'prepared' | 'stew';
  spice?: Attribute;
}

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
  /** `puzzle`: the card's mini-game is being played, and the card waits for its answer. */
  pendingEvent: { card: number; step: string; puzzle?: PuzzleState } | null;
  combat: CombatState | null;
  /** Carries the Stone of Beginnings back to a city. */
  hasStone: boolean;
  /** Prepared portions among the food carried (missing in older saves). */
  meals?: Meal[];
  /** Tamed beasts following the hero (missing in older saves). */
  companions?: Companion[];
  /** Inside the dungeon: the room and the way back. The hero's position stays on the entrance fragment. */
  delve?: Delve | null;
  /** The hero journal while this game runs (missing in older saves). */
  journal?: GameJournal;
  /** Fragments a dream marked with a question mark (the journal's omens). */
  hints?: number[];
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
  /** A mini-game on an event card was played: `score` is what its result table read. */
  | { type: 'puzzle'; player: string; card: number; kind: string; score: number; won: boolean; helped: boolean | null }
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
  /** A thinking foe that killed the hero took all their gold. */
  | { type: 'robbed'; player: string; enemy: string; gold: number }
  | { type: 'respawned'; player: string; cell: number }
  | { type: 'levelUp'; player: string; level: number; cards?: string[] }
  | { type: 'service'; player: string; service: string; cost: number }
  | { type: 'traded'; player: string; item: string; gold: number; bought: boolean }
  | { type: 'stoneTaken'; player: string; cell: number }
  | { type: 'won'; player: string; mode: string; xp: number }
  | { type: 'timedOut'; player: string }
  /** A skill card was used or fired: `ok` says whether it worked, `roll` is its d6 or test roll. */
  | { type: 'card'; player: string; card: string; ok?: boolean; roll?: number; amount?: number }
  | { type: 'turnEnded'; player: string; next: string; round: number }
  /** A portion was prepared (Myrmid race rule, Seasoning) or made into a stew. */
  | { type: 'cooked'; player: string; meal: Meal }
  | { type: 'mealEaten'; player: string; meal: Meal }
  /** A tamed beast's bond was tested at the start of the turn: it grew, became lasting, or the beast left. */
  | { type: 'companion'; player: string; uid: string; enemy: string; bond: number; tame: boolean; left: boolean }
  /** A magic scroll read on the map; `amount` is Vitality healed. */
  | { type: 'scroll'; player: string; item: string; amount?: number; to?: number }
  /** Smelting: 3 pieces of gear melted into iron ore or a new common item. */
  | { type: 'smelted'; player: string; items: string[]; into: string }
  /** A skill card made an item: Tannery (a leather piece) or the Elder's Potion of Might. */
  | { type: 'crafted'; player: string; card: string; item: string }
  /** Reinforcement: +1 armour on a part of the body, for these materials. */
  | { type: 'reinforced'; player: string; slot: ArmourSlot; materials: string[] }
  /** The player picked these 5 skill cards to play with; `dropped` wait on the bench. */
  | { type: 'cardsKept'; player: string; cards: string[]; dropped: string[] }
  /** A game mission was reached and paid its XP. */
  | { type: 'mission'; player: string; mission: string; xp: number }
  /** Dungeon: went into a room (`card` when it played one), climbed out, or cleared a room. */
  | { type: 'room'; player: string; room: number; card?: number }
  | { type: 'roomCleared'; player: string; room: number; vault: boolean }
  | { type: 'leftDungeon'; player: string }
  /** A hero on the entrance fragment looked around: `found` when they noticed the way down. */
  | { type: 'dungeonSearch'; player: string; found: boolean }
  /** A trap's blow outside a fight: where it landed and what the armour there stopped. */
  | { type: 'hitSpot'; player: string; slot: import('@hp/content').ArmourSlot; armour: number; damage: number }
  /** A successful action used up the fragment's resource until round `until`. */
  | { type: 'depleted'; player: string; cell: number; action: TerrainAction; until: number }
  /** Fragments nobody stood on for 5 rounds went dark again, with new terrain beneath. */
  | { type: 'covered'; player: string; cells: number[] }
  /** The hero journal: an entry written, new traits, an Inspiration, a vow kept or broken, a chapter, a dream come true, a story told. */
  | { type: 'journal'; player: string; what: 'entry' | 'traits' | 'inspiration' | 'inspired' | 'vowKept' | 'vowBroken' | 'chapter' | 'omen' | 'story';
      rewarded?: boolean; traits?: string[]; vow?: string; xp?: number; lesson?: string; enemy?: string; ok?: boolean }
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
  /** `cell:action` → the round the resource is back (missing in older saves). */
  depleted?: Record<string, number>;
  /** Fragment → the last round a hero stood on it or saw it (missing in older saves). */
  lastVisit?: Record<number, number>;
  /** Set when someone reaches the goal. */
  winner: string | null;
  /** The map's dungeon (missing in games begun before dungeons). */
  dungeon?: Dungeon;
  /** Increases with every applied action; the server uses it to reject stale or double submits. */
  version: number;
  /** The most recent log entries (the server keeps the full history). */
  log: LogEntry[];
  /** Log entries written since the game began, so the app can tell which ones an action added. */
  logSeq: number;
}

/** Town services that cost gold or Stamina. */
/** 'deliver': handing the Stone of Beginnings to the city's castle, which wins a Stone game. */
export type Service = 'meal' | 'stay' | 'gossip' | 'train' | 'sharpen' | 'story' | 'deliver';

/** A side of the map, where a hero stands before stepping onto it. */
export type Side = 'N' | 'E' | 'S' | 'W';
export const SIDES: Side[] = ['N', 'E', 'S', 'W'];
/** The position of a hero who has not stepped onto the map yet. */
export const OUTSIDE = -1;

export type Action =
  | { type: 'move'; to: number }
  /** The first step: from the starting place outside the map onto the middle fragment of a side. */
  | { type: 'enter'; side: Side }
  /** `research`: the Mystic's Researcher card, 1 more Stamina for a permanent +1 Intelligence. */
  | { type: 'camp'; research?: boolean; /** A card used only while camping (Way of the Warrior, Teacher), and its target. */ card?: string; target?: string }
  /** Play a skill card outside a fight; `target` picks the companion for Teacher. */
  | { type: 'card'; card: string; target?: string }
  /** Choose the 5 skill cards to keep when a new level brought more (the rest are gone). */
  | { type: 'keepCards'; cards: string[] }
  /** Runemaster's Reinforcement in a city or village: 3 basic materials for +1 armour on a part of the body. */
  | { type: 'reinforce'; slot: ArmourSlot }
  | { type: 'terrain'; action: TerrainAction }
  | { type: 'event'; option: number }
  /** The answer to the event's mini-game. */
  | { type: 'puzzle'; answer: PuzzleAnswer }
  | { type: 'combat'; move: CombatMove }
  | { type: 'use'; item: string }
  | { type: 'equip'; item: string }
  | { type: 'read'; item: string }
  | { type: 'service'; service: Service }
  /** `item` is 'food', a material, a herb or an item id. */
  | { type: 'buy'; item: string }
  | { type: 'sell'; item: string }
  | { type: 'portal'; to: number }
  /** Myrmids prepare a portion of food; a Gourmet may season it with an attribute. */
  | { type: 'cook'; spice?: Attribute }
  /** Read a magic scroll on the map: Healing, Renewal, or Teleport to `to`. */
  | { type: 'scroll'; item: string; to?: number }
  /** Runemaster's Smelting in a city: 3 weapons or armour pieces into iron ore or a common item. */
  | { type: 'smelt'; into: 'ore' | 'item' }
  | { type: 'spend'; bonus: Partial<Attributes> }
  /** Eat this round's meal: the hero has to do it themselves before the turn ends, or go hungry. */
  | { type: 'eat' }
  /** Inside or into the dungeon: walk to a room (from the entrance, one of its first rooms), or climb out. */
  | { type: 'dungeon'; to: number | 'exit' }
  /** The hero journal at the campfire; any player may write, even out of turn. No `entry` closes it unwritten. */
  | { type: 'journal'; entry?: JournalWrite }
  | { type: 'endTurn' };

export interface NewPlayer {
  id: string;
  character: import('./character').CharacterInput;
}
