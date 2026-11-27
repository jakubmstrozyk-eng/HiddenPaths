import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DUNGEON_THEMES, EVENT_BY_ID, TERRAINS, isDungeonCard, themeOfCard } from '@hp/content';
import { cardTestBonus, eventOptions, isOutside, legalActions, knownPerson, landAt, successChance, testModifier, worldView, type Action, type GameState, type PlayerState } from '@hp/engine';
import { JOURNAL_PEOPLE, PERSON_MARKS, PROFESSIONS, TRAITS, type TraitId } from '@hp/content';
import { EventScene } from '../EventScene';
import { cardSwish } from '../Feedback';
import { LEVEL_XP } from '@hp/engine';
import { Afflictions } from '../Afflictions';
import { outcomeText, xpWords, PUZZLE_NAME, puzzleBest, puzzleWorst, testLabel, testOf } from '../outcomeText';
import { PuzzleView } from '../Puzzles';
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
export function EventPanel({ game, me, lines, xp = 0, act, hold = false }: { game: GameState; me: PlayerState; lines: string[]; /** Experience gained on this card so far. */ xp?: number; act: (a: Action) => void; /** Dice are still rolling: the mini-game waits for them. */ hold?: boolean }) {
  const { t, tx, locale } = useT();
  const pl = locale === 'pl';
  const pending = me.pendingEvent!;
  const card = EVENT_BY_ID[pending.card]!;
  const step = card.steps[pending.step]!;
  const options = eventOptions(game, me);
  // Quick skill cards (a buff for the test, first aid) may be played before answering.
  const playable = new Set(legalActions(game, me.id).flatMap((a) => (a.type === 'card' ? [a.card] : [])));
  const quickCards = PROFESSIONS[me.character.profession].cards.filter((c) => playable.has(c.id));
  const here = isOutside(me) ? null : landAt(game.map, me.position);
  // A dungeon room plays as a card too, marked with the dungeon's name instead of the deck's number.
  const room = isDungeonCard(card.id) ? DUNGEON_THEMES[themeOfCard(card.id)!] : null;
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
          className={`ev-card ${card.hostile ? 'hostile' : ''} ${room ? 'dungeon-card' : ''}`}
          key={`${pending.card}-${pending.step}`}
          initial={pending.step === 'start' ? false : { rotateY: -90, opacity: 0.4 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
          aria-label={tx(card.title)}
        >
          <span className="ev-number">{room ? '⛬' : card.id}</span>
          <span className="ev-tag">{room ? (pl ? 'Komnata lochu' : 'Dungeon room') : card.hostile ? (pl ? 'Zagrożenie' : 'Danger') : (pl ? 'Wydarzenie' : 'Event')}</span>
          <div className="ev-art" aria-hidden="true">
            <EventScene card={card.id} step={pending.step} terrain={here} hostile={card.hostile} hero={me.character} />
          </div>
          <header className="ev-head">
            <h2>{tx(card.title)}</h2>
            {room ? <small>{tx(room.name)}</small> : here && here !== 'core' && <small>{tx(TERRAINS[here].name)}</small>}
          </header>
          <Afflictions game={game} me={me} compact />
          <p className="ev-text">{tx(step.text ?? card.text)}</p>
          {(() => {
            const known = pending.step === 'start' ? knownPerson(me, card.id) : null;
            const who = known && JOURNAL_PEOPLE.find((p) => p.id === known.id);
            return who ? (
              <p className="ev-known">
                📖 {pl ? 'Z dziennika' : 'From your journal'}: <b>{tx(who.name)}</b>{known!.mark !== 'met' ? ` · ${tx(PERSON_MARKS[known!.mark])}` : ''} · {pl ? 'wiesz, czego się spodziewać: +10 do testów' : 'you know what to expect: +10 to tests'}
              </p>
            ) : null;
          })()}
          {lines.length > 0 && (
            <ul className="ev-lines">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
          {pending.puzzle ? (
            <>
              <div className="ev-rule"><span>{PUZZLE_NAME[pending.puzzle.puzzle.kind][locale]}</span></div>
              {hold
                ? <p className="pz-hint">{pl ? 'Najpierw rzut kośćmi…' : 'Roll the dice first…'}</p>
                : <PuzzleView state={pending.puzzle} me={me} done={(answer) => act({ type: 'puzzle', answer })} />}
            </>
          ) : (<>
          <div className="ev-rule"><span>{options.length > 1 ? (pl ? 'Twój wybór' : 'Your choice') : testOf(options[0]?.option.then ?? []) ? (pl ? 'Test' : 'Test') : (pl ? 'Co robisz' : 'What you do')}</span></div>
          <div className="ev-options">
            {options.map(({ option, index, affordable }, n) => {
              // Every choice says which test it needs, the odds, and what it brings.
              const test = testOf(option.then);
              const puzzle = option.then.find((o) => o.do === 'puzzle');
              const bonus = test?.raceBonus && test.raceBonus.race === me.character.race ? test.raceBonus.amount : 0;
              const odds = test ? Math.round(successChance(me.character.attributes[test.attribute], testModifier(worldView(game), me, test.attribute, (test.modifier ?? 0) + bonus + cardTestBonus(me, card.id, test.attribute))) * 100) : null;
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
                  {option.trait && <span className="ev-trait">✒ {tx(TRAITS[option.trait as TraitId].name)}</span>}
                  <span className="ev-choice-label">{tx(option.label)}</span>
                  {puzzle && puzzle.do === 'puzzle' ? (
                    <span className="ev-chip puzzle">🧩 {PUZZLE_NAME[puzzle.puzzle.kind][locale]}</span>
                  ) : test && odds !== null ? (
                    <span className={`ev-chip ${oddsTone(odds)}`}>🎲 {testLabel(test, locale)} · <b>{odds}%</b></span>
                  ) : (
                    <span className="ev-chip free">{pl ? 'Bez testu' : 'No test'}</span>
                  )}
                  {puzzle && puzzle.do === 'puzzle' ? (
                    <>
                      <small className="ev-out pass">{pl ? 'Nagroda: ' : 'Prize: '}{outcomeText(puzzleBest(puzzle.puzzle), locale) || (pl ? 'ciąg dalszy' : 'the story goes on')}</small>
                      {puzzleWorst(puzzle.puzzle).length > 0 && <small className="ev-out fail">{pl ? 'Ryzyko: ' : 'Risk: '}{outcomeText(puzzleWorst(puzzle.puzzle), locale)}</small>}
                    </>
                  ) : (win.length > 0 || test) && (
                    <small className="ev-out pass">{test ? (pl ? 'Sukces: ' : 'Success: ') : ''}{win.length ? outcomeText(win, locale) : (pl ? 'unikasz kłopotów' : 'you avoid the trouble')}</small>
                  )}
                  {test?.fail?.length ? <small className="ev-out fail">{pl ? 'Porażka: ' : 'Failure: '}{outcomeText(test.fail, locale)}</small> : null}
                  {cost && <small className="ev-out cost">{pl ? 'Koszt: ' : 'Cost: '}{cost}{!affordable ? (pl ? ' (nie stać cię)' : ' (you cannot pay)') : ''}</small>}
                </motion.button>
              );
            })}
          </div>
          {!hold && quickCards.length > 0 && (
            <div className="ev-cards">
              <div className="ev-rule"><span>{pl ? 'Karty przed wyborem' : 'Cards before you choose'}</span></div>
              {quickCards.map((card) => (
                <button key={card.id} className="ghost" onClick={() => act({ type: 'card', card: card.id })}>🂠 {tx(card.name)}</button>
              ))}
            </div>
          )}
          </>)}
          <XpFoot gained={xp} xp={me.character.xp} level={me.character.level} />
        </motion.article>
      </motion.div>
    </div>
  );
}

/**
 * The foot of a card: the experience it gave, in full words, and the hero's way to the next level.
 * It sits at the bottom because it matters less than the story and the choices.
 */
export function XpFoot({ gained, xp, level }: { gained: number; xp: number; level: number }) {
  const { tx, locale } = useT();
  const from = LEVEL_XP[level] ?? 0;
  const to = LEVEL_XP[level + 1];
  const share = to === undefined ? 1 : Math.min(1, Math.max(0, (xp - from) / (to - from)));
  const n = Number.isInteger(gained) ? gained : Math.round(gained * 100) / 100;
  return (
    <footer className="ev-xp">
      <span className="ev-xp-gain">
        {gained > 0
          ? <>+{locale === 'pl' ? String(n).replace('.', ',') : n} {xpWords(n, locale)}</>
          : tx({ pl: 'Punkty Doświadczenia', en: 'Experience' })}
      </span>
      <span className="ev-xp-bar" aria-hidden="true"><span style={{ width: `${share * 100}%` }} /></span>
      <small>
        {to === undefined
          ? tx({ pl: `Poziom ${level} · najwyższy`, en: `Level ${level} · the top` })
          : tx({ pl: `Poziom ${level} · ${Math.floor(xp)} / ${to} · brakuje ${Math.ceil(to - xp)}`, en: `Level ${level} · ${Math.floor(xp)} / ${to} · ${Math.ceil(to - xp)} to go` })}
      </small>
    </footer>
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
export function StoryPanel({ title, lines, xp = 0, level, xpNow, locked = false, onClose }: {
  title: string; lines: string[]; xp?: number; level?: number; xpNow?: number;
  /** A fight's outcome: only its own button closes it, a stray tap beside the card does nothing. */
  locked?: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="overlay" onClick={locked ? undefined : onClose}>
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
        {xp > 0 && level !== undefined && xpNow !== undefined && <XpFoot gained={xp} xp={xpNow} level={level} />}
        <button className="ev-continue" onClick={onClose}>{t('continueStory')}</button>
      </motion.article>
    </div>
  );
}
