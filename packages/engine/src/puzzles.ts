import {
  ATTRIBUTES, ENEMIES, RACES, RIDDLES, TERRAINS,
  type Attribute, type Outcome, type Puzzle, type Region, type TerrainAction, type TerrainId, type Text,
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
  | { kind: 'riddle'; riddle: number; decoys: Text }
  | { kind: 'quiz'; questions: QuizQuestion[]; struck: number[] }
  | { kind: 'cups'; start: number; swaps: [number, number][] }
  | { kind: 'forge' | 'climb'; zones: number[]; width: number }
  | { kind: 'chests'; claims: ChestClaim[]; contents: ChestContent[] }
  | { kind: 'traps'; size: number; traps: number[]; flashMs: number }
  | { kind: 'lock'; code: number[]; tries: number }
  | { kind: 'higherLower'; values: number[]; forgive: number }
  | { kind: 'dig'; layers: (Outcome[] | 'curse')[]; shield: boolean };

export interface PuzzleState {
  puzzle: Puzzle;
  data: PuzzleData;
  /** The helper test passed (null when the puzzle has none). */
  helped: boolean | null;
}

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
}

const t = (pl: string, en: string): Text => ({ pl, en });
const DECOYS_PL = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ';
const DECOYS_EN = 'ABCDEFGHIJKLMNOPRSTUVWY';

export function makePuzzle(puzzle: Puzzle, rng: Rng, helped: boolean | null): PuzzleState {
  return { puzzle, data: draw(puzzle, rng, !!helped), helped };
}

function draw(p: Puzzle, rng: Rng, helped: boolean): PuzzleData {
  switch (p.kind) {
    case 'riddle': {
      const pick = (letters: string) => Array.from({ length: 3 }, () => letters[rng.int(letters.length)]!).join('');
      return { kind: 'riddle', riddle: rng.int(RIDDLES.length), decoys: t(pick(DECOYS_PL), pick(DECOYS_EN)) };
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
      return { kind: 'quiz', questions, struck };
    }
    case 'cups': {
      const swaps: [number, number][] = [];
      const count = 5 + rng.int(4);
      for (let i = 0; i < count; i++) {
        const a = rng.int(3);
        const b = (a + 1 + rng.int(2)) % 3;
        swaps.push([a, b]);
      }
      return { kind: 'cups', start: rng.int(3), swaps };
    }
    case 'forge': case 'climb':
      return { kind: p.kind, zones: Array.from({ length: p.strikes }, () => 0.2 + rng.next() * 0.6), width: helped ? 0.22 : 0.14 };
    case 'chests':
      return drawChests(rng);
    case 'traps':
      return drawTraps(rng, p.traps, helped);
    case 'lock': {
      const symbols = rng.shuffle(Array.from({ length: p.symbols }, (_, i) => i));
      return { kind: 'lock', code: symbols.slice(0, p.length), tries: p.tries + (helped ? 1 : 0) };
    }
    case 'higherLower':
      return { kind: 'higherLower', values: Array.from({ length: p.rounds + 1 }, () => rng.die(10)), forgive: helped ? 1 : 0 };
    case 'dig': {
      const layers: (Outcome[] | 'curse')[] = [];
      for (let i = 0; i < p.layers; i++) layers.push(i === p.layers - 1 && p.bottom ? p.bottom : treasureLayer(rng, i, p.layers));
      // Curses never lie on the first layer, so the first dig is always worth it.
      const spots = rng.shuffle(Array.from({ length: p.layers - 1 }, (_, i) => i + 1)).slice(0, p.curses);
      for (const s of spots) layers[s] = 'curse';
      return { kind: 'dig', layers, shield: helped };
    }
  }
}

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

function drawTraps(rng: Rng, count: number, helped: boolean): PuzzleData {
  const size = 4;
  for (;;) {
    const traps = rng.shuffle(Array.from({ length: size * size }, (_, i) => i)).slice(0, count);
    if (crossable(size, new Set(traps))) return { kind: 'traps', size, traps: traps.sort((a, b) => a - b), flashMs: helped ? 3200 : 2000 };
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
    const riddle = RIDDLES[d.riddle]!;
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
  return { score: 0, won: false, then: [] };
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
