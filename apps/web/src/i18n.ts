import { createContext, useContext } from 'react';
import type { Locale, Text } from '@hp/content';

const UI = {
  tagline: { pl: 'Świat pękł. Ścieżki są ukryte.', en: 'The world has cracked. The paths are hidden.' },
  newGame: { pl: 'Nowa gra', en: 'New game' },
  continue: { pl: 'Kontynuuj', en: 'Continue' },
  multiplayer: { pl: 'Gra wieloosobowa', en: 'Multiplayer' },
  settings: { pl: 'Ustawienia', en: 'Settings' },
  soon: { pl: 'wkrótce', en: 'coming soon' },
  noGames: { pl: 'Brak zapisanych gier', en: 'No saved games' },
  back: { pl: 'Wróć', en: 'Back' },
  next: { pl: 'Dalej', en: 'Next' },
  start: { pl: 'Rozpocznij wędrówkę', en: 'Begin the journey' },
  mapSize: { pl: 'Wielkość mapy', en: 'Map size' },
  difficulty: { pl: 'Trudność', en: 'Difficulty' },
  winMode: { pl: 'Cel gry', en: 'Goal' },
  fragments: { pl: 'fragmentów', en: 'fragments' },
  short: { pl: 'Krótka', en: 'Short' },
  medium: { pl: 'Średnia', en: 'Medium' },
  long: { pl: 'Długa', en: 'Long' },
  epic: { pl: 'Epicka', en: 'Epic' },
  easy: { pl: 'Łatwa', en: 'Easy' },
  normal: { pl: 'Normalna', en: 'Normal' },
  hard: { pl: 'Trudna', en: 'Hard' },
  nightmare: { pl: 'Koszmar', en: 'Nightmare' },
  stone: { pl: 'Kamień początku', en: 'Stone of Beginnings' },
  stoneInfo: { pl: 'Zdobądź kamień ze środka i zanieś go do miasta.', en: 'Take the stone from the centre back to a city.' },
  exploration: { pl: 'Eksploracja', en: 'Exploration' },
  explorationInfo: { pl: 'Odkryj wszystkie fragmenty.', en: 'Reveal every fragment.' },
  race: { pl: 'Rasa', en: 'Race' },
  profession: { pl: 'Profesja', en: 'Profession' },
  attributes: { pl: 'Cechy', en: 'Attributes' },
  pointsLeft: { pl: 'Punkty do rozdania', en: 'Points to spend' },
  missions: { pl: 'Misje: wybierz 2', en: 'Missions: keep 2' },
  name: { pl: 'Imię bohatera', en: 'Hero name' },
  speed: { pl: 'Szybkość', en: 'Speed' },
  stamina: { pl: 'Wytrzymałość', en: 'Stamina' },
  vitality: { pl: 'Żywotność', en: 'Vitality' },
  food: { pl: 'Pożywienie', en: 'Food' },
  gold: { pl: 'Złoto', en: 'Gold' },
  xp: { pl: 'PD', en: 'XP' },
  level: { pl: 'Poziom', en: 'Level' },
  round: { pl: 'Runda', en: 'Round' },
  camp: { pl: 'Obozowisko', en: 'Camp' },
  endTurn: { pl: 'Zakończ turę', en: 'End turn' },
  menu: { pl: 'Menu', en: 'Menu' },
  tapToMove: { pl: 'Dotknij sąsiedniego fragmentu, by wyruszyć.', en: 'Tap a neighbouring fragment to travel.' },
  eventSoon: { pl: 'Karta wydarzenia (wkrótce)', en: 'Event card (coming soon)' },
  hard_terrain: { pl: 'trudny teren', en: 'hard terrain' },
  dex: { pl: 'Zręczność', en: 'Dexterity' },
  cha: { pl: 'Charyzma', en: 'Charisma' },
  str: { pl: 'Siła', en: 'Strength' },
  wil: { pl: 'Siła Woli', en: 'Willpower' },
  int: { pl: 'Inteligencja', en: 'Intelligence' },
  com: { pl: 'Walka', en: 'Combat' },
} satisfies Record<string, Text>;

export type UiKey = keyof typeof UI;

export const LocaleContext = createContext<Locale>('en');

export function useT() {
  const locale = useContext(LocaleContext);
  return {
    locale,
    t: (key: UiKey) => UI[key][locale],
    tx: (text: Text) => text[locale],
  };
}
