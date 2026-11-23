import type { Race, RaceId } from './types';

/** The six races, from the "Rasy" chapter of the Hidden Paths rules. */
export const RACES: Record<RaceId, Race> = {
  nomads: {
    id: 'nomads',
    name: { pl: 'Nomadzi', en: 'Nomads' },
    homeland: 'NE',
    attributes: { dex: 30, cha: 10, str: 20, wil: 20, int: 20, com: 20 },
    speed: 2,
    stamina: 3,
    vitality: 16,
    passives: [
      { pl: 'Test Zr., by odkryć 1 okoliczny fragment z pustki.', en: 'Dexterity test to reveal 1 nearby fragment from the void.' },
      { pl: 'Może wykonać 1 ruch bez pożywienia.', en: 'Can make 1 move without food.' },
    ],
  },
  myrmids: {
    id: 'myrmids',
    name: { pl: 'Myrmidzi', en: 'Myrmids' },
    homeland: 'SE',
    attributes: { dex: 30, cha: 20, str: 10, wil: 20, int: 20, com: 20 },
    speed: 2,
    stamina: 3,
    vitality: 14,
    passives: [
      { pl: 'Testy pływania i łowienia +20.', en: '+20 to swimming and fishing tests.' },
      { pl: 'Ulepszanie pożywienia: test Zr. i 1 Wt., spożycie daje +2 do cech.', en: 'Improve food: Dex test and 1 Stamina; eating it gives +2 to attributes.' },
      { pl: 'Poruszanie się po wodzie kosztuje 1 Wt.', en: 'Moving through water costs 1 Stamina.' },
    ],
  },
  humans: {
    id: 'humans',
    name: { pl: 'Ludzie', en: 'Humans' },
    homeland: 'S',
    attributes: { dex: 20, cha: 30, str: 20, wil: 20, int: 20, com: 10 },
    speed: 2,
    stamina: 3,
    vitality: 15,
    passives: [
      { pl: 'Jednorazowe przerzucenie testu interakcji z BN.', en: 'One reroll of a test when dealing with non-player characters.' },
      { pl: 'Broń palna od startu (S+2), ładowanie 1 runda, łatwy test Walki (+10).', en: 'Starts with a firearm (Str+2), 1 round to reload, easy Combat test (+10).' },
    ],
  },
  sunborn: {
    id: 'sunborn',
    name: { pl: 'Słoneczni', en: 'Sunborn' },
    homeland: 'SW',
    attributes: { dex: 15, cha: 15, str: 20, wil: 20, int: 30, com: 20 },
    speed: 2,
    stamina: 3,
    vitality: 17,
    passives: [
      { pl: 'Jedno pożywienie wystarcza na 2 rundy.', en: 'One food lasts 2 rounds.' },
      { pl: 'Raz na rundę ponowienie nieudanego testu Int.', en: 'Once per round, reroll a failed Intelligence test.' },
    ],
  },
  keepers: {
    id: 'keepers',
    name: { pl: 'Opiekunowie', en: 'Keepers' },
    homeland: 'W',
    attributes: { dex: 30, cha: 10, str: 20, wil: 20, int: 20, com: 20 },
    speed: 2,
    stamina: 3,
    vitality: 13,
    passives: [
      { pl: '+10 do zbierania ziół i roślin oraz +10 do cech w lesie.', en: '+10 to gathering herbs and plants, and +10 to attributes in forests.' },
      { pl: 'Raz na rundę ponowienie nieudanego testu Zr.', en: 'Once per round, reroll a failed Dexterity test.' },
    ],
  },
  flintborn: {
    id: 'flintborn',
    name: { pl: 'Krzemienni', en: 'Flintborn' },
    homeland: 'NW',
    attributes: { dex: 10, cha: 20, str: 30, wil: 20, int: 20, com: 20 },
    speed: 2,
    stamina: 3,
    vitality: 20,
    passives: [
      { pl: '+10 do zbierania surowców i ich obróbki (np. kowalstwo).', en: '+10 to gathering and working materials (such as smithing).' },
      { pl: 'Jednorazowe przerzucenie kości obrażeń.', en: 'One reroll of a damage die.' },
    ],
  },
};

export const RACE_IDS = Object.keys(RACES) as RaceId[];
