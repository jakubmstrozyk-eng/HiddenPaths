import { useState } from 'react';
import { ITEMS, PROFESSIONS, type Locale, type Text } from '@hp/content';
import { FOREVER, successChance, testModifier, worldView, type Condition, type GameState, type PlayerState } from '@hp/engine';
import { attrName, outcomeText } from './outcomeText';
import { useT } from './i18n';

/**
 * Lasting harm on the hero, always in sight: each condition (poison, a nightmare, the witch's spell...)
 * and each negative effect says what it does to the hero now and what ends it.
 */

/** A picture and a short note on what each known condition is. */
const KNOWN: Record<string, { icon: string; what: Text }> = {
  poison: { icon: '☠', what: { pl: 'Jad krąży we krwi.', en: 'Venom runs in your blood.' } },
  rot: { icon: '✷', what: { pl: 'Rana gnije.', en: 'A wound is festering.' } },
  plague: { icon: '☣', what: { pl: 'Trawi cię zaraza.', en: 'The plague is eating at you.' } },
  nightmare: { icon: '☾', what: { pl: 'Koszmary nie dają ci spokoju.', en: 'Nightmares give you no rest.' } },
  enthralled: { icon: '◎', what: { pl: 'Wiedźma trzyma cię w swojej mocy.', en: 'The witch holds you in her power.' } },
  bleed: { icon: '♦', what: { pl: 'Krwawisz.', en: 'You are bleeding.' } },
  bleeding: { icon: '♦', what: { pl: 'Krwawisz.', en: 'You are bleeding.' } },
};

