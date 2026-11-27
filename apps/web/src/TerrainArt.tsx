import type { ReactNode } from 'react';
import type { TerrainId } from '@hp/content';

/**
 * Fragment pictures after Jacob's pencil sketches (2026-11-27): one clear motif per tile, drawn
 * with flat shapes and an ink line, on a calm ground. The lower part stays quiet for the action icons.
 */

/** Ground colours per fragment: base and a lighter top for a soft sky-to-ground fade. */
const GROUND: Record<TerrainId | 'core', [string, string]> = {
  forest: ['#2b5236', '#3a6a46'],
  mountains: ['#525a6a', '#6c7486'],
  fields: ['#7c8a3e', '#98a656'],
  river: ['#3a6844', '#4c7e54'],
  lake: ['#3a6844', '#4c7e54'],
  desert: ['#c39f58', '#dcbc78'],
  inn: ['#56723e', '#6a8a4e'],
  monument: ['#535d68', '#6b7682'],
  cave: ['#48424a', '#5e575f'],
  village: ['#62803f', '#789a52'],
  city: ['#726a52', '#8c846a'],
  core: ['#120c22', '#1e1636'],
};

const INK = '#1a1424';
const line = { stroke: INK, strokeWidth: 0.9, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const Pine = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-0.9} y={0} width={1.8} height={3} fill="#5a3a22" {...line} />
    <path d="M0 -13 L6 -3 L3.5 -3 L7 1.5 L-7 1.5 L-3.5 -3 L-6 -3 Z" fill="#1f5a32" {...line} />
    <path d="M0 -13 L6 -3 L3.5 -3 L7 1.5 L0 1.5 Z" fill="#174628" />
    <path d="M0 -13 L-2.2 -9.4" stroke="#7fc08a" strokeWidth={0.8} strokeLinecap="round" />
  </g>
);

const House = ({ x, y, roof = '#a04632', s = 1 }: { x: number; y: number; roof?: string; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-5} y={-4} width={10} height={8} fill="#e2d4ae" {...line} />
    <path d="M-6.5 -4 L0 -10 L6.5 -4 Z" fill={roof} {...line} />
    <rect x={-1.2} y={0} width={2.4} height={4} fill="#4a2e1a" />
    <rect x={2.2} y={-2.4} width={1.8} height={1.8} fill="#ffd27a" />
  </g>
);

