/** Text in every supported language. Polish is the source language of the rules. */
export type Text = { pl: string; en: string };
export type Locale = keyof Text;

export const ATTRIBUTES = ['dex', 'cha', 'str', 'wil', 'int', 'com'] as const;
/** dex = Zręczność, cha = Charyzma/Ogłada, str = Siła, wil = Siła Woli, int = Inteligencja, com = Walka */
export type Attribute = (typeof ATTRIBUTES)[number];
export type Attributes = Record<Attribute, number>;

/** Compass regions of the world, plus the void at the centre. */
export type Region = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';

export type RaceId = 'nomads' | 'myrmids' | 'humans' | 'sunborn' | 'keepers' | 'flintborn';

export interface Race {
  id: RaceId;
  name: Text;
  homeland: Region;
  attributes: Attributes;
  speed: number;
  stamina: number;
  vitality: number;
  passives: Text[];
}

export type ProfessionId =
  | 'trapper' | 'elder'
  | 'diver' | 'gourmet'
  | 'explorer' | 'warrior'
  | 'mystic' | 'guardian'
  | 'wraith' | 'druid'
  | 'runemaster' | 'cavedelver';

export interface ActionCard {
  id: string;
  level: 1 | 3 | 5 | 7 | 9;
  name: Text;
  summary: Text;
}

export interface Profession {
  id: ProfessionId;
  race: RaceId;
  name: Text;
  /** Part of the MVP (one profession per race). */
  mvp: boolean;
  cards: ActionCard[];
}

export type TerrainId =
  | 'forest' | 'mountains' | 'fields' | 'river' | 'lake' | 'desert'
  | 'inn' | 'monument' | 'cave' | 'village' | 'city';

export type TerrainAction =
  | 'hunt' | 'gather' | 'herbalism' | 'camp' | 'mine' | 'build' | 'swim'
  | 'meal' | 'stay' | 'gossip' | 'meditate' | 'market' | 'smith' | 'merchant'
  | 'quartermaster' | 'herbalist' | 'train' | 'scholar' | 'mystic' | 'board' | 'portal';

export interface Terrain {
  id: TerrainId;
  name: Text;
  /** How many of this fragment the original deck holds. */
  deckCount: number;
  /** Hard terrain costs 2 Speed to enter, easy terrain 1. */
  hard: boolean;
  actions: TerrainAction[];
  /** Whether entering a new fragment of this type draws an event card. */
  drawsEvent: boolean;
  /** Regions where this terrain is more common (map generator bias). */
  regions: Region[];
  /** True for settlements (safe places, respawn points). */
  settlement?: boolean;
}

export interface Mission {
  id: string;
  name: Text;
  goal: Text;
  xp: number;
}
