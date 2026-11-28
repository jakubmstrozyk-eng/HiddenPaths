import type { EventCard, EventOption, Outcome } from './eventTypes';
import type { Text } from './types';
import { BOUNTY_CARD_BASE } from './quests';

const t = (pl: string, en: string): Text => ({ pl, en });
const opt = (label: Text, then: Outcome[], cost?: EventOption['cost']): EventOption => ({ label, then, ...(cost ? { cost } : {}) });
const leave = opt(t('Idę dalej', 'Walk on'), []);

/** Town cards are numbered from here; they have a deck of their own (`state.townDeck`). */
export const TOWN_CARD_BASE = 600;
export const isTownCard = (id: number) => id >= TOWN_CARD_BASE && id < TOWN_CARD_BASE + 100;

/**
 * Events of cities, villages and inns (Jacob, 2026-11-28): a separate pool about street life, drawn 7 times
 * in 10 after the hero's first action in the settlement. Attributes decide them as often as tests do.
 */
export const TOWN_EVENTS: EventCard[] = [
  {
    id: 600, hostile: true, terrains: ['city', 'village'],
    title: t('Bójka na rynku', 'Brawl in the square'),
    text: t('Na środku placu dwóch osiłków okłada się pięściami, a gapie przekrzykują się, obstawiając zakłady. Ktoś zaraz oberwie kamieniem z bruku.', 'In the middle of the square two brutes trade punches while the crowd shouts its bets. Someone is about to get hit by a cobblestone.'),
    steps: { start: { options: [
      opt(t('Rozdzielam bijących', 'Pull them apart'), [{ do: 'test', attribute: 'str', pass: [{ do: 'gold', amount: 2 }, { do: 'xp', amount: 1 }], fail: [{ do: 'hit', damage: 3 }] }]),
      opt(t('Uspokajam tłum przemową', 'Calm the crowd with a speech'), [{ do: 'test', attribute: 'cha', modifier: -10, pass: [{ do: 'effect', target: 'cha', amount: 10, rounds: 3 }, { do: 'xp', amount: 1 }], fail: [{ do: 'vitality', amount: -2 }] }]),
      opt(t('Stawiam zakład na wyższego', 'Bet on the taller one'), [{ do: 'roll', die: 6, table: [{ upTo: 3, then: [] }, { upTo: 6, then: [{ do: 'gold', amount: 3 }] }] }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 601, hostile: false, terrains: ['city', 'village', 'inn'],
    title: t('Okazja u kramarza', "A bargain at the pedlar's"),
    text: t('Wąsaty kramarz łapie Cię za rękaw: „Dla ciebie, przyjacielu, wyjątkowa cena! Takiego towaru nie ma nawet w zamku”. Zawiniątko pod jego płaszczem coś obiecuje.', 'A moustached pedlar grabs your sleeve: "For you, friend, a special price! Not even the castle has goods like these." The bundle under his cloak promises something.'),
    steps: { start: { options: [
      opt(t('Oglądam towar uważnie i kupuję', 'Look the goods over and buy'), [{ do: 'test', attribute: 'int', pass: [{ do: 'randomItem' }], fail: [{ do: 'roll', die: 10, table: [{ upTo: 6, then: [] }, { upTo: 10, then: [{ do: 'randomItem' }] }] }] }], { gold: 3 }),
      opt(t('Targuję się o cenę', 'Haggle'), [{ do: 'test', attribute: 'cha', modifier: -10, pass: [{ do: 'randomItem' }], fail: [{ do: 'gold', amount: 1 }] }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 602, hostile: true, terrains: ['city'],
    title: t('Postać w zaułku', 'A figure in the alley'),
    text: t('W ciemnej alejce między kamienicami zakapturzona postać kiwa na Ciebie palcem. Spod kaptura błyskają oczy, a w powietrzu czuć zapach siarki.', 'In a dark alley between the houses a hooded figure beckons you with a finger. Eyes glint under the hood and the air smells of sulphur.'),
    steps: {
      start: { options: [
        opt(t('Podchodzę bez lęku', 'Step closer, unafraid'), [{ do: 'test', attribute: 'wil', pass: [{ do: 'goto', step: 'offer' }], fail: [{ do: 'effect', target: 'all', amount: -10, rounds: 2 }] }]),
        opt(t('Chwytam za broń', 'Draw my weapon'), [{ do: 'fight', enemies: ['bandit'], onWin: [{ do: 'gold', amount: 3 }] }]),
        opt(t('Szybko się wycofuję', 'Back away quickly'), [{ do: 'test', attribute: 'dex', fail: [{ do: 'gold', amount: -2 }] }]),
      ] },
      offer: {
        text: t('„Nie każdy ma odwagę słuchać” – szepcze postać. – „Za kilka monet wyryję runę na twoim ostrzu. Albo powiem ci, co kryje okolica”.', '"Not everyone dares to listen," the figure whispers. "For a few coins I will cut a rune into your blade. Or I will tell you what the land around hides."'),
        options: [
          opt(t('Płacę za runę', 'Pay for the rune'), [{ do: 'rune' }], { gold: 4 }),
          opt(t('Pytam o okolicę', 'Ask about the land'), [{ do: 'peek' }, { do: 'xp', amount: 1 }]),
          opt(t('Odchodzę', 'Walk away'), []),
        ],
      },
    },
  },
  {
    id: 603, hostile: true, terrains: ['city', 'village'],
    title: t('Kieszonkowiec', 'Pickpocket'),
    text: t('Ktoś ociera się o Ciebie w ciżbie na targu. Sakiewka nagle wydaje się lżejsza, a chudy chłopak w łachmanach znika między straganami.', 'Someone brushes past you in the market crowd. Your purse suddenly feels lighter, and a thin lad in rags slips away between the stalls.'),
    steps: { start: { options: [
      opt(t('Łapię go za kołnierz', 'Grab him by the collar'), [{ do: 'test', attribute: 'dex', pass: [{ do: 'gold', amount: 2 }, { do: 'xp', amount: 1 }], fail: [{ do: 'gold', amount: -3 }] }]),
      opt(t('Wołam straż', 'Call the guards'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'gold', amount: 1 }], fail: [{ do: 'gold', amount: -3 }] }]),
      opt(t('Machnę ręką', 'Let it go'), [{ do: 'gold', amount: -2 }]),
    ] } },
  },
  {
    id: 604, hostile: false, terrains: ['inn', 'village', 'city'],
    title: t('Siłowanie przy szynku', 'Arm wrestling at the bar'),
    text: t('Skałogrzmot wali pięścią w blat: „Kto mnie przegnie, temu stawiam kolejkę i płacę srebrem!”. Stawka to 1 zł.', 'A Flintborn bangs his fist on the counter: "Whoever bends my arm gets a round and silver from me!" The stake is 1 gold.'),
    steps: { start: { options: [
      opt(t('Siłuję się (S: przewaga na starcie i mocniejszy chwyt)', 'Wrestle (Str: a head start and a stronger grip)'), [{ do: 'puzzle', puzzle: {
        kind: 'tug', stat: 'str', win: [{ do: 'gold', amount: 4 }, { do: 'xp', amount: 1 }], lose: [],
      } }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 605, hostile: false, terrains: ['inn', 'city'],
    title: t('Bard szuka głosu', 'A bard needs a voice'),
    text: t('Podchmielony bard wskakuje na ławę i wskazuje na Ciebie lutnią: „Ty! Zaśpiewaj ze mną refren, a sala cię pokocha!”.', 'A tipsy bard jumps on a bench and points his lute at you: "You! Sing the chorus with me and the room will love you!"'),
    steps: { start: { options: [
      opt(t('Śpiewam z nim (Ch: wolniejsza melodia)', 'Sing along (Cha: a slower tune)'), [{ do: 'puzzle', puzzle: {
        kind: 'sequence', theme: 'lute', stat: 'cha', length: 5,
        byScore: [[], [], [], [{ do: 'gold', amount: 1 }], [{ do: 'gold', amount: 2 }], [{ do: 'gold', amount: 3 }, { do: 'xp', amount: 1 }, { do: 'effect', target: 'cha', amount: 10, rounds: 3 }]],
      } }]),
      leave,
    ] } },
  },
  {
    id: 606, hostile: false, terrains: ['inn', 'village'],
    title: t('Kości w kącie izby', 'Dice in the corner'),
    text: t('W kącie izby Nomada potrząsa kubkiem. Rzuca, zerka i mówi, ile wyrzucił, ale nie zawsze mówi prawdę. Trzy rundy, wygrywasz od dwóch trafień.', 'In the corner a Nomad shakes a cup. He throws, peeks and says what he rolled, but not always truly. Three rounds; two right calls win.'),
    steps: { start: { options: [
      opt(t('Gram o 2 zł (Ch: zdradza go mina)', 'Play for 2 gold (Cha: his face gives him away)'), [{ do: 'puzzle', puzzle: {
        kind: 'bluff', stat: 'cha', rounds: 3,
        byScore: [[], [], [{ do: 'gold', amount: 4 }], [{ do: 'gold', amount: 6 }, { do: 'xp', amount: 1 }]],
      } }], { gold: 2 }),
      leave,
    ] } },
  },
  {
    id: 607, hostile: true, terrains: ['village'],
    title: t('Pożar stodoły', 'The barn on fire'),
    text: t('Z dachu stodoły bucha czarny dym! Mieszkańcy biegają z wiadrami, a ze środka dobiega rżenie koni.', 'Black smoke pours from a barn roof! Villagers run about with buckets, and horses scream inside.'),
    steps: { start: { options: [
      opt(t('Noszę wiadra z wodą', 'Carry buckets of water'), [{ do: 'test', attribute: 'str', pass: [{ do: 'food', amount: 2 }, { do: 'xp', amount: 1 }], fail: [{ do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }]),
      opt(t('Wbiegam po konie', 'Run in for the horses'), [{ do: 'test', attribute: 'dex', modifier: -10, pass: [{ do: 'gold', amount: 4 }, { do: 'xp', amount: 1 }, { do: 'effect', target: 'cha', amount: 10, rounds: 0 }], fail: [{ do: 'hit', damage: 4 }] }]),
      opt(t('Organizuję łańcuch ludzi', 'Organise a bucket chain'), [{ do: 'test', attribute: 'int', pass: [{ do: 'gold', amount: 2 }, { do: 'xp', amount: 1 }], fail: [] }]),
      leave,
    ] } },
  },
  {
    id: 608, hostile: false, terrains: ['village'],
    title: t('Kot na dachu', 'A cat on the roof'),
    text: t('Staruszka załamuje ręce: jej kot wdrapał się na sam szczyt dachu i boi się zejść.', 'An old woman wrings her hands: her cat has climbed to the very top of the roof and is afraid to come down.'),
    steps: { start: { options: [
      opt(t('Wspinam się po kota', 'Climb up for the cat'), [{ do: 'test', attribute: 'dex', pass: [{ do: 'food', amount: 1 }, { do: 'gold', amount: 1 }, { do: 'xp', amount: 1 }], fail: [{ do: 'vitality', amount: -2 }] }]),
      opt(t('Wabię go jedzeniem', 'Lure it with food'), [{ do: 'gold', amount: 2 }], { food: 1 }),
      leave,
    ] } },
  },
  {
    id: 609, hostile: true, terrains: ['city'],
    title: t('Patrol straży', 'The city watch'),
    text: t('Trzech strażników zastępuje Ci drogę: „Stój! Kim jesteś i co tu robisz, przybyszu?”. Dowódca patrolu bawi się pałką.', 'Three guards block your way: "Halt! Who are you and what brings you here, stranger?" The sergeant toys with his club.'),
    steps: { start: { options: [
      opt(t('Tłumaczę się spokojnie', 'Explain calmly'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'effect', target: 'cha', amount: 10, rounds: 2 }], fail: [{ do: 'gold', amount: -2 }] }]),
      opt(t('Pokazuję, że umiem walczyć', 'Show them I can fight'), [{ do: 'test', attribute: 'com', pass: [{ do: 'gold', amount: 3 }, { do: 'xp', amount: 1 }], fail: [{ do: 'stuck', rounds: 1 }] }]),
      opt(t('Wsuwam im monety', 'Slip them some coins'), [], { gold: 2 }),
    ] } },
  },
  {
    id: 610, hostile: false, terrains: ['city', 'village'],
    title: t('Wróżka z jarmarku', 'The fair fortune-teller'),
    text: t('Stara wróżka rozkłada na beczce wytarte karty: „Za monetę powiem ci, co cię czeka za bramą”.', 'An old fortune-teller lays worn cards out on a barrel: "For a coin I will tell you what awaits you beyond the gate."'),
    steps: { start: { options: [
      opt(t('Płacę i słucham', 'Pay and listen'), [{ do: 'roll', die: 6, table: [
        { upTo: 1, then: [{ do: 'effect', target: 'all', amount: -5, rounds: 2 }] },
        { upTo: 4, then: [{ do: 'peek' }] },
        { upTo: 6, then: [{ do: 'effect', target: 'all', amount: 10, rounds: 2 }] },
      ] }], { gold: 1 }),
      opt(t('Przyglądam się jej sztuczkom', 'Watch her tricks closely'), [{ do: 'test', attribute: 'int', modifier: -10, pass: [{ do: 'xp', amount: 1 }, { do: 'permanent', target: 'int', amount: 1 }], fail: [{ do: 'gold', amount: -1 }] }]),
      leave,
    ] } },
  },
  {
    id: 611, hostile: false, terrains: ['inn'],
    title: t('Szczury w piwnicy', 'Rats in the cellar'),
    text: t('Karczmarz ociera pot z czoła: „Szczury dobrały się do zapasów! Kto je przegoni, ten je dziś za darmo”.', 'The innkeeper wipes his brow: "Rats have got into the stores! Whoever drives them off eats for free tonight."'),
    steps: { start: { options: [
      opt(t('Schodzę do piwnicy', 'Go down into the cellar'), [{ do: 'test', attribute: 'com', pass: [{ do: 'food', amount: 2 }, { do: 'xp', amount: 1 }], fail: [{ do: 'vitality', amount: -2 }] }]),
      opt(t('Zastawiam sprytną pułapkę', 'Set a clever trap'), [{ do: 'test', attribute: 'int', pass: [{ do: 'food', amount: 2 }, { do: 'gold', amount: 1 }], fail: [] }]),
      leave,
    ] } },
  },
  {
    id: 612, hostile: true, terrains: ['inn', 'village'],
    title: t('Pijany awanturnik', 'A drunken brawler'),
    text: t('Rosły pijak potrąca Twój stół i wylewa Ci piwo na kolana. „No i co się gapisz?” – bełkocze, zaciskając pięści.', 'A hulking drunk knocks your table and spills beer in your lap. "What are you staring at?" he slurs, clenching his fists.'),
    steps: { start: { options: [
      opt(t('Uspokajam go słowem', 'Calm him with words'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'xp', amount: 1 }], fail: [{ do: 'fight', enemies: ['bandit'] }] }]),
      opt(t('Wyrzucam go za drzwi', 'Throw him out the door'), [{ do: 'test', attribute: 'str', modifier: -10, pass: [{ do: 'gold', amount: 2 }, { do: 'food', amount: 1 }], fail: [{ do: 'hit', damage: 3 }] }]),
      opt(t('Do walki!', 'Fight!'), [{ do: 'fight', enemies: ['bandit'], onWin: [{ do: 'gold', amount: 2 }] }]),
    ] } },
  },
  {
    id: 613, hostile: false, terrains: ['city'],
    title: t('Turniej łuczniczy', 'Archery contest'),
    text: t('Przy murach miejskich trwa turniej: kto trafi w sam środek tarczy, zgarnia sakiewkę od burmistrza. Wpisowe to 1 zł.', 'By the city walls a contest is on: whoever hits the very centre of the target takes the mayor\'s purse. The entry fee is 1 gold.'),
    steps: { start: { options: [
      opt(t('Strzelam (Zr: szersze pole trafienia)', 'Shoot (Dex: a wider target)'), [{ do: 'puzzle', puzzle: {
        kind: 'hold', stat: 'dex', seconds: 6,
        byScore: [[], [], [{ do: 'gold', amount: 3 }], [{ do: 'gold', amount: 5 }, { do: 'xp', amount: 1 }]],
      } }], { gold: 1 }),
      leave,
    ] } },
  },
  {
    id: 614, hostile: false, terrains: ['city', 'village', 'inn'],
    title: t('Żebrak prorok', 'The beggar prophet'),
    text: t('Ślepy żebrak chwyta Cię za płaszcz: „Daj grosz, wędrowcze, a powiem ci, gdzie świat jest pęknięty”.', 'A blind beggar catches your cloak: "Spare a coin, wanderer, and I will tell you where the world is cracked."'),
    steps: { start: { options: [
      opt(t('Daję mu monetę', 'Give him a coin'), [{ do: 'test', attribute: 'wil', pass: [{ do: 'peek' }, { do: 'xp', amount: 1 }], fail: [{ do: 'peek' }] }], { gold: 1 }),
      opt(t('Dzielę się chlebem', 'Share my bread'), [{ do: 'effect', target: 'wil', amount: 10, rounds: 3 }, { do: 'xp', amount: 1 }], { food: 1 }),
      leave,
    ] } },
  },
  {
    id: 615, hostile: false, terrains: ['village', 'city'],
    title: t('Wóz w błocie', 'A cart in the mud'),
    text: t('Przy bramie kupiecki wóz ugrzązł po osie w błocie. Woźnica klnie, a konie parskają bezradnie.', 'By the gate a merchant\'s cart is stuck axle-deep in mud. The driver curses and the horses snort helplessly.'),
    steps: { start: { options: [
      opt(t('Pcham wóz z całych sił', 'Push the cart with all my might'), [{ do: 'test', attribute: 'str', pass: [{ do: 'gold', amount: 3 }, { do: 'xp', amount: 1 }], fail: [{ do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }]),
      opt(t('Podkładam deski pod koła', 'Put planks under the wheels'), [{ do: 'test', attribute: 'int', pass: [{ do: 'gold', amount: 2 }, { do: 'ores', amount: 1 }], fail: [] }]),
      leave,
    ] } },
  },
];

/** The fights waiting on a bounty's marked fragment (notice-board quests). Never in a deck. */
export const BOUNTY_CARDS: EventCard[] = [
  {
    id: BOUNTY_CARD_BASE, hostile: true,
    title: t('Obóz rozbójników', "The robbers' camp"),
    text: t('Przy dogasającym ognisku siedzą rozbójnicy z listu gończego. Zrywają się na Twój widok i sięgają po miecze.', 'The robbers from the wanted poster sit by a dying fire. They leap up at the sight of you and reach for their swords.'),
    steps: { start: { options: [opt(t('Do walki!', 'Fight!'), [{ do: 'fight', enemies: ['bandit', 'bandit'] }])] } },
  },
  {
    id: BOUNTY_CARD_BASE + 1, hostile: true,
    title: t('Legowisko zwierzoludzia', "The beastman's lair"),
    text: t('Wśród ogryzionych kości stoi zwierzoludź z listu gończego. Ryczy i rusza na Ciebie.', 'Among gnawed bones stands the beastman from the poster. It roars and charges.'),
    steps: { start: { options: [opt(t('Do walki!', 'Fight!'), [{ do: 'fight', enemies: ['beastman'] }])] } },
  },
  {
    id: BOUNTY_CARD_BASE + 2, hostile: true,
    title: t('Chata wiedźmy', "The witch's hut"),
    text: t('Z komina krzywej chaty unosi się zielony dym. Wiedźma z listu gończego już na Ciebie czeka.', 'Green smoke rises from the chimney of a crooked hut. The witch from the poster is waiting for you.'),
    steps: { start: { options: [opt(t('Do walki!', 'Fight!'), [{ do: 'fight', enemies: ['witch'] }])] } },
  },
];
export const isBountyCard = (id: number | undefined) => id !== undefined && id >= BOUNTY_CARD_BASE && id < BOUNTY_CARD_BASE + 50;
