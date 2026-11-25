import { ATTRIBUTES, BOOK_READINGS, ITEMS, TERRAINS } from '@hp/content';
import { createCharacter, keepCards, spendPoints } from './character';
import { bondCompanions, canCook, canSeason, cook, eatMeal, levitating, playCard, playableCards, refreshCards, trimMeals } from './cards';
import { combatMoves, combatTurn, drinkPotion, heroArmour, type CombatMove } from './combat';
import { DIFFICULTIES, type GameConfig } from './config';
import { EngineError } from './errors';
import { ALL_EVENT_IDS, chooseEventOption, drawEvent, drawsEvent, eventOptions, giveItem, runOutcomes, startEvent, tickConditions, winCombat } from './events';
import { generateMap, neighbours } from './mapgen';
import { readableScrolls, scrollOf, selfSpell, spendScroll, teleportTargets } from './scrolls';
import { gainXp, log, respawn, reveal, worldView } from './progress';
import { Rng, seedFromString } from './rng';
import { OUTSIDE, SIDES, type Action, type GameState, type NewPlayer, type PlayerState, type Side } from './state';
import type { GameMap } from './mapgen';
import { availableTerrainActions, effectBonus, heroTest, runTerrainAction } from './terrain';
import {
  availableServices, buy, buyPrice, canSmelt, mysticStock, isSettlement, placeOf, portalTargets, reinforce, reinforceSlots, sell, sellPrice, shopStock, smelt, useService, usePortal,
} from './towns';

export type { Action, GameState, LogEntry, NewPlayer, PlayerState } from './state';
export { worldView } from './progress';

/** Log entries kept in the game state. */
export const LOG_LIMIT = 150;

/** XP for winning, from the "Tryby Gry" chapter. */
export const WIN_XP = { stone: 40, exploration: 30 };

export function createGame(seed: string, config: GameConfig, newPlayers: NewPlayer[]): GameState {
  if (newPlayers.length < 1 || newPlayers.length > 4) throw new EngineError('game.players', 'A game has 1 to 4 players.');
  if (!config.multiplayer && newPlayers.length !== 1) throw new EngineError('game.players', 'A single player game has 1 player.');
  const rng = new Rng(seedFromString(seed));
  const map = generateMap(config.size, rng);
  const settings = DIFFICULTIES[config.difficulty];
  const taken: number[] = [];
  const players = newPlayers.map((p): PlayerState => {
    const character = createCharacter(p.character, settings.startFood);
    // Every hero starts outside the map and chooses a side to step in from (Jacob, 2026-11-24).
    return {
      id: p.id,
      character,
      position: OUTSIDE,
      start: OUTSIDE,
      respawnAt: OUTSIDE,
      revealed: [],
      speedLeft: character.speed,
      staminaLeft: character.stamina,
      cameFrom: null,
      roundsWithoutFood: 0,
      actionsSinceCamp: 0,
      inventory: { materials: {}, herbs: {}, items: [] },
      effects: [],
      conditions: [],
      counters: {},
      crossedRiver: false,
      pendingEvent: null,
      combat: null,
      hasStone: false,
    };
  });
  // Initiative: higher Dexterity acts first; seat order breaks ties.
  const turnOrder = players
    .map((p, seat) => ({ id: p.id, dex: p.character.attributes.dex, seat }))
    .sort((a, b) => b.dex - a.dex || a.seat - b.seat)
    .map((p) => p.id);
  const eventDeck = rng.shuffle(ALL_EVENT_IDS);
  return { seed, rng: rng.state, config, map, players, turnOrder, turnIndex: 0, round: 1, eventDeck, winner: null, version: 0, log: [], logSeq: 0 };
}

export function currentPlayer(state: GameState): PlayerState {
  const id = state.turnOrder[state.turnIndex]!;
  return state.players.find((p) => p.id === id)!;
}

