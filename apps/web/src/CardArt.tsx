import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type TargetAndTransition } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * A small picture for each skill card that shows what the card does: a trap on Set a Trap,
 * a fish on Fish, a barrier dome on Barrier. Drawn on a 64×64 grid.
 */
const O = '#1a120c';
const ART: Record<string, ReactNode> = {
  'trapper-hunter': (
    <>
      <path d="M14 50 Q32 6 50 50" fill="none" stroke="#8a5a32" strokeWidth={4} />
      <path d="M14 50 L50 50" stroke="#e8dcc0" strokeWidth={1.5} />
      <path d="M32 54 L32 14" stroke="#c8a060" strokeWidth={3} />
      <path d="M26 20 L32 8 L38 20 Z" fill="#c0c8d4" stroke={O} strokeWidth={1.5} />
      <path d="M28 54 L32 48 L36 54" fill="#c84a3a" />
    </>
  ),
  'trapper-trap': (
    <>
      <ellipse cx={32} cy={46} rx={24} ry={7} fill="#3a2a1a" />
      <path d="M8 44 Q32 8 56 44" fill="none" stroke="#9aa0ac" strokeWidth={4} />
      <path d="M8 44 Q32 62 56 44" fill="none" stroke="#9aa0ac" strokeWidth={4} />
      {[14, 20, 26, 32, 38, 44, 50].map((x) => <path key={x} d={`M${x - 3} ${x === 32 ? 22 : 30 - Math.abs(32 - x) / 4} l3 8 l3 -8`} fill="#dfe3ec" stroke={O} strokeWidth={1} />)}
      <circle cx={32} cy={46} r={4} fill="#c84a3a" stroke={O} />
    </>
  ),
  'trapper-precise-shot': (
    <>
      {[24, 17, 10, 4].map((r, i) => <circle key={r} cx={30} cy={34} r={r} fill={i % 2 ? '#f4ecd8' : '#c84a3a'} stroke={O} strokeWidth={1.5} />)}
      <path d="M30 34 L58 6" stroke="#c8a060" strokeWidth={3} />
      <path d="M52 6 L60 4 L58 12" fill="#5a7a3a" />
    </>
  ),
  'diver-fish': (
    <>
      <path d="M8 32 Q26 12 46 32 Q26 52 8 32 Z" fill="#5fb3b3" stroke={O} strokeWidth={2} />
      <path d="M46 32 L58 20 L58 44 Z" fill="#3a8080" stroke={O} strokeWidth={2} />
      <circle cx={18} cy={29} r={2.5} fill={O} />
      <path d="M24 24 Q28 32 24 40" fill="none" stroke="#2f5d7c" strokeWidth={2} />
      <circle cx={52} cy={10} r={3} fill="none" stroke="#a9e4e4" /><circle cx={46} cy={6} r={2} fill="none" stroke="#a9e4e4" />
    </>
  ),
  'diver-waterborn': (
    <>
      <path d="M32 6 Q48 28 44 38 Q40 50 32 50 Q24 50 20 38 Q16 28 32 6 Z" fill="#4ab0f0" stroke={O} strokeWidth={2} />
      <path d="M26 36 Q28 42 34 42" fill="none" stroke="#dff4ff" strokeWidth={2} />
      {[52, 58].map((y) => <path key={y} d={`M4 ${y} q7 -5 14 0 t14 0 t14 0 t14 0`} fill="none" stroke="#7fd3ff" strokeWidth={2.5} />)}
    </>
  ),
  'diver-blowpipe': (
    <>
      <path d="M6 44 L44 22" stroke="#8a5a32" strokeWidth={6} strokeLinecap="round" />
      <path d="M48 20 L60 13" stroke="#c8a060" strokeWidth={2} />
      <path d="M58 11 L62 10 L60 15" fill="#7ae05a" />
      {[0, 1, 2].map((i) => <circle key={i} cx={50 + i * 3} cy={28 + i * 6} r={2 + i * 0.5} fill="#7ae05a" />)}
    </>
  ),
  'warrior-veteran': (
    <>
      <path d="M14 40 Q14 12 32 12 Q50 12 50 40 L44 40 L44 30 L20 30 L20 40 Z" fill="#9aa0ac" stroke={O} strokeWidth={2} />
      <rect x={30} y={30} width={4} height={14} fill="#8f96a3" stroke={O} />
      <path d="M8 46 Q10 58 24 58" fill="none" stroke="#6a9a3a" strokeWidth={3} /><path d="M56 46 Q54 58 40 58" fill="none" stroke="#6a9a3a" strokeWidth={3} />
      <path d="M32 2 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 l5 0 Z" fill="#e8c020" />
    </>
  ),
  'warrior-heavy-swing': (
    <>
      <path d="M10 54 Q8 22 40 8" fill="none" stroke="#ffd34d" strokeWidth={2} strokeDasharray="4 4" />
      <path d="M18 50 L48 12 L54 10 L52 16 L22 54 Z" fill="#dfe3ec" stroke={O} strokeWidth={2} />
      <path d="M14 44 L28 58" stroke="#d4af37" strokeWidth={4} />
      <path d="M14 58 L19 53" stroke="#5a3418" strokeWidth={5} />
    </>
  ),
  'warrior-rations': (
    <>
      <ellipse cx={24} cy={38} rx={16} ry={11} fill="#c8904a" stroke={O} strokeWidth={2} />
      <path d="M14 34 L18 30 M22 32 L26 28 M30 34 L34 30" stroke="#8a5a2a" strokeWidth={2} />
      <path d="M36 24 Q50 10 56 22 Q60 34 46 36 Z" fill="#a8402a" stroke={O} strokeWidth={2} />
      <path d="M44 34 L52 48" stroke="#f4ecd8" strokeWidth={4} strokeLinecap="round" />
      <circle cx={53} cy={50} r={3} fill="#f4ecd8" />
    </>
  ),
  'mystic-seer': (
    <>
      {[...Array(8)].map((_, i) => <path key={i} d="M32 6 L32 0" stroke="#e8c020" strokeWidth={2} transform={`rotate(${i * 45} 32 32) translate(0 2)`} />)}
      <path d="M6 32 Q32 8 58 32 Q32 56 6 32 Z" fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={10} fill="#8f7bff" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={4} fill={O} /><circle cx={29} cy={29} r={2} fill="#fff" />
    </>
  ),
  'mystic-barrier': (
    <>
      <path d="M6 52 Q6 10 32 10 Q58 10 58 52 Z" fill="#8f7bff" opacity={0.35} stroke="#c9b8ff" strokeWidth={3} />
      <path d="M14 52 Q14 20 32 18" fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.7} />
      <rect x={4} y={52} width={56} height={4} fill="#5a4a8a" />
      <circle cx={32} cy={42} r={5} fill="#e8b796" stroke={O} /><rect x={28} y={46} width={8} height={6} fill="#b080ff" />
    </>
  ),
  'mystic-researcher': (
    <>
      <path d="M6 44 L32 50 L58 44 L58 18 L32 24 L6 18 Z" fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <path d="M32 24 L32 50" stroke={O} strokeWidth={2} />
      {[28, 33, 38].map((y) => <path key={y} d={`M12 ${y} L26 ${y + 3} M38 ${y + 3} L52 ${y}`} stroke="#9a94b8" strokeWidth={1.5} />)}
      <path d="M44 6 L48 6 L48 14 L44 14 Z" fill="#e0e0d0" /><path d="M46 0 Q49 4 46 6 Q43 4 46 0 Z" fill="#ffb347" />
    </>
  ),
  'wraith-haste': (
    <>
      {[16, 26, 36].map((y, i) => <path key={y} d={`M${4 + i * 3} ${y} L${20 + i * 3} ${y}`} stroke="#bfe9ff" strokeWidth={3} strokeLinecap="round" />)}
      <path d="M26 12 L40 12 L40 36 L54 40 L54 50 L26 50 Z" fill="#5a3a20" stroke={O} strokeWidth={2} />
      <path d="M40 18 Q56 8 60 16 Q54 18 50 24 Q58 24 58 30 Q48 30 40 28 Z" fill="#f4f4f4" stroke={O} strokeWidth={1.5} />
    </>
  ),
  'wraith-critical': (
    <>
      <circle cx={34} cy={34} r={20} fill="#3a1418" stroke="#ff6a5a" strokeWidth={2} />
      <path d="M34 34 L22 22 M34 34 L48 26 M34 34 L30 52 M34 34 L50 46" stroke="#ff6a5a" strokeWidth={2} />
      <path d="M4 60 L30 34 L34 30 L36 36 L10 62 Z" fill="#dfe3ec" stroke={O} strokeWidth={2} />
      <path d="M2 54 L10 62" stroke="#8aa0b8" strokeWidth={4} />
    </>
  ),
  'wraith-leaves': (
    <>
      {[-40, 0, 40].map((r) => (
        <g key={r} transform={`rotate(${r} 32 50)`}>
          <path d="M32 50 Q18 30 32 8 Q46 30 32 50 Z" fill="#4a9a3a" stroke={O} strokeWidth={2} />
          <path d="M32 46 L32 14" stroke="#b8e0a0" strokeWidth={1.5} />
        </g>
      ))}
      <circle cx={32} cy={52} r={4} fill="#e0ff80" />
    </>
  ),
  'cavedelver-strongman': (
    <>
      <rect x={10} y={30} width={44} height={5} fill="#5a5e68" stroke={O} />
      {[6, 12, 46, 52].map((x) => <rect key={x} x={x} y={x === 6 || x === 52 ? 20 : 16} width={6} height={x === 6 || x === 52 ? 25 : 33} fill="#3a3a44" stroke={O} strokeWidth={1.5} />)}
      <path d="M26 58 Q22 44 30 40 Q38 44 34 58 Z" fill="#8a8f98" stroke={O} strokeWidth={2} />
    </>
  ),
  'cavedelver-craftsman': (
    <>
      <path d="M10 44 L54 44 L48 52 L40 52 L40 60 L24 60 L24 52 L16 52 Z" fill="#3a3a44" stroke={O} strokeWidth={2} />
      <path d="M20 8 L44 32" stroke="#8a5a32" strokeWidth={5} strokeLinecap="round" />
      <rect x={30} y={6} width={18} height={11} fill="#9aa0ac" stroke={O} strokeWidth={2} transform="rotate(45 39 11)" />
      {[0, 1, 2].map((i) => <circle key={i} cx={22 + i * 8} cy={40 - (i % 2) * 4} r={1.8} fill="#ffb347" />)}
    </>
  ),
  'cavedelver-whirling-axe': (
    <>
      <path d="M32 6 A26 26 0 1 1 8 40" fill="none" stroke="#ffb347" strokeWidth={2.5} strokeDasharray="5 4" />
      <path d="M4 34 L8 42 L14 36" fill="none" stroke="#ffb347" strokeWidth={2.5} />
      <path d="M32 54 L32 18" stroke="#8a5a32" strokeWidth={4} />
      <path d="M32 18 Q48 14 50 28 Q44 34 32 30 Z" fill="#dfe3ec" stroke={O} strokeWidth={2} />
      <path d="M32 18 Q16 14 14 28 Q20 34 32 30 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
    </>
  ),
};

