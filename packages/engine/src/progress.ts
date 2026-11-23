import { levelForXp, levelUp } from './character';
import { DIFFICULTIES, dangerLevel } from './config';
import type { GameState, LogEntry, PlayerState } from './state';
import type { WorldView } from './terrain';

export function log(state: GameState, entry: LogEntry) {
  state.log.push(entry);
  state.logSeq++;
}

export function worldView(state: GameState): WorldView {
  return {
    round: state.round,
    difficulty: state.config.difficulty,
    terrainAt: (cell) => state.map.cells[cell]!.terrain,
    ringAt: (cell) => state.map.cells[cell]!.ring,
    maxRing: state.map.maxRing,
  };
}

/** Adds XP and applies every level reached on the way. */
export function gainXp(state: GameState, player: PlayerState, xp: number) {
  const c = player.character;
  c.xp += xp;
  const target = levelForXp(c.xp);
  while (c.level < target) {
    levelUp(c, c.level + 1);
    log(state, { type: 'levelUp', player: player.id, level: c.level });
  }
}

/**
 * Reveals a fragment for one player: +1 XP, more in the danger rings. Returns true if it was new.
 * Drawing the event is up to the caller, since being pushed by an event does not draw another.
 */
export function reveal(state: GameState, player: PlayerState, cell: number): boolean {
  if (player.revealed.includes(cell)) return false;
  player.revealed.push(cell);
  const settings = DIFFICULTIES[state.config.difficulty];
  const xp = settings.xp * (1 + dangerLevel(state.map.cells[cell]!.ring, state.map.maxRing, settings));
  gainXp(state, player, xp);
  log(state, { type: 'revealed', player: player.id, cell, xp });
  return true;
}

/** Death: the hero wakes at the start or at the last city's Fountain of rebirth with half Vitality. */
export function respawn(state: GameState, player: PlayerState) {
  const c = player.character;
  log(state, { type: 'died', player: player.id });
  player.position = player.respawnAt;
  player.cameFrom = null;
  player.combat = null;
  player.pendingEvent = null;
  player.conditions = [];
  player.hasStone = false;
  player.effects = player.effects.filter((e) => e.untilRound > 100_000);
  c.vitality = Math.ceil(c.maxVitality / 2);
  player.roundsWithoutFood = 0;
  player.speedLeft = 0;
  log(state, { type: 'respawned', player: player.id, cell: player.respawnAt });
}
