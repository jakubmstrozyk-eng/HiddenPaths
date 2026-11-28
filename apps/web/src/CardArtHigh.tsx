import type { ReactNode } from 'react';

/**
 * Pictures for the level 5, 7 and 9 skill cards, on the same 64×64 grid as CardArt: one plain picture
 * of what the card does, drawn with a few flat shapes so the hand stays light on a phone.
 */
const O = '#1a120c';
const arrow = (x1: number, y1: number, x2: number, y2: number, head = '#c0c8d4') => (
  <>
    <path d={`M${x1} ${y1} L${x2} ${y2}`} stroke="#c8a060" strokeWidth={3} />
    <circle cx={x2} cy={y2} r={3.5} fill={head} stroke={O} strokeWidth={1.2} />
  </>
);
const bottle = (fill: string) => (
  <>
    <path d="M26 8 L38 8 L38 22 Q52 30 48 46 Q44 58 32 58 Q20 58 16 46 Q12 30 26 22 Z" fill={fill} stroke={O} strokeWidth={2} />
    <rect x={24} y={4} width={16} height={6} fill="#8a5a32" stroke={O} strokeWidth={1.5} />
  </>
);
const rune = (fill: string, mark: string) => (
  <>
    <path d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z" fill={fill} stroke={O} strokeWidth={2} />
    <path d={mark} fill="none" stroke="#ffe9a8" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
  </>
);
const wolfHead = (fill: string) => (
  <>
    <path d="M14 20 L20 6 L28 18 L36 18 L44 6 L50 20 L52 36 L32 58 L12 36 Z" fill={fill} stroke={O} strokeWidth={2} />
    <circle cx={24} cy={30} r={3} fill="#ffcf4a" /><circle cx={40} cy={30} r={3} fill="#ffcf4a" />
    <path d="M26 46 L32 52 L38 46" fill="none" stroke={O} strokeWidth={2} />
  </>
);

