import type { RaceId, Text } from './types';

/** How a hero looks: one of a few heads, torsos and legs, drawn to fit the hero's race. */
export interface HeroLook {
  head: number;
  torso: number;
  legs: number;
  /** Colours picked by the player (#rrggbb); without them the race's own colours are used. */
  skin?: string;
  hair?: string;
  cloth?: string;
}
export const LOOK_OPTIONS = 5;
export const LOOK_COLOURS = ['skin', 'hair', 'cloth'] as const;

/** Skin tones offered for each race: the first is the race's own. */
export const SKIN_TONES: Record<RaceId, string[]> = {
  humans: ['#e8b796', '#f3d2b4', '#c98e62', '#9a6440', '#6a4028'],
  nomads: ['#d9a066', '#ecc08a', '#b8804a', '#8e5a30', '#6a4024'],
  myrmids: ['#5fb3b3', '#6ac0a0', '#5a9ad0', '#9ab8d0', '#4a8a7a'],
  sunborn: ['#c98a3a', '#dcac68', '#a86a2a', '#9a9a4a', '#b07850'],
  keepers: ['#b8e0a0', '#a8d0e8', '#ded6a8', '#8ac890', '#cdb0e8'],
  flintborn: ['#8a8f98', '#a69686', '#6a7080', '#b4aea6', '#7e6e8e'],
};
/** Colours for hair, fur, crests and the like. */
export const HAIR_COLOURS = ['#1a1410', '#4a2e1a', '#8a5a2a', '#c89048', '#ecdca0', '#b03a2a', '#e8e8f0', '#4a9a3a', '#3a5aa8', '#8a3aa8'];
/** Colours for the hero's clothes. */
export const CLOTH_COLOURS = ['#7a3b3b', '#2f5d7c', '#3f6b3a', '#8a6f3e', '#5a3a7a', '#a0802a', '#3a3a48', '#c8c0b0', '#a04a1a', '#2a7a7a'];
export const DEFAULT_LOOK: HeroLook = { head: 0, torso: 0, legs: 0 };

