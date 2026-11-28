import { HIGH_CARDS } from './cardsHigh';
import type { Profession, ProfessionId } from './types';

/**
 * Professions, two per race, each with its skill cards from the profession sheets: 3 at level 1, then 2 more at
 * levels 3, 5, 7 and 9 (11 in all; the higher ones live in cardsHigh.ts).
 */
export const PROFESSIONS: Record<ProfessionId, Profession> = {
  trapper: {
    id: 'trapper', race: 'nomads', mvp: true, name: { pl: 'Traper', en: 'Trapper' },
    cards: [
      { id: 'trapper-hunter', level: 1, name: { pl: 'Łowca', en: 'Hunter' }, summary: { pl: 'Każdy nieudany test polowania możesz raz powtórzyć.', en: 'Every failed hunting test may be rolled again once.' } },
      { id: 'trapper-trap', level: 1, combat: true, name: { pl: 'Zastawianie Pułapki', en: 'Set a Trap' }, summary: { pl: 'Na mapie za darmo, w walce za całą rundę. Wróg testuje Zr.; porażka = -4 Żyw. i unieruchomienie na rundę.', en: 'Free on the map, a whole round in a fight. Each foe tests Dexterity; on failure it loses 4 Vitality and is held for a round.' } },
      { id: 'trapper-precise-shot', level: 1, combat: true, name: { pl: 'Precyzyjny Strzał', en: 'Precise Shot' }, summary: { pl: 'Trafienie długim łukiem o 15+ = +2 obrażeń.', en: 'A longbow hit by 15 or more deals +2 damage.' } },
      { id: 'trapper-poison-arrow', level: 3, combat: true, name: { pl: 'Zatruta Strzała', en: 'Poisoned Arrow' }, summary: { pl: 'Dwa razy na walkę: strzał z łuku lub kuszy zatruwa trafionego wroga (−1 Żyw. co rundę, aż wyleczy się testem S.).', en: 'Twice a fight: a bow or crossbow shot poisons the foe it hits (−1 Vitality a round until it passes a Strength test).' } },
      { id: 'trapper-tannery', level: 3, name: { pl: 'Garbarnia', en: 'Tannery' }, summary: { pl: 'Udane polowanie daje skórę. 1 Wt. i test Int. robią element skórzanej zbroi na wybraną część ciała: głowa 1 skóra, korpus 2, ręce lub nogi po 1 na rękę lub nogę.', en: 'Each successful hunt gives a hide. 1 Stamina and an Int test make a leather piece for the part of the body you pick: head 1 hide, torso 2, arms or legs 1 for each arm or leg.' } },
    ],
  },
  elder: {
    id: 'elder', race: 'nomads', mvp: true, name: { pl: 'Starszy', en: 'Elder' },
    cards: [
      { id: 'elder-wisdom', level: 1, name: { pl: 'Mądrość Wieków', en: 'Wisdom of Ages' }, summary: { pl: 'Każdy nieudany test Int. powtarzasz raz.', en: 'Every failed Intelligence test is rolled again once.' } },
      { id: 'elder-nature', level: 1, name: { pl: 'Bliskość Natury', en: 'Close to Nature' }, summary: { pl: '1 Wt.: medytujesz, +10 do następnego testu cechy (odnawia się po obozowisku).', en: '1 Stamina: you meditate, +10 to your next attribute test (renews at camp).' } },
      { id: 'elder-herb', level: 1, name: { pl: 'Lecznicze Ziele', en: 'Healing Herb' }, summary: { pl: '1 Wt. (w walce cała runda): tamuje krwawienie, leczy zatrucie i +2 Żyw. (odnawia się po obozowisku).', en: '1 Stamina (in a fight, your round): stops bleeding, cures poison and heals 2 Vitality (renews at camp).' } },
      { id: 'elder-power-potion', level: 3, name: { pl: 'Mikstura Mocy', en: 'Potion of Might' }, summary: { pl: 'Na terenie zbieractwa: 1 Wt. i łatwy test Int. (+10) dają składnik, raz na fragment. 3 składniki = mikstura: +10 Zr., S. i Walki, +1 Wt. i +2 Żyw. na 2 rundy lub jedną walkę. Wypicie w walce zabiera rundę.', en: 'Where you can gather: 1 Stamina and an easy Int test (+10) find an ingredient, once a fragment. 3 ingredients make a potion: +10 Dex, Str and Combat, +1 Stamina and +2 Vitality for 2 rounds or one fight. Drinking it in a fight takes a round.' } },
      { id: 'elder-beast-master', level: 3, combat: true, name: { pl: 'Pan Bestii', en: 'Master of Beasts' }, summary: { pl: 'Bestia do 20 Żyw.: trudny test Ch. (−10) przejmuje ją i walczy po twojej stronie, póki co rundę zdajesz kolejny test (zwykły, potem łatwy +10). Porażka lub przerwa zrywa kontrolę. Trzy udane z rzędu = towarzysz.', en: 'A beast of up to 20 Vitality: a hard Cha test (−10) takes it over and it fights for you while you pass a test every round (normal, then easy +10). A failure or a skipped round breaks the hold. Three in a row make it a companion.' } },
    ],
  },
  diver: {
    id: 'diver', race: 'myrmids', mvp: true, name: { pl: 'Nurek', en: 'Diver' },
    cards: [
      { id: 'diver-fish', level: 1, name: { pl: 'Ryba', en: 'Fish' }, summary: { pl: 'Nieudany test łowiectwa na fragmencie z wodą lub test pływania możesz raz powtórzyć.', en: 'A failed hunt on a water fragment or a failed swim may be rolled again once.' } },
      { id: 'diver-waterborn', level: 1, name: { pl: 'Wodnik', en: 'Water-born' }, summary: { pl: '+10 do cech przy dostępie do wody.', en: '+10 to all attributes next to water.' } },
      { id: 'diver-blowpipe', level: 1, combat: true, name: { pl: 'Plujka', en: 'Blowpipe' }, summary: { pl: 'Zatruta strzałka (S-2), trafienie zatruwa.', en: 'Poison dart (Str-2); a hit poisons the target.' } },
      { id: 'diver-camouflage', level: 3, combat: true, name: { pl: 'Kamuflaż', en: 'Camouflage' }, summary: { pl: 'W 1. rundzie walki: test Zr. przeciw testowi Int. wrogów. Jeśli żaden cię nie zauważy, unikasz walki. Możesz potem odejść, ale nic więcej nie zrobisz na tym fragmencie.', en: 'In the 1st round of a fight: a Dex test against the foes\' Int tests. If none spots you, you avoid the fight. You may then leave, but do nothing else on this fragment.' } },
      { id: 'diver-fillet', level: 3, combat: true, name: { pl: 'Filetowanie', en: 'Filleting' }, summary: { pl: 'Trudny atak (−10). Trafienie otwiera głęboką ranę: −1 Żyw. co rundę, wróg traci akcję na test Zr., by ją zatamować; po 3 rundach się wykrwawia.', en: 'A hard attack (−10). A hit opens a deep wound: −1 Vitality a round, the foe spends its move on a Dexterity test to staunch it, and bleeds out after 3 rounds.' } },
    ],
  },
  gourmet: {
    id: 'gourmet', race: 'myrmids', mvp: true, name: { pl: 'Smakosz', en: 'Gourmet' },
    cards: [
      { id: 'gourmet-fish', level: 1, name: { pl: 'Ryba', en: 'Fish' }, summary: { pl: 'Nieudany test łowiectwa na fragmencie z wodą lub test pływania możesz raz powtórzyć.', en: 'A failed hunt on a water fragment or a failed swim may be rolled again once.' } },
      { id: 'gourmet-seasoning', level: 1, name: { pl: 'Przyprawianie', en: 'Seasoning' }, summary: { pl: 'Przyrządzając pożywienie dodajesz przyprawę: +5 do wybranej cechy na rundę po zjedzeniu (1 na rundę).', en: 'When you prepare food you season it: +5 to a chosen attribute for the round after eating (1 a round).' } },
      { id: 'gourmet-stew', level: 1, name: { pl: 'Lecznicza Potrawka', en: 'Healing Stew' }, summary: { pl: 'Test Int.: porcja staje się potrawką (max 3). Zjedzona leczy +2 Żyw.', en: 'Intelligence test: a portion becomes a stew (up to 3). Eaten, it heals 2 Vitality.' } },
      { id: 'gourmet-fisher', level: 3, name: { pl: 'Rybak', en: 'Fisher' }, summary: { pl: 'Na jeziorze i rzece: gdy polowanie się nie uda, próbujesz drugi raz. Tylko jedno udane polowanie, za to daje 2 pożywienia.', en: 'On a lake or river: if the hunt fails you try again. Only one hunt can succeed, and it brings 2 food.' } },
      { id: 'gourmet-shark-blade', level: 3, combat: true, name: { pl: 'Rekinie Ostrze', en: 'Shark Blade' }, summary: { pl: 'Co drugie trafienie tego samego wroga otwiera głęboką ranę (jak Filetowanie).', en: 'Every second hit on the same foe opens a deep wound (as Filleting).' } },
    ],
  },
  explorer: {
    id: 'explorer', race: 'humans', mvp: true, name: { pl: 'Odkrywca', en: 'Explorer' },
    cards: [
      { id: 'explorer-traveller', level: 1, name: { pl: 'Podróżnik', en: 'Traveller' }, summary: { pl: 'Co 2 nowe fragmenty odkryte w jednej turze = +1 PD.', en: 'Every 2 new fragments revealed in one turn give +1 XP.' } },
      { id: 'explorer-bandages', level: 1, name: { pl: 'Opatrunki', en: 'Bandages' }, summary: { pl: '1 Wt. (w walce cała tura): +2 Żyw. i tamuje krwawienie.', en: '1 Stamina (in a fight, your move): +2 Vitality and stops bleeding.' } },
      { id: 'explorer-disarm', level: 1, combat: true, name: { pl: 'Rozbrojenie', en: 'Disarm' }, summary: { pl: 'Atak na wroga z bronią białą; trafiony testuje Zr. Porażka = traci broń, póki nie wygra przeciwstawnego testu Zr.', en: 'An attack on a foe with a hand weapon; a foe hit tests Dexterity. On a failure it loses its weapon until it wins an opposed Dexterity test.' } },
      { id: 'explorer-direction', level: 3, name: { pl: 'Wyczucie Kierunku', en: 'Sense of Direction' }, summary: { pl: 'Każdy fragment, także trudny teren, kosztuje cię 1 Szybkości.', en: 'Every fragment, hard terrain too, costs you 1 Speed.' } },
      { id: 'explorer-smoke', level: 3, combat: true, name: { pl: 'Bomba Dymna', en: 'Smoke Bomb' }, summary: { pl: 'Ucieczka to jeden zwykły test Zr., bez testu wroga.', en: 'Fleeing is one plain Dexterity test, with no roll from the foe.' } },
    ],
  },
  warrior: {
    id: 'warrior', race: 'humans', mvp: true, name: { pl: 'Wojownik', en: 'Warrior' },
    cards: [
      { id: 'warrior-veteran', level: 1, combat: true, name: { pl: 'Weteran', en: 'Veteran' }, summary: { pl: 'Każda wygrana walka daje +1 PD.', en: 'Every fight won gives +1 XP.' } },
      { id: 'warrior-heavy-swing', level: 1, combat: true, name: { pl: 'Wyprowadzony Atak', en: 'Heavy Swing' }, summary: { pl: 'Walka -10, obrażenia +4.', en: 'Combat -10, damage +4.' } },
      { id: 'warrior-rations', level: 1, combat: true, name: { pl: 'Racje Bojowe', en: 'Battle Rations' }, summary: { pl: '3 racje na grę: pożywienie i +5 Walki oraz Siły na rundę.', en: '3 per game: counts as food and gives +5 Combat and Strength for a round.' } },
      { id: 'warrior-strategist', level: 3, combat: true, name: { pl: 'Strateg', en: 'Strategist' }, summary: { pl: 'Raz na walkę: runda analizy jednego wroga, potem +10 Walki przeciw wszystkim wrogom tego rodzaju do końca walki.', en: 'Once a fight: a round studying one foe, then +10 Combat against every foe of its kind until the fight ends.' } },
      { id: 'warrior-way', level: 3, name: { pl: 'Droga Wojownika', en: 'Way of the Warrior' }, summary: { pl: 'Tylko w obozie: 1 Wt., trening walki, +1 Walki na stałe.', en: 'Only at camp: 1 Stamina, a training session, +1 Combat for good.' } },
    ],
  },
  mystic: {
    id: 'mystic', race: 'sunborn', mvp: true, name: { pl: 'Mistyk', en: 'Mystic' },
    cards: [
      { id: 'mystic-seer', level: 1, name: { pl: 'Wieszcz', en: 'Seer' }, summary: { pl: 'Przy odkryciu fragmentu szansa 1/6 na +10 do cech.', en: 'On revealing a fragment, a 1 in 6 chance of +10 to all attributes.' } },
      { id: 'mystic-barrier', level: 1, combat: true, name: { pl: 'Bariera', en: 'Barrier' }, summary: { pl: 'Test Int.: bariera do końca walki, trafienie -50% obrażeń.', en: 'Intelligence test: a barrier for the fight; hits deal half damage.' } },
      { id: 'mystic-researcher', level: 1, name: { pl: 'Badacz', en: 'Researcher' }, summary: { pl: 'Przy obozowisku 1 Wt. = stałe +1 Int.', en: 'At camp, spend 1 Stamina for a permanent +1 Intelligence.' } },
      { id: 'mystic-vines', level: 3, combat: true, name: { pl: 'Czarne Pnącza', en: 'Black Vines' }, summary: { pl: 'Test Int.: pnącza oplatają wroga. Co rundę testuje S.; porażka = nie walczy wręcz, sukces = zrywa pnącza.', en: 'An Intelligence test: vines bind a foe. Each round it tests Strength; on a failure it cannot fight hand to hand, on a success it tears free.' } },
      { id: 'mystic-levitate', level: 3, name: { pl: 'Lewitacja', en: 'Levitation' }, summary: { pl: '1 Wt. i test Int. (odnawia się po obozowisku, także po porażce): do końca rundy trudny teren kosztuje 1 Szybkości, a rzekę przekraczasz bez pływania.', en: '1 Stamina and an Int test (renews at camp, even after a failure): until the round ends hard terrain costs 1 Speed and you cross rivers without swimming.' } },
    ],
  },
  guardian: {
    id: 'guardian', race: 'sunborn', mvp: true, name: { pl: 'Strażnik', en: 'Guardian' },
    cards: [
      { id: 'guardian-stance', level: 1, combat: true, name: { pl: 'Postawa Obronna', en: 'Defensive Stance' }, summary: { pl: 'Raz na walkę: przez rundę blokujesz każdy cios, ale nie atakujesz.', en: 'Once a fight: for a round you block every blow, but do not attack.' } },
      { id: 'guardian-riposte', level: 1, combat: true, name: { pl: 'Odpowiedź', en: 'Riposte' }, summary: { pl: 'W postawie obronnej odpowiadasz włócznią na każdy atak: Walka -10, siła S+1.', en: 'In the defensive stance you answer every attack with your spear: Combat -10, power S+1.' } },
      { id: 'guardian-hide', level: 1, combat: true, name: { pl: 'Twarda Skóra', en: 'Hard Hide' }, summary: { pl: 'Stały +1 pancerza na każdej lokacji ciała, ponad zbroję.', en: 'A permanent +1 armour on every part of the body, on top of armour.' } },
      { id: 'guardian-scalp', level: 3, combat: true, name: { pl: 'Skalp', en: 'Scalp' }, summary: { pl: 'Każda wygrana walka z danym rodzajem wroga daje na stałe kolejne +1 Walki przeciw niemu.', en: 'Every fight won against a kind of foe gives another +1 Combat against it for good.' } },
      { id: 'guardian-vigilance', level: 3, name: { pl: 'Czujność', en: 'Vigilance' }, summary: { pl: '+10 do testów Zr. w nagłych sytuacjach: inicjatywa, ucieczka i testy Zr. w zdarzeniach.', en: '+10 to Dexterity in sudden moments: initiative, fleeing and Dexterity tests in events.' } },
    ],
  },
  wraith: {
    id: 'wraith', race: 'keepers', mvp: true, name: { pl: 'Zjawa', en: 'Wraith' },
    cards: [
      { id: 'wraith-haste', level: 1, name: { pl: 'Przyspieszenie', en: 'Haste' }, summary: { pl: '+1 Szybkości do końca rundy (odnawia się po obozowisku).', en: '+1 Speed until the end of the round (renews at camp).' } },
      { id: 'wraith-critical', level: 1, combat: true, name: { pl: 'Punkt Krytyczny', en: 'Critical Point' }, summary: { pl: 'Każde 10 zapasu sukcesu = +1 obrażeń (max 4).', en: 'Each 10 points of success margin adds +1 damage (max 4).' } },
      { id: 'wraith-leaves', level: 1, name: { pl: 'Liście Świętego Drzewa', en: 'Sacred Tree Leaves' }, summary: { pl: '3 na grę: usuwa negatywne efekty i leczy 4 Żyw.', en: '3 per game: removes negative effects and heals 4 Vitality.' } },
      { id: 'wraith-mist', level: 3, combat: true, name: { pl: 'Zasłona Mgły', en: 'Veil of Mist' }, summary: { pl: 'Na 2 rundy: wrogowie −20 Walki (w drugiej −10) i −10 Zr., ty −10 Walki (odnawia się po obozowisku).', en: 'For 2 rounds: foes −20 Combat (−10 in the second) and −10 Dexterity, you −10 Combat (renews at camp).' } },
      { id: 'wraith-lookout', level: 3, name: { pl: 'Punkt Widokowy', en: 'Lookout' }, summary: { pl: 'W lesie: 1 Wt., wspinasz się na drzewo i odkrywasz sąsiednie fragmenty. Nie losują zdarzeń, a PD dostajesz dopiero, gdy na nie wejdziesz.', en: 'In a forest: 1 Stamina, you climb a tree and reveal the fragments around. They draw no events, and you get their XP only when you step there.' } },
    ],
  },
  druid: {
    id: 'druid', race: 'keepers', mvp: true, name: { pl: 'Druid', en: 'Druid' },
    cards: [
      { id: 'druid-herbalist', level: 1, name: { pl: 'Zielarz', en: 'Herbalist' }, summary: { pl: '+20 do testu Int. przy zbieraniu ziół i owoców.', en: '+20 to the Intelligence test when gathering herbs and fruit.' } },
      { id: 'druid-forest', level: 1, name: { pl: 'Siła Lasu', en: 'Strength of the Forest' }, summary: { pl: 'W lesie +20 do testów formowania magii (bariera, zwoje).', en: 'In a forest +20 to tests of shaping magic (barrier, scrolls).' } },
      { id: 'druid-companion', level: 1, combat: true, name: { pl: 'Towarzysz', en: 'Companion' }, summary: { pl: 'Bestia poniżej 10 Żyw.: test Ch. oswaja ją. 3 udane testy (co rundę) = towarzysz na zawsze. Max 2.', en: 'A beast under 10 Vitality: a Charisma test tames it. 3 passed tests (one a round) make it a companion for good. Up to 2.' } },
      { id: 'druid-teacher', level: 3, name: { pl: 'Nauczyciel', en: 'Teacher' }, summary: { pl: 'Tylko w obozie: 2 Wt. i test SW.: towarzysz dostaje +1 do wszystkich cech.', en: 'Only at camp: 2 Stamina and a Wil test give the companion +1 to all its attributes.' } },
      { id: 'druid-fangs', level: 3, combat: true, name: { pl: 'Kły', en: 'Fangs' }, summary: { pl: 'Bardzo trudny atak (−20), siła S−1. Trafienie wywołuje krwawienie (−1 Żyw. co rundę do udanego testu S., po 3 rundach śmierć), a wygrany przeciwstawny test S. rozrywa ciało: +4 Obr.', en: 'A very hard attack (−20), power S−1. A hit makes the foe bleed (−1 Vitality a round until it passes a Str test, death after 3 rounds), and a won opposed Str test tears it open: +4 damage.' } },
    ],
  },
  runemaster: {
    id: 'runemaster', race: 'flintborn', mvp: true, name: { pl: 'Runmistrz', en: 'Runemaster' },
    cards: [
      { id: 'runemaster-empower', level: 1, combat: true, name: { pl: 'Wzmocnienie Broni', en: 'Empowered Weapon' }, summary: { pl: '1 Wt. (w walce cała runda): na 3 rundy każde trafienie +2 Obr. (odnawia się po obozowisku).', en: '1 Stamina (in a fight, your round): for 3 rounds every hit deals +2 damage (renews at camp).' } },
      { id: 'runemaster-vise', level: 1, name: { pl: 'Imadło', en: 'Vise' }, summary: { pl: 'Nieudany test wydobycia surowców możesz raz powtórzyć.', en: 'A failed test for gathering materials may be rolled again once.' } },
      { id: 'runemaster-smelt', level: 1, name: { pl: 'Przetapianie', en: 'Smelting' }, summary: { pl: 'W mieście 3 sztuki broni lub zbroi przetapiasz na rudę żelaza albo nowy zwykły przedmiot.', en: 'In a city, melt 3 weapons or armour pieces into iron ore or a new common item.' } },
      { id: 'runemaster-safety-rune', level: 3, name: { pl: 'Runa Bezpieczeństwa', en: 'Rune of Safety' }, summary: { pl: '2 Wt.: runa na broni daje na stałe +20 do inicjatywy (zastępuje inną runę).', en: '2 Stamina: a rune on your weapon gives +20 to initiative for good (it replaces another rune).' } },
      { id: 'runemaster-reinforce', level: 3, name: { pl: 'Wzmocnienie', en: 'Reinforcement' }, summary: { pl: 'W mieście lub wiosce: 3 podstawowe surowce dają +1 pancerza noszonemu elementowi zbroi (raz na element, maks. 5). Nowy element trzeba wzmocnić osobno. Kończy rundę.', en: 'In a town or village: 3 basic materials give the worn armour piece +1 (once a piece, at most 5). A new piece needs its own reinforcing. Ends the round.' } },
    ],
  },
  cavedelver: {
    id: 'cavedelver', race: 'flintborn', mvp: true, name: { pl: 'Grotołaz', en: 'Cave Delver' },
    cards: [
      { id: 'cavedelver-strongman', level: 1, name: { pl: 'Siłacz', en: 'Strongman' }, summary: { pl: 'Stałe +10 do testów Siły.', en: 'Permanent +10 to Strength tests.' } },
      { id: 'cavedelver-craftsman', level: 1, name: { pl: 'Rzemieślnik', en: 'Craftsman' }, summary: { pl: '+10 do testów budowy.', en: '+10 to building tests.' } },
      { id: 'cavedelver-whirling-axe', level: 1, combat: true, name: { pl: 'Wirujący Topór', en: 'Whirling Axe' }, summary: { pl: 'Atak do 3 wrogów; każdy może uniknąć testem Zr.', en: 'Attack up to 3 enemies; each can dodge with a Dexterity test.' } },
      { id: 'cavedelver-caver', level: 3, name: { pl: 'Grotołaz', en: 'Caver' }, summary: { pl: '+10 do wszystkich cech na górach i w jaskiniach.', en: '+10 to all attributes in the mountains and in caves.' } },
      { id: 'cavedelver-blind', level: 3, combat: true, name: { pl: 'Oślepienie', en: 'Blinding Light' }, summary: { pl: 'Raz na walkę: światło kryształu. Każdy wróg testuje Zr.; porażka = −30 Walki i Zr. na rundę.', en: 'Once a fight: crystal light. Every foe tests Dex; a failure means −30 Combat and Dex for a round.' } },
    ],
  },
};

for (const p of Object.values(PROFESSIONS)) p.cards.push(...HIGH_CARDS[p.id]);

export const MVP_PROFESSIONS = Object.values(PROFESSIONS).filter((p) => p.mvp);
