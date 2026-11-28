import type { ArmourSlot, EnemyKind } from './equipment';
import type { Text } from './types';

/**
 * Special rules on an enemy's attack or body.
 * - poison: a hit poisons, -1 Vitality each turn until a Strength test passes
 * - rot: a hit poisons, -2 Vitality each turn until a Dexterity test passes (mummy)
 * - ethereal: only half of weapon damage gets through (the rules say only magic or runes hurt it)
 * - stun: a hit forces a Willpower test, or the hero loses the next combat turn
 * - drain: a hit takes 1 Stamina; at 0 the hero falls under the enemy's control
 * - penetrating: a damage die of 3 or less is rolled again
 * - stinger: every third attack is a sting with +1 damage that poisons
 * - harrying: -10 to the hero's opposed tests (fleeing)
 * - flying: a winged foe that a split in the ground (Runemaster's Rending) cannot swallow
 */
export type EnemyTrait = 'poison' | 'rot' | 'ethereal' | 'stun' | 'drain' | 'penetrating' | 'stinger' | 'harrying' | 'flying';

export interface Enemy {
  id: string;
  name: Text;
  kind: EnemyKind;
  dex: number;
  str: number;
  wil: number;
  int: number;
  com: number;
  vitality: number;
  /** `ranged`: a bow, crossbow or spell that still works when the foe is bound (Black Vines). `blade`: a hand weapon (sword, axe, dagger) that the Explorer's Disarm can knock away; claws, teeth, bows and spells cannot be. */
  weapon: { name: Text; power: number; blade?: boolean; ranged?: boolean };
  armour: Partial<Record<ArmourSlot, number>>;
  xp: number;
  traits: EnemyTrait[];
  /** A thinking foe (people, demons, the beastman...): a hero it kills loses all their gold to it. Beasts, spiders and the dead do not rob. */
  sentient?: boolean;
}

const t = (pl: string, en: string): Text => ({ pl, en });
const all = (v: number) => ({ head: v, arms: v, torso: v, legs: v });

