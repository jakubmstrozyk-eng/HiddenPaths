import { useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useT } from './i18n';

/** How far a press may wander before it counts as a shake rather than a click. */
const SHAKE_PX = 6;

let audio: AudioContext | null = null;
/** A short knock of noise: dice clacking in the hand while shaken, and the thud of landing. */
export function clack(volume = 0.25, ms = 40) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const len = Math.floor((ctx.sampleRate * ms) / 1000);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 1600;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start();
  } catch { /* no sound on this device */ }
}

export function buzz(ms: number | number[]) {
  try { navigator.vibrate?.(ms); } catch { /* no vibration */ }
}

/**
 * Dice the player holds before throwing. Press and hold, drag them around with the mouse or a finger
 * while they spin, and let go to throw. A plain click throws at once.
 */
export function ShakeToThrow({ onThrow, hint, children, className = '' }: {
  /** Called on release with the hand's last speed in px/ms (zero for a click or a key). */
  onThrow: (velocity: { x: number; y: number }) => void;
  hint: string;
  /** The dice, drawn shaking or still. */
  children: (shaking: boolean) => ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [held, setHeld] = useState(false);
  const [shaking, setShaking] = useState(false);
  const start = useRef<{ x: number; y: number; last: number; travel: number } | null>(null);
  /** The last few positions of the hand, for the speed of the throw. */
  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const thrown = useRef(false);

  const release = () => {
    if (!start.current || thrown.current) return;
    start.current = null;
    thrown.current = true;
    setHeld(false);
    setShaking(false);
    // The dice fly back to the middle of the table, then the throw itself plays.
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 18 });
    animate(y, 0, { type: 'spring', stiffness: 500, damping: 18 });
    buzz(25);
    const pts = trail.current;
    trail.current = [];
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dt = a && b ? b.t - a.t : 0;
    onThrow(a && b && dt > 0 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : { x: 0, y: 0 });
  };

  return (
    <div className={`shake-throw ${held ? 'held' : ''} ${className}`}>
      <motion.button
        type="button"
        className="shake-dice"
        style={{ x, y, touchAction: 'none' }}
        onPointerDown={(e) => {
          if (thrown.current) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY, last: performance.now(), travel: 0 };
          setHeld(true);
          buzz(10);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          x.set(dx);
          y.set(dy);
          const now0 = performance.now();
          trail.current = [...trail.current.filter((p) => now0 - p.t < 90), { x: e.clientX, y: e.clientY, t: now0 }];
          const travel = Math.hypot(dx, dy);
          if (travel > SHAKE_PX && !shaking) setShaking(true);
          // A rattle now and then while the hand moves fast.
          const now = performance.now();
          if (Math.abs(travel - s.travel) > 24 && now - s.last > 70) {
            clack(0.12, 25);
            s.last = now;
            s.travel = travel;
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          start.current = { x: 0, y: 0, last: 0, travel: 0 };
          release();
        }}
        aria-label={hint}
      >
        {children(held)}
      </motion.button>
      <small className="shake-hint">{hint}</small>
    </div>
  );
}

/** "Sukces!" or "Porażka" stamped under the dice. */
export function Verdict({ success }: { success: boolean }) {
  const { tx } = useT();
  return (
    <motion.b
      className={`dice-verdict big ${success ? 'ok' : 'bad'}`}
      initial={{ scale: 2.2, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 12 }}
    >
      {success ? tx({ pl: 'Sukces!', en: 'Success!' }) : tx({ pl: 'Porażka', en: 'Failure' })}
    </motion.b>
  );
}
