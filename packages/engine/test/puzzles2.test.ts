import { describe, expect, it } from 'vitest';
import { EVENT_BY_ID, EVENTS, RIDDLE_POOLS, type Puzzle } from '@hp/content';
import {
  applyAction, bluffScore, bluffTrue, createGame, currentPlayer, makePuzzle, scorePuzzle, slid, slide, starScore, statPower, Rng,
  type CharacterInput, type GameConfig, type GameState, type PuzzleState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter', 'scout'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

function atCard(card: number, seed = 'pz2'): GameState {
  const state = onMap(createGame(seed, solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(state);
  p.character.gold = 20;
  p.character.food = 5;
  p.pendingEvent = { card, step: 'start' };
  return state;
}

function startPuzzle(state: GameState): GameState {
  const p = currentPlayer(state);
  const options = EVENT_BY_ID[p.pendingEvent!.card]!.steps[p.pendingEvent!.step]!.options;
  const index = options.findIndex((o) => o.then.some((x) => x.do === 'puzzle'));
  return applyAction(state, 'p1', { type: 'event', option: index });
}

const puzzleOf = (state: GameState): PuzzleState => currentPlayer(state).pendingEvent!.puzzle!;

describe('stage 2 event mini-games', () => {
  it('every new or upgraded card starts its mini-game, and the hero\'s stat is recorded', () => {
    for (const card of [1, 2, 7, 9, 11, 13, 14, 24, 31, 35, 36, 37, 42, 47, 51, 52, 53, 54, 55, 56, 57, 58]) {
      const state = startPuzzle(atCard(card));
      const pz = puzzleOf(state);
      expect(pz, `card ${card}`).toBeDefined();
      expect(pz.stat, `card ${card} uses a stat`).toBeDefined();
      expect(pz.stat!.power).toBeGreaterThanOrEqual(0);
    }
    expect(EVENTS.filter((e) => e.id > 50).length).toBe(8);
  });

  it('a stronger hero starts arm wrestling ahead and pulls harder', () => {
    const tug: Puzzle = { kind: 'tug', stat: 'str', win: [], lose: [] };
    const weak = makePuzzle(tug, new Rng(1), null, { statValue: 10 });
    const strong = makePuzzle(tug, new Rng(1), null, { statValue: 50 });
    if (weak.data.kind !== 'tug' || strong.data.kind !== 'tug') throw new Error();
    expect(strong.data.start).toBeGreaterThan(weak.data.start);
    expect(strong.data.tap).toBeGreaterThan(weak.data.tap);
    expect(statPower(10)).toBe(0);
    expect(statPower(50)).toBe(1);
  });

  it('Intelligence clears false letters from a riddle', () => {
    const riddle: Puzzle = { kind: 'riddle', stat: 'int', seconds: 45, fastSeconds: 20, win: [], fast: [], lose: [] };
    const dull = makePuzzle(riddle, new Rng(3), null, { statValue: 10 });
    const sharp = makePuzzle(riddle, new Rng(3), null, { statValue: 60 });
    if (dull.data.kind !== 'riddle' || sharp.data.kind !== 'riddle') throw new Error();
    expect(dull.data.decoys.pl.length).toBe(3);
    expect(sharp.data.decoys.pl.length).toBe(1);
  });

  it('the escape field always has a way from the hero to the safe edge', () => {
    for (let i = 0; i < 200; i++) {
      const s = makePuzzle({ kind: 'escape', theme: 'void', stat: 'dex', win: [], lose: [] }, new Rng(i), null, { statValue: 30 });
      if (s.data.kind !== 'escape') throw new Error();
      const { size, start, exits, holes } = s.data;
      const seen = new Set([start]);
      const queue = [start];
      let ok = false;
      while (queue.length) {
        const c = queue.shift()!;
        if (exits.includes(c)) { ok = true; break; }
        for (const n of [c - size, c + size, c - 1, c + 1]) {
          const same = Math.abs((n % size) - (c % size)) + Math.abs(Math.floor(n / size) - Math.floor(c / size)) === 1;
          if (n >= 0 && n < size * size && same && !seen.has(n) && !holes.includes(n)) { seen.add(n); queue.push(n); }
        }
      }
      expect(ok).toBe(true);
      expect(s.data.order).not.toContain(exits[0]);
    }
  });

  it('fire burns cost Vitality even when the hero escapes', () => {
    let state = atCard(35);
    state = startPuzzle(state);
    const vit = currentPlayer(state).character.vitality;
    state = applyAction(state, 'p1', { type: 'puzzle', answer: { escaped: true, burns: 2 } });
    expect(currentPlayer(state).character.vitality).toBe(vit - 4);
  });

  it('the sliding fresco is solvable and scores only a finished picture', () => {
    for (let i = 0; i < 50; i++) {
      const s = makePuzzle({ kind: 'slider', stat: 'int', seconds: 90, win: [{ do: 'xp', amount: 1 }], lose: [] }, new Rng(i), false, { statValue: 20 });
      if (s.data.kind !== 'slider') throw new Error();
      expect(slid(s.data.tiles)).toBe(false);
      expect(new Set(s.data.tiles).size).toBe(9);
    }
    expect(slide([0, 1, 2, 3, 4, 5, 6, 8, 7], [8])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const s: PuzzleState = { puzzle: { kind: 'slider', seconds: 90, win: [{ do: 'xp', amount: 1 }], lose: [] }, data: { kind: 'slider', tiles: [0, 1, 2, 3, 4, 5, 6, 8, 7], seconds: 90, numbered: false }, helped: null };
    expect(scorePuzzle(s, { moves: [8] }).won).toBe(true);
    expect(scorePuzzle(s, { moves: [0] }).won).toBe(false);
  });

  it('stars, the Nomad\'s claims and the scales score as their rules say', () => {
    expect(starScore({ target: [1, 2, 3] }, [1, 2, 3])).toBe(2);
    expect(starScore({ target: [1, 2, 3] }, [1, 2, 7])).toBe(1);
    expect(starScore({ target: [1, 2, 3] }, [1, 6, 7])).toBe(0);
    const d = { rolls: [[3, 4], [1, 1]] as [number, number][], claims: [6, 5] };
    expect(bluffTrue(d, 0)).toBe(true);
    expect(bluffTrue(d, 1)).toBe(false);
    expect(bluffScore(d, ['believe', 'liar'])).toBe(2);
    for (let i = 0; i < 100; i++) {
      const s = makePuzzle({ kind: 'stars', stat: 'int', byScore: [[], [], []] }, new Rng(i), null, { statValue: 30, race: 'sunborn' });
      if (s.data.kind !== 'stars') throw new Error();
      expect(scorePuzzle(s, { found: [...new Set(s.data.target)] }).score).toBe(2);
    }
    const scale = makePuzzle({ kind: 'scale', stat: 'int', coins: 6, weighings: 2, win: [{ do: 'gold', amount: 1 }], lose: [] }, new Rng(5), null, { statValue: 50 });
    if (scale.data.kind !== 'scale') throw new Error();
    expect(scale.data.weighings).toBe(3);
    expect(scorePuzzle(scale, { pick: scale.data.fake }).won).toBe(true);
  });

  it('the pickpocket takes a real thing from the bag on a wrong answer', () => {
    let state = atCard(51);
    currentPlayer(state).inventory.items = ['dagger'];
    state = startPuzzle(state);
    const d = puzzleOf(state).data;
    if (d.kind !== 'missing') throw new Error();
    expect(d.real).toBe(true);
    expect(d.shown[d.stolen]).toBe('dagger');
    const wrong = d.options.findIndex((o) => o !== 'dagger');
    const lost = applyAction(state, 'p1', { type: 'puzzle', answer: { pick: wrong } });
    expect(currentPlayer(lost).inventory.items).not.toContain('dagger');
    const kept = applyAction(state, 'p1', { type: 'puzzle', answer: { pick: d.options.indexOf('dagger') } });
    expect(currentPlayer(kept).inventory.items).toContain('dagger');
  });

  it('reading a book is a word puzzle; three good readings teach the lesson', () => {
    let state = atCard(22);
    const p = currentPlayer(state);
    p.pendingEvent = null;
    p.inventory.items = ['bookKnight'];
    const com = p.character.attributes.com;
    for (let round = 0; round < 3; round++) {
      state = applyAction(state, 'p1', { type: 'read', item: 'bookKnight' });
      const pz = puzzleOf(state);
      expect(pz.data.kind === 'riddle' && pz.data.pool).toBe('knight');
      state = applyAction(state, 'p1', { type: 'puzzle', answer: { word: 'x' } });
      state.players[0]!.counters = Object.fromEntries(Object.entries(state.players[0]!.counters).filter(([k]) => !k.startsWith('read:')));
      // A wrong word does not count, a right one does.
      if (round === 0) expect(currentPlayer(state).counters['book:bookKnight']).toBeUndefined();
    }
    for (let round = 0; round < 3; round++) {
      state = applyAction(state, 'p1', { type: 'read', item: 'bookKnight' });
      const d = puzzleOf(state).data;
      if (d.kind !== 'riddle') throw new Error();
      state = applyAction(state, 'p1', { type: 'puzzle', answer: { word: RIDDLE_POOLS.knight[d.riddle]!.answer.pl } });
      state.players[0]!.counters = Object.fromEntries(Object.entries(state.players[0]!.counters).filter(([k]) => !k.startsWith('read:')));
    }
    expect(currentPlayer(state).character.attributes.com).toBe(com + 5);
    expect(currentPlayer(state).inventory.items).not.toContain('bookKnight');
  });
});