const list: Enemy[] = [
  { id: 'giantSpider', name: t('Wielki pająk', 'Giant spider'), kind: 'beast', dex: 20, str: 40, wil: 30, int: 10, com: 30, vitality: 16, weapon: { name: t('Kolce jadowe', 'Venom spines'), power: 0 }, armour: all(1), xp: 5, traits: ['poison'] },
  { id: 'wolf', name: t('Wilk', 'Wolf'), kind: 'beast', dex: 30, str: 20, wil: 20, int: 20, com: 20, vitality: 8, weapon: { name: t('Kły i szpony', 'Fangs and claws'), power: -1 }, armour: {}, xp: 2, traits: [] },
  { id: 'youngVoidDemon', name: t('Młody demon pustki', 'Young void demon'), kind: 'demon', dex: 40, str: 30, wil: 30, int: 30, com: 30, vitality: 12, weapon: { name: t('Miecz', 'Sword'), power: 0, blade: true }, armour: { torso: 2, arms: 2 }, xp: 4, traits: [], sentient: true },
  { id: 'bandit', name: t('Bandyta', 'Bandit'), kind: 'thug', dex: 30, str: 30, wil: 30, int: 30, com: 30, vitality: 14, weapon: { name: t('Miecz', 'Sword'), power: 0, blade: true }, armour: {}, xp: 4, traits: [], sentient: true },
  { id: 'banshee', name: t('Banshee', 'Banshee'), kind: 'wraith', dex: 40, str: 20, wil: 40, int: 20, com: 40, vitality: 8, weapon: { name: t('Porażenie', 'Shriek'), power: -2, ranged: true }, armour: {}, xp: 7, traits: ['stun', 'ethereal', 'flying'] },
  { id: 'mummy', name: t('Mumia', 'Mummy'), kind: 'wraith', dex: 20, str: 30, wil: 20, int: 10, com: 30, vitality: 10, weapon: { name: t('Szpony', 'Claws'), power: -1 }, armour: {}, xp: 5, traits: ['rot'] },
  { id: 'voidDemon', name: t('Demon pustki', 'Void demon'), kind: 'demon', dex: 40, str: 40, wil: 30, int: 30, com: 40, vitality: 16, weapon: { name: t('Dwuręczny topór', 'Great axe'), power: 1, blade: true }, armour: all(2), xp: 7, traits: [], sentient: true },
  { id: 'witch', name: t('Czarownica', 'Witch'), kind: 'thug', dex: 20, str: 20, wil: 40, int: 40, com: 20, vitality: 12, weapon: { name: t('Błyskawica', 'Lightning'), power: 1, ranged: true }, armour: {}, xp: 5, traits: ['drain'], sentient: true },
  { id: 'minotaur', name: t('Minotaur', 'Minotaur'), kind: 'beast', dex: 30, str: 50, wil: 40, int: 30, com: 40, vitality: 20, weapon: { name: t('Topór', 'Axe'), power: 0, blade: true }, armour: { torso: 3, head: 2 }, xp: 9, traits: ['penetrating'], sentient: true },
  { id: 'imp', name: t('Chochlik', 'Imp'), kind: 'demon', dex: 50, str: 10, wil: 10, int: 10, com: 20, vitality: 4, weapon: { name: t('Sztylet', 'Dagger'), power: -2, blade: true }, armour: {}, xp: 1, traits: [], sentient: true },
  { id: 'beastman', name: t('Zwierzoludź', 'Beastman'), kind: 'beast', dex: 30, str: 40, wil: 30, int: 20, com: 35, vitality: 16, weapon: { name: t('Miecz', 'Sword'), power: 0, blade: true }, armour: all(1), xp: 5, traits: [], sentient: true },
  { id: 'raven', name: t('Kruk', 'Raven'), kind: 'beast', dex: 30, str: 20, wil: 20, int: 10, com: 20, vitality: 6, weapon: { name: t('Pazury', 'Talons'), power: -1 }, armour: {}, xp: 2, traits: ['harrying', 'flying'] },
  { id: 'bear', name: t('Niedźwiedź', 'Bear'), kind: 'beast', dex: 30, str: 60, wil: 40, int: 0, com: 30, vitality: 24, weapon: { name: t('Łapa', 'Paw'), power: -1 }, armour: {}, xp: 5, traits: [] },
  { id: 'manticore', name: t('Mantikora', 'Manticore'), kind: 'beast', dex: 60, str: 50, wil: 40, int: 0, com: 50, vitality: 36, weapon: { name: t('Szpony', 'Claws'), power: 0 }, armour: {}, xp: 16, traits: ['stinger'] },
  // Foes that appear only in event cards.
  { id: 'honeybadger', name: t('Honeybadger', 'Honeybadger'), kind: 'beast', dex: 30, str: 60, wil: 30, int: 10, com: 30, vitality: 24, weapon: { name: t('Łapa', 'Paw'), power: -1 }, armour: {}, xp: 8, traits: [] },
  { id: 'nomadWarrior', name: t('Nomada', 'Nomad'), kind: 'human', dex: 40, str: 30, wil: 30, int: 30, com: 30, vitality: 14, weapon: { name: t('Długi łuk', 'Longbow'), power: 1, ranged: true }, armour: {}, xp: 2, traits: [], sentient: true },
  { id: 'caravanDriver', name: t('Woźnica', 'Caravan driver'), kind: 'human', dex: 30, str: 40, wil: 30, int: 30, com: 40, vitality: 15, weapon: { name: t('Kusza', 'Crossbow'), power: 1, ranged: true }, armour: {}, xp: 3, traits: [], sentient: true },
  // Beasts a skill card calls to the hero's side; they never come as foes.
  { id: 'steppeDog', name: t('Pies stepowy', 'Steppe dog'), kind: 'beast', dex: 30, str: 20, wil: 20, int: 10, com: 30, vitality: 8, weapon: { name: t('Pazury', 'Claws'), power: -1 }, armour: {}, xp: 0, traits: [] },
  { id: 'voidling', name: t('Pustkowiec', 'Voidling'), kind: 'demon', dex: 40, str: 50, wil: 30, int: 20, com: 40, vitality: 18, weapon: { name: t('Pazury', 'Claws'), power: -1 }, armour: {}, xp: 0, traits: [] },
  // Lords of the dungeons, one for each theme.
  { id: 'stoneWarden', name: t('Kamienny Strażnik', 'Stone Warden'), kind: 'demon', dex: 20, str: 50, wil: 40, int: 10, com: 40, vitality: 20, weapon: { name: t('Kamienne pięści', 'Stone fists'), power: 1 }, armour: all(3), xp: 10, traits: ['stun'] },
  { id: 'spiderQueen', name: t('Królowa Pająków', 'Spider Queen'), kind: 'beast', dex: 40, str: 40, wil: 30, int: 20, com: 40, vitality: 20, weapon: { name: t('Żądło', 'Sting'), power: 0 }, armour: all(1), xp: 10, traits: ['poison', 'stinger'] },
  { id: 'drowned', name: t('Topielica', 'The Drowned One'), kind: 'wraith', dex: 40, str: 30, wil: 50, int: 30, com: 35, vitality: 16, weapon: { name: t('Lodowaty dotyk', 'Icy touch'), power: 0 }, armour: {}, xp: 10, traits: ['drain'] },
  { id: 'mummyKing', name: t('Król Mumii', 'Mummy King'), kind: 'wraith', dex: 20, str: 40, wil: 40, int: 30, com: 40, vitality: 22, weapon: { name: t('Berło', 'Sceptre'), power: 1 }, armour: { torso: 2, head: 2 }, xp: 11, traits: ['rot'], sentient: true },
  { id: 'riftWarden', name: t('Strażnik Szczeliny', 'Rift Warden'), kind: 'demon', dex: 40, str: 40, wil: 40, int: 30, com: 45, vitality: 18, weapon: { name: t('Ostrze pustki', 'Void blade'), power: 1, blade: true }, armour: all(2), xp: 12, traits: ['ethereal'], sentient: true },
];

export const ENEMIES: Record<string, Enemy> = Object.fromEntries(list.map((e) => [e.id, e]));

/** The bestiary foes a "fight a random enemy" result picks from. */
export const RANDOM_FOES = ['wolf', 'bandit', 'giantSpider', 'mummy', 'beastman', 'raven', 'bear', 'imp'];

/** Foes a "random enemy" never brings before level 3 (Jacob's rule, 2026-11-23: they are too deadly for a new hero). */
export const LATE_RANDOM_FOES = ['giantSpider', 'beastman', 'bear'];
export const EARLY_LEVELS = 2;

/** The random-enemy pool for a hero of this level. */
export const randomFoesFor = (level: number) => (level <= EARLY_LEVELS ? RANDOM_FOES.filter((f) => !LATE_RANDOM_FOES.includes(f)) : RANDOM_FOES);
