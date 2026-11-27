import { ENEMIES, type Attribute, type Locale, type Outcome, type Text } from '@hp/content';
import { itemName } from './logText';

const ATTR: Record<string, [string, string]> = {
  dex: ['Zręczność', 'Dexterity'], cha: ['Charyzma', 'Charisma'], str: ['Siła', 'Strength'], wil: ['Siła Woli', 'Willpower'],
  int: ['Inteligencja', 'Intelligence'], com: ['Walka', 'Combat'], all: ['wszystkie cechy', 'all attributes'],
  speed: ['Szybkość', 'Speed'], stamina: ['Wytrzymałość', 'Stamina'], damage: ['obrażenia', 'damage'], maxVitality: ['maks. Żywotność', 'max Vitality'],
};
const SKILL: Record<string, [string, string]> = {
  hunt: ['Łowiectwo', 'Hunting'], gather: ['Zbieractwo', 'Gathering'], herbalism: ['Zielarstwo', 'Herbalism'], mine: ['Wydobycie', 'Mining'],
};
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

export const attrName = (a: string, locale: Locale) => (ATTR[a] ?? [a, a])[locale === 'pl' ? 0 : 1];

/** The test an option asks for, as "Charyzma −10", or null when it has none. */
export function testOf(outcomes: Outcome[]): Extract<Outcome, { do: 'test' }> | null {
  for (const o of outcomes) if (o.do === 'test') return o;
  return null;
}

export function testLabel(o: Extract<Outcome, { do: 'test' }>, locale: Locale): string {
  return `${attrName(o.attribute, locale)}${o.modifier ? ` ${signed(o.modifier)}` : ''}`;
}

/** A choice's words without the test note in brackets: "Opieram się zawodzeniu (SW +10)" → "Opieram się zawodzeniu". */
export const choiceWords = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** What a throw on an event card is for: "Test: Siła Woli +10 · Opieram się zawodzeniu". */
export function eventTestHeading(o: Extract<Outcome, { do: 'test' }>, label: string, locale: Locale): string {
  return `${locale === 'pl' ? 'Test' : 'Test'}: ${testLabel(o, locale)} · ${choiceWords(label)}`;
}

/** Short words for what a list of outcomes does, for buttons: "+2 złota · +1 PD · walka: Wilk". */
export function outcomeText(outcomes: Outcome[] | undefined, locale: Locale): string {
  if (!outcomes?.length) return locale === 'pl' ? 'nic' : 'nothing';
  const pl = locale === 'pl';
  const out: string[] = [];
  // Experience goes last and in full words: it matters less than what the choice does.
  let xp = 0;
  for (const o of outcomes) {
    switch (o.do) {
      case 'gold': out.push(`${signed(o.amount)} ${pl ? 'złota' : 'gold'}`); break;
      case 'food': out.push(`${signed(o.amount)} ${pl ? 'jedzenia' : 'food'}`); break;
      case 'xp': xp += o.amount; break;
      case 'herbs': out.push(`${signed(o.amount)} ${pl ? 'ziół' : 'herbs'}`); break;
      case 'vitality': out.push(`${signed(o.amount)} ${pl ? 'Żyw.' : 'Vit'}`); break;
      case 'hit': out.push(pl ? `cios za ${o.damage} (k6 na miejsce, pancerz chroni)` : `a ${o.damage}-point blow (d6 for the spot, armour helps)`); break;
      case 'halfVitality': out.push(pl ? 'połowa Żywotności' : 'half your Vitality'); break;
      case 'effect': out.push(`${signed(o.amount)} ${attrName(o.target, locale)}${o.rounds ? ` ${pl ? 'na' : 'for'} ${roundsWord(o.rounds, locale)}` : ` ${pl ? 'do końca gry' : 'for the game'}`}`); break;
      case 'permanent': out.push(`${signed(o.amount)} ${attrName(o.target, locale)} ${pl ? 'na stałe' : 'for good'}`); break;
      case 'skill': out.push(`${signed(o.amount)} ${(SKILL[o.skill] ?? [o.skill, o.skill])[pl ? 0 : 1]}`); break;
      case 'item': out.push(itemName(o.item, locale)); break;
      case 'randomItem': out.push(o.rare ? (pl ? 'rzadki przedmiot' : 'a rare item') : (pl ? 'losowy przedmiot' : 'a random item')); break;
      case 'ores': out.push(`${o.amount} ${o.rare ? (pl ? 'rzadkie surowce' : 'rare ores') : (pl ? 'surowce' : 'ores')}`); break;
      case 'rune': out.push(o.rune ? `${pl ? 'runa' : 'rune'}: ${RUNE_NAME[o.rune][locale]}` : (pl ? 'runa na broń' : 'a weapon rune')); break;
      case 'fight': out.push(`${pl ? 'walka' : 'fight'}: ${o.enemies.map((e) => ENEMIES[e]?.name[locale] ?? e).join(', ')}`); break;
      case 'fightRandom': out.push(pl ? 'walka z losowym wrogiem' : 'a fight with a random foe'); break;
      case 'test': {
        const pass = outcomeText(o.pass, locale);
        out.push(`${pl ? 'test' : 'test'} ${testLabel(o, locale)}: ${pass}`);
        break;
      }
      case 'roll': out.push(pl ? `rzut k${o.die} na tabelę` : `a d${o.die} roll on a table`); break;
      case 'goto': out.push(pl ? 'ciąg dalszy' : 'the story goes on'); break;
      case 'move': out.push(pl ? 'przeniesienie' : 'you are moved'); break;
      case 'stuck': out.push(pl ? `utknięcie na ${roundsWord(o.rounds, locale)}` : `stuck for ${roundsWord(o.rounds, locale)}`); break;
      case 'loseSpeed': out.push(pl ? 'utrata Szybkości' : 'lose your Speed'); break;
      case 'loseAll': out.push(pl ? 'utrata rzeczy' : 'lose your things'); break;
      case 'camp': out.push(pl ? 'darmowy obóz' : 'a free camp'); break;
      case 'peek': out.push(pl ? 'podgląd okolicy' : 'a look around'); break;
      case 'condition': out.push(o.name[locale]); break;
      case 'death': out.push(pl ? 'śmierć' : 'death'); break;
      case 'puzzle': out.push(`${pl ? 'mini-gra' : 'mini-game'}: ${PUZZLE_NAME[o.puzzle.kind][locale]}`); break;
      case 'ifRace': out.push(outcomeText(o.then, locale)); break;
      case 'loseItem': out.push(o.item ? `${pl ? 'tracisz' : 'you lose'}: ${itemName(o.item, locale)}` : (pl ? 'tracisz skradzioną rzecz' : 'you lose the stolen thing')); break;
      case 'bookRead': out.push(pl ? 'udana lektura' : 'a good reading'); break;
    }
  }
  if (xp) out.push(`${signed(xp)} ${xpWords(xp, locale)}`);
  return [...new Set(out)].join(' · ');
}

