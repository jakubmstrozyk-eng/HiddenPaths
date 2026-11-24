import { ITEMS, type ScrollItem } from '@hp/content';
import { EngineError } from './errors';
import type { ActorState, WorldView } from './terrain';

/**
 * The Mystic's magic scrolls (city only). A scroll is read once and is gone; a hero reads at most one
 * scroll a round. Healing and Renewal work anywhere, Teleport on the map, Fire bolt and Lightning in a fight.
 */

export const scrollOf = (id: string): ScrollItem | null => {
  const item = ITEMS[id];
  return item?.kind === 'scroll' ? item : null;
};

const roundKey = (round: number) => `scroll@${round}`;

/** Whether the hero has already read a scroll this round. */
export const scrollReadThisRound = (actor: Pick<ActorState, 'counters'>, round: number) => !!actor.counters[roundKey(round)];

/** Scrolls carried that could be read right now, in a fight or on the map. */
export function readableScrolls(actor: Pick<ActorState, 'counters' | 'inventory'>, round: number, inFight: boolean): string[] {
  if (scrollReadThisRound(actor, round)) return [];
  return [...new Set(actor.inventory.items)].filter((id) => {
    const scroll = scrollOf(id);
    if (!scroll) return false;
    if (scroll.spell === 'teleport') return !inFight;
    if (scroll.spell === 'fire' || scroll.spell === 'lightning') return inFight;
    return true;
  });
}

/** Takes the scroll out of the bag and marks the round's scroll as read. */
export function spendScroll(actor: ActorState, round: number, id: string): ScrollItem {
  const scroll = scrollOf(id);
  if (!scroll || !actor.inventory.items.includes(id)) throw new EngineError('item.missing', 'You have no such scroll.');
  if (scrollReadThisRound(actor, round)) throw new EngineError('scroll.once', 'You can read one scroll a round.');
  actor.inventory.items.splice(actor.inventory.items.indexOf(id), 1);
  actor.counters[roundKey(round)] = 1;
  return scroll;
}

/** Healing and Renewal: what they do to the reader. Returns Vitality healed. */
export function selfSpell(actor: ActorState, scroll: ScrollItem): number {
  if (scroll.spell === 'heal') {
    const healed = actor.character.maxVitality - actor.character.vitality;
    actor.character.vitality = actor.character.maxVitality;
    return Math.max(0, healed);
  }
  if (scroll.spell === 'renewal') {
    actor.conditions = [];
    actor.effects = actor.effects.filter((e) => e.amount >= 0);
  }
  return 0;
}

/** Fragments a Teleport scroll can reach: up to 2 steps away. */
export function teleportTargets(world: WorldView, from: number): number[] {
  const seen = new Set([from]);
  let ring = [from];
  for (let step = 0; step < 2; step++) {
    const next: number[] = [];
    for (const cell of ring) for (const n of world.near(cell)) if (!seen.has(n)) { seen.add(n); next.push(n); }
    ring = next;
  }
  seen.delete(from);
  return [...seen];
}

/** A burning foe (Fire bolt) dies after this many failed Strength tests. */
export const BURN_DEATH = 3;
