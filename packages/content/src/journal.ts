import type { EventOption, Outcome } from './eventTypes';
import type { Attribute, Text } from './types';

/**
 * The hero journal ("Dziennik Wędrowca", Jacob 2026-11-27): written at camp, it shapes the hero's character,
 * remembers people and foes, and grows into chapters of a legend told in inns.
 */

const t = (pl: string, en: string): Text => ({ pl, en });

/** The four axes of character. Answers at the campfire move the hero −1 (low side) or +1 (high side). */
export type JournalAxis = 'courage' | 'mercy' | 'curiosity' | 'honour';
export const JOURNAL_AXES: JournalAxis[] = ['courage', 'mercy', 'curiosity', 'honour'];

/** How far an axis runs each way, and how far the hero must lean to take on the trait of that side. */
export const AXIS_LIMIT = 5;
export const TRAIT_AT = 3;

export type TraitId = 'bold' | 'careful' | 'merciful' | 'ruthless' | 'curious' | 'prudent' | 'true' | 'schemer';

export interface Trait {
  id: TraitId;
  axis: JournalAxis;
  side: -1 | 1;
  name: Text;
  plus: Text;
  minus: Text;
}

export const AXIS_NAMES: Record<JournalAxis, { low: Text; high: Text }> = {
  courage: { low: t('Odwaga', 'Courage'), high: t('Rozwaga', 'Caution') },
  mercy: { low: t('Litość', 'Mercy'), high: t('Bezwzględność', 'Ruthlessness') },
  curiosity: { low: t('Ciekawość', 'Curiosity'), high: t('Rozsądek', 'Prudence') },
  honour: { low: t('Honor', 'Honour'), high: t('Spryt', 'Cunning') },
};

/** Every trait has one plus and one minus (Jacob, 2026-11-27: "zdecydowanie mogą mieć minusy i plusy"). */
export const TRAITS: Record<TraitId, Trait> = {
  bold: { id: 'bold', axis: 'courage', side: -1, name: t('Śmiałek', 'Daredevil'),
    plus: t('+5 do testów Siły Woli (strach, Koszmar, uroki).', '+5 to Willpower tests (fear, Nightmare, spells).'),
    minus: t('Ucieczka z walki −5.', 'Fleeing a fight −5.') },
  careful: { id: 'careful', axis: 'courage', side: 1, name: t('Ostrożny', 'Careful'),
    plus: t('+5 do testów Zręczności w lochu (pułapki).', '+5 to Dexterity tests in the dungeon (traps).'),
    minus: t('Pierwszy atak w każdej walce −5.', 'The first attack of every fight −5.') },
  merciful: { id: 'merciful', axis: 'mercy', side: -1, name: t('Litościwy', 'Merciful'),
    plus: t('+5 Charyzmy w osadach. Własne, łagodne wybory na niektórych kartach.', '+5 Charisma in settlements. Gentle choices of its own on some cards.'),
    minus: t('Po walce z ludźmi zabiera 1 złoto mniej.', 'Takes 1 gold less after a fight with people.') },
  ruthless: { id: 'ruthless', axis: 'mercy', side: 1, name: t('Bezwzględny', 'Ruthless'),
    plus: t('+1 złota po walce z ludźmi. Wybory siłowe (zastraszenie, S.) na niektórych kartach.', '+1 gold after a fight with people. Rough choices (intimidation, Str) on some cards.'),
    minus: t('−5 Charyzmy w osadach.', '−5 Charisma in settlements.') },
  curious: { id: 'curious', axis: 'curiosity', side: -1, name: t('Dociekliwy', 'Curious'),
    plus: t('+5 Inteligencji w kartach wydarzeń. Wybory „zbadaj, wypytaj” na niektórych kartach.', '+5 Intelligence on event cards. "Look closer, ask around" choices on some cards.'),
    minus: t('−5 Zręczności w lochu (pułapki trafiają częściej).', '−5 Dexterity in the dungeon (traps hit more often).') },
  prudent: { id: 'prudent', axis: 'curiosity', side: 1, name: t('Rozważny', 'Prudent'),
    plus: t('Pierwszy test w każdym zejściu do lochu łatwy (+10).', 'The first test of every trip down the dungeon is easy (+10).'),
    minus: t('−5 Inteligencji w kartach wydarzeń.', '−5 Intelligence on event cards.') },
  true: { id: 'true', axis: 'honour', side: -1, name: t('Słowny', 'True to his word'),
    plus: t('Spełnione postanowienie: +1 Punkt Doświadczenia więcej.', 'A kept vow: +1 more Experience Point.'),
    minus: t('Porzucone postanowienie zabiera Natchnienie.', 'An abandoned vow takes away Inspiration.') },
  schemer: { id: 'schemer', axis: 'honour', side: 1, name: t('Kombinator', 'Schemer'),
    plus: t('+5 Charyzmy w kartach wydarzeń. Wybory „oszukaj” na niektórych kartach.', '+5 Charisma on event cards. "Trick" choices on some cards.'),
    minus: t('Spełnione postanowienie: 1 Punkt Doświadczenia mniej.', 'A kept vow: 1 Experience Point less.') },
};

