import { landAt } from './mapgen';
import { ENEMIES, ITEMS, TERRAINS, type ArmourSlot, type Attribute } from '@hp/content';
import { test } from './dice';
import { EngineError } from './errors';
import { log, reveal, worldView } from './progress';
import type { Rng } from './rng';
import type { GameState, Meal, PlayerState } from './state';
import { heroTest, NATURE_BONUS, type ActorState } from './terrain';
import { BOND_NEEDED, type CombatEvent, type Foe } from './combat';

/**
 * Skill cards from the profession sheets (level 1). Passive cards live where they act:
 * Strongman and Water-born in test modifiers, Fish and Hunter in terrain tests, Seer in reveal,
 * Veteran in a won fight, and the fight cards in combat. This file holds the cards a player plays.
 */

/** Cards with a fixed number of uses per game. */
export const CARDS_PER_GAME: Record<string, number> = { 'warrior-rations': 3, 'wraith-leaves': 3 };
/** Cards that turn sideways when used and come back at the next camp. */
export const CARDS_PER_CAMP = ['wraith-haste', 'elder-nature', 'elder-herb', 'runemaster-empower', 'mystic-levitate', 'wraith-mist'];
/** Cards used only while camping (Jacob, 2026-11-26), with their Stamina on top of the camp's. */
export const CAMP_CARDS: Record<string, number> = { 'warrior-way': 1, 'druid-teacher': 2 };
/** Cards that cost Stamina when played on the map (Jacob, 2026-11-25); in a fight they take the hero's round instead. */
export const MAP_STAMINA: Record<string, number> = {
  'elder-nature': 1, 'elder-herb': 1, 'runemaster-empower': 1, 'explorer-bandages': 1,
  // Level 3 cards, from their sheets.
  'trapper-tannery': 1, 'elder-power-potion': 1, 'mystic-levitate': 1, 'wraith-lookout': 1, 'runemaster-safety-rune': 2,
};

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

/**
 * Cards the hero may also play in the middle of an event, before answering it (Jacob, 2026-11-27: cards such as
 * Empowered Weapon are an ordinary action outside a fight too). Only quick ones that act on the hero: a buff for the
 * coming test or fight, or first aid. Crafting, scouting, traps and the like wait until the event is over.
 */
export const EVENT_CARDS = ['elder-nature', 'warrior-rations', 'runemaster-empower', 'elder-herb', 'explorer-bandages', 'wraith-leaves'];

/** Cards the player can play outside a fight right now: on the map, or during an event (only EVENT_CARDS). */
export function playableCards(state: GameState, player: PlayerState): string[] {
  if (player.combat || player.pendingEvent?.puzzle) return [];
  const all = mapCards(state, player);
  return player.pendingEvent ? all.filter((card) => EVENT_CARDS.includes(card)) : all;
}

function mapCards(state: GameState, player: PlayerState): string[] {
  const out: string[] = [];
  if (has(player, 'wraith-haste') && !isSpent(player, 'wraith-haste')) out.push('wraith-haste');
  if (has(player, 'warrior-rations') && usesLeft(player, 'warrior-rations')! > 0) out.push('warrior-rations');
  if (has(player, 'wraith-leaves') && usesLeft(player, 'wraith-leaves')! > 0 && player.staminaLeft >= 1) out.push('wraith-leaves');
  if (has(player, 'trapper-trap') && landAt(state.map, player.position) !== 'core' && !player.counters[trapKey(player.position)]) out.push('trapper-trap');
  for (const card of ['elder-nature', 'elder-herb', 'runemaster-empower']) {
    if (has(player, card) && !isSpent(player, card) && player.staminaLeft >= MAP_STAMINA[card]!) out.push(card);
  }
  if (has(player, 'explorer-bandages') && player.staminaLeft >= BANDAGE_STAMINA) out.push('explorer-bandages');
  if (has(player, 'gourmet-stew') && canStew(state, player)) out.push('gourmet-stew');
  // Level 3 cards.
  const affords = (card: string) => has(player, card) && player.staminaLeft >= MAP_STAMINA[card]!;
  const terrain = landAt(state.map, player.position);
  if (affords('trapper-tannery') && tannerySlots(player).length) out.push('trapper-tannery');
  if (affords('elder-power-potion') && canGatherHere(terrain) && !player.counters[`ingredient:${player.position}`]) out.push('elder-power-potion');
  if (affords('mystic-levitate') && !isSpent(player, 'mystic-levitate')) out.push('mystic-levitate');
  if (affords('wraith-lookout') && terrain === 'forest' && state.map.cells.some((cell) => cell.terrain !== 'void' && isNear(state, player, cell.index) && !player.revealed.includes(cell.index))) {
    out.push('wraith-lookout');
  }
  if (affords('runemaster-safety-rune') && player.character.equipment.rune !== 'safety') out.push('runemaster-safety-rune');
  return out;
}

const canGatherHere = (terrain: string) => terrain !== 'core' && TERRAINS[terrain as keyof typeof TERRAINS].actions.some((a) => a === 'gather' || a === 'herbalism');
const isNear = (state: GameState, player: PlayerState, cell: number) => worldView(state).near(player.position).includes(cell);

/** Potion of Might: the ingredients to find, one a fragment, before the Elder brews it. */
export const POTION_INGREDIENTS = 3;

/** Levitation: the Mystic floats for the rest of the round (hard terrain costs 1 Speed, rivers are no bar). */
export const levitating = (state: Pick<GameState, 'round'>, player: Pick<PlayerState, 'counters'>) => !!player.counters[`levitate@${state.round}`];

/**
 * Tannery: hides for each leather piece. The player picks the part of the body (Jacob, 2026-11-26): the torso
 * takes 2 hides, the head 1, and the arms and legs one hide for each arm or leg, so 2 for the pair the game keeps as one piece.
 */
