import { springTrap } from './cards';
import {
  EVENT_BY_ID, EVENTS, HERB_IDS, ITEMS, LOOT_COMMON, LOOT_RARE, TERRAINS, randomFoesFor,
  type EventOption, type Outcome, type TerrainId,
} from '@hp/content';
import { DIFFICULTIES } from './config';
import { EngineError } from './errors';
import { combatXp, startCombat } from './combat';
import { neighbours } from './mapgen';
import { gainXp, log, reveal, worldView } from './progress';
import type { Rng } from './rng';
import type { GameState, PlayerState } from './state';
import { FOREVER, heroTest, type Rune } from './terrain';

/** The whole deck in card order, shuffled into `state.eventDeck` at the start and whenever it runs out. */
export const ALL_EVENT_IDS = EVENTS.map((e) => e.id);

/**
 * Draws an event card for a fragment: cards meant for other terrain are skipped,
 * and hostile cards weigh more on harder difficulties. Returns the card id or null.
 */
export function drawEvent(state: GameState, rng: Rng, terrain: TerrainId): number | null {
  const hostile = DIFFICULTIES[state.config.difficulty].hostileEvents;
  const weights = () => state.eventDeck.map((id) => {
    const card = EVENT_BY_ID[id]!;
    if (card.terrains && !card.terrains.includes(terrain)) return 0;
    return card.hostile ? hostile : 1;
  });
  let w = weights();
  if (w.every((x) => x === 0)) {
    state.eventDeck = rng.shuffle(ALL_EVENT_IDS);
    w = weights();
  }
  const i = rng.weighted(w);
  if (i < 0) return null;
  return state.eventDeck.splice(i, 1)[0]!;
}

/** The step of the player's pending event, with the options they can pay for. */
export function eventOptions(state: GameState, player: PlayerState): { option: EventOption; index: number; affordable: boolean }[] {
  if (!player.pendingEvent) return [];
  const card = EVENT_BY_ID[player.pendingEvent.card]!;
  const step = card.steps[player.pendingEvent.step]!;
  return step.options.map((option, index) => ({ option, index, affordable: canPay(player, option) }));
}

function canPay(player: PlayerState, option: EventOption): boolean {
  const c = option.cost;
  if (!c) return true;
  return (c.gold ?? 0) <= player.character.gold && (c.food ?? 0) <= player.character.food && (c.speed ?? 0) <= player.speedLeft;
}

export function startEvent(state: GameState, player: PlayerState, card: number) {
  player.pendingEvent = { card, step: 'start' };
  log(state, { type: 'eventDrawn', player: player.id, cell: player.position, card });
}

/** Plays the chosen option of the pending event card. */
export function chooseEventOption(state: GameState, player: PlayerState, rng: Rng, index: number) {
  const pending = player.pendingEvent;
  if (!pending) throw new EngineError('event.none', 'There is no event to answer.');
  const choice = eventOptions(state, player).find((o) => o.index === index);
  if (!choice) throw new EngineError('event.option', 'That choice is not on the card.');
  if (!choice.affordable) throw new EngineError('event.cost', 'You cannot pay for that choice.');
  const cost = choice.option.cost ?? {};
  player.character.gold -= cost.gold ?? 0;
  player.character.food -= cost.food ?? 0;
  player.speedLeft -= cost.speed ?? 0;
  log(state, { type: 'eventChoice', player: player.id, card: pending.card, step: pending.step, option: index });
  player.pendingEvent = null;
  runOutcomes(state, player, rng, choice.option.then, pending.card);
  if (!player.pendingEvent && !player.combat) log(state, { type: 'eventEnded', player: player.id, card: pending.card });
}

/** After a won fight: XP, the lucky coin's extra gold, and the card's rewards. */
export function winCombat(state: GameState, player: PlayerState, rng: Rng) {
  const combat = player.combat!;
  player.combat = null;
  const xp = combatXp(worldView(state), combat);
  log(state, { type: 'combatEnded', player: player.id, result: 'won', xp });
  gainXp(state, player, xp);
  if (player.character.cards.includes('warrior-veteran')) {
    gainXp(state, player, 1);
    log(state, { type: 'card', player: player.id, card: 'warrior-veteran', ok: true, amount: 1 });
  }
  if (player.inventory.items.includes('luckyCoin')) change(state, player, 'gold', 1);
  runOutcomes(state, player, rng, combat.onWin, combat.card);
  if (combat.card !== undefined && !player.pendingEvent && !player.combat) log(state, { type: 'eventEnded', player: player.id, card: combat.card });
}

