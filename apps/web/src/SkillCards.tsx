import { CardArt, castCard } from './CardArt';
import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { PROFESSIONS, type ActionCard, type ProfessionId } from '@hp/content';
import { CARDS_PER_GAME, isSpent, usesLeft, type ActorState } from '@hp/engine';
import { useT, type UiKey } from './i18n';
import { Icon } from './Icons';

/** Cards the player plays on the map and in a fight. Every other card works on its own. */
const MAP_PLAY = ['wraith-haste', 'warrior-rations', 'wraith-leaves', 'trapper-trap', 'elder-herb', 'explorer-bandages', 'runemaster-empower', 'gourmet-stew'];
const FIGHT_PLAY = [
  'trapper-trap', 'warrior-heavy-swing', 'diver-blowpipe', 'cavedelver-whirling-axe', 'mystic-barrier', 'warrior-rations', 'wraith-leaves',
  'explorer-disarm', 'guardian-stance', 'druid-companion', 'elder-herb', 'explorer-bandages', 'runemaster-empower',
];
/** Cards used through another button: at camp, when preparing food, in a city, or not yet in the game. */
const ELSEWHERE: Record<string, 'later' | 'camp' | 'cook' | 'city'> = {
  'cavedelver-craftsman': 'later', 'mystic-researcher': 'camp', 'elder-nature': 'camp', 'gourmet-seasoning': 'cook', 'runemaster-smelt': 'city',
};

/** A card that is never played: it works by itself whenever its moment comes. */
export const isPassive = (card: string) => !MAP_PLAY.includes(card) && !FIGHT_PLAY.includes(card) && !ELSEWHERE[card];

type Status = 'play' | 'usedUp' | 'spent' | 'later' | 'camp' | 'cook' | 'city' | 'map' | 'fight' | 'notNow' | 'passive';
const NOTE: Record<Exclude<Status, 'play'>, UiKey> = {
  usedUp: 'cardUsedUp', spent: 'cardSpent', later: 'cardLater', camp: 'cardAtCamp', cook: 'cardAtCook', city: 'cardInCity',
  map: 'cardOnMap', fight: 'cardInFight', notNow: 'cardNotNow', passive: 'cardPassive',
};

function statusOf(card: string, actor: Pick<ActorState, 'counters'>, playable: string[], inFight: boolean): Status {
  if (playable.includes(card)) return 'play';
  if (usesLeft(actor, card) === 0) return 'usedUp';
  if (isSpent(actor, card)) return 'spent';
  if (ELSEWHERE[card]) return ELSEWHERE[card];
  if (inFight && MAP_PLAY.includes(card) && !FIGHT_PLAY.includes(card)) return 'map';
  if (!inFight && FIGHT_PLAY.includes(card) && !MAP_PLAY.includes(card)) return 'fight';
  if (MAP_PLAY.includes(card) || FIGHT_PLAY.includes(card)) return 'notNow';
  return 'passive';
}

/**
 * The hero's skill cards, held like a hand of real cards. Tap one to look at it closely; a card
 * that can be played right now glows and its close-up has a button to play it.
 */
