import { ENEMIES, TERRAINS, type Attribute, type EffectTarget } from '@hp/content';
import { has, isSpent, MAP_STAMINA } from './cards';
import { EngineError } from './errors';
import { drawEvent, startEvent } from './events';
import { landAt } from './mapgen';
import { log, reveal, worldView } from './progress';
import type { Rng } from './rng';
import type { GameState, PlayerState } from './state';
import { heroTest, isWater, type ActorState } from './terrain';

/**
 * The level 5, 7 and 9 skill cards played outside a fight, and the buffs shared by the map and the fight.
 * Fight moves live in combat.ts; passive cards where they act (camp, prices, meals, hunting, moving).
 */

/** Buffs from cards: what they add and for how many rounds (counted from the round they are played in). */
type Buff = { id: string; rounds: number; add: [EffectTarget, number][]; heal?: number; pets?: boolean };
const BUFFS: Record<string, Buff> = {
  'elder-beast-form': { id: 'beastForm', rounds: 2, add: [['dex', 15], ['str', 15], ['com', 10], ['speed', 1], ['stamina', 1], ['cha', -10], ['wil', -10], ['int', -10]] },
  'druid-shapeshift': { id: 'wolfForm', rounds: 2, add: [['str', 20], ['dex', 20]], heal: 6 },
  'guardian-sign': { id: 'sign', rounds: 2, add: [['str', 10], ['wil', 10], ['int', 10]] },
  'guardian-field': { id: 'field', rounds: 2, add: [['armour', 2]], heal: 5, pets: true },
  'druid-totem': { id: 'ally:totem', rounds: 3, add: [['com', 10], ['dex', 10], ['str', 10]], heal: 2, pets: true },
  'druid-nature-force': { id: 'ally:nature', rounds: 2, add: [['str', 20]], heal: 8, pets: true },
  'runemaster-honour': { id: 'ally:honour', rounds: 2, add: [['com', 0]] },
  'cavedelver-stone-skin': { id: 'stoneSkin', rounds: 3, add: [['armour', 5]], heal: 10 },
  // The Banner stands for one fight; a fight ends the round, so the round is enough.
  'warrior-banner': { id: 'ally:banner', rounds: 1, add: [['str', 10], ['com', 10], ['damage', 2]] },
};
/** Buff cards: they renew at camp, and on the map or during an event they cost nothing. */
export const HIGH_BUFFS = Object.keys(BUFFS);
/** Buffs that only make sense in a fight. */
const FIGHT_ONLY = ['warrior-banner'];

const healBy = (actor: Pick<ActorState, 'character'>, n: number) => {
  const healed = Math.max(0, Math.min(n, actor.character.maxVitality - actor.character.vitality));
  actor.character.vitality += healed;
  return healed;
};

/** Plays a buff card: its effects for its rounds, its healing (companions too, for some), and the card turns sideways. */
export function highBuff(round: number, actor: ActorState, card: string): number {
  const buff = BUFFS[card];
  if (!buff) throw new EngineError('card.notNow', 'That card is not a buff.');
  actor.counters[`used:${card}`] = 1;
  actor.effects = actor.effects.filter((e) => e.id !== buff.id);
  for (const [attribute, amount] of buff.add) {
    actor.effects.push({ id: buff.id, attribute, amount, untilRound: round + buff.rounds - 1 });
    if (attribute === 'stamina') actor.staminaLeft += amount;
    if (attribute === 'speed') actor.speedLeft += amount;
  }
  if (buff.pets && buff.heal) for (const pet of actor.companions ?? []) pet.vitality = Math.min(pet.maxVitality, pet.vitality + buff.heal);
  return buff.heal ? healBy(actor, buff.heal) : buff.add[0]![1];
}

/** What Banner, Totem and Force of Nature give the hero's companions: the ally effects on the hero. */
export function allyBonus(actor: Pick<ActorState, 'effects'>, attribute: string): number {
  return actor.effects.filter((e) => e.id.startsWith('ally:') && e.attribute === attribute).reduce((sum, e) => sum + e.amount, 0);
}

