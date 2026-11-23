import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { PROFESSIONS, type ActionCard, type ProfessionId } from '@hp/content';
import { useT } from './i18n';
import { Icon } from './Icons';

/** The hero's skill cards, held like a hand of real cards. Tap one to look at it closely. */
export function SkillHand({ profession, owned, compact = false }: { profession: ProfessionId; owned: string[]; compact?: boolean }) {
  const { t } = useT();
  const cards = PROFESSIONS[profession].cards.filter((card) => owned.includes(card.id));
  const [open, setOpen] = useState<ActionCard | null>(null);
  if (!cards.length) return null;
  const mid = (cards.length - 1) / 2;
  return (
    <>
      <div className={`hand ${compact ? 'compact' : ''}`} aria-label={t('skillCards')}>
        {cards.map((card, i) => (
          <HandCard key={card.id} card={card} tilt={(i - mid) * 7} lift={Math.abs(i - mid) * 6} onOpen={() => setOpen(card)} />
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
              <CardFace card={open} profession={profession} large />
              <p className="card-zoom-note">{t('cardNotActive')}</p>
              <button className="primary" onClick={() => setOpen(null)}>{t('close')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HandCard({ card, tilt, lift, onOpen }: { card: ActionCard; tilt: number; lift: number; onOpen: () => void }) {
  const { tx } = useT();
  // The card leans toward the pointer while it hovers, like one picked up from the table.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), { stiffness: 300, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [14, -14]), { stiffness: 300, damping: 20 });
  return (
    <motion.button
      className={`hand-card ${card.combat ? 'combat' : ''}`}
      style={{ rotateX, rotateY, transformPerspective: 600 }}
      initial={{ y: 80, opacity: 0, rotate: tilt }}
      animate={{ y: lift, opacity: 1, rotate: tilt }}
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
      <CardFace card={card} />
    </motion.button>
  );
}

function CardFace({ card, profession, large = false }: { card: ActionCard; profession?: ProfessionId; large?: boolean }) {
  const { t, tx } = useT();
  return (
    <div className={`card-face ${card.combat ? 'combat' : ''} ${large ? 'large' : ''}`}>
      <span className="card-level">{card.level}</span>
      {card.combat && <span className="card-tag">{t('combatCard')}</span>}
      <span className="card-art"><Icon name={card.combat ? 'sword' : 'cards'} size={large ? 72 : 26} /></span>
      <b className="card-name">{tx(card.name)}</b>
      {large && profession && <small className="card-prof">{tx(PROFESSIONS[profession].name)} · {t('level')} {card.level}</small>}
      {large && <p className="card-text-face">{tx(card.summary)}</p>}
    </div>
  );
}
