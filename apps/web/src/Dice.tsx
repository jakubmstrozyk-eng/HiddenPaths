import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from './i18n';
import type { Attribute, DiceLook } from '@hp/content';
import { attrName } from './outcomeText';
import type { DiceRoll } from './logText';
import { diceVars } from './DiceFace';
import { buzz, clack, ShakeToThrow, Verdict } from './Throw';

/** Longest a throw may tumble before every die is laid down. */
const MAX_MS = 3400;
/** How long the result stays before the tray closes by itself. */
const READ_MS = 2600;
const GRAVITY = 2600;
const WALL_BOUNCE = 0.62;
const FLOOR_BOUNCE = 0.38;

/** One die in the box: where it is, how it moves and the face it lands on. */
interface Body {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  a: number; va: number;
  /** Fake tumbling while it flies: squashes the die along one axis. */
  tumble: number;
  sides: number; tens: boolean;
  final: string;
  /** It has come to rest (or slowed enough to show its real face). */
  shown: boolean;
  rest: boolean;
  lastFlick: number;
  lastHit: number;
}

/** The dice of a throw, one entry per die: a d100 test is two d10s (tens and units). */
function diceOfRolls(rolls: DiceRoll[], dice?: DiceLook) {
  const out: { group: number; sides: number; tens: boolean; final: string; style?: React.CSSProperties; label: string }[] = [];
  rolls.forEach((r, i) => {
    if (r.kind === 'd100') {
      out.push({ group: i, sides: 10, tens: true, final: r.value === 100 ? '00' : String(Math.floor(r.value / 10) * 10).padStart(2, '0'), style: diceVars(dice, 'd100'), label: r.label });
      out.push({ group: i, sides: 10, tens: false, final: String(r.value % 10), style: diceVars(dice, 'd10'), label: r.label });
    } else {
      out.push({ group: i, sides: r.sides, tens: false, final: String(r.value), style: r.sides === 10 ? diceVars(dice, 'd10') : r.sides <= 6 ? diceVars(dice, 'd6') : undefined, label: r.label });
    }
  });
  return out;
}

const randomFace = (sides: number, tens: boolean) => {
  const n = Math.floor(Math.random() * sides);
  return tens ? String(n * 10).padStart(2, '0') : String(sides === 10 ? n : n + 1);
};

/**
 * The dice box. The whole screen goes dark so the throw is all there is to look at. The dice wait in
 * the hand: hold, shake and let go (or just click) and they fly into a felt-lined box, bounce off its
 * walls and each other, clatter and roll to a stop on the engine's result. Then the verdict.
 */