/** A beast a card calls to the hero's side: the dog, a wolf of the pack, the voidling. */
export function callBeast(actor: ActorState, enemy: string) {
  const n = (actor.counters.called ?? 0) + 1;
  actor.counters.called = n;
  const e = ENEMIES[enemy]!;
  (actor.companions ??= []).push({ uid: `pet-${enemy}-c${n}`, enemy, vitality: e.vitality, maxVitality: e.vitality, bond: 3, tame: true, summoned: true });
}

/** Healing (the Mystic): +5 Vitality and every ailment ends. Renews at camp. */
export function voidHeal(actor: ActorState): number {
  actor.conditions = [];
  return healBy(actor, VOID_HEAL);
}
export const VOID_HEAL = 5;

/** Leather Suit: Tanneries needed before it can be made. */
export const TANNERIES_FOR_SUIT = 3;
/** Potion of Life: ingredients to find. */
export const LIFE_INGREDIENTS = 3;
/** The Pack: most wolves at the Druid's side. */
export const PACK_SIZE = 3;
/** Rune of Reflex: most runes on the armour. */
export const REFLEX_RUNES = 2;
/** Healthy Eating: rounds between the dishes; Special Recipe: rounds between its dishes. */
export const HEALTHY_EVERY = 10;
export const RECIPE_EVERY = 2;
/** Helping Hand: rounds of work, and the discount it earns. */
export const HELP_ROUNDS = 2;
export const DISCOUNT = 0.8;


const canGatherHere = (terrain: string) => terrain !== 'core' && TERRAINS[terrain as keyof typeof TERRAINS]?.actions.some((a) => a === 'gather' || a === 'herbalism');
const roundKey = (state: GameState, what: string) => `${what}@${state.round}`;
const unrevealedAround = (state: GameState, player: PlayerState) =>
  worldView(state).near(player.position).filter((cell) => state.map.cells[cell]?.terrain !== 'void' && !player.revealed.includes(cell));

/** Cells a travelling card can take the hero to: Groundwater (water to water) and Shadow Walker (cave or mountains). */
export function travelTargets(state: GameState, player: PlayerState, card: string): number[] {
  const here = landAt(state.map, player.position);
  const fits = card === 'gourmet-groundwater' ? (t: string) => isWater(t) : (t: string) => t === 'cave' || t === 'mountains';
  if (!fits(here)) return [];
  return player.revealed.filter((cell) => cell !== player.position && fits(landAt(state.map, cell)));
}

/** Spyglass: the neighbouring fragments not seen yet. */
export const spyTargets = (state: GameState, player: PlayerState) => unrevealedAround(state, player);

/** Steps between two fragments on the map's grid. */
export const distance = (state: GameState, a: number, b: number) =>
  Math.abs((a % state.map.width) - (b % state.map.width)) + Math.abs(Math.floor(a / state.map.width) - Math.floor(b / state.map.width));

/** Shadow Walker: rounds the way takes, half the fragments between, at least one. */
export const shadowRounds = (state: GameState, from: number, to: number) => Math.max(1, Math.floor(distance(state, from, to) / 2));

/** Cards that can be played during an event too: buffs and first aid, and Vision's second draw. */
export const HIGH_EVENT_CARDS = [...HIGH_BUFFS.filter((c) => !FIGHT_ONLY.includes(c)), 'mystic-healing', 'gourmet-recipe', 'elder-vision'];

