import type { ReactNode } from 'react';
import type { RaceId, ProfessionId, HeroLook, TerrainId } from '@hp/content';
import { HeroArt } from './HeroArt';

/**
 * A little stage for every event card: a sky and a land that fit the card (or the fragment the hero
 * stands on), the figures of the story, weather and magic on top, and the hero walking in from the
 * left. Cards with several steps change the picture as the story goes on.
 */

const O = '#1a120c';
type Sky = 'day' | 'dusk' | 'night' | 'storm' | 'hell' | 'cave' | 'void' | 'gold';
type Land = TerrainId | 'core' | 'catacomb' | 'dungeon';
type Fx = 'torches' | 'rain' | 'lightning' | 'wind' | 'fire' | 'fog' | 'sparkle' | 'embers' | 'quake' | 'stars' | 'greenfog' | 'void';
type Anim = 'bob' | 'sway' | 'float' | 'flicker' | 'pulse' | 'prowl' | 'shake' | 'spin';

interface Place { a: Actor; x: number; y?: number; s?: number; flip?: boolean; anim?: Anim; o?: number }
interface SceneDef { sky?: Sky; land?: Land; fx?: Fx[]; actors: Place[]; hero?: boolean }

// ---------- Figures ----------

interface PersonLook {
  robe: string; skin?: string; trim?: string;
  head?: 'hood' | 'hat' | 'horns' | 'helmet' | 'scarf' | 'witch' | 'antennae' | 'bull' | 'goat' | 'bald' | 'leaves' | 'bandage';
  hair?: string;
  legs?: 'goat' | 'robe' | 'normal';
  item?: 'staff' | 'sword' | 'bow' | 'hammer' | 'herbs' | 'axe' | 'dagger' | 'crossbow' | 'sceptre';
  glowEyes?: string;
  wings?: string;
  bulk?: number;
}

function Person(p: PersonLook): ReactNode {
  const skin = p.skin ?? '#e8b796';
  const b = p.bulk ?? 1;
  const w = 10 * b;
  return (
    <>
      {p.wings && <path d={`M-4 -34 Q-34 -60 -30 -20 Q-20 -30 -14 -22 Q-10 -32 -4 -26 Z M4 -34 Q34 -60 30 -20 Q20 -30 14 -22 Q10 -32 4 -26 Z`} fill={p.wings} stroke={O} strokeWidth={1.5} />}
      {p.legs === 'goat' ? (
        <>
          <path d="M-7 -16 Q-12 -8 -4 -6 L-6 0 L-2 0 L0 -8 Q-2 -12 -2 -16 Z" fill="#7a5230" stroke={O} strokeWidth={1.4} />
          <path d="M7 -16 Q12 -8 4 -6 L6 0 L2 0 L0 -8 Q2 -12 2 -16 Z" fill="#7a5230" stroke={O} strokeWidth={1.4} />
        </>
      ) : p.legs === 'robe' ? null : (
        <>
          <rect x={-7 * b} y={-16} width={5 * b} height={16} fill="#3a2a20" stroke={O} strokeWidth={1.4} />
          <rect x={2 * b} y={-16} width={5 * b} height={16} fill="#3a2a20" stroke={O} strokeWidth={1.4} />
        </>
      )}
      <path d={p.legs === 'robe' ? `M${-w} -34 L${w} -34 L${w + 4} 0 L${-w - 4} 0 Z` : `M${-w} -34 L${w} -34 L${w - 2} -14 L${-w + 2} -14 Z`} fill={p.robe} stroke={O} strokeWidth={1.6} />
      {p.trim && <rect x={-w + 1} y={-22} width={2 * w - 2} height={3} fill={p.trim} />}
      <rect x={-w - 5} y={-33} width={5} height={16} fill={p.robe} stroke={O} strokeWidth={1.4} />
      <rect x={w} y={-33} width={5} height={16} fill={p.robe} stroke={O} strokeWidth={1.4} />
      <circle cx={-w - 2.5} cy={-16} r={2.6} fill={skin} stroke={O} strokeWidth={1} />
      <circle cx={w + 2.5} cy={-16} r={2.6} fill={skin} stroke={O} strokeWidth={1} />
      <Item kind={p.item} x={w + 3} />
      <Head look={p} skin={skin} />
    </>
  );
}

function Head({ look, skin }: { look: PersonLook; skin: string }) {
  const h = look.head;
  if (h === 'bull') {
    return (
      <>
        <path d="M-12 -50 Q-16 -58 -8 -56 M12 -50 Q16 -58 8 -56" stroke="#e8dcc0" strokeWidth={3} fill="none" />
        <path d="M-8 -52 L8 -52 L10 -40 Q0 -32 -10 -40 Z" fill="#5a3a24" stroke={O} strokeWidth={1.5} />
        <ellipse cx={0} cy={-38} rx={6} ry={3.5} fill="#8a6a50" stroke={O} />
        <circle cx={-4} cy={-46} r={1.5} fill={look.glowEyes ?? '#ff3a2a'} /><circle cx={4} cy={-46} r={1.5} fill={look.glowEyes ?? '#ff3a2a'} />
      </>
    );
  }
  return (
    <>
      <circle cx={0} cy={-42} r={7.5} fill={skin} stroke={O} strokeWidth={1.5} />
      {look.hair && <path d="M-7.5 -43 Q0 -54 7.5 -43 L7 -47 Q0 -53 -7 -47 Z" fill={look.hair} />}
      <circle cx={-2.6} cy={-42} r={1.2} fill={look.glowEyes ?? O} />
      <circle cx={2.6} cy={-42} r={1.2} fill={look.glowEyes ?? O} />
      {look.glowEyes && <circle cx={0} cy={-42} r={9} fill={look.glowEyes} opacity={0.15} />}
      {h === 'hood' && <path d="M-9 -38 Q-11 -54 0 -54 Q11 -54 9 -38 L6 -40 Q6 -50 0 -50 Q-6 -50 -6 -40 Z" fill={look.robe} stroke={O} strokeWidth={1.4} />}
      {h === 'hat' && <path d="M-12 -47 L12 -47 L6 -50 L4 -56 L-4 -56 L-6 -50 Z" fill="#6a4a2a" stroke={O} strokeWidth={1.4} />}
      {h === 'witch' && <path d="M-13 -47 L13 -47 L4 -50 L8 -66 L-4 -50 Z" fill="#2a1a3a" stroke={O} strokeWidth={1.4} />}
      {h === 'horns' && <path d="M-6 -48 Q-12 -56 -8 -60 Q-6 -54 -3 -50 Z M6 -48 Q12 -56 8 -60 Q6 -54 3 -50 Z" fill="#e8dcc0" stroke={O} strokeWidth={1} />}
      {h === 'goat' && <path d="M-5 -48 Q-14 -52 -12 -44 M5 -48 Q14 -52 12 -44" stroke="#c8b890" strokeWidth={3} fill="none" strokeLinecap="round" />}
      {h === 'helmet' && <path d="M-8.5 -42 Q-9 -52 0 -52 Q9 -52 8.5 -42 Z" fill="#b8bcc8" stroke={O} strokeWidth={1.4} />}
      {h === 'scarf' && <path d="M-8 -45 Q0 -53 8 -45 L8 -40 L11 -32 L6 -38 Q0 -36 -8 -40 Z" fill={look.trim ?? '#c0392b'} stroke={O} strokeWidth={1.2} />}
      {h === 'antennae' && <path d="M-3 -49 Q-6 -58 -10 -58 M3 -49 Q6 -58 10 -58" stroke={O} strokeWidth={1.4} fill="none" />}
      {h === 'leaves' && <path d="M-8 -47 Q-12 -56 -4 -52 Q-2 -60 2 -52 Q8 -58 8 -46" fill="#4a9a3a" stroke={O} strokeWidth={1.2} />}
      {h === 'bandage' && <path d="M-7 -46 L7 -44 M-7 -40 L7 -42 M-6 -36 L6 -38" stroke="#d8d0b0" strokeWidth={2.4} />}
    </>
  );
}