/** What ends a condition besides the test at the start of each turn: potions, cards and scrolls. */
function curesFor(id: string): { kind: 'item' | 'card'; id: string }[] {
  const out: { kind: 'item' | 'card'; id: string }[] = [];
  if (id === 'poison' || id === 'rot' || id === 'foulAir') {
    for (const item of Object.values(ITEMS)) if (item.kind === 'potion' && item.heal) out.push({ kind: 'item', id: item.id });
  }
  if (id === 'poison' || id === 'rot' || id === 'bleed' || id === 'bleeding') out.push({ kind: 'card', id: 'elder-herb' });
  if (id === 'bleed' || id === 'bleeding') out.push({ kind: 'card', id: 'explorer-bandages' });
  out.push({ kind: 'item', id: 'scrollRenewal' }, { kind: 'card', id: 'wraith-leaves' });
  return out;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const cardTitle = (id: string, locale: Locale) => {
  for (const p of Object.values(PROFESSIONS)) {
    const c = p.cards.find((x) => x.id === id);
    if (c) return c.name[locale];
  }
  return id;
};

export interface Affliction {
  key: string;
  icon: string;
  name: string;
  /** What it does to the hero, in words. */
  effect: string;
  /** How to be rid of it. */
  cure: string[];
  /** A potion, card or scroll the hero has right now that ends it. */
  ready: string[];
  chance?: number;
}

/** Every condition and negative effect on the hero, in words. */
export function afflictionsOf(game: GameState, me: PlayerState, locale: Locale): Affliction[] {
  const pl = locale === 'pl';
  const out: Affliction[] = [];
  const world = worldView(game);
  const has = (cure: { kind: 'item' | 'card'; id: string }) => (cure.kind === 'item'
    ? me.inventory.items.includes(cure.id)
    : me.character.cards.includes(cure.id) && !me.counters[`used:${cure.id}`] && (cure.id !== 'wraith-leaves' || (me.counters['spent:wraith-leaves'] ?? 0) < 3));
  const name = (cure: { kind: 'item' | 'card'; id: string }) => (cure.kind === 'item' ? ITEMS[cure.id]?.name[locale] ?? cure.id : cardTitle(cure.id, locale));

  for (const cond of me.conditions as Condition[]) {
    const known = KNOWN[cond.id];
    const chance = Math.round(successChance(me.character.attributes[cond.test], testModifier(world, me, cond.test, cond.modifier)) * 100);
    const each = outcomeText(cond.each, locale);
    const cures = curesFor(cond.id);
    const mod = cond.modifier ? ` ${cond.modifier > 0 ? '+' : '−'}${Math.abs(cond.modifier)}` : '';
    out.push({
      key: `c-${cond.id}`,
      icon: known?.icon ?? '⚠',
      name: cond.name[locale],
      effect: `${known ? `${known.what[locale]} ` : ''}${pl ? 'Na początku każdej twojej tury' : 'At the start of each of your turns'}: ${each}${each.endsWith('.') ? '' : '.'}`,
      cure: [
        `${pl ? 'Udany test' : 'Pass a test of'} ${attrName(cond.test, locale)}${mod} ${pl ? 'na początku tury' : 'at the start of a turn'} (${chance}%)${cond.worsen ? (pl ? `; każda porażka utrudnia go o ${Math.abs(cond.worsen)}` : `; each failure makes it ${Math.abs(cond.worsen)} harder`) : ''}`,
        `${pl ? 'albo' : 'or'}: ${[...new Set(cures.map(name))].join(', ')}`,
      ],
      ready: [...new Set(cures.filter(has).map(name))],
      chance,
    });
  }

  // Negative effects from cards and events: they wear off by themselves at the end of a round.
  const seen = new Set<string>();
  for (const e of me.effects) {
    if (e.amount >= 0 || e.untilRound < game.round) continue;
    const key = `${e.id}-${e.attribute}-${e.amount}-${e.untilRound}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const forever = e.untilRound >= FOREVER;
    const until = forever
      ? (pl ? 'do końca gry' : 'for the rest of the game')
      : e.untilRound === game.round ? (pl ? 'do końca tej rundy' : 'until the end of this round') : (pl ? `do końca rundy ${e.untilRound}` : `until the end of round ${e.untilRound}`);
    const renew = ITEMS.scrollRenewal?.name[locale] ?? 'Renewal';
    if (e.id === 'stuck') {
      out.push({
        key, icon: '⛓', name: pl ? 'Utknięcie' : 'Stuck',
        effect: pl ? `Nie możesz się ruszać ${until}.` : `You cannot move ${until}.`,
        cure: [pl ? 'Minie samo po tej rundzie' : 'Wears off after that round'],
        ready: [],
      });
      continue;
    }
    out.push({
      key, icon: '▼', name: `${cap(attrName(e.attribute, locale))} −${Math.abs(e.amount)}`,
      effect: pl ? `${cap(attrName(e.attribute, locale))} ${e.attribute === 'all' ? 'niższe' : 'niższa'} o ${Math.abs(e.amount)} ${until}.` : `${cap(attrName(e.attribute, locale))} lowered by ${Math.abs(e.amount)} ${until}.`,
      cure: [forever ? (pl ? `Nie minie samo; zdejmie go ${renew}` : `It will not wear off; ${renew} removes it`) : (pl ? `Minie samo · wcześniej zdejmie go ${renew}` : `Wears off by itself · ${renew} ends it sooner`)],
      ready: [],
    });
  }
  return out;
}

/** The strip of afflictions under the hero's bar. Tap one to read it all on a small screen. */
export function Afflictions({ game, me, compact = false, className = '' }: { game: GameState; me: PlayerState; compact?: boolean; className?: string }) {
  const { tx, locale } = useT();
  const list = afflictionsOf(game, me, locale);
  const [open, setOpen] = useState<string | null>(null);
  if (!list.length) return null;
  if (compact) {
    // On a card: small chips, one line each; a tap opens what it does and how to end it.
    const shown = list.find((a) => a.key === open);
    return (
      <section className={`afflictions compact ${className}`} aria-label={tx({ pl: 'Stany i osłabienia', en: 'Conditions and weaknesses' })}>
        <div className="aff-chips">
          {className.includes('top') && <span className="afflictions-head">{tx({ pl: 'Dotyka cię', en: 'Affecting you' })}</span>}
          {list.map((a) => (
            <button type="button" key={a.key} className={`aff-chip ${open === a.key ? 'open' : ''}`} onClick={() => setOpen(open === a.key ? null : a.key)} aria-expanded={open === a.key} title={a.effect}>
              <i aria-hidden="true">{a.icon}</i>{a.name}
            </button>
          ))}
          {!shown && <small className="aff-chips-hint">{tx({ pl: 'dotknij, by zobaczyć efekt', en: 'tap to see the effect' })}</small>}
        </div>
        {shown && (
          <div className="aff-detail">
            <span className="aff-effect">{shown.effect}</span>
            <span className="aff-cure"><em>{tx({ pl: 'Jak się pozbyć', en: 'How to be rid of it' })}:</em> {shown.cure.join(' · ')}</span>
            {shown.ready.length > 0 && <span className="aff-ready">✓ {tx({ pl: 'Masz pod ręką', en: 'You have' })}: {shown.ready.join(', ')}</span>}
          </div>
        )}
      </section>
    );
  }
  return (
    <section className={`afflictions ${className}`} aria-label={tx({ pl: 'Stany i osłabienia', en: 'Conditions and weaknesses' })}>
      <span className="afflictions-head">{tx({ pl: 'Dotyka cię', en: 'Affecting you' })}</span>
      {list.map((a) => (
        <button
          type="button"
          key={a.key}
          className={`affliction ${open === a.key ? 'open' : ''}`}
          onClick={() => setOpen(open === a.key ? null : a.key)}
          aria-expanded={open === a.key}
        >
          <span className="aff-title"><i aria-hidden="true">{a.icon}</i><b>{a.name}</b>{a.chance !== undefined && <small className="aff-odds" title={tx({ pl: 'Szansa, że minie na początku następnej tury', en: 'Chance it ends at the start of your next turn' })}>{a.chance}%</small>}</span>
          <span className="aff-effect">{a.effect}</span>
          <span className="aff-cure">
            <em>{tx({ pl: 'Jak się pozbyć', en: 'How to be rid of it' })}:</em> {a.cure.join(' · ')}
          </span>
          <small className="aff-more">▾ {tx({ pl: 'jak się tego pozbyć?', en: 'how to end it?' })}</small>
          {a.ready.length > 0 && <span className="aff-ready">✓ {tx({ pl: 'Masz pod ręką', en: 'You have' })}: {a.ready.join(', ')}</span>}
        </button>
      ))}
    </section>
  );
}
