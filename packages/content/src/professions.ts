import type { Profession, ProfessionId } from './types';

/**
 * Professions, two per race. The MVP ships one per race with its level 1 cards filled in;
 * the remaining cards (levels 3 to 9) and professions are added as data in later milestones.
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
  elder: { id: 'elder', race: 'nomads', mvp: false, name: { pl: 'Starszy', en: 'Elder' }, cards: [] },
  diver: {
    id: 'diver', race: 'myrmids', mvp: true, name: { pl: 'Nurek', en: 'Diver' },
    cards: [
      { id: 'diver-fish', level: 1, name: { pl: 'Ryba', en: 'Fish' }, summary: { pl: 'Nieudany test łowiectwa na fragmencie z wodą lub test pływania możesz raz powtórzyć.', en: 'A failed hunt on a water fragment or a failed swim may be rolled again once.' } },
      { id: 'diver-waterborn', level: 1, name: { pl: 'Wodnik', en: 'Water-born' }, summary: { pl: '+10 do cech przy dostępie do wody.', en: '+10 to all attributes next to water.' } },
      { id: 'diver-blowpipe', level: 1, combat: true, name: { pl: 'Plujka', en: 'Blowpipe' }, summary: { pl: 'Zatruta strzałka (S-2), trafienie zatruwa.', en: 'Poison dart (Str-2); a hit poisons the target.' } },
    ],
  },
  gourmet: { id: 'gourmet', race: 'myrmids', mvp: false, name: { pl: 'Smakosz', en: 'Gourmet' }, cards: [] },
  explorer: { id: 'explorer', race: 'humans', mvp: false, name: { pl: 'Odkrywca', en: 'Explorer' }, cards: [] },
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
  guardian: { id: 'guardian', race: 'sunborn', mvp: false, name: { pl: 'Strażnik', en: 'Guardian' }, cards: [] },
  wraith: {
    id: 'wraith', race: 'keepers', mvp: true, name: { pl: 'Zjawa', en: 'Wraith' },
    cards: [
      { id: 'wraith-haste', level: 1, name: { pl: 'Przyspieszenie', en: 'Haste' }, summary: { pl: '+1 Szybkości do końca rundy (odnawia się po obozowisku).', en: '+1 Speed until the end of the round (renews at camp).' } },
      { id: 'wraith-critical', level: 1, combat: true, name: { pl: 'Punkt Krytyczny', en: 'Critical Point' }, summary: { pl: 'Każde 10 zapasu sukcesu = +1 obrażeń (max 4).', en: 'Each 10 points of success margin adds +1 damage (max 4).' } },
      { id: 'wraith-leaves', level: 1, name: { pl: 'Liście Świętego Drzewa', en: 'Sacred Tree Leaves' }, summary: { pl: '3 na grę: usuwa negatywne efekty i leczy 4 Żyw.', en: '3 per game: removes negative effects and heals 4 Vitality.' } },
    ],
  },
  druid: { id: 'druid', race: 'keepers', mvp: false, name: { pl: 'Druid', en: 'Druid' }, cards: [] },
  runemaster: { id: 'runemaster', race: 'flintborn', mvp: false, name: { pl: 'Runmistrz', en: 'Runemaster' }, cards: [] },
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