function Item({ kind, x }: { kind?: PersonLook['item']; x: number }) {
  if (!kind) return null;
  const y = -16;
  switch (kind) {
    case 'staff': return <><rect x={x} y={-52} width={2.5} height={52} fill="#8a5a32" stroke={O} strokeWidth={0.8} /><circle cx={x + 1.2} cy={-54} r={3.5} fill="#9fe8ff" stroke={O} /></>;
    case 'sword': return <path d={`M${x} ${y} L${x + 4} ${y - 26} L${x + 6} ${y - 25} L${x + 3} ${y} Z M${x - 3} ${y - 2} L${x + 7} ${y - 2}`} fill="#dfe3ec" stroke={O} strokeWidth={1.2} />;
    case 'dagger': return <path d={`M${x} ${y} L${x + 3} ${y - 12} L${x + 5} ${y - 11} L${x + 3} ${y} Z`} fill="#dfe3ec" stroke={O} strokeWidth={1.2} />;
    case 'axe': return <><rect x={x} y={y - 28} width={2.5} height={30} fill="#8a5a32" stroke={O} strokeWidth={0.8} /><path d={`M${x + 2} ${y - 28} Q${x + 14} ${y - 30} ${x + 12} ${y - 16} Q${x + 6} ${y - 20} ${x + 2} ${y - 20} Z`} fill="#b8bcc8" stroke={O} strokeWidth={1.2} /></>;
    case 'bow': return <><path d={`M${x} ${y - 20} Q${x + 12} ${y - 6} ${x} ${y + 8}`} fill="none" stroke="#8a5a32" strokeWidth={2.5} /><path d={`M${x} ${y - 20} L${x} ${y + 8}`} stroke="#e8dcc0" strokeWidth={0.8} /></>;
    case 'crossbow': return <><rect x={x - 2} y={y - 3} width={14} height={3} fill="#8a5a32" stroke={O} strokeWidth={0.8} /><path d={`M${x + 10} ${y - 9} Q${x + 13} ${y - 1} ${x + 10} ${y + 7}`} fill="none" stroke="#5a3a20" strokeWidth={2} /></>;
    case 'hammer': return <><rect x={x} y={y - 18} width={2.5} height={20} fill="#8a5a32" stroke={O} strokeWidth={0.8} /><rect x={x - 4} y={y - 24} width={11} height={7} fill="#7a7e88" stroke={O} strokeWidth={1.2} /></>;
    case 'herbs': return <g transform={`translate(${x} ${y})`}>{[-6, -2, 2].map((d) => <path key={d} d={`M0 0 Q${d} -8 ${d * 1.5} -14`} stroke="#4a9a3a" strokeWidth={2} fill="none" />)}<circle cx={-8} cy={-14} r={2} fill="#c84a3a" /><circle cx={3} cy={-15} r={2} fill="#e0b25c" /></g>;
    case 'sceptre': return <><rect x={x} y={y - 24} width={2.5} height={26} fill="#e0b25c" stroke={O} strokeWidth={0.8} /><circle cx={x + 1.2} cy={y - 26} r={3.5} fill="#c84a3a" stroke={O} /></>;
  }
}

interface BeastLook { body: string; size?: number; head?: 'wolf' | 'boar' | 'lion' | 'goat'; wings?: string; tail?: 'scorpion' | 'bushy' | 'thin'; mane?: string; tusks?: boolean; eyes?: string }

function Beast(b: BeastLook): ReactNode {
  const s = b.size ?? 1;
  return (
    <g transform={`scale(${s})`}>
      {b.wings && <path d="M-6 -24 Q-14 -56 10 -50 Q4 -42 14 -40 Q6 -34 12 -28 Z" fill={b.wings} stroke={O} strokeWidth={1.4} />}
      {b.tail === 'scorpion' && <path d="M-18 -18 Q-34 -24 -30 -40 Q-26 -50 -18 -44" fill="none" stroke={b.body} strokeWidth={4} strokeLinecap="round" />}
      {b.tail === 'scorpion' && <path d="M-18 -44 L-12 -48 L-16 -40 Z" fill="#c84a3a" stroke={O} />}
      {b.tail === 'bushy' && <path d="M-18 -18 Q-30 -20 -32 -10 Q-24 -14 -18 -13 Z" fill={b.body} stroke={O} strokeWidth={1.2} />}
      {b.tail === 'thin' && <path d="M-18 -18 Q-28 -16 -30 -6" fill="none" stroke={O} strokeWidth={1.6} />}
      {[-14, -6, 6, 13].map((x, i) => <rect key={i} x={x} y={-12} width={4.5} height={12} fill={b.body} stroke={O} strokeWidth={1.2} />)}
      <ellipse cx={0} cy={-17} rx={20} ry={9} fill={b.body} stroke={O} strokeWidth={1.6} />
      {b.mane && <circle cx={16} cy={-24} r={10} fill={b.mane} stroke={O} strokeWidth={1.4} />}
      {b.head === 'boar' ? (
        <path d="M14 -26 L30 -22 L32 -14 L14 -12 Z" fill={b.body} stroke={O} strokeWidth={1.5} />
      ) : b.head === 'lion' ? (
        <path d="M12 -30 Q24 -32 26 -22 Q26 -14 16 -16 Z" fill="#e8b070" stroke={O} strokeWidth={1.5} />
      ) : (
        <path d="M12 -26 L22 -30 L30 -22 L20 -18 L12 -18 Z M16 -28 L17 -36 L21 -29" fill={b.body} stroke={O} strokeWidth={1.5} />
      )}
      {b.tusks && <path d="M29 -16 Q34 -20 32 -24" stroke="#f4ecd8" strokeWidth={2} fill="none" />}
      <circle cx={22} cy={-25} r={1.4} fill={b.eyes ?? '#ffd34d'} />
    </g>
  );
}

const ghost = (
  <g>
    <path d="M-12 0 Q-14 -30 -10 -40 Q0 -56 10 -40 Q14 -30 12 0 L8 -5 L4 0 L0 -5 L-4 0 L-8 -5 Z" fill="#c8d8ff" fillOpacity={0.7} stroke="#e8f0ff" strokeWidth={1.2} />
    <ellipse cx={-4} cy={-38} rx={2} ry={3} fill="#1a2040" /><ellipse cx={4} cy={-38} rx={2} ry={3} fill="#1a2040" />
    <ellipse cx={0} cy={-30} rx={3} ry={4} fill="#1a2040" opacity={0.8} />
  </g>
);

const tree = (gold = false) => (
  <g>
    <path d="M-4 0 L-3 -30 L3 -30 L4 0 Z" fill="#6a4a2a" stroke={O} strokeWidth={1.4} />
    <circle cx={0} cy={-42} r={20} fill={gold ? '#e8b830' : '#3a7a3a'} stroke={O} strokeWidth={1.6} />
    <circle cx={-12} cy={-32} r={12} fill={gold ? '#d8a020' : '#2f6a32'} stroke={O} strokeWidth={1.4} />
    <circle cx={12} cy={-34} r={12} fill={gold ? '#f0c840' : '#357a38'} stroke={O} strokeWidth={1.4} />
    {gold && [[-8, -44], [6, -50], [10, -34], [-14, -30], [2, -36]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.6} fill="#c8202a" stroke={O} strokeWidth={0.8} />)}
  </g>
);

