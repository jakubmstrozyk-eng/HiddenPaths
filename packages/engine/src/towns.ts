import { landAt } from './mapgen';
import { HERBS, ITEMS, LOOT_COMMON, MATERIALS, SCROLLS, TERRAINS, type ArmourSlot, type HerbId, type MaterialId } from '@hp/content';
import { EngineError } from './errors';
import { giveItem, runOutcomes } from './events';
import { log, worldView } from './progress';
import type { Rng } from './rng';
import type { GameState, PlayerState, Service } from './state';
import { heroTest } from './terrain';
import { armourPiece } from './combat';

/** Settlement prices and limits from the "Fragmenty" and "Bohaterowie Niezależni" chapters. */
export const TOWN = {
  meal: 2, stay: 2, sharpen: 2,
  /** Market food: price per portion and the most a hero can buy in one round. */
  market: { village: { price: 1, max: 4 }, city: { price: 0.5, max: 10 } },
  /** What a merchant pays for a portion of food. */
  foodBuyPrice: 0.25,
  train: { stamina: 2, max: { village: 3, city: 5 } },
};

type Place = 'inn' | 'village' | 'city' | null;

export function placeOf(state: GameState, player: PlayerState): Place {
  const t = landAt(state.map, player.position);
  return t === 'inn' || t === 'village' || t === 'city' ? t : null;
}

const onceKey = (state: GameState, what: string) => `${what}@${state.round}`;

/** Services the hero can use and pay for right now. */
export function availableServices(state: GameState, player: PlayerState): Service[] {
  const place = placeOf(state, player);
  if (!place) return [];
  const c = player.character;
  const out: Service[] = [];
  if (c.gold >= TOWN.meal) out.push('meal');
  if (c.gold >= TOWN.stay && !player.counters[onceKey(state, 'stay')]) out.push('stay');
  if (!player.counters[onceKey(state, 'gossip')]) out.push('gossip');
  if (place !== 'inn') {
    if (player.staminaLeft >= TOWN.train.stamina && (player.counters.trained ?? 0) < TOWN.train.max[place]) out.push('train');
    if (c.gold >= TOWN.sharpen) out.push('sharpen');
  }
  return out;
}

/** Inn table rolled on a stay: bad food, a brawl or a thief. */
function innTrouble(state: GameState, player: PlayerState, rng: Rng) {
  const value = rng.die(10);
  log(state, { type: 'roll', player: player.id, die: 10, value });
  if (value === 1) {
    runOutcomes(state, player, rng, [{ do: 'test', attribute: 'str', modifier: -10, fail: [{ do: 'halfVitality' }, { do: 'stuck', rounds: 1 }] }]);
  } else if (value === 2) {
    runOutcomes(state, player, rng, [{ do: 'fight', enemies: ['bandit'] }]);
  } else if (value === 3) {
    const result = heroTest(worldView(state), player, 'int', rng);
    log(state, { type: 'check', player: player.id, attribute: 'int', result });
    if (!result.success) runOutcomes(state, player, rng, [{ do: 'gold', amount: -player.character.gold }, { do: 'food', amount: -player.character.food }]);
  }
}

export function useService(state: GameState, player: PlayerState, rng: Rng, service: Service) {
  if (!availableServices(state, player).includes(service)) throw new EngineError('town.service', 'That service is not available here.');
  const c = player.character;
  const world = worldView(state);
  switch (service) {
    case 'meal':
      c.gold -= TOWN.meal;
      c.food += 1;
      log(state, { type: 'service', player: player.id, service, cost: TOWN.meal });
      break;
    case 'stay': {
      c.gold -= TOWN.stay;
      player.counters[onceKey(state, 'stay')] = 1;
      log(state, { type: 'service', player: player.id, service, cost: TOWN.stay });
      runOutcomes(state, player, rng, [{ do: 'camp' }, { do: 'effect', target: 'all', amount: 10, rounds: 2 }]);
      if (placeOf(state, player) === 'inn') innTrouble(state, player, rng);
      break;
    }
    case 'gossip': {
      player.counters[onceKey(state, 'gossip')] = 1;
      const result = heroTest(world, player, 'cha', rng);
      log(state, { type: 'service', player: player.id, service, cost: 0 });
      log(state, { type: 'check', player: player.id, attribute: 'cha', result });
      if (result.success) runOutcomes(state, player, rng, [{ do: 'effect', target: 'cha', amount: 10, rounds: 2 }]);
      break;
    }
    case 'train':
      player.staminaLeft -= TOWN.train.stamina;
      player.counters.trained = (player.counters.trained ?? 0) + 1;
      log(state, { type: 'service', player: player.id, service, cost: 0 });
      runOutcomes(state, player, rng, [{ do: 'permanent', target: 'com', amount: 1 }]);
      break;
    case 'sharpen':
      c.gold -= TOWN.sharpen;
      log(state, { type: 'service', player: player.id, service, cost: TOWN.sharpen });
      runOutcomes(state, player, rng, [{ do: 'effect', target: 'damage', amount: 1, rounds: 2 }]);
      break;
  }
}