function change(state: GameState, player: PlayerState, what: 'gold' | 'food' | 'vitality' | 'maxVitality' | 'herbs', amount: number) {
  amount = amount + 0; // avoid -0, which does not survive JSON
  const c = player.character;
  if (what === 'gold') c.gold = Math.max(0, c.gold + amount);
  if (what === 'food') c.food = Math.max(0, c.food + amount);
  if (what === 'vitality') c.vitality = Math.min(c.maxVitality, c.vitality + amount);
  if (what === 'maxVitality') {
    c.maxVitality += amount;
    c.vitality += amount;
  }
  log(state, { type: 'change', player: player.id, change: { what, amount } });
}

export function giveItem(state: GameState, player: PlayerState, item: string) {
  if (!ITEMS[item]) throw new EngineError('item.unknown', `Unknown item ${item}.`);
  player.inventory.items.push(item);
  log(state, { type: 'change', player: player.id, change: { what: 'item', item, amount: 1 } });
}

const RUNES: Rune[] = ['venom', 'venom', 'sharp', 'sharp', 'precise', 'precise', 'stunning', 'stunning', 'piercing', 'piercing'];

/** Steps of an event, relative to the side the hero entered from. */
function direction(state: GameState, player: PlayerState, rng: Rng, dir: 'back' | 'left' | 'right' | 'forward' | 'random'): [number, number] {
  const { width } = state.map;
  let fx = 0;
  let fy = 0;
  if (player.cameFrom !== null) {
    fx = (player.position % width) - (player.cameFrom % width);
    fy = Math.floor(player.position / width) - Math.floor(player.cameFrom / width);
  }
  if ((fx === 0 && fy === 0) || dir === 'random') {
    const all: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    return all[rng.int(4)]!;
  }
  if (dir === 'forward') return [fx, fy];
  if (dir === 'back') return [-fx, -fy];
  // Screen coordinates (y grows down): facing north (0,-1), left is west (-1,0).
  if (dir === 'left') return [fy, -fx];
  return [-fy, fx];
}

function push(state: GameState, player: PlayerState, rng: Rng, dir: 'back' | 'left' | 'right' | 'forward' | 'random', distance: number | 'd10' | 'd6half') {
  const steps = distance === 'd10' ? roll(state, player, rng, 10) : distance === 'd6half' ? Math.max(1, Math.floor(roll(state, player, rng, 6) / 2)) : distance;
  const [dx, dy] = direction(state, player, rng, dir);
  const { width, height } = state.map;
  let x = player.position % width;
  let y = Math.floor(player.position / width);
  let prev = player.position;
  let cell = player.position;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) break;
    x = nx;
    y = ny;
    prev = cell;
    cell = y * width + x;
  }
  if (cell === player.position) return;
  log(state, { type: 'moved', player: player.id, from: player.position, to: cell, cost: 0, pushed: true });
  player.cameFrom = prev;
  player.position = cell;
  player.crossedRiver = false;
  reveal(state, player, cell);
}

function roll(state: GameState, player: PlayerState, rng: Rng, die: number): number {
  const value = rng.die(die);
  log(state, { type: 'roll', player: player.id, die, value });
  return value;
}

