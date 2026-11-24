import type { Race, RaceId } from './types';

/** The six races, from the "Rasy" chapter of the Hidden Paths rules. */
export const RACES: Record<RaceId, Race> = {
  nomads: {
    id: 'nomads',
    name: { pl: 'Nomadzi', en: 'Nomads' },
    homeland: 'NE',
    blurb: { pl: 'Koczownicy stepów i tundr północnego wschodu. Wędrują w wielkich plemionach z karawanami i psimi towarzyszami. Świetni łowcy i zwiadowcy o bystrych oczach. W Utopii zbierali rzadkie zioła, garbowali skóry i wydobywali szlachetne kamienie.', en: 'Nomads of the north-eastern steppes and tundra. They travel in great tribes with caravans and dog companions. Fine hunters and scouts with sharp eyes. In Utopia they gathered rare herbs, tanned hides and mined precious stones.' },
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
    blurb: { pl: 'Rybi lud wysp i mórz południowego wschodu. Mieszkają w domach na palach lub w pływających budynkach i oddychają pod wodą. Serdeczni i pokojowi. W Utopii łowili, zbierali kamienie szlachetne i owoce morza.', en: 'A fish folk of the south-eastern islands and seas. They live in stilt houses or floating halls and breathe under water. Warm and peaceful. In Utopia they fished and gathered gems and seafood.' },
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
    blurb: { pl: 'Mieszkańcy wielkiego miasta na południu, pełnego cudów techniki. Świetni mówcy, wynalazcy i organizatorzy, charyzmatyczni i władczy. W Utopii odpowiadali za komunikację, transport, politykę między rasami oraz zboże i drewno.', en: 'People of the great southern city, full of wonders of technology. Fine speakers, inventors and organisers, charismatic and commanding. In Utopia they ran communication, transport, politics between the races, and grain and timber.' },
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
    blurb: { pl: 'Szakalo- i jaszczuroludzie z gorących pustyń i gęstych dżungli. Wycofani, a zarazem gwałtowni i uparci, inteligentni i zaawansowani technologicznie, oddani religii. W Utopii wydobywali rzadkie surowce i badali moc magiczną.', en: 'Jackal and lizard folk of hot deserts and thick jungles. Withdrawn yet fierce and stubborn, clever and advanced, devoted to their faith. In Utopia they mined rare resources and studied magical power.' },
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
    blurb: { pl: 'Duchy i patroni natury z puszcz i lasów zachodu. W sercu ich ziemi rośnie Święte Drzewo, a obok leży olbrzymie jezioro. Cisi i subtelni, zręczni i wyczuleni. W Utopii hodowali zioła i opiekowali się zwierzętami.', en: 'Spirits and patrons of nature from the western wilds and forests. The Sacred Tree grows at the heart of their land beside a vast lake. Quiet and subtle, nimble and keen. In Utopia they grew herbs and tended the animals.' },
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
    blurb: { pl: 'Wysocy, twardzi jak skała mieszkańcy gór północnego zachodu, w miastach wykutych w zboczach i połączonych tunelami. Świetni rzemieślnicy, otwarci, uparci i bardzo silni. W Utopii wydobywali i obrabiali surowce głębin.', en: 'Tall, rock-hard folk of the north-western mountains, in cities carved into the slopes and linked by tunnels. Master crafters, open, stubborn and very strong. In Utopia they mined and worked the riches of the deep.' },
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