export function CardArt({ card, size }: { card: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="card-art-svg">
      {ART[card] ?? <circle cx={32} cy={32} r={20} fill="#8f7bff" />}
    </svg>
  );
}

/** How a card's picture moves when it is played. */
type Fx = 'snap' | 'shot' | 'swing' | 'spin' | 'pulse' | 'rise' | 'shine' | 'dash';
const FX: Record<string, Fx> = {
  'trapper-hunter': 'shot', 'trapper-trap': 'snap', 'trapper-precise-shot': 'shot',
  'diver-fish': 'dash', 'diver-waterborn': 'rise', 'diver-blowpipe': 'shot',
  'warrior-veteran': 'shine', 'warrior-heavy-swing': 'swing', 'warrior-rations': 'pulse',
  'mystic-seer': 'shine', 'mystic-barrier': 'pulse', 'mystic-researcher': 'shine',
  'wraith-haste': 'dash', 'wraith-critical': 'swing', 'wraith-leaves': 'rise',
  'cavedelver-strongman': 'pulse', 'cavedelver-craftsman': 'swing', 'cavedelver-whirling-axe': 'spin',
};
const GLOW: Record<Fx, string> = {
  snap: '#c0c8d4', shot: '#ffe066', swing: '#ffd34d', spin: '#ffb347', pulse: '#c9b8ff', rise: '#7ae05a', shine: '#fff1b0', dash: '#7fd3ff',
};