/** A river blocks onward travel until the hero swims across; going back the way they came is always allowed. */
function blockedByRiver(state: GameState, player: PlayerState, to: number): boolean {
  if (state.map.cells[player.position]!.terrain !== 'river' || player.crossedRiver || levitating(state, player)) return false;
  if (to === player.cameFrom || player.cameFrom === null) return false;
  return state.map.cells[to]!.terrain !== 'river';
}

/** Jacob's rule (2026-11-23): stepping onto a fragment also costs 1 Stamina, besides its Speed. */
export const MOVE_STAMINA = 1;

/** The fragment in the middle of a side of the map: the first step from the starting place on that side. */
export function entryCell(map: Pick<GameMap, 'width' | 'height'>, side: Side): number {
  const midX = Math.floor((map.width - 1) / 2);
  const midY = Math.floor((map.height - 1) / 2);
  const [x, y] = side === 'N' ? [midX, 0] : side === 'S' ? [midX, map.height - 1] : side === 'W' ? [0, midY] : [map.width - 1, midY];
  return y * map.width + x;
}

export const isOutside = (player: Pick<PlayerState, 'position'>) => player.position === OUTSIDE;

/** Speed to step onto a fragment: 2 on hard terrain, except for the Explorer (Sense of Direction) or a levitating Mystic. */
function moveCost(state: GameState, to: number, player?: PlayerState): number {
  const terrain = state.map.cells[to]!.terrain;
  if (terrain === 'core') return 2;
  const light = !!player && (player.character.cards.includes('explorer-direction') || levitating(state, player));
  return TERRAINS[terrain].hard && !light ? 2 : 1;
}

function canCamp(state: GameState, player: PlayerState): { ok: boolean; cost: number } {
  const terrain = state.map.cells[player.position]!.terrain;
  if (terrain === 'core' || !TERRAINS[terrain].actions.includes('camp')) return { ok: false, cost: 0 };
  const cost = terrain === 'cave' || TERRAINS[terrain].settlement ? 0 : 1;
  return { ok: player.staminaLeft >= cost, cost };
}

/** Researcher: the Mystic may spend 1 more Stamina at camp to study, for a permanent +1 Intelligence. */
function canResearch(state: GameState, player: PlayerState): boolean {
  const { ok, cost } = canCamp(state, player);
  return ok && player.character.cards.includes('mystic-researcher') && player.staminaLeft >= cost + 1;
}

const readKey = (state: GameState, item: string) => `read:${item}@${state.round}`;

