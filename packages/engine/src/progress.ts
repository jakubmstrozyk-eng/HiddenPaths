import { levelForXp, levelUp } from './character';
import { DIFFICULTIES, dangerLevel } from './config';
import { landAt, neighbours } from './mapgen';
import { trackMissions } from './missions';
import type { Rng } from './rng';
import type { GameState, LogEntry, PlayerState } from './state';
import type { WorldView } from './terrain';

export function log(state: GameState, entry: LogEntry) {
  state.log.push(entry);
  state.logSeq++;
  trackMissions(state, entry);
}

export function worldView(state: GameState): WorldView {
  return {
    round: state.round,
    difficulty: state.config.difficulty,
    terrainAt: (cell) => landAt(state.map, cell),
    ringAt: (cell) => state.map.cells[cell]!.ring,
    maxRing: state.map.maxRing,
    near: (cell) => neighbours(state.map, cell),
  };
}

/** Adds XP and applies every level reached on the way. */
export function gainXp(state: GameState, player: PlayerState, xp: number) {
  const c = player.character;
  c.xp += xp;
  const target = levelForXp(c.xp);
  while (c.level < target) {
    const cards = levelUp(c, c.level + 1);
    log(state, { type: 'levelUp', player: player.id, level: c.level, ...(cards.length ? { cards } : {}) });
  }
}

/**
 * Reveals a fragment for one player: +1 XP, more in the danger rings. Returns true if it was new.
 * Drawing the event is up to the caller, since being pushed by an event does not draw another.
 */
export function reveal(state: GameState, player: PlayerState, cell: number, rng?: Rng, opts: { peek?: boolean } = {}): boolean {
  const settings = DIFFICULTIES[state.config.difficulty];
  const xp = settings.xp * (1 + dangerLevel(state.map.cells[cell]!.ring, state.map.maxRing, settings));
  // A fragment only seen from afar (Lookout) gives its XP when the hero first steps on it (Jacob, 2026-11-26).
  const peeked = `peeked:${cell}`;
  if (player.revealed.includes(cell)) {
    if (!opts.peek && player.counters[peeked]) {
      delete player.counters[peeked];
      gainXp(state, player, xp);
      log(state, { type: 'revealed', player: player.id, cell, xp });
    }
    return false;
  }
  player.revealed.push(cell);
  if (opts.peek) {
    player.counters[peeked] = 1;
    log(state, { type: 'revealed', player: player.id, cell, xp: 0 });
    return true;
  }
  gainXp(state, player, xp);
  log(state, { type: 'revealed', player: player.id, cell, xp });
  // Seer: a 1 on a d6 when a new fragment opens foresees what comes, +10 to all base attributes for the round.
  if (rng && player.character.cards.includes('mystic-seer')) {
    const die = rng.die(6);
    if (die === 1) player.effects.push({ id: 'seer', attribute: 'all', amount: 10, untilRound: state.round });
    log(state, { type: 'card', player: player.id, card: 'mystic-seer', ok: die === 1, roll: die });
  }
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
