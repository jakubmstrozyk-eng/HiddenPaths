import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EVENT_BY_ID, TERRAINS } from '@hp/content';
import { eventOptions, isOutside, landAt, successChance, testModifier, worldView, type Action, type GameState, type PlayerState } from '@hp/engine';
import { TerrainArt } from '../TerrainArt';
import { cardSwish } from '../Feedback';
import { outcomeText, testLabel, testOf } from '../outcomeText';
import { useT } from '../i18n';

const rise = {
  initial: { y: 60, opacity: 0, scale: 0.96 },
  animate: { y: 0, opacity: 1, scale: 1 },
  exit: { y: 40, opacity: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
};

/** Where the deck sits, relative to the middle of the screen: to the left on a wide screen, above on a phone. */
function deckSpot() {
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const h = typeof window === 'undefined' ? 800 : window.innerHeight;
  return w >= 760 ? { x: -Math.min(w * 0.36, 380), y: -40, scale: 0.42 } : { x: 0, y: -h * 0.36, scale: 0.3 };
}

/** How sure a test looks: green when likely, amber when even, red when unlikely. */
const oddsTone = (p: number) => (p >= 60 ? 'good' : p >= 35 ? 'even' : 'bad');

/**
 * The event card: drawn from the deck (it slides off the pile, flies to the middle and turns face up),
 * then reads like a card of the game: number and kind, a picture of the place, the title, the story,
 * and below it the choices, each with its test, odds and what success or failure brings.
 */
export function EventPanel({ game, me, lines, act }: { game: GameState; me: PlayerState; lines: string[]; act: (a: Action) => void }) {
  const { t, tx, locale } = useT();
  const pl = locale === 'pl';
  const pending = me.pendingEvent!;
  const card = EVENT_BY_ID[pending.card]!;
  const step = card.steps[pending.step]!;
  const options = eventOptions(game, me);
  const here = isOutside(me) ? null : landAt(game.map, me.position);
  // The deck is shown only for the first step: later steps of the same card just turn over.
  const [deck] = useState(deckSpot);
  const [drawing, setDrawing] = useState(true);
  useEffect(() => {
    cardSwish();
    const done = setTimeout(() => setDrawing(false), 1150);
    return () => clearTimeout(done);
  }, []);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="overlay ev-overlay">
      <AnimatePresence>
        {drawing && !reduce && (
          <motion.div
            key="deck"
            className="ev-deck"
            style={{ x: deck.x, y: deck.y, scale: deck.scale }}
            initial={{ opacity: 0, y: deck.y + 40 }}
            animate={{ opacity: 1, y: deck.y }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.3 }}
            aria-hidden="true"
          >
            {[3, 2, 1].map((i) => <span key={i} className="ev-back ev-pile" style={{ transform: `translate(${i * 4}px, ${i * 4}px) rotate(${i * 1.5 - 2}deg)` }}><CardBackArt /></span>)}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        className="ev-flight"
        initial={reduce ? { opacity: 0 } : { x: deck.x, y: deck.y, scale: deck.scale, rotateY: 180, rotateZ: -8, opacity: 1 }}
        animate={{ x: 0, y: 0, scale: 1, rotateY: 0, rotateZ: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0, transition: { duration: 0.25 } }}
        transition={reduce ? { duration: 0.2 } : {
          x: { delay: 0.3, duration: 0.55, ease: [0.2, 0.8, 0.3, 1] },
          y: { delay: 0.3, duration: 0.55, ease: [0.2, 0.8, 0.3, 1] },
          scale: { delay: 0.3, duration: 0.55, ease: [0.2, 0.8, 0.3, 1] },
          rotateZ: { delay: 0.3, duration: 0.6 },
          rotateY: { delay: 0.55, duration: 0.5, ease: 'easeInOut' },
        }}
      >
        <span className="ev-back ev-back-face" aria-hidden="true"><CardBackArt /></span>
        <motion.article
          className={`ev-card ${card.hostile ? 'hostile' : ''}`}
          key={`${pending.card}-${pending.step}`}
          initial={pending.step === 'start' ? false : { rotateY: -90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
          aria-label={tx(card.title)}
        >
          <span className="ev-number">{card.id}</span>
          <span className="ev-tag">{card.hostile ? (pl ? 'Zagrożenie' : 'Danger') : (pl ? 'Wydarzenie' : 'Event')}</span>
          <div className="ev-art" aria-hidden="true">
            {here && <TerrainArt terrain={here} seed={me.position} />}
            <span className="ev-art-shade" />
          </div>
          <header className="ev-head">
            <h2>{tx(card.title)}</h2>
            {here && here !== 'core' && <small>{tx(TERRAINS[here].name)}</small>}
          </header>
          <p className="ev-text">{tx(step.text ?? card.text)}</p>
          {lines.length > 0 && (
            <ul className="ev-lines">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
          <div className="ev-rule"><span>{options.length > 1 ? (pl ? 'Twój wybór' : 'Your choice') : testOf(options[0]?.option.then ?? []) ? (pl ? 'Test' : 'Test') : (pl ? 'Co robisz' : 'What you do')}</span></div>
          <div className="ev-options">
            {options.map(({ option, index, affordable }, n) => {
              // Every choice says which test it needs, the odds, and what it brings.
              const test = testOf(option.then);
              const bonus = test?.raceBonus && test.raceBonus.race === me.character.race ? test.raceBonus.amount : 0;
              const odds = test ? Math.round(successChance(me.character.attributes[test.attribute], testModifier(worldView(game), me, test.attribute, (test.modifier ?? 0) + bonus)) * 100) : null;
              const rest = test ? option.then.filter((o) => o !== test) : option.then;
              const win = test ? [...(test.pass ?? []), ...rest] : rest;
              const cost = option.cost && [
                option.cost.gold ? `${option.cost.gold} ${t('gold').toLowerCase()}` : '',
                option.cost.food ? `${option.cost.food} ${t('food').toLowerCase()}` : '',
                option.cost.speed ? `${option.cost.speed} ${t('speed').toLowerCase()}` : '',
              ].filter(Boolean).join(' · ');
              return (
                <motion.button
                  key={index}
                  className={`ev-choice ${test ? 'tested' : ''}`}
                  disabled={!affordable}
                  onClick={() => act({ type: 'event', option: index })}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (pending.step === 'start' && !reduce ? 1.0 : 0.15) + n * 0.08 }}
                >
                  <span className="ev-choice-label">{tx(option.label)}</span>
                  {test && odds !== null ? (
                    <span className={`ev-chip ${oddsTone(odds)}`}>🎲 {testLabel(test, locale)} · <b>{odds}%</b></span>
                  ) : (
                    <span className="ev-chip free">{pl ? 'Bez testu' : 'No test'}</span>
                  )}
                  {(win.length > 0 || test) && (
                    <small className="ev-out pass">{test ? (pl ? 'Sukces: ' : 'Success: ') : ''}{win.length ? outcomeText(win, locale) : (pl ? 'unikasz kłopotów' : 'you avoid the trouble')}</small>
                  )}
                  {test?.fail?.length ? <small className="ev-out fail">{pl ? 'Porażka: ' : 'Failure: '}{outcomeText(test.fail, locale)}</small> : null}
                  {cost && <small className="ev-out cost">{pl ? 'Koszt: ' : 'Cost: '}{cost}{!affordable ? (pl ? ' (nie stać cię)' : ' (you cannot pay)') : ''}</small>}
                </motion.button>
              );
            })}
          </div>
        </motion.article>
      </motion.div>
    </div>
  );
}

/** The back of an event card: a dark field with the game's diamond, the Stone of Beginnings. */
function CardBackArt() {
  return (
    <svg viewBox="0 0 60 84" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="60" height="84" fill="#1a1230" />
      <rect x="4" y="4" width="52" height="76" fill="none" stroke="#e0b25c" strokeWidth="1.2" />
      <rect x="7" y="7" width="46" height="70" fill="none" stroke="#e0b25c" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="2 2" />
      <path d="M30 22 L44 42 L30 62 L16 42 Z" fill="#2a1d4d" stroke="#e0b25c" strokeWidth="1.4" />
      <path d="M30 30 L38 42 L30 54 L22 42 Z" fill="#e0b25c" fillOpacity="0.85" />
    </svg>
  );
}

/** The outcome of a card (or a fight) after it is over, on the same kind of card as the event. */
export function StoryPanel({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="overlay" onClick={onClose}>
      <motion.article className="ev-card ev-story" {...rise} onClick={(e) => e.stopPropagation()}>
        <header className="ev-head">
          <small>{t('whatHappened')}</small>
          <h2>{title}</h2>
        </header>
        <ul className="ev-lines">
          {lines.map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}>{l}</motion.li>
          ))}
        </ul>
        <button className="ev-continue" onClick={onClose}>{t('continueStory')}</button>
      </motion.article>
    </div>
  );
}
