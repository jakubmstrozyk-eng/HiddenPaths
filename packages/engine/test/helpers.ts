import { OUTSIDE, startCell, type GameState } from '../src/index';

/**
 * Puts every hero still outside onto a fragment of their homeland, as before heroes started
 * outside the map. For tests of what happens on the map, not of the first step.
 */
export function onMap<T extends GameState>(game: T): T {
  const taken: number[] = [];
  for (const p of game.players) {
    if (p.position !== OUTSIDE) continue;
    const cell = startCell(game.map, p.character.race, taken);
    taken.push(cell);
    p.position = p.start = p.respawnAt = cell;
    p.revealed = [cell];
  }
  return game;
}
