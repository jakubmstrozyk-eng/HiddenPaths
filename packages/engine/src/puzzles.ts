import {
  ATTRIBUTES, ENEMIES, LOOT_COMMON, LOOT_RARE, RACES, RIDDLE_POOLS, TERRAINS,
  type Attribute, type Outcome, type Puzzle, type RaceId, type Region, type RiddlePool, type TerrainAction, type TerrainId, type Text,
} from '@hp/content';
import type { Rng } from './rng';

/**
 * Event mini-games. The engine draws each puzzle's secret part from the game's seed, so every
 * screen of an online game sees the same one; the app plays it and sends back the answer;
 * the engine checks the answer where it can and picks the card's outcomes.
 */

export type ChestContent = 'treasure' | 'empty' | 'blast';
/** An inscription on a chest: about the treasure being here (or not), or about a given chest. */
export type ChestClaim =
  | { about: 'here'; treasure: boolean }
  | { about: 'chest'; chest: number; is: ChestContent; not?: boolean };

export interface QuizQuestion { question: Text; options: Text[]; correct: number }

export type PuzzleData =
  | { kind: 'riddle'; pool: RiddlePool; riddle: number; decoys: Text }
  | { kind: 'quiz'; questions: QuizQuestion[]; struck: number[]; seconds: number }
  | { kind: 'cups'; start: number; swaps: [number, number][]; speedMs: number }
  | { kind: 'forge' | 'climb'; zones: number[]; width: number }
  | { kind: 'chests'; claims: ChestClaim[]; contents: ChestContent[] }
  | { kind: 'traps'; size: number; traps: number[]; flashMs: number }
  | { kind: 'lock'; code: number[]; tries: number }
  | { kind: 'higherLower'; values: number[]; forgive: number }
  | { kind: 'dig'; layers: (Outcome[] | 'curse')[]; shield: boolean; /** Curse layers the hero's stat warns of, one layer ahead. */ warned: number[] }
  | { kind: 'sequence'; notes: number[]; tones: number; tempoMs: number; replays: number; speedUp: boolean }
  | { kind: 'escape'; size: number; start: number; exits: number[]; holes: number[]; order: number[]; tickMs: number; perTick: number; stepMs: number }
  | { kind: 'differences'; base: number[]; changed: { region: number; variant: number }[]; seconds: number; hint: number | null }
  | { kind: 'tug'; start: number; tap: number; pull: number; surges: number[]; seconds: number }
  | { kind: 'pairs'; cards: number[]; moves: number; peekMs: number }
  | { kind: 'hold'; path: number[]; width: number; seconds: number }
  | { kind: 'missing'; shown: string[]; stolen: number; options: string[]; showMs: number; real: boolean }
  | { kind: 'scale'; coins: number; fake: number; weighings: number }
  | { kind: 'stars'; points: [number, number][]; target: number[]; showMs: number; sign: number }
  | { kind: 'bluff'; rolls: [number, number][]; claims: number[]; tells: boolean[] }
  | { kind: 'catch'; spawns: { x: number; y: number; at: number }[]; lifeMs: number; seconds: number }
  | { kind: 'slider'; tiles: number[]; seconds: number; numbered: boolean };

/** The hero's attribute that shaped the puzzle: its value with every modifier, and how far it helps (0 to 1). */
export interface PuzzleStat { attribute: Attribute; value: number; power: number }

export interface PuzzleState {
  puzzle: Puzzle;
  data: PuzzleData;
  /** The helper test passed (null when the puzzle has none). */
  helped: boolean | null;
  stat?: PuzzleStat;
}

/** What the engine knows of the hero when it draws a puzzle. */
export interface PuzzleContext {
  /** The hero's value of the puzzle's `stat`, with every modifier. */
  statValue?: number;
  /** The bag, for the thief. */
  items?: string[];
  race?: RaceId;
}

/** How far an attribute helps: nothing at 10, fully at 50. */
export const statPower = (value: number) => Math.max(0, Math.min(1, (value - 10) / 40));

/** What the app sends back; each puzzle reads its own fields, and anything missing counts as giving up. */
export interface PuzzleAnswer {
  word?: string;
  /** The riddle was solved within its fast time. */
  fast?: boolean;
  answers?: (number | null)[];
  pick?: number;
  hits?: number;
  path?: number[];
  guesses?: number[][];
  calls?: ('higher' | 'lower')[];
  dug?: number;
  /** escape */
  escaped?: boolean;
  burns?: number;
  /** differences: the regions tapped; stars: the stars tapped */
  found?: number[];
  /** tug */
  won?: boolean;
  /** bluff */
  verdicts?: ('believe' | 'liar')[];
  /** slider: the squares tapped, in order */
  moves?: number[];
}

const t = (pl: string, en: string): Text => ({ pl, en });
const DECOYS_PL = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ';
const DECOYS_EN = 'ABCDEFGHIJKLMNOPRSTUVWY';

