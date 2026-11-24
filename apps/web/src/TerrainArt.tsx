import type { ReactNode } from 'react';
import type { TerrainId } from '@hp/content';

/** Ground colours per fragment: base, a lighter patch and a darker detail. */
const GROUND: Record<TerrainId | 'core', [string, string, string]> = {
  forest: ['#24502e', '#2f6a3a', '#163620'],
  mountains: ['#5d6170', '#7c8090', '#3c3f4b'],
  fields: ['#7f8c3c', '#a2ad52', '#5f6a2a'],
  river: ['#3d6b3a', '#4a7d45', '#2b4f2a'],
  lake: ['#3d6b3a', '#4a7d45', '#2b4f2a'],
  desert: ['#c09a52', '#d8b56a', '#93723a'],
  inn: ['#5c7a3e', '#6e8e4a', '#3e5a2a'],
  monument: ['#55606a', '#6d7a84', '#3a424a'],
  cave: ['#4a4448', '#625a60', '#2a2428'],
  village: ['#6a8a42', '#7d9e50', '#4a6a2e'],
  city: ['#7a7258', '#948a6c', '#55503e'],
  core: ['#120c22', '#241a3e', '#06040c'],
};

/** A tiny repeatable random from the fragment's index, so every tile looks a bit different but never flickers. */
function jitter(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s % 1000) / 1000;
  };
}

const Tree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-1} y={2} width={2} height={3} fill="#4a2e18" />
    <polygon points="0,-7 5,1 -5,1" fill="#1d4a26" />
    <polygon points="0,-9 4,-2 -4,-2" fill="#2f7040" />
    <polygon points="0,-10 2,-6 -2,-6" fill="#4a9a5a" />
  </g>
);

const Peak = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <polygon points="0,-11 10,6 -10,6" fill="#3e4250" />
    <polygon points="0,-11 10,6 2,6" fill="#2c2f3a" />
    <polygon points="0,-11 4,-4 1,-5 -1,-3 -4,-4" fill="#eef2f8" />
  </g>
);

const House = ({ x, y, roof = '#9a3a2a', s = 1 }: { x: number; y: number; roof?: string; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-4} y={-2} width={8} height={6} fill="#d8c8a0" />
    <polygon points="-5,-2 0,-7 5,-2" fill={roof} />
    <rect x={-1} y={1} width={2} height={3} fill="#4a2e18" />
  </g>
);