function art(terrain: TerrainId | 'core'): ReactNode {
  switch (terrain) {
    case 'forest':
      return (<>
        <Pine x={13} y={25} s={0.95} />
        <Pine x={27} y={26} s={0.9} />
        <Pine x={20} y={29} s={1.15} />
      </>);
    case 'mountains':
      return (<>
        <path d="M4 30 L15 11 L26 30 Z" fill="#7d8496" {...line} />
        <path d="M15 11 L26 30 L18 30 Z" fill="#5e6576" />
        <path d="M15 11 L18.2 16.6 L16.4 16 L15 17.6 L13.4 16 L11.8 16.6 Z" fill="#f2f5fa" {...line} />
        <path d="M17 30 L27 14 L37 30 Z" fill="#8c93a4" {...line} />
        <path d="M27 14 L37 30 L30 30 Z" fill="#6a7184" />
        <path d="M27 14 L29.8 18.6 L28.2 18 L27 19.4 L25.6 18 L24.2 18.6 Z" fill="#f2f5fa" {...line} />
      </>);
    case 'fields':
      return (<>
        {/* A plot split by a diagonal, furrows running two ways, sprouts along the top (Jacob's sketch). */}
        <path d="M7 12 L33 12 L33 30 L7 30 Z" fill="#b8bd62" {...line} />
        <path d="M33 12 L33 30 L11 30 Z" fill="#a5ab4e" />
        <g stroke="#6e7430" strokeWidth={0.8} strokeLinecap="round">
          <path d="M9 15 L18 12.5 M9 19 L21 15.6 M9 23 L22 19.4 M9 27 L17 24.8" />
          <path d="M21 30 L31 16 M26 30 L33 20 M16 30 L28 13.4" />
        </g>
        <path d="M7 12 L33 12 L33 30 L7 30 Z" fill="none" {...line} />
        <path d="M11 30 L33 12" fill="none" {...line} />
        {[10, 15.5, 21, 26.5, 31].map((x) => (
          <g key={x} transform={`translate(${x} 11)`}>
            <path d="M0 0 L0 -3" stroke="#2f5a22" strokeWidth={0.8} />
            <ellipse cx={-1.1} cy={-3.2} rx={1.2} ry={0.8} fill="#4f8a32" transform="rotate(-30 -1.1 -3.2)" />
            <ellipse cx={1.1} cy={-3.2} rx={1.2} ry={0.8} fill="#4f8a32" transform="rotate(30 1.1 -3.2)" />
          </g>
        ))}
      </>);
    case 'river':
      return (<>
        <path d="M-1 22 C 8 17, 16 26, 26 21 S 38 18, 41 20 L41 29 C 34 27, 30 31, 22 30 S 6 26, -1 31 Z" fill="#3f8cc4" {...line} />
        <path d="M3 25 C 9 23, 13 27, 19 25 M22 26 C 27 24, 31 26, 36 24" stroke="#c8ecff" strokeWidth={0.8} fill="none" strokeLinecap="round" />
        {/* Stepping stones above the water and reeds by the bank (Jacob's sketch). */}
        {[[10, 14], [17, 13], [24, 14], [14, 18], [21, 17.5]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={2.6} ry={1.3} fill="#8a8a92" {...line} />)}
        {[30, 32, 34, 36].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 35 L${x + (i % 2 ? 0.6 : -0.4)} ${28 - (i % 2) * 1.5}`} stroke="#2f5a22" strokeWidth={0.8} />
            <rect x={x - 0.7 + (i % 2 ? 0.6 : -0.4)} y={26.4 - (i % 2) * 1.5} width={1.4} height={3} rx={0.7} fill="#6a4226" />
          </g>
        ))}
      </>);
    case 'lake':
      return (<>
        <ellipse cx={20} cy={21} rx={15} ry={9} fill="#3f8cc4" {...line} />
        <path d="M11 19 q3 -1.5 6 0 M21 23 q3 -1.5 6 0 M15 26 q2 -1 4 0" stroke="#c8ecff" strokeWidth={0.8} fill="none" strokeLinecap="round" />
        {[6, 8, 10].map((x, i) => <path key={x} d={`M${x} 31 L${x + i * 0.4 - 0.4} ${25 - i}`} stroke="#2f5a22" strokeWidth={0.9} strokeLinecap="round" />)}
      </>);
    case 'desert':
      return (<>
        {/* A sun over low dunes (Jacob's sketch). */}
        <g transform="translate(12 12)" stroke="#a8641e" strokeWidth={0.9} strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <path key={i} d={`M${Math.cos(a) * 4.6} ${Math.sin(a) * 4.6} L${Math.cos(a) * 7} ${Math.sin(a) * 7}`} />;
          })}
          <circle r={3.3} fill="#ffe08a" />
        </g>
        <path d="M-1 27 C 6 22, 12 22, 18 25 S 30 21, 41 24 L41 41 L-1 41 Z" fill="#dcb46a" {...line} />
        <path d="M-1 33 C 8 29, 16 30, 22 32 S 34 30, 41 31" fill="none" {...line} />
      </>);
    case 'inn':
      return (<>
        <rect x={9} y={17} width={20} height={13} fill="#a06a3a" {...line} />
        <path d="M6.5 17 L19 8 L31.5 17 Z" fill="#5a2a1a" {...line} />
        <rect x={17} y={23} width={4} height={7} fill="#2a1a10" />
        <rect x={11.5} y={20} width={3.2} height={3.2} fill="#ffd070" {...line} />
        <rect x={23.5} y={20} width={3.2} height={3.2} fill="#ffd070" {...line} />
        <path d="M31 13 L31 23 M31 14 L36 14" stroke={INK} strokeWidth={0.9} />
        <rect x={32.4} y={15} width={3.6} height={3} fill="#e0b25c" {...line} />
      </>);
    case 'monument':
      return (<>
        {/* An obelisk with glyphs on a stepped base (Jacob's sketch). */}
        <rect x={12} y={28} width={16} height={3.4} fill="#5a5f6a" {...line} />
        <rect x={14} y={25.4} width={12} height={2.8} fill="#7a808c" {...line} />
        <path d="M16.5 25.4 L17.4 9 L20 5.5 L22.6 9 L23.5 25.4 Z" fill="#b8bcc8" {...line} />
        <path d="M20 5.5 L22.6 9 L23.5 25.4 L20.6 25.4 Z" fill="#9196a4" />
        <g stroke="#4a3a7a" strokeWidth={0.8} strokeLinecap="round" fill="none">
          <path d="M19.2 11 L19.2 13.6 M20.8 11 L20.8 13.6" />
          <path d="M19 16 L21 16 L21 17.6 L19 17.6 L19 19.2 L21 19.2" />
          <path d="M19 22 L21 22" />
        </g>
        <circle cx={20} cy={8.6} r={0.8} fill="#c9a7ff" />
      </>);
    case 'cave':
      return (<>
        {/* A rock with a dark mouth and boulders at its foot (Jacob's sketch). */}
        <path d="M5 31 L8 19 L13 12 L19 8 L25 10 L30 15 L34 23 L35 31 Z" fill="#7a727a" {...line} />
        <path d="M25 10 L30 15 L34 23 L35 31 L28 31 Z" fill="#665e66" />
        <path d="M14 31 L14 23 Q 14 18 19.5 17 Q 25 18 25 23 L25 31 Z" fill="#0d0a10" {...line} />
        <path d="M3 31 L5 27.5 L9 27 L11 31 Z" fill="#8a828a" {...line} />
        <path d="M28 31 L30 27 L34 26.5 L37 31 Z" fill="#8a828a" {...line} />
      </>);
    case 'village':
      return (<>
        <path d="M-1 31 Q 20 25 41 31" stroke="#b89a62" strokeWidth={2.6} fill="none" />
        <House x={12} y={20} />
        <House x={28} y={18} roof="#7a5a2a" s={0.9} />
      </>);
    case 'city':
      return (<>
        <rect x={5} y={16} width={30} height={14} fill="#a49a80" {...line} />
        {[5, 10, 15, 20, 25, 30].map((x) => <rect key={x} x={x} y={13.6} width={2.6} height={2.4} fill="#a49a80" {...line} />)}
        <rect x={6} y={9} width={7} height={21} fill="#b4aa90" {...line} />
        <path d="M5 9 L9.5 3.5 L14 9 Z" fill="#3a4a8a" {...line} />
        <rect x={27} y={9} width={7} height={21} fill="#b4aa90" {...line} />
        <path d="M26 9 L30.5 3.5 L35 9 Z" fill="#3a4a8a" {...line} />
        <path d="M16.5 30 L16.5 23 Q 20 19 23.5 23 L23.5 30 Z" fill="#2a2018" {...line} />
      </>);
    case 'core':
      return (<>
        <circle cx={20} cy={20} r={13} fill="#2a1a4a" />
        <circle cx={20} cy={20} r={8.5} fill="#06040c" />
        <path d="M20 9 A 11 11 0 0 1 31 20" stroke="#8f7bff" strokeWidth={1} fill="none" strokeLinecap="round" />
        <path d="M20 31 A 11 11 0 0 1 9 20" stroke="#8f7bff" strokeWidth={1} fill="none" strokeLinecap="round" />
      </>);
  }
}

/** A picture of a fragment, drawn behind its name on the board. */
export function TerrainArt({ terrain }: { terrain: TerrainId | 'core'; seed?: number }) {
  const [base, top] = GROUND[terrain];
  const id = `tg-${terrain}`;
  return (
    <svg className="terrain-art" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={base} />
        </linearGradient>
      </defs>
      <rect width={40} height={40} fill={`url(#${id})`} />
      <ellipse cx={20} cy={20} rx={16} ry={14} fill="#fff" opacity={0.07} />
      <g transform="translate(2.4 1) scale(0.88)">{art(terrain)}</g>
    </svg>
  );
}

/** The main ground colour of a terrain, for small swatches. */
export const terrainColour = (terrain: TerrainId | 'core') => GROUND[terrain][0];