export function makePuzzle(puzzle: Puzzle, rng: Rng, helped: boolean | null, ctx: PuzzleContext = {}): PuzzleState {
  const stat = puzzle.stat && ctx.statValue !== undefined ? { attribute: puzzle.stat, value: ctx.statValue, power: statPower(ctx.statValue) } : undefined;
  const state: PuzzleState = { puzzle, data: draw(puzzle, rng, !!helped, stat?.power ?? 0, ctx), helped };
  if (stat) state.stat = stat;
  return state;
}

function draw(p: Puzzle, rng: Rng, helped: boolean, power: number, ctx: PuzzleContext): PuzzleData {
  switch (p.kind) {
    case 'riddle': {
      // Intelligence clears away false letters: 3 at the bottom, 1 at the top.
      const count = 3 - Math.round(power * 2);
      const pick = (letters: string) => Array.from({ length: count }, () => letters[rng.int(letters.length)]!).join('');
      const pool = p.pool ?? 'riddles';
      return { kind: 'riddle', pool, riddle: rng.int(RIDDLE_POOLS[pool].length), decoys: t(pick(DECOYS_PL), pick(DECOYS_EN)) };
    }
    case 'quiz': {
      const questions: QuizQuestion[] = [];
      const kinds = rng.shuffle([...QUESTION_MAKERS.keys()]);
      for (let i = 0; questions.length < p.questions && i < 40; i++) {
        const q = QUESTION_MAKERS[kinds[i % kinds.length]!]!(rng);
        if (q && !questions.some((o) => o.question.en === q.question.en)) questions.push(q);
      }
      const struck = questions.map((q) => {
        const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correct);
        return wrong[rng.int(wrong.length)]!;
      });
      return { kind: 'quiz', questions, struck, seconds: p.seconds + Math.round(power * 8) };
    }
    case 'cups': {
      const swaps: [number, number][] = [];
      const count = 5 + rng.int(4);
      for (let i = 0; i < count; i++) {
        const a = rng.int(3);
        const b = (a + 1 + rng.int(2)) % 3;
        swaps.push([a, b]);
      }
      return { kind: 'cups', start: rng.int(3), swaps, speedMs: Math.round(430 + 250 * power + (helped ? 290 : 0)) };
    }
    case 'forge': case 'climb':
      return { kind: p.kind, zones: Array.from({ length: p.strikes }, () => 0.2 + rng.next() * 0.6), width: 0.14 + 0.08 * power + (helped ? 0.08 : 0) };
    case 'chests':
      return drawChests(rng);
    case 'traps':
      return drawTraps(rng, p.traps, Math.round(2000 + 1200 * power + (helped ? 1200 : 0)));
    case 'lock': {
      const symbols = rng.shuffle(Array.from({ length: p.symbols }, (_, i) => i));
      return { kind: 'lock', code: symbols.slice(0, p.length), tries: p.tries + (helped ? 1 : 0) + (power >= 0.75 ? 1 : 0) };
    }
    case 'higherLower':
      return { kind: 'higherLower', values: Array.from({ length: p.rounds + 1 }, () => rng.die(10)), forgive: (helped ? 1 : 0) + (power >= 0.75 ? 1 : 0) };
    case 'dig': {
      const layers: (Outcome[] | 'curse')[] = [];
      for (let i = 0; i < p.layers; i++) layers.push(i === p.layers - 1 && p.bottom ? p.bottom : p.loot ?? treasureLayer(rng, i, p.layers));
      // Curses never lie on the first layer, so the first dig is always worth it.
      const spots = rng.shuffle(Array.from({ length: p.layers - 1 }, (_, i) => i + 1)).slice(0, p.curses);
      for (const s of spots) layers[s] = 'curse';
      // A sharp eye or ear (the stat) may warn of a curse one layer ahead.
      const warned = p.stat ? spots.filter(() => rng.next() < power * 0.7) : [];
      return { kind: 'dig', layers, shield: helped, warned };
    }
    case 'sequence': {
      const tones = p.theme === 'lute' ? 5 : 4;
      return { kind: 'sequence', notes: Array.from({ length: p.length }, () => rng.int(tones)), tones, tempoMs: Math.round(520 + 380 * power), replays: helped ? 1 : 0, speedUp: !!p.speedUp };
    }
    case 'escape':
      return drawEscape(rng, p.theme, power);
    case 'differences': {
      const base = Array.from({ length: DIFF_REGIONS }, () => rng.int(3));
      const changed = rng.shuffle(Array.from({ length: DIFF_REGIONS }, (_, i) => i)).slice(0, 3).map((region) => ({ region, variant: (base[region]! + 1 + rng.int(2)) % 3 }));
      return { kind: 'differences', base, changed, seconds: p.seconds + Math.round(12 * power), hint: helped ? changed[0]!.region : null };
    }
    case 'tug':
      return {
        kind: 'tug', start: Math.max(-0.2, Math.min(0.35, (power - 0.35) * 0.5)), tap: 0.06 + 0.035 * power + (helped ? 0.01 : 0),
        pull: 0.24 + rng.next() * 0.14, surges: [1 + rng.next() * 2, 4 + rng.next() * 2, 7 + rng.next() * 2], seconds: 12,
      };
    case 'pairs':
      return { kind: 'pairs', cards: rng.shuffle(Array.from({ length: p.pairs * 2 }, (_, i) => i % p.pairs)), moves: p.moves + (helped ? 2 : 0), peekMs: Math.round(600 + 1800 * power) };
    case 'hold':
      return { kind: 'hold', path: Array.from({ length: p.seconds * 2 + 1 }, () => 0.15 + rng.next() * 0.7), width: 0.16 + 0.12 * power + (helped ? 0.04 : 0), seconds: p.seconds };
    case 'missing':
      return drawMissing(rng, ctx.items ?? [], Math.round(1800 + 2500 * power + (helped ? 800 : 0)));
    case 'scale':
      return { kind: 'scale', coins: p.coins, fake: rng.int(p.coins), weighings: p.weighings + (helped ? 1 : 0) + (power >= 0.75 ? 1 : 0) };
    case 'stars':
      return drawStars(rng, ctx.race, Math.round(1800 + 2600 * power + (helped ? 1000 : 0)));
    case 'bluff': {
      const rolls: [number, number][] = [];
      const claims: number[] = [];
      const tells: boolean[] = [];
      for (let i = 0; i < p.rounds; i++) {
        const roll: [number, number] = [rng.die(6), rng.die(6)];
        const total = roll[0] + roll[1];
        const bluff = total < 12 && rng.int(2) === 0;
        const claim = bluff ? Math.min(12, total + 1 + rng.int(3)) : Math.max(2, total - rng.int(3));
        rolls.push(roll);
        claims.push(claim);
        // Charisma reads the Nomad's face: a bluff may show, a true claim never does.
        tells.push(bluff && rng.next() < 0.15 + 0.6 * power + (helped ? 0.15 : 0));
      }
      return { kind: 'bluff', rolls, claims, tells };
    }
    case 'catch': {
      const n = 18;
      const step = (p.seconds * 1000 * 0.9) / n;
      const spawns = Array.from({ length: n }, (_, i) => ({ x: 0.08 + rng.next() * 0.84, y: 0.1 + rng.next() * 0.75, at: Math.round(i * step + rng.next() * step * 0.6) }));
      return { kind: 'catch', spawns, lifeMs: Math.round(750 + 750 * power + (helped ? 200 : 0)), seconds: p.seconds };
    }
    case 'slider':
      return { kind: 'slider', tiles: scrambleSlider(rng, 12 + Math.round(18 * (1 - power))), seconds: p.seconds, numbered: helped };
  }
}

