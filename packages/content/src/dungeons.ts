import type { EventCard, EventOption, EventStep, Outcome } from './eventTypes';
import type { TerrainId, Text } from './types';

/**
 * Dungeons (Jacob, 2026-11-26): one small dungeon per map. Its entrance lies on an ordinary fragment;
 * behind it wait 4–7 rooms with one fork, a lord of the dungeon and a vault. Each room is a card that
 * works like an event card, so the app shows it the same way: title, scene, then tests and choices.
 */

const t = (pl: string, en: string): Text => ({ pl, en });
const opt = (label: Text, then: Outcome[], cost?: EventOption['cost']): EventOption => ({ label, then, ...(cost ? { cost } : {}) });

export type DungeonThemeId = 'mine' | 'nest' | 'crypt' | 'tomb' | 'rift';
export type RoomKind = 'trap' | 'puzzle' | 'guard' | 'special' | 'shrine' | 'side' | 'boss' | 'vault';

export interface DungeonTheme {
  id: DungeonThemeId;
  name: Text;
  /** A line for the entrance: what the hero sees going down. */
  blurb: Text;
  /** Fragments whose entrance gets this theme (the rift is chosen by nearness to the centre instead). */
  terrains: TerrainId[];
  boss: string;
  relic: string;
  /** Foes in a guard room: kept to those a level 1 hero may meet (Jacob's rule of 2026-11-23). */
  guards: string[];
}

export const DUNGEON_THEMES: Record<DungeonThemeId, DungeonTheme> = {
  mine: {
    id: 'mine', name: t('Zapadnięta Kopalnia', 'The Fallen Mine'),
    blurb: t('Stare chodniki Krzemiennych schodzą w głąb skały. Z ciemności dobiega stukot, choć nikt tu nie kopie od stu lat.', 'Old Flintborn tunnels lead deep into the rock. Something knocks in the dark, though no one has dug here for a hundred years.'),
    terrains: ['mountains', 'cave'], boss: 'stoneWarden', relic: 'ancestorPick', guards: ['imp', 'bandit'],
  },
  nest: {
    id: 'nest', name: t('Gniazdo w Korzeniach', 'The Nest in the Roots'),
    blurb: t('Między korzeniami prastarego dębu ziemia się zapadła. W dole wszystko oplata lepka, srebrna przędza.', 'The ground has sunk between the roots of an ancient oak. Below, everything is wrapped in sticky silver silk.'),
    terrains: ['forest'], boss: 'spiderQueen', relic: 'silkCloak', guards: ['wolf', 'wolf'],
  },
  crypt: {
    id: 'crypt', name: t('Zatopiona Krypta', 'The Drowned Crypt'),
    blurb: t('Schody znikają pod czarną wodą. Na dnie ktoś kiedyś chował swoich zmarłych, a woda zabrała resztę.', 'The stairs vanish under black water. Someone once buried their dead down here, and the water took the rest.'),
    terrains: ['river', 'lake'], boss: 'drowned', relic: 'deepPearl', guards: ['raven', 'raven'],
  },
  tomb: {
    id: 'tomb', name: t('Grobowiec pod Piaskiem', 'The Tomb under the Sand'),
    blurb: t('Wiatr odsłonił kamienne drzwi z pieczęcią dawnego króla. Za nimi czuć suche, stęchłe powietrze.', "The wind has bared stone doors with an old king's seal. Dry, stale air waits behind them."),
    terrains: ['desert', 'fields'], boss: 'mummyKing', relic: 'kingScepter', guards: ['mummy'],
  },
  rift: {
    id: 'rift', name: t('Szczelina Pustki', 'The Void Rift'),
    blurb: t('Blisko Kamienia Początku ziemia pękła. Szczelina świeci ciemną materią i szepcze.', 'Near the Stone of Beginnings the ground has split. The rift glows with dark matter, and it whispers.'),
    terrains: [], boss: 'riftWarden', relic: 'riftShard', guards: ['imp', 'youngVoidDemon'],
  },
};

