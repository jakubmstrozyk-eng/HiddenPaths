import type { HerbId, MaterialId } from './items';
import type { Text } from './types';

const t = (pl: string, en: string): Text => ({ pl, en });

/**
 * Notice-board quests of villages and cities (Jacob, 2026-11-28): simple errands for XP and gold,
 * the harder ones also for a weapon or an item. A quest is taken at the board and handed in at the same board.
 *
 * - scout: step onto every fragment around the settlement.
 * - discover: reveal new fragments anywhere.
 * - hunt: successful hunts. fights: fights won. events: event cards lived through.
 * - bring: hand over herbs, materials or food at the board (`what` names one, or 'herb' / 'ore' / 'rareOre' for any).
 * - bounty: beat the foes waiting on a marked fragment a few steps away.
 */
export type QuestKind = 'scout' | 'discover' | 'hunt' | 'fights' | 'events' | 'bring' | 'bounty';
export type QuestGoods = HerbId | MaterialId | 'food' | 'herb' | 'ore' | 'rareOre';

export interface QuestTemplate {
  id: string;
  kind: QuestKind;
  /** Harder quests: the city always posts one; they pay an item as well. */
  hard: boolean;
  title: Text;
  /** Who posted it and why; `{n}` is the number asked for, `{what}` the goods. */
  text: Text;
  need: number;
  what?: QuestGoods;
  /** Base reward before the difficulty's XP multiplier. */
  xp: number;
  gold: number;
  /** An item the quest pays (hard quests). */
  item?: string;
  /** Bounty: the card played on the marked fragment. */
  card?: number;
}