const ACTORS = {
  hero: null as unknown as ReactNode,
  satyr: Person({ robe: '#8a5a30', skin: '#d9a076', head: 'goat', hair: '#6a4a2a', legs: 'goat', item: undefined }),
  sage: Person({ robe: '#5a7a4a', skin: '#b8e0a0', head: 'hood', legs: 'robe', item: 'staff', trim: '#d8f0b0' }),
  keeper: Person({ robe: '#3f6b3a', skin: '#b8e0a0', head: 'leaves', legs: 'robe', item: 'herbs' }),
  merchant: Person({ robe: '#8a3a5a', head: 'hat', item: undefined, trim: '#e0b25c', bulk: 1.15 }),
  sunborn: Person({ robe: '#e0c068', skin: '#c98a3a', head: 'helmet', item: 'sword', trim: '#2a5aa0' }),
  bandit: Person({ robe: '#4a3a3a', head: 'scarf', trim: '#7a2020', item: 'dagger' }),
  archer: Person({ robe: '#3a4a2a', head: 'hood', item: 'bow' }),
  nomad: Person({ robe: '#8a6f3e', skin: '#d9a066', head: 'scarf', trim: '#c0392b', item: 'bow' }),
  nomadSit: Person({ robe: '#8a6f3e', skin: '#d9a066', head: 'scarf', trim: '#c0392b' }),
  witch: Person({ robe: '#3a1a4a', skin: '#b8c8a0', head: 'witch', legs: 'robe', glowEyes: '#7af08a' }),
  smith: Person({ robe: '#5a4e57', skin: '#8a8f98', head: 'bald', trim: '#8a5a32', item: 'hammer', bulk: 1.3 }),
  flintborn: Person({ robe: '#4a4e57', skin: '#8a8f98', head: 'bald', bulk: 1.4 }),
  myrmid: Person({ robe: '#2f5d7c', skin: '#5fb3b3', head: 'antennae', trim: '#a9e4e4' }),
  woman: Person({ robe: '#e8e0ff', skin: '#f0d8d0', hair: '#c8a060', legs: 'robe' }),
  demon: Person({ robe: '#8a1a1a', skin: '#c83a2a', head: 'horns', item: 'axe', glowEyes: '#ffd34d', wings: '#4a0a0a', bulk: 1.3 }),
  demonSmall: Person({ robe: '#6a2a3a', skin: '#c84a3a', head: 'horns', item: 'sword', glowEyes: '#ffd34d' }),
  imp: Person({ robe: '#5a3a2a', skin: '#a0603a', head: 'horns', item: 'dagger', glowEyes: '#ffe03a', bulk: 0.8 }),
  minotaur: Person({ robe: '#6a4a30', skin: '#5a3a24', head: 'bull', item: 'axe', bulk: 1.5 }),
  beastman: Person({ robe: '#5a4a3a', skin: '#8a7a5a', head: 'goat', legs: 'goat', item: 'sword', glowEyes: '#ff8a3a' }),
  mummy: Person({ robe: '#c8bc98', skin: '#c8bc98', head: 'bandage', glowEyes: '#7af0ff' }),
  driver: Person({ robe: '#6a5a3a', head: 'hat', item: 'crossbow' }),
  statue: (
    <g>
      <rect x={-16} y={-10} width={32} height={10} fill="#7c8090" stroke={O} strokeWidth={1.5} />
      <g transform="translate(0 -10)">{Person({ robe: '#9aa0ac', skin: '#9aa0ac', head: 'bald', legs: 'robe', glowEyes: '#9fe8ff' })}</g>
    </g>
  ),
  ghost,
  wolf: Beast({ body: '#7a7e88', head: 'wolf', tail: 'bushy' }),
  wolfDark: Beast({ body: '#4a4e58', head: 'wolf', tail: 'bushy', eyes: '#ff5a3a' }),
  beast: Beast({ body: '#6a4a30', head: 'boar', tail: 'thin', tusks: true, size: 1.5 }),
  manticore: Beast({ body: '#c8904a', head: 'lion', mane: '#8a4a1a', wings: '#3a2a3a', tail: 'scorpion', size: 1.5 }),
  snake: <path d="M-24 0 Q-16 -12 -8 -2 Q0 8 8 -4 Q14 -14 18 -10 L24 -12 L20 -6 Q16 -8 12 -2 Q2 12 -8 4 Q-16 -6 -24 0 Z" fill="#5a8a2a" stroke={O} strokeWidth={1.5} />,
  tree: tree(),
  goldTree: tree(true),
  flower: (
    <g>
      <path d="M0 0 Q-2 -14 0 -22" stroke="#3a7a3a" strokeWidth={2.5} fill="none" />
      <path d="M0 -10 Q-8 -14 -10 -8 Q-4 -8 0 -10" fill="#4a9a3a" stroke={O} strokeWidth={0.8} />
      {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={0} cy={-29} rx={3.5} ry={7} transform={`rotate(${r} 0 -24)`} fill="#a0502a" stroke={O} strokeWidth={0.8} />)}
      <circle cx={0} cy={-24} r={3} fill="#ffd34d" stroke={O} strokeWidth={0.8} />
    </g>
  ),
  portal: (
    <g>
      <ellipse cx={0} cy={-3} rx={26} ry={7} fill="#0b0618" stroke="#8f7bff" strokeWidth={2} />
      <ellipse cx={0} cy={-3} rx={16} ry={4} fill="none" stroke="#c9b8ff" strokeWidth={1.2} strokeDasharray="4 3" />
      <ellipse cx={0} cy={-3} rx={30} ry={10} fill="#8f7bff" opacity={0.15} />
    </g>
  ),
  pond: (
    <g>
      <ellipse cx={0} cy={-3} rx={42} ry={9} fill="#06060c" stroke="#3a3a5a" strokeWidth={2} />
      <path d="M-20 -5 Q-10 -7 0 -5" stroke="#8f7bff" strokeWidth={1.4} opacity={0.7} fill="none" />
      <path d="M8 -2 Q16 -4 24 -2" stroke="#c9b8ff" strokeWidth={1} opacity={0.5} fill="none" />
    </g>
  ),
  wagon: (
    <g>
      <rect x={-30} y={-26} width={52} height={16} fill="#8a5a32" stroke={O} strokeWidth={1.6} />
      <path d="M-28 -26 Q-4 -50 20 -26 Z" fill="#e8dcc0" stroke={O} strokeWidth={1.6} />
      {[-20, 12].map((x) => <g key={x}><circle cx={x} cy={-8} r={8} fill="#5a3a20" stroke={O} strokeWidth={1.6} /><circle cx={x} cy={-8} r={2} fill={O} /></g>)}
    </g>
  ),
  sarcophagus: (
    <g>
      <rect x={-30} y={-16} width={60} height={16} fill="#8a8070" stroke={O} strokeWidth={1.6} />
      <path d="M-32 -16 L-26 -24 L26 -24 L32 -16 Z" fill="#a89a80" stroke={O} strokeWidth={1.6} />
      <path d="M-8 -21 L0 -23 L8 -21" stroke="#e0b25c" strokeWidth={1.5} fill="none" />
      <circle cx={0} cy={-8} r={3} fill="#e0b25c" stroke={O} />
    </g>
  ),
  sarcophagusOpen: (
    <g>
      <rect x={-30} y={-16} width={60} height={16} fill="#8a8070" stroke={O} strokeWidth={1.6} />
      <rect x={-26} y={-16} width={52} height={5} fill="#2a2420" />
      <path d="M26 -16 L46 -6 L44 0 L22 -10 Z" fill="#a89a80" stroke={O} strokeWidth={1.6} />
      <path d="M-20 -14 Q0 -20 20 -14" stroke="#d8d0b0" strokeWidth={3} fill="none" />
      <circle cx={-6} cy={-16} r={2} fill="#ffd34d" /><circle cx={8} cy={-17} r={1.6} fill="#7ee2ff" />
    </g>
  ),
  stump: (
    <g>
      <path d="M-14 0 L-12 -14 L12 -14 L14 0 Z" fill="#7a5230" stroke={O} strokeWidth={1.5} />
      <ellipse cx={0} cy={-14} rx={12} ry={3.5} fill="#c8a060" stroke={O} strokeWidth={1.2} />
      {[-7, 0, 7].map((x) => <rect key={x} x={x - 2.5} y={-19} width={5} height={6} fill={x === 0 ? '#fff6e0' : '#2a1d4d'} stroke={O} strokeWidth={0.8} />)}
    </g>
  ),
  arrow: <g><path d="M0 0 L8 -18" stroke="#8a5a32" strokeWidth={2} /><path d="M6 -20 L10 -22 L9 -16 Z M7 -14 L12 -16 L10 -12 Z" fill="#e8dcc0" stroke={O} strokeWidth={0.6} /></g>,
  book: (
    <g>
      <path d="M-18 -6 L0 -2 L18 -6 L18 -20 L0 -16 L-18 -20 Z" fill="#f4ecd8" stroke={O} strokeWidth={1.4} />
      <path d="M0 -16 L0 -2" stroke={O} strokeWidth={1} />
      <path d="M-14 -16 L-4 -14 M-14 -12 L-4 -10 M4 -14 L14 -16 M4 -10 L14 -12" stroke="#8a7a60" strokeWidth={0.8} />
      <path d="M-20 -4 L0 0 L20 -4 L20 -6 L0 -2 L-20 -6 Z" fill="#7a2a2a" stroke={O} strokeWidth={1} />
      <circle cx={0} cy={-18} r={14} fill="#ffe3a0" opacity={0.2} />
    </g>
  ),
  caveMouth: (
    <g>
      <path d="M-50 0 Q-50 -60 0 -64 Q50 -60 50 0 Z" fill="#5a5258" stroke={O} strokeWidth={1.6} />
      <path d="M-26 0 Q-26 -40 0 -42 Q26 -40 26 0 Z" fill="#0a0808" />
    </g>
  ),
  boulder: (
    <g>
      <path d="M-50 0 Q-60 -70 0 -70 Q60 -70 50 0 Z" fill="#5a5258" stroke={O} strokeWidth={1.6} />
      <ellipse cx={0} cy={-22} rx={24} ry={22} fill="#7a7278" stroke={O} strokeWidth={1.6} />
      {[-12, 0, 12].map((x) => <path key={x} d={`M${x} -30 L${x} -22 M${x - 3} -27 L${x + 3} -25`} stroke="#7af0ff" strokeWidth={1.4} />)}
    </g>
  ),
  treasure: (
    <g>
      <rect x={-16} y={-14} width={32} height={14} fill="#7a4a24" stroke={O} strokeWidth={1.5} />
      <path d="M-16 -14 L-10 -26 L22 -26 L16 -14 Z" fill="#5a3418" stroke={O} strokeWidth={1.5} />
      {[[-8, -16], [0, -18], [8, -16], [-4, -20], [4, -21]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.2} fill="#ffd34d" stroke="#8a5a00" />)}
    </g>
  ),
  campfire: (
    <g>
      <path d="M-12 0 L12 -6 M-12 -6 L12 0" stroke="#6a4a2a" strokeWidth={4} />
      <path className="fx-flame" d="M-8 -4 Q-10 -18 0 -28 Q4 -18 8 -22 Q12 -12 8 -4 Z" fill="#ff8a3a" stroke="#c8401a" strokeWidth={1} />
      <path className="fx-flame" d="M-3 -4 Q-4 -12 1 -18 Q4 -10 4 -4 Z" fill="#ffe03a" />
      <circle cx={0} cy={-12} r={22} fill="#ff9a3a" opacity={0.18} />
    </g>
  ),
  anvil: (
    <g>
      <path d="M-14 0 L-8 -8 L8 -8 L14 0 Z" fill="#3a3a44" stroke={O} strokeWidth={1.4} />
      <path d="M-18 -8 L18 -8 L22 -16 L-8 -16 Q-20 -16 -24 -12 Z" fill="#5a5e68" stroke={O} strokeWidth={1.4} />
      <rect x={-10} y={-19} width={22} height={3} fill="#ffb03a" stroke="#c8501a" strokeWidth={0.8} />
      <circle cx={0} cy={-18} r={10} fill="#ff9a3a" opacity={0.25} />
    </g>
  ),
  hut: (
    <g>
      <path d="M-30 0 L-28 -30 L26 -34 L30 0 Z" fill="#7a5a3a" stroke={O} strokeWidth={1.6} />
      <path d="M-36 -28 L-2 -56 L34 -32 Z" fill="#8a7a4a" stroke={O} strokeWidth={1.6} />
      <rect x={-6} y={-20} width={12} height={20} fill="#2a1a10" stroke={O} />
      <rect x={12} y={-24} width={8} height={7} fill="#ffd98a" stroke={O} />
      <path d="M-20 -12 L-12 -22" stroke={O} strokeWidth={1.2} />
    </g>
  ),
  tower: (
    <g>
      <path d="M-18 0 L-14 -78 L-8 -84 L-4 -78 L2 -86 L8 -78 L14 -80 L18 0 Z" fill="#7c8090" stroke={O} strokeWidth={1.6} />
      <rect x={-4} y={-20} width={8} height={20} fill="#1a1820" stroke={O} />
      <rect x={-3} y={-56} width={6} height={10} fill="#1a1820" />
      <path d="M-14 -40 L14 -40 M-15 -60 L15 -60" stroke="#5a5e68" strokeWidth={1.2} />
    </g>
  ),
  waterfall: (
    <g>
      <path d="M-40 0 L-36 -70 L-14 -70 L-14 -8 L14 -8 L14 -70 L36 -70 L40 0 Z" fill="#6a6470" stroke={O} strokeWidth={1.4} />
      <rect className="fx-water" x={-14} y={-70} width={28} height={64} fill="#7ac8f0" />
      <ellipse cx={0} cy={-4} rx={30} ry={6} fill="#5ab0e0" stroke={O} strokeWidth={1.2} />
    </g>
  ),
  stone: (
    <g>
      <ellipse cx={0} cy={-5} rx={26} ry={7} fill="#c8ccd6" stroke={O} strokeWidth={1.5} />
      <ellipse cx={0} cy={-7} rx={18} ry={3} fill="#f4f6ff" opacity={0.6} />
      <ellipse cx={0} cy={-6} rx={34} ry={14} fill="#9fe8ff" opacity={0.12} />
    </g>
  ),
  chasm: (
    <g>
      <path d="M-60 0 L-40 -6 L-20 2 L0 -4 L20 3 L40 -5 L60 0 L50 20 L-50 20 Z" fill="#05030a" />
      <path d="M-60 0 L-40 -6 L-20 2 L0 -4 L20 3 L40 -5 L60 0" stroke="#3a3040" strokeWidth={2} fill="none" />
    </g>
  ),
  spikes: <g>{[-24, -12, 0, 12, 24].map((x) => <path key={x} d={`M${x - 4} 0 L${x} -9 L${x + 4} 0`} fill="#c0c8d4" stroke={O} strokeWidth={1} />)}</g>,
  chests: (
    <g>
      {[-34, 0, 34].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <rect x={-12} y={-12} width={24} height={12} fill="#7a4a24" stroke={O} strokeWidth={1.4} />
          <path d="M-12 -12 Q0 -22 12 -12 Z" fill="#8a5a30" stroke={O} strokeWidth={1.4} />
          <rect x={-2.5} y={-10} width={5} height={6} fill="#e0b25c" stroke={O} strokeWidth={0.8} />
          <text x={0} y={-24} fontSize={7} textAnchor="middle" fill="#ffe3a0" opacity={0.85}>?</text>
        </g>
      ))}
    </g>
  ),
  bones: (
    <g>
      <circle cx={-10} cy={-6} r={6} fill="#e8e0c8" stroke={O} strokeWidth={1.2} />
      <circle cx={-12} cy={-7} r={1.4} fill={O} /><circle cx={-8} cy={-7} r={1.4} fill={O} />
      <path d="M2 -2 L22 -6 M6 -6 L18 0" stroke="#e8e0c8" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  moon: (
    <g>
      <circle cx={0} cy={0} r={18} fill="#f0e8ff" />
      <circle cx={8} cy={-4} r={16} fill="#2a2050" />
    </g>
  ),
  skullCloud: (
    <g opacity={0.85}>
      <path d="M-30 0 Q-34 -30 0 -32 Q34 -30 30 0 Q20 6 14 0 Q8 8 0 2 Q-8 8 -14 0 Q-20 6 -30 0 Z" fill="#4a3a6a" />
      <ellipse cx={-10} cy={-14} rx={6} ry={7} fill="#0b0618" /><ellipse cx={10} cy={-14} rx={6} ry={7} fill="#0b0618" />
      <circle cx={-10} cy={-13} r={1.6} fill="#ff3a5a" /><circle cx={10} cy={-13} r={1.6} fill="#ff3a5a" />
    </g>
  ),
  darkBlob: (
    <g>
      <path d="M-40 0 Q-46 -30 -20 -34 Q-6 -50 14 -36 Q40 -40 40 -14 Q50 0 30 2 Z" fill="#0b0618" stroke="#8f7bff" strokeWidth={2} />
      <circle cx={-12} cy={-20} r={2} fill="#c9b8ff" /><circle cx={10} cy={-24} r={1.5} fill="#c9b8ff" /><circle cx={20} cy={-12} r={1.2} fill="#c9b8ff" />
    </g>
  ),
  rocks: (
    <g>
      <path d="M-30 0 L-24 -16 L-10 -20 L-4 -8 L6 -22 L22 -18 L30 0 Z" fill="#6a6470" stroke={O} strokeWidth={1.5} />
      <path d="M-18 -14 L-12 -8 M10 -18 L14 -10" stroke="#4a4450" strokeWidth={1.2} />
    </g>
  ),
  altar: (
    <g>
      <rect x={-20} y={-16} width={40} height={16} fill="#5a5260" stroke={O} strokeWidth={1.5} />
      <rect x={-24} y={-20} width={48} height={5} fill="#7a7280" stroke={O} strokeWidth={1.2} />
      <path d="M-4 -20 L0 -34 L4 -20" fill="#9fe8ff" stroke={O} />
      <circle cx={0} cy={-28} r={10} fill="#9fe8ff" opacity={0.2} />
    </g>
  ),
  plates: <g>{[-30, -10, 10, 30].map((x, i) => <g key={x}><rect x={x - 8} y={-4} width={16} height={4} fill="#6a6470" stroke={O} /><path d={['M-3 -2 L3 -2 M0 -3 L0 -1', 'M-3 -3 L3 -1', 'M-3 -1 L0 -3 L3 -1', 'M-2 -3 L2 -1 M2 -3 L-2 -1'][i]} transform={`translate(${x} 0)`} stroke="#7af0ff" strokeWidth={1} /></g>)}</g>,
  web: <g stroke="#e8e8f0" strokeWidth={0.8} fill="none" opacity={0.8}>{[10, 20, 30].map((r) => <path key={r} d={`M${-r} 0 Q0 ${-r * 0.4} ${r} 0 Q0 ${-r * 1.4} ${-r} 0`} />)}<path d="M0 0 L0 -40 M-30 0 L30 -30 M30 0 L-30 -30" /></g>,
  spider: (
    <g>
      {[-1, 1].map((side) => [0, 1, 2, 3].map((i) => <path key={`${side}${i}`} d={`M${side * 6} -14 Q${side * (16 + i * 4)} ${-30 + i * 4} ${side * (22 + i * 3)} 0`} fill="none" stroke={O} strokeWidth={2.2} />))}
      <ellipse cx={0} cy={-18} rx={13} ry={10} fill="#2a2030" stroke={O} strokeWidth={1.5} />
      <circle cx={0} cy={-8} r={6} fill="#3a2a40" stroke={O} strokeWidth={1.2} />
      {[-3, -1, 1, 3].map((x) => <circle key={x} cx={x} cy={-9} r={0.9} fill="#ff3a3a" />)}
      <path d="M-4 -22 L4 -22 L0 -14 Z" fill="#c84a3a" />
    </g>
  ),
  pendulum: <g><path d="M0 -90 L0 -20" stroke="#5a5e68" strokeWidth={2} /><path d="M-18 -22 Q0 -4 18 -22 Z" fill="#c0c8d4" stroke={O} strokeWidth={1.4} /></g>,
  bard: Person({ robe: '#5a3a8a', head: 'hat', trim: '#ffd166' }),
  lute: (
    <g transform="rotate(-30)">
      <path d="M2 -26 L4 -48" stroke="#6a4a2a" strokeWidth={3} />
      <ellipse cx={0} cy={-20} rx={8} ry={10} fill="#c8803a" stroke={O} strokeWidth={1.4} />
      <circle cx={0} cy={-20} r={2.5} fill={O} />
    </g>
  ),
  pack: (
    <g>
      <path d="M-14 0 L-16 -24 Q0 -34 16 -24 L14 0 Z" fill="#8a5a30" stroke={O} strokeWidth={1.6} />
      <path d="M-16 -22 Q0 -14 16 -22" fill="none" stroke={O} strokeWidth={1.4} />
      <rect x={-4} y={-18} width={8} height={6} fill="#e0b25c" stroke={O} strokeWidth={1} />
      <circle cx={20} cy={-30} r={3} fill="#ffd34d" stroke="#8a5a00" className="sc-float" />
    </g>
  ),
  boneBridge: (
    <g>
      <path d="M-110 -10 L-110 18 L-80 18 L-80 -10 Z M80 -10 L80 18 L110 18 L110 -10 Z" fill="#3a3430" />
      <path d="M-80 -10 Q0 10 80 -10" fill="none" stroke="#3a2a1a" strokeWidth={1.5} />
      {Array.from({ length: 9 }, (_, i) => -64 + i * 16).map((x) => <g key={x} transform={`translate(${x} ${-6 + Math.abs(x) * -0.06 + 6})`}><rect x={-7} y={-2} width={14} height={4} rx={2} fill="#efe6cc" stroke={O} strokeWidth={0.8} /><circle cx={-7} cy={0} r={2.4} fill="#efe6cc" stroke={O} strokeWidth={0.6} /><circle cx={7} cy={0} r={2.4} fill="#efe6cc" stroke={O} strokeWidth={0.6} /></g>)}
      {[-40, 8, 40].map((x) => <circle key={x} cx={x} cy={-6} r={2} fill="#ffd34d" className="fx-twinkle" />)}
    </g>
  ),
  scales: (
    <g>
      <path d="M0 0 V-40 M-10 0 H10" stroke="#c8a060" strokeWidth={2.5} />
      <g className="sc-sway"><path d="M-22 -40 H22" stroke="#e0b25c" strokeWidth={2.5} />
        <path d="M-22 -40 L-28 -26 H-16 Z M22 -40 L16 -26 H28 Z" fill="none" stroke="#e0b25c" strokeWidth={1.4} />
        {[-24, -20, 20, 24].map((x) => <circle key={x} cx={x} cy={-28} r={2.2} fill="#ffd34d" stroke="#8a5a00" strokeWidth={0.6} />)}</g>
    </g>
  ),
  constellation: (
    <g stroke="#9fe8ff" strokeWidth={0.8} opacity={0.85}>
      <polyline points="-60,10 -30,-10 0,8 30,-14 60,6" fill="none" className="fx-twinkle" />
      {[[-60, 10], [-30, -10], [0, 8], [30, -14], [60, 6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} fill="#fff" className="fx-twinkle" style={{ animationDelay: `${i * 0.3}s` }} />)}
    </g>
  ),
  dice: <g>{[-8, 8].map((x, i) => <g key={x} transform={`translate(${x} -6) rotate(${i ? 14 : -10})`}><rect x={-5} y={-5} width={10} height={10} rx={2} fill="#f4ecd8" stroke={O} strokeWidth={1} /><circle cx={-2} cy={-2} r={1} fill={O} /><circle cx={2} cy={2} r={1} fill={O} /></g>)}</g>,
  fireflies: <g>{Array.from({ length: 16 }, (_, i) => <g key={i} className="sc-float" style={{ animationDelay: `${(i * 0.23) % 2}s` }}><circle cx={((i * 53) % 220) - 110} cy={-((i * 29) % 60)} r={4} fill="#d8ff7a" opacity={0.25} /><circle cx={((i * 53) % 220) - 110} cy={-((i * 29) % 60)} r={1.4} fill="#f0ffb0" className="fx-twinkle" style={{ animationDelay: `${i * 0.17}s` }} /></g>)}</g>,
  fresco: (
    <g>
      <rect x={-36} y={-66} width={72} height={66} fill="#8a8070" stroke={O} strokeWidth={1.6} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={-32 + c * 22} y={-62 + r * 20} width={20} height={18} fill={['#d8c8a0', '#c8b890', '#e0d0a8'][(r + c) % 3]} stroke="#6b4a24" strokeWidth={0.8} transform={(r * 3 + c) % 4 === 1 ? `rotate(4 ${-22 + c * 22} ${-53 + r * 20})` : undefined} />))}
      <circle cx={0} cy={-46} r={8} fill="#ffd166" opacity={0.85} />
      <path d="M-32 -12 L-14 -26 L0 -16 L16 -30 L32 -18 V-4 H-32 Z" fill="#5a7a9a" opacity={0.85} />
    </g>
  ),
  // Town folk (Jacob, 2026-11-28: the town deck).
  brute: Person({ robe: '#7a3a2a', skin: '#d8a07a', head: 'bald', bulk: 1.3 }),
  bruteB: Person({ robe: '#3a5a3a', skin: '#c89070', hair: '#3a2a1a', bulk: 1.25 }),
  guard: Person({ robe: '#4a4a6a', head: 'helmet', item: 'sword', trim: '#d8b040' }),
  pedlar: Person({ robe: '#8a3a6a', head: 'hat', item: 'herbs', trim: '#e0b25c' }),
  urchin: Person({ robe: '#6a5a4a', skin: '#e0b090', hair: '#5a3a1a', item: 'dagger', bulk: 0.8 }),
  hooded: Person({ robe: '#2a2236', head: 'hood', legs: 'robe', glowEyes: '#ffd34d' }),
  beggar: Person({ robe: '#6a6050', head: 'bandage', legs: 'robe', item: 'staff' }),
  seer: Person({ robe: '#5a2a6a', head: 'scarf', trim: '#e0b25c', legs: 'robe' }),
  cat: (
    <g>
      <ellipse cx={0} cy={-6} rx={9} ry={5} fill="#2a2a2a" stroke={O} strokeWidth={1} />
      <circle cx={9} cy={-11} r={4.5} fill="#2a2a2a" stroke={O} strokeWidth={1} />
      <path d="M6 -14 L7 -19 L9 -15 M10 -15 L12 -19 L13 -14" fill="#2a2a2a" stroke={O} strokeWidth={0.8} />
      <path d="M-9 -7 Q-16 -12 -14 -20" fill="none" stroke="#2a2a2a" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={8} cy={-11} r={0.9} fill="#ffd34d" /><circle cx={11} cy={-11} r={0.9} fill="#ffd34d" />
    </g>
  ),
  rat: (
    <g>
      <ellipse cx={0} cy={-4} rx={7} ry={4} fill="#6a6058" stroke={O} strokeWidth={1} />
      <path d="M6 -6 L11 -3 L6 -2 Z" fill="#6a6058" stroke={O} strokeWidth={0.8} />
      <circle cx={4} cy={-8} r={2} fill="#8a7a70" stroke={O} strokeWidth={0.6} />
      <path d="M-7 -4 Q-14 -2 -16 -8" fill="none" stroke="#c8a090" strokeWidth={1.2} />
    </g>
  ),
  barrel: (
    <g>
      <rect x={-10} y={-24} width={20} height={24} rx={4} fill="#7a4a22" stroke={O} strokeWidth={1.4} />
      <rect x={-10} y={-19} width={20} height={2.5} fill="#3a2414" /><rect x={-10} y={-7} width={20} height={2.5} fill="#3a2414" />
    </g>
  ),
  target: (
    <g>
      <rect x={-1.5} y={-30} width={3} height={30} fill="#5a3418" />
      {[16, 11, 6, 2].map((r, i) => <circle key={r} cx={0} cy={-36} r={r} fill={['#f4ecd8', '#c84a3a', '#f4ecd8', '#c84a3a'][i]} stroke={O} strokeWidth={1} />)}
    </g>
  ),
  board: (
    <g>
      <rect x={-22} y={-20} width={3} height={20} fill="#5a3418" /><rect x={19} y={-20} width={3} height={20} fill="#5a3418" />
      <rect x={-26} y={-44} width={52} height={28} fill="#8a5a32" stroke={O} strokeWidth={1.4} />
      <rect x={-21} y={-40} width={12} height={16} fill="#efe3c4" /><rect x={-5} y={-41} width={12} height={18} fill="#f4ecd8" /><rect x={10} y={-39} width={11} height={14} fill="#e8d8b0" />
    </g>
  ),
} satisfies Record<string, ReactNode>;
type Actor = keyof typeof ACTORS;

