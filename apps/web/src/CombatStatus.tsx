import type { ReactNode } from 'react';
import { ENEMIES, type Locale } from '@hp/content';
import { FOREVER, MIST, type CombatState, type Foe, type GameState, type PlayerState } from '@hp/engine';
import { afflictionsOf } from './Afflictions';
import { attrName } from './outcomeText';
import { cardName, itemName } from './logText';
import { useT } from './i18n';
import './combatStatus.css';

/**
 * Every buff and debuff in a fight, on the hero and on each foe, shown twice (Jacob, 2026-11-27):
 * as a picture on the armoured figure (a barrier bubble, a trap at the feet, mist, small badges)
 * and in words: the name, what it does and how long it lasts. All of it is still; a status only
 * fades in once when it appears, so phones are not kept busy.
 */

export type StatusMark = 'barrier' | 'trap' | 'mist' | 'vines' | 'fire' | 'blind' | 'stun' | 'focus';

export interface Status {
  key: string;
  icon: string;
  name: string;
  /** What it does, in words. */
  effect: string;
  /** How long it lasts. */
  duration: string;
  /** Good or bad for the one who bears it. */
  tone: 'buff' | 'debuff';
  /** A picture drawn on the figure itself, besides the badge. */
  mark?: StatusMark;
}

/** The hero-wide states, as they stand at this point of the playback. */
export interface LiveFlags {
  barrier: boolean;
  trap: boolean;
  focus: boolean;
  mist: boolean;
  /** The combat turn the statuses describe: the coming one, or the one being played back. */
  turn: number;
}

/** Veil of Mist in words, from the engine's own numbers. */
const MIST_TEXT = {
  hero: { pl: `Wrogowie gorzej cię widzą; ty też: ${MIST.own} do twojej Walki.`, en: `Foes can hardly see you, and you them: ${MIST.own} to your Combat.` },
  foeFirst: { pl: `${MIST.first} do Walki i ${MIST.dex} do Zręczności.`, en: `${MIST.first} Combat and ${MIST.dex} Dexterity.` },
  foeSecond: { pl: `${MIST.second} do Walki i ${MIST.dex} do Zręczności.`, en: `${MIST.second} Combat and ${MIST.dex} Dexterity.` },
};

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** Where a timed bonus comes from: a card, a potion, a meal. */
function sourceName(id: string, locale: Locale): string {
  const pl = locale === 'pl';
  if (id === 'meal') return pl ? 'Posiłek' : 'Meal';
  if (id === 'spice') return pl ? 'Przyprawa' : 'Seasoning';
  if (id === 'empower') return cardName('runemaster-empower', locale);
  if (id === 'rations') return cardName('warrior-rations', locale);
  const item = itemName(id, locale);
  if (item !== id) return item;
  const card = cardName(id, locale);
  return card !== id ? card : cap(id);
}