export const TRAIT_OF: Record<JournalAxis, { low: TraitId; high: TraitId }> = {
  courage: { low: 'bold', high: 'careful' },
  mercy: { low: 'merciful', high: 'ruthless' },
  curiosity: { low: 'curious', high: 'prudent' },
  honour: { low: 'true', high: 'schemer' },
};

/** What a campfire question is about: the most telling thing since the last entry. */
export type PromptTopic = 'nightmare' | 'plague' | 'enthralled' | 'condition' | 'fightWon' | 'fled' | 'died' | 'person' | 'dungeon' | 'event' | 'explore' | 'town';

export interface PromptAnswer { text: Text; axis: JournalAxis; delta: -1 | 1 }
export interface JournalPrompt { id: string; topic: PromptTopic; question: Text; answers: PromptAnswer[] }

const a = (pl: string, en: string, axis: JournalAxis, delta: -1 | 1): PromptAnswer => ({ text: t(pl, en), axis, delta });

/** Questions asked at the campfire. `{name}` is the person, foe or place the question is about. */
export const JOURNAL_PROMPTS: JournalPrompt[] = [
  { id: 'witch', topic: 'enthralled', question: t('Urok przez kilka chwil kierował twoimi krokami. Co z tego zapamiętasz?', 'A spell steered your steps for a while. What will you remember?'), answers: [
    a('„Że nikt już nie odbierze mi woli.”', '"That nobody will take my will again."', 'courage', -1),
    a('„Że trzeba ją znaleźć i skończyć to raz na zawsze.”', '"That she must be found and stopped for good."', 'mercy', 1),
    a('„Że nawet ona była kiedyś kimś innym.”', '"That even she was someone else once."', 'mercy', -1),
  ] },
  { id: 'nightmare', topic: 'nightmare', question: t('Koszmar wciąż wraca, gdy zamykasz oczy. Co z nim robisz?', 'The nightmare comes back when you close your eyes. What do you do with it?'), answers: [
    a('„Patrzę mu w oczy. Strach to tylko sen.”', '"I look it in the eye. Fear is only a dream."', 'courage', -1),
    a('„Śpię z mieczem pod ręką i nie śpię długo.”', '"I sleep with my sword at hand, and not for long."', 'courage', 1),
    a('„Zapisuję każdy szczegół. Sny coś znaczą.”', '"I write down every detail. Dreams mean something."', 'curiosity', -1),
  ] },
  { id: 'plague', topic: 'plague', question: t('Gorączka trawi cię od środka. Co myślisz, leżąc przy ogniu?', 'The fever burns inside you. What do you think, lying by the fire?'), answers: [
    a('„Przetrwam. Zawsze przetrwam.”', '"I will last. I always do."', 'courage', -1),
    a('„Następnym razem ominę zatęchłe miejsca.”', '"Next time I will keep away from foul places."', 'curiosity', 1),
    a('„Obiecuję sobie, że jeśli wyzdrowieję, pomogę innym chorym.”', '"I promise that if I heal, I will help others who are sick."', 'honour', -1),
  ] },
  { id: 'condition', topic: 'condition', question: t('Coś ciąży ci na ciele i duszy. Jak sobie z tym radzisz?', 'Something weighs on your body and soul. How do you cope?'), answers: [
    a('„Idę dalej, choćby na czworakach.”', '"I go on, even on all fours."', 'courage', -1),
    a('„Odpoczywam. Głupi pośpiech zabija.”', '"I rest. Foolish haste kills."', 'courage', 1),
    a('„Szukam kogoś, kto mi pomoże, i nie wstydzę się prosić.”', '"I look for someone to help me, and I am not ashamed to ask."', 'honour', -1),
  ] },
  { id: 'fight', topic: 'fightWon', question: t('Walka skończona (przeciwnik: {name}). Co czujesz, patrząc na pokonanego?', 'The fight is over (foe: {name}). What do you feel, looking at the fallen?'), answers: [
    a('„Nic. Tak wygląda ten świat.”', '"Nothing. That is how this world is."', 'mercy', 1),
    a('„Żal. Wolałbym, żeby to się skończyło inaczej.”', '"Sorrow. I wish it had ended otherwise."', 'mercy', -1),
    a('„Ciekawość. Muszę zrozumieć, jak walczył.”', '"Curiosity. I must understand how it fought."', 'curiosity', -1),
  ] },
  { id: 'fled', topic: 'fled', question: t('Ucieczka z walki (przeciwnik: {name}). Jak to zapiszesz?', 'You ran from a fight (foe: {name}). How will you write it down?'), answers: [
    a('„Mądry wojownik wie, kiedy odejść.”', '"A wise fighter knows when to leave."', 'courage', 1),
    a('„Wrócę i dokończę tę walkę.”', '"I will come back and finish this fight."', 'courage', -1),
    a('„Napiszę, że to był podstęp. Nikt nie musi wiedzieć.”', '"I will write it was a ruse. Nobody needs to know."', 'honour', 1),
  ] },
  { id: 'died', topic: 'died', question: t('Przebudzenie daleko od miejsca upadku. Czego nauczyła cię śmierć?', 'You woke far from where you fell. What did death teach you?'), answers: [
    a('„Że nie ma czego się bać.”', '"That there is nothing to fear."', 'courage', -1),
    a('„Że trzeba patrzeć pod nogi.”', '"That I must watch my step."', 'courage', 1),
    a('„Że muszę dowiedzieć się, co mnie zabiło.”', '"That I must find out what killed me."', 'curiosity', -1),
  ] },
  { id: 'person', topic: 'person', question: t('Spotkanie: {name}. Co o tym myślisz?', 'A meeting: {name}. What do you make of it?'), answers: [
    a('„Dane słowo to rzecz święta.”', '"A word given is sacred."', 'honour', -1),
    a('„Każdy chce czegoś ode mnie. Ja też umiem brać.”', '"Everyone wants something from me. I can take too."', 'honour', 1),
    a('„Chcę wiedzieć o tej osobie więcej.”', '"I want to know more about this person."', 'curiosity', -1),
  ] },
  { id: 'dungeon', topic: 'dungeon', question: t('W ciemności lochu słyszałeś własne serce. Co cię tam pchało?', 'In the dark of the dungeon you heard your own heart. What drove you on?'), answers: [
    a('„Skarb. Zawsze chodzi o skarb.”', '"Treasure. It is always about treasure."', 'honour', 1),
    a('„Tajemnica. Kto zbudował te komnaty?”', '"The mystery. Who built these rooms?"', 'curiosity', -1),
    a('„Ostrożność. Krok po kroku, kamień po kamieniu.”', '"Care. Step by step, stone by stone."', 'curiosity', 1),
  ] },
  { id: 'event', topic: 'event', question: t('Przygoda „{name}” wciąż chodzi ci po głowie. Co z niej wynosisz?', 'The adventure "{name}" is still on your mind. What do you take from it?'), answers: [
    a('„Następnym razem rzucę się na głęboką wodę.”', '"Next time I will jump in at the deep end."', 'courage', -1),
    a('„Następnym razem dwa razy się zastanowię.”', '"Next time I will think twice."', 'curiosity', 1),
    a('„Liczy się to, jak potraktowałem innych.”', '"What matters is how I treated others."', 'mercy', -1),
  ] },
  { id: 'explore', topic: 'explore', question: t('Mapa w twoim dzienniku urosła o kilka nowych krain. Co zapiszesz na marginesie?', 'The map in your journal grew by a few lands. What will you write in the margin?'), answers: [
    a('„Za horyzontem musi być coś jeszcze.”', '"There must be something more past the horizon."', 'curiosity', -1),
    a('„Najkrótsza droga do najbliższej osady.”', '"The shortest way to the nearest settlement."', 'curiosity', 1),
    a('„Miejsca, gdzie ukryłbym się przed pościgiem.”', '"Places where I would hide from a chase."', 'honour', 1),
  ] },
  { id: 'town', topic: 'town', question: t('Ludzie w osadzie przyglądali ci się długo. Kim chcesz dla nich być?', 'The people of the settlement watched you a long time. Who do you want to be to them?'), answers: [
    a('„Kimś, komu można zaufać.”', '"Someone they can trust."', 'honour', -1),
    a('„Kimś, kogo lepiej nie drażnić.”', '"Someone better not crossed."', 'mercy', 1),
    a('„Kimś, kto pomaga, nawet gdy nikt nie patrzy.”', '"Someone who helps even when nobody is watching."', 'mercy', -1),
  ] },
];

