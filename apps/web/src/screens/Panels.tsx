import { motion } from 'motion/react';
import { EVENT_BY_ID } from '@hp/content';
import { eventOptions, type Action, type GameState, type PlayerState } from '@hp/engine';
import { useT } from '../i18n';

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