/** Bounty cards: the fight waiting on the marked fragment. Never in a deck. */
export const BOUNTY_CARD_BASE = 700;

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'scout', kind: 'scout', hard: false, need: 4, xp: 8, gold: 3,
    title: t('Zwiad okolicy', 'Scout the surroundings'),
    text: t('Sołtys prosi o sprawdzenie wszystkich fragmentów dookoła osady. Stań na każdym z nich i wróć z wieściami.', 'The headman asks for every fragment around the settlement to be checked. Stand on each of them and come back with news.') },
  { id: 'map', kind: 'discover', hard: false, need: 5, xp: 8, gold: 3,
    title: t('Mapa dla kartografa', "A map for the cartographer"),
    text: t('Kartograf zapłaci za szkice nowych ziem. Odkryj {n} nowych fragmentów i wróć.', 'The cartographer pays for sketches of new lands. Reveal {n} new fragments and come back.') },
  { id: 'hunt', kind: 'hunt', hard: false, need: 2, xp: 6, gold: 3,
    title: t('Dziczyzna na ucztę', 'Game for the feast'),
    text: t('Karczmarz szykuje ucztę i brakuje mu mięsa. Upoluj zwierzynę {n} razy.', 'The innkeeper is preparing a feast and is short of meat. Hunt successfully {n} times.') },
  { id: 'roads', kind: 'fights', hard: false, need: 2, xp: 8, gold: 4,
    title: t('Spokój na traktach', 'Safe roads'),
    text: t('Kupcy skarżą się na napaści. Wygraj {n} walki z czymkolwiek, co grasuje w okolicy.', 'Merchants complain of attacks. Win {n} fights against whatever roams the land.') },
  { id: 'chronicle', kind: 'events', hard: false, need: 3, xp: 6, gold: 3,
    title: t('Opowieści dla kronikarza', 'Tales for the chronicler'),
    text: t('Kronikarz zbiera historie z traktu. Przeżyj {n} przygody i opowiedz mu o nich.', 'The chronicler collects tales of the road. Live through {n} adventures and tell him about them.') },
  { id: 'herbs', kind: 'bring', hard: false, need: 2, what: 'herb', xp: 6, gold: 4,
    title: t('Zioła dla znachorki', 'Herbs for the wise woman'),
    text: t('Znachorce skończyły się zioła na okłady. Przynieś {n} dowolne zioła.', 'The wise woman has run out of herbs for poultices. Bring {n} herbs of any kind.') },
  { id: 'wood', kind: 'bring', hard: false, need: 2, what: 'wood', xp: 6, gold: 4,
    title: t('Drewno na palisadę', 'Wood for the palisade'),
    text: t('Palisada przegniła od deszczu. Przynieś {n} drewna z lasu.', 'The palisade has rotted in the rain. Bring {n} wood from the forest.') },
  { id: 'ore', kind: 'bring', hard: false, need: 2, what: 'ore', xp: 6, gold: 5,
    title: t('Ruda dla kowala', 'Ore for the smith'),
    text: t('Kowal czeka na dostawę. Przynieś {n} sztuki zwykłej rudy (żelazo, cyna lub miedź).', 'The smith is waiting for a delivery. Bring {n} pieces of common ore (iron, tin or copper).') },
  { id: 'food', kind: 'bring', hard: false, need: 3, what: 'food', xp: 5, gold: 4,
    title: t('Zapasy na zimę', 'Stores for the winter'),
    text: t('Sierociniec prosi o jedzenie. Przynieś {n} porcje jedzenia.', 'The orphanage asks for food. Bring {n} portions of food.') },
  // Harder ones: an item as well.
  { id: 'bandits', kind: 'bounty', hard: true, need: 1, xp: 15, gold: 8, item: 'longBow', card: BOUNTY_CARD_BASE,
    title: t('List gończy: bandyci', 'Wanted: bandits'),
    text: t('Banda rozbójników rozbiła obóz na zaznaczonym fragmencie. Rozpraw się z nimi i wróć po nagrodę.', 'A band of robbers has camped on the marked fragment. Deal with them and come back for the reward.') },
  { id: 'beast', kind: 'bounty', hard: true, need: 1, xp: 18, gold: 8, item: 'twoHanded', card: BOUNTY_CARD_BASE + 1,
    title: t('List gończy: zwierzoludź', 'Wanted: the beastman'),
    text: t('Zwierzoludź porywa owce i straszy pasterzy. Czeka na zaznaczonym fragmencie.', 'A beastman steals sheep and frightens the shepherds. It waits on the marked fragment.') },
  { id: 'witch', kind: 'bounty', hard: true, need: 1, xp: 18, gold: 10, item: 'chainmail', card: BOUNTY_CARD_BASE + 2,
    title: t('List gończy: wiedźma', 'Wanted: the witch'),
    text: t('Wiedźma rzuca uroki na bydło. Jej chata stoi na zaznaczonym fragmencie.', 'A witch curses the cattle. Her hut stands on the marked fragment.') },
  { id: 'lifeLeaf', kind: 'bring', hard: true, need: 1, what: 'lifeLeaf', xp: 12, gold: 6, item: 'bigLifePotion',
    title: t('Liść życia dla medyka', 'A leaf of life for the healer'),
    text: t('Medyk ratuje gorączkujące dziecko. Potrzebuje Liścia życia z gór lub znad jeziora.', 'The healer is saving a child with a fever. He needs a Leaf of life from the mountains or a lake.') },
  { id: 'rareOre', kind: 'bring', hard: true, need: 1, what: 'rareOre', xp: 12, gold: 6, item: 'iron-head',
    title: t('Rzadki kruszec', 'A rare metal'),
    text: t('Złotnik zamku szuka rzadkiego kruszcu: magmy, złota, srebra, diamentu lub kamienia szlachetnego.', 'The castle goldsmith seeks a rare metal: magma, gold, silver, diamond or a gemstone.') },
  { id: 'veteran', kind: 'fights', hard: true, need: 4, xp: 15, gold: 6, item: 'shield',
    title: t('Najemnik do straży', 'A sellsword for the watch'),
    text: t('Kapitan straży przyjmie tylko sprawdzonego wojownika. Wygraj {n} walki.', 'The watch captain takes only a proven fighter. Win {n} fights.') },
];

export const QUEST_BY_ID: Record<string, QuestTemplate> = Object.fromEntries(QUEST_TEMPLATES.map((q) => [q.id, q]));

/** How many quests a board posts: more in a city, one of them always hard there. */
export const BOARD_SIZE = { village: 2, city: 4 } as const;
/** A hero carries at most this many quests at once. */
export const MAX_QUESTS = 3;
/** A board puts up new quests in place of the taken ones after this many rounds. */
export const BOARD_REFRESH = 5;