/** Names of the look options shown while creating a hero, per race. */
export const LOOK_NAMES: Record<RaceId, Record<'head' | 'torso' | 'legs', Text[]>> = {
  nomads: {
    head: [{ pl: 'Futrzany kaptur', en: 'Fur hood' }, { pl: 'Warkocze', en: 'Braids' }, { pl: 'Opaska zwiadowcy', en: "Scout's headband" }, { pl: 'Czub wojownika', en: "Warrior's topknot" }, { pl: 'Wilcza skóra', en: 'Wolf pelt' }],
    torso: [{ pl: 'Kurtka ze skór', en: 'Hide jacket' }, { pl: 'Płaszcz stepowy', en: 'Steppe cloak' }, { pl: 'Kamizelka z kłami', en: 'Fang vest' }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Futrzane buty', en: 'Fur boots' }, { pl: 'Owijacze', en: 'Wraps' }, { pl: 'Wysokie buty', en: 'Tall boots' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
  myrmids: {
    head: [{ pl: 'Płetwa grzbietowa', en: 'Dorsal fin' }, { pl: 'Wąsy suma', en: 'Catfish barbels' }, { pl: 'Koral we włosach', en: 'Coral crest' }, { pl: 'Latarnia głębin', en: 'Deep-sea lure' }, { pl: 'Skrzela i falbany', en: 'Gills and frills' }],
    torso: [{ pl: 'Łuski', en: 'Scales' }, { pl: 'Sieć rybacka', en: 'Fishing net' }, { pl: 'Pancerz z muszli', en: 'Shell armour' }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Płetwy', en: 'Flippers' }, { pl: 'Bose stopy', en: 'Bare feet' }, { pl: 'Owinięte wodorostem', en: 'Kelp wraps' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
  humans: {
    head: [{ pl: 'Krótkie włosy', en: 'Short hair' }, { pl: 'Długie włosy', en: 'Long hair' }, { pl: 'Kapelusz', en: 'Hat' }, { pl: 'Łysy z brodą', en: 'Bald and bearded' }, { pl: 'Kaptur', en: 'Hood' }],
    torso: [{ pl: 'Tunika', en: 'Tunic' }, { pl: 'Kolczuga', en: 'Mail shirt' }, { pl: 'Płaszcz mieszczanina', en: "Burgher's coat" }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Buty podróżne', en: 'Travel boots' }, { pl: 'Nagolenniki', en: 'Greaves' }, { pl: 'Sandały', en: 'Sandals' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
  sunborn: {
    head: [{ pl: 'Szakal', en: 'Jackal' }, { pl: 'Jaszczur', en: 'Lizard' }, { pl: 'Szakal w nemesie', en: 'Jackal in a headdress' }, { pl: 'Sokół', en: 'Falcon' }, { pl: 'Kobra', en: 'Cobra' }],
    torso: [{ pl: 'Szata kapłańska', en: 'Priestly robe' }, { pl: 'Złoty napierśnik', en: 'Gold breastplate' }, { pl: 'Przepaska pustynna', en: 'Desert wrap' }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Sandały', en: 'Sandals' }, { pl: 'Ogon jaszczura', en: 'Lizard tail' }, { pl: 'Owijacze', en: 'Wraps' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
  keepers: {
    head: [{ pl: 'Poroże', en: 'Antlers' }, { pl: 'Wieniec z liści', en: 'Leaf crown' }, { pl: 'Kaptur z mchu', en: 'Moss hood' }, { pl: 'Kapelusz grzyba', en: 'Mushroom cap' }, { pl: 'Wianek kwiatów', en: 'Flower wreath' }],
    torso: [{ pl: 'Kora', en: 'Bark' }, { pl: 'Płaszcz z liści', en: 'Leaf cloak' }, { pl: 'Pnącza', en: 'Vines' }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Korzenie', en: 'Roots' }, { pl: 'Bose stopy', en: 'Bare feet' }, { pl: 'Kopyta', en: 'Hooves' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
  flintborn: {
    head: [{ pl: 'Kamienne czoło', en: 'Stone brow' }, { pl: 'Hełm górnika', en: "Miner's helmet" }, { pl: 'Kryształowa korona', en: 'Crystal crown' }, { pl: 'Kamienna broda', en: 'Stone beard' }, { pl: 'Rogi i kryształ', en: 'Horns and crystal' }],
    torso: [{ pl: 'Skórzany fartuch', en: 'Leather apron' }, { pl: 'Kamienne płyty', en: 'Stone plates' }, { pl: 'Pas z narzędziami', en: 'Tool belt' }, { pl: 'Szata z pasem', en: 'Belted robe' }, { pl: 'Skórzana kamizelka', en: 'Leather vest' }],
    legs: [{ pl: 'Ciężkie buty', en: 'Heavy boots' }, { pl: 'Kamienne stopy', en: 'Stone feet' }, { pl: 'Okute buty', en: 'Iron-shod boots' }, { pl: 'Kilt', en: 'Kilt' }, { pl: 'Spodnie z nakolannikami', en: 'Trousers with knee pads' }],
  },
};

/** A colour scheme for the hero's dice. */
export interface DiceStyle {
  id: string;
  name: Text;
  /** Two colours for a gradient (the same twice for a plain die) and the colour of the pips and numbers. */
  from: string;
  to: string;
  ink: string;
}

export const DICE_STYLES: DiceStyle[] = [
  { id: 'bone', name: { pl: 'Kość', en: 'Bone' }, from: '#f4ecd8', to: '#d9cbaa', ink: '#2a2016' },
  { id: 'obsidian', name: { pl: 'Obsydian', en: 'Obsidian' }, from: '#2b2b35', to: '#0b0b10', ink: '#f4f2ff' },
  { id: 'ruby', name: { pl: 'Rubin', en: 'Ruby' }, from: '#ff5a6e', to: '#8a0f2a', ink: '#fff4f4' },
  { id: 'sapphire', name: { pl: 'Szafir', en: 'Sapphire' }, from: '#5ab4ff', to: '#1a3a8a', ink: '#f0f8ff' },
  { id: 'emerald', name: { pl: 'Szmaragd', en: 'Emerald' }, from: '#5ee0a0', to: '#0f6a44', ink: '#f0fff6' },
  { id: 'gold', name: { pl: 'Złoto', en: 'Gold' }, from: '#ffe27a', to: '#b07a12', ink: '#2a1a00' },
  { id: 'amethyst', name: { pl: 'Ametyst', en: 'Amethyst' }, from: '#c9a0ff', to: '#5a2a9a', ink: '#fff' },
  { id: 'void', name: { pl: 'Pustka', en: 'Void' }, from: '#8f7bff', to: '#1a0a3a', ink: '#e8e0ff' },
  { id: 'ember', name: { pl: 'Żar', en: 'Ember' }, from: '#ffb347', to: '#c2261a', ink: '#fff8e8' },
  { id: 'sea', name: { pl: 'Morska toń', en: 'Deep sea' }, from: '#7af0e0', to: '#0a4a6a', ink: '#f0ffff' },
  { id: 'frost', name: { pl: 'Szron', en: 'Frost' }, from: '#ffffff', to: '#9ec8e8', ink: '#123' },
  { id: 'jade', name: { pl: 'Jadeit', en: 'Jade' }, from: '#b8e8a0', to: '#3a7a3a', ink: '#0a200a' },
];
export const DICE_STYLE_IDS = DICE_STYLES.map((d) => d.id);

/** The style chosen for each kind of die. */
export interface DiceLook {
  d6: string;
  d10: string;
  d100: string;
  /** How the dice are finished: matte, polished, pearl or metal. */
  finish?: DiceFinish;
  /** What is cut into them: plain numbers, gold-inked numbers, runes on the sides, or a filigree edge. */
  engrave?: DiceEngraving;
  /** The box the dice are thrown into. */
  box?: string;
}

export type DiceFinish = 'matte' | 'gloss' | 'pearl' | 'metal';
export type DiceEngraving = 'plain' | 'inked' | 'runes' | 'filigree';
export const DICE_FINISHES: { id: DiceFinish; name: Text }[] = [
  { id: 'gloss', name: { pl: 'Połysk', en: 'Polished' } },
  { id: 'matte', name: { pl: 'Mat', en: 'Matte' } },
  { id: 'pearl', name: { pl: 'Perłowe', en: 'Pearl' } },
  { id: 'metal', name: { pl: 'Metaliczne', en: 'Metal' } },
];
export const DICE_ENGRAVINGS: { id: DiceEngraving; name: Text }[] = [
  { id: 'plain', name: { pl: 'Zwykłe cyfry', en: 'Plain numbers' } },
  { id: 'inked', name: { pl: 'Złocone żłobienia', en: 'Gold-inked engraving' } },
  { id: 'runes', name: { pl: 'Runy na ściankach', en: 'Runes on the sides' } },
  { id: 'filigree', name: { pl: 'Filigranowe krawędzie', en: 'Filigree edges' } },
];
/** Dice boxes: a frame of wood, leather, stone or crystal around a lining of felt or velvet. */
export const DICE_BOXES: { id: string; name: Text }[] = [
  { id: 'oak', name: { pl: 'Dębowa skrzynka, zielone sukno', en: 'Oak box, green baize' } },
  { id: 'ebony', name: { pl: 'Heban i srebro, karmazynowy aksamit', en: 'Ebony and silver, crimson velvet' } },
  { id: 'leather', name: { pl: 'Skóra podróżnika, granatowy filc', en: "Traveller's leather, navy felt" } },
  { id: 'stone', name: { pl: 'Kamień z Rozłamu, fioletowy aksamit', en: 'Rift stone, violet velvet' } },
  { id: 'bone', name: { pl: 'Kość i miedź, piaskowe płótno', en: 'Bone and copper, sand linen' } },
];
export const DEFAULT_DICE: DiceLook = { d6: 'bone', d10: 'obsidian', d100: 'void' };
