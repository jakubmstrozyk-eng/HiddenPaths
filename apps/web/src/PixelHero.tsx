import { useEffect, useState } from 'react';
import type { EnemyKind, RaceId } from '@hp/content';

/** Placeholder 12×12 pixel hero, tinted per race. Real sprites with walk frames replace this later. */
const PALETTE: Record<RaceId, { skin: string; cloth: string; accent: string }> = {
  nomads: { skin: '#d9a066', cloth: '#8a6f3e', accent: '#e8d5a3' },
  myrmids: { skin: '#5fb3b3', cloth: '#2f5d7c', accent: '#a9e4e4' },
  humans: { skin: '#e8b796', cloth: '#7a3b3b', accent: '#d4af37' },
  sunborn: { skin: '#c98a3a', cloth: '#e0c068', accent: '#7a4a1a' },
  keepers: { skin: '#9fc28a', cloth: '#3f6b3a', accent: '#d8f0b0' },
  flintborn: { skin: '#8a8f98', cloth: '#4a4e57', accent: '#c7ccd6' },
};

// . empty, s skin, c cloth, a accent, e eye, d dark outline
const SPRITE = [
  '....dddd....',
  '...dssssd...',
  '...dseesd...',
  '...dssssd...',
  '....dccd....',
  '..dccaaccd..',
  '.dscccccccsd',
  '.dsdccccdsd.',
  '...dccccd...',
  '...dcddcd...',
  '...dcd.dcd..',
  '...dd...dd..',
];

// Walk cycle: the last three rows (legs) swap between a stride and legs together.
const STRIDE = ['...dcddcd...', '..dcd...dcd.', '..dd.....dd.'];
const PASS = ['...dccccd...', '....dccd....', '....dddd....'];

export function PixelHero({ race, size = 48, walking = false, facing = 1 }: { race: RaceId; size?: number; walking?: boolean; facing?: 1 | -1 }) {
  const p = PALETTE[race];
  const colour: Record<string, string> = { s: p.skin, c: p.cloth, a: p.accent, e: '#111', d: '#0b0b10' };
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 130);
    return () => clearInterval(timer);
  }, [walking]);
  const rows = walking ? [...SPRITE.slice(0, 9), ...(frame === 0 ? STRIDE : PASS)] : SPRITE;
  return (
    <svg
      width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true"
      className={walking ? 'walking' : undefined}
      style={facing === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour[ch]} />,
        ),
      )}
    </svg>
  );
}

/** Placeholder foe sprites, one shape per kind of enemy. */
const FOES: Record<EnemyKind, { rows: string[]; body: string; accent: string }> = {
  beast: { body: '#8a5a3a', accent: '#e8c9a0', rows: [
    '............',
    '.dd.........',
    'dbbd....dd..',
    'dbebddddbbd.',
    'dbbbbbbbbbbd',
    '.daabbbbbbbd',
    '..dbbbbbbbd.',
    '..dbbbbbbbd.',
    '..db.dd.bd..',
    '..db.d..bd..',
    '..dd.d..dd..',
    '............',
  ] },
  demon: { body: '#7a2a5a', accent: '#ffb030', rows: [
    '.d........d.',
    '.dd......dd.',
    '..dbbbbbbd..',
    '..dbebbebd..',
    '..dbbbbbbd..',
    '...dbaabd...',
    '.ddbbbbbbdd.',
    'dbdbbbbbbdbd',
    'd..dbbbbd..d',
    '...dbddbd...',
    '...dbd.dbd..',
    '...dd...dd..',
  ] },
  thug: { body: '#5a5a6a', accent: '#c0c0c8', rows: [
    '....dddd....',
    '...dbbbbd...',
    '..dbdddddb..',
    '..dbdeedbd..',
    '...dbbbbd...',
    '..dbbaabbd..',
    '.dbbbbbbbbd.',
    '.dadbbbbdad.',
    '...dbbbbd...',
    '...dbddbd...',
    '...dbd.dbd..',
    '...dd...dd..',
  ] },
  wraith: { body: '#8aa0b8', accent: '#e0f0ff', rows: [
    '....dddd....',
    '...dbbbbd...',
    '..dbebbebd..',
    '..dbbbbbbd..',
    '..dbbddbbd..',
    '.dbbbbbbbbd.',
    'dbabbbbbbabd',
    '.dbbbbbbbbd.',
    '..dbbbbbbd..',
    '..dbdbbdbd..',
    '...d.dd.d...',
    '............',
  ] },
  human: { body: '#9a7a4a', accent: '#e8d5a3', rows: [
    '....dddd....',
    '...daaaad...',
    '...daeead...',
    '...daaaad...',
    '....dbbd....',
    '..dbbaabbd..',
    '.dabbbbbbad.',
    '.dadbbbbdad.',
    '...dbbbbd...',
    '...dbddbd...',
    '...dbd.dbd..',
    '...dd...dd..',
  ] },
};

export function PixelFoe({ kind, size = 48 }: { kind: EnemyKind; size?: number }) {
  const f = FOES[kind];
  const colour: Record<string, string> = { b: f.body, a: f.accent, e: '#ff4040', d: '#0b0b10' };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {f.rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour[ch]} />)),
      )}
    </svg>
  );
}
