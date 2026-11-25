import {
  COMMON_ORES, HERB_IDS, ITEMS, RARE_ORES, TERRAINS,
  type Attribute, type EffectTarget, type EnemyKind, type HerbId, type MaterialId, type Outcome,
  type RaceId, type SkillId, type TerrainAction, type Text,
} from '@hp/content';
import { DIFFICULTIES, dangerLevel } from './config';
import { test, type TestResult } from './dice';
import { EngineError } from './errors';
import type { Rng } from './rng';

/** A timed bonus or penalty. `attribute: 'all'` applies to every base attribute. */
export interface Effect {
  id: string;
  attribute: EffectTarget;
  amount: number;
  /** Last round (inclusive) the effect applies. */
  untilRound: number;
  /** Only in fights against this kind of foe. */
  vs?: EnemyKind;
}

/** Effects that last for the rest of the game use this as their last round. */
export const FOREVER = 1_000_000;

export interface Inventory {
  materials: Partial<Record<MaterialId, number>>;
  herbs: Partial<Record<HerbId, number>>;
  /** Carried items by id (gear not worn, potions, trinkets, books). Trinkets work while carried. */
  items: string[];
}

/** A lasting condition such as poison or a nightmare, tested at the end of each turn. */
export interface Condition {
  id: string;
  name: Text;
  test: Attribute;
  modifier: number;
  worsen: number;
  each: Outcome[];
}

export interface Equipment {
  weapon: string;
  /** Worn armour pieces by item id. */
  armour: string[];
  shield: boolean;
  /** A rune set on the weapon by a runic smith. */
  rune: Rune | null;
}

/** Weapon runes from the runic smith's d10 table. */
export type Rune = 'venom' | 'sharp' | 'precise' | 'stunning' | 'piercing' | 'safety';

/** A tamed beast fighting beside the hero (Druid's Companion). Until `tame`, it can still break free. */
export interface Companion {
  uid: string;
  enemy: string;
  vitality: number;
  maxVitality: number;
  /** Charisma tests passed so far; at 3 the beast stays for good. */
  bond: number;
  tame: boolean;
  /** Teacher: added to the beast's attributes. */
  bonus?: number;
}

/** The parts of a player's state that terrain actions read and change. */
export interface ActorState {
  id: string;
  position: number;
  cameFrom: number | null;
  speedLeft: number;
  staminaLeft: number;
  actionsSinceCamp: number;
  inventory: Inventory;
  effects: Effect[];
  counters: Record<string, number>;
  /** Set by a successful swim; lets the hero leave a river fragment onwards. */
  crossedRiver: boolean;
  conditions: Condition[];
  /** Tamed beasts that follow the hero (missing in games saved before companions existed). */
  companions?: Companion[];
  character: {
    race: RaceId;
    attributes: Record<Attribute, number>;
    vitality: number;
    maxVitality: number;
    food: number;
    gold: number;
    skills: Partial<Record<SkillId, number>>;
    equipment: Equipment;
    /** Skill card ids the hero holds. */
    cards: string[];
  };
}

export interface WorldView {
  round: number;
  difficulty: keyof typeof DIFFICULTIES;
  terrainAt: (cell: number) => string;
  ringAt: (cell: number) => number;
  maxRing: number;
  /** Fragments next to a cell. */
  near: (cell: number) => number[];
}

export type TerrainOutcome =
  | { type: 'test'; action: TerrainAction; attribute: Attribute; result: TestResult; gained: string[]; lost?: string[]; rerolled?: string; card?: string };

/** Stamina cost of each terrain action that the engine runs in the MVP. */
export const ACTION_COST: Partial<Record<TerrainAction, number>> = {
  hunt: 1, gather: 1, herbalism: 1, mine: 1, swim: 2, meditate: 0,
};

/** Fatigue from the rules: 6 actions without camping = -10, 12 actions = -20. */
export function fatiguePenalty(actionsSinceCamp: number): number {
  if (actionsSinceCamp >= 12) return -20;
  if (actionsSinceCamp >= 6) return -10;
  return 0;
}