/** Everything the player may do right now. The app builds its buttons from this list. */
export function legalActions(state: GameState, playerId: string): Action[] {
  if (state.winner) return [];
  const player = currentPlayer(state);
  if (player.id !== playerId) return [];
  if (player.combat) return combatMoves(player, player.combat).map((move) => ({ type: 'combat', move }));
  if (player.pendingEvent && player.character.newCards?.length) {
    return [...eventOptions(state, player).filter((o) => o.affordable).map((o): Action => ({ type: 'event', option: o.index })), { type: 'keepCards', cards: [] }];
  }
  if (player.pendingEvent) {
    return eventOptions(state, player).filter((o) => o.affordable).map((o) => ({ type: 'event', option: o.index }));
  }
  const actions: Action[] = [];
  if (isOutside(player)) {
    for (const side of SIDES) {
      if (moveCost(state, entryCell(state.map, side), player) <= player.speedLeft && player.staminaLeft >= MOVE_STAMINA) actions.push({ type: 'enter', side });
    }
    actions.push({ type: 'endTurn' });
    return actions;
  }
  for (const n of neighbours(state.map, player.position)) {
    if (moveCost(state, n, player) <= player.speedLeft && player.staminaLeft >= MOVE_STAMINA && !blockedByRiver(state, player, n)) actions.push({ type: 'move', to: n });
  }
  for (const action of availableTerrainActions(worldView(state), player)) actions.push({ type: 'terrain', action });
  if (canCamp(state, player).ok) {
    actions.push({ type: 'camp' });
    if (canResearch(state, player)) actions.push({ type: 'camp', research: true });
  }
  for (const card of playableCards(state, player)) actions.push({ type: 'card', card });
  if (canCook(player)) {
    actions.push({ type: 'cook' });
    if (canSeason(state, player)) for (const spice of ATTRIBUTES) actions.push({ type: 'cook', spice });
  }
  for (const item of readableScrolls(player, state.round, false)) {
    if (scrollOf(item)!.spell === 'teleport') for (const to of teleportTargets(worldView(state), player.position)) actions.push({ type: 'scroll', item, to });
    else actions.push({ type: 'scroll', item });
  }
  if (canSmelt(state, player)) actions.push({ type: 'smelt', into: 'ore' }, { type: 'smelt', into: 'item' });
  for (const service of availableServices(state, player)) actions.push({ type: 'service', service });
  for (const to of portalTargets(state, player)) actions.push({ type: 'portal', to });
  for (const item of ['food', ...shopStock(state, player), ...mysticStock(state, player)]) {
    const price = buyPrice(state, player, item);
    if (price !== null && price <= player.character.gold) actions.push({ type: 'buy', item });
  }
  const sellable = new Set<string>(['food', ...player.inventory.items, ...Object.keys(player.inventory.materials), ...Object.keys(player.inventory.herbs)]);
  for (const item of sellable) if (sellPrice(state, player, item) !== null) actions.push({ type: 'sell', item });
  for (const id of new Set(player.inventory.items)) {
    const kind = ITEMS[id]?.kind;
    if (kind === 'potion') actions.push({ type: 'use', item: id });
    if (kind === 'weapon' || kind === 'armour' || (kind === 'shield' && !player.character.equipment.shield)) actions.push({ type: 'equip', item: id });
    if (kind === 'book' && !player.counters[readKey(state, id)]) actions.push({ type: 'read', item: id });
  }
  for (const slot of reinforceSlots(state, player, heroArmour(player))) actions.push({ type: 'reinforce', slot });
  if (player.character.unspentPoints > 0) actions.push({ type: 'spend', bonus: {} });
  if (player.character.newCards?.length) actions.push({ type: 'keepCards', cards: [] });
  actions.push({ type: 'endTurn' });
  return actions;
}

/** One step onto a fragment: costs Speed and Stamina, reveals it and may draw an event. */
function step(state: GameState, player: PlayerState, to: number, rng: Rng) {
  const cost = moveCost(state, to, player);
  if (cost > player.speedLeft) throw new EngineError('move.noSpeed', 'Not enough Speed left.');
  if (player.staminaLeft < MOVE_STAMINA) throw new EngineError('move.noStamina', 'Not enough Stamina left.');
  player.crossedRiver = false;
  log(state, { type: 'moved', player: player.id, from: player.position, to, cost });
  player.speedLeft -= cost;
  player.staminaLeft -= MOVE_STAMINA;
  player.cameFrom = isOutside(player) ? null : player.position;
  player.position = to;
  const terrain = state.map.cells[to]!.terrain;
  const fresh = reveal(state, player, to, rng);
  // Traveller: every second new fragment found in one turn gives the Explorer +1 XP.
  if (fresh && player.character.cards.includes('explorer-traveller')) {
    const key = `found@${state.round}`;
    player.counters[key] = (player.counters[key] ?? 0) + 1;
    if (player.counters[key] % 2 === 0) {
      gainXp(state, player, 1);
      log(state, { type: 'card', player: player.id, card: 'explorer-traveller', ok: true, amount: 1 });
    }
  }
  if (fresh && drawsEvent(terrain)) {
    const card = drawEvent(state, rng, terrain as Exclude<typeof terrain, 'core'>);
    if (card !== null) startEvent(state, player, card);
  }
}

function busy(player: PlayerState) {
  if (player.combat) throw new EngineError('combat.inProgress', 'Finish the fight first.');
  if (player.pendingEvent) throw new EngineError('event.pending', 'Answer the event first.');
}

/**
 * Applies one action and returns the new state. The input state is never changed,
 * so the server can keep the old version until the new one is saved.
 */