export const HIGH_ART: Record<string, ReactNode> = {
  // Trapper.
  'trapper-dog': (
    <>
      <path d="M10 44 Q12 30 26 30 L42 30 L48 20 L56 22 L56 32 L50 36 L48 50 M18 44 L16 56 M40 44 L42 56" fill="#b0884a" stroke={O} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M10 44 L4 34" stroke="#b0884a" strokeWidth={4} strokeLinecap="round" />
      <circle cx={51} cy={26} r={1.8} fill={O} />
    </>
  ),
  'trapper-vigilance': (
    <>
      <path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={11} fill="#5a8ac8" stroke={O} strokeWidth={2} />
      <circle cx={32} cy={32} r={5} fill={O} />
      <path d="M32 2 V10 M32 54 V62" stroke="#ffcf4a" strokeWidth={3} />
    </>
  ),
  'trapper-piercing-arrow': (
    <>
      <rect x={26} y={14} width={12} height={36} fill="#8a9aac" stroke={O} strokeWidth={2} />
      {arrow(4, 32, 60, 32)}
      <path d="M38 26 L46 20 M38 38 L46 44" stroke="#ffcf4a" strokeWidth={2} />
    </>
  ),
  'trapper-camp': (
    <>
      <path d="M8 50 L32 12 L56 50 Z" fill="#7a9a5a" stroke={O} strokeWidth={2} />
      <path d="M26 50 L32 36 L38 50" fill="#3a2a1a" />
      <path d="M48 12 h8 M52 8 v8" stroke="#ff6a6a" strokeWidth={3} />
      <path d="M14 56 Q20 46 26 56 Z" fill="#ff8a3a" stroke={O} strokeWidth={1.5} />
    </>
  ),
  'trapper-volley': (
    <>
      {[12, 22, 32, 42, 52].map((y) => <g key={y}>{arrow(4, y + 4, 52, y - 6)}</g>)}
    </>
  ),
  'trapper-leatherwork': (
    <>
      <path d="M20 10 L44 10 L54 20 L48 26 L46 56 L18 56 L16 26 L10 20 Z" fill="#a8703e" stroke={O} strokeWidth={2} />
      <path d="M24 18 L40 18 M22 32 L42 32 M22 44 L42 44" stroke="#7a4a2a" strokeWidth={2} strokeDasharray="3 2" />
    </>
  ),
  // Elder.
  'elder-mistral': (
    <>
      {[16, 30, 44].map((y, i) => <path key={y} d={`M4 ${y} Q24 ${y - 10} 40 ${y} T${60 - i * 6} ${y - 4}`} fill="none" stroke="#bfe4f0" strokeWidth={4} strokeLinecap="round" />)}
      <path d="M46 40 Q56 46 50 54" fill="none" stroke="#bfe4f0" strokeWidth={3} />
    </>
  ),
  'elder-vision': (
    <>
      <circle cx={32} cy={36} r={20} fill="#8f7bff" stroke={O} strokeWidth={2} />
      <path d="M18 36 Q32 24 46 36 Q32 48 18 36 Z" fill="#f4ecd8" stroke={O} strokeWidth={1.5} />
      <circle cx={32} cy={36} r={4} fill={O} />
      <rect x={20} y={54} width={24} height={6} rx={2} fill="#8a5a32" stroke={O} strokeWidth={1.5} />
    </>
  ),
  'elder-beast-form': wolfHead('#8a6a4a'),
  'elder-fill': (
    <>
      <circle cx={32} cy={32} r={24} fill="#2a3a2a" stroke={O} strokeWidth={2} />
      <path d="M32 54 Q14 40 32 12 Q50 40 32 54 Z" fill="#7ae05a" stroke={O} strokeWidth={2} />
      <path d="M32 50 V20" stroke="#3a7a2a" strokeWidth={2} />
    </>
  ),
  'elder-spirit': (
    <>
      <path d="M20 58 Q16 30 32 14 Q48 30 44 58 L38 52 L32 58 L26 52 Z" fill="#dfe8ff" stroke={O} strokeWidth={2} opacity={0.9} />
      <circle cx={27} cy={30} r={2.5} fill={O} /><circle cx={37} cy={30} r={2.5} fill={O} />
      <path d="M8 12 L14 16 M56 12 L50 16 M32 2 V8" stroke="#ffe9a8" strokeWidth={2} />
    </>
  ),
  'elder-life-potion': (
    <>
      {bottle('#e04a5a')}
      <path d="M32 32 V48 M24 40 H40" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  // Diver.
  'diver-agility': (
    <>
      <path d="M14 50 Q20 20 36 18 Q50 16 54 8" fill="none" stroke="#5fb3b3" strokeWidth={6} strokeLinecap="round" />
      <circle cx={36} cy={14} r={6} fill="#5fb3b3" stroke={O} strokeWidth={2} />
      <path d="M8 40 L18 38 M6 50 L16 50 M10 58 L20 56" stroke="#ffe9a8" strokeWidth={2} />
    </>
  ),
  'diver-toxin': (
    <>
      <path d="M32 6 Q50 30 46 44 Q42 58 32 58 Q22 58 18 44 Q14 30 32 6 Z" fill="#7ae05a" stroke={O} strokeWidth={2} />
      <circle cx={27} cy={40} r={3} fill={O} /><circle cx={37} cy={40} r={3} fill={O} />
      <path d="M26 50 H38" stroke={O} strokeWidth={2} />
    </>
  ),
  'diver-sleep': (
    <>
      <path d="M6 44 L44 30" stroke="#8a5a32" strokeWidth={4} />
      <path d="M44 30 L52 28 L46 34 Z" fill="#9aa0ac" />
      <text x={36} y={22} fontSize={16} fontWeight={800} fill="#bfe4f0" stroke={O} strokeWidth={0.8}>Z</text>
      <text x={50} y={12} fontSize={11} fontWeight={800} fill="#bfe4f0" stroke={O} strokeWidth={0.6}>z</text>
    </>
  ),
  'diver-flow': (
    <>
      {[20, 34, 48].map((y) => <path key={y} d={`M4 ${y} Q14 ${y - 8} 24 ${y} T44 ${y} T64 ${y}`} fill="none" stroke="#5f9fe0" strokeWidth={4} />)}
      <path d="M32 4 L40 14 H24 Z" fill="#ffcf4a" stroke={O} strokeWidth={1.5} />
    </>
  ),
  'diver-water-bolt': (
    <>
      <path d="M8 52 Q20 40 30 40" fill="none" stroke="#bfe4f0" strokeWidth={4} strokeLinecap="round" />
      <path d="M30 26 Q52 20 58 32 Q52 44 30 38 Q24 32 30 26 Z" fill="#5f9fe0" stroke={O} strokeWidth={2} />
      <circle cx={44} cy={30} r={3} fill="#dfefff" />
    </>
  ),
  'diver-bloodlust': (
    <>
      <path d="M32 56 L10 32 Q4 20 14 14 Q24 8 32 20 Q40 8 50 14 Q60 20 54 32 Z" fill="#c8283a" stroke={O} strokeWidth={2} />
      <path d="M22 26 L28 32 M42 26 L36 32" stroke={O} strokeWidth={3} />
    </>
  ),
  // Gourmet.
  'gourmet-groundwater': (
    <>
      <rect x={4} y={18} width={56} height={14} fill="#8a6a4a" />
      <rect x={4} y={32} width={56} height={26} fill="#5a4030" />
      <path d="M8 46 Q20 38 32 46 T56 46" fill="none" stroke="#5f9fe0" strokeWidth={4} />
      <path d="M10 18 V8 M54 18 V8" stroke="#5f9fe0" strokeWidth={3} />
    </>
  ),
  'gourmet-spice': (
    <>
      <path d="M20 14 L44 14 L48 56 L16 56 Z" fill="#c84a3a" stroke={O} strokeWidth={2} />
      <rect x={18} y={6} width={28} height={8} fill="#e8dcc0" stroke={O} strokeWidth={1.5} />
      {([[50, 10], [56, 18], [54, 4], [60, 12]] as const).map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2} fill="#ff6a3a" />)}
    </>
  ),
  'gourmet-better-food': (
    <>
      <ellipse cx={32} cy={46} rx={26} ry={8} fill="#e8dcc0" stroke={O} strokeWidth={2} />
      <path d="M14 44 Q32 18 50 44 Z" fill="#b07a4a" stroke={O} strokeWidth={2} />
      <path d="M32 6 L35 14 L43 14 L37 19 L39 27 L32 22 L25 27 L27 19 L21 14 L29 14 Z" fill="#ffcf4a" stroke={O} strokeWidth={1} />
    </>
  ),
  'gourmet-venom-bone': (
    <>
      <path d="M8 56 L56 8" stroke="#f4ecd8" strokeWidth={4} />
      {[16, 24, 32, 40, 48].map((p) => <path key={p} d={`M${p - 4} ${64 - p - 4} L${p + 4} ${64 - p + 4}`} stroke="#f4ecd8" strokeWidth={2} transform={`rotate(90 ${p} ${64 - p})`} />)}
      <circle cx={56} cy={8} r={4} fill="#7ae05a" stroke={O} />
    </>
  ),
  'gourmet-recipe': (
    <>
      <rect x={10} y={8} width={44} height={50} rx={3} fill="#f4ecd8" stroke={O} strokeWidth={2} />
      <path d="M18 20 H46 M18 30 H46 M18 40 H36" stroke="#8a5a32" strokeWidth={2.5} />
      <path d="M44 44 L50 36 L48 46 L54 46 L44 58 L46 48 L40 48 Z" fill="#ffcf4a" stroke={O} strokeWidth={1} />
    </>
  ),
  'gourmet-healthy': (
    <>
      <circle cx={32} cy={36} r={22} fill="#e8dcc0" stroke={O} strokeWidth={2} />
      <circle cx={26} cy={34} r={7} fill="#7ae05a" stroke={O} strokeWidth={1.5} />
      <circle cx={38} cy={40} r={6} fill="#ff8a3a" stroke={O} strokeWidth={1.5} />
      <path d="M32 8 V18 M27 13 H37" stroke="#c8283a" strokeWidth={3} />
    </>
  ),
  // Explorer.
  'explorer-spyglass': (
    <>
      <path d="M6 44 L44 22 L50 32 L12 54 Z" fill="#c8a060" stroke={O} strokeWidth={2} />
      <path d="M44 22 L52 18 L58 30 L50 32 Z" fill="#8a5a32" stroke={O} strokeWidth={2} />
      <circle cx={56} cy={22} r={4} fill="#bfe4f0" stroke={O} />
    </>
  ),
  'explorer-bait': (
    <>
      <path d="M32 4 V30 Q32 46 20 46 Q10 46 12 36" fill="none" stroke="#9aa0ac" strokeWidth={3} />
      <path d="M8 34 L12 30 L16 36" stroke="#9aa0ac" strokeWidth={3} fill="none" />
      <path d="M30 50 Q40 46 48 52 Q40 60 30 56 Z" fill="#c84a8a" stroke={O} strokeWidth={1.5} />
    </>
  ),
  'explorer-flashbang': (
    <>
      <circle cx={30} cy={38} r={16} fill="#5a6a5a" stroke={O} strokeWidth={2} />
      <rect x={26} y={16} width={8} height={8} fill="#9aa0ac" stroke={O} />
      {([[50, 10], [56, 30], [44, 4]] as const).map(([x, y]) => <path key={x} d={`M38 20 L${x} ${y}`} stroke="#ffe94a" strokeWidth={3} />)}
    </>
  ),
  'explorer-luck': (
    <>
      <circle cx={32} cy={34} r={22} fill="#ffcf4a" stroke={O} strokeWidth={2} />
      <path d="M32 18 Q24 26 32 34 Q40 26 32 18 Z M32 34 Q24 42 32 50 Q40 42 32 34 Z M16 34 Q24 26 32 34 Q24 42 16 34 Z M48 34 Q40 26 32 34 Q40 42 48 34 Z" fill="#5a9a3a" />
    </>
  ),
  'explorer-shrapnel': (
    <>
      <circle cx={32} cy={34} r={10} fill="#ff8a3a" stroke={O} strokeWidth={2} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M32 20 L35 10 L29 10 Z" fill="#9aa0ac" stroke={O} strokeWidth={1} transform={`rotate(${a} 32 34)`} />)}
    </>
  ),
  'explorer-teleport': (
    <>
      <ellipse cx={32} cy={50} rx={22} ry={7} fill="#3a2a5a" stroke="#8f7bff" strokeWidth={3} />
      <path d="M16 48 Q14 20 32 8 Q50 20 48 48" fill="none" stroke="#8f7bff" strokeWidth={3} strokeDasharray="4 3" />
      <circle cx={32} cy={30} r={5} fill="#dfe8ff" />
    </>
  ),
  // Warrior.
  'warrior-whetstone': (
    <>
      <path d="M8 56 L44 20 L50 14 L54 18 L48 24 L12 60 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
      <rect x={30} y={40} width={26} height={10} rx={3} fill="#7a7a8a" stroke={O} strokeWidth={2} transform="rotate(-20 43 45)" />
      <path d="M48 8 L52 2 M56 14 L62 12" stroke="#ffe94a" strokeWidth={2} />
    </>
  ),
  'warrior-wide-swing': (
    <>
      <path d="M8 40 Q32 4 56 40" fill="none" stroke="#ffe9a8" strokeWidth={4} strokeDasharray="6 4" />
      <path d="M30 58 L34 58 L34 30 L40 24 L32 16 L24 24 L30 30 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
    </>
  ),
  'warrior-intimidate': (
    <>
      <path d="M12 26 Q12 8 32 8 Q52 8 52 26 L48 44 L32 56 L16 44 Z" fill="#8a9aac" stroke={O} strokeWidth={2} />
      <path d="M18 26 L28 30 M46 26 L36 30" stroke={O} strokeWidth={4} />
      <path d="M24 44 Q32 38 40 44" fill="none" stroke={O} strokeWidth={3} />
    </>
  ),
  'warrior-precision': (
    <>
      <circle cx={32} cy={32} r={24} fill="none" stroke="#c84a3a" strokeWidth={3} />
      <circle cx={32} cy={32} r={12} fill="none" stroke="#c84a3a" strokeWidth={3} />
      <path d="M32 2 V22 M32 42 V62 M2 32 H22 M42 32 H62" stroke={O} strokeWidth={2.5} />
    </>
  ),
  'warrior-banner': (
    <>
      <path d="M14 4 V62" stroke="#8a5a32" strokeWidth={4} />
      <path d="M16 8 H54 L46 22 L54 36 H16 Z" fill="#c8283a" stroke={O} strokeWidth={2} />
      <path d="M30 14 L34 22 L30 30" fill="none" stroke="#ffcf4a" strokeWidth={3} />
    </>
  ),
  'warrior-behead': (
    <>
      <path d="M10 54 L50 14" stroke="#c0c8d4" strokeWidth={6} strokeLinecap="round" />
      <path d="M50 14 Q60 4 56 18 Q52 24 44 20" fill="#c0c8d4" stroke={O} strokeWidth={2} />
      <path d="M6 58 L16 48" stroke="#8a5a32" strokeWidth={6} />
      <path d="M34 34 L44 44" stroke="#c8283a" strokeWidth={3} />
    </>
  ),
  // Mystic.
  'mystic-void-bolt': (
    <>
      <circle cx={40} cy={26} r={14} fill="#2a1a4a" stroke="#8f7bff" strokeWidth={3} />
      <circle cx={40} cy={26} r={5} fill="#dfe8ff" />
      <path d="M6 58 L28 36" stroke="#8f7bff" strokeWidth={4} strokeDasharray="5 3" />
    </>
  ),
  'mystic-illusion': (
    <>
      <path d="M14 18 Q32 4 50 18 L46 46 Q32 58 18 46 Z" fill="#f4ecd8" stroke={O} strokeWidth={2} opacity={0.6} />
      <path d="M22 26 Q26 22 30 26 M34 26 Q38 22 42 26" fill="none" stroke={O} strokeWidth={2} />
      <path d="M24 38 Q32 46 40 38" fill="none" stroke={O} strokeWidth={2} />
      <path d="M6 8 L10 12 M58 8 L54 12 M6 56 L10 52 M58 56 L54 52" stroke="#8f7bff" strokeWidth={2} />
    </>
  ),
  'mystic-healing': (
    <>
      <circle cx={32} cy={32} r={24} fill="#2a1a4a" stroke="#8f7bff" strokeWidth={2} />
      <path d="M32 18 V46 M18 32 H46" stroke="#7ae05a" strokeWidth={7} strokeLinecap="round" />
    </>
  ),
  'mystic-double': (
    <>
      <circle cx={24} cy={18} r={8} fill="#c8a060" stroke={O} strokeWidth={2} />
      <path d="M12 58 Q12 30 24 30 Q36 30 36 58 Z" fill="#c8a060" stroke={O} strokeWidth={2} />
      <circle cx={40} cy={18} r={8} fill="#8f7bff" stroke={O} strokeWidth={2} opacity={0.6} />
      <path d="M28 58 Q28 30 40 30 Q52 30 52 58 Z" fill="#8f7bff" stroke={O} strokeWidth={2} opacity={0.6} />
    </>
  ),
  'mystic-chasm': (
    <>
      <rect x={4} y={30} width={56} height={30} fill="#6a5a4a" />
      <path d="M20 30 L28 46 L24 60 L40 60 L36 46 L44 30 Z" fill="#0a0418" stroke="#8f7bff" strokeWidth={2} />
      <path d="M30 8 L34 8 L33 22 L31 22 Z" fill="#c84a3a" />
    </>
  ),
  'mystic-voidling': (
    <>
      <path d="M12 56 Q8 28 20 18 L24 6 L30 16 L34 16 L40 6 L44 18 Q56 28 52 56 Z" fill="#2a1a4a" stroke="#8f7bff" strokeWidth={2.5} />
      <circle cx={26} cy={30} r={3} fill="#ff4a8a" /><circle cx={38} cy={30} r={3} fill="#ff4a8a" />
      <path d="M24 44 L28 40 L32 44 L36 40 L40 44" fill="none" stroke="#dfe8ff" strokeWidth={2} />
    </>
  ),
  // Guardian.
  'guardian-sign': (
    <>
      <path d="M12 8 H52 V40 Q52 54 32 60 Q12 54 12 40 Z" fill="#c8a060" stroke={O} strokeWidth={2} />
      <path d="M32 16 L40 32 L32 48 L24 32 Z" fill="none" stroke="#ff6a3a" strokeWidth={3.5} />
    </>
  ),
  'guardian-field': (
    <>
      <path d="M6 54 Q6 10 32 10 Q58 10 58 54 Z" fill="#7ac8ff" stroke="#3a8ac8" strokeWidth={3} opacity={0.55} />
      <circle cx={32} cy={34} r={7} fill="#c8a060" stroke={O} strokeWidth={2} />
      <path d="M22 54 Q22 42 32 42 Q42 42 42 54 Z" fill="#c8a060" stroke={O} strokeWidth={2} />
    </>
  ),
  'guardian-service': (
    <>
      <rect x={10} y={18} width={44} height={34} rx={4} fill="#b07a4a" stroke={O} strokeWidth={2} />
      <path d="M22 18 Q22 6 32 6 Q42 6 42 18" fill="none" stroke={O} strokeWidth={3} />
      <text x={17} y={44} fontSize={16} fontWeight={800} fill="#ffe9a8">−20%</text>
    </>
  ),
  'guardian-claw': (
    <>
      {[16, 28, 40].map((x) => <path key={x} d={`M${x} 6 Q${x + 12} 30 ${x + 2} 58`} fill="none" stroke="#f4ecd8" strokeWidth={5} strokeLinecap="round" />)}
      <path d="M18 50 L24 58 M30 48 L36 58" stroke="#c8283a" strokeWidth={2} />
    </>
  ),
  'guardian-shield-wall': (
    <>
      {[6, 24, 42].map((x) => <path key={x} d={`M${x} 14 H${x + 16} V40 Q${x + 16} 52 ${x + 8} 56 Q${x} 52 ${x} 40 Z`} fill="#c8a060" stroke={O} strokeWidth={2} />)}
      <path d="M8 8 H56" stroke="#ffe9a8" strokeWidth={2} strokeDasharray="4 3" />
    </>
  ),
  'guardian-spear': (
    <>
      <path d="M6 58 L50 14" stroke="#8a5a32" strokeWidth={4} />
      <path d="M46 10 L58 6 L54 18 Z" fill="#c0c8d4" stroke={O} strokeWidth={2} />
      <path d="M16 40 L8 38 M22 46 L14 48" stroke="#ffe9a8" strokeWidth={2} />
    </>
  ),
  // Wraith.
  'wraith-pierce': (
    <>
      <circle cx={34} cy={32} r={14} fill="#8a6a4a" stroke={O} strokeWidth={2} />
      {arrow(2, 32, 62, 32, '#c8283a')}
      <path d="M28 40 Q30 50 26 56" fill="none" stroke="#c8283a" strokeWidth={2.5} />
    </>
  ),
  'wraith-aim': (
    <>
      <path d="M10 54 Q2 32 10 10" fill="none" stroke="#8a5a32" strokeWidth={4} />
      <path d="M10 10 L10 54" stroke="#e8dcc0" strokeWidth={1.5} />
      <circle cx={46} cy={32} r={12} fill="none" stroke="#c84a3a" strokeWidth={3} />
      <circle cx={46} cy={32} r={3} fill="#c84a3a" />
      <path d="M12 32 L32 32" stroke="#c8a060" strokeWidth={3} strokeDasharray="3 2" />
    </>
  ),
  'wraith-untouchable': (
    <>
      <path d="M22 58 Q20 34 30 22 Q36 14 34 8" fill="none" stroke="#bfe4f0" strokeWidth={5} opacity={0.5} />
      <path d="M36 58 Q34 34 44 22 Q50 14 48 8" fill="none" stroke="#7ae0a0" strokeWidth={5} />
      {arrow(2, 30, 30, 30)}
    </>
  ),
  'wraith-runner': (
    <>
      <circle cx={40} cy={12} r={6} fill="#7ae0a0" stroke={O} strokeWidth={2} />
      <path d="M38 20 L30 38 L40 46 L36 58 M30 38 L18 46 M36 26 L48 32 M34 24 L22 26" fill="none" stroke="#7ae0a0" strokeWidth={4} strokeLinecap="round" />
      <path d="M4 30 H16 M2 40 H12" stroke="#ffe9a8" strokeWidth={2} />
    </>
  ),
  'wraith-triple-shot': (
    <>
      {arrow(4, 54, 58, 10)}
      {arrow(4, 42, 58, 22)}
      {arrow(4, 30, 58, 34)}
    </>
  ),
  'wraith-headshot': (
    <>
      <circle cx={36} cy={26} r={16} fill="#8a6a4a" stroke={O} strokeWidth={2} />
      <circle cx={36} cy={26} r={8} fill="none" stroke="#c84a3a" strokeWidth={2.5} />
      <path d="M36 6 V46 M16 26 H56" stroke="#c84a3a" strokeWidth={1.5} />
      {arrow(2, 60, 30, 32, '#c8283a')}
    </>
  ),
  // Druid.
  'druid-totem': (
    <>
      <rect x={20} y={6} width={24} height={54} rx={3} fill="#8a5a32" stroke={O} strokeWidth={2} />
      <circle cx={27} cy={16} r={3} fill="#ffcf4a" /><circle cx={37} cy={16} r={3} fill="#ffcf4a" />
      <path d="M26 26 H38 M24 38 L40 38 L32 48 Z" stroke={O} strokeWidth={2} fill="#c84a3a" />
      <path d="M8 22 L20 18 M56 22 L44 18" stroke="#7ae05a" strokeWidth={4} />
    </>
  ),
  'druid-raven': (
    <>
      <path d="M4 30 Q18 20 30 28 Q42 20 60 26 Q48 32 40 40 L34 52 L28 40 Q16 34 4 30 Z" fill="#2a2a3a" stroke={O} strokeWidth={2} />
      <circle cx={38} cy={30} r={2} fill="#ffcf4a" />
      <path d="M44 28 L52 30 L44 32" fill="#c8a060" />
    </>
  ),
  'druid-nature-force': (
    <>
      <path d="M32 60 V30" stroke="#8a5a32" strokeWidth={6} />
      <circle cx={32} cy={22} r={18} fill="#3a8a3a" stroke={O} strokeWidth={2} />
      <path d="M26 14 L38 22 L28 26 L40 34" fill="none" stroke="#ffe94a" strokeWidth={3} />
    </>
  ),
  'druid-forest-lord': (
    <>
      <path d="M12 26 L18 10 L26 22 L32 6 L38 22 L46 10 L52 26 Z" fill="#5a9a3a" stroke={O} strokeWidth={2} />
      <path d="M14 28 H50 V36 H14 Z" fill="#8a5a32" stroke={O} strokeWidth={2} />
      <path d="M20 58 Q20 42 32 42 Q44 42 44 58" fill="#b0884a" stroke={O} strokeWidth={2} />
    </>
  ),
  'druid-shapeshift': wolfHead('#6a6a7a'),
  'druid-pack': (
    <>
      {([[8, 0.7], [24, 1], [40, 0.7]] as const).map(([x, s]) => (
        <path key={x} d={`M${x} 50 L${x + 4} ${50 - 30 * s} L${x + 8} ${50 - 20 * s} L${x + 12} ${50 - 30 * s} L${x + 16} 50 Z`} fill="#7a7a8a" stroke={O} strokeWidth={2} />
      ))}
      <circle cx={52} cy={12} r={8} fill="#f4ecd8" />
    </>
  ),
  // Runemaster.
  'runemaster-honour': rune('#7a5a9a', 'M32 16 V48 M32 16 L44 26 M32 30 L44 40'),
  'runemaster-reflex': rune('#3a7a9a', 'M22 16 L42 32 L22 48'),
  'runemaster-hammer': (
    <>
      <path d="M10 58 L34 30" stroke="#8a5a32" strokeWidth={6} strokeLinecap="round" />
      <rect x={26} y={8} width={30} height={18} rx={2} fill="#c84a3a" stroke={O} strokeWidth={2} transform="rotate(40 41 17)" />
      <path d="M50 34 Q56 40 52 48 M56 28 Q62 30 60 38" fill="none" stroke="#ff8a3a" strokeWidth={3} />
    </>
  ),
  'runemaster-nose': (
    <>
      <path d="M8 50 L22 26 L32 40 L42 20 L56 50 Z" fill="#8a8a9a" stroke={O} strokeWidth={2} />
      <path d="M20 44 L24 38 L28 44 Z M38 44 L42 36 L46 44 Z" fill="#5ae0e0" stroke={O} strokeWidth={1.5} />
      <path d="M32 8 L35 14 M28 10 L30 16" stroke="#ffe94a" strokeWidth={2} />
    </>
  ),
  'runemaster-rend': (
    <>
      <rect x={4} y={36} width={56} height={24} fill="#7a6a5a" />
      <path d="M30 36 L24 46 L32 52 L26 60 L38 60 L34 50 L40 44 L34 36 Z" fill="#0a0806" />
      <path d="M22 4 L44 24" stroke="#8a5a32" strokeWidth={5} />
      <rect x={10} y={2} width={22} height={12} fill="#9aa0ac" stroke={O} strokeWidth={2} transform="rotate(42 21 8)" />
    </>
  ),
  'runemaster-bind': (
    <>
      <circle cx={24} cy={32} r={16} fill="none" stroke="#ffcf4a" strokeWidth={5} />
      <circle cx={40} cy={32} r={16} fill="none" stroke="#7ac8ff" strokeWidth={5} />
    </>
  ),
  // Cave Delver.
  'cavedelver-dynamite': (
    <>
      {[16, 26, 36].map((x) => <rect key={x} x={x} y={24} width={10} height={32} rx={2} fill="#c8283a" stroke={O} strokeWidth={2} />)}
      <path d="M31 24 Q30 12 40 8" fill="none" stroke="#e8dcc0" strokeWidth={2} />
      <circle cx={42} cy={7} r={4} fill="#ffe94a" />
    </>
  ),
  'cavedelver-helping-hand': (
    <>
      <path d="M8 56 V30 L20 20 L32 30 V56 Z" fill="#b07a4a" stroke={O} strokeWidth={2} />
      <path d="M36 56 V22 L48 12 L60 22 V56 Z" fill="#9a8a7a" stroke={O} strokeWidth={2} />
      <path d="M26 14 L42 30" stroke="#8a5a32" strokeWidth={4} />
      <rect x={20} y={6} width={14} height={8} fill="#9aa0ac" stroke={O} strokeWidth={1.5} transform="rotate(45 27 10)" />
    </>
  ),
  'cavedelver-shadow': (
    <>
      <path d="M4 56 L18 24 L30 40 L42 14 L60 56 Z" fill="#5a5a6a" stroke={O} strokeWidth={2} />
      <path d="M12 56 Q32 30 52 56" fill="#1a1420" stroke={O} strokeWidth={2} />
      <path d="M18 52 Q32 40 46 52" fill="none" stroke="#ffe9a8" strokeWidth={2} strokeDasharray="3 3" />
    </>
  ),
  'cavedelver-stew': (
    <>
      <path d="M8 30 H56 Q54 56 32 56 Q10 56 8 30 Z" fill="#5a5a6a" stroke={O} strokeWidth={2} />
      <ellipse cx={32} cy={30} rx={24} ry={5} fill="#b07a4a" stroke={O} strokeWidth={2} />
      <path d="M20 22 Q16 14 22 8 M32 22 Q28 12 34 4 M44 22 Q40 14 46 8" fill="none" stroke="#e8dcc0" strokeWidth={2} />
    </>
  ),
  'cavedelver-flamethrower': (
    <>
      <rect x={4} y={34} width={22} height={12} rx={2} fill="#8a8a9a" stroke={O} strokeWidth={2} />
      <path d="M26 40 Q40 24 60 30 Q50 40 60 50 Q40 56 26 40 Z" fill="#ff8a3a" stroke={O} strokeWidth={1.5} />
      <path d="M30 40 Q42 32 52 38 Q44 44 30 40 Z" fill="#ffe94a" />
    </>
  ),
  'cavedelver-stone-skin': (
    <>
      <circle cx={32} cy={16} r={9} fill="#9a9a9a" stroke={O} strokeWidth={2} />
      <path d="M14 58 Q14 28 32 28 Q50 28 50 58 Z" fill="#9a9a9a" stroke={O} strokeWidth={2} />
      <path d="M20 40 L28 44 L26 52 M38 36 L44 42 L40 50 M30 32 L34 38" fill="none" stroke="#5a5a5a" strokeWidth={2} />
    </>
  ),
};

