import { ENEMIES, type Attribute } from '@hp/content';
import { test } from './dice';
import { EngineError } from './errors';
import { log, worldView } from './progress';
import type { Rng } from './rng';
import type { GameState, Meal, PlayerState } from './state';
import { heroTest, type ActorState } from './terrain';
import { BOND_NEEDED, type CombatEvent, type Foe } from './combat';

/**
 * Skill cards from the profession sheets (level 1). Passive cards live where they act:
 * Strongman and Water-born in test modifiers, Fish and Hunter in terrain tests, Seer in reveal,
 * Veteran in a won fight, and the fight cards in combat. This file holds the cards a player plays.
 */

/** Cards with a fixed number of uses per game. */
export const CARDS_PER_GAME: Record<string, number> = { 'warrior-rations': 3, 'wraith-leaves': 3 };
/** Cards that turn sideways when used and come back at the next camp. */
export const CARDS_PER_CAMP = ['wraith-haste', 'elder-wisdom', 'elder-herb', 'runemaster-empower'];

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
  for (const card of ['elder-herb', 'runemaster-empower']) if (has(player, card) && !isSpent(player, card)) out.push(card);
  if (has(player, 'explorer-bandages') && player.staminaLeft >= BANDAGE_STAMINA) out.push('explorer-bandages');
  if (has(player, 'gourmet-stew') && canStew(state, player)) out.push('gourmet-stew');
  return out;
}

/** Bandages cost 1 Stamina on the map; in a fight they take the hero's move instead. */
export const BANDAGE_STAMINA = 1;
/** Healing Stew: the most stews a Gourmet keeps ready. */
export const MAX_STEWS = 3;

const meals = (player: Pick<PlayerState, 'meals'>) => player.meals ?? [];
/** Food portions not prepared yet. */
export const plainFood = (player: Pick<PlayerState, 'meals' | 'character'>) => player.character.food - meals(player).length;
const roundKey = (state: GameState, what: string) => `${what}@${state.round}`;

function canStew(state: GameState, player: PlayerState): boolean {
  return plainFood(player) > 0 && meals(player).filter((m) => m.kind === 'stew').length < MAX_STEWS && !player.counters[roundKey(state, 'stew')];
}

/** Myrmids prepare food (race rule): a Dexterity test and 1 Stamina; the portion eaten gives +2 to all attributes for a round. */
export const COOK_STAMINA = 1;
export function canCook(player: PlayerState): boolean {
  return player.character.race === 'myrmids' && player.staminaLeft >= COOK_STAMINA && plainFood(player) > 0;
}
/** Seasoning: the Gourmet may season one portion a round with an attribute of their choice. */
export function canSeason(state: GameState, player: PlayerState): boolean {
  return has(player, 'gourmet-seasoning') && !player.counters[roundKey(state, 'spiced')];
}

/** Prepares one portion of food (Myrmid race rule), seasoned if the Gourmet asks for it. */
export function cook(state: GameState, player: PlayerState, rng: Rng, spice?: Attribute) {
  if (!canCook(player)) throw new EngineError('cook.notNow', 'You cannot prepare food now.');
  if (spice && !canSeason(state, player)) throw new EngineError('card.notNow', 'You cannot season food now.');
  player.staminaLeft -= COOK_STAMINA;
  const result = heroTest(worldView(state), player, 'dex', rng);
  log(state, { type: 'check', player: player.id, attribute: 'dex', result });
  if (!result.success) return;
  const meal: Meal = { kind: 'prepared', ...(spice ? { spice } : {}) };
  (player.meals ??= []).push(meal);
  if (spice) player.counters[roundKey(state, 'spiced')] = 1;
  log(state, { type: 'cooked', player: player.id, meal });
}

/** Elder's Healing Herb: stops bleeding, cures poison, +2 Vitality; renews at camp. */
export function healingHerb(actor: ActorState): number {
  actor.counters['used:elder-herb'] = 1;
  actor.conditions = actor.conditions.filter((c) => !['poison', 'rot', 'bleed', 'bleeding'].includes(c.id));
  return heal(actor, 2);
}

/** Explorer's Bandages: +2 Vitality and bleeding stopped. */
export function bandage(actor: ActorState): number {
  actor.conditions = actor.conditions.filter((c) => c.id !== 'bleed' && c.id !== 'bleeding');
  return heal(actor, 2);
}

/** Runemaster's Empowered Weapon: +2 damage on every hit for 3 rounds; renews at camp. */
export function empower(round: number, actor: ActorState) {
  actor.counters['used:runemaster-empower'] = 1;
  actor.effects.push({ id: 'empower', attribute: 'damage', amount: 2, untilRound: round + 2 });
}

function heal(actor: ActorState, n: number): number {
  const healed = Math.max(0, Math.min(n, actor.character.maxVitality - actor.character.vitality));
  actor.character.vitality += healed;
  return healed;
}