export function applyAction(prev: GameState, playerId: string, action: Action): GameState {
  if (prev.winner) throw new EngineError('game.over', 'The game is over.');
  const state = structuredClone(prev);
  const rng = new Rng(state.rng);
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new EngineError('turn.notYours', 'It is not your turn.');
  const anytime = action.type === 'spend' || action.type === 'keepCards';
  if (action.type !== 'combat' && action.type !== 'event' && !anytime) busy(player);
  if (isOutside(player) && action.type !== 'enter' && action.type !== 'endTurn' && !anytime) {
    throw new EngineError('enter.first', 'Step onto the map first.');
  }

  switch (action.type) {
    case 'move': {
      if (isOutside(player) || !neighbours(state.map, player.position).includes(action.to)) {
        throw new EngineError('move.notAdjacent', 'You can only move to a neighbouring fragment.');
      }
      if (blockedByRiver(state, player, action.to)) throw new EngineError('move.river', 'Swim across the river first.');
      step(state, player, action.to, rng);
      break;
    }
    case 'enter': {
      if (!isOutside(player)) throw new EngineError('enter.onMap', 'You are already on the map.');
      if (!SIDES.includes(action.side)) throw new EngineError('enter.side', 'Choose a side of the map.');
      const to = entryCell(state.map, action.side);
      // Until the hero finds a city, death brings them back to where they stepped in.
      if (player.start === OUTSIDE) player.start = to;
      if (player.respawnAt === OUTSIDE) player.respawnAt = to;
      step(state, player, to, rng);
      break;
    }
    case 'camp': {
      const { ok, cost } = canCamp(state, player);
      if (!ok) throw new EngineError('camp.notHere', 'You cannot camp here.');
      if (action.research && !canResearch(state, player)) throw new EngineError('card.notNow', 'You cannot study here.');
      player.staminaLeft -= cost;
      if (action.research) {
        player.staminaLeft -= 1;
        player.character.attributes.int += 1;
        log(state, { type: 'card', player: player.id, card: 'mystic-researcher', ok: true, amount: 1 });
      }
      refreshCards(player);
      const healed = Math.min(2, player.character.maxVitality - player.character.vitality);
      player.character.vitality += healed;
      player.actionsSinceCamp = 0;
      log(state, { type: 'camped', player: player.id, cell: player.position, healed });
      // Companions rest too.
      for (const pet of player.companions ?? []) pet.vitality = Math.min(pet.maxVitality, pet.vitality + 2);
      endTurn(state, player, rng);
      break;
    }
    case 'terrain': {
      const outcome = runTerrainAction(worldView(state), player, action.action, rng);
      log(state, { player: player.id, ...outcome });
      break;
    }
    case 'event':
      chooseEventOption(state, player, rng, action.option);
      break;
    case 'combat':
      fight(state, player, rng, action.move);
      break;
    case 'card':
      playCard(state, player, action.card, rng, action.target);
      break;
    case 'keepCards': {
      if (player.combat) throw new EngineError('combat.inProgress', 'Finish the fight first.');
      const before = [...player.character.cards, ...(player.character.newCards ?? [])];
      keepCards(player.character, action.cards);
      log(state, { type: 'cardsKept', player: player.id, cards: action.cards, dropped: before.filter((c) => !action.cards.includes(c)) });
      break;
    }
    case 'reinforce':
      reinforce(state, player, action.slot, heroArmour(player));
      // Reinforcing takes the rest of the round.
      endTurn(state, player, rng);
      break;
    case 'cook':
      cook(state, player, rng, action.spice);
      break;
    case 'smelt':
      smelt(state, player, rng, action.into);
      break;
    case 'scroll':
      readScroll(state, player, rng, action.item, action.to);
      break;
    case 'service':
      useService(state, player, rng, action.service);
      break;
    case 'buy':
      buy(state, player, action.item);
      break;
    case 'sell':
      sell(state, player, action.item);
      break;
    case 'portal':
      usePortal(state, player, action.to);
      break;
    case 'use':
      if (!player.inventory.items.includes(action.item)) throw new EngineError('item.missing', 'You do not carry that.');
      drinkPotion(worldView(state), player, action.item);
      player.inventory.items.splice(player.inventory.items.indexOf(action.item), 1);
      log(state, { type: 'change', player: player.id, change: { what: 'item', item: action.item, amount: -1 } });
      break;
    case 'equip':
      equip(state, player, action.item);
      break;
    case 'read':
      readBook(state, player, rng, action.item);
      break;
    case 'spend':
      if (player.combat) throw new EngineError('combat.inProgress', 'Finish the fight first.');
      spendPoints(player.character, action.bonus);
      break;
    case 'endTurn':
      endTurn(state, player, rng);
      break;
    default:
      throw new EngineError('action.unknown', 'Unknown action.');
  }

  afterAction(state, player);
  // The state keeps a short recent log for the app; the server stores the full history.
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  state.rng = rng.state;
  state.version++;
  return state;
}

