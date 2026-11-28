import { describe, expect, it } from 'vitest';
import {
  applyAction, COVER_AFTER_ROUNDS, createGame, currentPlayer, DEPLETION_ROUNDS, depletedActions, insideMap, legalActions, neighbours,
  type CharacterInput, type GameConfig, type GameState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

function standingOn(terrain: string, attribute = 98): GameState {
  const game = onMap(createGame('tiles', solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(game);
  (game.map.cells[p.position] as { terrain: string }).terrain = terrain;
  for (const k of Object.keys(p.character.attributes)) (p.character.attributes as Record<string, number>)[k] = attribute;
  p.character.food = 50;
  return game;
}

const terrainActs = (game: GameState) => legalActions(game, 'p1').flatMap((a) => (a.type === 'terrain' ? [a.action] : []));
const pass = (game: GameState) => applyAction(applyAction(game, 'p1', { type: 'eat' }), 'p1', { type: 'endTurn' });

describe('used-up resources', () => {
  it('a successful hunt empties the fragment of animals for 3 rounds', () => {
    let game = standingOn('forest');
    const cell = currentPlayer(game).position;
    game = applyAction(game, 'p1', { type: 'terrain', action: 'hunt' });
    expect(game.log.some((e) => e.type === 'depleted' && e.action === 'hunt' && e.until === 1 + DEPLETION_ROUNDS)).toBe(true);
    // Not again this round, nor in the next two; gathering is a different resource and stays.
    expect(terrainActs(game)).not.toContain('hunt');
    expect(terrainActs(game)).toContain('gather');
    expect(depletedActions(game, cell)).toEqual([{ action: 'hunt', until: 4 }]);
    game = pass(game);
    expect(game.round).toBe(2);
    expect(terrainActs(game)).not.toContain('hunt');
    game = pass(game);
    expect(terrainActs(game)).not.toContain('hunt');
    game = pass(game);
    expect(game.round).toBe(4);
    expect(terrainActs(game)).toContain('hunt');
    expect(depletedActions(game, cell)).toEqual([]);
  });

  it('a failed attempt leaves the resource where it is', () => {
    let game = standingOn('forest', 1);
    const p = currentPlayer(game);
    p.character.skills = {};
    game = applyAction(game, 'p1', { type: 'terrain', action: 'gather' });
    const test = game.log.find((e) => e.type === 'test')!;
    expect(test.type === 'test' && test.result.success).toBe(false);
    expect(terrainActs(game)).toContain('gather');
  });
});

describe('dark matter returns', () => {
  /** A fragment the hero has seen, away from where they stand. */
  function seenAway(game: GameState, terrain: string): number {
    const p = currentPlayer(game);
    const near = new Set([p.position, ...neighbours(game.map, p.position)]);
    const cell = game.map.cells.find((c) => insideMap(c) && c.terrain !== 'core' && !near.has(c.index))!;
    (cell as { terrain: string }).terrain = terrain;
    p.revealed.push(cell.index);
    return cell.index;
  }

  it(`covers a fragment nobody stood on for ${COVER_AFTER_ROUNDS} rounds, with new terrain beneath`, () => {
    let game = standingOn('forest');
    const away = seenAway(game, 'fields');
    game.lastVisit = { [away]: 1 };
    game.depleted = { [`${away}:hunt`]: 3 };
    for (let r = 1; r <= COVER_AFTER_ROUNDS; r++) {
      game = pass(game);
      expect(currentPlayer(game).revealed).toContain(away);
    }
    // Rounds 2-6 passed without anyone there: at the start of round 7 it goes dark.
    game = pass(game);
    expect(game.round).toBe(2 + COVER_AFTER_ROUNDS);
    expect(currentPlayer(game).revealed).not.toContain(away);
    expect(game.log.some((e) => e.type === 'covered' && e.cells.includes(away))).toBe(true);
    expect(Object.keys(game.depleted ?? {}).some((k) => k.startsWith(`${away}:`))).toBe(false);
    expect(['forest', 'mountains', 'fields', 'river', 'lake', 'desert', 'cave']).toContain(game.map.cells[away]!.terrain);
    // The fragment the hero stands on stays in sight.
    expect(currentPlayer(game).revealed).toContain(currentPlayer(game).position);
  });

  it('keeps the centre, towns, inns and monuments, and the fragment a hero stands on', () => {
    let game = standingOn('forest');
    const city = seenAway(game, 'city');
    const here = currentPlayer(game).position;
    game.lastVisit = { [city]: 1, [here]: 1 };
    for (let r = 0; r <= COVER_AFTER_ROUNDS + 1; r++) game = pass(game);
    expect(currentPlayer(game).revealed).toEqual(expect.arrayContaining([city, here]));
    expect(game.map.cells[city]!.terrain).toBe('city');
  });

  it('a hero walking back in keeps the fragment uncovered', () => {
    let game = standingOn('forest');
    const p = currentPlayer(game);
    const start = p.position;
    const next = neighbours(game.map, start).find((n) => game.map.cells[n]!.terrain !== 'core' && insideMap(game.map.cells[n]!))!;
    (game.map.cells[next] as { terrain: string }).terrain = 'village';
    p.character.speed = 9;
    game = applyAction(game, 'p1', { type: 'move', to: next });
    for (let r = 0; r < 4; r++) game = pass(game);
    game = applyAction(game, 'p1', { type: 'move', to: start });
    game = applyAction(game, 'p1', { type: 'move', to: next });
    for (let r = 0; r < 4; r++) game = pass(game);
    expect(currentPlayer(game).revealed).toContain(start);
  });
});