/** Buffs and debuffs on the hero. */
export function heroStatuses(game: GameState, me: PlayerState, combat: CombatState, live: LiveFlags, locale: Locale): Status[] {
  const pl = locale === 'pl';
  const out: Status[] = [];
  const thisFight = pl ? 'do końca walki' : 'until the fight ends';
  if (live.barrier) {
    out.push({
      key: 'barrier', icon: '⬡', tone: 'buff', mark: 'barrier',
      name: cardName('mystic-barrier', locale),
      effect: pl
        ? 'Pierwszy celny cios wroga musi przebić barierę testem Siły. Nie przebije: cios zatrzymany. Przebije: zadaje tylko połowę obrażeń.'
        : 'The first foe blow that lands must break through on a Strength test. If it fails, the blow is stopped; if it breaks through, it deals half damage.',
      duration: pl ? 'do pierwszego celnego ciosu wroga' : 'until a foe\'s blow lands',
    });
  }
  if (live.focus) {
    out.push({
      key: 'focus', icon: '✧', tone: 'buff', mark: 'focus',
      name: pl ? 'Skupienie' : 'Focus',
      effect: pl ? '+10 do każdego twojego testu.' : '+10 to every test you make.',
      duration: pl ? 'ta runda walki' : 'this combat round',
    });
  }
  if (live.mist && combat.mist !== undefined) {
    const second = live.turn - combat.mist >= 1;
    out.push({
      key: 'mist', icon: '≋', tone: 'buff', mark: 'mist',
      name: cardName('wraith-mist', locale),
      effect: MIST_TEXT.hero[locale],
      duration: second ? (pl ? 'ostatnia runda' : 'last round') : (pl ? 'ta i następna runda' : 'this round and the next'),
    });
  }
  if (combat.heroStunned) {
    out.push({
      key: 'stunned', icon: '✶', tone: 'debuff', mark: 'stun',
      name: pl ? 'Ogłuszenie' : 'Stunned',
      effect: pl ? 'Tracisz swój następny ruch.' : 'You lose your next move.',
      duration: pl ? 'następna runda' : 'next round',
    });
  }
  if (combat.reloading) {
    out.push({
      key: 'reload', icon: '⟳', tone: 'debuff',
      name: pl ? 'Przeładowanie' : 'Reloading',
      effect: pl ? 'Kusza musi zostać naładowana: w następnym ruchu nie strzelisz.' : 'The crossbow must be reloaded: your next move cannot be a shot.',
      duration: pl ? 'następna runda' : 'next round',
    });
  }
  const j = combat.journal;
  if (j && !j.used && (j.lore || j.careful)) {
    const sum = j.lore + j.careful;
    out.push({
      key: 'journal', icon: '✎', tone: sum >= 0 ? 'buff' : 'debuff',
      name: pl ? 'Dziennik' : 'Journal',
      effect: [
        j.lore ? (pl ? `Notatka z bestiariusza: ${signed(j.lore)} do pierwszego testu.` : `Bestiary note: ${signed(j.lore)} on the first test.`) : '',
        j.careful ? (pl ? `Ostrożny charakter: ${signed(j.careful)} do pierwszego ataku.` : `Careful nature: ${signed(j.careful)} on the first attack.`) : '',
      ].filter(Boolean).join(' '),
      duration: pl ? 'pierwszy test w walce' : 'the first test of the fight',
    });
  }
  // Timed bonuses from cards, potions and meals. A fight ends the game round, so "this round" is "this fight".
  const seen = new Set<string>();
  for (const e of me.effects) {
    if (e.amount <= 0 || e.untilRound < game.round) continue;
    const key = `e-${e.id}-${e.attribute}-${e.amount}-${e.untilRound}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const what = e.attribute === 'damage' ? (pl ? 'obrażenia' : 'damage') : attrName(e.attribute, locale);
    out.push({
      key, icon: '▲', tone: 'buff',
      name: `${sourceName(e.id, locale)} ${signed(e.amount)}`,
      effect: pl ? `${cap(what)} ${signed(e.amount)}${e.vs ? ` (przeciw: ${e.vs})` : ''}.` : `${cap(what)} ${signed(e.amount)}${e.vs ? ` (against: ${e.vs})` : ''}.`,
      duration: e.untilRound >= FOREVER ? (pl ? 'do końca gry' : 'for the rest of the game')
        : e.untilRound === game.round ? thisFight
        : pl ? `do końca rundy ${e.untilRound}` : `until the end of round ${e.untilRound}`,
    });
  }
  // Poison, nightmares and negative effects: the same list the hero sees outside the fight.
  for (const a of afflictionsOf(game, me, locale)) {
    const odds = a.chance !== undefined ? ` (${a.chance}%)` : '';
    out.push({
      key: a.key, icon: a.icon, tone: 'debuff', name: a.name,
      effect: `${a.effect} ${pl ? 'Jak się pozbyć' : 'How to be rid of it'}: ${a.cure.join(' · ')}.${a.ready.length ? ` ${pl ? 'Masz pod ręką' : 'You have'}: ${a.ready.join(', ')}.` : ''}`,
      duration: a.chance !== undefined ? (pl ? `aż przejdziesz test${odds}` : `until you pass the test${odds}`) : (a.cure[0] ?? ''),
    });
  }
  return out;
}

/** Buffs and debuffs on one foe. */
export function foeStatuses(combat: CombatState, foe: Foe, live: LiveFlags, locale: Locale): Status[] {
  const pl = locale === 'pl';
  const out: Status[] = [];
  if (foe.vitality <= 0 || foe.tamed) return out;
  const enemy = ENEMIES[foe.enemy];
  if (live.trap) {
    out.push({
      key: 'trap', icon: '⩘', tone: 'debuff', mark: 'trap',
      name: pl ? 'Pułapka' : 'Trap',
      effect: pl
        ? 'Zastawiona pod nogami. Wróg testuje Zręczność; porażka = −4 Żyw. i traci następny atak.'
        : 'Set at its feet. The foe tests Dexterity; on a failure it loses 4 Vitality and its next attack.',
      duration: pl ? 'zadziała w następnej rundzie' : 'springs next round',
    });
  }
  if (foe.stunned) {
    out.push({
      key: 'stunned', icon: '✶', tone: 'debuff', mark: 'stun',
      name: pl ? 'Unieruchomiony' : 'Held fast',
      effect: pl ? 'Traci swój następny atak.' : 'It loses its next attack.',
      duration: pl ? 'następny atak' : 'its next attack',
    });
  }
  if (foe.disarmed) {
    out.push({
      key: 'disarmed', icon: '⚔', tone: 'debuff',
      name: pl ? 'Bez broni' : 'Unarmed',
      effect: pl ? 'Nie atakuje: w swoim ruchu próbuje podnieść broń (test Zręczności przeciw tobie).' : 'It does not attack: it spends its move trying to pick its weapon up (Dexterity against yours).',
      duration: pl ? 'aż odzyska broń' : 'until it gets it back',
    });
  }
  if (live.mist) {
    const second = combat.mist !== undefined && live.turn - combat.mist >= 1;
    out.push({
      key: 'mist', icon: '≋', tone: 'debuff', mark: 'mist',
      name: cardName('wraith-mist', locale),
      effect: second ? MIST_TEXT.foeSecond[locale] : MIST_TEXT.foeFirst[locale],
      duration: second ? (pl ? 'ostatnia runda' : 'last round') : (pl ? 'ta i następna runda' : 'this round and the next'),
    });
  }
  if ((foe.blindUntil ?? 0) >= live.turn) {
    out.push({
      key: 'blind', icon: '◌', tone: 'debuff', mark: 'blind',
      name: pl ? 'Oślepiony' : 'Blinded',
      effect: pl ? '−30 do Walki i Zręczności.' : '−30 Combat and Dexterity.',
      duration: pl ? 'do swojego następnego ciosu' : 'until its next blow',
    });
  }
  if (foe.vined) {
    out.push({
      key: 'vined', icon: '§', tone: 'debuff', mark: 'vines',
      name: cardName('mystic-vines', locale),
      effect: pl ? 'Związany: co rundę testuje Siłę, by się wyrwać. Dopóki związany, nie walczy wręcz.' : 'Bound: each round it tests Strength to tear free. While bound it cannot fight hand to hand.',
      duration: pl ? 'aż się wyrwie' : 'until it tears free',
    });
  }
  if (foe.burning !== undefined) {
    out.push({
      key: 'fire', icon: '♨', tone: 'debuff', mark: 'fire',
      name: pl ? 'Płonie' : 'Burning',
      effect: pl ? '−1 Żyw. co rundę. Udany test Siły gasi ogień; trzecia porażka zabija.' : '−1 Vitality a round. A passed Strength test puts it out; the third failure kills.',
      duration: pl ? `aż ugasi · porażki ${foe.burning}/3` : `until put out · failures ${foe.burning}/3`,
    });
  }
  if (foe.wound !== undefined) {
    out.push({
      key: 'wound', icon: '♦', tone: 'debuff',
      name: pl ? 'Głęboka rana' : 'Deep wound',
      effect: pl ? '−1 Żyw. co rundę; w swoim ruchu próbuje ją zatamować (test Zręczności). Trzecia runda zabija.' : '−1 Vitality a round; it spends its move trying to staunch it (Dexterity). The third round kills.',
      duration: pl ? `aż zatamuje · ${foe.wound}/3` : `until staunched · ${foe.wound}/3`,
    });
  }
  if (foe.bleed !== undefined) {
    out.push({
      key: 'bleed', icon: '♦', tone: 'debuff',
      name: pl ? 'Krwawienie' : 'Bleeding',
      effect: pl ? '−1 Żyw. co rundę, aż przejdzie test Siły. Trzecia runda zabija.' : '−1 Vitality a round until it passes a Strength test. The third round kills.',
      duration: pl ? `aż przejdzie test · ${foe.bleed}/3` : `until it passes · ${foe.bleed}/3`,
    });
  }
  if (foe.poisoned) {
    out.push({
      key: 'poison', icon: '☠', tone: 'debuff',
      name: pl ? 'Zatruty' : 'Poisoned',
      effect: pl ? '−1 Żyw. co rundę, aż przejdzie test Siły.' : '−1 Vitality a round until it passes a Strength test.',
      duration: pl ? 'aż przejdzie test Siły' : 'until it passes a Strength test',
    });
  }
  if (foe.controlled) {
    out.push({
      key: 'mastered', icon: '⛓', tone: 'debuff',
      name: pl ? `Ujarzmiony ${foe.controlled}/3` : `Mastered ${foe.controlled}/3`,
      effect: pl
        ? `${foe.held ? 'W swoim następnym ruchu uderzy innego wroga zamiast ciebie. ' : ''}Trzy udane testy Charyzmy z rzędu i zostanie twoim towarzyszem.`
        : `${foe.held ? 'On its next move it strikes another foe instead of you. ' : ''}Three Charisma tests in a row and it becomes your companion.`,
      duration: pl ? 'trzeba go podtrzymać co rundę' : 'must be renewed every round',
    });
  }
  if (combat.studiedKind === foe.enemy) {
    out.push({
      key: 'studied', icon: '⌕', tone: 'debuff',
      name: pl ? 'Przeanalizowany' : 'Studied',
      effect: pl ? `Znasz jego styl: +10 do twojej Walki przeciw każdemu: ${enemy?.name.pl ?? foe.enemy}.` : `You know its ways: +10 to your Combat against every ${enemy?.name.en ?? foe.enemy}.`,
      duration: pl ? 'do końca walki' : 'until the fight ends',
    });
  }
  return out;
}

/**
 * The pictures on the figure: a barrier bubble around it, a trap at its feet, a mist haze,
 * and a column of small badges, one per status. Wraps the figure itself.
 */
export function StatusFigure({ list, children }: { list: Status[]; children: ReactNode }) {
  const marks = new Set(list.map((s) => s.mark).filter(Boolean));
  return (
    <span className={`status-fig ${[...marks].map((m) => `has-${m}`).join(' ')}`}>
      {marks.has('barrier') && <span className="fx-barrier" aria-hidden="true" />}
      {marks.has('mist') && <span className="fx-mist" aria-hidden="true" />}
      {children}
      {marks.has('vines') && (
        <svg className="fx-vines" viewBox="0 0 40 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 40 C10 30 2 26 10 20 S8 8 14 4" />
          <path d="M36 40 C30 31 38 27 30 21 S32 10 26 5" />
          <path d="M8 34 C16 30 24 36 32 31" />
        </svg>
      )}
      {marks.has('fire') && <span className="fx-fire" aria-hidden="true" />}
      {marks.has('trap') && (
        <svg className="fx-trap" viewBox="0 0 40 14" aria-hidden="true">
          <path d="M3 11 H37" />
          <path d="M6 11 L9 4 L12 11 L15 4 L18 11 L21 4 L24 11 L27 4 L30 11 L33 4 L35 11" />
          <circle cx="20" cy="11" r="2" />
        </svg>
      )}
      {list.length > 0 && (
        <span className="status-badges" aria-hidden="true">
          {list.slice(0, 5).map((s) => (
            <i key={s.key} className={`status-badge ${s.tone}`}>{s.icon}</i>
          ))}
          {list.length > 5 && <i className="status-badge more">+{list.length - 5}</i>}
        </span>
      )}
    </span>
  );
}

/**
 * The statuses in words under a figure: a chip with the name and how long it lasts; a tap
 * opens what it does. `open`/`onOpen` live in the fight so only one shows at a time.
 */
export function StatusChips({ list, owner, open, onOpen }: { list: Status[]; owner: string; open: string | null; onOpen: (key: string | null) => void }) {
  const { tx } = useT();
  if (!list.length) return null;
  return (
    <span className="status-chips" aria-label={tx({ pl: 'Efekty', en: 'Effects' })}>
      {list.map((s) => {
        const id = `${owner}:${s.key}`;
        const toggle = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpen(open === id ? null : id); };
        return (
          <span
            key={s.key}
            role="button"
            tabIndex={0}
            className={`status-chip ${s.tone} ${open === id ? 'open' : ''}`}
            onClick={toggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } }}
            aria-expanded={open === id}
            title={`${s.name}: ${s.effect} (${s.duration})`}
          >
            <i aria-hidden="true">{s.icon}</i>
            <b>{s.name}</b>
            <small>{s.duration}</small>
          </span>
        );
      })}
    </span>
  );
}

/** What the opened status does, in full, under the field. */
export function StatusDetail({ status, who, onClose }: { status: Status; who: string; onClose: () => void }) {
  const { tx } = useT();
  return (
    <div className={`status-detail ${status.tone}`} role="status">
      <span className="status-detail-head">
        <i aria-hidden="true">{status.icon}</i>
        <b>{status.name}</b>
        <small>{who} · {status.tone === 'buff' ? tx({ pl: 'wzmocnienie', en: 'buff' }) : tx({ pl: 'osłabienie', en: 'debuff' })}</small>
        <button type="button" className="ghost small" onClick={onClose} aria-label={tx({ pl: 'Zamknij', en: 'Close' })}>×</button>
      </span>
      <span>{status.effect}</span>
      <span className="status-detail-time"><em>{tx({ pl: 'Czas trwania', en: 'Lasts' })}:</em> {status.duration}</span>
    </div>
  );
}