function fight(state: GameState, player: PlayerState, rng: Rng, move: CombatMove) {
  if (!player.combat) throw new EngineError('combat.none', 'You are not in a fight.');
  const { events, result } = combatTurn(worldView(state), player, player.combat, move, rng);
  // Jacob's rule (2026-11-23): a fight takes the rest of the round, so the hero is left with no Speed or Stamina.
  if (result !== 'ongoing') {
    player.speedLeft = 0;
    player.staminaLeft = 0;
  }
  for (const event of events) log(state, { type: 'combat', player: player.id, event });
  switch (result) {
    case 'won':
      winCombat(state, player, rng);
      break;
    case 'hidden':
      // Camouflage: the Diver slips away unseen and stays where they are.
      log(state, { type: 'combatEnded', player: player.id, result, xp: 0 });
      player.combat = null;
      break;
    case 'fled':
    case 'enthralled':
      log(state, { type: 'combatEnded', player: player.id, result, xp: 0 });
      player.combat = null;
      if (result === 'enthralled') {
        // Under the witch's spell: she takes the hero's gold and the rest of the round.
        runOutcomes(state, player, rng, [{ do: 'gold', amount: -player.character.gold }, { do: 'loseSpeed' }]);
      } else if (player.cameFrom !== null) {
        log(state, { type: 'moved', player: player.id, from: player.position, to: player.cameFrom, cost: 0, pushed: true });
        [player.position, player.cameFrom] = [player.cameFrom, player.position];
      }
      break;
    case 'lost':
      log(state, { type: 'combatEnded', player: player.id, result, xp: 0 });
      break;
    case 'ongoing':
      break;
  }
}

function equip(state: GameState, player: PlayerState, id: string) {
  const inv = player.inventory.items;
  if (!inv.includes(id)) throw new EngineError('item.missing', 'You do not carry that.');
  const item = ITEMS[id]!;
  const eq = player.character.equipment;
  const take = () => inv.splice(inv.indexOf(id), 1);
  if (item.kind === 'weapon') {
    take();
    inv.push(eq.weapon);
    eq.weapon = id;
    eq.rune = null; // a rune belongs to the blade it was set on
  } else if (item.kind === 'armour') {
    take();
    const keep: string[] = [];
    for (const worn of eq.armour) {
      const w = ITEMS[worn];
      if (w?.kind === 'armour' && w.covers.some((s) => item.covers.includes(s))) inv.push(worn);
      else keep.push(worn);
    }
    eq.armour = [...keep, id];
  } else if (item.kind === 'shield') {
    if (eq.shield) throw new EngineError('item.worn', 'You already carry a shield.');
    take();
    eq.shield = true;
  } else {
    throw new EngineError('item.notGear', 'That cannot be worn.');
  }
  log(state, { type: 'change', player: player.id, change: { what: 'item', item: id, amount: 0 } });
}