/** A vow for the next stretch of play: one at a time, kept across games. */
export type VowKind = 'fights' | 'explore' | 'dungeon' | 'hunts' | 'events' | 'town';
export interface VowDef { kind: VowKind; need: number; text: Text }

export const VOWS: VowDef[] = [
  { kind: 'fights', need: 2, text: t('Wygram dwie walki.', 'I will win two fights.') },
  { kind: 'explore', need: 5, text: t('Odkryję pięć nowych fragmentów.', 'I will reveal five new fragments.') },
  { kind: 'dungeon', need: 1, text: t('Wejdę do komnaty lochu.', 'I will enter a dungeon room.') },
  { kind: 'hunts', need: 2, text: t('Dwa razy upoluję zwierzynę.', 'I will hunt game twice.') },
  { kind: 'events', need: 2, text: t('Stawię czoła dwóm przygodom.', 'I will face two adventures.') },
  { kind: 'town', need: 1, text: t('Dotrę do osady.', 'I will reach a settlement.') },
];

/** XP for a kept vow (Jacob, 2026-11-27: "+2 PD za realizację postanowienia tak"). */
export const VOW_XP = 2;

/** People met on event cards: the journal remembers them, and they may cross the hero's path again. */
export interface JournalPerson { id: string; name: Text; cards: number[] }
export const JOURNAL_PEOPLE: JournalPerson[] = [
  { id: 'sage', name: t('Mędrzec Opiekunów', 'The Keeper sage'), cards: [2] },
  { id: 'satyr', name: t('Satyr od zagadek', 'The riddling satyr'), cards: [5] },
  { id: 'sunborn', name: t('Młoda Słoneczna wojowniczka', 'The young Sunborn fighter'), cards: [8] },
  { id: 'caravan', name: t('Woźnica karawany', 'The caravan driver'), cards: [12] },
  { id: 'merchant', name: t('Wędrowny kupiec', 'The wandering merchant'), cards: [15] },
  { id: 'witch', name: t('Czarownica', 'The witch'), cards: [24] },
  { id: 'nomads', name: t('Nomadzi przy ognisku', 'The Nomads by the fire'), cards: [25] },
  { id: 'smith', name: t('Runiczny kowal', 'The runic smith'), cards: [29] },
  { id: 'wrestler', name: t('Skałogrzmot od siłowania', 'The arm-wrestling Flintborn'), cards: [37] },
  { id: 'keeper', name: t('Opiekun', 'The keeper'), cards: [47, 54] },
  { id: 'pickpocket', name: t('Złodziejaszek', 'The pickpocket'), cards: [51] },
  { id: 'bard', name: t('Wędrowny bard', 'The wandering bard'), cards: [53] },
  { id: 'gambler', name: t('Nomada z kośćmi', 'The Nomad with the dice'), cards: [56] },
];
export const PERSON_OF_CARD: Record<number, string> = Object.fromEntries(JOURNAL_PEOPLE.flatMap((p) => p.cards.map((c) => [c, p.id])));

