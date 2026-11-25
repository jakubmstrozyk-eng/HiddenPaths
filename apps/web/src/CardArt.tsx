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
  'elder-wisdom': (
    <>
      <path d="M8 46 L32 52 L56 46 L56 20 L32 26 L8 20 Z" fill="#e8dcc0" stroke={O} strokeWidth={2} />
      <path d="M32 26 L32 52" stroke={O} strokeWidth={2} />
      <path d="M20 12 A12 12 0 1 1 44 12" fill="none" stroke="#8f7bff" strokeWidth={3} />
      <path d="M44 4 L46 13 L37 12" fill="none" stroke="#8f7bff" strokeWidth={3} />
      <circle cx={32} cy={38} r={4} fill="#d4af37" stroke={O} />
    </>
  ),
  'elder-nature': (
    <>
      <path d="M6 56 L58 56" stroke="#5a7a3a" strokeWidth={3} />
      <path d="M14 56 L20 44 L26 56 M40 56 L46 46 L52 56" fill="#c84a3a" stroke="#ffb347" strokeWidth={2} />
      <circle cx={32} cy={24} r={8} fill="#e8b796" stroke={O} strokeWidth={2} />
      <path d="M20 46 Q32 30 44 46 Z" fill="#e8dcc0" stroke={O} strokeWidth={2} />
      {[-50, -20, 20, 50].map((r) => <path key={r} d="M32 12 Q36 4 32 0 Q28 4 32 12 Z" fill="#6ab04a" transform={`rotate(${r} 32 24)`} />)}
    </>
  ),
  'elder-herb': (
    <>
      <path d="M32 58 L32 22" stroke="#4a7a2a" strokeWidth={3} />
      {([[-1, 40], [1, 32], [-1, 26]] as const).map(([d, y]) => <path key={y} d={`M32 ${y} Q${32 + d * 18} ${y - 12} ${32 + d * 22} ${y - 2} Q${32 + d * 12} ${y + 4} 32 ${y} Z`} fill="#6ab04a" stroke={O} strokeWidth={1.5} />)}
      <circle cx={32} cy={16} r={6} fill="#f4f0a0" stroke={O} strokeWidth={1.5} />
      <path d="M48 46 h8 M52 42 v8" stroke="#ff6a5a" strokeWidth={3} />
    </>
  ),
  'gourmet-fish': (
    <>
      <path d="M6 30 Q24 12 44 30 Q24 48 6 30 Z" fill="#f0a050" stroke={O} strokeWidth={2} />
      <path d="M44 30 L58 18 L58 42 Z" fill="#c87030" stroke={O} strokeWidth={2} />
      <circle cx={16} cy={27} r={2.5} fill={O} />
      <path d="M10 56 Q32 46 54 56" fill="none" stroke="#5fb3b3" strokeWidth={3} />
      <path d="M50 6 L50 14 M46 10 L54 10" stroke="#fff1b0" strokeWidth={2} />
    </>
  ),
  'gourmet-seasoning': (
    <>
      <rect x={20} y={20} width={24} height={36} rx={5} fill="#c84a3a" stroke={O} strokeWidth={2} />
      <rect x={22} y={12} width={20} height={10} rx={2} fill="#dfe3ec" stroke={O} strokeWidth={2} />
      {[26, 32, 38].map((x) => <circle key={x} cx={x} cy={17} r={1.3} fill={O} />)}
      {([[14, 6], [32, 2], [50, 6], [10, 14], [54, 14]] as const).map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.8} fill="#ffb347" />)}
      <path d="M26 34 L38 34 M26 42 L36 42" stroke="#ffd8a0" strokeWidth={2} />
    </>
  ),
  'gourmet-stew': (
    <>
      <path d="M8 30 L56 30 Q56 56 32 56 Q8 56 8 30 Z" fill="#6a4a3a" stroke={O} strokeWidth={2} />
      <ellipse cx={32} cy={30} rx={24} ry={5} fill="#c8904a" stroke={O} strokeWidth={2} />
      {[22, 32, 42].map((x) => <path key={x} d={`M${x} 22 Q${x - 4} 16 ${x} 10 Q${x + 4} 4 ${x} 0`} fill="none" stroke="#e8e8e8" strokeWidth={2} opacity={0.8} />)}
      <path d="M28 42 h8 M32 38 v8" stroke="#7ae05a" strokeWidth={3} />
    </>
  ),
  'explorer-traveller': (
    <>
      <circle cx={32} cy={32} r={24} fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <path d="M32 12 L38 32 L32 52 L26 32 Z" fill="#c84a3a" stroke={O} strokeWidth={1.5} />
      <path d="M32 32 L38 32 L32 52 Z" fill="#9aa0ac" />
      <circle cx={32} cy={32} r={3} fill="#d4af37" stroke={O} />
      <path d="M50 6 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0 Z" fill="#e8c020" />
    </>
  ),
  'explorer-bandages': (
    <>
      <rect x={10} y={22} width={44} height={20} rx={10} fill="#f4ecd8" stroke={O} strokeWidth={2} transform="rotate(-30 32 32)" />
      <rect x={26} y={22} width={12} height={20} fill="#e0d4b8" transform="rotate(-30 32 32)" />
      {[29, 32, 35].map((x) => <circle key={x} cx={x} cy={30} r={1} fill="#b8a888" transform="rotate(-30 32 32)" />)}
      <path d="M46 46 h10 M51 41 v10" stroke="#ff6a5a" strokeWidth={3} />
    </>
  ),
  'explorer-disarm': (
    <>
      <path d="M6 58 L22 42" stroke="#8a5a32" strokeWidth={5} strokeLinecap="round" />
      <path d="M22 42 L44 20" stroke="#dfe3ec" strokeWidth={3} />
      <g transform="rotate(35 46 18)">
        <path d="M38 6 L54 6 L50 30 L42 30 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
        <rect x={40} y={30} width={12} height={4} fill="#d4af37" />
      </g>
      <path d="M30 6 Q38 2 46 6 M56 22 Q60 30 56 38" fill="none" stroke="#ffd34d" strokeWidth={2} strokeDasharray="3 3" />
    </>
  ),
  'guardian-stance': (
    <>
      <path d="M32 6 Q52 10 54 30 Q52 50 32 58 Q12 50 10 30 Q12 10 32 6 Z" fill="#c09030" stroke={O} strokeWidth={2} />
      <path d="M32 6 Q20 30 32 58" fill="none" stroke="#8a6020" strokeWidth={3} />
      <path d="M22 24 Q32 18 42 24" fill="none" stroke="#fff1b0" strokeWidth={2} />
      <path d="M4 14 L14 22 M60 14 L50 22" stroke="#ff6a5a" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  'guardian-riposte': (
    <>
      <path d="M6 58 L52 12" stroke="#8a5a32" strokeWidth={4} />
      <path d="M50 6 L60 4 L58 14 L52 12 Z" fill="#dfe3ec" stroke={O} strokeWidth={2} />
      <path d="M8 18 Q14 6 28 8 L22 14" fill="none" stroke="#c09030" strokeWidth={3} />
      <path d="M56 40 Q50 56 34 54 L40 48" fill="none" stroke="#ffd34d" strokeWidth={3} />
    </>
  ),
  'guardian-hide': (
    <>
      <path d="M14 10 L50 10 L54 34 Q48 54 32 58 Q16 54 10 34 Z" fill="#a07850" stroke={O} strokeWidth={2} />
      {([[22, 20], [36, 18], [44, 30], [28, 32], [20, 42], [38, 44]] as const).map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} l6 -3 l6 3 l-2 6 l-8 0 Z`} fill="#c8a070" stroke={O} strokeWidth={1} />)}
    </>
  ),
  'druid-herbalist': (
    <>
      <path d="M10 40 Q32 64 54 40 Z" fill="#8a5a32" stroke={O} strokeWidth={2} />
      <path d="M18 40 Q20 22 28 18 M32 40 Q32 20 40 12 M44 40 Q46 28 52 24" stroke="#4a7a2a" strokeWidth={2.5} fill="none" />
      <circle cx={28} cy={18} r={4} fill="#c84a3a" stroke={O} /><circle cx={40} cy={12} r={4} fill="#8f7bff" stroke={O} />
      <path d="M52 24 Q60 20 56 30 Z" fill="#6ab04a" />
    </>
  ),
  'druid-forest': (
    <>
      {([[14, 0.8], [32, 1.1], [50, 0.8]] as const).map(([x, k]) => (
        <g key={x}>
          <path d={`M${x} ${58 - 44 * k} L${x + 12 * k} ${58 - 10 * k} L${x - 12 * k} ${58 - 10 * k} Z`} fill="#3a7a3a" stroke={O} strokeWidth={1.5} />
          <rect x={x - 2} y={58 - 10 * k} width={4} height={10 * k} fill="#6a4a2a" />
        </g>
      ))}
      <circle cx={32} cy={20} r={6} fill="#c9b8ff" opacity={0.85} />
      {[0, 60, 120, 180, 240, 300].map((r) => <path key={r} d="M32 10 L32 6" stroke="#c9b8ff" strokeWidth={2} transform={`rotate(${r} 32 20)`} />)}
    </>
  ),
  'druid-companion': (
    <>
      <path d="M12 50 Q10 30 22 22 L18 10 L28 18 Q34 16 40 18 L48 10 L46 24 Q56 32 52 50 Q32 60 12 50 Z" fill="#8a8f98" stroke={O} strokeWidth={2} />
      <circle cx={24} cy={34} r={2.5} fill="#ffd34d" /><circle cx={40} cy={34} r={2.5} fill="#ffd34d" />
      <path d="M28 44 Q32 48 36 44" fill="none" stroke={O} strokeWidth={2} />
      <path d="M32 6 C30 2 24 4 26 8 L32 14 L38 8 C40 4 34 2 32 6 Z" fill="#ff6a8a" stroke={O} strokeWidth={1} />
    </>
  ),
  'runemaster-empower': (
    <>
      <path d="M16 54 L44 14" stroke="#dfe3ec" strokeWidth={6} strokeLinecap="round" />
      <path d="M12 48 L24 56" stroke="#d4af37" strokeWidth={4} />
      <path d="M10 58 L14 54" stroke="#5a3418" strokeWidth={5} />
      <path d="M32 24 L36 30 L30 34 L34 40" fill="none" stroke="#7af0ff" strokeWidth={2.5} />
      {([[48, 10], [54, 22], [40, 6]] as const).map(([x, y]) => <circle key={x} cx={x} cy={y} r={2} fill="#7af0ff" />)}
    </>
  ),
  'runemaster-vise': (
    <>
      <rect x={8} y={44} width={48} height={10} fill="#5a5e68" stroke={O} strokeWidth={2} />
      <rect x={12} y={22} width={12} height={22} fill="#7a808c" stroke={O} strokeWidth={2} />
      <rect x={40} y={22} width={12} height={22} fill="#7a808c" stroke={O} strokeWidth={2} />
      <rect x={24} y={28} width={16} height={12} fill="#c87030" stroke={O} strokeWidth={1.5} />
      <path d="M52 32 L62 32" stroke="#8a5a32" strokeWidth={4} /><circle cx={62} cy={32} r={2} fill="#3a3a44" />
      <path d="M20 10 A10 10 0 1 1 40 10" fill="none" stroke="#ffd34d" strokeWidth={2} />
    </>
  ),
  'runemaster-smelt': (
    <>
      <path d="M10 26 L54 26 L48 50 Q32 58 16 50 Z" fill="#3a3a44" stroke={O} strokeWidth={2} />
      <ellipse cx={32} cy={26} rx={22} ry={5} fill="#ff8a3a" stroke={O} strokeWidth={2} />
      <path d="M22 18 L28 8 M34 18 L36 4 M44 18 L42 10" stroke="#9aa0ac" strokeWidth={3} strokeLinecap="round" />
      <path d="M48 46 L58 56" stroke="#ffb347" strokeWidth={4} />
    </>
  ),
  // Level 3 cards.
  'trapper-poison-arrow': (
    <>
      <path d="M8 56 L50 14" stroke="#c8a060" strokeWidth={3} />
      <path d="M44 12 L56 8 L52 20 Z" fill="#7ae05a" stroke={O} strokeWidth={1.5} />
      <path d="M8 56 L4 50 M8 56 L14 60" stroke="#ff8a7a" strokeWidth={2} />
      {[0, 1, 2].map((i) => <circle key={i} cx={54 - i * 2} cy={26 + i * 7} r={2.5 - i * 0.4} fill="#7ae05a" />)}
    </>
  ),
  'trapper-tannery': (
    <>
      <path d="M12 14 Q32 6 52 14 L56 30 Q48 34 50 50 Q32 58 14 50 Q16 34 8 30 Z" fill="#b07a4a" stroke={O} strokeWidth={2} />
      <path d="M22 22 Q32 18 42 22 M20 36 Q32 32 44 36" fill="none" stroke="#7a4a2a" strokeWidth={2} strokeDasharray="3 2" />
      <path d="M44 46 L58 58" stroke="#9aa0ac" strokeWidth={3} /><path d="M40 42 L46 48" stroke="#c0c8d4" strokeWidth={5} />
    </>
  ),
  'elder-power-potion': (
    <>
      <path d="M26 8 L38 8 L38 22 Q52 30 48 46 Q44 58 32 58 Q20 58 16 46 Q12 30 26 22 Z" fill="#c84a8a" stroke={O} strokeWidth={2} />
      <rect x={24} y={4} width={16} height={6} fill="#8a5a32" stroke={O} strokeWidth={1.5} />
      <path d="M20 40 Q32 34 44 40" fill="none" stroke="#ffd0e8" strokeWidth={2} />
      {[[8, 20], [56, 26], [52, 10]].map(([x, y]) => <path key={x} d={`M${x} ${y! - 4} L${x} ${y! + 4} M${x! - 4} ${y} L${x! + 4} ${y}`} stroke="#ffe066" strokeWidth={2} />)}
    </>
  ),
  'elder-beast-master': (
    <>
      <path d="M14 44 Q10 24 22 18 L26 10 L32 18 L38 10 L42 18 Q54 24 50 44 Q42 54 32 54 Q22 54 14 44 Z" fill="#8a6a4a" stroke={O} strokeWidth={2} />
      <circle cx={25} cy={32} r={3} fill="#ffe066" /><circle cx={39} cy={32} r={3} fill="#ffe066" />
      <path d="M28 44 L32 48 L36 44" fill="none" stroke={O} strokeWidth={2} />
      <path d="M6 58 Q32 48 58 58" fill="none" stroke="#c9b8ff" strokeWidth={3} />
    </>
  ),
  'diver-camouflage': (
    <>
      <path d="M8 40 Q20 20 32 34 Q44 18 56 38 L56 58 L8 58 Z" fill="#3a7a5a" stroke={O} strokeWidth={2} />
      {[[16, 46], [30, 50], [44, 46], [24, 40], [40, 40]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx={5} ry={3} fill="#5a9a6a" />)}
      <circle cx={26} cy={30} r={3} fill="#ffe066" stroke={O} /><circle cx={38} cy={30} r={3} fill="#ffe066" stroke={O} />
    </>
  ),
  'diver-fillet': (
    <>
      <path d="M10 50 Q30 40 44 14 L52 18 Q42 44 14 56 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${20 + i * 7} ${48 - i * 8} l-4 -2`} stroke={O} strokeWidth={1.5} />)}
      <rect x={46} y={6} width={8} height={14} transform="rotate(25 50 13)" fill="#8a5a32" stroke={O} strokeWidth={1.5} />
      <path d="M16 58 Q12 62 18 62" fill="#c84a3a" /><circle cx={22} cy={60} r={2} fill="#c84a3a" />
    </>
  ),
  'gourmet-fisher': (
    <>
      <path d="M8 6 L20 50" stroke="#8a5a32" strokeWidth={3} />
      <path d="M8 6 Q40 4 44 26" fill="none" stroke="#e8dcc0" strokeWidth={1} />
      <path d="M30 34 Q42 22 54 34 Q42 46 30 34 Z" fill="#5fb3b3" stroke={O} strokeWidth={2} />
      <path d="M22 44 Q32 34 42 44 Q32 54 22 44 Z" fill="#7fd3d3" stroke={O} strokeWidth={2} />
      {[56, 60].map((y) => <path key={y} d={`M4 ${y} q7 -4 14 0 t14 0 t14 0 t14 0`} fill="none" stroke="#7fd3ff" strokeWidth={2} />)}
    </>
  ),
  'gourmet-shark-blade': (
    <>
      <path d="M12 52 L46 10 L54 16 L20 58 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${22 + i * 6} ${46 - i * 7} l6 2 l-2 -6`} fill="#6a8a9a" stroke={O} strokeWidth={1} />)}
      <path d="M44 34 Q52 26 58 34 L50 34 Z" fill="#5a7a8a" stroke={O} strokeWidth={1.5} />
      <circle cx={14} cy={60} r={2.5} fill="#c84a3a" />
    </>
  ),
  'explorer-direction': (
    <>
      <circle cx={32} cy={32} r={24} fill="#e8dcc0" stroke={O} strokeWidth={2} />
      <path d="M32 10 L38 32 L32 54 L26 32 Z" fill="#c84a3a" stroke={O} strokeWidth={1.5} />
      <path d="M32 32 L32 54 L26 32 Z" fill="#9aa0ac" />
      <circle cx={32} cy={32} r={3} fill={O} />
      <text x={32} y={8} textAnchor="middle" fontSize={7} fontWeight={700} fill="#ffe066">N</text>
    </>
  ),
  'explorer-smoke': (
    <>
      {[[22, 40, 14], [38, 36, 16], [30, 24, 12], [46, 22, 9], [16, 26, 8]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#9a98a8" stroke="#5a5868" strokeWidth={1.5} />)}
      <circle cx={28} cy={52} r={8} fill="#3a3a44" stroke={O} strokeWidth={2} />
      <path d="M32 46 Q38 40 36 34" fill="none" stroke="#ffb347" strokeWidth={2} />
    </>
  ),
  'warrior-strategist': (
    <>
      <rect x={6} y={14} width={52} height={38} fill="#e8dcc0" stroke={O} strokeWidth={2} />
      <path d="M14 40 Q24 22 34 34 T52 22" fill="none" stroke="#c84a3a" strokeWidth={2.5} strokeDasharray="4 3" />
      <path d="M48 18 L54 24 M54 18 L48 24" stroke="#3a3a44" strokeWidth={2.5} />
      <circle cx={14} cy={40} r={4} fill="#3a6a9a" stroke={O} />
    </>
  ),
  'warrior-way': (
    <>
      <rect x={28} y={12} width={8} height={44} fill="#8a5a32" stroke={O} strokeWidth={2} />
      <path d="M20 22 L44 22 M18 34 L46 34" stroke="#c8a060" strokeWidth={4} />
      <path d="M10 56 L54 56" stroke="#3a3a44" strokeWidth={3} />
      <path d="M44 8 L56 4 M48 14 L60 12" stroke="#ffe066" strokeWidth={2} />
    </>
  ),
  'mystic-vines': (
    <>
      <path d="M8 58 Q20 40 14 26 Q10 14 22 8" fill="none" stroke="#2f2a3a" strokeWidth={5} />
      <path d="M56 58 Q44 40 50 26 Q54 14 42 8" fill="none" stroke="#2f2a3a" strokeWidth={5} />
      <path d="M14 40 Q32 30 50 40 M16 26 Q32 18 48 26" fill="none" stroke="#5a2a7a" strokeWidth={3} />
      {[[20, 34], [44, 34], [32, 22]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={4} ry={2.5} fill="#8f7bff" />)}
    </>
  ),
  'mystic-levitate': (
    <>
      <circle cx={32} cy={14} r={7} fill="#e8c89a" stroke={O} strokeWidth={2} />
      <path d="M20 40 Q32 20 44 40 Z" fill="#6a4a9a" stroke={O} strokeWidth={2} />
      <ellipse cx={32} cy={56} rx={18} ry={4} fill="#3a2a5a" />
      {[46, 50].map((y) => <path key={y} d={`M14 ${y} q9 -3 18 0 t18 0`} fill="none" stroke="#c9b8ff" strokeWidth={1.5} />)}
    </>
  ),
  'guardian-scalp': (
    <>
      <path d="M32 6 L32 58" stroke="#8a5a32" strokeWidth={4} />
      <path d="M18 14 Q32 10 46 14 Q48 28 32 30 Q16 28 18 14 Z" fill="#5a4a3a" stroke={O} strokeWidth={2} />
      {[22, 28, 34, 40].map((x) => <path key={x} d={`M${x} 30 L${x - 2} 42`} stroke="#5a4a3a" strokeWidth={2} />)}
      <path d="M20 50 L44 50" stroke="#ffe066" strokeWidth={3} /><text x={32} y={62} textAnchor="middle" fontSize={9} fontWeight={800} fill="#ffe066">+1</text>
    </>
  ),
  'guardian-vigilance': (
    <>
      <path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={11} fill="#c88a3a" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={5} fill={O} />
      <circle cx={28} cy={28} r={2} fill="#fff" />
    </>
  ),
  'wraith-mist': (
    <>
      <path d="M24 4 L40 4 L40 12 Q48 18 46 30 L18 30 Q16 18 24 12 Z" fill="#a9c4d8" stroke={O} strokeWidth={2} />
      {[36, 44, 52].map((y, i) => <path key={y} d={`M${6 + i * 2} ${y} q8 -6 16 0 t16 0 t16 0`} fill="none" stroke="#c8d4e0" strokeWidth={4} strokeLinecap="round" />)}
    </>
  ),
  'wraith-lookout': (
    <>
      <path d="M32 6 L50 30 L40 30 L54 48 L10 48 L24 30 L14 30 Z" fill="#2f6a3a" stroke={O} strokeWidth={2} />
      <rect x={28} y={48} width={8} height={12} fill="#6a4a2a" stroke={O} strokeWidth={1.5} />
      <circle cx={32} cy={10} r={4} fill="#e8c89a" stroke={O} strokeWidth={1.5} />
      <path d="M4 20 L14 22 M60 20 L50 22" stroke="#ffe066" strokeWidth={2} />
    </>
  ),
  'druid-teacher': (
    <>
      <path d="M12 54 Q10 36 20 32 L24 24 L30 32 Q40 34 40 46 Q38 56 26 56 Z" fill="#9a7a5a" stroke={O} strokeWidth={2} />
      <circle cx={22} cy={40} r={2} fill={O} />
      <rect x={38} y={8} width={20} height={16} fill="#e8dcc0" stroke={O} strokeWidth={1.5} />
      <path d="M48 10 L48 22 M42 14 L54 14" stroke="#3a6a9a" strokeWidth={2} />
      <text x={50} y={40} textAnchor="middle" fontSize={11} fontWeight={800} fill="#7ae05a">+1</text>
    </>
  ),
  'druid-fangs': (
    <>
      <path d="M6 14 Q32 4 58 14 L52 24 Q32 18 12 24 Z" fill="#7a2a2a" stroke={O} strokeWidth={2} />
      <path d="M6 50 Q32 60 58 50 L52 40 Q32 46 12 40 Z" fill="#7a2a2a" stroke={O} strokeWidth={2} />
      {[16, 26, 38, 48].map((x) => <path key={x} d={`M${x - 4} 22 L${x} 34 L${x + 4} 22`} fill="#f4ecd8" stroke={O} strokeWidth={1} />)}
      {[20, 32, 44].map((x) => <path key={x} d={`M${x - 4} 42 L${x} 32 L${x + 4} 42`} fill="#f4ecd8" stroke={O} strokeWidth={1} />)}
    </>
  ),
  'runemaster-safety-rune': (
    <>
      <path d="M32 4 L56 14 L52 40 Q44 54 32 60 Q20 54 12 40 L8 14 Z" fill="#3a4a6a" stroke={O} strokeWidth={2} />
      <path d="M32 16 L32 46 M22 24 L32 32 L42 24 M24 42 L40 42" stroke="#7fd3ff" strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  'runemaster-reinforce': (
    <>
      <path d="M14 14 L50 14 L54 30 Q50 52 32 58 Q14 52 10 30 Z" fill="#7a808c" stroke={O} strokeWidth={2} />
      {[[18, 22], [46, 22], [18, 40], [46, 40], [32, 50]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2.5} fill="#dfe3ec" stroke={O} />)}
      <rect x={26} y={24} width={12} height={14} fill="#c87030" stroke={O} strokeWidth={1.5} />
      <text x={32} y={35} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">+1</text>
    </>
  ),
  'cavedelver-caver': (
    <>
      <path d="M4 58 L20 26 L28 36 L40 12 L60 58 Z" fill="#6a6470" stroke={O} strokeWidth={2} />
      <path d="M26 58 Q32 40 38 58 Z" fill={O} />
      <path d="M36 18 L40 12 L44 20" fill="#f4ecd8" />
      <circle cx={32} cy={50} r={3} fill="#ffe066" />
    </>
  ),
  'cavedelver-blind': (
    <>
      <path d="M32 4 L46 24 L32 60 L18 24 Z" fill="#bfe9ff" stroke={O} strokeWidth={2} />
      <path d="M18 24 L46 24 M32 4 L32 60" stroke="#7fd3ff" strokeWidth={1.5} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M32 30 L32 2" transform={`rotate(${a} 32 30)`} stroke="#fff6c0" strokeWidth={1.5} opacity={0.7} />)}
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
  'elder-wisdom': 'shine', 'elder-nature': 'rise', 'elder-herb': 'rise',
  'gourmet-fish': 'dash', 'gourmet-seasoning': 'pulse', 'gourmet-stew': 'rise',
  'explorer-traveller': 'spin', 'explorer-bandages': 'rise', 'explorer-disarm': 'swing',
  'guardian-stance': 'pulse', 'guardian-riposte': 'shot', 'guardian-hide': 'pulse',
  'druid-herbalist': 'rise', 'druid-forest': 'shine', 'druid-companion': 'snap',
  'runemaster-empower': 'shine', 'runemaster-vise': 'snap', 'runemaster-smelt': 'pulse',
  'trapper-poison-arrow': 'shot', 'trapper-tannery': 'snap', 'elder-power-potion': 'rise', 'elder-beast-master': 'pulse',
  'diver-camouflage': 'dash', 'diver-fillet': 'swing', 'gourmet-fisher': 'dash', 'gourmet-shark-blade': 'swing',
  'explorer-direction': 'spin', 'explorer-smoke': 'pulse', 'warrior-strategist': 'shine', 'warrior-way': 'swing',
  'mystic-vines': 'snap', 'mystic-levitate': 'rise', 'guardian-scalp': 'shine', 'guardian-vigilance': 'shine',
  'wraith-mist': 'pulse', 'wraith-lookout': 'rise', 'druid-teacher': 'shine', 'druid-fangs': 'snap',
  'runemaster-safety-rune': 'shine', 'runemaster-reinforce': 'pulse', 'cavedelver-caver': 'rise', 'cavedelver-blind': 'shine',
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