/** The level 5 to 9 cards the player can play on the map right now. */
export function highMapCards(state: GameState, player: PlayerState): string[] {
  const out: string[] = [];
  const c = player.character;
  const terrain = landAt(state.map, player.position);
  const stamina = (card: string) => player.staminaLeft >= (MAP_STAMINA[card] ?? 0);
  const camp = (card: string) => has(player, card) && !isSpent(player, card) && stamina(card);
  for (const card of HIGH_BUFFS) if (!FIGHT_ONLY.includes(card) && camp(card)) out.push(card);
  if (camp('trapper-dog') && !(player.companions ?? []).some((p) => p.enemy === 'steppeDog')) out.push('trapper-dog');
  if (has(player, 'trapper-leatherwork') && stamina('trapper-leatherwork') && (player.counters.tanned ?? 0) >= TANNERIES_FOR_SUIT && !player.counters.leatherSuit) out.push('trapper-leatherwork');
  // Vision: played for its charge; with the charge held, a fresh event card can be drawn again.
  if (has(player, 'elder-vision')) {
    const pending = player.pendingEvent;
    if (player.counters.vision ? pending && pending.step === 'start' && !pending.puzzle : stamina('elder-vision') && !pending) out.push('elder-vision');
  }
  if (has(player, 'elder-fill') && player.counters.brimming) out.push('elder-fill');
  if (has(player, 'elder-spirit') && player.staminaLeft >= 1 && unrevealedAround(state, player).length) out.push('elder-spirit');
  if (has(player, 'elder-life-potion') && stamina('elder-life-potion') && canGatherHere(terrain) && !player.counters[`lifeIngredient:${player.position}`]) out.push('elder-life-potion');
  if (has(player, 'gourmet-groundwater') && player.staminaLeft > 0 && player.staminaLeft >= c.stamina && travelTargets(state, player, 'gourmet-groundwater').length) out.push('gourmet-groundwater');
  if (has(player, 'gourmet-recipe') && c.food >= 2 && state.round - (player.counters.recipeRound ?? -RECIPE_EVERY) >= RECIPE_EVERY) out.push('gourmet-recipe');
  if (has(player, 'gourmet-healthy') && c.food >= 1 && state.round - (player.counters.healthyRound ?? -HEALTHY_EVERY) >= HEALTHY_EVERY) out.push('gourmet-healthy');
  if (has(player, 'explorer-spyglass') && stamina('explorer-spyglass') && !player.counters[roundKey(state, 'spyglass')] && spyTargets(state, player).length) out.push('explorer-spyglass');
  if (camp('explorer-bait') && !player.counters.bait) out.push('explorer-bait');
  if (has(player, 'explorer-teleport') && player.counters.teleport !== player.position + 1) out.push('explorer-teleport');
  if (has(player, 'warrior-whetstone') && stamina('warrior-whetstone') && !player.counters.whetted) out.push('warrior-whetstone');
  if (has(player, 'mystic-illusion') && !player.counters[roundKey(state, 'illusion')]) out.push('mystic-illusion');
  if (camp('mystic-healing')) out.push('mystic-healing');
  if (has(player, 'mystic-voidling') && !(player.companions ?? []).some((p) => p.enemy === 'voidling') && !player.counters[roundKey(state, 'voidling')]) out.push('mystic-voidling');
  if (camp('druid-raven') && !player.counters[roundKey(state, 'raven')]) out.push('druid-raven');
  if (camp('druid-pack') && terrain === 'forest' && (player.companions ?? []).filter((p) => p.enemy === 'wolf' && p.summoned).length < PACK_SIZE) out.push('druid-pack');
  if (has(player, 'runemaster-reflex') && stamina('runemaster-reflex') && (player.counters.reflexRunes ?? 0) < REFLEX_RUNES && c.equipment.armour.length > (player.counters.reflexRunes ?? 0)) out.push('runemaster-reflex');
  if (has(player, 'wraith-untouchable') && stamina('wraith-untouchable') && (player.counters.dodgeLessons ?? 0) < 3 && !player.counters[roundKey(state, 'dodgeLesson')]) out.push('wraith-untouchable');
  if (has(player, 'cavedelver-helping-hand') && (terrain === 'village' || terrain === 'city') && (player.counters.helped ?? 0) < HELP_ROUNDS) out.push('cavedelver-helping-hand');
  if (has(player, 'cavedelver-shadow') && travelTargets(state, player, 'cavedelver-shadow').length) out.push('cavedelver-shadow');
  return out;
}

/** Whether a card played on the map takes the rest of the round (Helping Hand's work, Shadow Walker's journey). */
export const ENDS_ROUND = ['cavedelver-helping-hand', 'cavedelver-shadow'];

const test = (state: GameState, player: PlayerState, attribute: Attribute, rng: Rng, extra = 0) => {
  const result = heroTest(worldView(state), player, attribute, rng, extra);
  log(state, { type: 'check', player: player.id, attribute, result });
  return result;
};