// ---------- Escape: a field that falls away (or burns) square by square ----------

function drawEscape(rng: Rng, theme: 'void' | 'fire', power: number): PuzzleData {
  const size = 6;
  // Laid out with the safe edge on top, then turned to a random side.
  const turn = rng.int(4);
  const at = (x: number, y: number) => {
    let [a, b] = [x, y];
    for (let i = 0; i < turn; i++) [a, b] = [size - 1 - b, a];
    return b * size + a;
  };
  const ex = rng.int(size - 1);
  const exits = [at(ex, 0), at(ex + 1, 0)];
  const startX = rng.int(size);
  const start = at(startX, size - 2);
  // The wave starts on the row behind the hero and spreads to random neighbours of what it has taken.
  const order: number[] = [];
  const taken = new Set<number>();
  const frontier = new Set<number>([at(Math.max(0, startX - 1), size - 1), at(Math.min(size - 1, startX + 1), size - 1)]);
  while (frontier.size) {
    const list = [...frontier];
    const c = list[rng.int(list.length)]!;
    frontier.delete(c);
    if (taken.has(c) || exits.includes(c)) continue;
    taken.add(c);
    order.push(c);
    for (const n of [c - size, c + size, c - 1, c + 1]) {
      if (n >= 0 && n < size * size && adjacent(c, n, size) && !taken.has(n)) frontier.add(n);
    }
  }
  // A few holes from the start make the way twist; there is always a way through.
  let holes: number[] = [];
  if (theme === 'void') {
    for (let i = 0; i < 50; i++) {
      const pick = rng.shuffle(Array.from({ length: size * size }, (_, k) => k).filter((k) => k !== start && !exits.includes(k))).slice(0, 5);
      if (reaches(size, start, exits, new Set(pick))) { holes = pick; break; }
    }
  }
  return {
    kind: 'escape', size, start, exits, holes, order: order.filter((c) => !holes.includes(c)),
    tickMs: Math.round(theme === 'void' ? 480 + 420 * power : 300 + 280 * power), perTick: 2, stepMs: 480,
  };
}

