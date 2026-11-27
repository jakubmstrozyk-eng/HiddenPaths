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
  | { do: 'puzzle'; puzzle: Puzzle }
  /** Takes an item from the bag (the thief's card). */
  | { do: 'loseItem'; item: string }
  /** One good reading of a book; the third one teaches its lesson. */
  | { do: 'bookRead'; item: string };

/** A cue an attribute test gives before a mini-game starts: a letter, a slower shuffle, a wider zone. */
export interface PuzzleHelper { attribute: Attribute; modifier?: number }

/** Which list a word puzzle draws from: the satyr's riddles or the words of a book. */
export type RiddlePool = 'riddles' | 'knight' | 'juggler' | 'stonemason';

/**
 * A mini-game on an event card. The engine draws its secret part from the game's seed
 * (so an online game sees the same puzzle), the app plays it, and the result picks the outcomes.
 * `byScore[n]` runs for a score of n (the last entry for anything higher).
 *
 * `stat` is the hero's attribute that shapes the game directly, without a throw: more time,
 * a wider zone, a head start, fewer decoys. `helper` is an extra cue won by an attribute test.
 */
export type Puzzle = PuzzleKind & { stat?: Attribute };

type PuzzleKind =
  /** Spell the answer to a riddle from scattered letters. Helper: shows the first letter. Stat: fewer decoy letters. */
  | { kind: 'riddle'; pool?: RiddlePool; helper?: PuzzleHelper; seconds: number; fastSeconds: number; win: Outcome[]; fast: Outcome[]; lose: Outcome[] }
  /** Questions made from the game's own data. Helper: strikes out one wrong answer per question. Stat: more time. */
  | { kind: 'quiz'; helper?: PuzzleHelper; questions: number; seconds: number; byScore: Outcome[][] }
  /** Follow the queen (or the woman behind the trees) while three are shuffled. Helper and stat: slower hands. */
  | { kind: 'cups'; theme?: 'cards' | 'trees'; helper?: PuzzleHelper; win: Outcome[]; lose: Outcome[] }
  /** Strike while the marker crosses the glowing zone. Helper and stat: a wider zone. */
  | { kind: 'forge' | 'climb'; theme?: 'branch' | 'ledge' | 'leap'; helper?: PuzzleHelper; strikes: number; byScore: Outcome[][] }
  /** Three chests with inscriptions, exactly one of them true. Helper: tells which one would blow up. */
  | { kind: 'chests'; helper?: PuzzleHelper; treasure: Outcome[]; empty: Outcome[]; blast: Outcome[] }
  /** Traps flash on a grid, then the hero picks a way across. Helper and stat: a longer flash. */
  | { kind: 'traps'; helper?: PuzzleHelper; traps: number; win: Outcome[]; hit: Outcome[] }
  /** Guess a code of runes; each try says how many are right and how many are in the wrong place. Helper: one more try. Stat: one more try from 40 up. */
  | { kind: 'lock'; helper?: PuzzleHelper; length: number; symbols: number; tries: number; win: Outcome[]; lose: Outcome[] }
  /** Higher or lower than the last d10: the score is the run of right calls. Helper: one wrong call forgiven. */
  | { kind: 'higherLower'; helper?: PuzzleHelper; rounds: number; byScore: Outcome[][] }
  /** Dig layer after layer and stop when you like; a curse takes it all. Helper: the first curse only wounds. */
  | { kind: 'dig'; theme?: 'tomb' | 'hut' | 'bridge'; helper?: PuzzleHelper; layers: number; curses: number; bust: Outcome[]; /** What lies on the deepest layer instead of a random treasure. */ bottom?: Outcome[]; /** Loot of every layer instead of a random treasure. */ loot?: Outcome[] }
  /** Repeat a tune of tones; the score is the notes played right. Helper: hear it once more. Stat: a slower tune. */
  | { kind: 'sequence'; theme: 'ghost' | 'witch' | 'lute'; helper?: PuzzleHelper; length: number; speedUp?: boolean; byScore: Outcome[][] }
  /** Run across a field that falls away (or burns) square by square. Stat: the ground goes slower. */
  | { kind: 'escape'; theme: 'void' | 'fire'; helper?: PuzzleHelper; win: Outcome[]; lose: Outcome[]; /** Each time the fire catches the hero. */ burn?: Outcome[] }
  /** Spot the differences between two pictures; the score is how many were found. Helper: one glints. Stat: more time. */
  | { kind: 'differences'; helper?: PuzzleHelper; seconds: number; byScore: Outcome[][] }
  /** Tap fast against the computer's pull. Stat: a head start and a stronger pull. */
  | { kind: 'tug'; helper?: PuzzleHelper; win: Outcome[]; lose: Outcome[] }
  /** Find pairs of face-down cards in a few moves; the score is the pairs found. Helper: two more moves. Stat: a longer first look. */
  | { kind: 'pairs'; helper?: PuzzleHelper; pairs: number; moves: number; byScore: Outcome[][] }
  /** Keep the marker inside a drifting zone; the score (0-3) is how long it stayed in. Stat: a wider zone. */
  | { kind: 'hold'; helper?: PuzzleHelper; seconds: number; byScore: Outcome[][] }
  /** The bag is shown for a moment, then one thing is gone: which? Stat: a longer look. A miss loses that thing. */
  | { kind: 'missing'; helper?: PuzzleHelper; win: Outcome[]; lose: Outcome[] }
  /** Find the heavier false coin with a few weighings. Helper: one more weighing. */
  | { kind: 'scale'; helper?: PuzzleHelper; coins: number; weighings: number; win: Outcome[]; lose: Outcome[] }
  /** A sign is drawn in the stars, then fades: tap its stars. Score 2 = all of them, 1 = nearly. Stat: it fades slower. */
  | { kind: 'stars'; helper?: PuzzleHelper; byScore: Outcome[][] }
  /** Believe the Nomad's claim about his dice or call a lie; the score is the right calls. Stat: his face gives a bluff away. */
  | { kind: 'bluff'; helper?: PuzzleHelper; rounds: number; byScore: Outcome[][] }
  /** Tap fireflies before they fade; every `per` caught is one step up `byScore`. Stat: they glow longer. */
  | { kind: 'catch'; helper?: PuzzleHelper; seconds: number; per: number; byScore: Outcome[][] }
  /** Put a 3×3 sliding picture back together. Helper: the tiles are numbered. Stat: it is less scrambled. */
  | { kind: 'slider'; helper?: PuzzleHelper; seconds: number; win: Outcome[]; lose: Outcome[] };

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
