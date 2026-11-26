import type { EnemyKind } from './equipment';
import type { Attribute, RaceId, TerrainId, Text } from './types';

/** What an effect can change for a few rounds: a base attribute, all of them, Speed, Stamina or damage dealt. */
export type EffectTarget = Attribute | 'all' | 'speed' | 'stamina' | 'damage';

/** Trained skills that add to their terrain action tests. */
export type SkillId = 'hunt' | 'gather' | 'herbalism' | 'mine';

/**
 * One step of an event card's script. The engine runs a list of these in order.
 * Card data stays declarative, so a new card is data entry rather than code.
 */
export type Outcome =
  | { do: 'gold' | 'food' | 'xp' | 'herbs'; amount: number }
  /** Heal (positive) or wound (negative). */
  | { do: 'vitality'; amount: number }
  | { do: 'halfVitality' }
  /** A blow to a spot rolled on the d6 hit location table; armour on that spot takes off its value. */
  | { do: 'hit'; damage: number }
  /** A timed bonus or penalty. `rounds: 0` lasts for the rest of the game. */
  | { do: 'effect'; target: EffectTarget; amount: number; rounds: number; vs?: EnemyKind }
  | { do: 'permanent'; target: Attribute | 'maxVitality'; amount: number }
  | { do: 'skill'; skill: SkillId; amount: number }
  | { do: 'item'; item: string }
  | { do: 'randomItem'; rare?: boolean }
  /** Ores for the bag: rare ones (magma, gold, silver, diamond, gem) or common ones. */
  | { do: 'ores'; amount: number; rare?: boolean }
  /** A rune on the weapon: the given one, or one rolled on the d10 table. */
  | { do: 'rune'; rune?: 'venom' | 'sharp' | 'precise' | 'stunning' | 'piercing' }
  | { do: 'fight'; enemies: string[]; onWin?: Outcome[] }
  | { do: 'fightRandom' }
  | {
      do: 'test'; attribute: Attribute; modifier?: number;
      /** A race that gets an easier test. */
      raceBonus?: { race: RaceId; amount: number };
      pass?: Outcome[]; fail?: Outcome[];
    }
  | { do: 'roll'; die: number; table: { upTo: number; then: Outcome[] }[] }
  | { do: 'ifRace'; race: RaceId; then: Outcome[]; else?: Outcome[] }
  /** Continue the card at another step, with new choices. */
  | { do: 'goto'; step: string }
  /** Moves the hero, relative to the side they entered from. */
  | { do: 'move'; direction: 'back' | 'left' | 'right' | 'forward' | 'random'; distance: number | 'd10' | 'd6half' }
  /** Cannot move for this and the next rounds. */
  | { do: 'stuck'; rounds: number }
  | { do: 'loseSpeed' }
  | { do: 'loseAll' }
  /** A free camp: heals 2 and clears fatigue, without ending the turn. */
  | { do: 'camp' }
  | { do: 'peek' }
  /**
   * A lasting condition: at the end of each of the hero's turns they test `test`;
   * a pass clears it, a failure applies `each` and makes the next test `worsen` harder.
   */
  | { do: 'condition'; id: string; name: Text; test: Attribute; modifier?: number; worsen?: number; each: Outcome[] }
  | { do: 'death' }
  /** An on-screen mini-game (riddle, quiz, shuffle, timing...). The card waits for its result. */
  | { do: 'puzzle'; puzzle: Puzzle };

/** A cue an attribute test gives before a mini-game starts: a letter, a slower shuffle, a wider zone. */
export interface PuzzleHelper { attribute: Attribute; modifier?: number }

/**
 * A mini-game on an event card. The engine draws its secret part from the game's seed
 * (so an online game sees the same puzzle), the app plays it, and the result picks the outcomes.
 * `byScore[n]` runs for a score of n (the last entry for anything higher).
 */
export type Puzzle =
  /** Spell the answer to a riddle from scattered letters. Helper: shows the first letter. */
  | { kind: 'riddle'; helper?: PuzzleHelper; seconds: number; fastSeconds: number; win: Outcome[]; fast: Outcome[]; lose: Outcome[] }
  /** Questions made from the game's own data. Helper: strikes out one wrong answer per question. */
  | { kind: 'quiz'; helper?: PuzzleHelper; questions: number; seconds: number; byScore: Outcome[][] }
  /** Follow the queen while three cards are shuffled. Helper: slower hands. */
  | { kind: 'cups'; helper?: PuzzleHelper; win: Outcome[]; lose: Outcome[] }
  /** Strike while the marker crosses the glowing zone. Helper: a wider zone. */
  | { kind: 'forge' | 'climb'; helper?: PuzzleHelper; strikes: number; byScore: Outcome[][] }
  /** Three chests with inscriptions, exactly one of them true. Helper: tells which one would blow up. */
  | { kind: 'chests'; helper?: PuzzleHelper; treasure: Outcome[]; empty: Outcome[]; blast: Outcome[] }
  /** Traps flash on a grid, then the hero picks a way across. Helper: a longer flash. */
  | { kind: 'traps'; helper?: PuzzleHelper; traps: number; win: Outcome[]; hit: Outcome[] }
  /** Guess a code of runes; each try says how many are right and how many are in the wrong place. Helper: one more try. */
  | { kind: 'lock'; helper?: PuzzleHelper; length: number; symbols: number; tries: number; win: Outcome[]; lose: Outcome[] }
  /** Higher or lower than the last d10: the score is the run of right calls. Helper: one wrong call forgiven. */
  | { kind: 'higherLower'; helper?: PuzzleHelper; rounds: number; byScore: Outcome[][] }
  /** Dig layer after layer and stop when you like; a curse takes it all. Helper: the first curse only wounds. */
  | { kind: 'dig'; helper?: PuzzleHelper; layers: number; curses: number; bust: Outcome[]; /** What lies on the deepest layer instead of a random treasure. */ bottom?: Outcome[] };

export interface EventOption {
  label: Text;
  cost?: { gold?: number; food?: number; speed?: number };
  then: Outcome[];
}

export interface EventStep {
  text?: Text;
  options: EventOption[];
}

export interface EventCard {
  id: number;
  title: Text;
  text: Text;
  /** Drawn only on these fragments. */
  terrains?: TerrainId[];
  /** Fights and harmful tests. Harder difficulties draw them more often. */
  hostile: boolean;
  steps: { start: EventStep } & Record<string, EventStep>;
}