export type PersonMark = 'friend' | 'debtor' | 'foe';
export const PERSON_MARKS: Record<PersonMark, Text> = {
  friend: t('Przyjaciel', 'Friend'), debtor: t('Dłużnik', 'Owes me'), foe: t('Wróg', 'Foe'),
};
/** Meeting someone the journal remembers: the hero knows what to expect, +10 to the card's tests. */
export const RETURN_BONUS = 10;

/** Bestiary notes: a guess at a foe's nature. The true one matches its strongest attribute. */
export const BESTIARY_NOTES: Record<'dex' | 'str' | 'wil' | 'int' | 'com', Text> = {
  dex: t('Jest szybki i zwinny. Trzeba go zmęczyć.', 'It is quick and nimble. It must be worn down.'),
  str: t('Jest silny, ale ciężki. Trzeba unikać ciosów.', 'It is strong but heavy. Its blows must be dodged.'),
  wil: t('Ma żelazną wolę. Strach go nie ima.', 'It has an iron will. Fear does not touch it.'),
  int: t('Jest sprytny. Przewiduje moje ruchy.', 'It is clever. It sees my moves coming.'),
  com: t('To urodzony wojownik. Każdy błąd kosztuje.', 'A born fighter. Every mistake costs.'),
};
/** A confirmed note: +5 to the first test of a fight against that foe (not with Scalp, Jacob 2026-11-27). */
export const LORE_BONUS = 5;

