import type { Attribute, Text } from './types';

/** Where a blow lands. The d6 hit location table maps onto these four armour slots. */
export type ArmourSlot = 'head' | 'arms' | 'torso' | 'legs';
export const HIT_LOCATIONS: ArmourSlot[] = ['head', 'arms', 'arms', 'torso', 'legs', 'legs'];

/** Kinds of foes, used by bonuses such as "+10 Combat against Beasts". */
export type EnemyKind = 'beast' | 'demon' | 'thug' | 'wraith' | 'human';

/** A lasting bonus an item gives while it is carried or worn. */
export interface ItemBonus {
  /** A base attribute, every attribute, initiative in combat, or damage dealt. */
  target: Attribute | 'all' | 'initiative' | 'damage';
  amount: number;
  /** Only against this kind of foe (combat) or race (talking). */
  vs?: EnemyKind | 'sunborn';
}

interface BaseItem {
  id: string;
  name: Text;
  /** Merchant prices in gold. `buy` is what a trader pays for it. */
  sell: number;
  buy: number;
  rare: boolean;
  /** Sold only in a city. */
  cityOnly?: boolean;
  bonuses?: ItemBonus[];
}

export interface WeaponItem extends BaseItem {
  kind: 'weapon';
  /** Damage on top of the wielder's Strength step S (Strength / 10, rounded down). */
  power: number;
  ranged: boolean;
  /** Crossbows reload for a combat turn and allow one shot per turn. */
  reload?: boolean;
  /** "Penetrating": a damage die of 3 or less is rolled again. */
  penetrating?: boolean;
}

export interface ArmourItem extends BaseItem {
  kind: 'armour';
  covers: ArmourSlot[];
  value: number;
}

export interface ShieldItem extends BaseItem {
  kind: 'shield';
  /** Added to the Combat test when parrying. */
  parry: number;
}

export interface PotionItem extends BaseItem {
  kind: 'potion';
  heal?: number;
  effect?: { target: Attribute | 'all' | 'speed' | 'stamina'; amount: number; rounds: number };
}

export interface TrinketItem extends BaseItem {
  kind: 'trinket';
}

/** A book is read with an Intelligence test once a round; 3 good readings teach its lesson. */
export interface BookItem extends BaseItem {
  kind: 'book';
  teaches: { target: Attribute | 'mine'; amount: number }[];
}

export type Item = WeaponItem | ArmourItem | ShieldItem | PotionItem | TrinketItem | BookItem;

/** Good readings needed to learn a book. */
export const BOOK_READINGS = 3;

const t = (pl: string, en: string): Text => ({ pl, en });

const weapon = (id: string, name: Text, power: number, sell: number, extra: Partial<WeaponItem> = {}): WeaponItem => ({
  id, name, kind: 'weapon', power, ranged: false, sell, buy: sell / 2, rare: false, ...extra,
});

const armour = (tier: 'leather' | 'iron' | 'plate', slot: ArmourSlot, value: number, sell: number): ArmourItem => {
  const names: Record<ArmourSlot, Text> = {
    head: t('Czapa', 'Cap'), arms: t('Naramienniki', 'Pauldrons'), torso: t('Kurta', 'Jerkin'), legs: t('Nagolenniki', 'Greaves'),
  };
  const tiers = { leather: t('skórzana', 'Leather'), iron: t('żelazna', 'Iron'), plate: t('płytowa', 'Plate') };
  return {
    id: `${tier}-${slot}`, kind: 'armour', covers: [slot], value, sell, buy: sell / 2, rare: false,
    cityOnly: tier !== 'leather',
    name: { pl: `${names[slot].pl} ${tiers[tier].pl}`, en: `${tiers[tier].en} ${names[slot].en.toLowerCase()}` },
  };
};