/** Reads a magic scroll on the map: Healing and Renewal on the hero, Teleport up to 2 fragments away. */
function readScroll(state: GameState, player: PlayerState, rng: Rng, item: string, to?: number) {
  if (!readableScrolls(player, state.round, false).includes(item)) throw new EngineError('scroll.notNow', 'You cannot read that scroll now.');
  const spell = scrollOf(item)!.spell;
  if (spell === 'teleport') {
    if (to === undefined || !teleportTargets(worldView(state), player.position).includes(to)) throw new EngineError('scroll.target', 'The scroll cannot take you there.');
    spendScroll(player, state.round, item);
    log(state, { type: 'scroll', player: player.id, item, to });
    log(state, { type: 'moved', player: player.id, from: player.position, to, cost: 0, pushed: true });
    player.cameFrom = null;
    player.position = to;
    player.crossedRiver = false;
    // A new fragment opens as if walked into: XP and maybe an event.
    const terrain = state.map.cells[to]!.terrain;
    if (reveal(state, player, to, rng) && drawsEvent(terrain)) {
      const card = drawEvent(state, rng, terrain as Exclude<typeof terrain, 'core'>);
      if (card !== null) startEvent(state, player, card);
    }
    return;
  }
  const scroll = spendScroll(player, state.round, item);
  log(state, { type: 'scroll', player: player.id, item, amount: selfSpell(player, scroll) });
}

/** Reading a book: one Intelligence test a round; the 3rd good reading teaches its lesson. */
function readBook(state: GameState, player: PlayerState, rng: Rng, id: string) {
  const item = ITEMS[id];
  if (item?.kind !== 'book' || !player.inventory.items.includes(id)) throw new EngineError('item.missing', 'You have no such book.');
  const key = readKey(state, id);
  if (player.counters[key]) throw new EngineError('book.once', 'You can read this book once a round.');
  player.counters[key] = 1;
  const result = heroTest(worldView(state), player, 'int', rng);
  log(state, { type: 'check', player: player.id, attribute: 'int', result });
  if (!result.success) return;
  const count = (player.counters[`book:${id}`] ?? 0) + 1;
  player.counters[`book:${id}`] = count;
  if (count < BOOK_READINGS) return;
  player.inventory.items.splice(player.inventory.items.indexOf(id), 1);
  for (const lesson of item.teaches) {
    if (lesson.target === 'mine') runOutcomes(state, player, rng, [{ do: 'skill', skill: 'mine', amount: lesson.amount }]);
    else runOutcomes(state, player, rng, [{ do: 'permanent', target: lesson.target, amount: lesson.amount }]);
  }
}

/** Death, the Stone of Beginnings, the Fountain of rebirth and the win conditions. */
function afterAction(state: GameState, player: PlayerState) {
  trimMeals(player);
  if (player.character.vitality <= 0) respawn(state, player);
  if (isOutside(player)) return;
  const cell = state.map.cells[player.position]!;
  if (cell.terrain === 'city') player.respawnAt = player.position;
  if (cell.terrain === 'core' && !state.players.some((p) => p.hasStone)) {
    player.hasStone = true;
    log(state, { type: 'stoneTaken', player: player.id, cell: player.position });
  }
  if (state.winner || player.combat || player.pendingEvent) return;
  const won =
    (state.config.winMode === 'stone' && player.hasStone && isSettlement(state, player.position) && placeOf(state, player) === 'city')
    || (state.config.winMode === 'exploration' && player.revealed.length === state.map.cells.length);
  if (won) {
    const xp = WIN_XP[state.config.winMode];
    gainXp(state, player, xp);
    state.winner = player.id;
    log(state, { type: 'won', player: player.id, mode: state.config.winMode, xp });
  }
}