// ---------- Landscapes ----------

const SKY: Record<Sky, [string, string]> = {
  day: ['#4a6aa0', '#e8c890'],
  dusk: ['#2a1d48', '#c87a5a'],
  night: ['#06061a', '#2a2050'],
  storm: ['#12121c', '#3a3a4c'],
  hell: ['#1a0408', '#c8401a'],
  cave: ['#080608', '#2a2024'],
  void: ['#04020a', '#2a1848'],
  gold: ['#5a3a6a', '#ffd98a'],
};

const GROUND: Record<Land, [string, string]> = {
  forest: ['#24502e', '#2f6a3a'], mountains: ['#5d6170', '#7c8090'], fields: ['#7f8c3c', '#a2ad52'],
  river: ['#3d6b3a', '#4a7d45'], lake: ['#3d6b3a', '#4a7d45'], desert: ['#c09a52', '#d8b56a'],
  inn: ['#5c7a3e', '#6e8e4a'], monument: ['#55606a', '#6d7a84'], cave: ['#4a4448', '#625a60'],
  village: ['#6a8a42', '#7d9e50'], city: ['#7a7258', '#948a6c'], core: ['#120c22', '#241a3e'],
  catacomb: ['#3a3430', '#4a443e'], dungeon: ['#2a2428', '#3a3438'],
};