export const DUNGEON_THEME_IDS = Object.keys(DUNGEON_THEMES) as DungeonThemeId[];

/** Rooms walked from the entrance to the vault, vault included, by map size (short, medium, long, epic). */
export const DUNGEON_LENGTH = [4, 5, 6, 7] as const;

/** What the vault holds on each map size (short, medium, long, epic). */
export const VAULT_REWARDS = [
  { gold: 20, rare: 1, common: 0, ores: 1, xp: 8 },
  { gold: 30, rare: 1, common: 0, ores: 2, xp: 10 },
  { gold: 40, rare: 1, common: 1, ores: 2, xp: 12 },
  { gold: 50, rare: 2, common: 0, ores: 3, xp: 15 },
] as const;

/** Card ids: 1000 + 100 per theme + the room's slot. Event cards of the deck stay below 1000. */
export const DUNGEON_CARD_BASE = 1000;
const SLOT = { trap: 1, puzzleRunes: 2, puzzleRiddle: 3, guard: 4, special: 5, shrine: 6, side: 7, boss: 8, guard2: 9, vault: 10 } as const;
export type RoomSlot = keyof typeof SLOT;

export function dungeonCardId(theme: DungeonThemeId, slot: RoomSlot, tier = 0): number {
  return DUNGEON_CARD_BASE + DUNGEON_THEME_IDS.indexOf(theme) * 100 + SLOT[slot] + (slot === 'vault' ? tier : 0);
}

/** True for a card that belongs to a dungeon room rather than the event deck. */
export const isDungeonCard = (id: number) => id >= DUNGEON_CARD_BASE;

const steps = (start: EventStep, more: Record<string, EventStep> = {}) => ({ start, ...more });
const WALK_ON = t('Idę dalej', 'Walk on');

const TRAPS: Record<DungeonThemeId, { title: Text; text: Text }> = {
  mine: { title: t('Zapadnia w chodniku', 'Pitfall in the tunnel'), text: t('Deski pod stopami trzeszczą podejrzanie. Pod nimi ziemia opada w czarną szczelinę.', 'The planks underfoot creak oddly. Beneath them the ground drops into a black crack.') },
  nest: { title: t('Nici alarmowe', 'Tripwire silk'), text: t('Cienkie nici przecinają korytarz na wysokości kostek. Jedno szarpnięcie i z góry spadnie coś ciężkiego.', 'Fine threads cross the passage at ankle height. One tug and something heavy will fall from above.') },
  crypt: { title: t('Śliskie stopnie', 'Slick steps'), text: t('Kamienne stopnie pokrywa szlam. Pod nimi coś połyskuje: ostre kolce w wodzie.', 'Slime covers the stone steps. Something glints beneath them: sharp spikes in the water.') },
  tomb: { title: t('Wahadło strażników', "The guardians' pendulum"), text: t('W ścianach widać szczeliny, a na podłodze rysy po ostrzu. Gdzieś nad głową tyka mechanizm.', 'There are slits in the walls and blade marks on the floor. A mechanism ticks somewhere overhead.') },
  rift: { title: t('Ciemny wir', 'Dark whirl'), text: t('Powietrze faluje, a kamienie unoszą się nad ziemią. Jeden zły krok i wir pustki szarpnie Cię za sobą.', 'The air ripples and stones float above the floor. One wrong step and the void whirl will drag you along.') },
};

