import { ATTRIBUTES, ITEMS, QUIET_CARD, TERRAINS, bookReading } from '@hp/content';
import { cardPool, createCharacter, keepCards, spendPoints } from './character';
import { bondCompanions, CAMP_CARDS, campCard, canCampCard, canCook, canSeason, cook, eatMeal, levitating, playCard, playableCards, refreshCards, trimMeals } from './cards';
import { combatMoves, combatTurn, drinkPotion, heroArmour, type CombatMove } from './combat';
import { DIFFICULTIES, type GameConfig } from './config';
import { EngineError } from './errors';
import { ALL_EVENT_IDS, answerPuzzle, chooseEventOption, drawEvent, drawTownEvent, drawsEvent, eventOptions, giveItem, resetEventXp, runOutcomes, startEvent, tickConditions, winCombat } from './events';
import { EXIT_SPEED, canAfford, canDescend, enterRoom, rememberBoss, retreat, roomMoves, settleRoom, placeDungeon, woundBoss } from './dungeon';
import { generateMap, insideMap, landAt, neighbours, validateMapSetup } from './mapgen';
import { readableScrolls, scrollOf, selfSpell, spendScroll, teleportTargets } from './scrolls';
import { gainXp, log, respawn, reveal, worldView } from './progress';
import { beginJournal, canWriteJournal, combatJournal, journalOf, noteLog, payVows, startJournal, writeJournal } from './journal';
import { Rng, seedFromString } from './rng';
import { OUTSIDE, SIDES, type Action, type GameState, type NewPlayer, type PlayerState, type Side } from './state';
import type { GameMap } from './mapgen';
import { coverForgotten, deplete, DEPLETING_ACTIONS, markVisit } from './tiles';
import { availableTerrainActions, effectBonus, heroTest, isWater, runTerrainAction } from './terrain';
import { ENDS_ROUND, startSpeed } from './cardsHigh';
import { bountyAt, canTakeQuest, dropQuest, handInQuest, offeredQuests, progressQuests, questsToHandIn, takeQuest } from './quests';
import {
  availableServices, buy, buyPrice, canSmelt, mysticStock, portalTargets, reinforce, reinforceSlots, sell, sellPrice, shopStock, smelt, useService, usePortal,
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
  if (config.map) validateMapSetup(config.map);
  const map = generateMap(config.map ?? config.size, rng);
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
      speedLeft: character.speed + (character.cards.includes('wraith-runner') ? 1 : 0),
      staminaLeft: character.stamina,
      cameFrom: null,
      roundsWithoutFood: 0,
      actionsSinceCamp: 0,
      // A hero from earlier games brings its bag along (Jacob, 2026-11-26).
      inventory: p.character.growth?.inventory ? structuredClone(p.character.growth.inventory) : { materials: {}, herbs: {}, items: [] },
      effects: [],
      conditions: [],
      counters: {},
      crossedRiver: false,
      pendingEvent: null,
      combat: null,
      hasStone: false,
      // The hero journal comes along from earlier games (Jacob, 2026-11-27).
      journal: startJournal(p.character.journal, character.level, character.xp, character.gold),
    };
  });
  // Initiative: higher Dexterity acts first; seat order breaks ties.
  const turnOrder = players
    .map((p, seat) => ({ id: p.id, dex: p.character.attributes.dex, seat }))
    .sort((a, b) => b.dex - a.dex || a.seat - b.seat)
    .map((p) => p.id);
  const eventDeck = rng.shuffle(ALL_EVENT_IDS);
  // The dungeon has its own rng, so the rest of a seeded game plays out as it did before dungeons.
  const dungeon = placeDungeon(map, config, new Rng(seedFromString(`${seed}:dungeon`)));
  const state: GameState = { seed, rng: rng.state, config, map, players, turnOrder, turnIndex: 0, round: 1, eventDeck, winner: null, version: 0, log: [], logSeq: 0, ...(dungeon ? { dungeon } : {}) };
  for (const p of state.players) beginJournal(state, p);
  return state;
}

export function currentPlayer(state: GameState): PlayerState {
  const id = state.turnOrder[state.turnIndex]!;
  return state.players.find((p) => p.id === id)!;
}

/** A river blocks onward travel until the hero swims across; going back the way they came is always allowed. */
function blockedByRiver(state: GameState, player: PlayerState, to: number): boolean {
  if (landAt(state.map, player.position) !== 'river' || player.crossedRiver || levitating(state, player)) return false;
  if (to === player.cameFrom || player.cameFrom === null) return false;
  return landAt(state.map, to) !== 'river';
}

