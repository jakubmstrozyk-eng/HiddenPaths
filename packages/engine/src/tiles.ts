import { TERRAINS, TERRAIN_IDS, type TerrainAction, type TerrainId } from '@hp/content';
import { insideMap } from './mapgen';
import type { Rng } from './rng';
import type { GameState } from './state';

/**
 * Jacob's rules (2026-11-26): a successful hunt, gathering, herb picking or mining empties that
 * resource on the fragment for 3 rounds, for every hero. A fragment is covered by dark matter again
 * 5 rounds after it was discovered, and a new random fragment lies hidden beneath it (Jacob, 2026-11-28:
 * the count starts at discovery and walking over the fragment again does not restart it).
 */
export const DEPLETION_ROUNDS = 3;
export const COVER_AFTER_ROUNDS = 5;

/** Terrain actions that use up the fragment's resource when they succeed. */
export const DEPLETING_ACTIONS: TerrainAction[] = ['hunt', 'gather', 'herbalism', 'mine'];

const key = (cell: number, action: TerrainAction) => `${cell}:${action}`;

/** The round from which the resource for `action` is back on `cell`, or null when it is there now. */
export function depletedUntil(state: Pick<GameState, 'round' | 'depleted'>, cell: number, action: TerrainAction): number | null {
  const until = state.depleted?.[key(cell, action)];
  return until !== undefined && until > state.round ? until : null;
}

/** The resources used up on a fragment right now, with the round each comes back. */
export function depletedActions(state: Pick<GameState, 'round' | 'depleted'>, cell: number): { action: TerrainAction; until: number }[] {
  return DEPLETING_ACTIONS.flatMap((action) => {
    const until = depletedUntil(state, cell, action);
    return until === null ? [] : [{ action, until }];
  });
}

/** A successful action empties the resource: it is back after DEPLETION_ROUNDS rounds. Returns that round. */
export function deplete(state: GameState, cell: number, action: TerrainAction): number {
  const until = state.round + DEPLETION_ROUNDS;
  (state.depleted ??= {})[key(cell, action)] = until;
  return until;
}

/** A fragment is discovered (stepped on or seen from afar) this round: its 5 rounds start now. */
export function markVisit(state: GameState, cell: number) {
  if (cell < 0) return;
  (state.lastVisit ??= {})[cell] ??= state.round;
}

/** Fragments that never change under the dark matter: the centre, towns, inns and monuments. */
export function coverable(terrain: string): terrain is TerrainId {
  return terrain !== 'core' && terrain !== 'void' && TERRAINS[terrain as TerrainId].drawsEvent;
}

/** Natural terrain for a fragment that is hidden again, weighted by how common it is on this map. */
function newTerrain(state: GameState, rng: Rng): TerrainId {
  const natural = TERRAIN_IDS.filter((id) => TERRAINS[id].drawsEvent);
  const counts = natural.map((id) => 1 + state.map.cells.filter((c) => c.terrain === id).length);
  return natural[rng.weighted(counts)]!;
}

/**
 * At the start of a round: every fragment discovered COVER_AFTER_ROUNDS rounds ago goes dark for
 * everyone and gets a new random terrain. A fragment a hero stands on waits until they leave it.
 * Returns the fragments covered.
 */
export function coverForgotten(state: GameState, rng: Rng): number[] {
  const seen = (state.lastVisit ??= {});
  // Games saved before the count existed (or fragments seen without it): the count starts now.
  for (const p of state.players) for (const cell of p.revealed) seen[cell] ??= state.round;
  const occupied = new Set(state.players.map((p) => p.position));
  const covered: number[] = [];
  for (const [cellKey, round] of Object.entries(seen)) {
    const cell = Number(cellKey);
    if (occupied.has(cell) || state.round - round < COVER_AFTER_ROUNDS) continue;
    const c = state.map.cells[cell];
    delete seen[cell];
    // Towns, inns, monuments, the centre and the dungeon's entrance stay where they are.
    if (!c || !insideMap(c) || !coverable(c.terrain) || state.dungeon?.cell === cell) continue;
    c.terrain = newTerrain(state, rng);
    for (const p of state.players) {
      p.revealed = p.revealed.filter((x) => x !== cell);
      delete p.counters[`peeked:${cell}`];
    }
    for (const k of Object.keys(state.depleted ?? {})) if (k.startsWith(`${cell}:`)) delete state.depleted![k];
    covered.push(cell);
  }
  return covered;
}
