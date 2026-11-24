import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from './i18n';
import type { Attribute, DiceLook } from '@hp/content';
import { attrName } from './outcomeText';
import type { DiceRoll } from './logText';
import { diceVars } from './DiceFace';
import { buzz, clack, ShakeToThrow, Verdict } from './Throw';

const ROLL_MS = 900;

/**
 * The dice tray. A test waits in the player's hand: hold, shake and let go (or just click) to throw.
 * Every die then tumbles, flickers through faces and lands on the engine's result, with Success! or Failure under it.
 */
export function DiceTray({ rolls, onDone, dice, heading, base }: {
  rolls: DiceRoll[];
  onDone: () => void;
  dice?: DiceLook;
  /** What the throw is for: "Polowanie", an event's title... */
  heading?: string | null;
  /** The hero's attributes, to show how the number on the shield is made up. */
  base?: Record<Attribute, number>;
}) {
  const { t, tx, locale } = useT();
  const head = <TrayHead rolls={rolls} heading={heading ?? null} base={base} locale={locale} />;
  const shown = rolls.slice(0, 6);
  const [thrown, setThrown] = useState(() => !shown.some((r) => r.kind === 'd100'));
  const [landed, setLanded] = useState(false);
  const total = ROLL_MS + shown.length * 120;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!thrown) return;
    const land = setTimeout(() => {
      setLanded(true);
      clack(0.35, 60);
      const tests = shown.filter((r) => r.kind === 'd100');
      if (tests.length) buzz(tests.every((r) => r.success) ? [30, 40, 30] : 60);
    }, total);
    const finish = setTimeout(() => done.current(), total + 1600);
    return () => {
      clearTimeout(land);
      clearTimeout(finish);
    };
  }, [total, thrown]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!thrown) {
    return (
      <motion.div className="dice-tray ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {head}
        <ShakeToThrow onThrow={() => setThrown(true)} hint={tx({ pl: 'Przytrzymaj kości, potrząśnij i puść', en: 'Hold the dice, shake and let go' })}>
          {(shaking) => (
            <span className="dice-row">
              {shown.map((r, i) => (
                <span className="dice-group" key={i}>
                  <span className="dice-pair">
                    {r.kind === 'd100' ? (
                      <>
                        <HeldDie sides={10} tens shaking={shaking} style={diceVars(dice, 'd100')} />
                        <HeldDie sides={10} shaking={shaking} style={diceVars(dice, 'd10')} />
                      </>
                    ) : (
                      <HeldDie sides={r.sides} shaking={shaking} style={r.sides === 10 ? diceVars(dice, 'd10') : r.sides <= 6 ? diceVars(dice, 'd6') : undefined} />
                    )}
                  </span>
                  <small className="dice-label">{r.label}</small>
                </span>
              ))}
            </span>
          )}
        </ShakeToThrow>
        <button className="ghost small dice-skip-btn" onClick={onDone}>{t('tapToSkip')}</button>
      </motion.div>
    );
  }

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
      {head}
      <div className="dice-row">
        {shown.map((r, i) => (
          <div className="dice-group" key={i}>
            <div className="dice-pair">
              {r.kind === 'd100' ? (
                <>
                  <Die face={r.value === 100 ? '00' : String(Math.floor(r.value / 10) * 10).padStart(2, '0')} sides={10} tens delay={i * 0.12} style={diceVars(dice, 'd100')} />
                  <Die face={String(r.value % 10)} sides={10} delay={i * 0.12 + 0.05} style={diceVars(dice, 'd10')} />
                </>
              ) : (
                <Die face={String(r.value)} sides={r.sides} delay={i * 0.12} style={r.sides === 10 ? diceVars(dice, 'd10') : r.sides <= 6 ? diceVars(dice, 'd6') : undefined} />
              )}
            </div>
            <small className="dice-label">{r.label}</small>
            <AnimatePresence>
              {landed && r.kind === 'd100' && (
                <Verdict success={r.success} />
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

function Die({ face, sides, tens, delay, style }: { face: string; sides: number; tens?: boolean; delay: number; style?: React.CSSProperties }) {
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
      style={style}
      initial={{ x: (Math.random() - 0.5) * 80, y: -140, rotate: spin, scale: 1.2 }}
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

/** A die still in the hand: it shows "?" and spins with a flicker of faces while shaken. */
function HeldDie({ sides, tens, shaking, style }: { sides: number; tens?: boolean; shaking: boolean; style?: React.CSSProperties }) {
  const [face, setFace] = useState('?');
  useEffect(() => {
    if (!shaking) return setFace('?');
    const timer = setInterval(() => {
      const n = Math.floor(Math.random() * sides);
      setFace(tens ? String(n * 10).padStart(2, '0') : String(sides === 10 ? n : n + 1));
    }, 90);
    return () => clearInterval(timer);
  }, [shaking, sides, tens]);
  return <span className={`die d${sides} ${tens ? 'tens' : ''} ${shaking ? 'shaking' : ''}`} style={style}>{face}</span>;
}

/** Above the dice: what the test is for, which attribute it checks, and on the shield the number to roll at or under. */
function TrayHead({ rolls, heading, base, locale }: { rolls: DiceRoll[]; heading: string | null; base?: Record<Attribute, number>; locale: string }) {
  const tests = rolls.filter((r): r is Extract<DiceRoll, { kind: 'd100' }> => r.kind === 'd100');
  if (!tests.length && !heading) return null;
  const pl = locale === 'pl';
  const first = tests[0];
  const attr = first?.attr ? attrName(first.attr, locale as 'pl' | 'en') : first?.label;
  const own = first?.attr && base ? base[first.attr] : undefined;
  const diff = own !== undefined && first ? first.target - own : 0;
  return (
    <div className="test-title tray-head" onClick={(e) => e.stopPropagation()}>
      {heading && <small className="tray-heading">{heading}</small>}
      {first && <b>{pl ? 'Test' : 'Test'}: {attr}</b>}
      {tests.length === 1 && first && (
        <>
          <span className="target-shield big" title={pl ? 'Rzuć tyle lub mniej' : 'Roll this or lower'}>
            <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 L37 8 V22 C37 34 29 41 20 44 C11 41 3 34 3 22 V8 Z" /></svg>
            <span>{first.target}</span>
          </span>
          {own !== undefined && diff !== 0 && (
            <small>{attr} {own} · {pl ? 'modyfikatory' : 'modifiers'} {diff > 0 ? `+${diff}` : diff}</small>
          )}
        </>
      )}
    </div>
  );
}
