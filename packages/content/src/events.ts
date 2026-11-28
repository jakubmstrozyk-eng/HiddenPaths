import { DUNGEON_CARDS } from './dungeons';
import type { EventCard, EventOption, Outcome, Puzzle, RiddlePool } from './eventTypes';
import type { Text } from './types';

const t = (pl: string, en: string): Text => ({ pl, en });
const opt = (label: Text, then: Outcome[], cost?: EventOption['cost']): EventOption => ({ label, then, ...(cost ? { cost } : {}) });

const GO = t('Dalej', 'Continue');
const LEAVE = t('Idę dalej', 'Walk on');
const FIGHT = t('Do walki!', 'Fight!');
const leave = opt(LEAVE, []);
const fightOnly = (enemies: string[], onWin: Outcome[] = []) => ({ start: { options: [opt(FIGHT, [{ do: 'fight', enemies, onWin }])] } });
const single = (then: Outcome[], label = GO) => ({ start: { options: [opt(label, then)] } });

const GHOST_FIGHT: Outcome[] = [{ do: 'fight', enemies: ['giantSpider'], onWin: [{ do: 'gold', amount: 2 }, { do: 'item', item: 'shortSword' }, { do: 'effect', target: 'com', amount: 10, rounds: 0, vs: 'beast' }] }];
const WITCH_SPELL: Outcome[] = [{ do: 'stuck', rounds: 1 }, { do: 'condition', id: 'enthralled', name: t('Zauroczenie', 'Enthralled'), test: 'wil', modifier: -5, worsen: -5, each: [{ do: 'stuck', rounds: 1 }] }];
const WITCH_FIGHT: Outcome[] = [{ do: 'fight', enemies: ['witch'], onWin: [{ do: 'herbs', amount: 4 }, { do: 'item', item: 'bookJuggler' }] }];

/**
 * The event cards in the MVP, from the "Karty Wydarzeń" chapter. Cards that other players
 * judged at the table (riddles, stories) are multiple choice here, as agreed in the plan.
 */