/** "1 rundę", "3 rundy", "5 rund" (or "1 round", "3 rounds"). */
function roundsWord(n: number, locale: Locale): string {
  if (locale !== 'pl') return `${n} ${n === 1 ? 'round' : 'rounds'}`;
  if (n === 1) return '1 rundę';
  const last = n % 10;
  const tens = n % 100;
  return `${n} ${last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? 'rundy' : 'rund'}`;
}

/** "Punkt Doświadczenia", "Punkty Doświadczenia" or "Punktów Doświadczenia", as the number asks. */
export function xpWords(n: number, locale: Locale): string {
  if (locale !== 'pl') return Math.abs(n) === 1 ? 'Experience Point' : 'Experience Points';
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return 'Punktu Doświadczenia';
  if (a === 1) return 'Punkt Doświadczenia';
  const last = a % 10;
  const tens = a % 100;
  return last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? 'Punkty Doświadczenia' : 'Punktów Doświadczenia';
}

export type { Attribute };

export const PUZZLE_NAME: Record<Extract<Outcome, { do: 'puzzle' }>['puzzle']['kind'], Text> = {
  riddle: { pl: 'Zagadka', en: 'Riddle' },
  quiz: { pl: 'Quiz', en: 'Quiz' },
  cups: { pl: 'Trzy karty', en: 'Three cards' },
  forge: { pl: 'Kucie', en: 'Forging' },
  climb: { pl: 'Wspinaczka', en: 'Climb' },
  chests: { pl: 'Łamigłówka', en: 'Logic puzzle' },
  traps: { pl: 'Pamięć', en: 'Memory' },
  lock: { pl: 'Szyfr run', en: 'Rune code' },
  higherLower: { pl: 'Wyżej czy niżej', en: 'Higher or lower' },
  dig: { pl: 'Ryzyko', en: 'Push your luck' },
  sequence: { pl: 'Melodia', en: 'Tune' },
  escape: { pl: 'Ucieczka', en: 'Escape' },
  differences: { pl: 'Różnice', en: 'Differences' },
  tug: { pl: 'Siłowanie', en: 'Tug of strength' },
  pairs: { pl: 'Pary', en: 'Pairs' },
  hold: { pl: 'Skupienie', en: 'Focus' },
  missing: { pl: 'Czego brakuje?', en: 'What is missing?' },
  scale: { pl: 'Waga', en: 'Scales' },
  stars: { pl: 'Gwiazdy', en: 'Stars' },
  bluff: { pl: 'Blef', en: 'Bluff' },
  catch: { pl: 'Łapanie', en: 'Catching' },
  slider: { pl: 'Przesuwanka', en: 'Sliding puzzle' },
};

const RUNE_NAME: Record<'venom' | 'sharp' | 'precise' | 'stunning' | 'piercing', Text> = {
  venom: { pl: 'zatruta', en: 'venom' }, sharp: { pl: 'ostra', en: 'sharp' }, precise: { pl: 'precyzyjna', en: 'precise' },
  stunning: { pl: 'porażająca', en: 'stunning' }, piercing: { pl: 'przebijająca', en: 'piercing' },
};

/** The best a puzzle can bring, for its choice on the card. */
export function puzzleBest(p: Extract<Outcome, { do: 'puzzle' }>['puzzle']): Outcome[] {
  switch (p.kind) {
    case 'riddle': return [...p.win, ...p.fast];
    case 'cups': case 'lock': case 'traps': case 'escape': case 'tug': case 'missing': case 'scale': case 'slider': return p.win;
    case 'chests': return p.treasure;
    case 'dig': return p.bottom ?? [{ do: 'randomItem' }];
    default: return p.byScore[p.byScore.length - 1] ?? [];
  }
}

/** What failing a puzzle costs, if anything. */
export function puzzleWorst(p: Extract<Outcome, { do: 'puzzle' }>['puzzle']): Outcome[] {
  switch (p.kind) {
    case 'riddle': case 'cups': case 'lock': case 'tug': case 'scale': case 'slider': return p.lose;
    case 'escape': return [...(p.burn ?? []), ...p.lose];
    case 'missing': return [...p.lose, { do: 'loseItem', item: '' }];
    case 'traps': return p.hit;
    case 'chests': return p.blast;
    case 'dig': return p.bust;
    default: return p.byScore[0] ?? [];
  }
}
