import { ATTRIBUTES, ENEMIES, HERBS, ITEMS, MATERIALS, MISSIONS, PROFESSIONS, type Attribute, type Locale, type Text } from '@hp/content';
import type { LogEntry } from '@hp/engine';
import type { useT } from './i18n';

type T = ReturnType<typeof useT>;

/** One die thrown on screen. A d100 test shows as two d10s (tens and units). */
export type DiceRoll =
  | { kind: 'd100'; value: number; target: number; success: boolean; label: string }
  | { kind: 'plain'; sides: number; value: number; label: string };

const ATTR: Record<Attribute, Text> = {
  dex: { pl: 'Zr', en: 'Dex' }, cha: { pl: 'Ch', en: 'Cha' }, str: { pl: 'S', en: 'Str' },
  wil: { pl: 'SW', en: 'Wil' }, int: { pl: 'Int', en: 'Int' }, com: { pl: 'Walka', en: 'Combat' },
};
export const attrShort = (a: string, locale: Locale) =>
  (ATTRIBUTES as readonly string[]).includes(a) ? ATTR[a as Attribute][locale] : a;

export function itemName(id: string, locale: Locale): string {
  if (id === 'food') return locale === 'pl' ? 'Pożywienie' : 'Food';
  const t = ITEMS[id]?.name ?? MATERIALS[id as keyof typeof MATERIALS]?.name ?? HERBS[id as keyof typeof HERBS]?.name;
  return t ? t[locale] : id;
}

export function cardName(id: string, locale: Locale): string {
  for (const prof of Object.values(PROFESSIONS)) {
    const card = prof.cards.find((c) => c.id === id);
    if (card) return card.name[locale];
  }
  return id;
}

export function foeName(uid: string, locale: Locale): string {
  const id = uid.replace(/-\d+$/, '');
  const n = uid.match(/-(\d+)$/)?.[1];
  const name = ENEMIES[id]?.name[locale] ?? uid;
  return n ? `${name} ${n}` : name;
}

/** The dice an action threw, in the order they were thrown. */
export function diceOf(entries: LogEntry[], { locale }: T): DiceRoll[] {
  const out: DiceRoll[] = [];
  for (const e of entries) {
    if (e.type === 'check') out.push({ kind: 'd100', value: e.result.roll, target: e.result.target, success: e.result.success, label: attrShort(e.attribute, locale) });
    if (e.type === 'test' && e.result.roll > 0) out.push({ kind: 'd100', value: e.result.roll, target: e.result.target, success: e.result.success, label: attrShort(e.attribute, locale) });
    if (e.type === 'roll') out.push({ kind: 'plain', sides: e.die, value: e.value, label: `k${e.die}` });
    if (e.type === 'combat' && e.event.type === 'strike') {
      const by = e.event.by === 'hero' ? (locale === 'pl' ? 'Ty' : 'You') : foeName(e.event.by, locale);
      out.push({ kind: 'd100', value: e.event.result.roll, target: e.event.result.target, success: e.event.result.success, label: by });
    }
    if (e.type === 'combat' && e.event.type === 'flee') {
      out.push({ kind: 'd100', value: e.event.hero.roll, target: e.event.hero.target, success: e.event.hero.success, label: attrShort('dex', locale) });
    }
  }
  return out;
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/0$/, ''));