function Backdrop({ land }: { land: Land }) {
  const [g, g2] = GROUND[land];
  const far = (() => {
    switch (land) {
      case 'forest': return <g fill="#163620" opacity={0.85}>{Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${i * 30 - 10} 100 L${i * 30 + 6} ${60 + (i % 3) * 8} L${i * 30 + 22} 100 Z`} />)}</g>;
      case 'mountains': return <path d="M0 100 L40 50 L70 70 L110 30 L160 80 L200 40 L250 75 L290 35 L340 70 L400 45 L400 100 Z" fill="#3c3f4b" />;
      case 'desert': return <path d="M0 100 Q60 70 120 92 Q200 66 280 90 Q340 72 400 88 L400 100 Z" fill="#a8844a" />;
      case 'river': case 'lake': return <><path d="M0 92 Q100 82 200 94 Q300 84 400 92 L400 100 L0 100 Z" fill="#2b4f2a" /><rect x={0} y={96} width={400} height={6} fill="#4a8ac0" opacity={0.7} /></>;
      case 'village': case 'inn': case 'city': return <g fill="#3a3430">{[20, 70, 120, 280, 330, 370].map((x, i) => <path key={x} d={`M${x} 100 L${x} ${78 - (i % 2) * 6} L${x + 14} ${66 - (i % 2) * 6} L${x + 28} ${78 - (i % 2) * 6} L${x + 28} 100 Z`} />)}</g>;
      case 'monument': return <path d="M300 100 L306 40 L314 40 L320 100 Z M60 100 L64 60 L72 60 L76 100 Z" fill="#3a424a" />;
      case 'cave': case 'dungeon': return <path d="M0 0 L0 100 L20 100 Q10 40 60 20 Q200 -10 340 20 Q390 40 380 100 L400 100 L400 0 Z" fill="#1a1618" />;
      case 'catacomb': return <g fill="#1a1618">{[40, 120, 280, 360].map((x) => <path key={x} d={`M${x - 18} 100 L${x - 18} 60 Q${x} 44 ${x + 18} 60 L${x + 18} 100 Z`} />)}</g>;
      case 'core': return <g fill="#3a2a6a">{[50, 150, 260, 350].map((x) => <path key={x} d={`M${x} 100 L${x + 8} 70 L${x + 16} 100 Z`} />)}</g>;
      default: return <path d="M0 100 Q100 76 200 90 Q300 74 400 92 L400 100 Z" fill="#5f6a2a" />;
    }
  })();
  return (
    <>
      {far}
      <rect x={0} y={100} width={400} height={30} fill={g} />
      <rect x={0} y={100} width={400} height={3} fill={g2} />
    </>
  );
}

function Effects({ fx }: { fx: Fx[] }) {
  return (
    <>
      {fx.includes('stars') && <g fill="#fff">{[[30, 14], [80, 30], [140, 10], [210, 24], [260, 8], [330, 20], [370, 36], [110, 44]].map(([x, y], i) => <circle key={i} className="fx-twinkle" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={y} r={1.2} />)}</g>}
      {fx.includes('fog') && <g className="fx-drift" fill="#e8e8f8" opacity={0.18}><ellipse cx={100} cy={96} rx={120} ry={14} /><ellipse cx={300} cy={104} rx={140} ry={12} /></g>}
      {fx.includes('greenfog') && <g className="fx-drift" fill="#7af08a" opacity={0.22}><ellipse cx={120} cy={98} rx={140} ry={16} /><ellipse cx={320} cy={90} rx={110} ry={14} /></g>}
      {fx.includes('rain') && <g className="fx-rain" stroke="#a8c8ff" strokeWidth={1} opacity={0.6}>{Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${(i * 37) % 410} ${(i * 23) % 120} l-4 10`} />)}</g>}
      {fx.includes('lightning') && <path className="fx-bolt" d="M260 0 L246 40 L258 40 L238 86 L270 34 L256 34 L272 0 Z" fill="#fff6c0" />}
      {fx.includes('wind') && <g className="fx-wind" stroke="#e8f0ff" strokeWidth={1.4} fill="none" opacity={0.5}>{[20, 44, 70, 90].map((y, i) => <path key={y} d={`M${-40 + i * 30} ${y} q40 -8 80 0 t80 0`} />)}</g>}
      {fx.includes('fire') && <g>{Array.from({ length: 10 }, (_, i) => <path key={i} className="fx-flame" style={{ animationDelay: `${i * 0.13}s` }} d={`M${i * 42 - 6} 104 Q${i * 42 - 10} ${80 - (i % 3) * 10} ${i * 42 + 6} ${66 - (i % 2) * 12} Q${i * 42 + 10} 84 ${i * 42 + 22} 104 Z`} fill={i % 2 ? '#ff8a3a' : '#ffb03a'} opacity={0.9} />)}</g>}
      {fx.includes('embers') && <g fill="#ffb03a">{Array.from({ length: 12 }, (_, i) => <circle key={i} className="fx-rise" style={{ animationDelay: `${i * 0.25}s` }} cx={(i * 53) % 400} cy={110} r={1.4} />)}</g>}
      {fx.includes('sparkle') && <g fill="#ffe3a0">{Array.from({ length: 7 }, (_, i) => <path key={i} className="fx-twinkle" style={{ animationDelay: `${i * 0.3}s` }} d={`M${190 + ((i * 47) % 190)} ${24 + ((i * 29) % 60)} l1.2 -3.6 l1.2 3.6 l3.6 1.2 l-3.6 1.2 l-1.2 3.6 l-1.2 -3.6 l-3.6 -1.2 Z`} />)}</g>}
      {fx.includes('torches') && <g>{[30, 370].map((x) => <g key={x}><rect x={x - 2} y={50} width={4} height={14} fill="#6a4a2a" stroke={O} strokeWidth={0.8} /><path className="fx-flame" d={`M${x - 5} 50 Q${x - 6} 40 ${x} 32 Q${x + 6} 40 ${x + 5} 50 Z`} fill="#ffb03a" /><circle cx={x} cy={44} r={22} fill="#ff9a3a" opacity={0.12} /></g>)}</g>}
      {fx.includes('void') && <g>{Array.from({ length: 8 }, (_, i) => <circle key={i} className="fx-rise" style={{ animationDelay: `${i * 0.4}s` }} cx={(i * 61) % 400} cy={115} r={3} fill="#8f7bff" opacity={0.6} />)}</g>}
    </>
  );
}

