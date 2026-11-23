import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from './i18n';
import type { DiceRoll } from './logText';

const ROLL_MS = 900;

/**
 * The dice tray: every die thrown by an action tumbles in from the side, bounces,
 * flickers through faces and lands on the engine's result. Tap anywhere to skip.
 */
export function DiceTray({ rolls, onDone }: { rolls: DiceRoll[]; onDone: () => void }) {
  const { t } = useT();
  const [landed, setLanded] = useState(false);
  const shown = rolls.slice(0, 6);
  const total = ROLL_MS + shown.length * 120;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const land = setTimeout(() => setLanded(true), total);
    const finish = setTimeout(() => done.current(), total + 1100);
    return () => {
      clearTimeout(land);
      clearTimeout(finish);
    };
  }, [total]);

  return (
    <motion.div
      className="dice-tray"
      onClick={onDone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
    >
      <div className="dice-row">
        {shown.map((r, i) => (
          <div className="dice-group" key={i}>
            <div className="dice-pair">
              {r.kind === 'd100' ? (
                <>
                  <Die face={r.value === 100 ? '00' : String(Math.floor(r.value / 10) * 10).padStart(2, '0')} sides={10} tens delay={i * 0.12} />
                  <Die face={String(r.value % 10)} sides={10} delay={i * 0.12 + 0.05} />
                </>
              ) : (
                <Die face={String(r.value)} sides={r.sides} delay={i * 0.12} />
              )}
            </div>
            <small className="dice-label">{r.label}</small>
            <AnimatePresence>
              {landed && r.kind === 'd100' && (
                <motion.b
                  className={`dice-verdict ${r.success ? 'ok' : 'bad'}`}
                  initial={{ scale: 1.8, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: -4 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                >
                  {r.value} / {r.target} · {r.success ? t('success') : t('failure')}
                </motion.b>
              )}
              {landed && r.kind === 'plain' && (
                <motion.b className="dice-verdict" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  {r.value}
                </motion.b>
              )}
            </AnimatePresence>
          </div>
        ))}
        {rolls.length > shown.length && <span className="dice-more">+{rolls.length - shown.length}</span>}
      </div>
      <small className="dice-skip">{t('tapToSkip')}</small>
    </motion.div>
  );
}

function Die({ face, sides, tens, delay }: { face: string; sides: number; tens?: boolean; delay: number }) {
  const [shown, setShown] = useState(face);
  useEffect(() => {
    // Flicker through random faces while the die tumbles, slowing down before it lands.
    let alive = true;
    let wait = 40;
    let timer: ReturnType<typeof setTimeout>;
    const start = performance.now();
    const tick = () => {
      if (!alive) return;
      if (performance.now() - start > ROLL_MS - 80 + delay * 1000) {
        setShown(face);
        return;
      }
      const n = Math.floor(Math.random() * sides);
      setShown(tens ? String(n * 10).padStart(2, '0') : String(sides === 10 ? n : n + 1));
      wait *= 1.18;
      timer = setTimeout(tick, wait);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [face, sides, tens, delay]);

  const [spin] = useState(() => (Math.random() > 0.5 ? 1 : -1) * (540 + Math.random() * 360));
  return (
    <motion.span
      className={`die d${sides} ${tens ? 'tens' : ''}`}
      initial={{ x: '-70vw', y: -60, rotate: spin, scale: 0.7 }}
      animate={{ x: 0, y: [-60, 0, -26, 0, -8, 0], rotate: 0, scale: 1 }}
      transition={{
        delay,
        x: { duration: ROLL_MS / 1000, ease: [0.15, 0.7, 0.3, 1] },
        y: { duration: ROLL_MS / 1000, times: [0, 0.45, 0.62, 0.78, 0.9, 1], ease: 'easeOut' },
        rotate: { duration: ROLL_MS / 1000, ease: [0.2, 0.8, 0.3, 1] },
        scale: { duration: 0.3 },
      }}
    >
      {shown}
    </motion.span>
  );
}
