import { ENEMIES } from '@hp/content';
import { test } from './dice';
import { EngineError } from './errors';
import { log } from './progress';
import type { Rng } from './rng';
import type { GameState, PlayerState } from './state';
import type { ActorState } from './terrain';

/**
 * Skill cards from the profession sheets (level 1). Passive cards live where they act:
 * Strongman and Water-born in test modifiers, Fish and Hunter in terrain tests, Seer in reveal,
 * Veteran in a won fight, and the fight cards in combat. This file holds the cards a player plays.
 */

/** Cards with a fixed number of uses per game. */
export const CARDS_PER_GAME: Record<string, number> = { 'warrior-rations': 3, 'wraith-leaves': 3 };
/** Cards that turn sideways when used and come back at the next camp. */
export const CARDS_PER_CAMP = ['wraith-haste'];

export const has = (actor: Pick<ActorState, 'character'>, card: string) => actor.character.cards.includes(card);

/** Uses left of a card limited per game, or null for a card without such a limit. */
export function usesLeft(actor: Pick<ActorState, 'counters'>, card: string): number | null {
  const limit = CARDS_PER_GAME[card];
  return limit === undefined ? null : limit - (actor.counters[`spent:${card}`] ?? 0);
}

/** Whether a per-camp card is turned sideways (used) right now. */
export const isSpent = (actor: Pick<ActorState, 'counters'>, card: string) => !!actor.counters[`used:${card}`];

/** Camping turns every per-camp card face up again. */
export function refreshCards(actor: Pick<ActorState, 'counters'>) {
  for (const key of Object.keys(actor.counters)) if (key.startsWith('used:')) delete actor.counters[key];
}

const trapKey = (cell: number) => `trap:${cell}`;

/** Cards the player can play outside a fight right now. */
export function playableCards(state: GameState, player: PlayerState): string[] {
  const out: string[] = [];
  if (has(player, 'wraith-haste') && !isSpent(player, 'wraith-haste')) out.push('wraith-haste');
  if (has(player, 'warrior-rations') && usesLeft(player, 'warrior-rations')! > 0) out.push('warrior-rations');
  if (has(player, 'wraith-leaves') && usesLeft(player, 'wraith-leaves')! > 0 && player.staminaLeft >= 1) out.push('wraith-leaves');
  if (has(player, 'trapper-trap') && state.map.cells[player.position]!.terrain !== 'core' && !player.counters[trapKey(player.position)]) out.push('trapper-trap');
  return out;
}

/** Effects shared by the card played on the map and in a fight. */
export function eatRations(round: number, actor: ActorState) {
  actor.counters['spent:warrior-rations'] = (actor.counters['spent:warrior-rations'] ?? 0) + 1;
  actor.character.food += 1; // a ration counts as food
  actor.effects.push({ id: 'rations', attribute: 'com', amount: 5, untilRound: round });
  actor.effects.push({ id: 'rations', attribute: 'str', amount: 5, untilRound: round });
}

export function useLeaves(actor: ActorState): number {
  actor.counters['spent:wraith-leaves'] = (actor.counters['spent:wraith-leaves'] ?? 0) + 1;
  actor.conditions = [];
  actor.effects = actor.effects.filter((e) => e.amount >= 0);
  const healed = Math.min(4, actor.character.maxVitality - actor.character.vitality);
  actor.character.vitality += healed;
  return healed;
}

/** Plays a skill card on the map. */
export function playCard(state: GameState, player: PlayerState, card: string) {
  if (!playableCards(state, player).includes(card)) throw new EngineError('card.notNow', 'You cannot play that card now.');
  switch (card) {
    case 'wraith-haste':
      player.counters['used:wraith-haste'] = 1;
      player.speedLeft += 1;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: 1 });
      break;
    case 'warrior-rations':
      eatRations(state.round, player);
      log(state, { type: 'card', player: player.id, card, ok: true });
      break;
    case 'wraith-leaves': {
      player.staminaLeft -= 1;
      const healed = useLeaves(player);
      log(state, { type: 'card', player: player.id, card, ok: true, amount: healed });
      break;
    }
    case 'trapper-trap':
      player.counters[trapKey(player.position)] = 1;
      log(state, { type: 'card', player: player.id, card, ok: true });
      break;
  }
}

/** Set a Trap: when a fight breaks out on a trapped fragment, every foe tests Dexterity or loses 4 Vitality. */
export function springTrap(state: GameState, player: PlayerState, rng: Rng) {
  const key = trapKey(player.position);
  if (!player.combat || !player.counters[key]) return;
  delete player.counters[key];
  for (const foe of player.combat.foes) {
    const result = test(rng, ENEMIES[foe.enemy]!.dex);
    const damage = result.success ? 0 : 4;
    foe.vitality -= damage;
    log(state, { type: 'combat', player: player.id, event: { type: 'trap', uid: foe.uid, result, damage } });
    if (foe.vitality <= 0) log(state, { type: 'combat', player: player.id, event: { type: 'foeDown', uid: foe.uid, enemy: foe.enemy } });
  }
}