/** The lessons a closed chapter offers. */
export type LessonId = 'attribute' | 'friend' | 'stars';
export const LESSONS: Record<LessonId, { name: Text; text: Text }> = {
  attribute: { name: t('Lekcja doświadczenia', 'A lesson of experience'), text: t('+2 do cechy, której używałeś najczęściej w tym rozdziale (najwyżej 3 razy na cechę).', '+2 to the attribute you used most in this chapter (at most 3 times an attribute).') },
  friend: { name: t('Znajomość w mieście', 'A friend in town'), text: t('Posiłek i nocleg w osadach kosztują 1 złoto mniej.', 'Meals and stays in settlements cost 1 gold less.') },
  stars: { name: t('Obóz pod gwiazdami', 'A camp under the stars'), text: t('Raz na grę obozowisko leczy 4 Żywotności zamiast 2.', 'Once a game a camp heals 4 Vitality instead of 2.') },
};
export const LESSON_NAMES: Partial<Record<Attribute, Text>> = {
  dex: t('Lekka stopa', 'Light foot'), str: t('Twarda ręka', 'Hard hand'), wil: t('Niezłomny duch', 'Unbroken spirit'),
  int: t('Bystre oko', 'Sharp eye'), cha: t('Dar słowa', 'Gift of words'), com: t('Weteran', 'Veteran'),
};
export const ATTRIBUTE_LESSON = 2;
export const ATTRIBUTE_LESSON_MAX = 3;
/** Entries in one chapter. */
export const CHAPTER_ENTRIES = 5;

/** Telling a story in the inn: Charisma +5 for each closed chapter, at most +15. */
export const STORY_BONUS = { each: 5, max: 15 };
export const STORY_REWARD: Outcome[] = [{ do: 'food', amount: 1 }, { do: 'gold', amount: 2 }];

/** A rewarded entry needs this many new things in the chronicle since the last rewarded one (Jacob, 2026-11-27). */
export const ENTRY_EVENTS = 3;