/**
 * Eats the round's meal: a stew when hurt, otherwise a prepared (or seasoned) portion before plain food.
 * Its effect lasts through the hero's next round.
 */
export function eatMeal(state: GameState, player: PlayerState, portions: number) {
  const list = meals(player);
  if (!list.length) return;
  const hurt = player.character.vitality < player.character.maxVitality;
  const find = (f: (m: Meal) => boolean) => list.findIndex(f);
  let pick = hurt ? find((m) => m.kind === 'stew') : -1;
  if (pick < 0) pick = find((m) => m.kind === 'prepared' && !!m.spice);
  if (pick < 0) pick = find((m) => m.kind === 'prepared');
  // A stew is kept for when the hero is hurt, unless there is no plain food left to eat instead.
  if (pick < 0 && plainFood(player) < portions) pick = 0;
  if (pick < 0) return;
  const [meal] = list.splice(pick, 1);
  const until = state.round + 1;
  if (meal!.kind === 'stew') {
    log(state, { type: 'card', player: player.id, card: 'gourmet-stew', ok: true, amount: heal(player, 2) });
  } else {
    player.effects.push({ id: 'meal', attribute: 'all', amount: 2, untilRound: until });
    if (meal!.spice) {
      player.effects.push({ id: 'spice', attribute: meal!.spice, amount: 5, untilRound: until });
      log(state, { type: 'card', player: player.id, card: 'gourmet-seasoning', ok: true, amount: 5 });
    }
  }
  log(state, { type: 'mealEaten', player: player.id, meal: meal! });
}

/** Prepared portions can never outnumber the food carried (food lost to events or sold takes them along). */
export function trimMeals(player: PlayerState) {
  if (player.meals && player.meals.length > player.character.food) player.meals.splice(0, player.meals.length - Math.max(0, player.character.food));
}

/**
 * Companion: at the start of each of the hero's turns every beast not yet bound for good is tested again
 * on Charisma; the 3rd pass binds it, a failure sets it free (it walks off and does not attack).
 */
export function bondCompanions(state: GameState, player: PlayerState, rng: Rng) {
  if (!player.companions?.length) return;
  for (const pet of [...player.companions]) {
    if (pet.tame) continue;
    const result = heroTest(worldView(state), player, 'cha', rng);
    log(state, { type: 'check', player: player.id, attribute: 'cha', result });
    if (result.success) {
      pet.bond++;
      if (pet.bond >= BOND_NEEDED) pet.tame = true;
    } else {
      player.companions = player.companions.filter((p) => p !== pet);
    }
    log(state, { type: 'companion', player: player.id, uid: pet.uid, enemy: pet.enemy, bond: pet.bond, tame: pet.tame, left: !result.success });
  }
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
export function playCard(state: GameState, player: PlayerState, card: string, rng: Rng) {
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
    case 'elder-herb':
      log(state, { type: 'card', player: player.id, card, ok: true, amount: healingHerb(player) });
      break;
    case 'explorer-bandages':
      player.staminaLeft -= BANDAGE_STAMINA;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: bandage(player) });
      break;
    case 'runemaster-empower':
      empower(state.round, player);
      log(state, { type: 'card', player: player.id, card, ok: true, amount: 2 });
      break;
    case 'gourmet-stew': {
      // Healing Stew: an Intelligence test turns a portion into a stew; one try a round.
      player.counters[roundKey(state, 'stew')] = 1;
      const result = heroTest(worldView(state), player, 'int', rng);
      log(state, { type: 'check', player: player.id, attribute: 'int', result });
      if (result.success) {
        const meal: Meal = { kind: 'stew' };
        (player.meals ??= []).push(meal);
        log(state, { type: 'cooked', player: player.id, meal });
      }
      break;
    }
  }
}

/**
 * Set a Trap: every foe caught tests Dexterity; on a failure it loses 4 Vitality and is held
 * fast for a round, so it skips its next attack (Jacob, 2026-11-24).
 */
export function trapFoes(foes: Foe[], rng: Rng): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const foe of foes) {
    if (foe.vitality <= 0) continue;
    const result = test(rng, ENEMIES[foe.enemy]!.dex);
    const damage = result.success ? 0 : 4;
    foe.vitality -= damage;
    if (!result.success) foe.stunned = true;
    events.push({ type: 'trap', uid: foe.uid, result, damage });
    if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
  }
  return events;
}

/** A trap set on the map springs when a fight breaks out on its fragment. */
export function springTrap(state: GameState, player: PlayerState, rng: Rng) {
  const key = trapKey(player.position);
  if (!player.combat || !player.counters[key]) return;
  delete player.counters[key];
  for (const event of trapFoes(player.combat.foes, rng)) log(state, { type: 'combat', player: player.id, event });
}
