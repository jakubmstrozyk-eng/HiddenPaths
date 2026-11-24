import { describe, expect, it } from 'vitest';
import { applyAction, createGame, entryCell, isOutside, legalActions, OUTSIDE, SIDES } from '../src';

const fresh = () => createGame('enter', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
  [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]);

describe('starting outside the map', () => {
  it('puts every hero outside the map, with nothing revealed', () => {
    const g = fresh();
    expect(g.players[0]!.position).toBe(OUTSIDE);
    expect(isOutside(g.players[0]!)).toBe(true);
    expect(g.players[0]!.revealed).toEqual([]);
  });

  it('finds the middle of each side', () => {
    const map = { width: 7, height: 5 };
    expect(entryCell(map, 'N')).toBe(3);
    expect(entryCell(map, 'S')).toBe(4 * 7 + 3);
    expect(entryCell(map, 'W')).toBe(2 * 7);
    expect(entryCell(map, 'E')).toBe(2 * 7 + 6);
  });

  it('offers only stepping in from a side, or ending the turn', () => {
    const types = new Set(legalActions(fresh(), 'p').map((a) => a.type));
    expect([...types].every((t) => t === 'enter' || t === 'endTurn' || t === 'spend')).toBe(true);
    expect(types.has('enter')).toBe(true);
    expect(() => applyAction(fresh(), 'p', { type: 'camp' })).toThrow(/map first/);
  });

  for (const side of SIDES) {
    it(`steps onto the middle of side ${side}, paying Speed and Stamina`, () => {
      const g = fresh();
      if (!legalActions(g, 'p').some((a) => a.type === 'enter' && a.side === side)) return;
      const after = applyAction(g, 'p', { type: 'enter', side });
      const me = after.players[0]!;
      const to = entryCell(after.map, side);
      expect(me.position).toBe(to);
      expect(me.start).toBe(to);
      expect(me.respawnAt).toBe(to);
      expect(me.cameFrom).toBeNull();
      expect(me.revealed).toContain(to);
      expect(me.staminaLeft).toBe(g.players[0]!.staminaLeft - 1);
      expect(me.speedLeft).toBeLessThan(g.players[0]!.speedLeft);
      expect(() => applyAction(after, 'p', { type: 'enter', side })).toThrow();
    });
  }
});