function art(terrain: TerrainId | 'core', r: () => number): ReactNode {
  const [, light, dark] = GROUND[terrain];
  const spots = (n: number, fill: string, w = 2, h = 1) =>
    Array.from({ length: n }, (_, i) => <rect key={`s${i}`} x={Math.floor(r() * 38)} y={Math.floor(r() * 38)} width={w} height={h} fill={fill} />);
  switch (terrain) {
    case 'forest':
      return (<>
        {spots(6, light, 3, 2)}
        {[[9, 13], [24, 11], [16, 22], [31, 24], [7, 31], [23, 34]].map(([x, y], i) => <Tree key={i} x={x! + Math.round(r() * 3)} y={y!} s={0.9 + r() * 0.3} />)}
      </>);
    case 'mountains':
      return (<>
        {spots(5, dark, 3, 1)}
        <Peak x={13} y={22} s={1.1} />
        <Peak x={28} y={28} s={0.9} />
        <Peak x={27} y={13} s={0.6} />
      </>);
    case 'fields':
      return (<>
        {[4, 10, 16, 22, 28, 34].map((y, i) => <rect key={i} x={0} y={y} width={40} height={2} fill={i % 2 ? dark : light} />)}
        {spots(10, '#e8d870', 1, 2)}
      </>);
    case 'river': {
      const bend = 10 + Math.round(r() * 8);
      return (<>
        {spots(5, light, 3, 2)}
        <path d={`M ${bend} -2 C ${bend + 14} 10, ${bend - 8} 24, ${bend + 6} 42`} stroke="#2a6a9a" strokeWidth={9} fill="none" />
        <path d={`M ${bend} -2 C ${bend + 14} 10, ${bend - 8} 24, ${bend + 6} 42`} stroke="#4a9ad0" strokeWidth={5} fill="none" />
        <path d={`M ${bend + 1} 6 l 3 0 M ${bend + 2} 24 l 3 0`} stroke="#c8ecff" strokeWidth={1} />
      </>);
    }
    case 'lake':
      return (<>
        {spots(4, light, 3, 2)}
        <ellipse cx={20} cy={21} rx={15} ry={11} fill="#2a6a9a" />
        <ellipse cx={19} cy={20} rx={12} ry={8} fill="#3d88c0" />
        <rect x={12} y={17} width={5} height={1} fill="#c8ecff" />
        <rect x={22} y={23} width={4} height={1} fill="#c8ecff" />
        <rect x={6} y={30} width={1} height={4} fill="#5a8a3a" /><rect x={8} y={29} width={1} height={5} fill="#5a8a3a" />
      </>);
    case 'desert':
      return (<>
        <path d="M -2 16 Q 10 10 22 16 T 44 15" stroke={light} strokeWidth={3} fill="none" />
        <path d="M -2 30 Q 12 24 24 30 T 44 29" stroke={dark} strokeWidth={2} fill="none" />
        <g transform={`translate(${26 + Math.round(r() * 6)} 24)`}>
          <rect x={-1} y={-6} width={3} height={10} fill="#4a7a3a" />
          <rect x={-4} y={-3} width={2} height={4} fill="#4a7a3a" /><rect x={-3} y={0} width={2} height={1} fill="#4a7a3a" />
          <rect x={3} y={-4} width={2} height={3} fill="#4a7a3a" />
        </g>
      </>);
    case 'inn':
      return (<>
        {spots(5, light, 3, 2)}
        <rect x={8} y={18} width={22} height={13} fill="#8a5a32" />
        <polygon points="5,18 19,8 33,18" fill="#5a2a1a" />
        <rect x={17} y={24} width={4} height={7} fill="#2a1a10" />
        <rect x={11} y={21} width={3} height={3} fill="#ffd070" /><rect x={25} y={21} width={3} height={3} fill="#ffd070" />
        <rect x={31} y={14} width={1} height={8} fill="#2a1a10" /><rect x={32} y={15} width={5} height={3} fill="#c89a5a" />
      </>);
    case 'monument':
      return (<>
        {spots(4, light, 3, 2)}
        <rect x={11} y={30} width={18} height={4} fill="#8a8a9a" />
        <polygon points="16,30 20,6 24,30" fill="#a8a8ba" />
        <polygon points="20,6 24,30 21,30" fill="#7a7a8c" />
        <rect x={19} y={14} width={2} height={2} fill="#c9a7ff" />
      </>);
    case 'cave':
      return (<>
        {spots(4, light, 3, 2)}
        <path d="M 2 36 Q 6 8 20 6 Q 34 8 38 36 Z" fill="#6a6268" />
        <path d="M 10 36 Q 12 18 20 16 Q 28 18 30 36 Z" fill="#0a080c" />
        <polygon points="14,17 15,21 16,17" fill="#6a6268" /><polygon points="23,17 24,22 25,17" fill="#6a6268" />
      </>);
    case 'village':
      return (<>
        {spots(4, light, 3, 2)}
        <path d="M -2 30 Q 20 22 42 30" stroke="#a08a5a" strokeWidth={3} fill="none" />
        <House x={10} y={16} /><House x={28} y={14} roof="#7a5a2a" /><House x={20} y={30} roof="#8a3a2a" s={0.9} />
      </>);
    case 'city':
      return (<>
        <rect x={3} y={14} width={34} height={22} fill="#8a8270" />
        <rect x={3} y={12} width={34} height={2} fill="#a8a088" />
        {[3, 9, 15, 21, 27, 33].map((x) => <rect key={x} x={x} y={10} width={3} height={2} fill="#a8a088" />)}
        <rect x={5} y={4} width={7} height={14} fill="#9a927c" /><polygon points="4,4 8.5,-2 13,4" fill="#3a4a8a" />
        <rect x={28} y={4} width={7} height={14} fill="#9a927c" /><polygon points="27,4 31.5,-2 36,4" fill="#3a4a8a" />
        <path d="M 16 36 L 16 26 Q 20 21 24 26 L 24 36 Z" fill="#2a2018" />
        <rect x={19} y={2} width={1} height={8} fill="#2a2018" /><polygon points="20,2 26,4 20,6" fill="#e0b040" />
      </>);
    case 'core':
      return (<>
        <circle cx={20} cy={20} r={14} fill="#2a1a4a" />
        <circle cx={20} cy={20} r={9} fill="#06040c" />
        {spots(8, '#8f7bff', 1, 1)}
      </>);
  }
}

/** A small painted picture of a fragment, drawn behind its name on the board. */
export function TerrainArt({ terrain, seed }: { terrain: TerrainId | 'core'; seed: number }) {
  const r = jitter(seed + 1);
  return (
    <svg className="terrain-art" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={40} height={40} fill={GROUND[terrain][0]} />
      {art(terrain, r)}
    </svg>
  );
}