/** A short line for each log entry worth showing to the player. */
export function describe(e: LogEntry, { t, tx, locale }: T): string | null {
  const pl = locale === 'pl';
  switch (e.type) {
    case 'check':
      return `${attrShort(e.attribute, locale)}: ${e.result.roll} / ${e.result.target} · ${e.result.success ? t('success') : t('failure')}`;
    case 'roll':
      return `k${e.die}: ${e.value}`;
    case 'change': {
      const c = e.change;
      switch (c.what) {
        case 'gold': return `${sign(c.amount)} ${t('gold').toLowerCase()}`;
        case 'food': return `${sign(c.amount)} ${t('food').toLowerCase()}`;
        case 'vitality': return `${sign(c.amount)} ${t('vitality').toLowerCase()}`;
        case 'maxVitality': return `${sign(c.amount)} max ${t('vitality').toLowerCase()}`;
        case 'herbs': return `${sign(c.amount)} ${t('herbs').toLowerCase()}`;
        case 'xp': return `${sign(c.amount)} ${t('xp')}`;
        case 'attribute': return `${sign(c.amount)} ${attrShort(c.attribute, locale)} ${t('forever')}`;
        case 'effect': {
          const target = c.target === 'all' ? (pl ? 'wszystkie cechy' : 'all attributes') : c.target === 'speed' ? t('speed') : c.target === 'stamina' ? t('stamina') : c.target === 'damage' ? t('damage') : attrShort(c.target, locale);
          return `${sign(c.amount)} ${target} · ${c.rounds === 0 ? t('forever') : `${c.rounds} ${t('rounds')}`}`;
        }
        case 'skill': return `${sign(c.amount)} ${t(c.skill as 'hunt')}`;
        case 'item': return c.amount > 0 ? `+ ${itemName(c.item, locale)}` : c.amount < 0 ? `− ${itemName(c.item, locale)}` : `${t('equip')}: ${itemName(c.item, locale)}`;
        case 'rune': return `${t('rune')}: ${c.rune}`;
        case 'stuck': return pl ? `Unieruchomienie: ${c.rounds} rund` : `Stuck for ${c.rounds} rounds`;
        case 'lostEverything': return pl ? 'Tracisz złoto i ekwipunek' : 'You lose your gold and gear';
      }
      return null;
    }
    case 'condition':
      return e.added ? (pl ? `Nowy stan: ${e.id}` : `New condition: ${e.id}`) : (pl ? `Stan minął: ${e.id}` : `Condition cleared: ${e.id}`);
    case 'combatEnded':
      return e.result === 'won' ? `${t('won')} +${fmt(e.xp)} ${t('xp')}` : e.result === 'lost' ? t('lost') : e.result === 'fled' ? t('fled') : t('enthralled');
    case 'camped':
      return `${t('camp')}: +${e.healed} ${t('vitality').toLowerCase()}`;
    case 'levelUp':
      return `${t('level')} ${e.level}!`;
    case 'mission': {
      const m = MISSIONS.find((x) => x.id === e.mission);
      return `${pl ? 'Cel osiągnięty' : 'Goal reached'}: ${m ? m.name[pl ? 'pl' : 'en'] : e.mission} (+${Math.round(e.xp)} ${t('xp')})`;
    }
    case 'revealed':
      return `+${fmt(e.xp)} ${t('xp')}`;
    case 'moved':
      return e.pushed ? (pl ? 'Zostajesz przeniesiony.' : 'You are carried away.') : null;
    case 'died':
      return t('died');
    case 'stoneTaken':
      return t('stoneCarried');
    case 'traded':
      return `${e.bought ? '−' : '+'}${fmt(e.gold)} ${t('gold').toLowerCase()} · ${itemName(e.item, locale)}`;
    case 'test':
      return `${e.rerolled ? `${cardName(e.rerolled, locale)} ↻ · ` : ''}${tx({ pl: 'Test', en: 'Test' })} ${attrShort(e.attribute, locale)}: ${e.result.success ? t('success') : t('failure')}${e.gained.length ? ` · ${e.gained.map((g) => g.split(':').slice(-1)[0]).join(', ')}` : ''}`;
    case 'card':
      return cardLine(e.card, e, locale);
    case 'hungry':
      return pl ? `Głód: ${e.rounds} rund bez jedzenia${e.vitalityLost ? `, −${e.vitalityLost} Żyw.` : ''}` : `Hunger: ${e.rounds} rounds without food${e.vitalityLost ? `, −${e.vitalityLost} Vit` : ''}`;
    default:
      return null;
  }
}