const list: Item[] = [
  // Quartermaster weapons.
  weapon('dagger', t('Sztylet', 'Dagger'), -2, 1),
  weapon('shortSword', t('Krótki miecz', 'Short sword'), -1, 2),
  weapon('oneHanded', t('Miecz', 'Sword'), 0, 4),
  weapon('twoHanded', t('Broń dwuręczna', 'Two-handed axe'), 1, 8),
  weapon('bow', t('Łuk', 'Bow'), 0, 3, { ranged: true }),
  weapon('longBow', t('Długi łuk', 'Longbow'), 1, 6, { ranged: true }),
  weapon('crossbow', t('Kusza', 'Crossbow'), 2, 10, { ranged: true, reload: true }),
  weapon('minotaurAxe', t('Topór minotaura', "Minotaur's axe"), 0, 12, { penetrating: true, rare: true }),
  // Quartermaster armour.
  armour('leather', 'head', 1, 5), armour('leather', 'arms', 1, 3), armour('leather', 'torso', 1, 5), armour('leather', 'legs', 1, 3),
  armour('iron', 'head', 3, 10), armour('iron', 'arms', 3, 5), armour('iron', 'torso', 3, 10), armour('iron', 'legs', 3, 5),
  armour('plate', 'head', 5, 20), armour('plate', 'arms', 5, 10), armour('plate', 'torso', 5, 20), armour('plate', 'legs', 5, 10),
  { id: 'shield', kind: 'shield', name: t('Tarcza', 'Shield'), parry: 15, sell: 5, buy: 2.5, rare: false },
  // Event armour.
  { id: 'reinforcedBoots', kind: 'armour', name: t('Wzmocnione buty skórzane', 'Reinforced leather boots'), covers: ['legs'], value: 2, sell: 6, buy: 3, rare: false },
  { id: 'chainmail', kind: 'armour', name: t('Kolczuga', 'Chainmail'), covers: ['torso', 'arms'], value: 3, sell: 15, buy: 7.5, rare: true },
  // Herbalist potions.
  { id: 'lifePotion', kind: 'potion', name: t('Mikstura życia', 'Potion of life'), heal: 5, sell: 2, buy: 1, rare: false },
  { id: 'bigLifePotion', kind: 'potion', name: t('Duża mikstura życia', 'Great potion of life'), heal: 10, sell: 6, buy: 3, rare: false },
  { id: 'staminaPotion', kind: 'potion', name: t('Mikstura wytrzymałości', 'Potion of stamina'), effect: { target: 'stamina', amount: 1, rounds: 2 }, sell: 7, buy: 3.5, rare: false },
  { id: 'speedPotion', kind: 'potion', name: t('Mikstura szybkości', 'Potion of speed'), effect: { target: 'speed', amount: 1, rounds: 2 }, sell: 7, buy: 3.5, rare: false },
  { id: 'powerPotion', kind: 'potion', name: t('Mikstura mocy', 'Potion of power'), effect: { target: 'all', amount: 5, rounds: 1 }, sell: 5, buy: 2.5, rare: false },
  { id: 'healingElixir', kind: 'potion', name: t('Eliksir zdrowia', 'Elixir of health'), heal: 99, sell: 15, buy: 7.5, rare: true },
  // Trinkets found in events.
  { id: 'sunMedallion', kind: 'trinket', name: t('Medalion Słonecznych', 'Sunborn medallion'), sell: 8, buy: 4, rare: true, bonuses: [{ target: 'cha', amount: 5 }, { target: 'cha', amount: 10, vs: 'sunborn' }] },
  { id: 'protectiveAmulet', kind: 'trinket', name: t('Amulet ochronny', 'Protective amulet'), sell: 8, buy: 4, rare: true, bonuses: [{ target: 'initiative', amount: 5 }] },
  { id: 'pharaohAmulet', kind: 'trinket', name: t('Amulet Faraona', "Pharaoh's amulet"), sell: 10, buy: 5, rare: true, bonuses: [{ target: 'wil', amount: 10 }, { target: 'com', amount: 10, vs: 'wraith' }] },
  { id: 'luckyCoin', kind: 'trinket', name: t('Szczęśliwa moneta', 'Lucky coin'), sell: 5, buy: 2.5, rare: true },
  { id: 'ring', kind: 'trinket', name: t('Pierścień', 'Ring'), sell: 10, buy: 5, rare: false, bonuses: [{ target: 'all', amount: 1 }] },
  { id: 'necklace', kind: 'trinket', name: t('Naszyjnik', 'Necklace'), sell: 20, buy: 10, rare: false, bonuses: [{ target: 'com', amount: 5 }] },
  { id: 'bookKnight', kind: 'book', name: t('Księga Wiedzy Rycerskiej', 'Book of Knightly Lore'), sell: 10, buy: 5, rare: true, teaches: [{ target: 'com', amount: 5 }] },
  { id: 'bookJuggler', kind: 'book', name: t('Księga Magii Kuglarskiej', "Book of Juggler's Magic"), sell: 10, buy: 5, rare: true, teaches: [{ target: 'wil', amount: 5 }, { target: 'cha', amount: 5 }] },
  { id: 'bookStonemason', kind: 'book', name: t('Księga Kamieniarza', "Stonemason's Book"), sell: 10, buy: 5, rare: true, teaches: [{ target: 'mine', amount: 10 }] },
  { id: 'beastFur', kind: 'trinket', name: t('Futro bestii', 'Beast fur'), sell: 6, buy: 3, rare: false },
];

export const ITEMS: Record<string, Item> = Object.fromEntries(list.map((i) => [i.id, i]));

/** What "a random item" from an event can be. */
export const LOOT_COMMON = ['lifePotion', 'dagger', 'shortSword', 'leather-head', 'leather-arms', 'powerPotion', 'ring', 'bow'];
export const LOOT_RARE = ['bigLifePotion', 'staminaPotion', 'speedPotion', 'necklace', 'longBow', 'iron-head', 'shield', 'twoHanded'];

/** What every hero starts with: a sword, a leather jerkin and greaves. */
export const STARTING_KIT = { weapon: 'oneHanded', armour: ['leather-torso', 'leather-legs'] };