export function SkillHand({ profession, owned, actor, playable = [], onPlay, inFight = false, compact = false }: {
  profession: ProfessionId;
  owned: string[];
  actor: Pick<ActorState, 'counters'>;
  playable?: string[];
  onPlay?: (card: string) => void;
  inFight?: boolean;
  compact?: boolean;
}) {
  const { t, tx } = useT();
  const cards = PROFESSIONS[profession].cards.filter((card) => owned.includes(card.id));
  const [open, setOpen] = useState<ActionCard | null>(null);

  if (!cards.length) return null;
  const mid = (cards.length - 1) / 2;
  const status = (card: string) => statusOf(card, actor, onPlay ? playable : [], inFight);
  const uses = (card: string) => (CARDS_PER_GAME[card] ? `${usesLeft(actor, card)}/${CARDS_PER_GAME[card]}` : null);
  const openStatus = open ? status(open.id) : null;
  return (
    <>
      <div className={`hand ${compact ? 'compact' : ''}`} aria-label={t('skillCards')}>
        {cards.map((card, i) => (
          <HandCard key={card.id} card={card} status={status(card.id)} uses={uses(card.id)} tilt={(i - mid) * 7} lift={Math.abs(i - mid) * 6} idle={!!card.combat && !inFight && status(card.id) !== 'play'} onOpen={() => setOpen(card)} />
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="overlay card-zoom" key="zoom" onClick={() => setOpen(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ rotateY: 180, scale: 0.4, y: 120 }}
              animate={{ rotateY: 0, scale: 1, y: 0 }}
              exit={{ rotateY: -90, scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              style={{ transformPerspective: 900 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CardFace card={open} profession={profession} uses={uses(open.id)} large />
              {openStatus === 'play' ? (
                <div className="card-zoom-actions">
                  <button className="primary with-icon" onClick={() => { const id = open.id; castCard(id, tx(open.name)); setOpen(null); onPlay!(id); }}>
                    <Icon name={open.combat ? 'sword' : 'cards'} />{t('playCard')}
                  </button>
                  <button className="ghost" onClick={() => setOpen(null)}>{t('close')}</button>
                </div>
              ) : (
                <>
                  <p className="card-zoom-note">{t(NOTE[openStatus!])}</p>
                  <button className="primary" onClick={() => setOpen(null)}>{t('close')}</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HandCard({ card, status, uses, tilt, lift, idle, onOpen }: { card: ActionCard; status: Status; uses: string | null; tilt: number; lift: number; idle: boolean; onOpen: () => void }) {
  const { tx } = useT();
  // The card leans toward the pointer while it hovers, like one picked up from the table.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), { stiffness: 300, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [14, -14]), { stiffness: 300, damping: 20 });
  // A card used until the next camp lies turned sideways, as on the table; a used-up one is greyed.
  const sideways = status === 'spent';
  const rest = tilt + (sideways ? 90 : 0);
  return (
    <motion.button
      className={`hand-card ${card.combat ? 'combat' : ''} ${status === 'play' ? 'playable' : ''} ${status === 'usedUp' || sideways ? 'spent' : ''} ${idle ? 'idle' : ''}`}
      style={{ rotateX, rotateY, transformPerspective: 600 }}
      initial={{ y: 80, opacity: 0, rotate: rest }}
      animate={{ y: lift + (status === 'play' ? -8 : 0), opacity: 1, rotate: rest }}
      whileHover={{ y: -18, rotate: 0, scale: 1.12, zIndex: 3 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { px.set(0); py.set(0); }}
      onClick={onOpen}
      aria-label={tx(card.name)}
    >
      <CardFace card={card} uses={uses} />
    </motion.button>
  );
}

function CardFace({ card, profession, uses, large = false }: { card: ActionCard; profession?: ProfessionId; uses?: string | null; large?: boolean }) {
  const { t, tx } = useT();
  return (
    <div className={`card-face ${card.combat ? 'combat' : ''} ${large ? 'large' : ''}`}>
      <span className="card-level">{card.level}</span>
      <span className="card-tags">
        {card.combat && <span className="card-tag">{t('combatCard')}</span>}
        {isPassive(card.id) && <span className="card-tag passive">{t('passiveCard')}</span>}
      </span>
      <span className="card-art"><CardArt card={card.id} size={large ? 96 : 34} /></span>
      <b className="card-name">{tx(card.name)}</b>
      {uses && <span className="card-uses">{uses}</span>}
      {large && profession && <small className="card-prof">{tx(PROFESSIONS[profession].name)} · {t('level')} {card.level}</small>}
      {large && <p className="card-text-face">{tx(card.summary)}</p>}
    </div>
  );
}