/** Gear and potions on sale: rare goods and iron or plate armour only in a city. */
export function shopStock(state: GameState, player: PlayerState): string[] {
  const place = placeOf(state, player);
  if (place !== 'village' && place !== 'city') return [];
  return Object.values(ITEMS)
    .filter((i) => (i.kind === 'weapon' || i.kind === 'armour' || i.kind === 'shield' || i.kind === 'potion'))
    .filter((i) => place === 'city' || (!i.rare && !i.cityOnly))
    .filter((i) => i.kind !== 'weapon' || !i.rare)
    .filter((i) => i.kind !== 'potion' || !i.crafted)
    .map((i) => i.id)
    .filter((id) => !['reinforcedBoots', 'chainmail', 'healingElixir'].includes(id));
}

/** The Mystic's scrolls: only in a city. */
export function mysticStock(state: GameState, player: PlayerState): string[] {
  return placeOf(state, player) === 'city' ? [...SCROLLS] : [];
}

export function buyPrice(state: GameState, player: PlayerState, item: string): number | null {
  const place = placeOf(state, player);
  if (item === 'food') {
    if (place !== 'village' && place !== 'city') return null;
    const m = TOWN.market[place];
    return (player.counters[onceKey(state, 'market')] ?? 0) < m.max ? m.price : null;
  }
  if (!shopStock(state, player).includes(item) && !mysticStock(state, player).includes(item)) return null;
  return ITEMS[item]!.sell;
}

/** What a trader pays: rare materials only sell in a city. */
export function sellPrice(state: GameState, player: PlayerState, item: string): number | null {
  const place = placeOf(state, player);
  if (place !== 'village' && place !== 'city') return null;
  const inv = player.inventory;
  if (item === 'food') return player.character.food > 0 ? TOWN.foodBuyPrice : null;
  if (item in MATERIALS) {
    const m = MATERIALS[item as MaterialId];
    if ((inv.materials[item as MaterialId] ?? 0) <= 0 || (m.rare && place !== 'city')) return null;
    return m.buy;
  }
  if (item in HERBS) return (inv.herbs[item as HerbId] ?? 0) > 0 ? HERBS[item as HerbId].buy : null;
  return inv.items.includes(item) ? ITEMS[item]!.buy : null;
}

export function buy(state: GameState, player: PlayerState, item: string) {
  const price = buyPrice(state, player, item);
  if (price === null) throw new EngineError('town.notSold', 'That is not for sale here.');
  if (player.character.gold < price) throw new EngineError('town.gold', 'Not enough gold.');
  player.character.gold -= price;
  if (item === 'food') {
    player.character.food += 1;
    const key = onceKey(state, 'market');
    player.counters[key] = (player.counters[key] ?? 0) + 1;
  } else {
    giveItem(state, player, item);
  }
  log(state, { type: 'traded', player: player.id, item, gold: price, bought: true });
}

export function sell(state: GameState, player: PlayerState, item: string) {
  const price = sellPrice(state, player, item);
  if (price === null) throw new EngineError('town.cannotSell', 'Nobody here buys that.');
  const inv = player.inventory;
  if (item === 'food') player.character.food -= 1;
  else if (item in MATERIALS) inv.materials[item as MaterialId]! -= 1;
  else if (item in HERBS) inv.herbs[item as HerbId]! -= 1;
  else inv.items.splice(inv.items.indexOf(item), 1);
  player.character.gold += price;
  log(state, { type: 'traded', player: player.id, item, gold: price, bought: false });
}

/** Cities the hero has found, other than this one, that the portal can reach. */
export function portalTargets(state: GameState, player: PlayerState): number[] {
  if (placeOf(state, player) !== 'city' || player.counters[onceKey(state, 'portal')]) return [];
  return player.revealed.filter((cell) => cell !== player.position && landAt(state.map, cell) === 'city');
}

