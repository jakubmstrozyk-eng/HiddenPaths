import { useState } from 'react';
import { motion } from 'motion/react';
import { ATTRIBUTES, ITEMS, TERRAINS, type Attribute } from '@hp/content';
import {
  buyPrice, heroArmour, legalActions, sellPrice, shopStock, successChance, testModifier, TOWN, worldView,
  type Action, type GameState, type PlayerState, type Service,
} from '@hp/engine';
import { useT } from '../i18n';
import { attrShort, itemName } from '../logText';
import { Icon } from '../Icons';
import { PixelHero } from '../PixelHero';
import { SPOT_NAME, SPOTS, TownScene, type Spot } from '../TownScene';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <motion.aside
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="ghost small" onClick={onClose}>{t('close')}</button>
        </header>
        {children}
      </motion.aside>
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/0$/, ''));

/** What each spot in the picture offers. */
const SPOT_SERVICES: Partial<Record<Spot, Service[]>> = {
  bar: ['meal'], table: ['gossip'], rooms: ['stay'], tavern: ['meal', 'stay', 'gossip'], smith: ['sharpen'], yard: ['train'],
};

/** Inn, village and city as a picture: click a building or a corner and its services, wares or portals open below. */
export function TownSheet({ game, me, act, onClose }: { game: GameState; me: PlayerState; act: (a: Action) => void; onClose: () => void }) {
  const { t, tx, locale } = useT();
  const legal = legalActions(game, me.id);
  const services = legal.flatMap((a) => (a.type === 'service' ? [a.service] : []));
  const portals = legal.flatMap((a) => (a.type === 'portal' ? [a.to] : []));
  const terrain = game.map.cells[me.position]!.terrain;
  const place = terrain === 'inn' || terrain === 'city' ? terrain : 'village';
  const [chosen, setChosen] = useState<Spot>(SPOTS[place][0]!);
  const name = (s: Spot) => tx(SPOT_NAME[s]);
  const stock = shopStock(game, me);
  const atSmith = stock.filter((id) => ['weapon', 'armour', 'shield'].includes(ITEMS[id]?.kind ?? ''));
  const atShop = stock.filter((id) => !atSmith.includes(id));
  const inv = me.inventory;
  const sellable = [
    ...(me.character.food > 0 ? ['food'] : []),
    ...Object.entries(inv.materials).filter(([, n]) => (n ?? 0) > 0).map(([id]) => id),
    ...Object.entries(inv.herbs).filter(([, n]) => (n ?? 0) > 0).map(([id]) => id),
    ...new Set(inv.items),
  ].filter((id) => sellPrice(game, me, id) !== null);
  const gold = `${fmt(me.character.gold)} ${t('gold').toLowerCase()}`;

  const serviceButtons = (list: Service[]) => (
    <div className="choices">
      {list.map((s) => (
        <button key={s} className="choice" disabled={!services.includes(s)} onClick={() => act({ type: 'service', service: s })}>
          <span>{t(s)}</span>
          <small className="act-test">{serviceTest(s, game, me, locale)}</small>
          <small className="act-reward">{serviceReward(s, terrain === 'inn', locale)}</small>
        </button>
      ))}
    </div>
  );
  const wares = (ids: string[]) => (
    <>
      <h3>{t('shop')} · {gold}</h3>
      <div className="choices">
        {ids.map((id) => {
          const price = buyPrice(game, me, id);
          return (
            <button key={id} className="choice" disabled={price === null || price > me.character.gold} onClick={() => act({ type: 'buy', item: id })}>
              <span>{itemName(id, locale)}</span>
              <small className="act-test">{price === null ? '—' : `${fmt(price)} ${t('gold').toLowerCase()}`}</small>
              {itemNote(id, t) && <small className="act-reward">{itemNote(id, t).replace(/^ · /, '')}</small>}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <Sheet title={terrain === 'core' ? t('town') : tx(TERRAINS[terrain].name)} onClose={onClose}>
      <TownScene place={place} chosen={chosen} onPick={setChosen} name={name} />
      <p className="muted scene-hint">{tx({ pl: 'Kliknij miejsce na obrazku, żeby tam wejść.', en: 'Click a place in the picture to go there.' })}</p>
      <h3 className="spot-title">{name(chosen)}</h3>
      {SPOT_SERVICES[chosen] && serviceButtons(SPOT_SERVICES[chosen]!)}
      {chosen === 'smith' && wares(atSmith)}
      {chosen === 'shop' && wares(atShop)}
      {chosen === 'market' && (
        <>
          {wares(['food'])}
          <h3>{t('sellTitle')}</h3>
          {sellable.length === 0 ? <p className="muted">{t('nothingToSell')}</p> : (
            <div className="choices">
              {sellable.map((id) => (
                <button key={id} className="choice" onClick={() => act({ type: 'sell', item: id })}>
                  <span>{itemName(id, locale)}{countOf(me, id) > 1 ? ` ×${countOf(me, id)}` : ''}</span>
                  <small className="act-reward">+{fmt(sellPrice(game, me, id)!)} {t('gold').toLowerCase()}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {chosen === 'portal' && (portals.length === 0 ? <p className="muted">{tx({ pl: 'Portal milczy: nie znasz innego miasta albo był już użyty w tej rundzie.', en: 'The portal is silent: you know no other city, or it was used this round.' })}</p> : (
        <div className="choices">
          {portals.map((to) => (
            <button key={to} className="choice" onClick={() => { act({ type: 'portal', to }); onClose(); }}>
              <span>{tx(TERRAINS.city.name)} ({to % game.map.width + 1}, {Math.floor(to / game.map.width) + 1})</span>
            </button>
          ))}
        </div>
      ))}
    </Sheet>
  );
}

/** The test a service asks for, with its odds, or that it needs none. */
function serviceTest(s: Service, game: GameState, me: PlayerState, locale: string): string {
  const pl = locale === 'pl';
  if (s !== 'gossip') return pl ? 'Bez testu' : 'No test';
  const odds = Math.round(successChance(me.character.attributes.cha, testModifier(worldView(game), me, 'cha')) * 100);
  return `${pl ? 'Test: Charyzma' : 'Test: Charisma'} · ${odds}%`;
}

/** What a service costs and gives. Mirrors useService in the engine. */
function serviceReward(s: Service, inn: boolean, locale: string): string {
  const pl = locale === 'pl';
  switch (s) {
    case 'meal': return pl ? `${TOWN.meal} zł → +1 jedzenia` : `${TOWN.meal} gold → +1 food`;
    case 'stay': return (pl ? `${TOWN.stay} zł → odpoczynek jak w obozie i +10 do wszystkich cech na 2 rundy` : `${TOWN.stay} gold → rest as at a camp and +10 to all attributes for 2 rounds`)
      + (inn ? (pl ? ' · w gospodzie bywają kłopoty' : ' · inns can bring trouble') : '');
    case 'gossip': return pl ? 'sukces: +10 Charyzmy na 2 rundy' : 'success: +10 Charisma for 2 rounds';
    case 'train': return pl ? `−${TOWN.train.stamina} Wt → +1 Walki na stałe` : `−${TOWN.train.stamina} Sta → +1 Combat for good`;
    case 'sharpen': return pl ? `${TOWN.sharpen} zł → +1 obrażeń na 2 rundy` : `${TOWN.sharpen} gold → +1 damage for 2 rounds`;
    default: return '';
  }
}

function countOf(me: PlayerState, id: string): number {
  if (id === 'food') return me.character.food;
  return (me.inventory.materials as Record<string, number>)[id] ?? (me.inventory.herbs as Record<string, number>)[id] ?? me.inventory.items.filter((x) => x === id).length;
}

function itemNote(id: string, t: ReturnType<typeof useT>['t']): string {
  const item = ITEMS[id];
  if (!item) return '';
  if (item.kind === 'weapon') return ` · S${item.power >= 0 ? '+' : ''}${item.power}`;
  if (item.kind === 'armour') return ` · ${t('armour')} ${item.value}`;
  if (item.kind === 'potion' && item.heal) return ` · +${item.heal} ${t('vitalityShort')}`;
  return '';
}

/** The hero drawn in what they wear, with each piece and what it does beside them. */
export function HeroDoll({ me }: { me: PlayerState }) {
  const { t, tx, locale } = useT();
  const c = me.character;
  const armour = heroArmour(me);
  const pieceOn = (slot: 'head' | 'arms' | 'torso' | 'legs') => {
    let best: string | null = null;
    for (const id of c.equipment.armour) {
      const it = ITEMS[id];
      if (it?.kind === 'armour' && it.covers.includes(slot) && (!best || (ITEMS[best] as { value: number }).value < it.value)) best = id;
    }
    return best;
  };
  const weapon = ITEMS[c.equipment.weapon];
  const w = weapon?.kind === 'weapon' ? weapon : null;
  const pl = locale === 'pl';
  const slot = (key: 'head' | 'arms' | 'torso' | 'legs') => {
    const id = pieceOn(key);
    return (
      <li key={key} className={`doll-slot doll-${key} ${id ? '' : 'bare'}`}>
        <small>{t(key)}</small>
        <b>{id ? itemName(id, locale) : (pl ? 'nic' : 'nothing')}</b>
        <span>{t('armour')} {armour[key]}</span>
      </li>
    );
  };
  return (
    <div className="doll">
      <ul className="doll-side">
        {slot('head')}
        {slot('arms')}
        <li className={`doll-slot doll-shield ${c.equipment.shield ? '' : 'bare'}`}>
          <small>{t('shield')}</small>
          <b>{c.equipment.shield ? itemName('shield', locale) : (pl ? 'brak' : 'none')}</b>
          {c.equipment.shield && <span>+15 {t('parry').toLowerCase()}</span>}
        </li>
      </ul>
      <div className="doll-figure">
        <PixelHero
          race={c.race} profession={c.profession} look={c.look} size={150}
          gear={{ ...armour, shield: c.equipment.shield, weapon: c.equipment.weapon }}
        />
      </div>
      <ul className="doll-side">
        <li className="doll-slot doll-weapon">
          <small>{t('weapon')}</small>
          <b>{itemName(c.equipment.weapon, locale)}</b>
          {w && (
            <span>
              {t('damage')}: S{w.power >= 0 ? '+' : ''}{w.power}
              {w.ranged ? (pl ? ' · dystansowa' : ' · ranged') : ''}
              {w.reload ? (pl ? ' · 1 strzał na turę' : ' · 1 shot a turn') : ''}
              {w.penetrating ? (pl ? ' · przebijająca' : ' · penetrating') : ''}
            </span>
          )}
          {c.equipment.rune && <span>{t('rune')}: {c.equipment.rune}</span>}
        </li>
        {slot('torso')}
        {slot('legs')}
      </ul>
      <p className="doll-note muted">{tx({ pl: 'Pancerz odejmuje się od obrażeń w trafione miejsce.', en: 'Armour is taken off the damage of a hit on that spot.' })}</p>
    </div>
  );
}

/** Worn gear, the backpack, materials, herbs, effects and level-up points. */
export function BagSheet({ game, me, act, onClose }: { game: GameState; me: PlayerState; act: (a: Action) => void; onClose: () => void }) {
  const { t, locale } = useT();
  const c = me.character;
  const legal = legalActions(game, me.id);
  const can = (type: string, item: string) => legal.some((a) => a.type === type && 'item' in a && a.item === item);
  const items = [...new Set(me.inventory.items)];
  const materials = Object.entries(me.inventory.materials).filter(([, n]) => (n ?? 0) > 0);
  const herbs = Object.entries(me.inventory.herbs).filter(([, n]) => (n ?? 0) > 0);

  return (
    <Sheet title={t('bag')} onClose={onClose}>
      <ul className="kit purse">
        <li><span><Icon name="gold" size={14} /> {t('gold')}</span><b>{Number.isInteger(c.gold) ? c.gold : c.gold.toFixed(2)}</b></li>
        <li><span><Icon name="food" size={14} /> {t('food')}</span><b>{c.food}</b></li>
      </ul>

      <h3>{t('equipped')}</h3>
      <HeroDoll me={me} />

      <h3>{t('carried')}</h3>
      {items.length === 0 ? <p className="muted">{t('empty')}</p> : (
        <ul className="kit">
          {items.map((id) => (
            <li key={id}>
              <span>{itemName(id, locale)}{me.inventory.items.filter((x) => x === id).length > 1 ? ` ×${me.inventory.items.filter((x) => x === id).length}` : ''}</span>
              <span className="kit-actions">
                {can('use', id) && <button className="ghost small" onClick={() => act({ type: 'use', item: id })}>{t('use')}</button>}
                {can('equip', id) && <button className="ghost small" onClick={() => act({ type: 'equip', item: id })}>{t('equip')}</button>}
                {ITEMS[id]?.kind === 'book' && (
                  <button className="ghost small" disabled={!can('read', id)} onClick={() => act({ type: 'read', item: id })}>
                    {t('read')} {me.counters[`book:${id}`] ?? 0}/3
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(materials.length > 0 || herbs.length > 0) && (
        <>
          <h3>{t('materials')} · {t('herbs')}</h3>
          <p className="muted">{[...materials, ...herbs].map(([id, n]) => `${itemName(id, locale)} ×${n}`).join(' · ')}</p>
        </>
      )}

    </Sheet>
  );
}

/** The hero: attributes, level points to spend, and what is working on them now. */
export function HeroSheet({ game, me, act, onClose }: { game: GameState; me: PlayerState; act: (a: Action) => void; onClose: () => void }) {
  const { t, tx, locale } = useT();
  const c = me.character;
  const [bonus, setBonus] = useState<Partial<Record<Attribute, number>>>({});
  const spent = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
  const effects = me.effects.filter((e) => e.untilRound >= game.round && e.id !== 'stuck');

  return (
    <Sheet title={c.name} onClose={onClose}>
      <HeroDoll me={me} />
      <h3>{t('attributes')}{c.unspentPoints > 0 ? ` · ${t('levelPoints')}: ${c.unspentPoints - spent}` : ''}</h3>
      <div className="attrs">
        {ATTRIBUTES.map((a) => (
          <div key={a} className="attr">
            <span>{t(a)}</span>
            {c.unspentPoints > 0 ? (
              <>
                <button disabled={!bonus[a]} onClick={() => setBonus({ ...bonus, [a]: (bonus[a] ?? 0) - 5 })}>−</button>
                <b>{c.attributes[a] + (bonus[a] ?? 0)}</b>
                <button disabled={spent + 5 > c.unspentPoints} onClick={() => setBonus({ ...bonus, [a]: (bonus[a] ?? 0) + 5 })}>+</button>
              </>
            ) : (
              <b style={{ gridColumn: '2 / span 3' }}>{c.attributes[a]}</b>
            )}
          </div>
        ))}
      </div>
      {c.unspentPoints > 0 && (
        <button className="primary" style={{ marginTop: 10 }} disabled={spent === 0} onClick={() => { act({ type: 'spend', bonus }); setBonus({}); }}>
          {t('confirm')}
        </button>
      )}

      {(effects.length > 0 || me.conditions.length > 0) && (
        <>
          <h3>{t('effects')}</h3>
          <ul className="kit">
            {me.conditions.map((cd) => <li key={cd.id}><span>{tx(cd.name)}</span><b>{attrShort(cd.test, locale)}</b></li>)}
            {effects.map((e, i) => (
              <li key={i}>
                <span>{e.attribute === 'all' ? t('attributes') : e.attribute === 'speed' ? t('speed') : e.attribute === 'stamina' ? t('stamina') : e.attribute === 'damage' ? t('damage') : t(e.attribute)}{e.vs ? ` (${e.vs})` : ''}</span>
                <b>{e.amount > 0 ? '+' : ''}{e.amount} · {e.untilRound > 100_000 ? t('forever') : `${e.untilRound - game.round + 1} ${t('rounds')}`}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