/** Jacob's rule (2026-11-23): stepping onto a fragment also costs 1 Stamina, besides its Speed. */
export const MOVE_STAMINA = 1;

/**
 * The fragment in the middle of a side of the map: the first step from the starting place on that side.
 * On a shaped map it is the fragment furthest out on that side, nearest the middle line.
 */
export function entryCell(map: Pick<GameMap, 'width' | 'height'> & { cells?: GameMap['cells'] }, side: Side): number {
  const midX = Math.floor((map.width - 1) / 2);
  const midY = Math.floor((map.height - 1) / 2);
  if (!map.cells) {
    const [x, y] = side === 'N' ? [midX, 0] : side === 'S' ? [midX, map.height - 1] : side === 'W' ? [0, midY] : [map.width - 1, midY];
    return y * map.width + x;
  }
  const land = map.cells.filter(insideMap);
  const vertical = side === 'N' || side === 'S';
  const out = (c: { x: number; y: number }) => (side === 'N' ? -c.y : side === 'S' ? c.y : side === 'W' ? -c.x : c.x);
  const across = (c: { x: number; y: number }) => Math.abs(vertical ? c.x - midX : c.y - midY);
  return [...land].sort((a, b) => out(b) - out(a) || across(a) - across(b) || a.index - b.index)[0]!.index;
}

export const isOutside = (player: Pick<PlayerState, 'position'>) => player.position === OUTSIDE;

/** Speed to step onto a fragment: 2 on hard terrain, except for the Explorer (Sense of Direction) or a levitating Mystic. */
export function moveCost(state: GameState, to: number, player?: PlayerState): number {
  const terrain = landAt(state.map, to);
  if (terrain === 'core') return 2;
  const light = !!player && (player.character.cards.includes('explorer-direction') || levitating(state, player));
  return TERRAINS[terrain].hard && !light ? 2 : 1;
}

