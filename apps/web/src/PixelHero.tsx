import type { RaceId } from '@hp/content';

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

export function PixelHero({ race, size = 48 }: { race: RaceId; size?: number }) {
  const p = PALETTE[race];
  const colour: Record<string, string> = { s: p.skin, c: p.cloth, a: p.accent, e: '#111', d: '#0b0b10' };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {SPRITE.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour[ch]} />,
        ),
      )}
    </svg>
  );
}
