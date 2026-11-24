import type { RaceId, Text } from './types';

/** How a hero looks: one of a few heads, torsos and legs, drawn to fit the hero's race. */
export interface HeroLook {
  head: number;
  torso: number;
  legs: number;
}
export const LOOK_OPTIONS = 3;
export const DEFAULT_LOOK: HeroLook = { head: 0, torso: 0, legs: 0 };

/** Names of the look options shown while creating a hero, per race. */
export const LOOK_NAMES: Record<RaceId, Record<keyof HeroLook, Text[]>> = {
  nomads: {
    head: [{ pl: 'Futrzany kaptur', en: 'Fur hood' }, { pl: 'Warkocze', en: 'Braids' }, { pl: 'Opaska zwiadowcy', en: "Scout's headband" }],
    torso: [{ pl: 'Kurtka ze skór', en: 'Hide jacket' }, { pl: 'Płaszcz stepowy', en: 'Steppe cloak' }, { pl: 'Kamizelka z kłami', en: 'Fang vest' }],
    legs: [{ pl: 'Futrzane buty', en: 'Fur boots' }, { pl: 'Owijacze', en: 'Wraps' }, { pl: 'Wysokie buty', en: 'Tall boots' }],
  },
  myrmids: {
    head: [{ pl: 'Płetwa grzbietowa', en: 'Dorsal fin' }, { pl: 'Wąsy suma', en: 'Catfish barbels' }, { pl: 'Koral we włosach', en: 'Coral crest' }],
    torso: [{ pl: 'Łuski', en: 'Scales' }, { pl: 'Sieć rybacka', en: 'Fishing net' }, { pl: 'Pancerz z muszli', en: 'Shell armour' }],
    legs: [{ pl: 'Płetwy', en: 'Flippers' }, { pl: 'Bose stopy', en: 'Bare feet' }, { pl: 'Owinięte wodorostem', en: 'Kelp wraps' }],
  },
  humans: {
    head: [{ pl: 'Krótkie włosy', en: 'Short hair' }, { pl: 'Długie włosy', en: 'Long hair' }, { pl: 'Kapelusz', en: 'Hat' }],
    torso: [{ pl: 'Tunika', en: 'Tunic' }, { pl: 'Kolczuga', en: 'Mail shirt' }, { pl: 'Płaszcz mieszczanina', en: "Burgher's coat" }],
    legs: [{ pl: 'Buty podróżne', en: 'Travel boots' }, { pl: 'Nagolenniki', en: 'Greaves' }, { pl: 'Sandały', en: 'Sandals' }],
  },
  sunborn: {
    head: [{ pl: 'Szakal', en: 'Jackal' }, { pl: 'Jaszczur', en: 'Lizard' }, { pl: 'Szakal w nemesie', en: 'Jackal in a headdress' }],
    torso: [{ pl: 'Szata kapłańska', en: 'Priestly robe' }, { pl: 'Złoty napierśnik', en: 'Gold breastplate' }, { pl: 'Przepaska pustynna', en: 'Desert wrap' }],
    legs: [{ pl: 'Sandały', en: 'Sandals' }, { pl: 'Ogon jaszczura', en: 'Lizard tail' }, { pl: 'Owijacze', en: 'Wraps' }],
  },
  keepers: {
    head: [{ pl: 'Poroże', en: 'Antlers' }, { pl: 'Wieniec z liści', en: 'Leaf crown' }, { pl: 'Kaptur z mchu', en: 'Moss hood' }],
    torso: [{ pl: 'Kora', en: 'Bark' }, { pl: 'Płaszcz z liści', en: 'Leaf cloak' }, { pl: 'Pnącza', en: 'Vines' }],
    legs: [{ pl: 'Korzenie', en: 'Roots' }, { pl: 'Bose stopy', en: 'Bare feet' }, { pl: 'Kopyta', en: 'Hooves' }],
  },
  flintborn: {
    head: [{ pl: 'Kamienne czoło', en: 'Stone brow' }, { pl: 'Hełm górnika', en: "Miner's helmet" }, { pl: 'Kryształowa korona', en: 'Crystal crown' }],
    torso: [{ pl: 'Skórzany fartuch', en: 'Leather apron' }, { pl: 'Kamienne płyty', en: 'Stone plates' }, { pl: 'Pas z narzędziami', en: 'Tool belt' }],
    legs: [{ pl: 'Ciężkie buty', en: 'Heavy boots' }, { pl: 'Kamienne stopy', en: 'Stone feet' }, { pl: 'Okute buty', en: 'Iron-shod boots' }],
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
}
export const DEFAULT_DICE: DiceLook = { d6: 'bone', d10: 'obsidian', d100: 'void' };
