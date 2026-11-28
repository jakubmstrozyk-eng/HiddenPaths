import { describe, expect, it } from 'vitest';
import { EVENT_BY_ID, RIDDLES, type Puzzle } from '@hp/content';
import {
  applyAction, chestSolutions, claimHolds, createGame, cupsEnd, currentPlayer, digResult, higherLowerRun, legalActions, lockHint, makePuzzle, scorePuzzle, timeoutTurn, trapWalk, Rng,
  type CharacterInput, type GameConfig, type GameState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

function atCard(card: number, seed = 'pz'): GameState {
  const state = onMap(createGame(seed, solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(state);
  p.character.gold = 20;
  p.character.food = 5;
  p.pendingEvent = { card, step: 'start' };
  return state;
}

/** Picks the first option whose script starts a puzzle, and returns the game waiting for its answer. */
function startPuzzle(state: GameState, step = 'start') {
  const p = currentPlayer(state);
  p.pendingEvent = { card: p.pendingEvent!.card, step };
  const options = EVENT_BY_ID[p.pendingEvent.card]!.steps[step]!.options;
  const index = options.findIndex((o) => o.then.some((x) => x.do === 'puzzle'));
  const next = applyAction(state, 'p1', { type: 'event', option: index });
  return next;
}

describe('event puzzles', () => {
  it('the satyr waits for the riddle and blesses a right answer', () => {
    const state = startPuzzle(atCard(5));
    const p = currentPlayer(state);
    expect(p.pendingEvent?.puzzle?.data.kind).toBe('riddle');
    expect(legalActions(state, 'p1')).toEqual([{ type: 'puzzle', answer: {} }]);
    expect(() => applyAction(state, 'p1', { type: 'endTurn' })).toThrow();
    const d = p.pendingEvent!.puzzle!.data;
    if (d.kind !== 'riddle') throw new Error();
    const right = applyAction(state, 'p1', { type: 'puzzle', answer: { word: RIDDLES[d.riddle]!.answer.pl.toLowerCase(), fast: true } });
    const after = currentPlayer(right);
    expect(after.pendingEvent).toBeNull();
    expect(after.effects.some((e) => e.attribute === 'com' && e.amount === 10)).toBe(true);
    const wrong = applyAction(state, 'p1', { type: 'puzzle', answer: { word: 'nope' } });
    expect(currentPlayer(wrong).character.gold).toBe(19);
  });

  it('the same seed draws the same puzzle, so every screen of an online game sees it', () => {
    const a = currentPlayer(startPuzzle(atCard(17, 'same'))).pendingEvent!.puzzle;
    const b = currentPlayer(startPuzzle(atCard(17, 'same'))).pendingEvent!.puzzle;
    expect(a).toEqual(b);
    expect(a!.data.kind === 'quiz' && a!.data.questions.length).toBe(3);
  });

  it('quiz questions always have four options and one right answer', () => {
    const quiz: Puzzle = { kind: 'quiz', questions: 3, seconds: 15, byScore: [[], [], [], []] };
    for (let i = 0; i < 200; i++) {
      const s = makePuzzle(quiz, new Rng(i), true);
      if (s.data.kind !== 'quiz') throw new Error();
      expect(s.data.questions.length).toBe(3);
      for (const [n, q] of s.data.questions.entries()) {
        expect(q.options.length).toBe(4);
        expect(new Set(q.options.map((o) => o.en)).size).toBe(4);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(s.data.struck[n]).not.toBe(q.correct);
      }
      const all = scorePuzzle(s, { answers: s.data.questions.map((q) => q.correct) });
      expect(all.score).toBe(3);
    }
  });

  it('chest inscriptions always point to exactly one treasure chest, and it is the real one', () => {
    const p: Puzzle = { kind: 'chests', treasure: [], empty: [], blast: [] };
    for (let i = 0; i < 300; i++) {
      const s = makePuzzle(p, new Rng(i), false);
      if (s.data.kind !== 'chests') throw new Error();
      const { claims, contents } = s.data;
      expect(claims.filter((c, k) => claimHolds(c, k, contents)).length).toBe(1);
      const at = new Set(chestSolutions(claims).map((x) => x.indexOf('treasure')));
      expect([...at]).toEqual([contents.indexOf('treasure')]);
      expect(scorePuzzle(s, { pick: contents.indexOf('treasure') }).won).toBe(true);
    }
  });

  it('the shuffle, the trap field, the lock, the dice run and the dig score as their rules say', () => {
    expect(cupsEnd({ start: 0, swaps: [[0, 1], [1, 2], [0, 1]] })).toBe(2);
    const field = { size: 4, traps: [9, 10] };
    expect(trapWalk(field, [12, 8, 4, 0]).safe).toBe(true);
    expect(trapWalk(field, [13, 9]).trap).toBe(9);
    expect(trapWalk(field, [12, 4]).safe).toBe(false);
    expect(lockHint([0, 1, 2], [0, 2, 4])).toEqual({ exact: 1, near: 1 });
    expect(higherLowerRun({ values: [5, 8, 3, 3, 9], forgive: 0 }, ['higher', 'lower', 'lower', 'higher'])).toBe(4);
    expect(higherLowerRun({ values: [5, 8, 3], forgive: 0 }, ['lower'])).toBe(0);
    expect(higherLowerRun({ values: [5, 8, 3], forgive: 1 }, ['lower', 'lower'])).toBe(1);
    const layers = [[{ do: 'gold' as const, amount: 2 }], 'curse' as const, [{ do: 'gold' as const, amount: 3 }]];
    expect(digResult({ layers, shield: false }, 1)).toMatchObject({ bust: false, loot: [{ do: 'gold', amount: 2 }] });
    expect(digResult({ layers, shield: false }, 2).bust).toBe(true);
    expect(digResult({ layers, shield: true }, 3)).toMatchObject({ bust: false, wounds: [{ do: 'vitality', amount: -3 }] });
  });

  it('every trap field can be crossed', () => {
    for (let i = 0; i < 200; i++) {
      const s = makePuzzle({ kind: 'traps', traps: 6, win: [], hit: [] }, new Rng(i), false);
      if (s.data.kind !== 'traps') throw new Error();
      expect(s.data.traps.length).toBe(6);
    }
  });

  it('three true blows at the runic forge let the hero choose the rune', () => {
    let state = atCard(29);
    state = applyAction(state, 'p1', { type: 'event', option: 0 });
    expect(currentPlayer(state).pendingEvent?.step).toBe('forge');
    state = startPuzzle(state, 'forge');
    expect(currentPlayer(state).character.gold).toBe(14);
    state = applyAction(state, 'p1', { type: 'puzzle', answer: { hits: 3 } });
    expect(currentPlayer(state).pendingEvent?.step).toBe('choose');
    state = applyAction(state, 'p1', { type: 'event', option: 4 });
    expect(currentPlayer(state).character.equipment.rune).toBe('piercing');
  });

  it('a mini-game left unanswered when the turn times out counts as given up', () => {
    const state = startPuzzle(atCard(5));
    const after = timeoutTurn(state);
    expect(after.players[0]!.pendingEvent).toBeNull();
    expect(after.log.some((e) => e.type === 'puzzle' && !e.won)).toBe(true);
  });
});
