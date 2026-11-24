import { describe, expect, it } from 'vitest';
import {
  applyAction, createGame, currentPlayer, fatiguePenalty, legalActions, neighbours, testModifier, worldView,
  type CharacterInput, type GameConfig, type GameState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter', 'scout'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

/** A game with the hero standing on a chosen terrain, with sure-fire attributes. */
function standingOn(terrain: string, seed = 'terrain'): GameState {
  const game = onMap(createGame(seed, solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(game);
  (game.map.cells[p.position] as { terrain: string }).terrain = terrain;
  for (const k of Object.keys(p.character.attributes)) (p.character.attributes as Record<string, number>)[k] = 98;
  return game;
}

describe('terrain actions', () => {
  it('hunting in a forest costs 1 Stamina and gives 2 food on success', () => {
    const game = standingOn('forest');
    const before = currentPlayer(game);
    const after = currentPlayer(applyAction(game, 'p1', { type: 'terrain', action: 'hunt' }));
    expect(after.staminaLeft).toBe(before.staminaLeft - 1);
    expect(after.character.food).toBe(before.character.food + 2);
    expect(after.counters.hunts).toBe(1);
    expect(after.actionsSinceCamp).toBe(1);
  });

  it('mining in the mountains finds ores', () => {
    const after = currentPlayer(applyAction(standingOn('mountains'), 'p1', { type: 'terrain', action: 'mine' }));
    const ores = Object.values(after.inventory.materials).reduce((a, b) => a + (b ?? 0), 0);
    expect(ores).toBeGreaterThanOrEqual(2);
  });

  it('only offers actions the fragment has and the hero can pay for', () => {
    let game = standingOn('lake');
    const kinds = () => legalActions(game, 'p1').flatMap((a) => (a.type === 'terrain' ? [a.action] : []));
    expect(kinds().sort()).toEqual(['herbalism', 'hunt']);
    currentPlayer(game).staminaLeft = 0;
    expect(kinds()).toEqual([]);
    game = standingOn('inn');
    expect(kinds()).toEqual([]);
  });

  it('a river blocks onward travel until the hero swims across', () => {
    const game = standingOn('river');
    const p = currentPlayer(game);
    const [back, onward] = neighbours(game.map, p.position);
    p.cameFrom = back!;
    for (const n of neighbours(game.map, p.position)) (game.map.cells[n] as { terrain: string }).terrain = 'fields';
    const moves = () => legalActions(g, 'p1').flatMap((a) => (a.type === 'move' ? [a.to] : []));
    let g = game;
    expect(moves()).toEqual([back]);
    g = applyAction(g, 'p1', { type: 'terrain', action: 'swim' });
    expect(currentPlayer(g).crossedRiver).toBe(true);
    // Swimming costs 2 Stamina; Speed is untouched, so the hero can now go on.
    expect(moves()).toContain(onward);
  });

  it('meditating at a monument gives +20 to one attribute for 3 rounds, once per monument', () => {
    let game = standingOn('monument');
    game = applyAction(game, 'p1', { type: 'terrain', action: 'meditate' });
    const p = currentPlayer(game);
    expect(p.effects).toHaveLength(1);
    expect(p.effects[0]!.amount).toBe(20);
    expect(p.effects[0]!.untilRound).toBe(3);
    expect(legalActions(game, 'p1').some((a) => a.type === 'terrain')).toBe(false);
    for (let i = 0; i < 3; i++) game = applyAction(game, 'p1', { type: 'endTurn' });
    expect(currentPlayer(game).effects).toHaveLength(0);
  });

  it('staying in the desert costs 2 food', () => {
    const game = standingOn('desert');
    const food = currentPlayer(game).character.food;
    expect(currentPlayer(applyAction(game, 'p1', { type: 'endTurn' })).character.food).toBe(food - 2);
  });

  it('fatigue lowers every test after 6 and 12 actions without camping', () => {
    expect(fatiguePenalty(5)).toBe(0);
    expect(fatiguePenalty(6)).toBe(-10);
    expect(fatiguePenalty(12)).toBe(-20);
    const game = standingOn('forest');
    const p = currentPlayer(game);
    p.actionsSinceCamp = 6;
    expect(testModifier(worldView(game), p, 'dex')).toBe(-10);
  });
});