/** Choices that only a hero with a trait sees, added to the start of these cards. */
export interface TraitOption { card: number; trait: TraitId; option: Omit<EventOption, 'trait'> }
const o = (label: Text, then: Outcome[]): Omit<EventOption, 'trait'> => ({ label, then });
const WITCH_SPELL: Outcome[] = [{ do: 'stuck', rounds: 1 }, { do: 'condition', id: 'enthralled', name: t('Zauroczenie', 'Enthralled'), test: 'wil', modifier: -5, worsen: -5, each: [{ do: 'stuck', rounds: 1 }] }];
export const TRAIT_OPTIONS: TraitOption[] = [
  { card: 24, trait: 'bold', option: o(t('Śpiewam głośniej od niej (SW)', 'Sing louder than her (Wil)'), [{ do: 'test', attribute: 'wil', pass: [{ do: 'xp', amount: 1 }], fail: WITCH_SPELL }]) },
  { card: 24, trait: 'curious', option: o(t('Wsłuchuję się w słowa pieśni (Int.)', 'Listen to the words of the song (Int)'), [{ do: 'test', attribute: 'int', pass: [{ do: 'xp', amount: 1 }, { do: 'herbs', amount: 2 }], fail: WITCH_SPELL }]) },
  { card: 25, trait: 'merciful', option: o(t('Dzielę się z nimi chlebem (Ch.)', 'Share bread with them (Cha)'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'xp', amount: 1 }, { do: 'food', amount: 2 }, { do: 'peek' }], fail: [{ do: 'gold', amount: -1 }] }]) },
  { card: 25, trait: 'ruthless', option: o(t('Zastraszam ich (S.)', 'Intimidate them (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'gold', amount: 3 }, { do: 'xp', amount: 1 }], fail: [{ do: 'fight', enemies: ['nomadWarrior', 'nomadWarrior'] }] }]) },
  { card: 51, trait: 'merciful', option: o(t('Puszczam go wolno i pytam o okolicę', 'Let him go and ask about the area'), [{ do: 'peek' }, { do: 'xp', amount: 1 }]) },
  { card: 51, trait: 'ruthless', option: o(t('Łapię go i przetrząsam mu kieszenie (Zr.)', 'Grab him and turn out his pockets (Dex)'), [{ do: 'test', attribute: 'dex', pass: [{ do: 'gold', amount: 3 }], fail: [{ do: 'gold', amount: -1 }] }]) },
  { card: 15, trait: 'schemer', option: o(t('Wciskam mu „magiczny” kamień (Ch.)', 'Sell him a "magic" pebble (Cha)'), [{ do: 'test', attribute: 'cha', pass: [{ do: 'gold', amount: 3 }], fail: [{ do: 'gold', amount: -1 }] }]) },
  { card: 15, trait: 'true', option: o(t('Pomagam mu naprawić wóz (S.)', 'Help him mend his cart (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'item', item: 'reinforcedBoots' }], fail: [{ do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }]) },
  { card: 12, trait: 'curious', option: o(t('Wypytuję woźniców o drogę (Int.)', 'Ask the drivers about the road (Int)'), [{ do: 'test', attribute: 'int', pass: [{ do: 'peek' }, { do: 'xp', amount: 1 }] }]) },
  { card: 12, trait: 'prudent', option: o(t('Idę obok karawany, z dala od kłopotów', 'Walk beside the caravan, clear of trouble'), [{ do: 'food', amount: 1 }, { do: 'xp', amount: 1 }]) },
  { card: 37, trait: 'schemer', option: o(t('Łaskoczę go pod stołem (Zr.)', 'Tickle him under the table (Dex)'), [{ do: 'test', attribute: 'dex', pass: [{ do: 'gold', amount: 2 }, { do: 'xp', amount: 1 }], fail: [{ do: 'gold', amount: -2 }] }]) },
  { card: 2, trait: 'curious', option: o(t('Zadaję mędrcowi trudne pytania (Int.)', 'Ask the sage hard questions (Int)'), [{ do: 'test', attribute: 'int', modifier: -10, pass: [{ do: 'permanent', target: 'int', amount: 5 }] }]) },
  { card: 27, trait: 'bold', option: o(t('Patrzę koszmarowi w oczy (SW +10)', 'Stare the nightmare down (Wil +10)'), [{ do: 'test', attribute: 'wil', modifier: 10, pass: [{ do: 'xp', amount: 1 }], fail: [{ do: 'effect', target: 'all', amount: -10, rounds: 1 }, { do: 'condition', id: 'nightmare', name: t('Koszmar', 'Nightmare'), test: 'wil', each: [{ do: 'effect', target: 'all', amount: -10, rounds: 1 }] }] }]) },
  { card: 29, trait: 'true', option: o(t('Odpracowuję runę w kuźni (S.)', 'Work off a rune at the forge (Str)'), [{ do: 'test', attribute: 'str', pass: [{ do: 'rune' }], fail: [{ do: 'effect', target: 'stamina', amount: -1, rounds: 1 }] }]) },
];

/** Cover of the journal, by the number of entries: only for show. */
export const JOURNAL_COVERS = [
  { from: 0, name: t('Płócienna okładka', 'Cloth cover') },
  { from: 5, name: t('Skórzana okładka', 'Leather cover') },
  { from: 10, name: t('Okładka z pieczęcią', 'Sealed cover') },
  { from: 20, name: t('Okładka ze złotym okuciem', 'Gold-bound cover') },
];
