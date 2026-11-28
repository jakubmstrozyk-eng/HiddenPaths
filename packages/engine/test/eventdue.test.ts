import { describe, expect, it } from 'vitest';
import { QUIET_CARD } from '@hp/content';
import {
  EVENT_CHANCE, applyAction, createGame, currentPlayer, eventDueHere, landAt, legalActions, neighbours,
  type CharacterInput, type GameConfig, type GameState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter', 'scout'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

/** A game with the hero next to a hidden forest or fields fragment, and the step onto it taken. */
function onNewFragment(seed: string): { state: GameState; from: number; to: number } | null {
  let state = onMap(createGame(seed, solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(state);
  const from = p.position;
  const to = neighbours(state.map, from).find((n) => !p.revealed.includes(n) && ['forest', 'fields'].includes(landAt(state.map, n)));
  if (to === undefined) return null;
  p.speedLeft = 6;
  p.staminaLeft = 6;
  state = applyAction(state, 'p1', { type: 'move', to });
  return { state, from, to };
}

function first(): { state: GameState; from: number; to: number } {
  for (let i = 0; i < 50; i++) {
    const g = onNewFragment(`due-${i}`);
    if (g) return g;
  }
  throw new Error('no map with a hidden forest next to the start');
}

describe('a new fragment shows itself first, then draws its card (Jacob, 2026-11-28)', () => {
  it('stepping on gives the discovery XP but no card yet', () => {
    const { state, to } = first();
    const me = currentPlayer(state);
    expect(me.position).toBe(to);
    expect(me.pendingEvent).toBeNull();
    expect(eventDueHere(me)).toBe(true);
    expect(state.log.some((e) => e.type === 'revealed' && e.cell === to && e.xp > 0)).toBe(true);
    expect(state.log.some((e) => e.type === 'eventDrawn')).toBe(false);
  });

  it('the first action on the fragment runs, then the card is drawn', () => {
    const { state } = first();
    const hunt = legalActions(state, 'p1').find((a) => a.type === 'terrain');
    if (!hunt) return;
    const after = applyAction(state, 'p1', hunt);
    const me = currentPlayer(after);
    expect(after.log.some((e) => e.type === 'test' || e.type === 'check')).toBe(true);
    expect(me.pendingEvent || me.combat).toBeTruthy();
    expect(eventDueHere(me)).toBe(false);
  });

  it('trying to leave draws the card instead and the hero stays', () => {
    const { state, from, to } = first();
    const after = applyAction(state, 'p1', { type: 'move', to: from });
    const me = currentPlayer(after);
    expect(me.position).toBe(to);
    expect(me.pendingEvent).not.toBeNull();
  });

  it('ending the round without an action draws the card and keeps the turn', () => {
    const { state } = first();
    const after = applyAction(state, 'p1', { type: 'endTurn' });
    expect(currentPlayer(after).id).toBe('p1');
    expect(currentPlayer(after).pendingEvent).not.toBeNull();
    expect(after.round).toBe(state.round);
  });

  it('packing the bag (eating) does not draw the card', () => {
    const { state } = first();
    const eat = legalActions(state, 'p1').find((a) => a.type === 'eat');
    if (!eat) return;
    const after = applyAction(state, 'p1', eat);
    expect(currentPlayer(after).pendingEvent).toBeNull();
    expect(eventDueHere(currentPlayer(after))).toBe(true);
  });

  it('about 3 cards in 10 are the quiet card, which leaves nothing behind', () => {
    let quiet = 0;
    let drawn = 0;
    for (let i = 0; i < 400; i++) {
      const g = onNewFragment(`odds-${i}`);
      if (!g) continue;
      const after = applyAction(g.state, 'p1', { type: 'endTurn' });
      const card = currentPlayer(after).pendingEvent?.card;
      if (card === undefined) continue;
      drawn++;
      if (card === QUIET_CARD) {
        quiet++;
        const done = applyAction(after, 'p1', { type: 'event', option: 0 });
        expect(currentPlayer(done).pendingEvent).toBeNull();
        expect(currentPlayer(done).character.xp).toBe(currentPlayer(after).character.xp);
      }
    }
    expect(drawn).toBeGreaterThan(150);
    expect(quiet / drawn).toBeGreaterThan(1 - EVENT_CHANCE - 0.08);
    expect(quiet / drawn).toBeLessThan(1 - EVENT_CHANCE + 0.08);
  });
});