/** Plays a level 5 to 9 card on the map. `target` is a cell index for the cards that go somewhere. */
export function playHighCard(state: GameState, player: PlayerState, card: string, rng: Rng, target?: string) {
  const c = player.character;
  const pay = () => { player.staminaLeft -= MAP_STAMINA[card] ?? 0; };
  const done = (ok = true, amount?: number) => log(state, { type: 'card', player: player.id, card, ok, ...(amount !== undefined ? { amount } : {}) });
  if (HIGH_BUFFS.includes(card)) {
    done(true, highBuff(state.round, player, card));
    return;
  }
  switch (card) {
    case 'trapper-dog':
      player.counters[`used:${card}`] = 1;
      callBeast(player, 'steppeDog');
      done(true, 1);
      break;
    case 'trapper-leatherwork': {
      pay();
      const ok = test(state, player, 'int', rng).success;
      if (ok) {
        player.counters.leatherSuit = 1;
        player.inventory.items.push('leatherSuit');
        log(state, { type: 'crafted', player: player.id, card, item: 'leatherSuit' });
      } else done(false);
      break;
    }
    case 'elder-vision': {
      if (player.counters.vision) {
        // The second draw: the card seen is put back and another is drawn for the same fragment.
        const terrain = landAt(state.map, player.position);
        const old = player.pendingEvent!.card;
        delete player.counters.vision;
        player.pendingEvent = null;
        log(state, { type: 'eventEnded', player: player.id, card: old });
        done(true, 2);
        if (terrain !== 'core') {
          const next = drawEvent(state, rng, terrain);
          if (next !== null) startEvent(state, player, next);
        }
        state.eventDeck.push(old);
        break;
      }
      pay();
      const ok = test(state, player, 'int', rng).success;
      if (ok) player.counters.vision = 1;
      done(ok, 1);
      break;
    }
    case 'elder-fill':
      // Brimming: Speed and Stamina as at the start of the round.
      delete player.counters.brimming;
      player.speedLeft = Math.max(player.speedLeft, startSpeed(state, player));
      player.staminaLeft = Math.max(player.staminaLeft, c.stamina);
      done(true);
      break;
    case 'elder-spirit': {
      // All the Stamina left: the spirit looks at up to 3 fragments around, which draw no events (XP on entering).
      player.staminaLeft = 0;
      let seen = 0;
      for (const cell of unrevealedAround(state, player).slice(0, 3)) if (reveal(state, player, cell, undefined, { peek: true })) seen++;
      done(true, seen);
      break;
    }
    case 'elder-life-potion': {
      pay();
      if (!test(state, player, 'int', rng).success) break;
      player.counters[`lifeIngredient:${player.position}`] = 1;
      const found = (player.counters.lifeIngredients ?? 0) + 1;
      if (found < LIFE_INGREDIENTS) {
        player.counters.lifeIngredients = found;
        done(true, found);
        break;
      }
      player.counters.lifeIngredients = 0;
      player.inventory.items.push('elderLifePotion');
      log(state, { type: 'crafted', player: player.id, card, item: 'elderLifePotion' });
      break;
    }
    case 'gourmet-groundwater':
    case 'cavedelver-shadow': {
      const to = Number(target);
      if (!travelTargets(state, player, card).includes(to)) throw new EngineError('card.notNow', 'You cannot go there that way.');
      const rounds = card === 'cavedelver-shadow' ? shadowRounds(state, player.position, to) : 1;
      if (card === 'gourmet-groundwater') player.staminaLeft = 0;
      log(state, { type: 'moved', player: player.id, from: player.position, to, cost: 0, pushed: true });
      delete player.counters[`hiddenAt:${player.position}`];
      player.cameFrom = null;
      player.position = to;
      player.crossedRiver = false;
      // A longer way underground: the rounds after this one are spent on the road too.
      if (rounds > 1) player.counters.travelling = rounds - 1;
      done(true, rounds);
      break;
    }
    case 'gourmet-recipe':
      c.food -= 2;
      player.counters.recipeRound = state.round;
      player.staminaLeft = Math.max(player.staminaLeft, c.stamina);
      done(true);
      break;
    case 'gourmet-healthy':
      c.food -= 1;
      player.counters.healthyRound = state.round;
      // Fed for this round and the next.
      player.counters[`sated@${state.round}`] = 1;
      player.counters[`sated@${state.round + 1}`] = 1;
      c.maxVitality += 1;
      c.vitality += 1;
      done(true, 1);
      break;
    case 'explorer-spyglass': {
      const cell = target !== undefined ? Number(target) : spyTargets(state, player)[0]!;
      if (!spyTargets(state, player).includes(cell)) throw new EngineError('card.notNow', 'You cannot look there.');
      pay();
      player.counters[roundKey(state, 'spyglass')] = 1;
      reveal(state, player, cell, undefined, { peek: true });
      done(true, 1);
      break;
    }
    case 'explorer-bait':
      player.counters[`used:${card}`] = 1;
      player.counters.bait = 1;
      done(true, BAIT);
      break;
    case 'explorer-teleport': {
      const set = player.counters.teleport;
      if (!set) {
        player.counters.teleport = player.position + 1;
        done(true, 0);
        break;
      }
      // Back through the teleport; it closes and can be set again.
      const to = set - 1;
      delete player.counters.teleport;
      log(state, { type: 'moved', player: player.id, from: player.position, to, cost: 0, pushed: true });
      delete player.counters[`hiddenAt:${player.position}`];
      player.cameFrom = null;
      player.position = to;
      player.crossedRiver = false;
      player.delve = null;
      done(true, 1);
      break;
    }
    case 'warrior-whetstone':
      pay();
      player.counters.whetted = 1;
      done(true, 2);
      break;
    case 'mystic-illusion': {
      player.counters[roundKey(state, 'illusion')] = 1;
      const ok = test(state, player, 'int', rng).success;
      if (ok) player.effects.push({ id: 'illusion', attribute: 'cha', amount: 20, untilRound: state.round });
      done(ok, 20);
      break;
    }
    case 'mystic-healing': {
      pay();
      player.counters[`used:${card}`] = 1;
      const ok = test(state, player, 'int', rng).success;
      done(ok, ok ? voidHeal(player) : 0);
      break;
    }
    case 'mystic-voidling': {
      player.counters[roundKey(state, 'voidling')] = 1;
      const ok = test(state, player, 'int', rng).success;
      if (ok) callBeast(player, 'voidling');
      done(ok, 1);
      break;
    }
    case 'druid-raven':
      // Raven Form: one flight to a neighbouring fragment, free of Speed, Stamina and rivers.
      player.counters[`used:${card}`] = 1;
      player.counters[roundKey(state, 'raven')] = 1;
      done(true);
      break;
    case 'druid-pack': {
      player.counters[`used:${card}`] = 1;
      const ok = test(state, player, 'wil', rng).success;
      let called = 0;
      if (ok) {
        while ((player.companions ?? []).filter((p) => p.enemy === 'wolf' && p.summoned).length < PACK_SIZE) {
          callBeast(player, 'wolf');
          called++;
        }
      }
      done(ok, called);
      break;
    }
    case 'runemaster-reflex':
      pay();
      player.counters.reflexRunes = (player.counters.reflexRunes ?? 0) + 1;
      done(true, player.counters.reflexRunes);
      break;
    case 'wraith-untouchable': {
      pay();
      player.counters[roundKey(state, 'dodgeLesson')] = 1;
      const ok = test(state, player, 'dex', rng, 10).success;
      if (ok) player.counters.dodgeLessons = (player.counters.dodgeLessons ?? 0) + 1;
      done(ok, player.counters.dodgeLessons ?? 0);
      break;
    }
    case 'cavedelver-helping-hand':
      player.counters.helped = (player.counters.helped ?? 0) + 1;
      done(true, player.counters.helped);
      break;
    default:
      throw new EngineError('card.notNow', 'You cannot play that card now.');
  }
}

/** Explorer's Bait: added to the next hunt. */
export const BAIT = 20;

/** Speed at the start of a round: the hero's own, the Runner's +1 and timed effects. */
export function startSpeed(state: Pick<GameState, 'round'>, player: Pick<PlayerState, 'character' | 'effects'>): number {
  const runner = has(player, 'wraith-runner') ? 1 : 0;
  const effects = player.effects.filter((e) => e.untilRound >= state.round && e.attribute === 'speed').reduce((s, e) => s + e.amount, 0);
  return Math.max(0, player.character.speed + runner + effects);
}

/** Guardian's Service and the Cave Delver's Helping Hand: the price in towns, 20% off (they do not add up). */
export const townPrice = (player: Pick<PlayerState, 'character' | 'counters'>, price: number) =>
  has(player, 'guardian-service') || (player.counters.helped ?? 0) >= HELP_ROUNDS ? Math.round(price * DISCOUNT * 100) / 100 : price;

/** Mountain Stew at camp: 2 food. */
export const STEW_FOOD = 2;