/** Bonuses from carried trinkets for a target, optionally against a kind of foe or a race. */
export function itemBonus(actor: Pick<ActorState, 'inventory'>, target: string, vs?: string): number {
  let sum = 0;
  for (const id of actor.inventory.items) {
    const item = ITEMS[id];
    for (const b of item?.bonuses ?? []) {
      if ((b.target === target || (b.target === 'all' && target !== 'initiative' && target !== 'damage')) && (!b.vs || b.vs === vs)) sum += b.amount;
    }
  }
  return sum;
}

/** Timed effects on a target this round: an attribute, Speed, Stamina or damage. */
export function effectBonus(actor: Pick<ActorState, 'effects'>, round: number, target: EffectTarget, vs?: string): number {
  return actor.effects
    .filter((e) => e.untilRound >= round && (e.attribute === target || (e.attribute === 'all' && target !== 'speed' && target !== 'stamina' && target !== 'damage')) && (!e.vs || e.vs === vs))
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Every modifier on a test right now: difficulty, danger rings, fatigue, timed effects and trinkets. */
export function testModifier(world: WorldView, actor: ActorState, attribute: Attribute, extra = 0, vs?: string): number {
  const settings = DIFFICULTIES[world.difficulty];
  const danger = dangerLevel(world.ringAt(actor.position), world.maxRing, settings);
  return settings.testModifier - 10 * danger + fatiguePenalty(actor.actionsSinceCamp)
    + effectBonus(actor, world.round, attribute, vs) + itemBonus(actor, attribute, vs) + cardBonus(world, actor, attribute)
    + (actor.counters.nature ? NATURE_BONUS : 0) + extra;
}

/** Close to Nature: the Elder's meditation at camp gives +10 to the next attribute test. */
export const NATURE_BONUS = 10;

/**
 * A test of one of the hero's base attributes, with every modifier and the cards that act on any test:
 * Close to Nature's +10 is used up by it, and Wisdom of Ages gives a failed Intelligence test a second throw
 * once more.
 */
export function heroTest(world: WorldView, actor: ActorState, attribute: Attribute, rng: Rng, extra = 0, vs?: string): TestResult {
  const modifier = testModifier(world, actor, attribute, extra, vs);
  const value = actor.character.attributes[attribute];
  let result = test(rng, value, modifier);
  if (actor.counters.nature) delete actor.counters.nature;
  const cards = actor.character.cards ?? [];
  // Wisdom of Ages: every failed Intelligence test is thrown once more (Jacob, 2026-11-25).
  if (!result.success && attribute === 'int' && cards.includes('elder-wisdom')) {
    result = { ...test(rng, value, modifier), rerolled: 'elder-wisdom', first: result.roll };
  }
  return result;
}

/** Strength of the Forest: +20 to the Druid's tests of shaping magic on a forest fragment. */
export function magicBonus(world: WorldView, actor: Pick<ActorState, 'position' | 'character'>): number {
  return (actor.character.cards ?? []).includes('druid-forest') && world.terrainAt(actor.position) === 'forest' ? 20 : 0;
}

const WATER = new Set(['river', 'lake']);

/** Always-on skill cards: Strongman (+10 to Strength tests), Water-born (+10 to all next to water) and Caver. */
export function cardBonus(world: WorldView, actor: Pick<ActorState, 'position' | 'character'>, attribute: Attribute): number {
  const cards = actor.character.cards ?? [];
  let bonus = 0;
  if (attribute === 'str' && cards.includes('cavedelver-strongman')) bonus += 10;
  if (cards.includes('diver-waterborn')) {
    const wet = (cell: number) => WATER.has(world.terrainAt(cell));
    if (wet(actor.position) || world.near(actor.position).some(wet)) bonus += 10;
  }
  // Caver: +10 to every attribute in the mountains and in caves.
  if (cards.includes('cavedelver-caver') && ['mountains', 'cave'].includes(world.terrainAt(actor.position))) bonus += 10;
  return bonus;
}

/**
 * A free second try at a failed test from a skill card: Fish (hunting and swimming, every time)
 * or Hunter (hunting, once until the next camp). Returns the card used, if any.
 */
export function rerollCard(actor: ActorState, action: TerrainAction, terrain: string): string | null {
  const cards = actor.character.cards ?? [];
  // Fish: a failed hunt on a water fragment (river or lake) is rolled again once (Jacob, 2026-11-24).
  if (action === 'hunt' && WATER.has(terrain) && cards.includes('diver-fish')) return 'diver-fish';
  if (action === 'hunt' && WATER.has(terrain) && cards.includes('gourmet-fish')) return 'gourmet-fish';
  // Vise: every failed test for gathering materials is rolled again once.
  if (action === 'mine' && cards.includes('runemaster-vise')) return 'runemaster-vise';
  // Hunter: every failed hunt may be rolled again, once (Jacob, 2026-11-24).
  if (action === 'hunt' && cards.includes('trapper-hunter')) return 'trapper-hunter';
  return null;
}

/** The terrain actions available on the hero's fragment right now (camping is handled separately). */
export function availableTerrainActions(world: WorldView, actor: ActorState): TerrainAction[] {
  const terrain = world.terrainAt(actor.position);
  if (terrain === 'core') return [];
  const t = TERRAINS[terrain as keyof typeof TERRAINS];
  return t.actions.filter((a) => {
    const cost = ACTION_COST[a];
    if (cost === undefined) return false; // not in the engine yet (towns, building)
    if (a === 'swim' && actor.crossedRiver) return false;
    if (a === 'meditate' && actor.counters[`meditated:${actor.position}`]) return false;
    return actor.staminaLeft >= cost;
  });
}

const add = <K extends string>(bag: Partial<Record<K, number>>, key: K, n = 1) => {
  bag[key] = (bag[key] ?? 0) + n;
};

/** Runs one terrain action, changing `actor` in place. Returns what happened for the log. */
export function runTerrainAction(world: WorldView, actor: ActorState, action: TerrainAction, rng: Rng): TerrainOutcome {
  if (!availableTerrainActions(world, actor).includes(action)) {
    throw new EngineError('terrain.notHere', `You cannot ${action} here.`);
  }
  const terrain = world.terrainAt(actor.position);
  const attrs = actor.character.attributes;
  actor.staminaLeft -= ACTION_COST[action]!;
  if (ACTION_COST[action]! > 0) actor.actionsSinceCamp++;
  const gained: string[] = [];
  const skills = actor.character.skills;
  const skill: Partial<Record<TerrainAction, number>> = {
    hunt: skills.hunt ?? 0, gather: skills.gather ?? 0, herbalism: skills.herbalism ?? 0, mine: skills.mine ?? 0,
  };
  // Herbalist: +20 to the Intelligence test when gathering herbs or fruit.
  const herbalist = (action === 'gather' || action === 'herbalism') && (actor.character.cards ?? []).includes('druid-herbalist') ? 20 : 0;
  const roll = (attribute: Attribute, extra = 0) => heroTest(world, actor, attribute, rng, extra + herbalist + (skill[action] ?? 0));

  switch (action) {
    case 'hunt': {
      const once = () => {
        let result = roll('dex');
        const rerolled = result.success ? null : rerollCard(actor, 'hunt', terrain);
        if (rerolled) result = roll('dex');
        if (result.success) {
          const food = terrain === 'mountains' || terrain === 'river' ? 1 : 2;
          actor.character.food += food;
          gained.push(`food:${food}`);
          add(actor.counters, 'hunts');
          // Tannery: each animal caught leaves a hide the Trapper can work.
          if ((actor.character.cards ?? []).includes('trapper-tannery')) add(actor.counters, 'hides');
        }
        return { result, rerolled };
      };
      let { result, rerolled } = once();
      // Fisher: on a lake or river the Gourmet hunts twice in one go.
      const fisher = WATER.has(terrain) && (actor.character.cards ?? []).includes('gourmet-fisher');
      if (fisher) {
        const second = once();
        if (second.result.success && !result.success) result = second.result;
        rerolled ??= second.rerolled;
      }
      return { type: 'test', action, attribute: 'dex', result, gained, ...(rerolled ? { rerolled } : {}), ...(fisher ? { card: 'gourmet-fisher' } : {}) };
    }
    case 'gather': {
      const result = roll('int', 10);
      if (result.success) {
        actor.character.food += 1;
        gained.push('food:1');
        add(actor.counters, 'gathered');
      }
      return { type: 'test', action, attribute: 'int', result, gained };
    }
    case 'herbalism': {
      const result = roll('int');
      if (result.success) {
        const herb = HERB_IDS[rng.int(HERB_IDS.length)]!;
        add(actor.inventory.herbs, herb);
        gained.push(`herb:${herb}`);
        add(actor.counters, 'gathered');
      }
      return { type: 'test', action, attribute: 'int', result, gained };
    }
    case 'mine': {
      const vise = rerollCard(actor, 'mine', terrain);
      if (terrain === 'forest') {
        let result = roll('dex');
        const again = !result.success && vise;
        if (again) result = roll('dex');
        if (result.success) {
          add(actor.inventory.materials, 'wood');
          gained.push('material:wood');
        }
        return { type: 'test', action, attribute: 'dex', result, gained, ...(again ? { rerolled: vise } : {}) };
      }
      // Mountains and caves: common ores on a Dexterity test, plus one rare find on a harder Intelligence test.
      const common = terrain === 'cave' ? 1 : 2;
      let result = roll('dex');
      let again = !result.success && !!vise;
      if (again) result = roll('dex');
      const rareFind = (): boolean => {
        if (heroTest(world, actor, 'int', rng, -10 + (skill.mine ?? 0)).success) return true;
        if (!vise) return false;
        again = true;
        return heroTest(world, actor, 'int', rng, -10 + (skill.mine ?? 0)).success;
      };
      if (result.success) {
        for (let i = 0; i < common; i++) {
          const ore = COMMON_ORES[rng.int(COMMON_ORES.length)]!;
          add(actor.inventory.materials, ore);
          gained.push(`material:${ore}`);
        }
        if (terrain === 'cave') {
          actor.character.food += 1; // a mushroom
          gained.push('food:1');
        } else if (rareFind()) {
          const rare = RARE_ORES[rng.int(RARE_ORES.length)]!;
          add(actor.inventory.materials, rare);
          gained.push(`material:${rare}`);
        }
        add(actor.counters, 'gathered');
      }
      return { type: 'test', action, attribute: 'dex', result, gained, ...(again ? { rerolled: vise! } : {}) };
    }
    case 'swim': {
      const cards = actor.character.cards ?? [];
      const fishCard = cards.includes('diver-fish') ? 'diver-fish' : cards.includes('gourmet-fish') ? 'gourmet-fish' : null;
      const fish = !!fishCard;
      // Fish: each failed swim test is rolled again once.
      let dex = roll('dex');
      const dexAgain = !dex.success && fish;
      if (dexAgain) dex = roll('dex');
      let str = roll('str');
      const strAgain = !str.success && fish;
      if (strAgain) str = roll('str');
      const again = dexAgain || strAgain ? { rerolled: fishCard! } : {};
      const result = dex.success && str.success ? dex : dex.success ? str : dex;
      if (dex.success && str.success) {
        actor.crossedRiver = true;
        gained.push('crossed');
        return { type: 'test', action, attribute: 'dex', result, gained, ...again };
      }
      actor.character.vitality -= 6;
      return { type: 'test', action, attribute: dex.success ? 'str' : 'dex', result, gained, lost: ['vitality:6'], ...again };
    }
    case 'meditate': {
      // Monument: +20 to a random base attribute for 3 rounds (k6 table in the rules).
      const table: Attribute[] = ['com', 'cha', 'str', 'wil', 'int', 'dex'];
      const attribute = table[rng.die(6) - 1]!;
      actor.effects.push({ id: 'monument', attribute, amount: 20, untilRound: world.round + 2 });
      actor.counters[`meditated:${actor.position}`] = 1;
      gained.push(`effect:${attribute}:20`);
      return { type: 'test', action, attribute, result: { roll: 0, target: 0, success: true, margin: 0 }, gained };
    }
    default:
      throw new EngineError('terrain.notHere', `You cannot ${action} here.`);
  }
}