function reaches(size: number, from: number, to: number[], blocked: Set<number>): boolean {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (to.includes(c)) return true;
    for (const n of [c - size, c + size, c - 1, c + 1]) {
      if (n < 0 || n >= size * size || seen.has(n) || blocked.has(n) || !adjacent(c, n, size)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return false;
}

// ---------- Differences: the parts of the picture that can change ----------

/** Hat, cloak, weapon, shield, belt, boots, sky, bird, tree, flower: each in 3 looks. */
export const DIFF_REGIONS = 10;

// ---------- The thief: a look at the bag, then one thing is gone ----------

function drawMissing(rng: Rng, bag: string[], showMs: number): PuzzleData {
  const own = rng.shuffle([...new Set(bag)]).slice(0, 5);
  const pool = [...new Set([...LOOT_COMMON, ...LOOT_RARE])];
  const pads = rng.shuffle(pool.filter((i) => !own.includes(i))).slice(0, 5 - own.length);
  const shown = rng.shuffle([...own, ...pads]);
  const real = own.length > 0;
  const stolen = real ? shown.indexOf(own[rng.int(own.length)]!) : rng.int(shown.length);
  const decoys = rng.shuffle(pool.filter((i) => !shown.includes(i))).slice(0, 3);
  return { kind: 'missing', shown, stolen, options: rng.shuffle([shown[stolen]!, ...decoys]), showMs, real };
}

// ---------- Stars: the sign of the hero's people ----------

/** One sign per people, as points in a unit square, joined in this order. */
export const STAR_SIGNS: [number, number][][] = [
  [[0.1, 0.8], [0.3, 0.2], [0.5, 0.6], [0.7, 0.2], [0.9, 0.8]],              // Nomads: the mountain pass
  [[0.5, 0.05], [0.2, 0.45], [0.5, 0.95], [0.8, 0.45], [0.5, 0.05]],          // Myrmids: the crystal
  [[0.1, 0.5], [0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.5, 0.1]],               // Humans: the banner
  [[0.5, 0.1], [0.62, 0.4], [0.95, 0.45], [0.68, 0.65], [0.5, 0.95], [0.32, 0.65], [0.05, 0.45], [0.38, 0.4]], // Sunborn: the sun
  [[0.5, 0.95], [0.5, 0.45], [0.2, 0.1], [0.5, 0.45], [0.8, 0.1]],            // Keepers: the tree
  [[0.15, 0.85], [0.15, 0.2], [0.5, 0.05], [0.85, 0.2], [0.85, 0.85]],        // Flintborn: the hammer arch
];
const RACE_ORDER: RaceId[] = ['nomads', 'myrmids', 'humans', 'sunborn', 'keepers', 'flintborn'];

function drawStars(rng: Rng, race: RaceId | undefined, showMs: number): PuzzleData {
  const sign = Math.max(0, RACE_ORDER.indexOf(race ?? 'humans'));
  const shape = STAR_SIGNS[sign]!;
  const scale = 0.5;
  const ox = 0.08 + rng.next() * (0.84 - scale);
  const oy = 0.08 + rng.next() * (0.84 - scale);
  const points: [number, number][] = [];
  const target: number[] = [];
  const key = new Map<string, number>();
  for (const [x, y] of shape) {
    const k = `${x},${y}`;
    if (!key.has(k)) {
      key.set(k, points.length);
      points.push([ox + x * scale + (rng.next() - 0.5) * 0.02, oy + y * scale + (rng.next() - 0.5) * 0.02]);
    }
    target.push(key.get(k)!);
  }
  const real = points.length;
  for (let tries = 0; points.length < real + 9 && tries < 400; tries++) {
    const pt: [number, number] = [0.05 + rng.next() * 0.9, 0.05 + rng.next() * 0.9];
    if (points.every(([x, y]) => Math.hypot(x - pt[0], y - pt[1]) > 0.1)) points.push(pt);
  }
  // Shuffle so the sign's stars are not the first ones.
  const perm = rng.shuffle(points.map((_, i) => i));
  const where = new Map(perm.map((from, to) => [from, to]));
  return { kind: 'stars', points: perm.map((i) => points[i]!), target: target.map((i) => where.get(i)!), showMs, sign };
}

// ---------- Sliding picture: 3×3, the empty square is tile 8 ----------

const SLIDE = 3;
const slideNext = (blank: number) => [blank - SLIDE, blank + SLIDE, blank - 1, blank + 1].filter((n) => n >= 0 && n < SLIDE * SLIDE && adjacent(blank, n, SLIDE));

function scrambleSlider(rng: Rng, moves: number): number[] {
  const tiles = Array.from({ length: SLIDE * SLIDE }, (_, i) => i);
  let blank = tiles.length - 1;
  let prev = -1;
  for (let i = 0; i < moves || tiles.every((x, k) => x === k); i++) {
    const options = slideNext(blank).filter((n) => n !== prev);
    const n = options[rng.int(options.length)]!;
    [tiles[blank], tiles[n]] = [tiles[n]!, tiles[blank]!];
    prev = blank;
    blank = n;
  }
  return tiles;
}

/** Plays taps on the sliding picture: a tap next to the empty square slides that tile in; others do nothing. */
export function slide(tiles: number[], taps: number[]): number[] {
  const t = [...tiles];
  for (const tap of taps) {
    const blank = t.indexOf(SLIDE * SLIDE - 1);
    if (!slideNext(blank).includes(tap)) continue;
    [t[blank], t[tap]] = [t[tap]!, t[blank]!];
  }
  return t;
}
export const slid = (tiles: number[]) => tiles.every((x, i) => x === i);

function treasureLayer(rng: Rng, depth: number, of: number): Outcome[] {
  if (depth >= of - 1) return [{ do: 'randomItem', rare: rng.int(3) === 0 }];
  if (depth >= of - 3 && rng.int(2) === 0) return [{ do: 'randomItem' }];
  const r = rng.int(3);
  if (r === 0) return [{ do: 'herbs', amount: 1 }];
  if (r === 1) return [{ do: 'ores', amount: 1 }];
  return [{ do: 'gold', amount: 2 + rng.int(3) }];
}

// ---------- Chests: exactly one inscription is true ----------

const PERMS: ChestContent[][] = [
  ['treasure', 'empty', 'blast'], ['treasure', 'blast', 'empty'], ['empty', 'treasure', 'blast'],
  ['blast', 'treasure', 'empty'], ['empty', 'blast', 'treasure'], ['blast', 'empty', 'treasure'],
];

export function claimHolds(claim: ChestClaim, speaker: number, contents: ChestContent[]): boolean {
  if (claim.about === 'here') return (contents[speaker] === 'treasure') === claim.treasure;
  return (contents[claim.chest] === claim.is) !== !!claim.not;
}

const trueCount = (claims: ChestClaim[], contents: ChestContent[]) => claims.filter((c, i) => claimHolds(c, i, contents)).length;

/** The chest layouts the inscriptions allow (exactly one of them true). */
export function chestSolutions(claims: ChestClaim[]): ChestContent[][] {
  return PERMS.filter((p) => trueCount(claims, p) === 1);
}

function randomClaim(rng: Rng, speaker: number): ChestClaim {
  if (rng.int(3) === 0) return { about: 'here', treasure: rng.int(2) === 0 };
  const others = [0, 1, 2].filter((i) => i !== speaker);
  const chest = others[rng.int(2)]!;
  const is = (['treasure', 'empty', 'blast'] as const)[rng.int(3)]!;
  return rng.int(3) === 0 ? { about: 'chest', chest, is, not: true } : { about: 'chest', chest, is };
}

function drawChests(rng: Rng): PuzzleData {
  const contents = PERMS[rng.int(PERMS.length)]!;
  for (let i = 0; i < 500; i++) {
    const claims = [0, 1, 2].map((s) => randomClaim(rng, s));
    if (trueCount(claims, contents) !== 1) continue;
    // The treasure has to follow from the inscriptions: every layout they allow hides it in the same chest.
    const treasureAt = new Set(chestSolutions(claims).map((p) => p.indexOf('treasure')));
    if (treasureAt.size === 1) return { kind: 'chests', claims, contents };
  }
  // A layout that always works: "not here", "not here", "it is in the middle" → the left chest.
  const fixed: ChestClaim[] = [{ about: 'here', treasure: false }, { about: 'here', treasure: false }, { about: 'chest', chest: 1, is: 'treasure' }];
  return { kind: 'chests', claims: fixed, contents: ['treasure', ...(rng.int(2) ? ['empty', 'blast'] : ['blast', 'empty']) as ChestContent[]] };
}

// ---------- Traps: a 4×4 field crossed from the bottom row to the top ----------

const adjacent = (a: number, b: number, size: number) => {
  const ax = a % size, ay = Math.floor(a / size), bx = b % size, by = Math.floor(b / size);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

function crossable(size: number, traps: Set<number>): boolean {
  const start = Array.from({ length: size }, (_, x) => (size - 1) * size + x).filter((c) => !traps.has(c));
  const seen = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const c = queue.shift()!;
    if (c < size) return true;
    for (const n of [c - size, c + size, c - 1, c + 1]) {
      if (n < 0 || n >= size * size || seen.has(n) || traps.has(n) || !adjacent(c, n, size)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return false;
}

function drawTraps(rng: Rng, count: number, flashMs: number): PuzzleData {
  const size = 4;
  for (;;) {
    const traps = rng.shuffle(Array.from({ length: size * size }, (_, i) => i)).slice(0, count);
    if (crossable(size, new Set(traps))) return { kind: 'traps', size, traps: traps.sort((a, b) => a - b), flashMs };
  }
}

// ---------- Lock: right rune in the right place, right rune in the wrong place ----------

export function lockHint(code: number[], guess: number[]): { exact: number; near: number } {
  const exact = guess.filter((g, i) => code[i] === g).length;
  const common = guess.filter((g) => code.includes(g)).length;
  return { exact, near: common - exact };
}

// ---------- Quiz questions from the game's data ----------

const REGION: Record<Region, Text> = {
  N: t('Północ', 'the North'), NE: t('Północny wschód', 'the North-East'), E: t('Wschód', 'the East'), SE: t('Południowy wschód', 'the South-East'),
  S: t('Południe', 'the South'), SW: t('Południowy zachód', 'the South-West'), W: t('Zachód', 'the West'), NW: t('Północny zachód', 'the North-West'), C: t('Środek', 'the Centre'),
};
const ATTR: Record<Attribute, Text> = {
  dex: t('Zręczność', 'Dexterity'), cha: t('Charyzmę', 'Charisma'), str: t('Siłę', 'Strength'),
  wil: t('Siłę Woli', 'Willpower'), int: t('Inteligencję', 'Intelligence'), com: t('Walkę', 'Combat'),
};
const ACTION: Partial<Record<TerrainAction, Text>> = {
  mine: t('kopać rudę', 'mine ore'), swim: t('pływać', 'swim'), meditate: t('medytować', 'meditate'),
  hunt: t('polować', 'hunt'), herbalism: t('szukać ziół', 'look for herbs'), gather: t('zbierać owoce', 'gather fruit'),
};
const WILD: TerrainId[] = (Object.keys(TERRAINS) as TerrainId[]).filter((id) => !TERRAINS[id].settlement && TERRAINS[id].drawsEvent);

/** Shuffles `wrong` with `right` into four options. */
function options(rng: Rng, right: Text, wrong: Text[]): { options: Text[]; correct: number } {
  const all = rng.shuffle([right, ...rng.shuffle(wrong).slice(0, 3)]);
  return { options: all, correct: all.indexOf(right) };
}

/** Four distinct items with one clear top value, or null. */
function topOf<T>(rng: Rng, pool: T[], value: (x: T) => number): { top: T; rest: T[] } | null {
  const four = rng.shuffle(pool).slice(0, 4);
  const sorted = [...four].sort((a, b) => value(b) - value(a));
  if (sorted.length < 4 || value(sorted[0]!) === value(sorted[1]!)) return null;
  return { top: sorted[0]!, rest: sorted.slice(1) };
}

const QUESTION_MAKERS: ((rng: Rng) => QuizQuestion | null)[] = [
  // The toughest foe of four.
  (rng) => {
    const pick = topOf(rng, Object.values(ENEMIES), (e) => e.vitality);
    if (!pick) return null;
    return { question: t('Który z tych przeciwników ma najwięcej Żywotności?', 'Which of these foes has the most Vitality?'), ...options(rng, pick.top.name, pick.rest.map((e) => e.name)) };
  },
  // The race strongest in an attribute.
  (rng) => {
    const attr = ATTRIBUTES[rng.int(ATTRIBUTES.length)]!;
    const pick = topOf(rng, Object.values(RACES), (r) => r.attributes[attr]);
    if (!pick) return null;
    return { question: t(`Która rasa zaczyna z najwyższą wartością cechy: ${ATTR[attr].pl}?`, `Which race starts with the highest ${ATTR[attr].en}?`), ...options(rng, pick.top.name, pick.rest.map((r) => r.name)) };
  },
  // Where a race comes from.
  (rng) => {
    const races = Object.values(RACES);
    const race = races[rng.int(races.length)]!;
    const wrong = (Object.keys(REGION) as Region[]).filter((r) => r !== race.homeland && r !== 'C').map((r) => REGION[r]);
    return { question: t(`Skąd pochodzi rasa: ${race.name.pl}?`, `Where do the ${race.name.en} come from?`), ...options(rng, REGION[race.homeland], wrong) };
  },
  // Which land lets you do something.
  (rng) => {
    const acts = (Object.keys(ACTION) as TerrainAction[]);
    const act = acts[rng.int(acts.length)]!;
    const yes = WILD.filter((id) => TERRAINS[id].actions.includes(act));
    const no = WILD.filter((id) => !TERRAINS[id].actions.includes(act));
    if (!yes.length || no.length < 3) return null;
    const right = TERRAINS[yes[rng.int(yes.length)]!].name;
    return { question: t(`Na którym z tych terenów można ${ACTION[act]!.pl}?`, `On which of these lands can you ${ACTION[act]!.en}?`), ...options(rng, right, no.map((id) => TERRAINS[id].name)) };
  },
  // Which land is hard going.
  (rng) => {
    const hard = WILD.filter((id) => TERRAINS[id].hard);
    const easy = WILD.filter((id) => !TERRAINS[id].hard);
    if (!hard.length || easy.length < 3) return null;
    return { question: t('Który teren kosztuje 2 Szybkości, by na niego wejść?', 'Which land costs 2 Speed to enter?'), ...options(rng, TERRAINS[hard[rng.int(hard.length)]!].name, easy.map((id) => TERRAINS[id].name)) };
  },
  // What a foe fights with.
  (rng) => {
    const foes = Object.values(ENEMIES);
    const foe = foes[rng.int(foes.length)]!;
    const wrong = [...new Map(foes.filter((e) => e.weapon.name.en !== foe.weapon.name.en).map((e) => [e.weapon.name.en, e.weapon.name])).values()];
    if (wrong.length < 3) return null;
    return { question: t(`Czym walczy ${foe.name.pl}?`, `What does the ${foe.name.en} fight with?`), ...options(rng, foe.weapon.name, wrong) };
  },
];

// ---------- Scoring ----------

const norm = (s: string) => s.trim().toUpperCase();

export interface PuzzleResult {
  /** The number the result table reads: right answers, hits, a run, layers dug. */
  score: number;
  won: boolean;
  then: Outcome[];
}

const byScore = (table: Outcome[][], score: number) => table[Math.min(score, table.length - 1)] ?? [];

/** Checks the answer against the puzzle and picks the outcomes. Bad or missing answers count as a failure. */
export function scorePuzzle(state: PuzzleState, answer: PuzzleAnswer): PuzzleResult {
  const { puzzle: p, data: d } = state;
  if (p.kind === 'riddle' && d.kind === 'riddle') {
    const riddle = RIDDLE_POOLS[d.pool ?? 'riddles'][d.riddle]!;
    const ok = !!answer.word && [riddle.answer.pl, riddle.answer.en].map(norm).includes(norm(answer.word));
    return { score: ok ? (answer.fast ? 2 : 1) : 0, won: ok, then: ok ? [...p.win, ...(answer.fast ? p.fast : [])] : p.lose };
  }
  if (p.kind === 'quiz' && d.kind === 'quiz') {
    const score = d.questions.filter((q, i) => answer.answers?.[i] === q.correct).length;
    return { score, won: score >= 2, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'cups' && d.kind === 'cups') {
    const ok = answer.pick === cupsEnd(d);
    return { score: ok ? 1 : 0, won: ok, then: ok ? p.win : p.lose };
  }
  if ((p.kind === 'forge' || p.kind === 'climb') && (d.kind === 'forge' || d.kind === 'climb')) {
    const score = Math.max(0, Math.min(p.strikes, Math.floor(answer.hits ?? 0)));
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'chests' && d.kind === 'chests') {
    const got = answer.pick !== undefined ? d.contents[answer.pick] : undefined;
    if (got === 'treasure') return { score: 2, won: true, then: p.treasure };
    if (got === 'blast') return { score: 0, won: false, then: p.blast };
    return { score: 1, won: false, then: p.empty };
  }
  if (p.kind === 'traps' && d.kind === 'traps') {
    const steps = trapWalk(d, answer.path ?? []);
    return { score: steps.safe ? 1 : 0, won: steps.safe, then: steps.safe ? p.win : p.hit };
  }
  if (p.kind === 'lock' && d.kind === 'lock') {
    const tries = (answer.guesses ?? []).slice(0, d.tries);
    const at = tries.findIndex((g) => g.length === d.code.length && g.every((x, i) => x === d.code[i]));
    return { score: at < 0 ? 0 : d.tries - at, won: at >= 0, then: at >= 0 ? p.win : p.lose };
  }
  if (p.kind === 'higherLower' && d.kind === 'higherLower') {
    const score = higherLowerRun(d, answer.calls ?? []);
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'dig' && d.kind === 'dig') {
    const dig = digResult(d, answer.dug ?? 0);
    return { score: dig.depth, won: !dig.bust, then: dig.bust ? [...dig.wounds, ...p.bust] : [...dig.wounds, ...dig.loot] };
  }
  if (p.kind === 'sequence' && d.kind === 'sequence') {
    const score = clampInt(answer.hits, d.notes.length);
    return { score, won: score >= d.notes.length, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'escape' && d.kind === 'escape') {
    const burns = clampInt(answer.burns, 3);
    const escaped = !!answer.escaped && (p.theme === 'void' || burns < 3);
    const burnt = Array.from({ length: burns }, () => p.burn ?? []).flat();
    return { score: escaped ? 1 : 0, won: escaped, then: [...burnt, ...(escaped ? p.win : p.lose)] };
  }
  if (p.kind === 'differences' && d.kind === 'differences') {
    const found = new Set((answer.found ?? []).filter((r) => d.changed.some((c) => c.region === r)));
    return { score: found.size, won: found.size >= 2, then: byScore(p.byScore, found.size) };
  }
  if (p.kind === 'tug' && d.kind === 'tug') {
    return { score: answer.won ? 1 : 0, won: !!answer.won, then: answer.won ? p.win : p.lose };
  }
  if (p.kind === 'pairs' && d.kind === 'pairs') {
    const score = clampInt(answer.hits, p.pairs);
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'hold' && d.kind === 'hold') {
    const score = clampInt(answer.hits, 3);
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'missing' && d.kind === 'missing') {
    const ok = answer.pick !== undefined && d.options[answer.pick] === d.shown[d.stolen];
    const loss: Outcome[] = d.real ? [{ do: 'loseItem', item: d.shown[d.stolen]! }] : [{ do: 'gold', amount: -2 }];
    return { score: ok ? 1 : 0, won: ok, then: ok ? p.win : [...loss, ...p.lose] };
  }
  if (p.kind === 'scale' && d.kind === 'scale') {
    const ok = answer.pick === d.fake;
    return { score: ok ? 1 : 0, won: ok, then: ok ? p.win : p.lose };
  }
  if (p.kind === 'stars' && d.kind === 'stars') {
    const score = starScore(d, answer.found ?? []);
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'bluff' && d.kind === 'bluff') {
    const score = bluffScore(d, answer.verdicts ?? []);
    return { score, won: score * 2 > d.claims.length, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'catch' && d.kind === 'catch') {
    const caught = clampInt(answer.hits, d.spawns.length);
    const score = Math.floor(caught / Math.max(1, p.per));
    return { score, won: score > 0, then: byScore(p.byScore, score) };
  }
  if (p.kind === 'slider' && d.kind === 'slider') {
    const ok = slid(slide(d.tiles, answer.moves ?? []));
    return { score: ok ? 1 : 0, won: ok, then: ok ? p.win : p.lose };
  }
  return { score: 0, won: false, then: [] };
}

const clampInt = (n: number | undefined, max: number) => Math.max(0, Math.min(max, Math.floor(n ?? 0)));

/** 2: every star of the sign and no other; 1: all but one, with at most one stray; 0: anything else. */
export function starScore(d: { target: number[] }, picked: number[]): number {
  const want = new Set(d.target);
  const got = new Set(picked);
  const right = [...got].filter((i) => want.has(i)).length;
  const wrong = got.size - right;
  if (right === want.size && wrong === 0) return 2;
  if (right >= want.size - 1 && wrong <= 1) return 1;
  return 0;
}

/** A claim is "at least this much": believing a true one or calling out a false one is right. */
export function bluffTrue(d: { rolls: [number, number][]; claims: number[] }, round: number): boolean {
  const [a, b] = d.rolls[round]!;
  return a + b >= d.claims[round]!;
}
export function bluffScore(d: { rolls: [number, number][]; claims: number[] }, verdicts: ('believe' | 'liar')[]): number {
  return d.claims.filter((_, i) => verdicts[i] !== undefined && (verdicts[i] === 'believe') === bluffTrue(d, i)).length;
}

export function cupsEnd(d: { start: number; swaps: [number, number][] }): number {
  let at = d.start;
  for (const [a, b] of d.swaps) {
    if (at === a) at = b;
    else if (at === b) at = a;
  }
  return at;
}

/** Walks a path across the trap field: it has to start on the bottom row, go step by step and reach the top. */
export function trapWalk(d: { size: number; traps: number[] }, path: number[]): { safe: boolean; trap: number | null; steps: number } {
  const { size } = d;
  let prev: number | null = null;
  for (let i = 0; i < path.length; i++) {
    const c = path[i]!;
    const valid = prev === null ? c >= (size - 1) * size && c < size * size : adjacent(prev, c, size);
    if (!valid) return { safe: false, trap: null, steps: i };
    if (d.traps.includes(c)) return { safe: false, trap: c, steps: i + 1 };
    if (c < size) return { safe: true, trap: null, steps: i + 1 };
    prev = c;
  }
  return { safe: false, trap: null, steps: path.length };
}

/** The run of right calls: a tie counts as right; a wrong call (past the forgiven one) takes the run back to 0. */
export function higherLowerRun(d: { values: number[]; forgive: number }, calls: ('higher' | 'lower')[]): number {
  let run = 0;
  let forgive = d.forgive;
  for (let i = 0; i < calls.length && i + 1 < d.values.length; i++) {
    const cur = d.values[i]!;
    const next = d.values[i + 1]!;
    const right = next === cur || (calls[i] === 'higher' ? next > cur : next < cur);
    if (right) run++;
    else if (forgive > 0) forgive--;
    else return 0;
  }
  return run;
}

export function digResult(d: { layers: (Outcome[] | 'curse')[]; shield: boolean }, dug: number): { depth: number; bust: boolean; loot: Outcome[]; wounds: Outcome[] } {
  const loot: Outcome[] = [];
  const wounds: Outcome[] = [];
  let shield = d.shield;
  const depth = Math.max(0, Math.min(d.layers.length, Math.floor(dug)));
  for (let i = 0; i < depth; i++) {
    const layer = d.layers[i]!;
    if (layer !== 'curse') loot.push(...layer);
    else if (shield) {
      shield = false;
      wounds.push({ do: 'vitality', amount: -3 });
    } else return { depth: i + 1, bust: true, loot: [], wounds };
  }
  return { depth, bust: false, loot, wounds };
}
