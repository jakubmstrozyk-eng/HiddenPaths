import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ENEMIES, EVENT_BY_ID, ITEMS, type EnemyKind } from '@hp/content';
import {
  attacksPerTurn, eventOptions, fightOdds, foeDamage, heroWeapon, strengthStep, successChance, testModifier, worldView,
  type Action, type GameState, type PlayerState,
} from '@hp/engine';
import { useT } from '../i18n';
import { PixelHero } from '../PixelHero';
import { foeName, itemName } from '../logText';

const rise = {
  initial: { y: 60, opacity: 0, scale: 0.96 },
  animate: { y: 0, opacity: 1, scale: 1 },
  exit: { y: 40, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
};

/** The event card rising from the fragment: the story, then the choices the hero can pay for. */
export function EventPanel({ game, me, lines, act }: { game: GameState; me: PlayerState; lines: string[]; act: (a: Action) => void }) {
  const { t, tx } = useT();
  const pending = me.pendingEvent!;
  const card = EVENT_BY_ID[pending.card]!;
  const step = card.steps[pending.step]!;
  const options = eventOptions(game, me);
  return (
    <div className="overlay">
      <motion.article className="card" {...rise} key={`${pending.card}-${pending.step}`}>
        <header className="card-head">
          <small>#{card.id}</small>
          <h2>{tx(card.title)}</h2>
        </header>
        <p className="card-text">{tx(step.text ?? card.text)}</p>
        {lines.length > 0 && (
          <ul className="card-lines">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
        <div className="card-options">
          {options.map(({ option, index, affordable }) => (
            <button key={index} className="choice" disabled={!affordable} onClick={() => act({ type: 'event', option: index })}>
              <span>{tx(option.label)}</span>
              {option.cost && (
                <small>
                  {[
                    option.cost.gold ? `${option.cost.gold} ${t('gold').toLowerCase()}` : '',
                    option.cost.food ? `${option.cost.food} ${t('food').toLowerCase()}` : '',
                  ].filter(Boolean).join(' · ')}
                </small>
              )}
            </button>
          ))}
        </div>
      </motion.article>
    </div>
  );
}

/** The outcome of a card (or a fight) after it is over. */
export function StoryPanel({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="overlay" onClick={onClose}>
      <motion.article className="card" {...rise} onClick={(e) => e.stopPropagation()}>
        <header className="card-head">
          <small>{t('whatHappened')}</small>
          <h2>{title}</h2>
        </header>
        <ul className="card-lines">
          {lines.map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}>{l}</motion.li>
          ))}
        </ul>
        <button className="primary" onClick={onClose}>{t('continueStory')}</button>
      </motion.article>
    </div>
  );
}

const FOE_COLOURS: Record<EnemyKind, string> = { beast: '#8a5a3a', demon: '#7a2a5a', thug: '#5a5a6a', wraith: '#8aa0b8', human: '#9a7a4a' };

/** A fight: foes with Vitality bars, the hero, and the four combat moves. */
export function CombatPanel({ game, me, lines, act }: { game: GameState; me: PlayerState; lines: string[]; act: (a: Action) => void }) {
  const { t, locale } = useT();
  const combat = me.combat!;
  const alive = combat.foes.filter((f) => f.vitality > 0);
  const [target, setTarget] = useState<string | null>(null);
  const chosen = alive.find((f) => f.uid === target) ?? alive[0];
  const world = worldView(game);
  const c = me.character;
  const hitChance = chosen
    ? Math.round(successChance(c.attributes.com, testModifier(world, me, 'com', (combat.focus ? 10 : 0) + (c.equipment.rune === 'precise' ? 5 : 0), ENEMIES[chosen.enemy]!.kind)) * 100)
    : 0;
  const weapon = heroWeapon(me);
  const potions = [...new Set(me.inventory.items.filter((i) => ITEMS[i]?.kind === 'potion'))];
  const move = (m: Extract<Action, { type: 'combat' }>['move']) => act({ type: 'combat', move: m });
  // Re-estimated each combat round: what keeps attacking is likely to bring.
  const odds = useMemo(() => fightOdds(world, me, combat), [combat.turn, c.vitality, alive.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const oddsPct = Math.round(odds.win * 100);
  const fleeChance = Math.round(successChance(c.attributes.dex, testModifier(world, me, 'dex', combat.focus ? 10 : 0)) * 100);

  return (
    <div className="overlay combat">
      <motion.section className="arena" {...rise}>
        <header className="card-head">
          <small>{t('round')} {combat.turn}</small>
          <h2>{t('fight')}</h2>
        </header>
        <div className="foes">
          {combat.foes.map((f) => {
            const enemy = ENEMIES[f.enemy]!;
            const down = f.vitality <= 0;
            return (
              <motion.button
                key={f.uid}
                className={`foe ${chosen?.uid === f.uid ? 'chosen' : ''} ${down ? 'down' : ''}`}
                disabled={down}
                onClick={() => setTarget(f.uid)}
                animate={down ? { opacity: 0.25, scale: 0.9 } : { opacity: 1, scale: 1 }}
              >
                <span className="foe-sprite" style={{ background: FOE_COLOURS[enemy.kind] }} aria-hidden />
                <b>{foeName(f.uid, locale)}</b>
                <span className="bar"><motion.span animate={{ width: `${Math.max(0, f.vitality / f.maxVitality) * 100}%` }} /></span>
                <small>{Math.max(0, f.vitality)}/{f.maxVitality} · {t('com')} {enemy.com} · {t('foeHits')} {foeDamage(f.enemy).join('–')}</small>
              </motion.button>
            );
          })}
        </div>
        <div className="hero-row">
          <PixelHero race={c.race} size={40} />
          <div>
            <b>{c.name}</b>
            <span className="bar hero-bar"><motion.span animate={{ width: `${Math.max(0, c.vitality / c.maxVitality) * 100}%` }} /></span>
            <small>
              {t('vitality')} {c.vitality}/{c.maxVitality} · {itemName(weapon.id, locale)} S{strengthStep(c.attributes.str) + weapon.power >= 0 ? '+' : ''}{strengthStep(c.attributes.str) + weapon.power}+k6 · {attacksPerTurn(me)} {t('attacksPerTurn')}
            </small>
          </div>
        </div>
        <p className={`odds ${oddsPct < 50 ? 'grim' : ''}`}>
          {t('winOdds')} ~{oddsPct}%{oddsPct < 50 ? ` · ${t('fleeHint')} (${t('dex')} ${fleeChance}%)` : ''}
        </p>
        {lines.length > 0 && (
          <ul className="card-lines combat-lines">
            {lines.slice(-8).map((l, i) => <li key={`${combat.turn}-${i}`}>{l}</li>)}
          </ul>
        )}
        <div className="combat-moves">
          <button className="primary" disabled={!chosen} onClick={() => chosen && move({ move: 'attack', target: chosen.uid })}>
            {t('attack')} {chosen ? `· ${hitChance}%` : ''}
          </button>
          <button className="ghost" onClick={() => move({ move: 'parry' })}>{t('parry')}</button>
          <button className="ghost" onClick={() => move({ move: 'focus' })}>{t('focus')}</button>
          <button className="ghost" onClick={() => move({ move: 'flee' })}>{t('flee')}</button>
          {potions.map((p) => (
            <button key={p} className="ghost small" onClick={() => move({ move: 'potion', item: p })}>{itemName(p, locale)}</button>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