export const EVENTS: EventCard[] = [
  {
    id: 1, hostile: true,
    title: t('Posłaniec z zaświatów', 'Messenger from beyond'),
    text: t('Widzisz przed sobą niewyraźną humanoidalną postać, która unosi się w powietrzu i zawodzi tę samą melodię. Jeśli ją powtórzysz, duch się uspokoi i zdradzi sekret okolicy.', 'A blurred, human-like shape floats in the air before you, wailing the same tune. Sing it back and the ghost will calm down and tell you a secret of the land.'),
    steps: { start: { options: [
      opt(t('Powtarzam melodię (SW: wolniejsza melodia)', 'Sing the tune back (Wil: a slower tune)'), [{ do: 'puzzle', puzzle: {
        kind: 'sequence', theme: 'ghost', stat: 'wil', length: 4,
        byScore: [GHOST_FIGHT, GHOST_FIGHT, GHOST_FIGHT, GHOST_FIGHT, [{ do: 'peek' }, { do: 'xp', amount: 1 }, { do: 'gold', amount: 2 }]],
      } }]),
      opt(t('Opieram się zawodzeniu (SW +10)', 'Resist the wailing (Wil +10)'), [{
        do: 'test', attribute: 'wil', modifier: 10,
        fail: [{ do: 'effect', target: 'all', amount: -10, rounds: 2 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 2 }],
        pass: GHOST_FIGHT,
      }]),
    ] } },
  },
  {
    id: 2, hostile: false,
    title: t('Mędrzec', 'The sage'),
    text: t('Na swojej drodze spotykasz mędrca Opiekuna. Za drobną ofiarę oferuje Ci swoje nauki.', 'You meet a Keeper sage on the road. For a small offering he will teach you.'),
    steps: { start: { options: [
      opt(t('Daję 1 zł.', 'Give 1 gold'), [{ do: 'ifRace', race: 'keepers', then: [{ do: 'permanent', target: 'int', amount: 10 }], else: [{ do: 'permanent', target: 'int', amount: 5 }] }], { gold: 1 }),
      opt(t('Daję 3 pożywienia', 'Give 3 food'), [{ do: 'ifRace', race: 'keepers', then: [{ do: 'permanent', target: 'int', amount: 10 }], else: [{ do: 'permanent', target: 'int', amount: 5 }] }], { food: 3 }),
      opt(t('Rozmawiam z mędrcem (quiz, Int: więcej czasu)', 'Talk with the sage (quiz, Int: more time)'), [{ do: 'puzzle', puzzle: {
        kind: 'quiz', helper: { attribute: 'int', modifier: -10 }, stat: 'int', questions: 5, seconds: 15,
        byScore: [[], [], [], [{ do: 'xp', amount: 1 }], [{ do: 'xp', amount: 1 }], [{ do: 'xp', amount: 1 }, { do: 'permanent', target: 'int', amount: 5 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 3, hostile: true,
    title: t('Wataha wilków', 'Wolf pack'),
    text: t('Na swojej drodze spotykasz watahę wilków. Bestie są wyraźnie wygłodniałe. Szykuj się do walki!', 'A pack of wolves blocks your way, plainly starving. Get ready to fight!'),
    steps: fightOnly(['wolf', 'wolf', 'wolf']),
  },
  {
    id: 4, hostile: true,
    title: t('Mistral', 'Mistral'),
    text: t('Wiatr nagle nabiera prędkości i mocy. Świat ciemnieje, a wszystko co żywe szuka schronienia.', 'The wind suddenly gains speed and power. The world darkens and every living thing takes cover.'),
    steps: single([{ do: 'test', attribute: 'str', fail: [{ do: 'vitality', amount: -6 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 2 }] }], t('Stawiam czoła wichrowi (S)', 'Brace against the wind (Str)')),
  },
  {
    id: 5, hostile: false,
    title: t('Zagadka satyra', "The satyr's riddle"),
    text: t('Sędziwy satyr przeciąga się na kamieniu i proponuje grę: odgadnij jego zagadkę, zanim przesypie się klepsydra, a otrzymasz błogosławieństwo szczęścia. Pomyłka kosztuje 1 zł.', 'An ancient satyr stretches on a rock and offers a game: solve his riddle before the hourglass runs out and earn a blessing of luck. A wrong answer costs 1 gold.'),
    steps: { start: { options: [
      opt(t('Przyjmuję wyzwanie', 'Take the challenge'), [{ do: 'puzzle', puzzle: {
        kind: 'riddle', helper: { attribute: 'int' }, stat: 'int', seconds: 45, fastSeconds: 20,
        win: [{ do: 'effect', target: 'com', amount: 10, rounds: 5 }], fast: [{ do: 'xp', amount: 1 }], lose: [{ do: 'gold', amount: -1 }],
      } }]),
      leave,
    ] } },
  },
  {
    id: 6, hostile: false,
    title: t('Zaginiony kwiat Nomadów', 'Lost flower of the Nomads'),
    text: t('Niedaleko dostrzegasz przepiękny brunatny kwiat.', 'Not far away you notice a beautiful russet flower.'),
    steps: single([{
      do: 'test', attribute: 'int', raceBonus: { race: 'nomads', amount: 10 },
      pass: [{ do: 'effect', target: 'dex', amount: 10, rounds: 2 }, { do: 'effect', target: 'speed', amount: 1, rounds: 2 }, { do: 'vitality', amount: 2 }],
    }], t('Zrywam kwiat (Int)', 'Pick the flower (Int)')),
  },
  {
    id: 7, hostile: true,
    title: t('Ciemna materia', 'Dark matter'),
    text: t('Ciemna materia świata zaczyna się kurczyć na Twoich oczach. Pola wokół zapadają się w ciemność jedno po drugim. Dobiegnij do stabilnego brzegu!', 'The dark matter of the world shrinks before your eyes. The ground around you falls into darkness square by square. Reach the stable edge!'),
    steps: single([{ do: 'loseSpeed' }, { do: 'puzzle', puzzle: {
      kind: 'escape', theme: 'void', stat: 'dex',
      win: [{ do: 'move', direction: 'forward', distance: 1 }],
      lose: [{ do: 'stuck', rounds: 2 }],
    } }], t('Uciekam (Zr: ziemia zapada się wolniej)', 'Run (Dex: the ground falls slower)')),
  },
  {
    id: 8, hostile: false,
    title: t('Pomocna dłoń', 'A helping hand'),
    text: t('Młoda Słoneczna walczy zaciekle z pomniejszymi demonami czeluści. Pomożesz jej?', 'A young Sunborn is fighting lesser demons of the abyss. Will you help her?'),
    steps: { start: { options: [
      opt(t('Pomagam', 'Help her'), [{ do: 'fight', enemies: ['youngVoidDemon', 'youngVoidDemon'], onWin: [{ do: 'item', item: 'sunMedallion' }] }]),
      leave,
    ] } },
  },
  {
    id: 9, hostile: false,
    title: t('Portal', 'Portal'),
    text: t('Widzisz ciemną plamę czarnej materii, która wygląda jak kałuża. Na jej brzegu świecą runy: ułożone we właściwej kolejności wybiorą cel podróży.', 'A dark patch of black matter lies before you like a puddle. Runes glow on its rim: set in the right order, they choose where it takes you.'),
    steps: { start: { options: [
      opt(t('Układam runy na brzegu (zamek, Int: dodatkowa próba)', 'Set the runes on the rim (lock, Int: an extra try)'), [{ do: 'puzzle', puzzle: {
        kind: 'lock', helper: { attribute: 'int' }, stat: 'int', length: 3, symbols: 5, tries: 4,
        win: [{ do: 'goto', step: 'aim' }], lose: [{ do: 'move', direction: 'random', distance: 'd10' }],
      } }]),
      opt(t('Dotykam materii', 'Touch the matter'), [{ do: 'move', direction: 'forward', distance: 'd10' }]),
      leave,
    ] }, aim: {
      text: t('Tafla się wygładza i pokazuje okolicę jak w lustrze. Wskaż, dokąd chcesz trafić.', 'The surface smooths out and shows the land like a mirror. Point to where you want to go.'),
      options: [
        opt(t('3 pola przed siebie', '3 squares ahead'), [{ do: 'move', direction: 'forward', distance: 3 }]),
        opt(t('6 pól przed siebie', '6 squares ahead'), [{ do: 'move', direction: 'forward', distance: 6 }]),
        opt(t('3 pola w lewo', '3 squares left'), [{ do: 'move', direction: 'left', distance: 3 }]),
        opt(t('3 pola w prawo', '3 squares right'), [{ do: 'move', direction: 'right', distance: 3 }]),
      ],
    } },
  },
  {
    id: 10, hostile: true,
    title: t('Nawałnica', 'Tempest'),
    text: t('Atakuje Cię gwałtowna nawałnica. Wiatr, błyskawice i ulewa zdają się nie mieć końca.', 'A violent tempest breaks over you. Wind, lightning and rain seem endless.'),
    steps: single([{ do: 'test', attribute: 'str', fail: [{ do: 'vitality', amount: -4 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 1 }, { do: 'effect', target: 'all', amount: -10, rounds: 1 }] }], t('Przetrwam (S)', 'Endure it (Str)')),
  },
  {
    id: 11, hostile: true,
    title: t('Lawina', 'Landslide'),
    text: t('Teren okazuje się niestabilny. Nagle ucieka Ci grunt spod nóg. Złap się półek skalnych, gdy przelatują obok!', 'The ground is unstable. Suddenly it slides from under your feet. Grab the rock ledges as they rush past!'),
    steps: single([{ do: 'puzzle', puzzle: {
      kind: 'climb', theme: 'ledge', stat: 'dex', strikes: 2,
      byScore: [[{ do: 'halfVitality' }, { do: 'stuck', rounds: 1 }], [{ do: 'vitality', amount: -3 }], [{ do: 'xp', amount: 1 }]],
    } }], t('Łapię się półek (Zr: szersza strefa)', 'Grab the ledges (Dex: a wider zone)')),
  },
  {
    id: 12, hostile: false,
    title: t('Karawana', 'The caravan'),
    text: t('Na horyzoncie grupa bandytów napada na małą karawanę. Co robisz?', 'On the horizon, bandits are attacking a small caravan. What do you do?'),
    steps: { start: { options: [
      opt(t('Pomagam karawanie', 'Help the caravan'), [{ do: 'fight', enemies: ['bandit', 'bandit', 'bandit'], onWin: [{ do: 'gold', amount: 2 }, { do: 'item', item: 'protectiveAmulet' }, { do: 'xp', amount: 1 }] }]),
      opt(t('Pomagam bandytom', 'Help the bandits'), [{ do: 'fight', enemies: ['caravanDriver'], onWin: [{ do: 'gold', amount: 2 }] }]),
      leave,
    ] } },
  },
  {
    id: 13, hostile: false,
    title: t('Magiczny staw', 'The magic pond'),
    text: t('Kilka kroków dalej błyszczy mały staw o dziwnym czarnym kolorze. Twoje odbicie nie jest do końca Tobą: znajdź trzy różnice, zanim tafla zmętnieje.', 'A few steps away glimmers a small pond of a strange black colour. Your reflection in it is not quite you: find the three differences before the water clouds over.'),
    steps: { start: { options: [
      opt(t('Wpatruję się w odbicie (różnice, Int: więcej czasu)', 'Gaze at the reflection (differences, Int: more time)'), [{ do: 'puzzle', puzzle: {
        kind: 'differences', helper: { attribute: 'wil' }, stat: 'int', seconds: 25,
        byScore: [
          [{ do: 'effect', target: 'com', amount: -10, rounds: 2 }, { do: 'effect', target: 'dex', amount: -10, rounds: 2 }],
          [],
          [{ do: 'effect', target: 'com', amount: 10, rounds: 2 }, { do: 'effect', target: 'dex', amount: 10, rounds: 2 }],
          [{ do: 'effect', target: 'com', amount: 10, rounds: 3 }, { do: 'effect', target: 'dex', amount: 10, rounds: 3 }, { do: 'xp', amount: 1 }],
        ],
      } }]),
      opt(t('Wchodzę do stawu (S -20)', 'Wade in (Str -20)'), [{
        do: 'test', attribute: 'str', modifier: -20,
        pass: [{ do: 'permanent', target: 'maxVitality', amount: 2 }],
        fail: [{ do: 'vitality', amount: -4 }],
      }]),
      opt(t('Nie podchodzę', 'Keep away'), []),
    ] } },
  },
  {
    id: 14, hostile: false,
    title: t('Powidoki', 'Afterimages'),
    text: t('Niedaleko majaczy sylwetka młodej niewiasty. Nagle znika za jednym z trzech drzew, a drzewa zaczynają się przesuwać.', 'Nearby you glimpse the shape of a young woman. Suddenly she vanishes behind one of three trees, and the trees begin to move.'),
    steps: { start: { options: [
      opt(t('Śledzę ją między drzewami (Zr: wolniej się przesuwają)', 'Follow her between the trees (Dex: they move slower)'), [{ do: 'puzzle', puzzle: {
        kind: 'cups', theme: 'trees', stat: 'dex',
        win: [{ do: 'randomItem', rare: true }, { do: 'xp', amount: 1 }],
        lose: [{ do: 'fight', enemies: ['banshee'], onWin: [{ do: 'randomItem', rare: true }] }],
      } }]),
      opt(t('Zatrzymuję się (SW +10)', 'Stand still (Wil +10)'), [{
        do: 'test', attribute: 'wil', modifier: 10,
        fail: [{ do: 'effect', target: 'wil', amount: -10, rounds: 3 }, { do: 'effect', target: 'int', amount: -10, rounds: 3 }, { do: 'effect', target: 'cha', amount: -10, rounds: 3 }],
      }]),
      leave,
    ] } },
  },
  {
    id: 15, hostile: false,
    title: t('Wędrowny kupiec', 'The wandering merchant'),
    text: t('Wędrowny kupiec przez przypadek przekroczył granice materii. Za 3 porcje prowiantu oferuje Ci wzmocnione buty skórzane (pancerz 2 na nogi).', 'A wandering merchant has strayed past the edge of the matter. For 3 food he offers you reinforced leather boots (armour 2 on the legs).'),
    steps: {
      start: { options: [
        opt(t('Dzielę się prowiantem (3)', 'Share 3 food'), [{ do: 'item', item: 'reinforcedBoots' }], { food: 3 }),
        opt(t('Gram z nim w kości o cenę', 'Dice with him over the price'), [{ do: 'puzzle', puzzle: {
          kind: 'higherLower', helper: { attribute: 'cha', modifier: -10 }, stat: 'cha', rounds: 4,
          byScore: [[{ do: 'goto', step: 'full' }], [{ do: 'goto', step: 'full' }], [{ do: 'goto', step: 'cheap' }], [{ do: 'goto', step: 'cheap' }], [{ do: 'goto', step: 'gift' }]],
        } }]),
        leave,
      ] },
      cheap: { text: t('Kupiec zgadza się na 2 porcje.', 'The merchant agrees to 2 food.'), options: [opt(t('Daję 2 pożywienia', 'Give 2 food'), [{ do: 'item', item: 'reinforcedBoots' }], { food: 2 }), leave] },
      gift: { text: t('Kupiec śmieje się do łez. „Masz szczęście jak sam Opiekun! Bierz je za jedną porcję.”', 'The merchant laughs till he cries. "You have the luck of a Keeper! Take them for one portion."'), options: [opt(t('Daję 1 pożywienie', 'Give 1 food'), [{ do: 'item', item: 'reinforcedBoots' }], { food: 1 }), leave] },
      full: { text: t('Kupiec nie ustępuje.', 'The merchant will not budge.'), options: [opt(t('Daję 3 pożywienia', 'Give 3 food'), [{ do: 'item', item: 'reinforcedBoots' }], { food: 3 }), leave] },
    },
  },
  {
    id: 16, hostile: false,
    title: t('Owoc życia', 'Fruit of life'),
    text: t('Na szczycie stromego wzniesienia rośnie olbrzymie drzewo o złotych liściach i szkarłatnych owocach.', 'On top of a steep rise grows a huge tree with golden leaves and crimson fruit.'),
    steps: {
      start: { options: [
        opt(t('Wspinam się chwyt po chwycie', 'Climb hold by hold'), [{ do: 'puzzle', puzzle: {
          kind: 'climb', helper: { attribute: 'dex', modifier: -10 }, stat: 'dex', strikes: 4,
          byScore: [
            ...[0, 1, 2].map((): Outcome[] => [{ do: 'vitality', amount: -4 }, { do: 'effect', target: 'dex', amount: -10, rounds: 1 }, { do: 'effect', target: 'str', amount: -10, rounds: 1 }, { do: 'effect', target: 'com', amount: -10, rounds: 1 }, { do: 'goto', step: 'again' }]),
            [{ do: 'vitality', amount: -2 }, { do: 'permanent', target: 'maxVitality', amount: 2 }, { do: 'vitality', amount: 2 }, { do: 'move', direction: 'random', distance: 1 }],
            [{ do: 'permanent', target: 'maxVitality', amount: 2 }, { do: 'vitality', amount: 2 }, { do: 'move', direction: 'random', distance: 1 }],
          ],
        } }]),
        leave,
      ] },
      again: { text: t('Spadasz. Spróbujesz jeszcze raz?', 'You fall. Try again?'), options: [
        opt(t('Jeszcze raz (Zr -20)', 'Once more (Dex -20)'), [{
          do: 'test', attribute: 'dex', modifier: -20,
          pass: [{ do: 'permanent', target: 'maxVitality', amount: 2 }, { do: 'vitality', amount: 2 }, { do: 'move', direction: 'random', distance: 1 }],
          fail: [{ do: 'vitality', amount: -6 }, { do: 'effect', target: 'str', amount: -20, rounds: 3 }, { do: 'effect', target: 'dex', amount: -20, rounds: 3 }, { do: 'effect', target: 'com', amount: -20, rounds: 3 }, { do: 'effect', target: 'speed', amount: -1, rounds: 3 }],
        }]),
        leave,
      ] },
    },
  },
  {
    id: 17, hostile: false,
    title: t('Posąg spragniony wiedzy', 'The statue hungry for knowledge'),
    text: t('Przy drodze stoi posąg zamyślonego starca. Napis głosi: „wiedza jest moim pokarmem”. Gdy podchodzisz, kamienne oczy otwierają się i zadają Ci trzy pytania o ten świat.', 'By the road stands a statue of a thoughtful old man. The plaque says: "knowledge is my food". As you come closer, its stone eyes open and ask you three questions about this world.'),
    steps: { start: { options: [
      opt(t('Odpowiadam posągowi', 'Answer the statue'), [{ do: 'puzzle', puzzle: {
        kind: 'quiz', helper: { attribute: 'int' }, stat: 'int', questions: 3, seconds: 15,
        byScore: [[], [], [{ do: 'permanent', target: 'int', amount: 5 }], [{ do: 'permanent', target: 'int', amount: 5 }, { do: 'xp', amount: 1 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 18, hostile: false,
    title: t('Sarkofag', 'Sarcophagus'),
    text: t('Potykasz się o coś twardego wystającego z ziemi. To wieko sarkofagu.', 'You trip over something hard sticking out of the ground. It is the lid of a sarcophagus.'),
    steps: {
      open: {
        text: t('Wieko zsuwa się z hukiem. W środku warstwy bandaży, a pod nimi coś połyskuje. Im głębiej sięgniesz, tym więcej znajdziesz, ale gdzieś czai się klątwa. Jeśli ją obudzisz, stracisz łup, a mumia wstanie.', 'The lid slides off with a crash. Inside are layers of wrappings, and something glints below. The deeper you reach the more you find, but a curse lurks somewhere. Wake it and you lose the loot as the mummy rises.'),
        options: [opt(t('Sięgam do środka', 'Reach inside'), [{ do: 'puzzle', puzzle: {
          kind: 'dig', theme: 'tomb', helper: { attribute: 'str' }, stat: 'int', layers: 5, curses: 1,
          bottom: [{ do: 'item', item: 'pharaohAmulet' }],
          bust: [{ do: 'fight', enemies: ['mummy'], onWin: [{ do: 'randomItem' }] }],
        } }])],
      },
      start: { options: [
      opt(t('Otwieram (S)', 'Open it (Str)'), [{
        do: 'test', attribute: 'str',
        pass: [{ do: 'goto', step: 'open' }],
      }]),
      leave,
    ] } },
  },
  {
    id: 19, hostile: false,
    title: t('Szczęśliwa moneta', 'The lucky coin'),
    text: t('Myrmid kładzie na pniu trzy karty i pokazuje Ci Królową. „Znajdź ją po tasowaniu albo spróbuj mnie oszukać, a dostaniesz moją szczęśliwą monetę. Stawka: 1 zł.”', 'A Myrmid lays three cards on a stump and shows you the Queen. "Find her after the shuffle, or try to fool me, and my lucky coin is yours. The stake is 1 gold."'),
    steps: { start: { options: [
      opt(t('Gram uczciwie: śledzę Królową', 'Play fair: follow the Queen'), [{ do: 'puzzle', puzzle: {
        kind: 'cups', helper: { attribute: 'dex' }, stat: 'dex', win: [{ do: 'item', item: 'luckyCoin' }], lose: [{ do: 'gold', amount: -1 }],
      } }], { gold: 1 }),
      opt(t('Podmieniam kartę w rękawie (Zr -10)', 'Swap a card up my sleeve (Dex -10)'), [{
        do: 'test', attribute: 'dex', modifier: -10,
        pass: [{ do: 'item', item: 'luckyCoin' }],
        fail: [{ do: 'gold', amount: -3 }, { do: 'roll', die: 6, table: [{ upTo: 1, then: [{ do: 'fight', enemies: ['bandit'] }] }, { upTo: 6, then: [] }] }],
      }]),
      leave,
    ] } },
  },
  {
    id: 20, hostile: true,
    title: t('Pułapka', 'Ambush'),
    text: t('W ziemię przed Tobą wbija się strzała. Głos z ukrycia woła: rzuć broń i nie ruszaj się!', 'An arrow thuds into the ground before you. A hidden voice calls: drop your weapon and stand still!'),
    steps: { start: { options: [
      opt(t('Rzucam broń', 'Drop my weapon'), [{ do: 'loseAll' }, { do: 'stuck', rounds: 1 }]),
      opt(t('Uciekam (Zr -10, potem Zr)', 'Run (Dex -10, then Dex)'), [{
        do: 'test', attribute: 'dex', modifier: -10,
        pass: [{ do: 'test', attribute: 'dex', pass: [{ do: 'move', direction: 'back', distance: 1 }], fail: [{ do: 'vitality', amount: -3 }, { do: 'fight', enemies: ['bandit', 'bandit', 'bandit'], onWin: [{ do: 'gold', amount: 5 }, { do: 'randomItem' }] }] }],
        fail: [{ do: 'vitality', amount: -3 }, { do: 'fight', enemies: ['bandit', 'bandit', 'bandit'], onWin: [{ do: 'gold', amount: 5 }, { do: 'randomItem' }] }],
      }]),
      opt(t('Walczę (Zr -10)', 'Fight (Dex -10)'), [{ do: 'test', attribute: 'dex', modifier: -10, fail: [{ do: 'vitality', amount: -3 }] }, { do: 'fight', enemies: ['bandit', 'bandit', 'bandit'], onWin: [{ do: 'gold', amount: 5 }, { do: 'randomItem' }] }]),
    ] } },
  },
  {
    id: 21, hostile: true,
    title: t('Demon', 'Demon'),
    text: t('Przed Tobą pojawia się w pełni rozwinięty demon czeluści. Szykuj się do walki!', 'A full-grown demon of the abyss appears before you. Get ready to fight!'),
    steps: fightOnly(['voidDemon']),
  },
  {
    id: 22, hostile: false,
    title: t('Księga I', 'Book I'),
    text: t('Wśród wraków karawany kupieckiej znajdujesz zdobioną księgę: Księgę Wiedzy Rycerskiej. Czytaj ją raz na rundę: każda lektura to słowo do odszyfrowania z rozsypanych liter. 3 udane lektury dają +5 do Walki.', 'Among the wrecks of a merchant caravan you dig out an ornate book: the Book of Knightly Lore. Read it once a round: each reading is a word to decode from scattered letters. 3 good readings give +5 Combat.'),
    steps: single([{ do: 'item', item: 'bookKnight' }], t('Zabieram księgę', 'Take the book')),
  },
  {
    id: 23, hostile: false, terrains: ['cave'],
    title: t('Jaskinia', 'The cave'),
    text: t('Dostrzegasz w oddali wejście do jaskini.', 'In the distance you spot the mouth of a cave.'),
    steps: { start: { options: [
      opt(t('Wchodzę', 'Go in'), [{ do: 'roll', die: 10, table: [
        { upTo: 2, then: [{ do: 'fightRandom' }] },
        { upTo: 4, then: [{ do: 'camp' }] },
        { upTo: 6, then: [] },
        { upTo: 8, then: [{ do: 'camp' }, { do: 'test', attribute: 'dex', pass: [{ do: 'herbs', amount: 2 }] }] },
        { upTo: 10, then: [{ do: 'camp' }, { do: 'test', attribute: 'int', pass: [{ do: 'randomItem' }, { do: 'gold', amount: 5 }] }] },
      ] }]),
      leave,
    ] } },
  },
  {
    id: 24, hostile: true,
    title: t('Śpiew czarownicy', "The witch's song"),
    text: t('Nagle słyszysz głęboki, przejmujący kobiecy śpiew. Nuć kontrmelodię: każdy dobry ton osłabia urok.', "Suddenly you hear a deep, haunting woman's song. Hum a counter-tune: every right note weakens the spell."),
    steps: single([{ do: 'puzzle', puzzle: {
      kind: 'sequence', theme: 'witch', stat: 'wil', length: 5,
      byScore: [WITCH_SPELL, WITCH_SPELL, WITCH_SPELL, [{ do: 'stuck', rounds: 1 }], [{ do: 'stuck', rounds: 1 }], WITCH_FIGHT],
    } }], t('Nucę kontrmelodię (SW: wolniejszy śpiew)', 'Hum a counter-tune (Wil: a slower song)')),
  },
  {
    id: 25, hostile: false,
    title: t('Banda', 'The band'),
    text: t('Widzisz blask ognia i słyszysz głosy rozmów.', 'You see firelight and hear voices talking.'),
    steps: {
      start: { options: [
        opt(t('Zakradam się (Zr)', 'Sneak closer (Dex)'), [{ do: 'test', attribute: 'dex', pass: [{ do: 'goto', step: 'camp' }], fail: [{ do: 'goto', step: 'spotted' }] }]),
        opt(t('Podchodzę otwarcie', 'Walk up openly'), [{ do: 'goto', step: 'camp' }]),
        leave,
      ] },
      camp: {
        text: t('Pięciu Nomadów pije i rozmawia przy ognisku, nad którym smaży się dziczyzna.', 'Five Nomads drink and talk by a fire with game roasting over it.'),
        options: [
          opt(t('Zagaduję (Ch)', 'Talk to them (Cha)'), [{ do: 'test', attribute: 'cha', raceBonus: { race: 'nomads', amount: 10 }, pass: [{ do: 'camp' }, { do: 'food', amount: 1 }, { do: 'effect', target: 'all', amount: 5, rounds: 1 }, { do: 'goto', step: 'learn' }], fail: [{ do: 'goto', step: 'spotted' }] }]),
          leave,
        ],
      },
      spotted: {
        text: t('Nomadzi celują do Ciebie z łuków i nie chcą Ci zaufać.', 'The Nomads aim their bows at you and will not trust you.'),
        options: [
          opt(FIGHT, [{ do: 'fight', enemies: ['nomadWarrior', 'nomadWarrior', 'nomadWarrior', 'nomadWarrior', 'nomadWarrior'], onWin: [{ do: 'gold', amount: 10 }, { do: 'item', item: 'longBow' }, { do: 'food', amount: 5 }] }]),
          opt(t('Odchodzę', 'Back away'), []),
        ],
      },
      learn: {
        text: t('Dołączasz do ogniska. Możesz spróbować nauczyć się czegoś od Nomadów.', 'You join the fire. You could try to learn something from the Nomads.'),
        options: [opt(t('Słucham opowieści łowców (Ch)', 'Listen to the hunters (Cha)'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'skill', skill: 'hunt', amount: 5 }] }]), opt(GO, [])],
      },
    },
  },
  {
    id: 26, hostile: false,
    title: t('Księga II', 'Book II'),
    text: t('Pod korzeniami starego drzewa znajdujesz Księgę Magii Kuglarskiej. Czytaj ją raz na rundę: każda lektura to słowo do odszyfrowania z rozsypanych liter. 3 udane lektury dają +5 do Siły Woli i Charyzmy.', 'Under the roots of an old tree you find the Book of Juggler\'s Magic. Read it once a round: each reading is a word to decode from scattered letters. 3 good readings give +5 Willpower and Charisma.'),
    steps: single([{ do: 'item', item: 'bookJuggler' }], t('Zabieram księgę', 'Take the book')),
  },
  {
    id: 27, hostile: true,
    title: t('Koszmar', 'Nightmare'),
    text: t('We śnie nawiedza Cię bardzo realny koszmar, który kończy się Twoją śmiercią.', 'In your sleep a vivid nightmare haunts you, and it ends with your death.'),
    steps: single([{
      do: 'test', attribute: 'wil',
      fail: [{ do: 'effect', target: 'all', amount: -10, rounds: 1 }, { do: 'condition', id: 'nightmare', name: t('Koszmar', 'Nightmare'), test: 'wil', each: [{ do: 'effect', target: 'all', amount: -10, rounds: 1 }] }],
    }], t('Budzę się (SW)', 'Wake up (Wil)')),
  },
  {
    id: 28, hostile: true,
    title: t('Zaraza', 'Plague'),
    text: t('Wkraczasz na teren starożytnych katakumb. Powietrze jest ciężkie od zarazy.', 'You walk into the remains of ancient catacombs. The air is heavy with plague.'),
    steps: single([{
      do: 'test', attribute: 'str',
      fail: [{ do: 'vitality', amount: -4 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 1 }, { do: 'condition', id: 'plague', name: t('Zaraza', 'Plague'), test: 'str', each: [{ do: 'vitality', amount: -4 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }],
    }], t('Opieram się zarazie (S)', 'Fight off the sickness (Str)')),
  },
  {
    id: 29, hostile: false,
    title: t('Runiczny kowal', 'The runic smith'),
    text: t('Skałogrzmot w stroju kowala oferuje nałożenie runy na Twoją broń za 6 zł., ale najpierw pyta, jaki jest Twój cel w życiu.', 'A Flintborn in a smith\'s apron offers to set a rune on your weapon for 6 gold, but first he asks about your purpose in life.'),
    steps: {
      start: { options: [
        opt(t('„Chronić swoich bliskich”', '"To protect the ones I love"'), [{ do: 'goto', step: 'forge' }]),
        opt(t('„Zdobyć władzę nad światem”', '"To rule the world"'), [{ do: 'goto', step: 'refused' }]),
        leave,
      ] },
      refused: { text: t('Kowal odwraca się do paleniska. „Nie kuję dla tyranów.”', 'The smith turns back to his forge. "I do not forge for tyrants."'), options: [leave] },
      forge: {
        text: t('Kowal kiwa głową i podaje Ci młot. „Runę wykuwamy razem. Uderzaj, gdy stal rozbłyśnie. Trzy celne ciosy i sam wybierzesz runę.”', 'The smith nods and hands you a hammer. "We forge the rune together. Strike when the steel flares. Three true blows and you choose the rune yourself."'),
        options: [
          opt(t('Płacę i kuję', 'Pay and forge'), [{ do: 'puzzle', puzzle: {
            kind: 'forge', helper: { attribute: 'str' }, stat: 'str', strikes: 3,
            byScore: [
              [{ do: 'gold', amount: 3 }],
              [{ do: 'roll', die: 10, table: [{ upTo: 4, then: [{ do: 'gold', amount: 3 }] }, { upTo: 10, then: [{ do: 'rune' }] }] }],
              [{ do: 'rune' }],
              [{ do: 'goto', step: 'choose' }],
            ],
          } }], { gold: 6 }),
          leave,
        ],
      },
      choose: {
        text: t('Stal śpiewa pod młotem. „Mistrzowska robota! Którą runę wykuć?”', 'The steel sings under the hammer. "Masterly work! Which rune shall it be?"'),
        options: [
          opt(t('Zatruta: przeciwnik traci 1 Żyw. co rundę', 'Venom: the foe loses 1 Vitality each round'), [{ do: 'rune', rune: 'venom' }]),
          opt(t('Ostra: +1 obrażeń na pancerz', 'Sharp: +1 damage against armour'), [{ do: 'rune', rune: 'sharp' }]),
          opt(t('Precyzyjna: +5 do Walki tą bronią', 'Precise: +5 Combat with this weapon'), [{ do: 'rune', rune: 'precise' }]),
          opt(t('Porażająca: ogłusza przy 3. trafieniu', 'Stunning: stuns on the 3rd hit'), [{ do: 'rune', rune: 'stunning' }]),
          opt(t('Przebijająca: omija pancerz', 'Piercing: goes through armour'), [{ do: 'rune', rune: 'piercing' }]),
        ],
      },
    },
  },
  {
    id: 30, hostile: true,
    title: t('Minotaur', 'Minotaur'),
    text: t('Drogę zastępuje Ci pół-człowiek, pół-byk. W jego oczach widzisz zwierzęcy szał. Przygotuj się do walki!', 'A half-man, half-bull bars your way, wild fury in its eyes. Get ready to fight!'),
    steps: fightOnly(['minotaur'], [{ do: 'item', item: 'minotaurAxe' }]),
  },
  {
    id: 31, hostile: false,
    title: t('Rozpadająca się chata', 'The crumbling hut'),
    text: t('Przed Tobą stoi stary, rozpadający się budynek. Wygląda jak zamieszkana szopa.', 'Before you stands an old, crumbling building. It looks like a lived-in shed.'),
    steps: { start: { options: [
      opt(t('Przeszukuję półkę po półce (Int: słyszysz trzeszczenie stropu)', 'Search shelf by shelf (Int: you hear the roof creak)'), [{ do: 'puzzle', puzzle: {
        kind: 'dig', theme: 'hut', helper: { attribute: 'dex' }, stat: 'int', layers: 5, curses: 1,
        bust: [{ do: 'vitality', amount: -6 }, { do: 'effect', target: 'all', amount: -10, rounds: 2 }],
        bottom: [{ do: 'randomItem' }, { do: 'gold', amount: 2 }],
      } }]),
      leave,
    ] } },
  },
  {
    id: 33, hostile: false, terrains: ['mountains'],
    title: t('Dolina nieskończoności', 'Valley of infinity'),
    text: t('Lądujesz w górskiej dolinie o bujnej roślinności. Na środku wodospad wpada do niewielkiego zbiornika.', 'You come down into a lush mountain valley. In its middle a waterfall pours into a small pool.'),
    steps: { start: { options: [
      opt(t('Rozbijam obóz', 'Make camp'), [{ do: 'camp' }, { do: 'effect', target: 'all', amount: 10, rounds: 1 }]),
      opt(t('Zbieram prowiant (1 Wt.)', 'Gather food (1 Stamina)'), [{ do: 'effect', target: 'stamina', amount: -1, rounds: 1 }, { do: 'food', amount: 2 }]),
      leave,
    ] } },
  },
  {
    id: 34, hostile: false,
    title: t('Opuszczona wieża', 'The abandoned tower'),
    text: t('Przed Tobą stara, opuszczona kamienna wieża warowna. Na szczycie podobno wciąż stoi zamknięty skarbiec.', 'Before you stands an old, abandoned stone watchtower. They say a locked vault still stands at the top.'),
    steps: { start: { options: [
      opt(t('Wchodzę na szczyt (Zr +10)', 'Climb to the top (Dex +10)'), [{
        do: 'test', attribute: 'dex', modifier: 10,
        pass: [{ do: 'peek' }, { do: 'goto', step: 'top' }],
        fail: [{ do: 'halfVitality' }, { do: 'effect', target: 'all', amount: -20, rounds: 1 }],
      }]),
      leave,
    ] }, top: {
      text: t('Z góry widzisz całą okolicę. Obok stoją okute drzwi skarbca z zamkiem z sześciu run.', 'From the top you see the whole land around. Beside you stands the iron-bound vault door with a lock of six runes.'),
      options: [
        opt(t('Łamię szyfr skarbca (zamek, Int: dodatkowa próba)', 'Crack the vault (lock, Int: an extra try)'), [{ do: 'puzzle', puzzle: {
          kind: 'lock', helper: { attribute: 'int' }, stat: 'int', length: 3, symbols: 6, tries: 5,
          win: [{ do: 'randomItem', rare: true }, { do: 'gold', amount: 5 }],
          lose: [{ do: 'hit', damage: 3 }],
        } }]),
        opt(t('Schodzę na dół', 'Climb down'), []),
      ],
    } },
  },
  {
    id: 35, hostile: true,
    title: t('Inferno', 'Inferno'),
    text: t('Teren wokół Ciebie zaczyna gwałtownie płonąć, a ogień rozlewa się z pola na pole. Uciekaj do bezpiecznego brzegu! Każde zetknięcie z płomieniem kosztuje 2 Żyw.', 'The land around you bursts into flames and the fire spreads from square to square. Run for the safe edge! Every touch of the flames costs 2 Vit.'),
    steps: single([{ do: 'loseSpeed' }, { do: 'puzzle', puzzle: {
      kind: 'escape', theme: 'fire', stat: 'dex',
      win: [], lose: [{ do: 'vitality', amount: -4 }], burn: [{ do: 'vitality', amount: -2 }],
    } }], t('Uciekam przed ogniem (Zr: ogień wolniej się szerzy)', 'Outrun the fire (Dex: it spreads slower)')),
  },
  {
    id: 36, hostile: false, terrains: ['fields'],
    title: t('Kamień skupienia', 'The focus stone'),
    text: t('Na środku dzikiej polany stoi idealnie gładki, płaski kamień.', 'In the middle of a wild meadow lies a perfectly smooth, flat stone.'),
    steps: { start: { options: [
      opt(t('Medytuję (Int: szersza strefa skupienia)', 'Meditate (Int: a wider zone of focus)'), [{ do: 'puzzle', puzzle: {
        kind: 'hold', stat: 'int', seconds: 10,
        byScore: [[], [{ do: 'effect', target: 'all', amount: 5, rounds: 2 }], [{ do: 'effect', target: 'all', amount: 10, rounds: 2 }], [{ do: 'effect', target: 'all', amount: 10, rounds: 3 }, { do: 'xp', amount: 1 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 37, hostile: false,
    title: t('Siłowanie na rękę', 'Arm wrestling'),
    text: t('Skałogrzmot siedzący na pniu proponuje siłowanie na rękę o tajemniczą nagrodę. Przegrany płaci 2 zł.', 'A Flintborn on a tree stump offers an arm-wrestling match for a mystery prize. The loser pays 2 gold.'),
    steps: { start: { options: [
      opt(t('Siłuję się (S: przewaga na starcie i mocniejszy chwyt)', 'Wrestle (Str: a head start and a stronger grip)'), [{ do: 'puzzle', puzzle: {
        kind: 'tug', stat: 'str', win: [{ do: 'item', item: 'bookStonemason' }], lose: [{ do: 'gold', amount: -2 }],
      } }]),
      leave,
    ] } },
  },
  {
    id: 38, hostile: false, terrains: ['cave'],
    title: t('Niedostępna jaskinia', 'The sealed cave'),
    text: t('Jeden olbrzymi kamień w skalnym masywie wygląda nienaturalnie. Obok w skale wyryto pięć run, a pod nimi trzy puste wgłębienia. Może coś zasłania?', 'One huge boulder in the rock face looks out of place. Beside it five runes are carved in the rock, with three empty hollows below. Is it hiding something?'),
    steps: {
      start: { options: [
        opt(t('Przesuwam kamień (S -20)', 'Push the boulder (Str -20)'), [{ do: 'test', attribute: 'str', modifier: -20, pass: [{ do: 'goto', step: 'treasure' }], fail: [{ do: 'goto', step: 'again' }] }]),
        opt(t('Badam runy wyryte w skale', 'Study the runes carved in the rock'), [{ do: 'puzzle', puzzle: {
          kind: 'lock', helper: { attribute: 'int' }, stat: 'int', length: 3, symbols: 5, tries: 5,
          win: [{ do: 'goto', step: 'treasure' }], lose: [{ do: 'goto', step: 'again' }],
        } }]),
        leave,
      ] },
      again: { text: t('Kamień ani drgnie.', 'The boulder does not move.'), options: [
        opt(t('Jeszcze raz (S -30)', 'Again (Str -30)'), [{ do: 'test', attribute: 'str', modifier: -30, pass: [{ do: 'goto', step: 'treasure' }] }]),
        leave,
      ] },
      treasure: { text: t('Za kamieniem kryje się skarb!', 'Behind the boulder lies a treasure!'), options: [
        opt(t('Zabieram wszystko', 'Take it all'), [{ do: 'gold', amount: 10 }, { do: 'item', item: 'chainmail' }, { do: 'item', item: 'healingElixir' }]),
      ] },
    },
  },
  {
    id: 39, hostile: true,
    title: t('Złośliwe chochliki', 'Spiteful imps'),
    text: t('Wpada na Ciebie grupa małych, włochatych chochlików, które piszczą i biegają dookoła.', 'A band of small, hairy imps bursts upon you, squealing and running in circles.'),
    steps: single([{ do: 'test', attribute: 'cha', fail: [{ do: 'fight', enemies: ['imp', 'imp', 'imp', 'imp', 'imp', 'imp'] }] }], t('Straszę je (Ch)', 'Scare them off (Cha)')),
  },
  {
    id: 40, hostile: true,
    title: t('Zwiad zwierzoludzi', 'Beastmen scouts'),
    text: t('Atakuje Cię dwóch zwierzoludzi o łbach kozłów i podkutych kopytach.', 'Two beastmen with the heads of goats and shod hooves attack you.'),
    steps: fightOnly(['beastman', 'beastman'], [{ do: 'randomItem' }, { do: 'gold', amount: 4 }]),
  },
  {
    id: 42, hostile: true,
    title: t('Przepaść', 'The chasm'),
    text: t('Przed Tobą ogromny uskok szerokości 10 metrów. Nie przejdziesz prosto.', 'A huge rift 10 metres wide opens before you. You cannot go straight on.'),
    steps: { start: { options: [
      opt(t('Skaczę: rozbieg, wybicie, lądowanie (Zr: szersza strefa)', 'Jump: run-up, take-off, landing (Dex: a wider zone)'), [{ do: 'puzzle', puzzle: {
        kind: 'climb', theme: 'leap', stat: 'dex', strikes: 3,
        byScore: [[{ do: 'death' }], [{ do: 'halfVitality' }, { do: 'move', direction: 'back', distance: 1 }], [{ do: 'move', direction: 'forward', distance: 1 }], [{ do: 'move', direction: 'forward', distance: 1 }, { do: 'xp', amount: 1 }]],
      } }]),
      opt(t('Zawracam', 'Turn back'), [{ do: 'move', direction: 'back', distance: 1 }]),
    ] } },
  },
  {
    id: 44, hostile: true,
    title: t('Niestabilny teren', 'Unstable ground'),
    text: t('Ziemia zaczyna się chybotać i po chwili cały fragment się przemieszcza.', 'The ground starts to sway and then the whole fragment drifts away.'),
    steps: single([{ do: 'roll', die: 10, table: [
      { upTo: 2, then: [{ do: 'move', direction: 'left', distance: 'd6half' }] },
      { upTo: 5, then: [{ do: 'move', direction: 'forward', distance: 'd6half' }] },
      { upTo: 8, then: [{ do: 'move', direction: 'back', distance: 'd6half' }] },
      { upTo: 10, then: [{ do: 'move', direction: 'right', distance: 'd6half' }] },
    ] }], t('Trzymam się!', 'Hold on!')),
  },
  {
    id: 45, hostile: true,
    title: t('Dzika bestia', 'Wild beast'),
    text: t('Z bliska dochodzi ryk. Wyskakuje ogromna bestia, skrzyżowanie niedźwiedzia z dzikiem!', 'A roar sounds close by. A huge beast leaps out, half bear and half boar!'),
    steps: fightOnly(['honeybadger'], [{ do: 'item', item: 'beastFur' }]),
  },
  {
    id: 46, hostile: true,
    title: t('Jadowity wąż', 'Venomous snake'),
    text: t('Atakuje Cię groźnie wyglądający jadowity wąż.', 'A deadly-looking venomous snake strikes at you.'),
    steps: single([{
      do: 'test', attribute: 'dex',
      fail: [{ do: 'vitality', amount: -3 }, { do: 'test', attribute: 'str', modifier: -10, fail: [{ do: 'effect', target: 'all', amount: -15, rounds: 2 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }],
    }], t('Unikam (Zr)', 'Dodge (Dex)')),
  },
  {
    id: 47, hostile: false,
    title: t('Opiekun', 'The keeper'),
    text: t('Opiekun niesie pęk ziół i leśnych owoców. Za 2 zł. sprzeda Ci 2 losowe zioła.', 'A Keeper carries a bundle of herbs and forest fruit. For 2 gold he will sell you 2 random herbs.'),
    steps: { start: { options: [
      opt(t('Kupuję zioła (2 zł.)', 'Buy herbs (2 gold)'), [{ do: 'herbs', amount: 2 }], { gold: 2 }),
      opt(t('Proszę o naukę (Ogł -10)', 'Ask him to teach me (Cha -10)'), [{ do: 'ifRace', race: 'keepers',
        then: [{ do: 'test', attribute: 'cha', pass: [{ do: 'skill', skill: 'gather', amount: 10 }] }],
        else: [{ do: 'test', attribute: 'cha', modifier: -10, pass: [{ do: 'skill', skill: 'gather', amount: 10 }] }] }]),
      opt(t('Gram z nim w pary ziół (1 zł, Int: dłużej widzisz karty)', 'Play herb pairs with him (1 gold, Int: a longer look)'), [{ do: 'puzzle', puzzle: {
        kind: 'pairs', helper: { attribute: 'int' }, stat: 'int', pairs: 6, moves: 8,
        byScore: [[], ...[1, 2, 3, 4, 5, 6].map((n): Outcome[] => [{ do: 'herbs', amount: n }])],
      } }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 48, hostile: true,
    title: t('Zastawiona pułapka', 'Trapped ground'),
    text: t('Teren przed Tobą jest usiany pułapkami. Gdy słońce wychodzi zza chmur, na moment widać błysk ostrzy w trawie.', 'The ground ahead is riddled with traps. When the sun comes out, blades glint in the grass for a moment.'),
    steps: { start: { options: [
      opt(t('Wypatruję pułapek i przechodzę', 'Spot the traps and cross'), [{ do: 'puzzle', puzzle: {
        kind: 'traps', helper: { attribute: 'dex' }, stat: 'dex', traps: 6,
        win: [{ do: 'xp', amount: 1 }],
        hit: [{ do: 'hit', damage: 4 }, { do: 'effect', target: 'stamina', amount: -1, rounds: 1 }],
      } }]),
      opt(t('Cofam się', 'Step back'), [{ do: 'move', direction: 'back', distance: 1 }]),
      opt(t('Obchodzę w lewo', 'Go around to the left'), [{ do: 'move', direction: 'left', distance: 1 }]),
    ] } },
  },
  {
    id: 49, hostile: true,
    title: t('Mantikora', 'Manticore'),
    text: t('Z nieba opada kreatura: lew, człowiek i skrzydlaty nietoperz w jednym. Nie masz dokąd uciec!', 'A creature drops from the sky: lion, man and winged bat in one. There is nowhere to run!'),
    steps: fightOnly(['manticore'], [{ do: 'permanent', target: 'com', amount: 5 }]),
  },
  {
    id: 50, hostile: false,
    title: t('Ruletka', 'Roulette'),
    text: t('Przed Tobą 3 skrzynie. Tylko jedna kryje skarb, jedna jest pusta, a jedna wybucha. Na każdej wyryto napis, ale tylko jeden z nich mówi prawdę. Otworzysz jedną, reszta zniknie.', 'Three chests stand before you. One holds treasure, one is empty and one explodes. Each bears an inscription, but only one of them tells the truth. Open one and the rest vanish.'),
    steps: { start: { options: [
      opt(t('Czytam napisy', 'Read the inscriptions'), [{ do: 'puzzle', puzzle: {
        kind: 'chests', helper: { attribute: 'int', modifier: -10 },
        treasure: [{ do: 'randomItem' }, { do: 'randomItem' }, { do: 'gold', amount: 10 }],
        empty: [],
        blast: [{ do: 'vitality', amount: -10 }, { do: 'stuck', rounds: 1 }],
      } }]),
      leave,
    ] } },
  },
  {
    id: 51, hostile: true,
    title: t('Złodziejaszek', 'The pickpocket'),
    text: t('Zwinny chochlik wyskakuje z krzaków, przetrząsa Twój plecak i coś z niego wyciąga. Pokazuje Ci go z bezczelnym uśmiechem: powiedz, czego brakuje, a ze wstydu odda zgubę.', 'A nimble imp jumps out of the bushes, rummages through your pack and pulls something out. He shows you the pack with a cheeky grin: say what is missing and he will give it back in shame.'),
    steps: { start: { options: [
      opt(t('Mówię, czego brakuje (Int: dłużej widzisz plecak)', 'Say what is missing (Int: a longer look at the pack)'), [{ do: 'puzzle', puzzle: {
        kind: 'missing', stat: 'int', win: [{ do: 'xp', amount: 1 }, { do: 'gold', amount: 2 }], lose: [],
      } }]),
      opt(t('Gonię go (Zr -10)', 'Chase him (Dex -10)'), [{ do: 'test', attribute: 'dex', modifier: -10, pass: [{ do: 'gold', amount: 2 }], fail: [{ do: 'gold', amount: -3 }] }]),
    ] } },
  },
  {
    id: 52, hostile: false, terrains: ['river', 'lake', 'mountains', 'cave'],
    title: t('Most z kości', 'The bone bridge'),
    text: t('Nad przepaścią wisi most z kości. Między kośćmi ktoś zatknął monety, a po drugiej stronie błyszczy skrzynia. Każdy krok przybliża Cię do skarbu, ale któreś przęsło jest kruche.', 'A bridge of bones hangs over the gorge. Someone wedged coins between the bones, and a chest glints on the far side. Every step takes you nearer the treasure, but one of the spans is brittle.'),
    steps: { start: { options: [
      opt(t('Idę po kościach (Zr: słyszysz trzask kruchego przęsła)', 'Walk the bones (Dex: you hear the brittle span crack)'), [{ do: 'puzzle', puzzle: {
        kind: 'dig', theme: 'bridge', helper: { attribute: 'str' }, stat: 'dex', layers: 5, curses: 1,
        loot: [{ do: 'gold', amount: 2 }],
        bottom: [{ do: 'randomItem' }, { do: 'gold', amount: 3 }],
        bust: [{ do: 'hit', damage: 5 }, { do: 'stuck', rounds: 1 }],
      } }]),
      leave,
    ] } },
  },
  {
    id: 53, hostile: false,
    title: t('Wędrowny bard', 'The wandering bard'),
    text: t('Przy drodze siedzi bard z lutnią. Zaprasza Cię do duetu: zagra frazę, a Ty ją powtórz. Z każdą nutą gra szybciej.', 'A bard with a lute sits by the road. He invites you to a duet: he plays a phrase and you play it back. With every note he plays faster.'),
    steps: { start: { options: [
      opt(t('Gram z nim duet (Ch: wolniejsze tempo)', 'Play a duet (Cha: a slower tempo)'), [{ do: 'puzzle', puzzle: {
        kind: 'sequence', theme: 'lute', stat: 'cha', length: 6, speedUp: true,
        byScore: [[], [], [], [{ do: 'effect', target: 'cha', amount: 10, rounds: 3 }], [{ do: 'effect', target: 'cha', amount: 10, rounds: 3 }],
          [{ do: 'effect', target: 'cha', amount: 10, rounds: 3 }, { do: 'peek' }],
          [{ do: 'effect', target: 'cha', amount: 10, rounds: 5 }, { do: 'peek' }, { do: 'xp', amount: 1 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 54, hostile: false,
    title: t('Waga Opiekuna', "The keeper's scales"),
    text: t('Stary Opiekun kładzie przed Tobą sześć monet i wagę szalkową. Jedna moneta jest fałszywa i odrobinę cięższa. Znajdź ją w dwóch ważeniach, a odda Ci coś cennego.', 'An old Keeper sets six coins and a pair of scales before you. One coin is false and a little heavier. Find it in two weighings and he will give you something precious.'),
    steps: { start: { options: [
      opt(t('Ważę monety (1 zł, Int 40+: trzecie ważenie)', 'Weigh the coins (1 gold, Int 40+: a third weighing)'), [{ do: 'puzzle', puzzle: {
        kind: 'scale', stat: 'int', coins: 6, weighings: 2, win: [{ do: 'randomItem', rare: true }], lose: [],
      } }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 55, hostile: false, terrains: ['fields', 'mountains', 'desert', 'lake'],
    title: t('Gwiazdozbiór', 'The constellation'),
    text: t('Noc jest wyjątkowo jasna. Na niebie na chwilę rozbłyska znak Twojej rasy, a potem blednie wśród innych gwiazd. Wskaż jego gwiazdy, a niebo pokaże Ci drogę.', 'The night is unusually clear. The sign of your people flares in the sky for a moment, then fades among the other stars. Point out its stars and the sky will show you the way.'),
    steps: { start: { options: [
      opt(t('Odczytuję gwiazdy (Int: znak blednie wolniej)', 'Read the stars (Int: the sign fades slower)'), [{ do: 'puzzle', puzzle: {
        kind: 'stars', stat: 'int',
        byScore: [[], [{ do: 'peek' }], [{ do: 'peek' }, { do: 'xp', amount: 1 }, { do: 'effect', target: 'int', amount: 10, rounds: 3 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 56, hostile: false,
    title: t('Kości Nomady', "The Nomad's dice"),
    text: t('Nomada przy ognisku potrząsa kubkiem z dwiema kośćmi. Rzuca, zerka i mówi, ile wyrzucił, ale nie zawsze mówi prawdę. Wierzysz mu czy krzyczysz „kłamiesz!”? Trzy rundy, wygrywasz od dwóch trafień.', 'A Nomad by the fire shakes a cup with two dice. He throws, peeks and says what he rolled, but not always truly. Do you believe him or shout "liar!"? Three rounds; two right calls win.'),
    steps: { start: { options: [
      opt(t('Gram o 1 zł (Ch: zdradza go mina)', 'Play for 1 gold (Cha: his face gives him away)'), [{ do: 'puzzle', puzzle: {
        kind: 'bluff', stat: 'cha', rounds: 3,
        byScore: [[], [], [{ do: 'gold', amount: 2 }], [{ do: 'gold', amount: 3 }, { do: 'xp', amount: 1 }]],
      } }], { gold: 1 }),
      opt(t('Gram o 3 zł (Ch: zdradza go mina)', 'Play for 3 gold (Cha: his face gives him away)'), [{ do: 'puzzle', puzzle: {
        kind: 'bluff', stat: 'cha', rounds: 3,
        byScore: [[], [], [{ do: 'gold', amount: 6 }], [{ do: 'gold', amount: 9 }, { do: 'xp', amount: 1 }]],
      } }], { gold: 3 }),
      leave,
    ] } },
  },
  {
    id: 57, hostile: false, terrains: ['forest', 'river', 'lake', 'cave'],
    title: t('Świetliki', 'Fireflies'),
    text: t('Zmierzch zapada, a wokół Ciebie zapalają się setki świetlików. Złapane do słoika rozjaśnią każdą ciemność.', 'Dusk falls and hundreds of fireflies light up around you. Caught in a jar, they will brighten any darkness.'),
    steps: { start: { options: [
      opt(t('Łapię świetliki (Zr: dłużej świecą)', 'Catch fireflies (Dex: they glow longer)'), [{ do: 'puzzle', puzzle: {
        kind: 'catch', stat: 'dex', seconds: 10, per: 4,
        byScore: [[], [{ do: 'herbs', amount: 1 }], [{ do: 'effect', target: 'int', amount: 10, rounds: 5 }],
          [{ do: 'effect', target: 'int', amount: 10, rounds: 5 }, { do: 'herbs', amount: 1 }],
          [{ do: 'effect', target: 'int', amount: 10, rounds: 5 }, { do: 'herbs', amount: 2 }, { do: 'xp', amount: 1 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 58, hostile: false,
    title: t('Przesuwana mozaika', 'The sliding mosaic'),
    text: t('W ruinach kaplicy znajdujesz fresk z kamiennych płytek, które dają się przesuwać. Ktoś je pomieszał. Ułożony obraz podobno odsłania runę.', 'In the ruins of a chapel you find a fresco of stone tiles that slide. Someone has jumbled them. They say the finished picture reveals a rune.'),
    steps: { start: { options: [
      opt(t('Układam fresk (Int: mniej pomieszany)', 'Restore the fresco (Int: less jumbled)'), [{ do: 'puzzle', puzzle: {
        kind: 'slider', helper: { attribute: 'int' }, stat: 'int', seconds: 90, win: [{ do: 'rune' }, { do: 'xp', amount: 1 }], lose: [],
      } }]),
      leave,
    ] } },
  },
];
/** Reading a book plays a word puzzle on a card of its own; these cards are never drawn. */
export const BOOK_CARD_BASE = 900;
const BOOKS: { item: string; pool: RiddlePool; title: Text }[] = [
  { item: 'bookKnight', pool: 'knight', title: t('Księga Wiedzy Rycerskiej', 'Book of Knightly Lore') },
  { item: 'bookJuggler', pool: 'juggler', title: t('Księga Magii Kuglarskiej', "Book of Juggler's Magic") },
  { item: 'bookStonemason', pool: 'stonemason', title: t('Księga Kamieniarza', "Stonemason's Book") },
];
export const BOOK_CARDS: EventCard[] = BOOKS.map((b, i) => ({
  id: BOOK_CARD_BASE + i, hostile: false, title: b.title,
  text: t('Litery na stronie rozsypują się pod Twoim wzrokiem. Ułóż słowo z podpowiedzi, a lektura się uda.', 'The letters on the page scatter as you look. Spell the word from the clue and the reading counts.'),
  steps: { start: { options: [opt(t('Zamykam księgę', 'Close the book'), [])] } },
}));
/** The card and the word puzzle of one reading of a book. */
export function bookReading(item: string): { card: number; puzzle: Puzzle } | null {
  const i = BOOKS.findIndex((b) => b.item === item);
  if (i < 0) return null;
  return {
    card: BOOK_CARD_BASE + i,
    puzzle: { kind: 'riddle', pool: BOOKS[i]!.pool, helper: { attribute: 'int' }, stat: 'int', seconds: 40, fastSeconds: 15, win: [{ do: 'bookRead', item }], fast: [], lose: [] },
  };
}

/**
 * The quiet card: a new fragment always draws a card, but 3 draws in 10 bring no event (Jacob, 2026-11-28).
 * It is never in the deck: the engine picks it before the deck is drawn from.
 */
export const QUIET_CARD = 800;
const QUIET: EventCard = {
  id: QUIET_CARD, hostile: false,
  title: t('Cisza', 'Quiet'),
  text: t('Rozglądasz się uważnie, ale okolica jest spokojna. Tym razem nic się tu nie wydarza.', 'You look around carefully, but the land is calm. This time nothing happens here.'),
  steps: { start: { options: [opt(LEAVE, [])] } },
};

/** Every card by id: the event deck, the dungeon rooms, the book readings and the quiet card. */
export const EVENT_BY_ID: Record<number, EventCard> = Object.fromEntries([...EVENTS, ...DUNGEON_CARDS, ...BOOK_CARDS, QUIET].map((e) => [e.id, e]));