export function combatLine(e: LogEntry, T: T): string | null {
  if (e.type !== 'combat') return describe(e, T);
  const { t, locale } = T;
  const pl = locale === 'pl';
  const ev = e.event;
  switch (ev.type) {
    case 'strike': {
      const by = ev.by === 'hero' ? t('you') : foeName(ev.by, locale);
      const on = ev.target === 'hero' ? t('you').toLowerCase() : foeName(ev.target, locale);
      const tag = ev.card ? `${cardName(ev.card, locale)} · ` : '';
      if (ev.dodged) return `${tag}${on}: ${pl ? 'unik' : 'dodged'} (${ev.dodge!.roll}/${ev.dodge!.target})`;
      if (!ev.result.success) return `${tag}${by} → ${on}: ${t('miss')} (${ev.result.roll}/${ev.result.target})`;
      if (ev.parried) return `${by} → ${on}: ${t('parried')}`;
      if (ev.blocked) return `${by} → ${on}: ${pl ? 'bariera zatrzymuje cios' : 'the barrier stops the blow'}`;
      if (ev.barrier) return `${by} → ${on}: ${pl ? 'przebija barierę' : 'breaks the barrier'}, −${ev.damage ?? 0}`;
      if (ev.card) return `${tag}${by} → ${on}: ${t('hit')} ${ev.location ? `(${t(ev.location)})` : ''} −${ev.damage ?? 0}`;
      return `${by} → ${on}: ${t('hit')} ${ev.location ? `(${t(ev.location)})` : ''} −${ev.damage ?? 0}`;
    }
    case 'flee': return ev.success ? t('fled') : `${t('flee')}: ${t('failure')}`;
    case 'focus': return `${t('focus')}: +10`;
    case 'stunned': return ev.who === 'hero' ? (locale === 'pl' ? 'Jesteś ogłuszony' : 'You are stunned') : `${foeName(ev.who, locale)}: ${locale === 'pl' ? 'ogłuszony' : 'stunned'}`;
    case 'drink': return `${t('use')}: ${itemName(ev.item, locale)}`;
    case 'reload': return locale === 'pl' ? 'Ładujesz kuszę' : 'You reload the crossbow';
    case 'foeDown': return `${foeName(ev.uid, locale)} ✕`;
    case 'poisoned': return locale === 'pl' ? 'Trucizna!' : 'Poisoned!';
    case 'bleed': return `${foeName(ev.uid, locale)} −${ev.damage}`;
    case 'trap': return `${cardName('trapper-trap', locale)}: ${foeName(ev.uid, locale)} ${ev.result.success ? (pl ? 'unika' : 'dodges') : `−${ev.damage}, ${pl ? 'unieruchomiony na rundę' : 'held for a round'}`}`;
    case 'barrier': return `${cardName('mystic-barrier', locale)}: ${ev.result.success ? (pl ? 'stoi' : 'raised') : t('failure')}`;
    case 'card': return cardLine(ev.card, ev, locale);
  }
}

function cardLine(card: string, e: { ok?: boolean; roll?: number; amount?: number }, locale: Locale): string {
  const pl = locale === 'pl';
  const name = cardName(card, locale);
  switch (card) {
    case 'mystic-seer': return e.ok ? `${name}: ${pl ? 'wizja! +10 do cech w tej rundzie' : 'a vision! +10 to all attributes this round'}` : `${name}: k6 = ${e.roll}`;
    case 'wraith-haste': return `${name}: +1 ${pl ? 'Szybkości' : 'Speed'}`;
    case 'wraith-leaves': return `${name}: +${e.amount ?? 0} ${pl ? 'Żyw.' : 'Vit'}`;
    case 'warrior-rations': return `${name}: +5 ${pl ? 'Walki i Siły' : 'Combat and Strength'}`;
    case 'warrior-veteran': return `${name}: +1 ${pl ? 'PD' : 'XP'}`;
    case 'mystic-researcher': return `${name}: +1 Int`;
    case 'trapper-trap': return `${name}: ${pl ? 'pułapka zastawiona' : 'trap set'}`;
    default: return name;
  }
}