/** End-of-turn upkeep for one player, then the turn passes on. */
function endTurn(state: GameState, player: PlayerState, rng: Rng) {
  const c = player.character;
  // Sunborn need food only every second round.
  const needsFood = c.race !== 'sunborn' || state.round % 2 === 1;
  // Staying in the desert costs double food.
  const meals = !isOutside(player) && state.map.cells[player.position]!.terrain === 'desert' ? 2 : 1;
  if (needsFood) {
    if (c.food >= meals) {
      eatMeal(state, player, meals);
      c.food -= meals;
      trimMeals(player);
      player.roundsWithoutFood = 0;
      log(state, { type: 'ate', player: player.id, foodLeft: c.food });
    } else {
      player.roundsWithoutFood++;
      const lost = player.roundsWithoutFood === 3 ? 5 : player.roundsWithoutFood === 6 ? 10 : 0;
      if (player.roundsWithoutFood >= 9) c.vitality = 0;
      else c.vitality -= lost;
      log(state, { type: 'hungry', player: player.id, rounds: player.roundsWithoutFood, vitalityLost: lost });
    }
  }
  if (c.vitality <= 0) respawn(state, player);

  state.turnIndex++;
  if (state.turnIndex >= state.turnOrder.length) {
    state.turnIndex = 0;
    state.round++;
    for (const p of state.players) {
      p.effects = p.effects.filter((e) => e.untilRound >= state.round);
      // Per-round limits (market, gossip, reading) are keyed by round; drop the old ones.
      for (const key of Object.keys(p.counters)) if (key.includes('@') && Number(key.split('@')[1]) < state.round) delete p.counters[key];
    }
  }
  const next = currentPlayer(state);
  next.speedLeft = Math.max(0, next.character.speed + effectBonus(next, state.round, 'speed'));
  next.staminaLeft = Math.max(0, next.character.stamina + effectBonus(next, state.round, 'stamina'));
  log(state, { type: 'turnEnded', player: player.id, next: next.id, round: state.round });
  // Poison, nightmares and the like strike at the start of the hero's turn.
  tickConditions(state, next, rng);
  bondCompanions(state, next, rng);
  if (next.character.vitality <= 0) respawn(state, next);
}

/**
 * The 12-hour deadline passed: the hero's turn ends for them. A pending event is walked away from
 * (or its first free choice taken) and a fight is fled, so the game never waits on an absent player.
 */
export function timeoutTurn(prev: GameState): GameState {
  if (prev.winner) return prev;
  const state = structuredClone(prev);
  const rng = new Rng(state.rng);
  const player = currentPlayer(state);
  if (player.combat) {
    log(state, { type: 'combatEnded', player: player.id, result: 'fled', xp: 0 });
    player.combat = null;
  }
  if (player.pendingEvent) {
    const free = eventOptions(state, player).filter((o) => !o.option.cost);
    // Prefer a choice that does nothing (walking on); otherwise the last free one.
    const pick = free.find((o) => o.option.then.length === 0) ?? free[free.length - 1];
    if (pick && pick.option.then.length === 0) {
      log(state, { type: 'eventEnded', player: player.id, card: player.pendingEvent.card });
      player.pendingEvent = null;
    } else if (pick) {
      chooseEventOption(state, player, rng, pick.index);
      player.combat = null;
      player.pendingEvent = null;
    }
  }
  log(state, { type: 'timedOut', player: player.id });
  afterAction(state, player);
  endTurn(state, player, rng);
  state.rng = rng.state;
  state.version++;
  return state;
}

/** Adds XP from outside the rules (quick-reply rewards in multiplayer). */
export function grantXp(prev: GameState, playerId: string, xp: number): GameState {
  const state = structuredClone(prev);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new EngineError('game.player', 'No such player.');
  gainXp(state, player, xp);
  state.version++;
  return state;
}

/** True once the hero has a reason to stop: no Speed for any move. */
export function isStuck(state: GameState): boolean {
  return !legalActions(state, currentPlayer(state).id).some((a) => a.type === 'move');
}

export { giveItem };

/** The log entries that the last action added. */
export function newEntries(prev: GameState, next: GameState): GameState['log'] {
  const added = next.logSeq - prev.logSeq;
  return added > 0 ? next.log.slice(-Math.min(added, next.log.length)) : [];
}