const SPECIALS: Record<DungeonThemeId, { title: Text; text: Text; start: EventStep }> = {
  mine: {
    title: t('Żyła kruszcu', 'Vein of ore'), text: t('W ścianie lśni gruba żyła kruszcu. Kilka uderzeń i można ją wydobyć, jeśli strop wytrzyma.', 'A thick vein of ore glitters in the wall. A few blows will free it, if the roof holds.'),
    start: { options: [
      opt(t('Wydobywam kruszec (Int.)', 'Dig out the ore (Int)'), [{ do: 'test', attribute: 'int', pass: [{ do: 'ores', amount: 1, rare: true }, { do: 'ores', amount: 1 }], fail: [{ do: 'vitality', amount: -2 }] }]),
      opt(WALK_ON, []),
    ] },
  },
  nest: {
    title: t('Pajęcze sieci', 'Spider webs'), text: t('Korytarz zarasta gęsta sieć. W jednym z kokonów coś błyszczy, może dawny wędrowiec i jego dobytek.', 'A thick web blocks the passage. Something shines in one of the cocoons, maybe an old wanderer and his belongings.'),
    start: { options: [
      opt(t('Rozrywam sieć i kokon (S)', 'Tear through the web and cocoon (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'randomItem' }, { do: 'gold', amount: 3 }], fail: [{ do: 'loseSpeed' }] }]),
      opt(t('Przeciskam się bokiem (Zr.)', 'Squeeze past the side (Dex)'), [{ do: 'test', attribute: 'dex', fail: [{ do: 'loseSpeed' }] }]),
    ] },
  },
  crypt: {
    title: t('Zalany korytarz', 'Flooded passage'), text: t('Dalsza droga prowadzi pod wodą. Po drugiej stronie widać światło i zatopioną skrzynkę.', 'The way on runs under water. On the far side there is light and a sunken chest.'),
    start: { options: [
      opt(t('Płynę i wyławiam skrzynkę (S)', 'Swim and fish out the chest (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'randomItem' }], fail: [{ do: 'vitality', amount: -3 }, { do: 'loseSpeed' }] }]),
      opt(t('Płynę najkrótszą drogą (S +10)', 'Swim the shortest way (Str +10)'), [{ do: 'test', attribute: 'str', modifier: 10, fail: [{ do: 'vitality', amount: -3 }] }]),
    ] },
  },
  tomb: {
    title: t('Trzy sarkofagi', 'Three sarcophagi'), text: t('Pod ścianą stoją trzy sarkofagi. W jednym leży skarb, w innym ktoś, kto nie chce, by mu przeszkadzano.', 'Three sarcophagi stand by the wall. One holds treasure, another someone who does not wish to be disturbed.'),
    start: { options: [
      ...[t('Otwieram lewy', 'Open the left one'), t('Otwieram środkowy', 'Open the middle one'), t('Otwieram prawy', 'Open the right one')].map((label) =>
        opt(label, [{ do: 'roll', die: 3, table: [{ upTo: 1, then: [{ do: 'randomItem', rare: true }] }, { upTo: 2, then: [{ do: 'gold', amount: 5 }] }, { upTo: 3, then: [{ do: 'fight', enemies: ['mummy'] }] }] }])),
      opt(t('Nie ruszam zmarłych', 'Leave the dead alone'), []),
    ] },
  },
  rift: {
    title: t('Ołtarz ciemnej materii', 'Altar of dark matter'), text: t('Na ołtarzu pulsuje ciemna materia. Szept obiecuje siłę w zamian za cząstkę Twojego życia.', 'Dark matter pulses on the altar. A whisper promises strength in return for a piece of your life.'),
    start: { options: [
      opt(t('Siła walki (Walka +10, −3 maks. Żyw.)', 'Strength in battle (Combat +10, −3 max Vit)'), [{ do: 'permanent', target: 'com', amount: 10 }, { do: 'permanent', target: 'maxVitality', amount: -3 }]),
      opt(t('Jasność umysłu (Int. +10, −3 maks. Żyw.)', 'Clarity of mind (Int +10, −3 max Vit)'), [{ do: 'permanent', target: 'int', amount: 10 }, { do: 'permanent', target: 'maxVitality', amount: -3 }]),
      opt(t('Odchodzę od ołtarza', 'Step away from the altar'), []),
    ] },
  },
};

function themeCards(theme: DungeonTheme): EventCard[] {
  const id = (slot: RoomSlot, tier = 0) => dungeonCardId(theme.id, slot, tier);
  const guardFight = (enemies: string[], gold: number): Outcome[] => [{ do: 'fight', enemies, onWin: [{ do: 'gold', amount: gold }] }];
  const trap = TRAPS[theme.id];
  const special = SPECIALS[theme.id];
  const safe: Outcome[] = [{ do: 'xp', amount: 1 }, { do: 'gold', amount: 4 }];
  const sprung: Outcome[] = [{ do: 'hit', damage: 4 }];
  const cards: EventCard[] = [
    {
      id: id('trap'), hostile: true, title: trap.title, text: trap.text,
      steps: steps({ options: [
        opt(t('Przechodzę ostrożnie (Zr.)', 'Step through carefully (Dex)'), [{ do: 'test', attribute: 'dex', fail: [{ do: 'hit', damage: 4 }] }]),
        opt(t('Najpierw szukam mechanizmu (Int.)', 'Look for the mechanism first (Int)'), [{ do: 'test', attribute: 'int', pass: [{ do: 'goto', step: 'spotted' }], fail: [{ do: 'test', attribute: 'dex', modifier: -10, fail: [{ do: 'hit', damage: 5 }] }] }]),
      ] }, {
        spotted: { text: t('Widzisz, jak działa pułapka. Teraz łatwo ją ominąć.', 'You see how the trap works. Now it is easy to avoid.'), options: [
          opt(t('Omijam pułapkę (Zr. +20)', 'Step around the trap (Dex +20)'), [{ do: 'test', attribute: 'dex', modifier: 20, pass: [{ do: 'xp', amount: 1 }], fail: [{ do: 'hit', damage: 3 }] }]),
        ] },
      }),
    },
    {
      id: id('puzzleRunes'), hostile: false,
      title: t('Płyty z runami', 'Rune plates'),
      text: t('Podłogę przed Tobą tworzą trzy płyty z runami. Tylko jedna jest bezpieczna, dwie pozostałe uruchamiają pułapkę. Runy na ścianie zdradzają kolejność, która otwiera przejście.', 'Three rune plates make up the floor ahead. Only one is safe; the other two spring a trap. The runes on the wall show the order that opens the way.'),
      steps: steps({ options: [
        opt(t('Wciskam runy w dobrej kolejności (zamek, Int: dodatkowa próba)', 'Press the runes in the right order (lock, Int: an extra try)'), [{ do: 'puzzle', puzzle: {
          kind: 'lock', helper: { attribute: 'int' }, stat: 'int', length: 3, symbols: 5, tries: 4, win: safe, lose: sprung,
        } }]),
        opt(t('Wybieram w ciemno', 'Pick one blind'), [{ do: 'goto', step: 'guess' }]),
      ] }, {
        guess: { text: t('Runy nic Ci nie mówią. Trzeba wybrać.', 'The runes mean nothing to you. You have to choose.'), options:
          [t('Płyta z okiem', 'The eye plate'), t('Płyta z wężem', 'The snake plate'), t('Płyta z koroną', 'The crown plate')].map((label) =>
            opt(label, [{ do: 'roll', die: 3, table: [{ upTo: 1, then: safe }, { upTo: 3, then: sprung }] }])) },
      }),
    },
    {
      id: id('puzzleRiddle'), hostile: false,
      title: t('Zagadka strażnika', "The guardian's riddle"),
      text: t('Kamienna twarz w ścianie otwiera oczy i zadaje zagadkę. Zła odpowiedź budzi strażnika.', 'A stone face in the wall opens its eyes and asks a riddle. A wrong answer wakes the guard.'),
      steps: steps({ options: [
        opt(t('Odpowiadam (Int: mniej fałszywych liter)', 'Answer (Int: fewer false letters)'), [{ do: 'puzzle', puzzle: {
          kind: 'riddle', helper: { attribute: 'cha' }, stat: 'int', seconds: 45, fastSeconds: 20,
          win: safe, fast: [{ do: 'xp', amount: 1 }], lose: guardFight(theme.guards.slice(0, 1), 2),
        } }]),
        opt(t('Wolę walczyć ze strażnikiem', 'I would rather fight the guard'), guardFight(theme.guards.slice(0, 1), 2)),
      ] }),
    },
    {
      id: id('guard'), hostile: true,
      title: t('Strażnica', 'Guard room'),
      text: t('W komnacie ktoś obozuje. Strażnicy zrywają się na Twój widok.', 'Someone is camped in this room. The guards leap up when they see you.'),
      steps: steps({ options: [opt(t('Do walki!', 'Fight!'), guardFight(theme.guards, 3))] }),
    },
    {
      id: id('guard2'), hostile: true,
      title: t('Patrol', 'Patrol'),
      text: t('Zza zakrętu wychodzi patrol. Nie ma gdzie się schować.', 'A patrol comes round the corner. There is nowhere to hide.'),
      steps: steps({ options: [opt(t('Do walki!', 'Fight!'), guardFight(theme.guards.slice(0, 1), 2))] }),
    },
    { id: id('special'), hostile: false, title: special.title, text: special.text, steps: steps(special.start) },
    {
      id: id('shrine'), hostile: false,
      title: t('Kapliczka', 'Shrine'),
      text: t('Cicha komnata z czystym źródłem. Ktoś zostawił tu suche drewno. To jedyne bezpieczne miejsce w lochu.', 'A quiet room with a clear spring. Someone left dry wood here. It is the only safe place in the dungeon.'),
      steps: steps({ options: [
        opt(t('Rozbijam obóz (zmęczenie znika, +2 Żyw.)', 'Make camp (fatigue gone, +2 Vit)'), [{ do: 'camp' }]),
        opt(WALK_ON, []),
      ] }),
    },
    {
      id: id('side'), hostile: false,
      title: t('Boczny skarbczyk', 'Side treasury'),
      text: t('Okute drzwi w bocznej ścianie. Zamek dawno zardzewiał, ale drzwi wciąż trzymają.', 'Iron-bound doors in a side wall. The lock rusted long ago, but the doors still hold.'),
      steps: steps({ options: [
        opt(t('Wyważam drzwi (S)', 'Force the doors (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'gold', amount: 6 }, { do: 'randomItem' }], fail: [{ do: 'vitality', amount: -1 }] }]),
        opt(WALK_ON, []),
      ] }),
    },
    {
      id: id('boss'), hostile: true,
      title: t('Pan lochu', 'Lord of the dungeon'),
      text: theme.blurb,
      steps: steps({ options: [opt(t('Do walki!', 'Fight!'), [{ do: 'fight', enemies: [theme.boss] }])] }),
    },
  ];
  VAULT_REWARDS.forEach((r, tier) => {
    const loot: Outcome[] = [
      { do: 'gold', amount: r.gold },
      ...Array.from({ length: r.rare }, (): Outcome => ({ do: 'randomItem', rare: true })),
      ...Array.from({ length: r.common }, (): Outcome => ({ do: 'randomItem' })),
      { do: 'ores', amount: r.ores, rare: true },
      { do: 'item', item: theme.relic },
      ...(theme.id === 'mine' ? [{ do: 'skill', skill: 'mine', amount: 10 } as Outcome] : []),
      ...(theme.id === 'rift' ? [{ do: 'item', item: 'scrollTeleport' } as Outcome] : []),
      { do: 'xp', amount: r.xp },
    ];
    cards.push({
      id: id('vault', tier), hostile: false,
      title: t('Skarbiec', 'The vault'),
      text: t('Za ciałem pana lochu stoi ciężka skrzynia. Wieko ustępuje z jękiem zawiasów.', 'Behind the fallen lord stands a heavy chest. The lid gives way with a groan of hinges.'),
      steps: steps({ options: [opt(t('Otwieram skrzynię', 'Open the chest'), loot)] }),
    });
  });
  return cards;
}

export const DUNGEON_CARDS: EventCard[] = DUNGEON_THEME_IDS.flatMap((id) => themeCards(DUNGEON_THEMES[id]));

/** The theme a room card belongs to. */
export const themeOfCard = (card: number): DungeonThemeId | undefined => DUNGEON_THEME_IDS[Math.floor((card - DUNGEON_CARD_BASE) / 100)];
