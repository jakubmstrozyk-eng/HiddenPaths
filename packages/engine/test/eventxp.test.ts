import { describe, expect, it } from 'vitest';
import { BOOK_CARDS, DUNGEON_CARD_BASE, EVENTS, TRAIT_OPTIONS } from '@hp/content';
import { createGame, currentPlayer, Rng, type CharacterInput, type GameConfig } from '../src';
import { runOutcomes, startEvent } from '../src/events';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter', 'scout'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

/** Every XP amount anywhere inside a card script. */
function xpAmounts(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) node.forEach((n) => xpAmounts(n, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (o.do === 'xp') out.push(o.amount as number);
    Object.values(o).forEach((v) => xpAmounts(v, out));
  }
  return out;
}

describe('event XP: at most 1 extra point per random event', () => {
  it('no event card, trait option or book reading offers more than 1 XP at once', () => {
    for (const card of [...EVENTS, ...BOOK_CARDS]) {
      for (const xp of xpAmounts(card.steps)) expect(xp, `card ${card.id}`).toBeLessThanOrEqual(1);
    }
    for (const xp of xpAmounts(TRAIT_OPTIONS)) expect(xp).toBeLessThanOrEqual(1);
  });

  it('the engine caps an event card at 1 XP in total, and a new card starts afresh', () => {
    const state = onMap(createGame('xp', solo, [{ id: 'p1', character: hero }]));
    const p = currentPlayer(state);
    const rng = new Rng(7);
    startEvent(state, p, 2);
    const xp = p.character.xp;
    runOutcomes(state, p, rng, [{ do: 'xp', amount: 3 }, { do: 'xp', amount: 1 }], 2);
    runOutcomes(state, p, rng, [{ do: 'xp', amount: 1 }], 2);
    expect(p.character.xp).toBe(xp + 1);
    startEvent(state, p, 5);
    runOutcomes(state, p, rng, [{ do: 'xp', amount: 1 }], 5);
    expect(p.character.xp).toBe(xp + 2);
  });

  it('dungeon cards keep their own rewards', () => {
    const state = onMap(createGame('xp', solo, [{ id: 'p1', character: hero }]));
    const p = currentPlayer(state);
    const xp = p.character.xp;
    runOutcomes(state, p, new Rng(7), [{ do: 'xp', amount: 8 }], DUNGEON_CARD_BASE + 1);
    expect(p.character.xp).toBe(xp + 8);
  });
});
