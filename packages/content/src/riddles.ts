import type { Text } from './types';

/** A riddle with a one-word answer, for the satyr. The answer is spelled from scattered letters. */
export interface Riddle {
  question: Text;
  answer: Text;
}

const r = (pl: string, en: string, apl: string, aen: string): Riddle => ({ question: { pl, en }, answer: { pl: apl, en: aen } });

export const RIDDLES: Riddle[] = [
  r('Im więcej z niej zabierasz, tym większa się staje.', 'The more you take from it, the bigger it grows.', 'DZIURA', 'HOLE'),
  r('Biegnie bez nóg, szumi bez ust, a z łóżka nigdy nie wstaje.', 'It runs without legs, murmurs without a mouth and never leaves its bed.', 'RZEKA', 'RIVER'),
  r('Ma zęby, a nie gryzie.', 'It has teeth but never bites.', 'GRZEBIEŃ', 'COMB'),
  r('Nocą przychodzą bez wołania, rano znikają bez kradzieży.', 'They come at night uncalled and are gone by morning, though nothing was stolen.', 'GWIAZDY', 'STARS'),
  r('Idzie za Tobą w słońcu, a ginie w ciemności.', 'It follows you in the sun and dies in the dark.', 'CIEŃ', 'SHADOW'),
  r('Im dłużej schnie, tym bardziej jest mokry.', 'The more it dries, the wetter it gets.', 'RĘCZNIK', 'TOWEL'),
  r('Odpowiada w górach Twoim głosem, choć nie ma ust.', 'It answers in the mountains with your voice, though it has no mouth.', 'ECHO', 'ECHO'),
  r('Pożera wszystko, co mu dasz, a gdy dasz mu pić, umiera.', 'It eats all you feed it, but give it a drink and it dies.', 'OGIEŃ', 'FIRE'),
  r('Ma jedno oko, ale nic nie widzi.', 'It has one eye but cannot see.', 'IGŁA', 'NEEDLE'),
  r('Ma głowę i ogon, ale nie ma ciała.', 'It has a head and a tail but no body.', 'MONETA', 'COIN'),
  r('Lekki jak piórko, a nawet siłacz nie utrzyma go dłużej niż chwilę.', 'Light as a feather, yet the strongest cannot hold it for long.', 'ODDECH', 'BREATH'),
  r('Ma góry bez kamieni, rzeki bez wody i miasta bez domów.', 'It has mountains without stone, rivers without water and towns without houses.', 'MAPA', 'MAP'),
  r('Łamiesz je, gdy tylko je nazwiesz.', 'You break it as soon as you name it.', 'CISZA', 'SILENCE'),
  r('Zawsze jest przed Tobą, a nigdy go nie dogonisz.', 'It is always ahead of you, yet you never catch it.', 'JUTRO', 'TOMORROW'),
  r('Wędrowiec nosi go na plecach, a w nim cały swój dom.', 'A wanderer carries it on their back, and their whole home inside it.', 'PLECAK', 'PACK'),
];

