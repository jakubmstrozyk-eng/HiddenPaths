import { ENEMIES, type Attribute, type Locale, type Outcome } from '@hp/content';
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

/** Short words for what a list of outcomes does, for buttons: "+2 złota · +1 PD · walka: Wilk". */
export function outcomeText(outcomes: Outcome[] | undefined, locale: Locale): string {
  if (!outcomes?.length) return locale === 'pl' ? 'nic' : 'nothing';
  const pl = locale === 'pl';
  const out: string[] = [];
  for (const o of outcomes) {
    switch (o.do) {
      case 'gold': out.push(`${signed(o.amount)} ${pl ? 'złota' : 'gold'}`); break;
      case 'food': out.push(`${signed(o.amount)} ${pl ? 'jedzenia' : 'food'}`); break;
      case 'xp': out.push(`${signed(o.amount)} ${pl ? 'PD' : 'XP'}`); break;
      case 'herbs': out.push(`${signed(o.amount)} ${pl ? 'ziół' : 'herbs'}`); break;
      case 'vitality': out.push(`${signed(o.amount)} ${pl ? 'Żyw.' : 'Vit'}`); break;
      case 'halfVitality': out.push(pl ? 'połowa Żywotności' : 'half your Vitality'); break;
      case 'effect': out.push(`${signed(o.amount)} ${attrName(o.target, locale)}${o.rounds ? ` ${pl ? 'na' : 'for'} ${o.rounds} ${pl ? 'rund' : 'rounds'}` : ` ${pl ? 'do końca gry' : 'for the game'}`}`); break;
      case 'permanent': out.push(`${signed(o.amount)} ${attrName(o.target, locale)} ${pl ? 'na stałe' : 'for good'}`); break;
      case 'skill': out.push(`${signed(o.amount)} ${(SKILL[o.skill] ?? [o.skill, o.skill])[pl ? 0 : 1]}`); break;
      case 'item': out.push(itemName(o.item, locale)); break;
      case 'randomItem': out.push(o.rare ? (pl ? 'rzadki przedmiot' : 'a rare item') : (pl ? 'losowy przedmiot' : 'a random item')); break;
      case 'rune': out.push(pl ? 'runa na broń' : 'a weapon rune'); break;
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
      case 'stuck': out.push(pl ? `utknięcie na ${o.rounds} rund` : `stuck for ${o.rounds} rounds`); break;
      case 'loseSpeed': out.push(pl ? 'utrata Szybkości' : 'lose your Speed'); break;
      case 'loseAll': out.push(pl ? 'utrata rzeczy' : 'lose your things'); break;
      case 'camp': out.push(pl ? 'darmowy obóz' : 'a free camp'); break;
      case 'peek': out.push(pl ? 'podgląd okolicy' : 'a look around'); break;
      case 'condition': out.push(o.name[locale]); break;
      case 'death': out.push(pl ? 'śmierć' : 'death'); break;
      case 'ifRace': out.push(outcomeText(o.then, locale)); break;
    }
  }
  return [...new Set(out)].join(' · ');
}

export type { Attribute };
