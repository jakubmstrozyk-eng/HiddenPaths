import type { RiddlePool } from './eventTypes';
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

/** Words hidden in the books: each good reading spells one from its clue. */
const KNIGHT: Riddle[] = [
  r('Rycerz nosi go u pasa i dobywa w potrzebie.', 'A knight wears it at the belt and draws it in need.', 'MIECZ', 'SWORD'),
  r('Chroni ramię przed ciosem, a maluje się na niej herb.', 'It guards the arm from blows, and the coat of arms is painted on it.', 'TARCZA', 'SHIELD'),
  r('Czworonożny towarzysz rycerza w boju.', "The knight's four-legged companion in battle.", 'KOŃ', 'HORSE'),
  r('Długie drzewce do szarży na turnieju.', 'A long shaft for the charge at a tourney.', 'KOPIA', 'LANCE'),
  r('Stalowy strój, który dzwoni przy każdym kroku.', 'A steel suit that rings with every step.', 'ZBROJA', 'ARMOR'),
  r('Kamienny dom rycerza otoczony fosą.', "A knight's stone home ringed by a moat.", 'ZAMEK', 'CASTLE'),
  r('Rycerz broni go bardziej niż życia.', 'A knight guards it more than life.', 'HONOR', 'HONOR'),
  r('Znak rodu malowany na tarczy i chorągwi.', 'The sign of a house painted on shield and banner.', 'HERB', 'CREST'),
];

const JUGGLER: Riddle[] = [
  r('Kuglarz wyciąga go z kapelusza za uszy.', 'The juggler pulls it out of a hat by the ears.', 'KRÓLIK', 'RABBIT'),
  r('Talia ma ich pięćdziesiąt dwie.', 'A deck has fifty-two of them.', 'KARTY', 'CARDS'),
  r('Kolorowy materiał, pod którym znika moneta.', 'A bright cloth under which a coin disappears.', 'CHUSTA', 'SCARF'),
  r('Patyk, którym czarodziej stuka w kapelusz.', 'The stick a magician taps on the hat.', 'RÓŻDŻKA', 'WAND'),
  r('Sztuczka, która oszukuje oko.', 'A trick that fools the eye.', 'ILUZJA', 'ILLUSION'),
  r('Kuglarz go połyka na jarmarku, choć parzy.', 'The juggler swallows it at the fair, though it burns.', 'OGIEŃ', 'FIRE'),
  r('Okrzyk tłumu po udanej sztuczce.', 'What the crowd shouts after a good trick.', 'BRAWO', 'BRAVO'),
  r('Ciemna strona sceny, gdzie chowa się sekret.', 'The dark side of the stage where the secret hides.', 'KULISY', 'WINGS'),
];

const STONEMASON: Riddle[] = [
  r('Uderza w dłuto, aż sypią się iskry.', 'It strikes the chisel till sparks fly.', 'MŁOT', 'HAMMER'),
  r('Ostrze kamieniarza do rzeźbienia skały.', "The stonemason's blade for carving rock.", 'DŁUTO', 'CHISEL'),
  r('Biała skała na posągi, gładka jak mleko.', 'White stone for statues, smooth as milk.', 'MARMUR', 'MARBLE'),
  r('Szara, twarda skała na bruk i młyńskie koła.', 'Grey, hard stone for cobbles and millstones.', 'GRANIT', 'GRANITE'),
  r('Łączy kamienie w murze, a potem twardnieje.', 'It binds the stones of a wall and then hardens.', 'ZAPRAWA', 'MORTAR'),
  r('Kopie się ją w kopalni, a kowal przetapia.', 'It is dug in the mine and smelted by the smith.', 'RUDA', 'ORE'),
  r('Drogocenny kamień szlifowany przez jubilera.', 'A precious stone cut by the jeweller.', 'KLEJNOT', 'GEM'),
  r('Kamienny łuk nad bramą trzyma go jeden kamień.', 'One stone holds up the arch over a gate.', 'ZWORNIK', 'KEYSTONE'),
];

export const RIDDLE_POOLS: Record<RiddlePool, Riddle[]> = { riddles: RIDDLES, knight: KNIGHT, juggler: JUGGLER, stonemason: STONEMASON };