function canCamp(state: GameState, player: PlayerState): { ok: boolean; cost: number } {
  const terrain = landAt(state.map, player.position);
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

/** A camp card the hero can use at a camp here: its own Stamina on top of the camp's. */
function canCampWith(state: GameState, player: PlayerState, card: string): boolean {
  const { ok, cost } = canCamp(state, player);
  return ok && canCampCard(player, card) && player.staminaLeft >= cost + CAMP_CARDS[card]!;
}

/** Camouflage: after slipping away unseen the hero may leave, but do nothing else on this fragment (Jacob, 2026-11-26). */
export const hiddenHere = (player: Pick<PlayerState, 'counters' | 'position'>) => !!player.counters[`hiddenAt:${player.position}`];

/** Everything the player may do right now. The app builds its buttons from this list. */
export function legalActions(state: GameState, playerId: string): Action[] {
  if (state.winner) return [];
  const player = currentPlayer(state);
  if (player.id !== playerId) return [];
  if (player.combat) return combatMoves(player, player.combat).map((move) => ({ type: 'combat', move }));
  if (player.pendingEvent && (player.character.newCards?.length || player.character.chooseCards)) {
    return [...eventOptions(state, player).filter((o) => o.affordable).map((o): Action => ({ type: 'event', option: o.index })), { type: 'keepCards', cards: [] }];
  }
  if (player.pendingEvent?.puzzle) return [{ type: 'puzzle', answer: {} }];
  if (player.pendingEvent) {
    const options = eventOptions(state, player).filter((o) => o.affordable).map((o): Action => ({ type: 'event', option: o.index }));
    // Quick skill cards may be played before answering the event (a buff for its test, or first aid).
    return hiddenHere(player) ? options : [...options, ...playableCards(state, player).map((card): Action => ({ type: 'card', card }))];
  }
  const actions: Action[] = [];
  if (isOutside(player)) {
    for (const side of SIDES) {
      if (moveCost(state, entryCell(state.map, side), player) <= player.speedLeft && player.staminaLeft >= MOVE_STAMINA) actions.push({ type: 'enter', side });
    }
    if (canEat(state, player)) actions.push({ type: 'eat' });
    if (player.character.newCards?.length || player.character.chooseCards) actions.push({ type: 'keepCards', cards: [] });
    actions.push({ type: 'endTurn' });
    return actions;
  }
  if (player.delve) return delveActions(state, player);
  if (canDescend(state, player) && canAfford(state, player)) for (const to of state.dungeon!.entry) actions.push({ type: 'dungeon', to });
  for (const n of neighbours(state.map, player.position)) {
    if (flying(state, player) || (moveCost(state, n, player) <= player.speedLeft && player.staminaLeft >= MOVE_STAMINA && !blockedByRiver(state, player, n))) actions.push({ type: 'move', to: n });
  }
  const hidden = hiddenHere(player);
  if (!hidden) for (const action of availableTerrainActions(worldView(state), player)) actions.push({ type: 'terrain', action });
  if (!hidden && canCamp(state, player).ok) {
    actions.push({ type: 'camp' });
    if (canResearch(state, player)) actions.push({ type: 'camp', research: true });
    for (const card of Object.keys(CAMP_CARDS)) if (canCampWith(state, player, card)) actions.push({ type: 'camp', card });
  }
  if (!hidden) for (const card of playableCards(state, player)) actions.push({ type: 'card', card });
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
  if (canTakeQuest(player)) for (const q of offeredQuests(state, player)) actions.push({ type: 'quest', op: 'take', id: q.id });
  for (const q of questsToHandIn(state, player)) actions.push({ type: 'quest', op: 'handIn', id: q.uid });
  for (const q of player.quests ?? []) actions.push({ type: 'quest', op: 'drop', id: q.uid });
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
  if (player.character.newCards?.length || player.character.chooseCards) actions.push({ type: 'keepCards', cards: [] });
  if (canEat(state, player)) actions.push({ type: 'eat' });
  actions.push({ type: 'endTurn' });
  return actions;
}

/** What a hero inside the dungeon may do: walk between rooms, climb out, eat, drink, read scrolls and play cards. */
function delveActions(state: GameState, player: PlayerState): Action[] {
  const actions: Action[] = [];
  if (canAfford(state, player)) for (const to of roomMoves(state, player)) actions.push({ type: 'dungeon', to });
  if (state.dungeon!.rooms[player.delve!.room]!.cleared && player.speedLeft >= EXIT_SPEED) actions.push({ type: 'dungeon', to: 'exit' });
  if (canEat(state, player)) actions.push({ type: 'eat' });
  for (const card of playableCards(state, player)) actions.push({ type: 'card', card });
  for (const item of readableScrolls(player, state.round, false)) {
    if (scrollOf(item)!.spell === 'teleport') for (const to of teleportTargets(worldView(state), player.position)) actions.push({ type: 'scroll', item, to });
    else actions.push({ type: 'scroll', item });
  }
  for (const id of new Set(player.inventory.items)) {
    const kind = ITEMS[id]?.kind;
    if (kind === 'potion') actions.push({ type: 'use', item: id });
    if (kind === 'weapon' || kind === 'armour' || (kind === 'shield' && !player.character.equipment.shield)) actions.push({ type: 'equip', item: id });
  }
  if (player.character.unspentPoints > 0) actions.push({ type: 'spend', bonus: {} });
  if (player.character.newCards?.length) actions.push({ type: 'keepCards', cards: [] });
  actions.push({ type: 'endTurn' });
  return actions;
}

/** Actions that need the hero on the map itself, not down in the dungeon. */
const MAP_ONLY = new Set<Action['type']>(['move', 'enter', 'camp', 'terrain', 'service', 'buy', 'sell', 'portal', 'smelt', 'reinforce', 'cook', 'read']);

/** One step onto a fragment: costs Speed and Stamina, reveals it and may draw an event. */
/** Flow: after touching water the Diver has +20 to the base attributes for 2 rounds. */
function flow(state: GameState, player: PlayerState, terrain: string) {
  if (!player.character.cards.includes('diver-flow') || !isWater(terrain)) return;
  player.effects = player.effects.filter((e) => e.id !== 'flow');
  player.effects.push({ id: 'flow', attribute: 'all', amount: 20, untilRound: state.round + 1 });
  log(state, { type: 'card', player: player.id, card: 'diver-flow', ok: true, amount: 20 });
}

/** Raven Form on the map: one flight to a neighbouring fragment this round, free of Speed, Stamina and rivers. */
const flying = (state: GameState, player: PlayerState) => !!player.counters[`raven@${state.round}`];

function step(state: GameState, player: PlayerState, to: number, rng: Rng) {
  const raven = flying(state, player);
  const cost = raven ? 0 : moveCost(state, to, player);
  if (cost > player.speedLeft) throw new EngineError('move.noSpeed', 'Not enough Speed left.');
  if (!raven && player.staminaLeft < MOVE_STAMINA) throw new EngineError('move.noStamina', 'Not enough Stamina left.');
  if (raven) {
    delete player.counters[`raven@${state.round}`];
    player.staminaLeft += MOVE_STAMINA;
  }
  player.crossedRiver = false;
  log(state, { type: 'moved', player: player.id, from: player.position, to, cost });
  delete player.counters[`hiddenAt:${player.position}`];
  player.speedLeft -= cost;
  player.staminaLeft -= MOVE_STAMINA;
  player.cameFrom = isOutside(player) ? null : player.position;
  player.position = to;
  const terrain = landAt(state.map, to);
  flow(state, player, terrain);
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
  // The fragment is shown first; its event card waits for the hero's first action here (Jacob, 2026-11-28).
  if (fresh && drawsEvent(terrain)) player.eventDue = to;
  // Cities, villages and inns: a town card waits for the first action of each visit, at most once in TOWN_EVENT_ROUNDS.
  else if (isTownPlace(terrain) && townEventReady(state, player, to)) player.eventDue = to;
  // A notice-board bounty: its foes wait on the marked fragment.
  const bounty = bountyAt(player, to);
  if (bounty !== null && !player.pendingEvent && !player.combat) {
    player.eventDue = null;
    startEvent(state, player, bounty);
  }
  searchForDungeon(state, player, rng);
}

/** Places with a town deck of their own. */
const isTownPlace = (terrain: string) => terrain === 'city' || terrain === 'village' || terrain === 'inn';
/** A town card comes at most once in this many rounds for the same hero in the same place. */
export const TOWN_EVENT_ROUNDS = 3;
const townKey = (cell: number) => `townEvent:${cell}`;
function townEventReady(state: GameState, player: PlayerState, cell: number): boolean {
  const last = player.counters[townKey(cell)];
  return last === undefined || state.round - last >= TOWN_EVENT_ROUNDS;
}

/** Chance that a new fragment's card is a real event; otherwise it is the quiet card (Jacob, 2026-11-28). */
export const EVENT_CHANCE = 0.7;

/** Draws the card waiting on the hero's fragment: an event 7 times in 10, the quiet card otherwise. */
function drawDueEvent(state: GameState, player: PlayerState, rng: Rng) {
  const cell = player.eventDue;
  player.eventDue = null;
  if (cell === null || cell === undefined || cell !== player.position) return;
  const terrain = landAt(state.map, cell);
  if (isTownPlace(terrain)) {
    // The town deck: the same 7 in 10, with the quiet card otherwise (Jacob, 2026-11-28).
    player.counters[townKey(cell)] = state.round;
    const card = rng.next() < EVENT_CHANCE ? drawTownEvent(state, rng, terrain as Exclude<typeof terrain, 'core'>) : QUIET_CARD;
    if (card !== null) startEvent(state, player, card);
    return;
  }
  if (!drawsEvent(terrain)) return;
  const card = rng.next() < EVENT_CHANCE ? drawEvent(state, rng, terrain as Exclude<typeof terrain, 'core'>) : QUIET_CARD;
  if (card !== null) startEvent(state, player, card);
}

/** Is the hero standing on a new fragment whose card has not been drawn yet? */
export const eventDueHere = (player: Pick<PlayerState, 'eventDue' | 'position' | 'delve'>) =>
  player.eventDue !== null && player.eventDue !== undefined && player.eventDue === player.position && !player.delve;

/** Leaving the fragment or ending the round: the waiting card is drawn instead, and the hero stays to face it. */
function leavesFragment(action: Action): boolean {
  if (action.type === 'scroll') return scrollOf(action.item)?.spell === 'teleport';
  return action.type === 'move' || action.type === 'portal' || action.type === 'dungeon' || action.type === 'endTurn' || action.type === 'camp' || action.type === 'reinforce';
}

/** The first action on the fragment itself (not packing the bag): the waiting card is drawn after it. */
const FRAGMENT_ACTIONS = new Set<Action['type']>(['terrain', 'service', 'buy', 'sell', 'cook', 'smelt', 'read', 'card', 'combat', 'quest']);

/**
 * The dungeon's entrance is hidden: each time a hero steps onto its fragment they test the better of
 * Intelligence and Dexterity to notice the way down (Jacob, 2026-11-26).
 */
function searchForDungeon(state: GameState, player: PlayerState, rng: Rng) {
  const d = state.dungeon;
  if (!d || d.plundered || player.position !== d.cell || d.foundBy.includes(player.id)) return;
  const a = player.character.attributes;
  const attribute = a.int >= a.dex ? 'int' : 'dex';
  const result = heroTest(worldView(state), player, attribute, rng);
  log(state, { type: 'check', player: player.id, attribute, result });
  if (result.success) d.foundBy.push(player.id);
  log(state, { type: 'dungeonSearch', player: player.id, found: result.success });
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
  if (action?.type === 'journal') return journalAction(prev, playerId, action);
  if (prev.winner) throw new EngineError('game.over', 'The game is over.');
  const state = structuredClone(prev);
  const fromSeq = state.logSeq;
  const rng = new Rng(state.rng);
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new EngineError('turn.notYours', 'It is not your turn.');
  const anytime = action.type === 'spend' || action.type === 'keepCards';
  // A card checks for itself whether it may be played now (quick ones also during an event, none in a fight).
  if (action.type !== 'combat' && action.type !== 'event' && action.type !== 'puzzle' && action.type !== 'card' && !anytime) busy(player);
  if (isOutside(player) && action.type !== 'enter' && action.type !== 'endTurn' && action.type !== 'eat' && !anytime) {
    throw new EngineError('enter.first', 'Step onto the map first.');
  }
  if (hiddenHere(player) && ['terrain', 'camp', 'card', 'cook', 'reinforce'].includes(action.type)) {
    throw new EngineError('hidden.here', 'You are hiding here: move on first.');
  }

  if (player.delve && MAP_ONLY.has(action.type)) throw new EngineError('dungeon.inside', 'Climb out of the dungeon first.');
  // The journal is written only at camp (Jacob, 2026-11-27): the campfire stays lit until the hero does something else.
  if (player.journal?.open && action.type !== 'camp' && action.type !== 'eat' && !anytime) player.journal.open = false;

  const due = eventDueHere(player) && !player.pendingEvent && !player.combat;
  if (due && leavesFragment(action)) {
    // In a town the card comes only after something done there: walking through or resting draws nothing.
    if (isTownPlace(landAt(state.map, player.position))) player.eventDue = null;
    else {
      drawDueEvent(state, player, rng);
      return finish(state, player, fromSeq, rng);
    }
  }

  switch (action.type) {
    case 'dungeon':
      walkDungeon(state, player, action.to);
      break;
    case 'move': {
      if (isOutside(player) || !neighbours(state.map, player.position).includes(action.to)) {
        throw new EngineError('move.notAdjacent', 'You can only move to a neighbouring fragment.');
      }
      if (blockedByRiver(state, player, action.to) && !flying(state, player)) throw new EngineError('move.river', 'Swim across the river first.');
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
      if (action.card && !(action.card in CAMP_CARDS && canCampWith(state, player, action.card))) throw new EngineError('card.notNow', 'You cannot use that card here.');
      player.staminaLeft -= cost;
      if (action.card) {
        player.staminaLeft -= CAMP_CARDS[action.card]!;
        campCard(state, player, action.card, rng, action.target);
      }
      if (action.research) {
        player.staminaLeft -= 1;
        player.character.attributes.int += 1;
        log(state, { type: 'card', player: player.id, card: 'mystic-researcher', ok: true, amount: 1 });
      }
      refreshCards(player);
      // A camp under the stars (a chapter's lesson): once a game it heals 4 instead of 2.
      const j = journalOf(player);
      const stars = j.summary.lessons.stars && !j.starsUsed;
      if (stars) j.starsUsed = true;
      // Better Camp: the Trapper's camp heals 3 more.
      const better = player.character.cards.includes('trapper-camp') ? 3 : 0;
      const healed = Math.min((stars ? 4 : 2) + better, player.character.maxVitality - player.character.vitality);
      player.character.vitality += healed;
      player.actionsSinceCamp = 0;
      log(state, { type: 'camped', player: player.id, cell: player.position, healed });
      // The campfire: the journal opens for an entry (Jacob, 2026-11-27: at every camp, if the player wants).
      j.open = true;
      // Companions rest too.
      for (const pet of player.companions ?? []) pet.vitality = Math.min(pet.maxVitality, pet.vitality + 2);
      endTurn(state, player, rng);
      break;
    }
    case 'terrain': {
      const outcome = runTerrainAction(worldView(state), player, action.action, rng);
      if (action.action === 'swim' && outcome.gained.includes('crossed')) flow(state, player, 'river');
      log(state, { player: player.id, ...outcome });
      // The animals, fruit, herbs or ore are gone for a while, for every hero.
      if (outcome.result.success && DEPLETING_ACTIONS.includes(action.action)) {
        const until = deplete(state, player.position, action.action);
        log(state, { type: 'depleted', player: player.id, cell: player.position, action: action.action, until });
      }
      break;
    }
    case 'event':
      chooseEventOption(state, player, rng, action.option);
      woundBoss(state, player);
      break;
    case 'puzzle':
      answerPuzzle(state, player, rng, action.answer);
      woundBoss(state, player);
      break;
    case 'combat':
      fight(state, player, rng, action.move);
      break;
    case 'card':
      playCard(state, player, action.card, rng, action.target);
      // Helping Hand's work and Shadow Walker's journey take the rest of the round.
      if (ENDS_ROUND.includes(action.card)) endTurn(state, player, rng);
      break;
    case 'keepCards': {
      if (player.combat) throw new EngineError('combat.inProgress', 'Finish the fight first.');
      const before = cardPool(player.character);
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
    case 'quest':
      if (action.op === 'take') takeQuest(state, player, action.id);
      else if (action.op === 'handIn') handInQuest(state, player, action.id);
      else dropQuest(state, player, action.id);
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
    case 'eat':
      if (!canEat(state, player)) throw new EngineError('eat.notNow', mealDue(state, player).left ? 'Not enough food.' : 'You have eaten this round.');
      eat(state, player);
      break;
    case 'endTurn':
      endTurn(state, player, rng);
      break;
    default:
      throw new EngineError('action.unknown', 'Unknown action.');
  }

  if (eventDueHere(player) && FRAGMENT_ACTIONS.has(action.type) && !player.pendingEvent && !player.combat && currentPlayer(state) === player) {
    drawDueEvent(state, player, rng);
  }
  return finish(state, player, fromSeq, rng);
}

function finish(state: GameState, player: PlayerState, fromSeq: number, rng: Rng): GameState {
  afterAction(state, player);
  chronicle(state, fromSeq);
  // The state keeps a short recent log for the app; the server stores the full history.
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  state.rng = rng.state;
  state.version++;
  return state;
}

/** A step in the dungeon: into a room (its card plays if nobody has cleared it), or out to the entrance. */
function walkDungeon(state: GameState, player: PlayerState, to: number | 'exit') {
  if (to === 'exit') {
    if (!player.delve) throw new EngineError('dungeon.none', 'You are not in the dungeon.');
    if (!state.dungeon!.rooms[player.delve.room]!.cleared) throw new EngineError('dungeon.room', 'Deal with this room first.');
    if (player.speedLeft < EXIT_SPEED) throw new EngineError('move.noSpeed', 'Not enough Speed left.');
    player.speedLeft -= EXIT_SPEED;
    player.delve = null;
    log(state, { type: 'leftDungeon', player: player.id });
    return;
  }
  // A new trip down: the Prudent's easy first test is ready again.
  if (!player.delve) delete player.counters['journal:prudent'];
  const card = enterRoom(state, player, to);
  log(state, { type: 'room', player: player.id, room: to, ...(card !== null ? { card } : {}) });
  if (card !== null) startEvent(state, player, card);
}

function fight(state: GameState, player: PlayerState, rng: Rng, move: CombatMove) {
  if (!player.combat) throw new EngineError('combat.none', 'You are not in a fight.');
  // The journal's say in this fight, fixed when it starts: bestiary notes and character traits.
  if (!player.combat.journal) player.combat.journal = combatJournal(player, player.combat.foes.map((f) => f.enemy));
  const { events, result } = combatTurn(worldView(state), player, player.combat, move, rng);
  if (result !== 'ongoing' && result !== 'won') rememberBoss(state, player);
  // Jacob's rule (2026-11-23): a fight takes the rest of the round, so the hero is left with no Speed or Stamina.
  if (result !== 'ongoing') {
    player.speedLeft = 0;
    player.staminaLeft = 0;
    // Whetstone: the edge lasts one fight.
    delete player.counters.whetted;
  }
  for (const event of events) log(state, { type: 'combat', player: player.id, event });
  switch (result) {
    case 'won':
      winCombat(state, player, rng);
      break;
    case 'hidden':
      // Camouflage: the Diver slips away unseen and stays where they are, but may do nothing more on this fragment.
      player.counters[`hiddenAt:${player.position}`] = 1;
      log(state, { type: 'combatEnded', player: player.id, result, xp: 0 });
      player.combat = null;
      // In the dungeon the foes still hold the room: the hero slips back the way they came.
      if (player.delve) retreat(player);
      break;
    case 'fled':
    case 'enthralled': {
      const wasDelving = !!player.delve;
      log(state, { type: 'combatEnded', player: player.id, result, xp: 0 });
      player.combat = null;
      // Fleeing in the dungeon goes back to the room before; the foes keep this one.
      if (player.delve) retreat(player);
      if (result === 'enthralled') {
        // Under the witch's spell: she takes the hero's gold and the rest of the round.
        runOutcomes(state, player, rng, [{ do: 'gold', amount: -player.character.gold }, { do: 'loseSpeed' }]);
      } else if (player.cameFrom !== null && !wasDelving) {
        log(state, { type: 'moved', player: player.id, from: player.position, to: player.cameFrom, cost: 0, pushed: true });
        [player.position, player.cameFrom] = [player.cameFrom, player.position];
      }
      break;
    }
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
    eq.rune2 = null;
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
    // Teleport also carries a hero out of the dungeon.
    player.delve = null;
    log(state, { type: 'moved', player: player.id, from: player.position, to, cost: 0, pushed: true });
    player.cameFrom = null;
    player.position = to;
    player.crossedRiver = false;
    // A new fragment opens as if walked into: XP, and its card waits for the first action there.
    const terrain = landAt(state.map, to);
    if (reveal(state, player, to, rng) && drawsEvent(terrain)) player.eventDue = to;
    return;
  }
  const scroll = spendScroll(player, state.round, item);
  log(state, { type: 'scroll', player: player.id, item, amount: selfSpell(player, scroll) });
}

/** Reading a book, once a round: a word from the book to spell from scattered letters; the 3rd good reading teaches its lesson. */
function readBook(state: GameState, player: PlayerState, rng: Rng, id: string) {
  const item = ITEMS[id];
  if (item?.kind !== 'book' || !player.inventory.items.includes(id)) throw new EngineError('item.missing', 'You have no such book.');
  const key = readKey(state, id);
  if (player.counters[key]) throw new EngineError('book.once', 'You can read this book once a round.');
  player.counters[key] = 1;
  const reading = bookReading(id);
  if (!reading) return;
  resetEventXp(player);
  runOutcomes(state, player, rng, [{ do: 'puzzle', puzzle: reading.puzzle }], reading.card);
}

/** Death, the Stone of Beginnings, the Fountain of rebirth and the win conditions. */
function afterAction(state: GameState, player: PlayerState) {
  trimMeals(player);
  if (player.character.vitality <= 0) respawn(state, player);
  // Carried off the fragment (death, a push, a portal): its card is not drawn any more.
  if (player.eventDue !== null && player.eventDue !== undefined && (player.eventDue !== player.position || isOutside(player))) player.eventDue = null;
  if (settleRoom(state, player)) {
    const room = state.dungeon!.rooms[player.delve!.room]!;
    log(state, { type: 'roomCleared', player: player.id, room: player.delve!.room, vault: room.kind === 'vault' });
  }
  if (isOutside(player)) return;
  markVisit(state, player.position);
  const cell = state.map.cells[player.position]!;
  if (cell.terrain === 'city') player.respawnAt = player.position;
  if (cell.terrain === 'core' && !state.players.some((p) => p.hasStone)) {
    player.hasStone = true;
    log(state, { type: 'stoneTaken', player: player.id, cell: player.position });
  }
  if (state.winner || player.combat || player.pendingEvent) return;
  const won =
    (state.config.winMode === 'stone' && player.hasStone && !!player.counters.stoneDelivered)
    || (state.config.winMode === 'exploration' && player.revealed.length === state.map.cells.filter(insideMap).length);
  if (won) {
    const xp = WIN_XP[state.config.winMode];
    gainXp(state, player, xp);
    state.winner = player.id;
    log(state, { type: 'won', player: player.id, mode: state.config.winMode, xp });
  }
}

const ateKey = (state: GameState) => `ate@${state.round}`;

/**
 * This round's meal: how many rations the hero needs (0 for the Sunborn on an even round,
 * 2 in the desert, else 1), how many they have eaten so far and how many are still to eat.
 */
export function mealDue(state: GameState, player: PlayerState): { needed: number; eaten: number; left: number } {
  const c = player.character;
  // Sunborn need food only every second round.
  const needsFood = c.race !== 'sunborn' || state.round % 2 === 1;
  // Staying in the desert costs double food.
  const needed = !needsFood ? 0 : !isOutside(player) && landAt(state.map, player.position) === 'desert' ? 2 : 1;
  const eaten = player.counters[ateKey(state)] ?? 0;
  // Healthy Eating: the dish keeps the Gourmet fed this round and the next.
  if (player.counters[`sated@${state.round}`]) return { needed: 0, eaten, left: 0 };
  return { needed, eaten, left: Math.max(0, needed - eaten) };
}

/** Any food helps: with 1 portion where the desert asks for 2, the hero still eats it (and is still hungry). */
function canEat(state: GameState, player: PlayerState): boolean {
  const { left } = mealDue(state, player);
  return left > 0 && player.character.food > 0;
}

/** The hero eats what this round still asks for, or all the food left when that is less. */
function eat(state: GameState, player: PlayerState) {
  const c = player.character;
  const { left, eaten } = mealDue(state, player);
  const portions = Math.min(left, c.food);
  eatMeal(state, player, portions);
  // Sign of Strength: while it lasts a meal heals 2 Vitality.
  if (portions > 0 && player.effects.some((e) => e.id === 'sign')) {
    const healed = Math.min(2, c.maxVitality - c.vitality);
    c.vitality += healed;
    if (healed) log(state, { type: 'card', player: player.id, card: 'guardian-sign', ok: true, amount: healed });
  }
  c.food -= portions;
  trimMeals(player);
  if (portions === left) player.roundsWithoutFood = 0;
  player.counters[ateKey(state)] = eaten + portions;
  log(state, { type: 'ate', player: player.id, foodLeft: c.food });
}

/** End-of-turn upkeep for one player, then the turn passes on. A hero who has not eaten goes hungry. */
function endTurn(state: GameState, player: PlayerState, rng: Rng) {
  const c = player.character;
  player.eventDue = null;
  if (mealDue(state, player).left > 0) {
    player.roundsWithoutFood++;
    const lost = player.roundsWithoutFood === 3 ? 5 : player.roundsWithoutFood === 6 ? 10 : 0;
    if (player.roundsWithoutFood >= 9) c.vitality = 0;
    else c.vitality -= lost;
    log(state, { type: 'hungry', player: player.id, rounds: player.roundsWithoutFood, vitalityLost: lost });
  }
  if (c.vitality <= 0) respawn(state, player);

  state.turnIndex++;
  if (state.turnIndex >= state.turnOrder.length) {
    state.turnIndex = 0;
    for (const p of state.players) markVisit(state, p.position);
    state.round++;
    for (const p of state.players) {
      p.effects = p.effects.filter((e) => e.untilRound >= state.round);
      // Per-round limits (market, gossip, reading) are keyed by round; drop the old ones.
      for (const key of Object.keys(p.counters)) if (key.includes('@') && Number(key.split('@')[1]) < state.round) delete p.counters[key];
    }
    const covered = coverForgotten(state, rng);
    if (covered.length) log(state, { type: 'covered', player: player.id, cells: covered });
  }
  const next = currentPlayer(state);
  next.speedLeft = startSpeed(state, next);
  next.staminaLeft = Math.max(0, next.character.stamina + effectBonus(next, state.round, 'stamina'));
  // Shadow Walker: a round still on the road underground; the hero cannot act this round.
  if (next.counters.travelling) {
    next.counters.travelling--;
    if (!next.counters.travelling) delete next.counters.travelling;
    next.speedLeft = 0;
    next.staminaLeft = 0;
    log(state, { type: 'card', player: next.id, card: 'cavedelver-shadow', ok: true, amount: 0 });
  }
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
  const fromSeq = state.logSeq;
  const rng = new Rng(state.rng);
  const player = currentPlayer(state);
  // In the dungeon an absent hero backs out of an unfinished room, so no room is cleared by the clock.
  if (player.delve && state.dungeon && !state.dungeon.rooms[player.delve.room]!.cleared) {
    rememberBoss(state, player);
    if (player.combat) log(state, { type: 'combatEnded', player: player.id, result: 'fled', xp: 0 });
    player.combat = null;
    player.pendingEvent = null;
    retreat(player);
  }
  if (player.combat) {
    log(state, { type: 'combatEnded', player: player.id, result: 'fled', xp: 0 });
    player.combat = null;
  }
  // An unanswered mini-game counts as given up.
  if (player.pendingEvent?.puzzle) answerPuzzle(state, player, rng, {});
  player.combat = null;
  player.eventDue = null;
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
  // An absent player is not starved for being away: the hero eats if there is food.
  if (canEat(state, player)) eat(state, player);
  afterAction(state, player);
  endTurn(state, player, rng);
  chronicle(state, fromSeq);
  state.rng = rng.state;
  state.version++;
  return state;
}

/** Reads what an action wrote to the log into the heroes' journals, and pays the vows it kept. */
function chronicle(state: GameState, fromSeq: number) {
  let seq = fromSeq;
  for (let pass = 0; pass < 3 && state.logSeq > seq; pass++) {
    const added = Math.min(state.logSeq - seq, state.log.length);
    seq = state.logSeq;
    const entries = state.log.slice(-added);
    progressQuests(state, entries);
    const kept = noteLog(state, entries);
    payVows(kept, (e) => log(state, e), (p, xp) => gainXp(state, p, xp));
  }
}

/** The campfire: an entry in the journal, or closing it unwritten. Any player may write, even out of turn. */
function journalAction(prev: GameState, playerId: string, action: Extract<Action, { type: 'journal' }>): GameState {
  const state = structuredClone(prev);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new EngineError('game.player', 'No such player.');
  if (action.entry && !canWriteJournal(player)) throw new EngineError('journal.camp', 'The journal is written only at camp.');
  writeJournal(state, player, action.entry, (e) => log(state, e));
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
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