export function DiceTray({ rolls, onDone, dice, heading, base }: {
  rolls: DiceRoll[];
  onDone: () => void;
  dice?: DiceLook;
  /** What the throw is for: "Polowanie", an event's title... */
  heading?: string | null;
  /** The hero's attributes, to show how the target number is made up. */
  base?: Record<Attribute, number>;
}) {
  const { t, tx, locale } = useT();
  const shown = rolls.slice(0, 6);
  const parts = diceOfRolls(shown, dice);
  const [thrown, setThrown] = useState(() => !shown.some((r) => r.kind === 'd100'));
  const [landed, setLanded] = useState(false);
  const fling = useRef({ x: 0, y: 0 });
  const done = useRef(onDone);
  done.current = onDone;
  const felt = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const shadows = useRef<(HTMLSpanElement | null)[]>([]);
  const faces = useRef<(HTMLSpanElement | null)[]>([]);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // The throw itself: a small physics loop that moves the dice straight in the page, frame by frame.
  useLayoutEffect(() => {
    if (!thrown) return;
    const box = felt.current;
    if (!box) return;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const size = els.current[0]?.offsetWidth || 46;
    const r = size / 2;
    const n = parts.length;
    const place = (b: Body, i: number) => {
      const el = els.current[i];
      const sh = shadows.current[i];
      if (!el || !sh) return;
      const lift = b.z * 0.45;
      const scale = 1 + b.z / 240;
      const squash = 0.6 + 0.4 * Math.abs(Math.cos(b.tumble));
      el.style.transform = `translate(${b.x - r}px, ${b.y - r - lift}px) rotate(${b.a}deg) scale(${scale * squash}, ${scale})`;
      sh.style.transform = `translate(${b.x - r + b.z * 0.18}px, ${b.y - r + 4 + b.z * 0.12}px) scale(${1 + b.z / 160})`;
      sh.style.opacity = String(Math.max(0.15, 0.55 - b.z / 400));
    };
    const showFace = (b: Body, i: number, face: string) => {
      const f = faces.current[i];
      if (f && f.textContent !== face) f.textContent = face;
      b.lastFlick = performance.now();
    };

    // With reduced motion the dice are simply laid out in the box with their faces up.
    if (reduce) {
      parts.forEach((p, i) => {
        const b = { x: W / 2 + (i - (n - 1) / 2) * (size + 12), y: H / 2, z: 0, a: 0, tumble: 0 } as Body;
        place(b, i);
        showFace(b, i, p.final);
      });
      setLanded(true);
      return;
    }

    // The hand's last movement sets the direction and strength of the throw; a click throws up the box.
    const hand = fling.current;
    const handSpeed = Math.hypot(hand.x, hand.y);
    const dir = handSpeed > 0.25 ? { x: hand.x / handSpeed, y: hand.y / handSpeed } : { x: (Math.random() - 0.5) * 0.7, y: -1 };
    const norm = Math.hypot(dir.x, dir.y);
    const power = Math.min(1500, Math.max(760, handSpeed * 900 + 700));
    const bodies: Body[] = parts.map((p, i) => {
      const spread = (i - (n - 1) / 2) * Math.min(size + 6, (W - size * 2) / Math.max(1, n));
      const jitter = 0.75 + Math.random() * 0.5;
      return {
        x: Math.min(W - r - 2, Math.max(r + 2, W / 2 + spread - dir.x * W * 0.25)),
        y: Math.min(H - r - 2, Math.max(r + 2, dir.y <= 0 ? H - r - 6 : r + 6)),
        z: 110 + Math.random() * 60,
        vx: (dir.x / norm) * power * jitter + (Math.random() - 0.5) * 260,
        vy: (dir.y / norm) * power * jitter + (Math.random() - 0.5) * 160,
        vz: 120 + Math.random() * 200,
        a: Math.random() * 360,
        va: (Math.random() > 0.5 ? 1 : -1) * (500 + Math.random() * 700),
        tumble: Math.random() * Math.PI,
        sides: p.sides, tens: p.tens, final: p.final,
        shown: false, rest: false, lastFlick: 0, lastHit: 0,
      };
    });
    bodies.forEach(place);
    let lastSound = 0;
    const knock = (speed: number) => {
      const now = performance.now();
      if (speed < 110 || now - lastSound < 45) return;
      lastSound = now;
      clack(Math.min(0.4, 0.06 + speed / 3200), 26 + Math.random() * 20);
    };

    const startAt = performance.now();
    let prev = startAt;
    let frame = 0;
    let settled = false;
    let settledAt = 0;
    const step = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000);
      prev = now;
      const late = now - startAt > MAX_MS;
      for (let i = 0; i < n; i++) {
        const b = bodies[i]!;
        if (b.rest) {
          // Come to rest square enough to read the number.
          const turn = b.sides === 6 ? 90 : 360;
          const target = Math.round(b.a / turn) * turn + (i % 2 ? 5 : -5);
          b.a += (target - b.a) * Math.min(1, dt * 9);
          b.tumble += (Math.round(b.tumble / Math.PI) * Math.PI - b.tumble) * Math.min(1, dt * 12);
          place(b, i);
          continue;
        }
        // Falling and bouncing on the felt.
        b.vz -= GRAVITY * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -90) {
            knock(-b.vz * 0.9);
            b.vz = -b.vz * FLOOR_BOUNCE;
            b.va += (Math.random() - 0.5) * 500;
          } else b.vz = 0;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // The walls of the box.
        if (b.x < r) { b.x = r; if (b.vx < 0) { knock(-b.vx); b.vx = -b.vx * WALL_BOUNCE; b.va = -b.va * 0.8 + (Math.random() - 0.5) * 300; } }
        if (b.x > W - r) { b.x = W - r; if (b.vx > 0) { knock(b.vx); b.vx = -b.vx * WALL_BOUNCE; b.va = -b.va * 0.8 + (Math.random() - 0.5) * 300; } }
        if (b.y < r) { b.y = r; if (b.vy < 0) { knock(-b.vy); b.vy = -b.vy * WALL_BOUNCE; b.va = -b.va * 0.8 + (Math.random() - 0.5) * 300; } }
        if (b.y > H - r) { b.y = H - r; if (b.vy > 0) { knock(b.vy); b.vy = -b.vy * WALL_BOUNCE; b.va = -b.va * 0.8 + (Math.random() - 0.5) * 300; } }
        // Rolling on the felt slows the die down.
        const speed = Math.hypot(b.vx, b.vy);
        if (b.z === 0) {
          const k = Math.exp(-1.9 * dt);
          const drag = Math.max(0, speed - 260 * dt) / (speed || 1);
          b.vx *= k * drag;
          b.vy *= k * drag;
          b.va *= Math.exp(-2.6 * dt);
        }
        b.a += b.va * dt;
        b.tumble += (b.z > 0 ? 9 : speed / 60) * dt;
        // Faces flicker while the die tumbles, then the real one turns up.
        if (!b.shown) {
          if (b.z === 0 && speed < 140) { b.shown = true; showFace(b, i, b.final); }
          else if (now - b.lastFlick > 65) showFace(b, i, randomFace(b.sides, b.tens));
        }
        if ((b.z === 0 && b.vz === 0 && speed < 22) || late) {
          b.vx = 0; b.vy = 0; b.va = 0; b.z = 0; b.vz = 0;
          b.rest = true;
          if (!b.shown) { b.shown = true; showFace(b, i, b.final); }
        }
      }
      // Dice knock into each other.
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = bodies[i]!;
          const c = bodies[j]!;
          if (Math.abs(a.z - c.z) > size * 0.8) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const min = size * 0.92;
          if (d >= min) continue;
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          c.x += nx * push; c.y += ny * push;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const impulse = -rel * 0.9;
            a.vx -= nx * impulse; a.vy -= ny * impulse;
            c.vx += nx * impulse; c.vy += ny * impulse;
            if (a.rest && impulse > 60) a.rest = false;
            if (c.rest && impulse > 60) c.rest = false;
            knock(impulse);
          }
        }
      }
      bodies.forEach(place);
      const still = bodies.every((b) => b.rest);
      if (still && !settled) {
        settled = true;
        settledAt = now;
        setTimeout(() => setLanded(true), 260);
      }
      if (!still) settled = false;
      // Keep easing the angles for a moment after the last die stops.
      if (!settled || now - settledAt < 700) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [thrown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the dice lie still: a thud, a buzz for the verdict, and the tray closes after a while.
  useEffect(() => {
    if (!landed) return;
    clack(0.3, 50);
    const tests = shown.filter((r) => r.kind === 'd100');
    if (tests.length) buzz(tests.every((r) => r.success) ? [30, 40, 30] : 60);
    const finish = setTimeout(() => done.current(), READ_MS + shown.length * 250);
    return () => clearTimeout(finish);
  }, [landed]); // eslint-disable-line react-hooks/exhaustive-deps

  const tests = shown.filter((r): r is Extract<DiceRoll, { kind: 'd100' }> => r.kind === 'd100');
  const single = tests.filter((r) => !r.first);

  return (
    <motion.div
      className={`dice-tray box-tray ${thrown ? '' : 'ready'}`}
      onClick={landed ? onDone : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
    >
      <TrayHead rolls={rolls} heading={heading ?? null} base={base} locale={locale} landed={landed} />
      <div className={`dice-box ${thrown ? 'thrown' : ''}`} onClick={(e) => { e.stopPropagation(); if (!thrown) { fling.current = { x: 0, y: 0 }; setThrown(true); } else if (landed) onDone(); }}>
        <div className="dice-box-felt" ref={felt}>
          {thrown && parts.map((p, i) => (
            <span key={`s${i}`} className="box-shadow" ref={(el) => { shadows.current[i] = el; }} />
          ))}
          {thrown && parts.map((p, i) => (
            <span key={i} className="box-die" ref={(el) => { els.current[i] = el; }}>
              <span className={`die d${p.sides} ${p.tens ? 'tens' : ''}`} style={p.style}>
                <span ref={(el) => { faces.current[i] = el; }}>{reduce ? p.final : '?'}</span>
              </span>
              {landed && shown.length > 1 && <small className="box-die-tag">{p.label}</small>}
            </span>
          ))}
          {!thrown && <span className="box-empty">{tx({ pl: 'Rzuć kośćmi do skrzynki', en: 'Throw the dice into the box' })}</span>}
        </div>
      </div>
      <div className="box-under">
      {!thrown && (
        <ShakeToThrow
          onThrow={(v) => { fling.current = v; setThrown(true); }}
          hint={tx({ pl: 'Przytrzymaj kości, potrząśnij i rzuć w stronę skrzynki', en: 'Hold the dice, shake and fling them at the box' })}
        >
          {(shaking) => (
            <span className="dice-row hand-row">
              {parts.map((p, i) => <HeldDie key={i} sides={p.sides} tens={p.tens} shaking={shaking} style={p.style} />)}
            </span>
          )}
        </ShakeToThrow>
      )}
      {thrown && <div className="box-results" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {landed && shown.map((r, i) => (
            <motion.div
              key={i}
              className={`box-result ${r.kind === 'd100' ? (r.success ? 'ok' : 'bad') : 'plain'} ${r.kind === 'd100' && r.first ? 'first-throw' : ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12 }}
            >
              <small>{r.label}</small>
              <b>{r.value}</b>
              {r.kind === 'd100' && <span className="box-need">{tx({ pl: `potrzeba ≤ ${r.target}`, en: `needed ≤ ${r.target}` })}</span>}
            </motion.div>
          ))}
        </AnimatePresence>
        {landed && single.length === 1 && <Verdict success={single[0]!.success} />}
      </div>}
      </div>
      {landed
        ? <small className="dice-skip">{t('tapToSkip')}</small>
        : <button className="ghost small dice-skip-btn" onClick={(e) => { e.stopPropagation(); onDone(); }}>{t('tapToSkip')}</button>}
    </motion.div>
  );
}

/** A die still in the hand: it shows "?" and spins with a flicker of faces while shaken. */
function HeldDie({ sides, tens, shaking, style }: { sides: number; tens?: boolean; shaking: boolean; style?: React.CSSProperties }) {
  const [face, setFace] = useState('?');
  useEffect(() => {
    if (!shaking) return setFace('?');
    const timer = setInterval(() => setFace(randomFace(sides, !!tens)), 90);
    return () => clearInterval(timer);
  }, [shaking, sides, tens]);
  return <span className={`die d${sides} ${tens ? 'tens' : ''} ${shaking ? 'shaking' : ''}`} style={style}>{face}</span>;
}

/**
 * Above the box: what the test is for, which attribute it checks and, instead of a bare number,
 * a strip from 1 to 100 with the winning part lit. Once the dice land, a marker drops on the throw.
 */
function TrayHead({ rolls, heading, base, locale, landed }: { rolls: DiceRoll[]; heading: string | null; base?: Record<Attribute, number>; locale: string; landed: boolean }) {
  const all = rolls.filter((r): r is Extract<DiceRoll, { kind: 'd100' }> => r.kind === 'd100');
  // A skill card's second throw is the same test again, so it does not count as another test.
  const tests = all.filter((r) => !r.reroll);
  const reroll = all.find((r) => r.reroll)?.reroll;
  if (!tests.length && !heading) return null;
  const pl = locale === 'pl';
  const first = tests[0];
  const last = all[all.length - 1];
  const attr = first?.attr ? attrName(first.attr, locale as 'pl' | 'en') : first?.label;
  const own = first?.attr && base ? base[first.attr] : undefined;
  const diff = own !== undefined && first ? first.target - own : 0;
  return (
    <div className="test-title tray-head" onClick={(e) => e.stopPropagation()}>
      {heading && <small className="tray-heading">{heading}</small>}
      {first && <b>{pl ? 'Test' : 'Test'}: {attr}</b>}
      {reroll && <span className="tray-reroll">↻ {reroll}: {pl ? 'nieudany rzut powtórzony' : 'failed throw rolled again'}</span>}
      {tests.length === 1 && first && (
        <>
          <span className="odds-strip" aria-label={pl ? `Rzuć ${first.target} lub mniej` : `Roll ${first.target} or lower`}>
            <span className="odds-win" style={{ width: `${first.target}%` }} />
            <span className="odds-target" style={{ left: `${first.target}%` }}><b>{first.target}</b></span>
            {landed && last && (
              <motion.span
                className={`odds-roll ${last.success ? 'ok' : 'bad'}`}
                initial={{ left: '0%', opacity: 0 }}
                animate={{ left: `${Math.min(100, Math.max(1, last.value))}%`, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 140, damping: 16 }}
              >
                ▼<b>{last.value}</b>
              </motion.span>
            )}
          </span>
          <small className="odds-note">
            {pl ? `Wyrzuć ${first.target} lub mniej · szansa ${first.target}%` : `Roll ${first.target} or lower · ${first.target}% chance`}
            {own !== undefined && diff !== 0 && ` · ${attr} ${own}, ${pl ? 'modyfikatory' : 'modifiers'} ${diff > 0 ? `+${diff}` : `−${-diff}`}`}
          </small>
        </>
      )}
    </div>
  );
}
