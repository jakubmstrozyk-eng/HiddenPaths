import type { Mission } from './types';

/** Mission cards: draw 4 at the start, keep 2. From the "Karty Misji" chapter. */
export const MISSIONS: Mission[] = [
  { id: 'specialist', name: { pl: 'Specjalizacja', en: 'Specialist' }, goal: { pl: 'Osiągnij +20 w dowolnej umiejętności.', en: 'Reach +20 in any skill.' }, xp: 50 },
  { id: 'warrior', name: { pl: 'Wojownik', en: 'Warrior' }, goal: { pl: 'Pokonaj 10 przeciwników.', en: 'Defeat 10 enemies.' }, xp: 60 },
  { id: 'discoverer', name: { pl: 'Odkrywca', en: 'Discoverer' }, goal: { pl: 'Odkryj 15 fragmentów.', en: 'Reveal 15 fragments.' }, xp: 40 },
  { id: 'master', name: { pl: 'Mistrz', en: 'Master' }, goal: { pl: 'Nałóż runę lub wykonaj ekspercki eliksir.', en: 'Apply a rune or brew an expert potion.' }, xp: 60 },
  { id: 'scout', name: { pl: 'Zwiadowca', en: 'Scout' }, goal: { pl: 'Eksploruj 5 jaskiń, budynków lub miejsc opuszczonych.', en: 'Explore 5 caves, buildings or abandoned places.' }, xp: 50 },
  { id: 'expert', name: { pl: 'Ekspert', en: 'Expert' }, goal: { pl: 'Osiągnij 70 punktów w cesze podstawowej.', en: 'Reach 70 in a base attribute.' }, xp: 60 },
  { id: 'hunter', name: { pl: 'Łowca', en: 'Hunter' }, goal: { pl: 'Wykonaj 10 udanych polowań.', en: 'Make 10 successful hunts.' }, xp: 40 },
  { id: 'gatherer', name: { pl: 'Zbieracz', en: 'Gatherer' }, goal: { pl: 'Zbierz 10 jedzenia, surowców lub ziół.', en: 'Gather 10 food, materials or herbs.' }, xp: 40 },
  { id: 'collector', name: { pl: 'Kolekcjoner', en: 'Collector' }, goal: { pl: 'Zdobądź 5 przedmiotów ze skrzyń i skarbów.', en: 'Find 5 items in chests and treasures.' }, xp: 40 },
  { id: 'magician', name: { pl: 'Magik', en: 'Magician' }, goal: { pl: 'Użyj 5 razy zwoju magii.', en: 'Use a magic scroll 5 times.' }, xp: 50 },
  { id: 'orator', name: { pl: 'Mówca', en: 'Orator' }, goal: { pl: '10 udanych testów plotkowania lub przekonywania.', en: '10 successful gossip or persuasion tests.' }, xp: 50 },
  { id: 'professional', name: { pl: 'Profesjonalista', en: 'Professional' }, goal: { pl: 'Użyj kart profesji 20 razy.', en: 'Use profession cards 20 times.' }, xp: 40 },
  { id: 'hero', name: { pl: 'Bohater', en: 'Hero' }, goal: { pl: 'Osiągnij 5 poziom.', en: 'Reach level 5.' }, xp: 50 },
];