/** How each picture moves when its card is played (see CardArt's FX). */
export const HIGH_FX: Record<string, 'snap' | 'shot' | 'swing' | 'spin' | 'pulse' | 'rise' | 'shine' | 'dash'> = {
  'trapper-dog': 'dash', 'trapper-vigilance': 'shine', 'trapper-piercing-arrow': 'shot', 'trapper-camp': 'rise', 'trapper-volley': 'shot', 'trapper-leatherwork': 'snap',
  'elder-mistral': 'dash', 'elder-vision': 'shine', 'elder-beast-form': 'pulse', 'elder-fill': 'rise', 'elder-spirit': 'rise', 'elder-life-potion': 'rise',
  'diver-agility': 'dash', 'diver-toxin': 'pulse', 'diver-sleep': 'shot', 'diver-flow': 'rise', 'diver-water-bolt': 'shot', 'diver-bloodlust': 'pulse',
  'gourmet-groundwater': 'dash', 'gourmet-spice': 'shot', 'gourmet-better-food': 'shine', 'gourmet-venom-bone': 'shot', 'gourmet-recipe': 'rise', 'gourmet-healthy': 'rise',
  'explorer-spyglass': 'shine', 'explorer-bait': 'snap', 'explorer-flashbang': 'pulse', 'explorer-luck': 'shine', 'explorer-shrapnel': 'pulse', 'explorer-teleport': 'spin',
  'warrior-whetstone': 'shine', 'warrior-wide-swing': 'swing', 'warrior-intimidate': 'pulse', 'warrior-precision': 'shine', 'warrior-banner': 'rise', 'warrior-behead': 'swing',
  'mystic-void-bolt': 'shot', 'mystic-illusion': 'spin', 'mystic-healing': 'rise', 'mystic-double': 'dash', 'mystic-chasm': 'pulse', 'mystic-voidling': 'rise',
  'guardian-sign': 'shine', 'guardian-field': 'pulse', 'guardian-service': 'shine', 'guardian-claw': 'swing', 'guardian-shield-wall': 'pulse', 'guardian-spear': 'shot',
  'wraith-pierce': 'shot', 'wraith-aim': 'shine', 'wraith-untouchable': 'dash', 'wraith-runner': 'dash', 'wraith-triple-shot': 'shot', 'wraith-headshot': 'shot',
  'druid-totem': 'rise', 'druid-raven': 'dash', 'druid-nature-force': 'pulse', 'druid-forest-lord': 'shine', 'druid-shapeshift': 'pulse', 'druid-pack': 'dash',
  'runemaster-honour': 'shine', 'runemaster-reflex': 'shine', 'runemaster-hammer': 'swing', 'runemaster-nose': 'shine', 'runemaster-rend': 'pulse', 'runemaster-bind': 'spin',
  'cavedelver-dynamite': 'pulse', 'cavedelver-helping-hand': 'snap', 'cavedelver-shadow': 'dash', 'cavedelver-stew': 'rise', 'cavedelver-flamethrower': 'shot', 'cavedelver-stone-skin': 'pulse',
};