// ---------- The cards ----------

const P = (a: Actor, x: number, more: Partial<Place> = {}): Place => ({ a, x, ...more });

const SCENES: Record<number, SceneDef & { steps?: Record<string, Partial<SceneDef>> }> = {
  1: { sky: 'night', fx: ['fog', 'stars'], actors: [P('ghost', 260, { y: 92, anim: 'float', s: 1.3 })] },
  2: { sky: 'dusk', actors: [P('sage', 270, { flip: true, anim: 'bob' })] },
  3: { sky: 'night', fx: ['stars'], actors: [P('wolfDark', 230, { flip: true, anim: 'prowl' }), P('wolf', 290, { flip: true, anim: 'prowl', s: 1.1 }), P('wolfDark', 350, { flip: true, anim: 'prowl', s: 0.9 })] },
  4: { sky: 'storm', fx: ['wind'], actors: [P('tree', 280, { anim: 'sway' }), P('tree', 350, { anim: 'sway', s: 0.8 })] },
  5: { sky: 'dusk', fx: ['sparkle'], actors: [P('rocks', 280), P('satyr', 280, { y: 90, flip: true, anim: 'bob' })] },
  6: { sky: 'day', actors: [P('flower', 270, { anim: 'sway', s: 1.4 }), P('flower', 310, { anim: 'sway', s: 0.9 })] },
  7: { sky: 'void', land: 'core', fx: ['void', 'quake'], actors: [P('darkBlob', 290, { anim: 'pulse', s: 1.2 })] },
  8: { sky: 'hell', fx: ['embers'], actors: [P('sunborn', 240, { flip: true, anim: 'bob' }), P('demonSmall', 300, { flip: true, anim: 'shake' }), P('imp', 350, { flip: true, anim: 'shake' })] },
  9: { sky: 'void', fx: ['void'], actors: [P('portal', 280, { anim: 'pulse', s: 1.3 })], steps: { aim: { fx: ['void', 'sparkle'] } } },
  10: { sky: 'storm', fx: ['rain', 'lightning', 'wind'], actors: [P('tree', 320, { anim: 'sway' })] },
  11: { sky: 'storm', land: 'mountains', fx: ['quake'], actors: [P('rocks', 270, { y: 70, anim: 'shake' }), P('rocks', 320, { y: 88, s: 0.8, anim: 'shake' }), P('rocks', 220, { s: 0.6, anim: 'shake' })] },
  12: { sky: 'dusk', actors: [P('wagon', 300, { flip: true }), P('bandit', 240, { anim: 'shake' }), P('bandit', 360, { flip: true, anim: 'shake' })] },
  13: { sky: 'night', fx: ['stars', 'sparkle'], actors: [P('pond', 280, { anim: 'pulse' })] },
  14: { sky: 'dusk', fx: ['fog'], actors: [P('tree', 320), P('woman', 290, { o: 0.45, anim: 'float', flip: true })] },
  15: { sky: 'day', actors: [P('merchant', 280, { flip: true, anim: 'bob' })], steps: { gift: { fx: ['sparkle'] } } },
  16: { sky: 'gold', fx: ['sparkle'], actors: [P('rocks', 300, { s: 2.2 }), P('goldTree', 300, { y: 64, s: 1.2, anim: 'sway' })] },
  17: { sky: 'dusk', fx: ['sparkle'], actors: [P('statue', 280, { flip: true, anim: 'pulse' })] },
  18: { sky: 'dusk', fx: ['fog'], actors: [P('sarcophagus', 280)], steps: { open: { sky: 'night', fx: ['greenfog'], actors: [P('sarcophagusOpen', 280, { anim: 'pulse' })] } } },
  19: { sky: 'dusk', actors: [P('stump', 280), P('myrmid', 320, { flip: true, anim: 'bob' })] },
  20: { sky: 'dusk', actors: [P('arrow', 180), P('archer', 320, { flip: true, o: 0.7 }), P('tree', 350), P('archer', 370, { flip: true, o: 0.5 })] },
  21: { sky: 'hell', fx: ['embers', 'fire'], actors: [P('demon', 290, { flip: true, anim: 'bob', s: 1.3 })] },
  22: { sky: 'dusk', fx: ['sparkle'], actors: [P('wagon', 320, { flip: true, o: 0.6 }), P('book', 250, { anim: 'pulse' })] },
  23: { sky: 'dusk', land: 'cave', actors: [P('caveMouth', 290)] },
  24: { sky: 'night', fx: ['stars', 'fog'], actors: [P('witch', 300, { flip: true, anim: 'float' })] },
  25: {
    sky: 'night', fx: ['stars'], actors: [P('campfire', 300, { s: 0.6, o: 0.8 })],
    steps: {
      camp: { actors: [P('campfire', 290), P('nomadSit', 250), P('nomadSit', 330, { flip: true }), P('nomadSit', 360, { flip: true, s: 0.9 })] },
      spotted: { actors: [P('campfire', 320), P('nomad', 250, { flip: true, anim: 'shake' }), P('nomad', 290, { flip: true, anim: 'shake' }), P('nomad', 360, { flip: true })] },
      learn: { fx: ['stars', 'sparkle'], actors: [P('campfire', 290), P('nomadSit', 250), P('nomadSit', 330, { flip: true })] },
    },
  },
  26: { sky: 'dusk', fx: ['sparkle'], actors: [P('tree', 300), P('book', 270, { anim: 'pulse' })] },
  27: { sky: 'night', land: 'core', fx: ['stars', 'fog'], actors: [P('moon', 330, { y: 30 }), P('skullCloud', 250, { y: 60, anim: 'float' })] },
  28: { sky: 'night', land: 'catacomb', fx: ['greenfog'], actors: [P('bones', 240), P('bones', 330, { flip: true })] },
  29: {
    sky: 'dusk', fx: ['embers'], actors: [P('anvil', 250), P('smith', 300, { flip: true, anim: 'bob' })],
    steps: { refused: { fx: [], actors: [P('anvil', 250), P('smith', 300, { anim: 'bob' })] }, choose: { fx: ['embers', 'sparkle'] } },
  },
  30: { sky: 'hell', fx: ['quake'], actors: [P('minotaur', 290, { flip: true, anim: 'shake', s: 1.2 })] },
  31: { sky: 'dusk', fx: ['fog'], actors: [P('hut', 290)] },
  33: { sky: 'day', land: 'mountains', fx: ['sparkle'], actors: [P('waterfall', 290)] },
  34: { sky: 'dusk', actors: [P('tower', 290)], steps: { top: { sky: 'night', fx: ['stars', 'sparkle'], actors: [P('tower', 290, { s: 1.4, y: 140 }), P('treasure', 290, { y: 70, anim: 'pulse' })] } } },
  35: { sky: 'hell', fx: ['fire', 'embers'], actors: [] },
  36: { sky: 'gold', land: 'fields', fx: ['sparkle'], actors: [P('stone', 280, { anim: 'pulse' })] },
  37: { sky: 'day', actors: [P('stump', 280), P('flintborn', 320, { flip: true, anim: 'bob' })] },
  38: { sky: 'cave', land: 'cave', actors: [P('boulder', 290)], steps: { treasure: { fx: ['sparkle'], actors: [P('caveMouth', 290), P('treasure', 290, { anim: 'pulse' })] } } },
  39: { sky: 'dusk', actors: [P('imp', 230, { flip: true, anim: 'shake' }), P('imp', 280, { anim: 'shake' }), P('imp', 330, { flip: true, anim: 'shake' }), P('imp', 370, { anim: 'shake', s: 0.8 })] },
  40: { sky: 'dusk', actors: [P('beastman', 270, { flip: true, anim: 'shake' }), P('beastman', 330, { flip: true, anim: 'bob' })] },
  42: { sky: 'dusk', actors: [P('chasm', 270, { y: 104, s: 1.4 })] },
  44: { sky: 'void', fx: ['quake', 'void'], actors: [P('rocks', 250, { anim: 'shake' }), P('darkBlob', 330, { s: 0.7, anim: 'pulse' })] },
  45: { sky: 'dusk', actors: [P('beast', 290, { flip: true, anim: 'shake' })] },
  46: { sky: 'day', actors: [P('snake', 260, { flip: true, anim: 'sway', s: 1.2 })] },
  47: { sky: 'day', actors: [P('keeper', 280, { flip: true, anim: 'bob' })] },
  48: { sky: 'day', fx: ['sparkle'], actors: [P('spikes', 220), P('spikes', 300), P('spikes', 370, { s: 0.8 })] },
  49: { sky: 'hell', fx: ['wind'], actors: [P('manticore', 290, { flip: true, anim: 'bob' })] },
  50: { sky: 'dusk', fx: ['sparkle'], actors: [P('chests', 290, { s: 1.4 })] },
  51: { sky: 'dusk', actors: [P('pack', 250), P('imp', 300, { flip: true, anim: 'shake' })] },
  52: { sky: 'dusk', land: 'mountains', fx: ['fog'], actors: [P('boneBridge', 280, { y: 100 }), P('treasure', 372, { y: 100, s: 0.7, anim: 'pulse' })] },
  53: { sky: 'dusk', fx: ['sparkle'], actors: [P('stump', 300), P('bard', 300, { y: 102, flip: true, anim: 'bob' }), P('lute', 290, { y: 96 })] },
  54: { sky: 'dusk', actors: [P('scales', 260, { s: 1.2 }), P('keeper', 320, { flip: true, anim: 'bob' })] },
  55: { sky: 'night', fx: ['stars'], actors: [P('constellation', 270, { y: 34, s: 1.1 })] },
  56: { sky: 'night', fx: ['stars'], actors: [P('campfire', 290), P('dice', 260), P('nomadSit', 330, { flip: true, anim: 'bob' })] },
  57: { sky: 'night', land: 'forest', actors: [P('fireflies', 280, { y: 96 })] },
  58: { sky: 'day', land: 'monument', fx: ['sparkle'], actors: [P('fresco', 280)] },
  // The town deck.
  600: { sky: 'day', land: 'city', actors: [P('brute', 250, { anim: 'shake' }), P('bruteB', 285, { flip: true, anim: 'shake' }), P('woman', 340, { flip: true, s: 0.9, anim: 'bob' }), P('merchant', 370, { flip: true, s: 0.85 })] },
  601: { sky: 'day', land: 'village', actors: [P('wagon', 320, { s: 0.9 }), P('pedlar', 270, { flip: true, anim: 'bob' })] },
  602: { sky: 'night', land: 'city', fx: ['fog'], actors: [P('hooded', 300, { flip: true, anim: 'sway' })], steps: { offer: { fx: ['fog', 'sparkle'] } } },
  603: { sky: 'day', land: 'city', actors: [P('merchant', 250, { flip: true, s: 0.9 }), P('urchin', 330, { anim: 'prowl' })] },
  604: { sky: 'dusk', land: 'inn', actors: [P('barrel', 250), P('flintborn', 300, { flip: true, anim: 'bob' }), P('barrel', 350)] },
  605: { sky: 'dusk', land: 'inn', fx: ['sparkle'], actors: [P('bard', 290, { flip: true, anim: 'bob' }), P('barrel', 345)] },
  606: { sky: 'night', land: 'inn', actors: [P('dice', 260), P('nomadSit', 320, { flip: true, anim: 'bob' })] },
  607: { sky: 'dusk', land: 'village', fx: ['fire', 'embers'], actors: [P('hut', 300, { s: 1.3 }), P('woman', 240, { flip: true, anim: 'shake', s: 0.9 })] },
  608: { sky: 'day', land: 'village', actors: [P('hut', 300, { s: 1.3 }), P('cat', 298, { y: 42, anim: 'sway' }), P('woman', 240, { flip: true, anim: 'bob', s: 0.9 })] },
  609: { sky: 'day', land: 'city', actors: [P('guard', 260, { flip: true }), P('guard', 300, { flip: true, anim: 'bob' }), P('guard', 340, { flip: true })] },
  610: { sky: 'dusk', land: 'village', fx: ['sparkle'], actors: [P('barrel', 260), P('seer', 300, { flip: true, anim: 'sway' })] },
  611: { sky: 'cave', land: 'inn', actors: [P('barrel', 250), P('barrel', 272), P('rat', 320, { anim: 'prowl' }), P('rat', 350, { anim: 'prowl', s: 0.8 })] },
  612: { sky: 'dusk', land: 'inn', actors: [P('barrel', 250), P('brute', 310, { flip: true, anim: 'shake' })] },
  613: { sky: 'day', land: 'city', actors: [P('archer', 240), P('target', 350)] },
  614: { sky: 'dusk', land: 'city', fx: ['stars'], actors: [P('beggar', 300, { flip: true, anim: 'sway' })] },
  615: { sky: 'storm', land: 'village', fx: ['rain'], actors: [P('wagon', 300, { y: 118 }), P('driver', 350, { flip: true, anim: 'shake' })] },
  700: { sky: 'night', fx: ['stars'], actors: [P('campfire', 300), P('bandit', 260, { flip: true, anim: 'bob' }), P('bandit', 345, { flip: true, anim: 'shake' })] },
  701: { sky: 'dusk', actors: [P('bones', 250), P('beastman', 310, { flip: true, anim: 'shake', s: 1.2 })] },
  702: { sky: 'night', fx: ['greenfog'], actors: [P('hut', 340), P('witch', 280, { flip: true, anim: 'sway' })] },
  900: { sky: 'dusk', fx: ['sparkle'], actors: [P('book', 290, { anim: 'pulse', s: 1.5 })] },
  901: { sky: 'night', fx: ['sparkle', 'stars'], actors: [P('book', 290, { anim: 'pulse', s: 1.5 })] },
  902: { sky: 'dusk', land: 'mountains', fx: ['sparkle'], actors: [P('book', 290, { anim: 'pulse', s: 1.5 })] },
};

