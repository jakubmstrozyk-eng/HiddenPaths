import type { Mission } from './types';

/**
 * Mission cards from the "Karty Misji" chapter, split as Jacob ruled on 24 Nov 2026: goals for one game,
 * with a number that grows with the map, and career goals counted across all of a hero's games.
 * At the start of a game 4 game goals are drawn and 2 kept; career goals are always on.
 */
export const MISSIONS: Mission[] = [
  { id: 'warrior', scope: 'game', targets: [3, 5, 7, 10], xp: 60, name: { pl: 'Wojownik', en: 'Warrior' }, goal: { pl: 'Pokonaj {n} przeciwników.', en: 'Defeat {n} enemies.' } },
  { id: 'discoverer', scope: 'game', targets: [15, 22, 30, 38], xp: 40, name: { pl: 'Odkrywca', en: 'Discoverer' }, goal: { pl: 'Odkryj {n} fragmentów.', en: 'Reveal {n} fragments.' } },
  { id: 'scout', scope: 'game', targets: [2, 3, 4, 5], xp: 50, name: { pl: 'Zwiadowca', en: 'Scout' }, goal: { pl: 'Zbadaj {n} jaskiń, budynków lub miejsc opuszczonych.', en: 'Explore {n} caves, buildings or abandoned places.' } },
  { id: 'hunter', scope: 'game', targets: [4, 6, 8, 10], xp: 40, name: { pl: 'Łowca', en: 'Hunter' }, goal: { pl: 'Wykonaj {n} udanych polowań.', en: 'Make {n} successful hunts.' } },
  { id: 'gatherer', scope: 'game', targets: [5, 7, 8, 10], xp: 40, name: { pl: 'Zbieracz', en: 'Gatherer' }, goal: { pl: 'Zbierz {n} jedzenia, surowców lub ziół.', en: 'Gather {n} food, materials or herbs.' } },
  { id: 'collector', scope: 'game', targets: [2, 3, 4, 5], xp: 40, name: { pl: 'Kolekcjoner', en: 'Collector' }, goal: { pl: 'Zdobądź {n} przedmiotów ze skrzyń i skarbów.', en: 'Find {n} items in chests and treasures.' } },
  { id: 'magician', scope: 'game', targets: [2, 3, 4, 5], xp: 50, name: { pl: 'Magik', en: 'Magician' }, goal: { pl: 'Użyj {n} razy zwoju magii.', en: 'Use a magic scroll {n} times.' } },
  { id: 'orator', scope: 'game', targets: [4, 6, 8, 10], xp: 50, name: { pl: 'Mówca', en: 'Orator' }, goal: { pl: '{n} udanych testów plotkowania lub przekonywania.', en: '{n} successful gossip or persuasion tests.' } },
  { id: 'specialist', scope: 'career', targets: 20, xp: 50, name: { pl: 'Specjalizacja', en: 'Specialist' }, goal: { pl: 'Osiągnij +{n} w dowolnej umiejętności.', en: 'Reach +{n} in any skill.' }, title: { pl: 'Specjalista', en: 'Specialist' } },
  { id: 'expert', scope: 'career', targets: 70, xp: 60, name: { pl: 'Ekspert', en: 'Expert' }, goal: { pl: 'Osiągnij {n} punktów w cesze podstawowej.', en: 'Reach {n} in a base attribute.' }, title: { pl: 'Ekspert', en: 'Expert' } },
  { id: 'master', scope: 'career', targets: 1, xp: 60, name: { pl: 'Mistrz', en: 'Master' }, goal: { pl: 'Nałóż runę lub wykonaj ekspercki eliksir.', en: 'Apply a rune or brew an expert potion.' }, title: { pl: 'Mistrz', en: 'Master' } },
  { id: 'professional', scope: 'career', targets: 20, xp: 40, name: { pl: 'Profesjonalista', en: 'Professional' }, goal: { pl: 'Użyj kart profesji {n} razy.', en: 'Use profession cards {n} times.' }, title: { pl: 'Profesjonalista', en: 'Professional' } },
  { id: 'hero', scope: 'career', targets: 5, xp: 50, name: { pl: 'Bohater', en: 'Hero' }, goal: { pl: 'Osiągnij {n} poziom.', en: 'Reach level {n}.' }, title: { pl: 'Bohater', en: 'Hero' } },
];

/** Goals drawn at the start of a game. Magician waits until magic scrolls are in the game. */
export const GAME_MISSIONS = MISSIONS.filter((m) => m.scope === 'game' && m.id !== 'magician');
export const CAREER_MISSIONS = MISSIONS.filter((m) => m.scope === 'career');
