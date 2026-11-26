import { ATTRIBUTES, ENEMIES, HERBS, ITEMS, MATERIALS, MISSIONS, PROFESSIONS, type Attribute, type Locale, type Text } from '@hp/content';
import type { LogEntry } from '@hp/engine';
import type { useT } from './i18n';

type T = ReturnType<typeof useT>;

/** One die thrown on screen. A d100 test shows as two d10s (tens and units). */
export type DiceRoll =
  | { kind: 'd100'; value: number; target: number; success: boolean; label: string; attr?: Attribute; /** The skill card that gave this second throw. */ reroll?: string; /** The failed throw before a skill card's second one. */ first?: boolean }
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
  // A companion: "pet-wolf-1" is the hero's tamed Wolf.
  if (uid.startsWith('pet-')) {
    const enemy = ENEMIES[uid.slice(4).replace(/-\d+$/, '')];
    return `${enemy ? enemy.name[locale] : uid} (${locale === 'pl' ? 'towarzysz' : 'companion'})`;
  }
  const id = uid.replace(/-\d+$/, '');
  const n = uid.match(/-(\d+)$/)?.[1];
  const name = ENEMIES[id]?.name[locale] ?? uid;
  return n ? `${name} ${n}` : name;
}

/** The dice an action threw, in the order they were thrown. */
export function diceOf(entries: LogEntry[], { locale }: T): DiceRoll[] {
  const out: DiceRoll[] = [];
  for (const e of entries) {
    if (e.type === 'check' || (e.type === 'test' && e.result.roll > 0)) {
      const r = e.result;
      const label = attrShort(e.attribute, locale);
      // A skill card's second throw: show the failed one first, then the new throw under the card's name.
      if (r.rerolled && r.first !== undefined) {
        out.push({ kind: 'd100', value: r.first, target: r.target, success: false, label, attr: e.attribute, first: true });
        out.push({ kind: 'd100', value: r.roll, target: r.target, success: r.success, label: `↻ ${cardName(r.rerolled, locale)}`, attr: e.attribute, reroll: cardName(r.rerolled, locale) });
      } else out.push({ kind: 'd100', value: r.roll, target: r.target, success: r.success, label, attr: e.attribute });
    }
    if (e.type === 'roll') out.push({ kind: 'plain', sides: e.die, value: e.value, label: `k${e.die}` });
    if (e.type === 'combat' && e.event.type === 'strike') {
      const by = e.event.by === 'hero' ? (locale === 'pl' ? 'Ty' : 'You') : foeName(e.event.by, locale);
      out.push({ kind: 'd100', value: e.event.result.roll, target: e.event.result.target, success: e.event.result.success, label: by });
    }
    if (e.type === 'combat' && e.event.type === 'flee') {
      // A flight shows the hero's throw; the foe's chase, when there is one, follows below.
      out.push({ kind: 'd100', value: e.event.hero.roll, target: e.event.hero.target, success: e.event.hero.success, label: attrShort('dex', locale), attr: 'dex' });
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
    case 'room': return e.card === undefined ? null : (pl ? 'Wchodzisz do komnaty' : 'You enter a room');
    case 'roomCleared': return e.vault ? (pl ? 'Skarbiec otwarty! Loch oczyszczony.' : 'The vault is open! The dungeon is cleared.') : null;
    case 'dungeonSearch': return e.found ? (pl ? 'Odnajdujesz ukryte zejście do lochu!' : 'You find a hidden way down into a dungeon!') : null;
    case 'hitSpot': return pl ? `Trafienie: ${({ head: 'głowa', arms: 'ręce', torso: 'tułów', legs: 'nogi' })[e.slot]}${e.armour ? `, pancerz −${e.armour}` : ''} → −${e.damage} Żyw.` : `Hit: ${e.slot}${e.armour ? `, armour −${e.armour}` : ''} → −${e.damage} Vit`;
    case 'leftDungeon': return pl ? 'Wychodzisz z lochu' : 'You climb out of the dungeon';
    case 'check':
      return `Test ${attrShort(e.attribute, locale)}: ${e.result.success ? t('success') : t('failure')}`;
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
      return e.result === 'won' ? `${t('won')} +${fmt(e.xp)} ${t('xp')}` : e.result === 'lost' ? t('lost') : e.result === 'fled' ? t('fled') : e.result === 'hidden' ? t('hidden') : t('enthralled');
    case 'camped':
      return `${t('camp')}: +${e.healed} ${t('vitality').toLowerCase()}`;
    case 'levelUp':
      return `${t('level')} ${e.level}!${e.cards?.length ? ` ${pl ? 'Nowe karty' : 'New cards'}: ${e.cards.map((c) => cardName(c, locale)).join(', ')}` : ''}`;
    case 'cardsKept':
      return `${pl ? 'Karty w ręce' : 'Cards in hand'}: ${e.cards.map((c) => cardName(c, locale)).join(', ')}`;
    case 'crafted':
      return `${cardName(e.card, locale)}: ${itemName(e.item, locale)}`;
    case 'reinforced':
      return `${cardName('runemaster-reinforce', locale)}: +1 ${pl ? 'pancerza' : 'armour'} (${t(e.slot)})`;
    case 'mission': {
      const m = MISSIONS.find((x) => x.id === e.mission);
      return `${pl ? 'Cel osiągnięty' : 'Goal reached'}: ${m ? m.name[pl ? 'pl' : 'en'] : e.mission} (+${Math.round(e.xp)} ${t('xp')})`;
    }
    case 'revealed':
      return e.xp ? `+${fmt(e.xp)} ${t('xp')}` : null;
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
    case 'cooked':
      return e.meal.kind === 'stew'
        ? (pl ? 'Lecznicza potrawka gotowa' : 'A healing stew is ready')
        : `${pl ? 'Pożywienie przyrządzone' : 'Food prepared'}${e.meal.spice ? ` · ${pl ? 'przyprawa' : 'spice'}: ${attrShort(e.meal.spice, locale)}` : ''}`;
    case 'mealEaten':
      return e.meal.kind === 'stew' ? null : `${pl ? 'Przyrządzony posiłek: +2 do cech' : 'A prepared meal: +2 to attributes'}${e.meal.spice ? `, +5 ${attrShort(e.meal.spice, locale)}` : ''}`;
    case 'companion':
      return e.left
        ? `${foeName(e.uid, locale)}: ${pl ? 'uwalnia się i odchodzi' : 'breaks free and leaves'}`
        : `${foeName(e.uid, locale)}: ${e.tame ? (pl ? 'zostaje na zawsze!' : 'stays for good!') : `${pl ? 'więź' : 'bond'} ${e.bond}/3`}`;
    case 'scroll':
      return `${itemName(e.item, locale)}${e.amount ? `: +${e.amount} ${pl ? 'Żyw.' : 'Vit'}` : ''}`;
    case 'smelted':
      return `${pl ? 'Przetopione' : 'Smelted'}: ${e.items.map((i) => itemName(i, locale)).join(', ')} → ${itemName(e.into, locale)}`;
    case 'ate':
      return pl ? `Posiłek zjedzony · zostało ${e.foodLeft} jedzenia` : `Meal eaten · ${e.foodLeft} food left`;
    case 'depleted': {
      const what = { hunt: ['Zwierzyna wróci', 'Game returns'], gather: ['Owoce odrosną', 'Fruit grows back'], herbalism: ['Zioła odrosną', 'Herbs grow back'], mine: ['Surowce wrócą', 'Materials return'] }[e.action as 'hunt'] ?? ['Surowiec wróci', 'Resource returns'];
      return pl ? `${what[0]} w rundzie ${e.until}` : `${what[1]} in round ${e.until}`;
    }
    case 'covered':
      return pl
        ? `Ciemna materia znów przykrywa ${e.cells.length === 1 ? 'opuszczony fragment' : `opuszczone fragmenty (${e.cells.length})`}`
        : `Dark matter covers ${e.cells.length === 1 ? 'a forgotten fragment' : `${e.cells.length} forgotten fragments`} again`;
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
      const tag = ev.card ? `${cardName(ev.card, locale)} · ` : ev.scroll ? `${itemName(ev.scroll, locale)} · ` : '';
      if (ev.dodged) return `${tag}${on}: ${pl ? 'unik' : 'dodged'} (${ev.dodge!.roll}/${ev.dodge!.target})`;
      if (!ev.result.success) return `${tag}${by} → ${on}: ${t('miss')} (${ev.result.roll}/${ev.result.target})`;
      if (ev.parried) return `${by} → ${on}: ${t('parried')}`;
      if (ev.blocked) return `${by} → ${on}: ${pl ? 'bariera zatrzymuje cios' : 'the barrier stops the blow'}`;
      if (ev.barrier) return `${by} → ${on}: ${pl ? 'przebija barierę' : 'breaks the barrier'}, −${ev.damage ?? 0}`;
      if (ev.card || ev.scroll) return `${tag}${by} → ${on}: ${t('hit')} ${ev.location ? `(${t(ev.location)})` : ''} −${ev.damage ?? 0}`;
      return `${by} → ${on}: ${t('hit')} ${ev.location ? `(${t(ev.location)})` : ''} −${ev.damage ?? 0}`;
    }
    case 'flee': return `${ev.card ? `${cardName(ev.card, locale)} · ` : ''}${ev.success ? t('fled') : `${t('flee')}: ${t('failure')}`}`;
    case 'wound':
      if (ev.result) return `${foeName(ev.uid, locale)}: ${ev.staunched ? (pl ? 'tamuje ranę' : 'staunches the wound') : (pl ? 'nie tamuje rany' : 'cannot staunch the wound')}`;
      return `${foeName(ev.uid, locale)}: ${ev.dead ? (pl ? 'wykrwawia się!' : 'bleeds out!') : (pl ? 'krwawi, −1' : 'bleeds, −1')}`;
    case 'vines': return `${cardName('mystic-vines', locale)}: ${foeName(ev.uid, locale)} ${ev.bound ? (pl ? 'oplątany' : 'bound') : (pl ? 'wolny' : 'free')}`;
    case 'master': return `${cardName('elder-beast-master', locale)} ${ev.step}/3: ${ev.companion ? (pl ? 'nowy towarzysz!' : 'a new companion!') : ev.result.success ? (pl ? 'bestia słucha' : 'the beast obeys') : (pl ? 'bestia się wyrywa' : 'the beast breaks free')}`;
    case 'hide': return `${cardName('diver-camouflage', locale)}: ${ev.hidden ? (pl ? 'nikt cię nie widzi' : 'nobody sees you') : (pl ? 'zauważony' : 'spotted')}`;
    case 'blind': return `${cardName('cavedelver-blind', locale)}: ${ev.foes.filter((f) => !f.result.success).map((f) => foeName(f.uid, locale)).join(', ') || (pl ? 'nikt' : 'nobody')}`;
    case 'tear': return `${cardName('druid-fangs', locale)}: ${ev.torn ? (pl ? 'rozrywasz ciało, +4' : 'you tear it open, +4') : (pl ? 'wróg się wyrywa' : 'it pulls free')}`;
    case 'held': return `${foeName(ev.uid, locale)}: ${pl ? 'walczy po twojej stronie' : 'fights on your side'}`;
    case 'focus': return `${t('focus')}: +10`;
    case 'stunned': return ev.who === 'hero' ? (locale === 'pl' ? 'Jesteś ogłuszony' : 'You are stunned') : `${foeName(ev.who, locale)}: ${locale === 'pl' ? 'ogłuszony' : 'stunned'}`;
    case 'drink': return `${t('use')}: ${itemName(ev.item, locale)}`;
    case 'reload': return locale === 'pl' ? 'Ładujesz kuszę' : 'You reload the crossbow';
    case 'foeDown': return `${foeName(ev.uid, locale)} ✕`;
    case 'poisoned': return locale === 'pl' ? 'Trucizna!' : 'Poisoned!';
    case 'bleed': return `${foeName(ev.uid, locale)} −${ev.damage}${ev.dead ? (pl ? ' · wykrwawia się' : ' · bleeds out') : ''}`;
    case 'trap': return `${cardName('trapper-trap', locale)}: ${foeName(ev.uid, locale)} ${ev.result.success ? (pl ? 'unika' : 'dodges') : `−${ev.damage}, ${pl ? 'unieruchomiony na rundę' : 'held for a round'}`}`;
    case 'barrier': return `${cardName('mystic-barrier', locale)}: ${ev.result.success ? (pl ? 'stoi' : 'raised') : t('failure')}`;
    case 'card': return cardLine(ev.card, ev, locale);
    case 'stance': return `${cardName('guardian-stance', locale)}: ${pl ? 'blokujesz ciosy w tej rundzie' : 'you block blows this round'}`;
    case 'disarm': return `${cardName('explorer-disarm', locale)}: ${foeName(ev.uid, locale)} ${ev.kept ? (pl ? 'utrzymuje broń' : 'keeps its weapon') : (pl ? 'traci broń!' : 'loses its weapon!')}`;
    case 'rearm': return `${foeName(ev.uid, locale)}: ${ev.success ? (pl ? 'odzyskuje broń' : 'gets its weapon back') : (pl ? 'nie odzyskuje broni' : 'fails to get its weapon back')}`;
    case 'tame': return `${cardName('druid-companion', locale)}: ${foeName(ev.uid, locale)} ${ev.result.success ? (pl ? 'oswojony!' : 'tamed!') : (pl ? 'nie daje się oswoić' : 'will not be tamed')}`;
    case 'companionDown': return `${foeName(ev.uid, locale)} ✕`;
    case 'scroll': return `${itemName(ev.item, locale)}${ev.amount ? `: +${ev.amount} ${pl ? 'Żyw.' : 'Vit'}` : ''}`;
    case 'shock': return `${foeName(ev.uid, locale)}: ${ev.stunned ? (pl ? 'ogłuszony błyskawicą' : 'stunned by lightning') : (pl ? 'otrząsa się z porażenia' : 'shrugs off the lightning')}`;
    case 'burn': return `${foeName(ev.uid, locale)}: ${ev.dead ? (pl ? 'spłonął!' : 'burnt to death!') : ev.out ? (pl ? 'gasi ogień, −1' : 'puts the fire out, −1') : (pl ? 'płonie, −1' : 'burns, −1')}`;
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
    case 'elder-nature': return `${name}: +10 ${pl ? 'do następnego testu' : 'to the next test'}`;
    case 'elder-herb': case 'explorer-bandages': case 'gourmet-stew': return `${name}: +${e.amount ?? 0} ${pl ? 'Żyw.' : 'Vit'}`;
    case 'explorer-traveller': return `${name}: +1 ${pl ? 'PD' : 'XP'}`;
    case 'runemaster-empower': return `${name}: +2 ${pl ? 'Obr. na 3 rundy' : 'damage for 3 rounds'}`;
    case 'gourmet-seasoning': return `${name}: +5`;
    case 'runemaster-smelt': return name;
    case 'elder-power-potion': return `${name}: ${e.amount ?? 0}/3 ${pl ? 'składników' : 'ingredients'}`;
    case 'warrior-way': return `${name}: +1 ${pl ? 'Walki' : 'Combat'}`;
    case 'warrior-strategist': return `${name}: +10 ${pl ? 'Walki do końca walki' : 'Combat until the fight ends'}`;
    case 'mystic-levitate': return `${name}: ${e.ok ? (pl ? 'unosisz się do końca rundy' : 'you float until the round ends') : (pl ? 'medytacja się nie udała' : 'the meditation failed')}`;
    case 'wraith-lookout': return `${name}: ${pl ? 'odkryte fragmenty' : 'fragments revealed'} ${e.amount ?? 0}`;
    case 'wraith-mist': return `${name}: ${pl ? 'mgła na 2 rundy' : 'mist for 2 rounds'}`;
    case 'druid-teacher': return `${name}: ${e.ok ? `${pl ? 'towarzysz' : 'companion'} +${e.amount ?? 1}` : (pl ? 'lekcja nie wyszła' : 'the lesson failed')}`;
    case 'runemaster-safety-rune': return `${name}: +20 ${pl ? 'inicjatywy' : 'initiative'}`;
    case 'guardian-scalp': return `${name}: +${e.amount ?? 1} ${pl ? 'Walki przeciw temu rodzajowi wroga' : 'Combat against this kind of foe'}`;
    default: return name;
  }
}