/** Dungeon rooms: by the kind of room (the last two digits of the card), on the dungeon's own stone. */
const ROOMS: Record<number, SceneDef> = {
  1: { sky: 'cave', land: 'dungeon', actors: [P('spikes', 280), P('pendulum', 300, { anim: 'sway' })] },
  2: { sky: 'cave', land: 'dungeon', fx: ['sparkle'], actors: [P('plates', 290, { s: 1.5 })] },
  3: { sky: 'cave', land: 'dungeon', actors: [P('statue', 290, { flip: true, anim: 'pulse' })] },
  4: { sky: 'cave', land: 'dungeon', actors: [P('bandit', 260, { flip: true }), P('bandit', 320, { flip: true })] },
  5: { sky: 'cave', land: 'dungeon', fx: ['fog'], actors: [P('rocks', 290)] },
  6: { sky: 'cave', land: 'dungeon', fx: ['sparkle'], actors: [P('altar', 290, { anim: 'pulse' })] },
  7: { sky: 'cave', land: 'dungeon', fx: ['sparkle'], actors: [P('treasure', 290)] },
  8: { sky: 'hell', land: 'dungeon', fx: ['embers'], actors: [P('demon', 290, { flip: true, anim: 'bob', s: 1.3 })] },
  9: { sky: 'cave', land: 'dungeon', actors: [P('bandit', 250, { flip: true, anim: 'bob' }), P('bandit', 300, { flip: true, anim: 'bob' }), P('bandit', 350, { flip: true, anim: 'bob' })] },
  10: { sky: 'gold', land: 'dungeon', fx: ['sparkle'], actors: [P('treasure', 260, { s: 1.3 }), P('treasure', 320)] },
};
const THEME_ROOMS: Record<number, Partial<Record<number, SceneDef>>> = {
  10: { 5: { sky: 'cave', land: 'dungeon', fx: ['sparkle'], actors: [P('rocks', 290, { s: 1.2 })] }, 8: { sky: 'cave', land: 'dungeon', actors: [P('statue', 290, { flip: true, anim: 'shake', s: 1.3 })] } },
  11: { 1: { sky: 'cave', land: 'dungeon', actors: [P('web', 290, { y: 70 })] }, 5: { sky: 'cave', land: 'dungeon', actors: [P('web', 270, { y: 70 }), P('web', 330, { y: 60, s: 0.7 })] }, 8: { sky: 'cave', land: 'dungeon', actors: [P('web', 290, { y: 60 }), P('spider', 290, { flip: true, anim: 'prowl', s: 1.6 })] } },
  12: { 5: { sky: 'cave', land: 'dungeon', fx: ['fog'], actors: [P('pond', 290, { s: 1.4 })] }, 8: { sky: 'night', land: 'dungeon', fx: ['fog'], actors: [P('pond', 290, { s: 1.4 }), P('woman', 290, { y: 96, o: 0.7, anim: 'float' })] } },
  13: { 5: { sky: 'cave', land: 'catacomb', actors: [P('sarcophagus', 230, { s: 0.7 }), P('sarcophagus', 290, { s: 0.7 }), P('sarcophagus', 350, { s: 0.7 })] }, 8: { sky: 'cave', land: 'catacomb', fx: ['greenfog'], actors: [P('mummy', 290, { flip: true, anim: 'bob', s: 1.3 })] } },
  14: { 1: { sky: 'void', land: 'dungeon', fx: ['void'], actors: [P('portal', 290, { anim: 'pulse' })] }, 5: { sky: 'void', land: 'dungeon', fx: ['void'], actors: [P('altar', 290), P('darkBlob', 290, { y: 70, s: 0.6, anim: 'pulse' })] }, 8: { sky: 'void', land: 'dungeon', fx: ['void'], actors: [P('demon', 290, { flip: true, anim: 'bob', s: 1.3 })] } },
};