/** Runs an event script. A fight stops the script; its rewards run when it is won. */
export function runOutcomes(state: GameState, player: PlayerState, rng: Rng, outcomes: Outcome[], card?: number): void {
  const world = worldView(state);
  const c = player.character;
  for (const o of outcomes) {
    if (player.combat || c.vitality <= 0) return;
    switch (o.do) {
      case 'gold': case 'food': case 'vitality':
        change(state, player, o.do, o.amount);
        break;
      case 'herbs':
        for (let i = 0; i < o.amount; i++) {
          const herb = HERB_IDS[rng.int(HERB_IDS.length)]!;
          player.inventory.herbs[herb] = (player.inventory.herbs[herb] ?? 0) + 1;
        }
        log(state, { type: 'change', player: player.id, change: { what: 'herbs', amount: o.amount } });
        break;
      case 'xp':
        gainXp(state, player, o.amount * DIFFICULTIES[state.config.difficulty].xp);
        break;
      case 'halfVitality':
        change(state, player, 'vitality', -Math.ceil(c.vitality / 2));
        break;
      case 'effect': {
        const untilRound = o.rounds === 0 ? FOREVER : state.round + o.rounds - 1;
        player.effects.push({ id: `card${card ?? ''}`, attribute: o.target, amount: o.amount, untilRound, ...(o.vs ? { vs: o.vs } : {}) });
        if (o.target === 'speed') player.speedLeft = Math.max(0, player.speedLeft + o.amount);
        if (o.target === 'stamina') player.staminaLeft = Math.max(0, player.staminaLeft + o.amount);
        log(state, { type: 'change', player: player.id, change: { what: 'effect', target: o.target, amount: o.amount, rounds: o.rounds } });
        break;
      }
      case 'permanent':
        if (o.target === 'maxVitality') change(state, player, 'maxVitality', o.amount);
        else {
          c.attributes[o.target] += o.amount;
          log(state, { type: 'change', player: player.id, change: { what: 'attribute', attribute: o.target, amount: o.amount } });
        }
        break;
      case 'skill':
        c.skills[o.skill] = (c.skills[o.skill] ?? 0) + o.amount;
        log(state, { type: 'change', player: player.id, change: { what: 'skill', skill: o.skill, amount: o.amount } });
        break;
      case 'item':
        giveItem(state, player, o.item);
        break;
      case 'randomItem': {
        const pool = o.rare ? LOOT_RARE : LOOT_COMMON;
        giveItem(state, player, pool[rng.int(pool.length)]!);
        break;
      }
      case 'rune': {
        const rune = RUNES[roll(state, player, rng, 10) - 1]!;
        c.equipment.rune = rune;
        log(state, { type: 'change', player: player.id, change: { what: 'rune', rune } });
        break;
      }
      case 'fight':
      case 'fightRandom': {
        const pool = randomFoesFor(c.level);
        const enemies = o.do === 'fight' ? o.enemies : [pool[rng.int(pool.length)]!];
        player.combat = startCombat(world, enemies, o.do === 'fight' ? o.onWin ?? [] : []);
        if (card !== undefined) player.combat.card = card;
        log(state, { type: 'combatStarted', player: player.id, foes: enemies });
        springTrap(state, player, rng);
        if (player.combat.foes.every((f) => f.vitality <= 0)) winCombat(state, player, rng);
        return;
      }
      case 'test': {
        const bonus = o.raceBonus && o.raceBonus.race === c.race ? o.raceBonus.amount : 0;
        const result = heroTest(world, player, o.attribute, rng, (o.modifier ?? 0) + bonus);
        log(state, { type: 'check', player: player.id, attribute: o.attribute, result });
        runOutcomes(state, player, rng, (result.success ? o.pass : o.fail) ?? [], card);
        break;
      }
      case 'roll': {
        const value = roll(state, player, rng, o.die);
        const row = o.table.find((r) => value <= r.upTo) ?? o.table[o.table.length - 1]!;
        runOutcomes(state, player, rng, row.then, card);
        break;
      }
      case 'ifRace':
        runOutcomes(state, player, rng, c.race === o.race ? o.then : o.else ?? [], card);
        break;
      case 'goto':
        if (card === undefined) break;
        player.pendingEvent = { card, step: o.step };
        log(state, { type: 'eventStep', player: player.id, card, step: o.step });
        break;
      case 'move':
        push(state, player, rng, o.direction, o.distance);
        break;
      case 'stuck':
        player.effects.push({ id: 'stuck', attribute: 'speed', amount: -99, untilRound: state.round + o.rounds });
        player.speedLeft = 0;
        log(state, { type: 'change', player: player.id, change: { what: 'stuck', rounds: o.rounds } });
        break;
      case 'loseSpeed':
        player.speedLeft = 0;
        break;
      case 'loseAll':
        c.gold = 0;
        player.inventory.items = [];
        log(state, { type: 'change', player: player.id, change: { what: 'lostEverything' } });
        break;
      case 'camp': {
        const healed = Math.min(2, c.maxVitality - c.vitality);
        c.vitality += healed;
        player.actionsSinceCamp = 0;
        log(state, { type: 'camped', player: player.id, cell: player.position, healed });
        break;
      }
      case 'peek':
        for (const n of neighbours(state.map, player.position)) reveal(state, player, n);
        break;
      case 'condition':
        if (!player.conditions.some((x) => x.id === o.id)) {
          player.conditions.push({ id: o.id, name: o.name, test: o.test, modifier: o.modifier ?? 0, worsen: o.worsen ?? 0, each: o.each });
          log(state, { type: 'condition', player: player.id, id: o.id, added: true });
        }
        break;
      case 'death':
        c.vitality = 0;
        break;
    }
  }
}

/** End of turn: each condition is tested again; a pass clears it, a failure applies its harm. */
export function tickConditions(state: GameState, player: PlayerState, rng: Rng) {
  const world = worldView(state);
  for (const cond of [...player.conditions]) {
    const result = heroTest(world, player, cond.test, rng, cond.modifier);
    log(state, { type: 'check', player: player.id, attribute: cond.test, result });
    if (result.success) {
      player.conditions = player.conditions.filter((x) => x !== cond);
      log(state, { type: 'condition', player: player.id, id: cond.id, added: false });
    } else {
      cond.modifier += cond.worsen;
      runOutcomes(state, player, rng, cond.each);
    }
  }
}

/** True if a fragment of this terrain draws an event when first revealed. */
export const drawsEvent = (terrain: TerrainId | 'core') => terrain !== 'core' && TERRAINS[terrain].drawsEvent;
