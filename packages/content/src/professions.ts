import type { Profession, ProfessionId } from './types';

/**
 * Professions, two per race, each with its level 1 cards from the profession sheets.
 * The cards for levels 3 to 9 are added as data in later milestones.
 */
export const PROFESSIONS: Record<ProfessionId, Profession> = {
  trapper: {
    id: 'trapper', race: 'nomads', mvp: true, name: { pl: 'Traper', en: 'Trapper' },
    cards: [
      { id: 'trapper-hunter', level: 1, name: { pl: 'Łowca', en: 'Hunter' }, summary: { pl: 'Każdy nieudany test polowania możesz raz powtórzyć.', en: 'Every failed hunting test may be rolled again once.' } },
      { id: 'trapper-trap', level: 1, combat: true, name: { pl: 'Zastawianie Pułapki', en: 'Set a Trap' }, summary: { pl: 'Na mapie za darmo, w walce za całą rundę. Wróg testuje Zr.; porażka = -4 Żyw. i unieruchomienie na rundę.', en: 'Free on the map, a whole round in a fight. Each foe tests Dexterity; on failure it loses 4 Vitality and is held for a round.' } },
      { id: 'trapper-precise-shot', level: 1, combat: true, name: { pl: 'Precyzyjny Strzał', en: 'Precise Shot' }, summary: { pl: 'Trafienie długim łukiem o 15+ = +2 obrażeń.', en: 'A longbow hit by 15 or more deals +2 damage.' } },
    ],
  },
  elder: {
    id: 'elder', race: 'nomads', mvp: true, name: { pl: 'Starszy', en: 'Elder' },
    cards: [
      { id: 'elder-wisdom', level: 1, name: { pl: 'Mądrość Wieków', en: 'Wisdom of Ages' }, summary: { pl: 'Każdy nieudany test Int. powtarzasz raz.', en: 'Every failed Intelligence test is rolled again once.' } },
      { id: 'elder-nature', level: 1, name: { pl: 'Bliskość Natury', en: 'Close to Nature' }, summary: { pl: '1 Wt.: medytujesz, +10 do następnego testu cechy (odnawia się po obozowisku).', en: '1 Stamina: you meditate, +10 to your next attribute test (renews at camp).' } },
      { id: 'elder-herb', level: 1, name: { pl: 'Lecznicze Ziele', en: 'Healing Herb' }, summary: { pl: '1 Wt. (w walce cała runda): tamuje krwawienie, leczy zatrucie i +2 Żyw. (odnawia się po obozowisku).', en: '1 Stamina (in a fight, your round): stops bleeding, cures poison and heals 2 Vitality (renews at camp).' } },
    ],
  },
  diver: {
    id: 'diver', race: 'myrmids', mvp: true, name: { pl: 'Nurek', en: 'Diver' },
    cards: [
      { id: 'diver-fish', level: 1, name: { pl: 'Ryba', en: 'Fish' }, summary: { pl: 'Nieudany test łowiectwa na fragmencie z wodą lub test pływania możesz raz powtórzyć.', en: 'A failed hunt on a water fragment or a failed swim may be rolled again once.' } },
      { id: 'diver-waterborn', level: 1, name: { pl: 'Wodnik', en: 'Water-born' }, summary: { pl: '+10 do cech przy dostępie do wody.', en: '+10 to all attributes next to water.' } },
      { id: 'diver-blowpipe', level: 1, combat: true, name: { pl: 'Plujka', en: 'Blowpipe' }, summary: { pl: 'Zatruta strzałka (S-2), trafienie zatruwa.', en: 'Poison dart (Str-2); a hit poisons the target.' } },
    ],
  },
  gourmet: {
    id: 'gourmet', race: 'myrmids', mvp: true, name: { pl: 'Smakosz', en: 'Gourmet' },
    cards: [
      { id: 'gourmet-fish', level: 1, name: { pl: 'Ryba', en: 'Fish' }, summary: { pl: 'Nieudany test łowiectwa na fragmencie z wodą lub test pływania możesz raz powtórzyć.', en: 'A failed hunt on a water fragment or a failed swim may be rolled again once.' } },
      { id: 'gourmet-seasoning', level: 1, name: { pl: 'Przyprawianie', en: 'Seasoning' }, summary: { pl: 'Przyrządzając pożywienie dodajesz przyprawę: +5 do wybranej cechy na rundę po zjedzeniu (1 na rundę).', en: 'When you prepare food you season it: +5 to a chosen attribute for the round after eating (1 a round).' } },
      { id: 'gourmet-stew', level: 1, name: { pl: 'Lecznicza Potrawka', en: 'Healing Stew' }, summary: { pl: 'Test Int.: porcja staje się potrawką (max 3). Zjedzona leczy +2 Żyw.', en: 'Intelligence test: a portion becomes a stew (up to 3). Eaten, it heals 2 Vitality.' } },
    ],
  },
  explorer: {
    id: 'explorer', race: 'humans', mvp: true, name: { pl: 'Odkrywca', en: 'Explorer' },
    cards: [
      { id: 'explorer-traveller', level: 1, name: { pl: 'Podróżnik', en: 'Traveller' }, summary: { pl: 'Co 2 nowe fragmenty odkryte w jednej turze = +1 PD.', en: 'Every 2 new fragments revealed in one turn give +1 XP.' } },
      { id: 'explorer-bandages', level: 1, name: { pl: 'Opatrunki', en: 'Bandages' }, summary: { pl: '1 Wt. (w walce cała tura): +2 Żyw. i tamuje krwawienie.', en: '1 Stamina (in a fight, your move): +2 Vitality and stops bleeding.' } },
      { id: 'explorer-disarm', level: 1, combat: true, name: { pl: 'Rozbrojenie', en: 'Disarm' }, summary: { pl: 'Atak na wroga z bronią białą; trafiony testuje Zr. Porażka = traci broń, póki nie wygra przeciwstawnego testu Zr.', en: 'An attack on a foe with a hand weapon; a foe hit tests Dexterity. On a failure it loses its weapon until it wins an opposed Dexterity test.' } },
    ],
  },
  warrior: {
    id: 'warrior', race: 'humans', mvp: true, name: { pl: 'Wojownik', en: 'Warrior' },
    cards: [
      { id: 'warrior-veteran', level: 1, combat: true, name: { pl: 'Weteran', en: 'Veteran' }, summary: { pl: 'Każda wygrana walka daje +1 PD.', en: 'Every fight won gives +1 XP.' } },
      { id: 'warrior-heavy-swing', level: 1, combat: true, name: { pl: 'Wyprowadzony Atak', en: 'Heavy Swing' }, summary: { pl: 'Walka -10, obrażenia +4.', en: 'Combat -10, damage +4.' } },
      { id: 'warrior-rations', level: 1, combat: true, name: { pl: 'Racje Bojowe', en: 'Battle Rations' }, summary: { pl: '3 racje na grę: pożywienie i +5 Walki oraz Siły na rundę.', en: '3 per game: counts as food and gives +5 Combat and Strength for a round.' } },
    ],
  },
  mystic: {
    id: 'mystic', race: 'sunborn', mvp: true, name: { pl: 'Mistyk', en: 'Mystic' },
    cards: [
      { id: 'mystic-seer', level: 1, name: { pl: 'Wieszcz', en: 'Seer' }, summary: { pl: 'Przy odkryciu fragmentu szansa 1/6 na +10 do cech.', en: 'On revealing a fragment, a 1 in 6 chance of +10 to all attributes.' } },
      { id: 'mystic-barrier', level: 1, combat: true, name: { pl: 'Bariera', en: 'Barrier' }, summary: { pl: 'Test Int.: bariera do końca walki, trafienie -50% obrażeń.', en: 'Intelligence test: a barrier for the fight; hits deal half damage.' } },
      { id: 'mystic-researcher', level: 1, name: { pl: 'Badacz', en: 'Researcher' }, summary: { pl: 'Przy obozowisku 1 Wt. = stałe +1 Int.', en: 'At camp, spend 1 Stamina for a permanent +1 Intelligence.' } },
    ],
  },
  guardian: {
    id: 'guardian', race: 'sunborn', mvp: true, name: { pl: 'Strażnik', en: 'Guardian' },
    cards: [
      { id: 'guardian-stance', level: 1, combat: true, name: { pl: 'Postawa Obronna', en: 'Defensive Stance' }, summary: { pl: 'Raz na walkę: przez rundę blokujesz każdy cios, ale nie atakujesz.', en: 'Once a fight: for a round you block every blow, but do not attack.' } },
      { id: 'guardian-riposte', level: 1, combat: true, name: { pl: 'Odpowiedź', en: 'Riposte' }, summary: { pl: 'W postawie obronnej odpowiadasz włócznią na każdy atak: Walka -10, siła S+1.', en: 'In the defensive stance you answer every attack with your spear: Combat -10, power S+1.' } },
      { id: 'guardian-hide', level: 1, combat: true, name: { pl: 'Twarda Skóra', en: 'Hard Hide' }, summary: { pl: 'Stały +1 pancerza na każdej lokacji ciała, ponad zbroję.', en: 'A permanent +1 armour on every part of the body, on top of armour.' } },
    ],
  },
  wraith: {
    id: 'wraith', race: 'keepers', mvp: true, name: { pl: 'Zjawa', en: 'Wraith' },
    cards: [
      { id: 'wraith-haste', level: 1, name: { pl: 'Przyspieszenie', en: 'Haste' }, summary: { pl: '+1 Szybkości do końca rundy (odnawia się po obozowisku).', en: '+1 Speed until the end of the round (renews at camp).' } },
      { id: 'wraith-critical', level: 1, combat: true, name: { pl: 'Punkt Krytyczny', en: 'Critical Point' }, summary: { pl: 'Każde 10 zapasu sukcesu = +1 obrażeń (max 4).', en: 'Each 10 points of success margin adds +1 damage (max 4).' } },
      { id: 'wraith-leaves', level: 1, name: { pl: 'Liście Świętego Drzewa', en: 'Sacred Tree Leaves' }, summary: { pl: '3 na grę: usuwa negatywne efekty i leczy 4 Żyw.', en: '3 per game: removes negative effects and heals 4 Vitality.' } },
    ],
  },
  druid: {
    id: 'druid', race: 'keepers', mvp: true, name: { pl: 'Druid', en: 'Druid' },
    cards: [
      { id: 'druid-herbalist', level: 1, name: { pl: 'Zielarz', en: 'Herbalist' }, summary: { pl: '+20 do testu Int. przy zbieraniu ziół i owoców.', en: '+20 to the Intelligence test when gathering herbs and fruit.' } },
      { id: 'druid-forest', level: 1, name: { pl: 'Siła Lasu', en: 'Strength of the Forest' }, summary: { pl: 'W lesie +20 do testów formowania magii (bariera, zwoje).', en: 'In a forest +20 to tests of shaping magic (barrier, scrolls).' } },
      { id: 'druid-companion', level: 1, combat: true, name: { pl: 'Towarzysz', en: 'Companion' }, summary: { pl: 'Bestia poniżej 10 Żyw.: test Ch. oswaja ją. 3 udane testy (co rundę) = towarzysz na zawsze. Max 2.', en: 'A beast under 10 Vitality: a Charisma test tames it. 3 passed tests (one a round) make it a companion for good. Up to 2.' } },
    ],
  },
  runemaster: {
    id: 'runemaster', race: 'flintborn', mvp: true, name: { pl: 'Runmistrz', en: 'Runemaster' },
    cards: [
      { id: 'runemaster-empower', level: 1, combat: true, name: { pl: 'Wzmocnienie Broni', en: 'Empowered Weapon' }, summary: { pl: '1 Wt. (w walce cała runda): na 3 rundy każde trafienie +2 Obr. (odnawia się po obozowisku).', en: '1 Stamina (in a fight, your round): for 3 rounds every hit deals +2 damage (renews at camp).' } },
      { id: 'runemaster-vise', level: 1, name: { pl: 'Imadło', en: 'Vise' }, summary: { pl: 'Nieudany test wydobycia surowców możesz raz powtórzyć.', en: 'A failed test for gathering materials may be rolled again once.' } },
      { id: 'runemaster-smelt', level: 1, name: { pl: 'Przetapianie', en: 'Smelting' }, summary: { pl: 'W mieście 3 sztuki broni lub zbroi przetapiasz na rudę żelaza albo nowy zwykły przedmiot.', en: 'In a city, melt 3 weapons or armour pieces into iron ore or a new common item.' } },
    ],
  },
  cavedelver: {
    id: 'cavedelver', race: 'flintborn', mvp: true, name: { pl: 'Grotołaz', en: 'Cave Delver' },
    cards: [
      { id: 'cavedelver-strongman', level: 1, name: { pl: 'Siłacz', en: 'Strongman' }, summary: { pl: 'Stałe +10 do testów Siły.', en: 'Permanent +10 to Strength tests.' } },
      { id: 'cavedelver-craftsman', level: 1, name: { pl: 'Rzemieślnik', en: 'Craftsman' }, summary: { pl: '+10 do testów budowy.', en: '+10 to building tests.' } },
      { id: 'cavedelver-whirling-axe', level: 1, combat: true, name: { pl: 'Wirujący Topór', en: 'Whirling Axe' }, summary: { pl: 'Atak do 3 wrogów; każdy może uniknąć testem Zr.', en: 'Attack up to 3 enemies; each can dodge with a Dexterity test.' } },
    ],
  },
};

export const MVP_PROFESSIONS = Object.values(PROFESSIONS).filter((p) => p.mvp);