export function usePortal(state: GameState, player: PlayerState, to: number) {
  if (!portalTargets(state, player).includes(to)) throw new EngineError('town.portal', 'The portal cannot take you there.');
  player.counters[onceKey(state, 'portal')] = 1;
  log(state, { type: 'moved', player: player.id, from: player.position, to, cost: 0, pushed: true });
  player.cameFrom = null;
  player.position = to;
}

export const isSettlement = (state: GameState, cell: number) => {
  const t = landAt(state.map, cell);
  return t !== 'core' && !!TERRAINS[t].settlement;
};

/** Smelting takes this many carried weapons or armour pieces. */
export const SMELT_PIECES = 3;

/** Gear the Runemaster could melt: carried (not worn) weapons and armour, cheapest first. */
export function smeltable(player: PlayerState): string[] {
  return player.inventory.items
    .filter((id) => ITEMS[id]?.kind === 'weapon' || ITEMS[id]?.kind === 'armour')
    .sort((a, b) => ITEMS[a]!.sell - ITEMS[b]!.sell);
}

export function canSmelt(state: GameState, player: PlayerState): boolean {
  return player.character.cards.includes('runemaster-smelt') && placeOf(state, player) === 'city' && smeltable(player).length >= SMELT_PIECES;
}

/** Runemaster's Smelting: in a city, 3 pieces of gear become 1 iron ore or a new common item. */
export function smelt(state: GameState, player: PlayerState, rng: Rng, into: 'ore' | 'item') {
  if (!canSmelt(state, player)) throw new EngineError('card.notNow', 'You cannot smelt here.');
  const items = smeltable(player).slice(0, SMELT_PIECES);
  for (const id of items) player.inventory.items.splice(player.inventory.items.indexOf(id), 1);
  if (into === 'ore') {
    player.inventory.materials.iron = (player.inventory.materials.iron ?? 0) + 1;
    log(state, { type: 'smelted', player: player.id, items, into: 'iron' });
  } else {
    const item = LOOT_COMMON[rng.int(LOOT_COMMON.length)]!;
    player.inventory.items.push(item);
    log(state, { type: 'smelted', player: player.id, items, into: item });
  }
  log(state, { type: 'card', player: player.id, card: 'runemaster-smelt', ok: true });
}

/** Reinforcement: basic materials the Runemaster works into armour (wood and the common ores). */
export const BASIC_MATERIALS: MaterialId[] = ['iron', 'tin', 'copper', 'wood'];
export const REINFORCE_COST = 3;
export const MAX_ARMOUR = 5;

/** The parts of the body the Runemaster can reinforce here and now. */
export function reinforceSlots(state: GameState, player: PlayerState, armour: Record<ArmourSlot, number>): ArmourSlot[] {
  if (!player.character.cards.includes('runemaster-reinforce')) return [];
  const place = placeOf(state, player);
  if (place !== 'village' && place !== 'city') return [];
  const have = BASIC_MATERIALS.reduce((n, m) => n + (player.inventory.materials[m] ?? 0), 0);
  if (have < REINFORCE_COST) return [];
  // The +1 belongs to the piece worn there now (Jacob, 2026-11-26): a bare part or a reinforced piece cannot take it.
  return (['head', 'arms', 'torso', 'legs'] as ArmourSlot[]).filter((s) => {
    const piece = armourPiece(player, s);
    return piece && !player.counters[`reinforced:${s}:${piece}`] && armour[s] < MAX_ARMOUR;
  });
}

/** +1 armour on one part of the body for 3 basic materials, the most plentiful first. Ends the round (the caller does). */
export function reinforce(state: GameState, player: PlayerState, slot: ArmourSlot, armour: Record<ArmourSlot, number>) {
  if (!reinforceSlots(state, player, armour).includes(slot)) throw new EngineError('reinforce.notNow', 'You cannot reinforce that here.');
  const used: string[] = [];
  const bag = player.inventory.materials;
  for (let i = 0; i < REINFORCE_COST; i++) {
    const m = [...BASIC_MATERIALS].sort((a, b) => (bag[b] ?? 0) - (bag[a] ?? 0))[0]!;
    bag[m] = (bag[m] ?? 0) - 1;
    if (!bag[m]) delete bag[m];
    used.push(m);
  }
  player.counters[`reinforced:${slot}:${armourPiece(player, slot)}`] = 1;
  log(state, { type: 'reinforced', player: player.id, slot, materials: used });
}