const MOVES: Record<Fx, TargetAndTransition> = {
  snap: { scaleY: [1, 0.35, 1.15, 1], scaleX: [1, 1.2, 0.95, 1] },
  shot: { x: [0, -18, 60, 0], opacity: [1, 1, 0, 1] },
  swing: { rotate: [0, -50, 70, 0] },
  spin: { rotate: [0, 360, 720] },
  pulse: { scale: [1, 1.35, 0.9, 1.15, 1] },
  rise: { y: [0, -24, 0], scale: [1, 1.15, 1] },
  shine: { scale: [1, 1.2, 1], filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'] },
  dash: { x: [0, 40, -40, 0], opacity: [1, 0, 0, 1] },
};

/** The short show when a card is played: the card flips up, its picture acts out the card, and a ring of light bursts. */
export function CardCast({ card, name }: { card: string; name: string }) {
  const fx = FX[card] ?? 'pulse';
  return (
    <motion.div className="card-cast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
      <motion.div
        className="card-cast-card"
        style={{ ['--glow' as string]: GLOW[fx], transformPerspective: 800 }}
        initial={{ rotateY: 180, scale: 0.3, y: 160 }}
        animate={{ rotateY: 0, scale: 1, y: 0 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      >
        <motion.span className="card-cast-ring" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ delay: 0.35, duration: 0.7 }} />
        <motion.span animate={MOVES[fx]} transition={{ delay: 0.3, duration: fx === 'spin' ? 0.8 : 0.6, ease: 'easeInOut' }} style={{ display: 'inline-block' }}>
          <CardArt card={card} size={110} />
        </motion.span>
        <b>{name}</b>
      </motion.div>
    </motion.div>
  );
}

const CAST_EVENT = 'hp:cast-card';

/** Plays a card's show. The host lives above the duel, so the show outlasts the hand that started it. */
export function castCard(card: string, name: string) {
  window.dispatchEvent(new CustomEvent(CAST_EVENT, { detail: { card, name } }));
}

export function CardCastHost() {
  const [cast, setCast] = useState<{ card: string; name: string; at: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setCast({ ...(e as CustomEvent<{ card: string; name: string }>).detail, at: Date.now() });
    window.addEventListener(CAST_EVENT, on);
    return () => window.removeEventListener(CAST_EVENT, on);
  }, []);
  useEffect(() => {
    if (!cast) return;
    const timer = setTimeout(() => setCast(null), 1400);
    return () => clearTimeout(timer);
  }, [cast]);
  return <AnimatePresence>{cast && <CardCast key={cast.at} card={cast.card} name={cast.name} />}</AnimatePresence>;
}