function sceneFor(card: number, step: string): SceneDef | null {
  if (card >= 1000) {
    const theme = Math.floor(card / 100);
    const kind = card % 100 >= 10 ? 10 : card % 100;
    return THEME_ROOMS[theme]?.[kind] ?? ROOMS[kind] ?? null;
  }
  const base = SCENES[card];
  if (!base) return null;
  const over = base.steps?.[step];
  return over ? { ...base, ...over } : base;
}

/** Figures are drawn about 50 units tall; on the card they read better a little bigger. */
const ZOOM = 1.25;

const ANIM: Record<Anim, string> = {
  bob: 'sc-bob', sway: 'sc-sway', float: 'sc-float', flicker: 'sc-flicker', pulse: 'sc-pulse', prowl: 'sc-prowl', shake: 'sc-shake', spin: 'sc-spin',
};

export interface SceneHero { race: RaceId; profession: ProfessionId; look?: HeroLook }

/** The picture at the top of an event card. */
export function EventScene({ card, step, terrain, hostile, hero }: { card: number; step: string; terrain: TerrainId | 'core' | null; hostile: boolean; hero?: SceneHero }) {
  const scene = sceneFor(card, step);
  const land: Land = scene?.land ?? terrain ?? 'fields';
  const sky = SKY[scene?.sky ?? (hostile ? 'hell' : 'dusk')];
  const fx: Fx[] = [...(scene?.fx ?? []), ...(land === 'dungeon' || land === 'catacomb' ? ['torches' as const] : [])];
  const gid = `sky-${card}`;
  return (
    <div className={`ev-scene ${fx.includes('quake') ? 'sc-quake' : ''}`}>
      <svg viewBox="0 0 400 130" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky[0]} />
            <stop offset="100%" stopColor={sky[1]} />
          </linearGradient>
        </defs>
        <rect width={400} height={130} fill={`url(#${gid})`} />
        <Backdrop land={land} />
        {scene?.actors.map((p, i) => (
          <g key={`${step}-${i}`} transform={`translate(${p.x} ${p.y ?? 112}) scale(${(p.flip ? -1 : 1) * (p.s ?? 1) * ZOOM} ${(p.s ?? 1) * ZOOM})`} opacity={p.o ?? 1}>
            <g className={p.anim ? ANIM[p.anim] : undefined} style={{ animationDelay: `${(i * 0.37) % 1.2}s` }}>{ACTORS[p.a]}</g>
          </g>
        ))}
        <Effects fx={fx} />
        <rect width={400} height={130} fill="url(#ev-vignette)" />
        <defs>
          <radialGradient id="ev-vignette" cx="50%" cy="45%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
          </radialGradient>
        </defs>
      </svg>
      {hero && (scene?.hero ?? true) && (
        <span className="ev-scene-hero"><HeroArt race={hero.race} profession={hero.profession} look={hero.look} size={44} /></span>
      )}
    </div>
  );
}
