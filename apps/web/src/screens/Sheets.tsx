import { useState } from 'react';
import { motion } from 'motion/react';
import { ATTRIBUTES, ITEMS, TERRAINS, type Attribute } from '@hp/content';
import {
  buyPrice, heroArmour, legalActions, sellPrice, shopStock,
  type Action, type GameState, type PlayerState, type Service,
} from '@hp/engine';
import { useT } from '../i18n';
import { attrShort, itemName } from '../logText';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

/** Inn, village and city services, the market, the shops and the portal. */
export function TownSheet({ game, me, act, onClose }: { game: GameState; me: PlayerState; act: (a: Action) => void; onClose: () => void }) {
  const { t, tx, locale } = useT();
  const legal = legalActions(game, me.id);
  const services = legal.flatMap((a) => (a.type === 'service' ? [a.service] : []));
  const portals = legal.flatMap((a) => (a.type === 'portal' ? [a.to] : []));
  const terrain = game.map.cells[me.position]!.terrain;
  const all: Service[] = terrain === 'inn' ? ['meal', 'stay', 'gossip'] : ['meal', 'stay', 'gossip', 'train', 'sharpen'];
  const stock = ['food', ...shopStock(game, me)];
  const inv = me.inventory;
  const sellable = [
    ...(me.character.food > 0 ? ['food'] : []),
    ...Object.entries(inv.materials).filter(([, n]) => (n ?? 0) > 0).map(([id]) => id),
    ...Object.entries(inv.herbs).filter(([, n]) => (n ?? 0) > 0).map(([id]) => id),
    ...new Set(inv.items),
  ].filter((id) => sellPrice(game, me, id) !== null);

  return (
    <Sheet title={terrain === 'core' ? t('town') : tx(TERRAINS[terrain].name)} onClose={onClose}>
      <h3>{t('services')}</h3>
      <div className="choices">
        {all.map((s) => (
          <button key={s} className="choice" disabled={!services.includes(s)} onClick={() => act({ type: 'service', service: s })}>
            <span>{t(s)}</span>
          </button>
        ))}
      </div>
      {terrain !== 'inn' && (
        <>
          <h3>{t('shop')} · {fmt(me.character.gold)} {t('gold').toLowerCase()}</h3>
          <div className="choices">
            {stock.map((id) => {
              const price = buyPrice(game, me, id);
              return (
                <button key={id} className="choice" disabled={price === null || price > me.character.gold} onClick={() => act({ type: 'buy', item: id })}>
                  <span>{itemName(id, locale)}</span>
                  <small>{price === null ? '—' : `${fmt(price)} ${t('gold').toLowerCase()}`}{itemNote(id, t)}</small>
                </button>
              );
            })}
          </div>
          <h3>{t('sellTitle')}</h3>
          {sellable.length === 0 ? <p className="muted">{t('nothingToSell')}</p> : (
            <div className="choices">
              {sellable.map((id) => (
                <button key={id} className="choice" onClick={() => act({ type: 'sell', item: id })}>
                  <span>{itemName(id, locale)}{countOf(me, id) > 1 ? ` ×${countOf(me, id)}` : ''}</span>
                  <small>+{fmt(sellPrice(game, me, id)!)} {t('gold').toLowerCase()}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {portals.length > 0 && (
        <>
          <h3>{t('portal')}</h3>
          <div className="choices">
            {portals.map((to) => (
              <button key={to} className="choice" onClick={() => { act({ type: 'portal', to }); onClose(); }}>
                <span>{tx(TERRAINS.city.name)} ({to % game.map.width + 1}, {Math.floor(to / game.map.width) + 1})</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
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

/** Worn gear, the backpack, materials, herbs, effects and level-up points. */
export function BagSheet({ game, me, act, onClose }: { game: GameState; me: PlayerState; act: (a: Action) => void; onClose: () => void }) {
  const { t, tx, locale } = useT();
  const c = me.character;
  const legal = legalActions(game, me.id);
  const can = (type: string, item: string) => legal.some((a) => a.type === type && 'item' in a && a.item === item);
  const armour = heroArmour(me);
  const [bonus, setBonus] = useState<Partial<Record<Attribute, number>>>({});
  const spent = Object.values(bonus).reduce((a, b) => a + (b ?? 0), 0);
  const items = [...new Set(me.inventory.items)];
  const materials = Object.entries(me.inventory.materials).filter(([, n]) => (n ?? 0) > 0);
  const herbs = Object.entries(me.inventory.herbs).filter(([, n]) => (n ?? 0) > 0);
  const effects = me.effects.filter((e) => e.untilRound >= game.round && e.id !== 'stuck');

  return (
    <Sheet title={t('bag')} onClose={onClose}>
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

      <h3>{t('equipped')}</h3>
      <ul className="kit">
        <li><span>{t('weapon')}</span><b>{itemName(c.equipment.weapon, locale)}{c.equipment.rune ? ` · ${t('rune')}: ${c.equipment.rune}` : ''}</b></li>
        <li><span>{t('armour')}</span><b>{t('head')} {armour.head} · {t('arms')} {armour.arms} · {t('torso')} {armour.torso} · {t('legs')} {armour.legs}</b></li>
        {c.equipment.shield && <li><span>{t('shield')}</span><b>+15 {t('parry').toLowerCase()}</b></li>}
      </ul>

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