export const TANNERY_HIDES: Record<ArmourSlot, number> = { head: 1, arms: 2, torso: 2, legs: 2 };
export const tannerySlots = (player: Pick<PlayerState, 'counters'>): ArmourSlot[] =>
  (Object.keys(TANNERY_HIDES) as ArmourSlot[]).filter((slot) => (player.counters.hides ?? 0) >= TANNERY_HIDES[slot]);

/** Way of the Warrior or Teacher, used while camping: the training or the lesson. */
export function campCard(state: GameState, player: PlayerState, card: string, rng: Rng, target?: string) {
  switch (card) {
    case 'warrior-way':
      player.character.attributes.com += 1;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: 1 });
      break;
    case 'druid-teacher': {
      const result = heroTest(worldView(state), player, 'wil', rng);
      log(state, { type: 'check', player: player.id, attribute: 'wil', result });
      const pet = (player.companions ?? []).find((p) => p.uid === target) ?? player.companions![0]!;
      if (result.success) pet.bonus = (pet.bonus ?? 0) + 1;
      log(state, { type: 'card', player: player.id, card, ok: result.success, amount: pet.bonus ?? 0 });
      break;
    }
  }
}

/** Whether a camp card can be used at this camp. */
export const canCampCard = (player: PlayerState, card: string) =>
  has(player, card) && (card !== 'druid-teacher' || !!(player.companions ?? []).length);

/** Bandages cost 1 Stamina on the map; in a fight they take the hero's move instead. */
export const BANDAGE_STAMINA = MAP_STAMINA['explorer-bandages']!;
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
export function playCard(state: GameState, player: PlayerState, card: string, rng: Rng, target?: string) {
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
    case 'elder-nature':
      // Close to Nature: renewed at camp; played for 1 Stamina, +10 to the next attribute test.
      player.staminaLeft -= MAP_STAMINA[card]!;
      player.counters['used:elder-nature'] = 1;
      player.counters.nature = 1;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: NATURE_BONUS });
      break;
    case 'elder-herb':
      player.staminaLeft -= MAP_STAMINA[card]!;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: healingHerb(player) });
      break;
    case 'explorer-bandages':
      player.staminaLeft -= BANDAGE_STAMINA;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: bandage(player) });
      break;
    case 'runemaster-empower':
      player.staminaLeft -= MAP_STAMINA[card]!;
      empower(state.round, player);
      log(state, { type: 'card', player: player.id, card, ok: true, amount: 2 });
      break;
    case 'trapper-tannery': {
      // Tannery: 1 Stamina and an Intelligence test turn hides into a leather piece for the part of the body picked.
      const slot = (target ?? tannerySlots(player)[0]) as ArmourSlot;
      if (!tannerySlots(player).includes(slot)) throw new EngineError('card.notNow', 'Not enough hides for that piece.');
      player.staminaLeft -= MAP_STAMINA[card]!;
      const result = heroTest(worldView(state), player, 'int', rng);
      log(state, { type: 'check', player: player.id, attribute: 'int', result });
      if (result.success) {
        player.counters.hides = (player.counters.hides ?? 0) - TANNERY_HIDES[slot];
        const item = `leather-${slot}`;
        player.inventory.items.push(item);
        log(state, { type: 'crafted', player: player.id, card, item });
      }
      break;
    }
    case 'elder-power-potion': {
      // Potion of Might: an easy Intelligence test (+10) finds one ingredient here; the third makes the potion.
      player.staminaLeft -= MAP_STAMINA[card]!;
      const result = heroTest(worldView(state), player, 'int', rng, 10);
      log(state, { type: 'check', player: player.id, attribute: 'int', result });
      if (!result.success) break;
      player.counters[`ingredient:${player.position}`] = 1;
      const found = (player.counters.ingredients ?? 0) + 1;
      if (found < POTION_INGREDIENTS) {
        player.counters.ingredients = found;
        log(state, { type: 'card', player: player.id, card, ok: true, amount: found });
        break;
      }
      player.counters.ingredients = 0;
      player.inventory.items.push('elderPotion');
      log(state, { type: 'crafted', player: player.id, card, item: 'elderPotion' });
      break;
    }
    case 'mystic-levitate': {
      // Levitation: 1 Stamina for the meditation; a passed Intelligence test lifts the Mystic until the round ends.
      player.staminaLeft -= MAP_STAMINA[card]!;
      const result = heroTest(worldView(state), player, 'int', rng);
      log(state, { type: 'check', player: player.id, attribute: 'int', result });
      // Even a failed meditation turns the card until the next camp (Jacob, 2026-11-26).
      player.counters['used:mystic-levitate'] = 1;
      if (result.success) {
        player.counters[`levitate@${state.round}`] = 1;
        player.crossedRiver = true;
      }
      log(state, { type: 'card', player: player.id, card, ok: result.success });
      break;
    }
    case 'wraith-lookout': {
      // Lookout: from a treetop every fragment around is revealed, with no events and no XP: the XP comes on first entering it.
      player.staminaLeft -= MAP_STAMINA[card]!;
      player.counters[`lookout:${player.position}`] = 1;
      let seen = 0;
      for (const cell of worldView(state).near(player.position)) if (reveal(state, player, cell, undefined, { peek: true })) seen++;
      log(state, { type: 'card', player: player.id, card, ok: true, amount: seen });
      break;
    }
    case 'runemaster-safety-rune':
      // Rune of Safety: +20 initiative while the weapon carries it; a weapon holds one rune.
      player.staminaLeft -= MAP_STAMINA[card]!;
      player.character.equipment.rune = 'safety';
      log(state, { type: 'card', player: player.id, card, ok: true, amount: 20 });
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
