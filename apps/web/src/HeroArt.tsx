import { memo, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_LOOK, type EnemyKind, type HeroLook, type ProfessionId, type RaceId, type Text } from '@hp/content';

/**
 * The hero as a clean, minimalist vector figure (Jacob, 2026-11-27: clearer, not pixel art, and
 * a change of clothes or legs must be plainly visible). Drawn on a 64×64 grid with the head in
 * the top 28 units, the torso and arms from 28 to 44 and the legs below, so the hit-location
 * spots of the armoured figure (a 16-unit grid) still sit on the right body parts.
 *
 * Each look option is its own shape, not a recolour. Colours the player picks go to exactly the
 * part they are offered beside: the head's hair or headwear, the torso's clothes, the legs'
 * trousers, and the skin.
 */

const INK = '#17141d';
const SW = 1.5;
const METAL = '#c4c9d4';
const LEATHER = '#7a4a26';
const LEATHER_D = '#4f2f18';
const GOLD = '#e2b23a';
const LINEN = '#e6dcc6';
const WOOD = '#8a5a2c';

/** The race's own colours: skin, hair or headwear, clothes and trousers. */
export const RACE_DEFAULTS: Record<RaceId, { skin: string; hair: string; cloth: string; legwear: string; eye: string }> = {
  humans: { skin: '#e8b796', hair: '#5a3a1a', cloth: '#7a3b3b', legwear: '#4a3a2e', eye: INK },
  nomads: { skin: '#d9a066', hair: '#4a2e1a', cloth: '#8a6f3e', legwear: '#5a3a20', eye: INK },
  myrmids: { skin: '#5fb3b3', hair: '#ff8a7a', cloth: '#2f5d7c', legwear: '#3a6e78', eye: INK },
  sunborn: { skin: '#c98a3a', hair: '#2a5aa0', cloth: '#e0c068', legwear: '#7a4a1a', eye: INK },
  keepers: { skin: '#b8e0a0', hair: '#4a9a3a', cloth: '#3f6b3a', legwear: '#6a4a2a', eye: '#f4ff9a' },
  flintborn: { skin: '#8a8f98', hair: '#7af0ff', cloth: '#4a4e57', legwear: '#2e2e36', eye: '#7af0ff' },
};

/** A colour moved towards black (by > 0) or white (by < 0). */
export function shade(hex: string, by = 0.28): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(by >= 0 ? v * (1 - by) : v + (255 - v) * -by).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

type Pal = {
  skin: string; skinD: string; tint: string; tintD: string; cloth: string; clothD: string; leg: string; legD: string; trim: string; eye: string;
};

/* ------------------------------------------------------------------------------------------ */
/* Shared pieces                                                                               */
/* ------------------------------------------------------------------------------------------ */

const S = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const line = (d: string, w = 1, c = INK, o?: number) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;
const MIRROR = 'translate(64 0) scale(-1 1)';
/** Draws a left-side part, then the same part mirrored on the right. */
const both = (part: ReactNode) => <>{part}<g transform={MIRROR}>{part}</g></>;

const face = (p: Pal) => <circle cx="32" cy="17" r="9" fill={p.skin} {...S} />;
const eyes = (p: Pal, y = 18, gap = 3.6, r = 1.25) => (
  <>
    <circle cx={32 - gap} cy={y} r={r} fill={p.eye} />
    <circle cx={32 + gap} cy={y} r={r} fill={p.eye} />
  </>
);
const mouth = (y = 22) => line(`M30.2,${y} Q32,${y + 0.9} 33.8,${y}`, 1);

/* ------------------------------------------------------------------------------------------ */
/* Heads: five per race, each with the part the hair colour goes to (or none)                   */
/* ------------------------------------------------------------------------------------------ */

type Head = {
  /** What the hair colour paints, shown beside the head option; null when nothing. */
  tint: Text | null;
  /** The colour of that part before the player picks one. */
  tintDefault?: string;
  /** Drawn behind the body (long hair, a cobra hood, a cloak's hood). */
  back?: (p: Pal) => ReactNode;
  front: (p: Pal) => ReactNode;
};

const HAIR: Text = { pl: 'Włosy', en: 'Hair' };

const humanFace = (p: Pal) => <>{face(p)}{eyes(p)}{mouth()}</>;
const nomadFace = (p: Pal) => <>{face(p)}{eyes(p)}{mouth()}{line('M25.5,20.5 L27.5,20.5 M36.5,20.5 L38.5,20.5', 1.1, shade(p.skin, 0.4))}</>;
const fishFace = (p: Pal) => (
  <>
    <ellipse cx="32" cy="17.5" rx="10" ry="8.6" fill={p.skin} {...S} />
    <circle cx="27.6" cy="16.6" r="2.6" fill="#f6f6f2" stroke={INK} strokeWidth="1" />
    <circle cx="36.4" cy="16.6" r="2.6" fill="#f6f6f2" stroke={INK} strokeWidth="1" />
    <circle cx="28" cy="16.9" r="1.2" fill={INK} />
    <circle cx="36.8" cy="16.9" r="1.2" fill={INK} />
    {line('M28.6,22.4 Q32,24 35.4,22.4', 1.1)}
    {line('M23.6,19 Q24.8,20.6 23.8,22.4 M40.4,19 Q39.2,20.6 40.2,22.4', 0.9, shade(p.skin, 0.4))}
  </>
);
const spiritFace = (p: Pal) => (
  <>
    {face(p)}
    <ellipse cx="28.4" cy="18" rx="1.5" ry="1.9" fill={p.eye} stroke={INK} strokeWidth="0.6" />
    <ellipse cx="35.6" cy="18" rx="1.5" ry="1.9" fill={p.eye} stroke={INK} strokeWidth="0.6" />
    {line('M30.6,22.3 L33.4,22.3', 0.9)}
    {line('M25.2,13.5 Q26.5,15 25.6,16.6', 0.8, shade(p.skin, 0.35))}
  </>
);
const stoneFace = (p: Pal) => (
  <>
    <path d="M23,10.5 L27,7.5 L37,7.5 L41,10.5 L41.5,22 L37.5,26.5 L26.5,26.5 L22.5,22 Z" fill={p.skin} {...S} />
    {line('M27,7.5 L28.5,12 L23,14 M37,7.5 L35.5,12 L41,14 M26.5,26.5 L28,23 L36,23 L37.5,26.5', 0.8, shade(p.skin, 0.35))}
    <rect x="26.2" y="16.6" width="3.6" height="1.6" rx="0.6" fill={p.eye} />
    <rect x="34.2" y="16.6" width="3.6" height="1.6" rx="0.6" fill={p.eye} />
    {line('M30,21.2 L34,21.2', 1)}
  </>
);
const jackal = (p: Pal) => (
  <>
    <path d="M24.5,13 L23.5,1.5 L30,9.5 Z M39.5,13 L40.5,1.5 L34,9.5 Z" fill={p.skin} {...S} />
    <path d="M25.3,10.5 L25,4.8 L28.4,9.3 Z M38.7,10.5 L39,4.8 L35.6,9.3 Z" fill={shade(p.skin, 0.4)} />
    <path d="M23.5,15 Q24,8 32,8 Q40,8 40.5,15 L39,21 L34.5,27 L29.5,27 L25,21 Z" fill={p.skin} {...S} />
    <path d="M29,21.5 L32,28.5 L35,21.5 Z" fill={shade(p.skin, 0.25)} {...S} strokeWidth={1} />
    <circle cx="32" cy="27.2" r="1.3" fill={INK} />
    <path d="M26,15.5 L30,16.5 L26.5,17.6 Z M38,15.5 L34,16.5 L37.5,17.6 Z" fill={INK} />
  </>
);

const HEADS: Record<RaceId, Head[]> = {
  humans: [
    { tint: HAIR, front: (p) => <>{humanFace(p)}<path d="M22.8,17 Q22,7 32,7 Q42,7 41.2,17 Q39.5,11.5 33.5,12 Q30,10.5 26.5,12.5 Q24,13.5 22.8,17 Z" fill={p.tint} {...S} /></> },
    {
      tint: HAIR,
      back: (p) => <path d="M22.5,16 Q21,30 23,35 L28,33 L36,33 L41,35 Q43,30 41.5,16 Z" fill={p.tintD} {...S} />,
      front: (p) => <>{humanFace(p)}<path d="M22.6,19 Q21.5,7 32,7 Q42.5,7 41.4,19 Q40,12.5 32,12 Q27,12 25.5,15.5 Q24,17 22.6,19 Z" fill={p.tint} {...S} /></>,
    },
    {
      tint: { pl: 'Kapelusz', en: 'Hat' }, tintDefault: '#6a5038',
      front: (p) => (
        <>
          {humanFace(p)}
          <path d="M25,10.5 Q25,1.5 32,1.5 Q39,1.5 39,10.5 Z" fill={p.tint} {...S} />
          <rect x="25" y="7.5" width="14" height="2.6" fill={p.trim} stroke={INK} strokeWidth={1} />
          <ellipse cx="32" cy="10.6" rx="15" ry="2.8" fill={p.tint} {...S} />
        </>
      ),
    },
    {
      tint: { pl: 'Broda', en: 'Beard' },
      front: (p) => (
        <>
          {face(p)}
          {line('M27.5,12.5 Q29,11.8 30.2,12.4 M33.8,12.4 Q35,11.8 36.5,12.5', 0.9, shade(p.skin, 0.4))}
          {eyes(p, 17)}
          <path d="M23.4,18.5 Q23,29.5 32,31 Q41,29.5 40.6,18.5 Q39,22 36,21.5 Q32,20 28,21.5 Q25,22 23.4,18.5 Z" fill={p.tint} {...S} />
          {line('M30,23.2 Q32,24.2 34,23.2', 1, shade(p.tint, 0.45))}
        </>
      ),
    },
    {
      tint: { pl: 'Kaptur', en: 'Hood' }, tintDefault: '#4a5a3a',
      back: (p) => <path d="M19.5,30 Q18,6 32,4.5 Q46,6 44.5,30 Z" fill={p.tintD} {...S} />,
      front: (p) => <>{humanFace(p)}<path d="M20.5,26 Q19.5,5.5 32,5 Q44.5,5.5 43.5,26 L40.6,23 Q42,11 32,10.5 Q22,11 23.4,23 Z" fill={p.tint} {...S} /></>,
    },
  ],
  nomads: [
    {
      tint: { pl: 'Kaptur', en: 'Hood' }, tintDefault: '#8a5a32',
      back: (p) => <path d="M19.5,29 Q18,6 32,4.5 Q46,6 44.5,29 Z" fill={p.tintD} {...S} />,
      front: (p) => (
        <>
          {nomadFace(p)}
          <path d="M20.5,25 Q19.5,5.5 32,5 Q44.5,5.5 43.5,25 L40.6,22 Q42,11 32,10.5 Q22,11 23.4,22 Z" fill={p.tint} {...S} />
          <path d="M23.4,22 Q21.6,10.4 32,10 Q42.4,10.4 40.6,22" fill="none" stroke="#f1e9d6" strokeWidth="3.2" strokeLinecap="round" />
        </>
      ),
    },
    {
      tint: HAIR,
      front: (p) => (
        <>
          <path d="M23.5,17 L21.5,36 L25,36 L26,19 Z M40.5,17 L42.5,36 L39,36 L38,19 Z" fill={p.tint} {...S} />
          {line('M22.4,24 L25.4,23.4 M22.1,28 L25.1,27.4 M21.8,32 L24.8,31.4 M41.6,24 L38.6,23.4 M41.9,28 L38.9,27.4 M42.2,32 L39.2,31.4', 0.9, shade(p.tint, 0.45))}
          <circle cx="23.3" cy="37" r="1.6" fill={p.trim} stroke={INK} strokeWidth="0.9" />
          <circle cx="40.7" cy="37" r="1.6" fill={p.trim} stroke={INK} strokeWidth="0.9" />
          {nomadFace(p)}
          <path d="M23,16.5 Q22.5,7 32,7 Q41.5,7 41,16.5 Q38,12 32,12 Q26,12 23,16.5 Z" fill={p.tint} {...S} />
          {line('M32,7.2 L32,12', 1, shade(p.tint, 0.45))}
        </>
      ),
    },
    {
      tint: HAIR,
      front: (p) => (
        <>
          {nomadFace(p)}
          <path d="M23,15 Q22.5,7 32,7 Q41.5,7 41,15 Z" fill={p.tint} {...S} />
          <path d="M22.9,12.6 L41.1,12.6 L41.1,15.6 L22.9,15.6 Z" fill={p.trim} {...S} strokeWidth={1.1} />
          <path d="M41,14 L45.5,17.5 L44,13.5 Z" fill={p.trim} {...S} strokeWidth={1} />
          <path d="M41.5,12 Q46,8 44.5,5 Q43,9 41,10.5 Z" fill="#f1e9d6" stroke={INK} strokeWidth="0.9" />
        </>
      ),
    },
    {
      tint: HAIR,
      front: (p) => (
        <>
          {nomadFace(p)}
          {line('M24.5,12 Q32,8.5 39.5,12', 1, shade(p.skin, 0.25))}
          <path d="M29.5,9 Q28.5,3 32,1.5 Q35.5,3 34.5,9 Z" fill={p.tint} {...S} />
          <circle cx="32" cy="2.6" r="2.6" fill={p.tint} {...S} />
          <rect x="29.5" y="7.5" width="5" height="2" rx="0.8" fill={p.trim} stroke={INK} strokeWidth="0.9" />
        </>
      ),
    },
    {
      tint: { pl: 'Wilcza skóra', en: 'Wolf pelt' }, tintDefault: '#8a8a90',
      back: (p) => <path d="M21,30 Q19,10 26,8 L38,8 Q45,10 43,30 Z" fill={p.tintD} {...S} />,
      front: (p) => (
        <>
          {nomadFace(p)}
          <path d="M22.5,18 Q21,9 25,6 L24,0.5 L29,5 L35,5 L40,0.5 L39,6 Q43,9 41.5,18 Q38,13.5 32,13.5 Q26,13.5 22.5,18 Z" fill={p.tint} {...S} />
          <path d="M28,13.6 L32,10 L36,13.6 L32,15.2 Z" fill={shade(p.tint, -0.35)} stroke={INK} strokeWidth="0.9" />
          <circle cx="28" cy="9" r="0.9" fill="#ffcf40" />
          <circle cx="36" cy="9" r="0.9" fill="#ffcf40" />
          <path d="M25.5,13.6 L26.5,15.6 L27.4,13.8 M36.6,13.8 L37.5,15.6 L38.5,13.6" fill="#fff" stroke={INK} strokeWidth="0.6" />
        </>
      ),
    },
  ],
  myrmids: [
    {
      tint: { pl: 'Płetwa', en: 'Fin' },
      front: (p) => <><path d="M25,10.5 L26.5,1.5 L29.5,5.5 L32,0.5 L34.5,5.5 L37.5,1.5 L39,10.5 Z" fill={p.tint} {...S} />{line('M28,9 L27,4 M32,9 L32,3 M36,9 L37,4', 0.8, shade(p.tint, 0.4))}{fishFace(p)}</>,
    },
    {
      tint: { pl: 'Wąsy', en: 'Barbels' },
      front: (p) => <>{fishFace(p)}{line('M29,22.8 Q24,24 21,30 M35,22.8 Q40,24 43,30', 2, p.tint)}{line('M29.5,23.4 Q27,27 26,32 M34.5,23.4 Q37,27 38,32', 1.4, p.tint)}</>,
    },
    {
      tint: { pl: 'Koral', en: 'Coral' },
      front: (p) => (
        <>
          {fishFace(p)}
          {line('M32,10 L32,1.5 M32,6 L28.5,2.5 M32,5 L35.5,1.8 M28,10.5 L25,4.5 M26.3,7 L23.5,6 M36,10.5 L39,5 M37.8,7.2 L41,6.5', 3.6, INK)}
          {line('M32,10 L32,1.5 M32,6 L28.5,2.5 M32,5 L35.5,1.8 M28,10.5 L25,4.5 M26.3,7 L23.5,6 M36,10.5 L39,5 M37.8,7.2 L41,6.5', 2, p.tint)}
        </>
      ),
    },
    {
      tint: { pl: 'Latarnia', en: 'Lure' }, tintDefault: '#fff2a0',
      front: (p) => (
        <>
          {fishFace(p)}
          {line('M32,9.5 Q32,2 38,1.5 Q42,1.5 42.5,4', 1.4)}
          <circle cx="42.5" cy="5.5" r="3.6" fill={p.tint} opacity="0.35" />
          <circle cx="42.5" cy="5.5" r="2.2" fill={p.tint} stroke={INK} strokeWidth="0.9" />
        </>
      ),
    },
    {
      tint: { pl: 'Falbany', en: 'Frills' },
      back: (p) => <path d="M23,14 L14.5,9 L16.5,15 L13,18.5 L18,20.5 L16,25 L23,22 Z M41,14 L49.5,9 L47.5,15 L51,18.5 L46,20.5 L48,25 L41,22 Z" fill={p.tint} {...S} />,
      front: (p) => <>{fishFace(p)}{line('M24.4,19.5 Q25.6,21 24.6,22.8 M39.6,19.5 Q38.4,21 39.4,22.8', 0.9, shade(p.skin, 0.45))}</>,
    },
  ],
  sunborn: [
    { tint: null, front: (p) => jackal(p) },
    {
      tint: { pl: 'Grzebień', en: 'Crest' }, tintDefault: '#c0392b',
      front: (p) => (
        <>
          <path d="M27,9 L28,2.5 L30.5,7 L32,0.5 L33.5,7 L36,2.5 L37,9 Z" fill={p.tint} {...S} />
          <path d="M22.5,16 Q22.5,8 32,8 Q41.5,8 41.5,16 L40.5,23.5 Q36,27.5 32,27.5 Q28,27.5 23.5,23.5 Z" fill={p.skin} {...S} />
          {line('M25,22 Q32,25.5 39,22', 1)}
          {line('M27,12 L28.5,13 M35.5,13 L37,12 M30,10.5 L31,11.5 M33,11.5 L34,10.5', 0.9, shade(p.skin, 0.4))}
          <circle cx="27" cy="17" r="2" fill="#f2d24a" stroke={INK} strokeWidth="0.8" />
          <circle cx="37" cy="17" r="2" fill="#f2d24a" stroke={INK} strokeWidth="0.8" />
          <rect x="26.6" y="15.6" width="0.8" height="2.8" rx="0.4" fill={INK} />
          <rect x="36.6" y="15.6" width="0.8" height="2.8" rx="0.4" fill={INK} />
        </>
      ),
    },
    {
      tint: { pl: 'Nemes', en: 'Headdress' }, tintDefault: '#2a5aa0',
      back: (p) => <path d="M20,12 Q20,5 32,4.5 Q44,5 44,12 L46,34 L37,30 L27,30 L18,34 Z" fill={p.tint} {...S} />,
      front: (p) => (
        <>
          {line('M20.3,16 L44,16 M20,21 L45,21 M19.4,26 L45.6,26 M18.8,31 L46,31', 2, GOLD, 0.95)}
          {jackal(p)}
          <path d="M23,11.5 Q24,5 32,4.6 Q40,5 41,11.5 Q36,9 32,9 Q28,9 23,11.5 Z" fill={p.tint} {...S} />
          {line('M24.5,8.5 Q32,6 39.5,8.5', 1.6, GOLD)}
        </>
      ),
    },
    {
      tint: { pl: 'Pióra', en: 'Feathers' }, tintDefault: '#6a4a2a',
      front: (p) => (
        <>
          <path d="M22.5,18 Q21.5,7 32,6.5 Q42.5,7 41.5,18 L39,25 L25,25 Z" fill={p.tint} {...S} />
          <path d="M25,15 Q32,11.5 39,15 L38,25 Q32,28 26,25 Z" fill={p.skin} stroke={INK} strokeWidth="1.1" />
          <path d="M29.5,18.5 L34.5,18.5 L34,23 L32,27.5 L30,23 Z" fill="#f0c040" {...S} strokeWidth={1.1} />
          <circle cx="27.6" cy="16.6" r="1.4" fill={INK} />
          <circle cx="36.4" cy="16.6" r="1.4" fill={INK} />
          {line('M27.6,17.8 L26.6,22 M36.4,17.8 L37.4,22', 1.1)}
        </>
      ),
    },
    {
      tint: { pl: 'Kaptur kobry', en: 'Cobra hood' }, tintDefault: '#3a7a3a',
      back: (p) => <path d="M32,3 Q46,6 47,17 Q47,26 40,32 L24,32 Q17,26 17,17 Q18,6 32,3 Z" fill={p.tint} {...S} />,
      front: (p) => (
        <>
          <path d="M21,17 Q24,12 27,16 Q24,20 21,17 Z M43,17 Q40,12 37,16 Q40,20 43,17 Z" fill={shade(p.tint, -0.45)} stroke={INK} strokeWidth="0.8" />
          <path d="M25,16 Q25,8 32,8 Q39,8 39,16 L37.5,24 Q32,27 26.5,24 Z" fill={p.skin} {...S} />
          <circle cx="29" cy="16" r="1.3" fill="#ffcf40" stroke={INK} strokeWidth="0.6" />
          <circle cx="35" cy="16" r="1.3" fill="#ffcf40" stroke={INK} strokeWidth="0.6" />
          {line('M32,22 L32,25.5 M32,25.5 L30.6,27 M32,25.5 L33.4,27', 0.9, '#c0392b')}
        </>
      ),
    },
  ],
  keepers: [
    {
      tint: { pl: 'Poroże', en: 'Antlers' }, tintDefault: '#8a6a40',
      front: (p) => (
        <>
          {line('M26,10 Q22,6 21,0.5 M22.6,5 L18,4 M23.8,7.4 L20.5,9.5 M38,10 Q42,6 43,0.5 M41.4,5 L46,4 M40.2,7.4 L43.5,9.5', 3.4, INK)}
          {line('M26,10 Q22,6 21,0.5 M22.6,5 L18,4 M23.8,7.4 L20.5,9.5 M38,10 Q42,6 43,0.5 M41.4,5 L46,4 M40.2,7.4 L43.5,9.5', 1.8, p.tint)}
          {spiritFace(p)}
        </>
      ),
    },
    {
      tint: { pl: 'Liście', en: 'Leaves' },
      front: (p) => (
        <>
          {spiritFace(p)}
          {[-50, -25, 0, 25, 50].map((a) => (
            <path key={a} d="M32,10.5 Q28.5,6 32,1 Q35.5,6 32,10.5 Z" fill={p.tint} {...S} strokeWidth={1.1} transform={`rotate(${a} 32 17)`} />
          ))}
        </>
      ),
    },
    {
      tint: { pl: 'Mech', en: 'Moss' }, tintDefault: '#5a7a3a',
      back: (p) => <path d="M19.5,30 Q18,6 32,4.5 Q46,6 44.5,30 Z" fill={p.tintD} {...S} />,
      front: (p) => (
        <>
          {spiritFace(p)}
          <path d="M20.5,26 Q19.5,5.5 32,5 Q44.5,5.5 43.5,26 L41,24.5 L40.5,21 Q42,11 32,10.5 Q22,11 23.5,21 L23,24.5 Z" fill={p.tint} {...S} />
          {line('M23.5,21 Q23,14 28,12 M40.5,21 Q41,14 36,12', 1, shade(p.tint, 0.4))}
          <circle cx="26" cy="8.5" r="1" fill="#f4ff9a" />
          <circle cx="38" cy="7.5" r="0.8" fill="#f4ff9a" />
        </>
      ),
    },
    {
      tint: { pl: 'Kapelusz grzyba', en: 'Mushroom cap' }, tintDefault: '#c0392b',
      front: (p) => (
        <>
          {spiritFace(p)}
          <path d="M18,13 Q18,1 32,1 Q46,1 46,13 Q40,11 32,11 Q24,11 18,13 Z" fill={p.tint} {...S} />
          <circle cx="26" cy="5.5" r="1.8" fill="#fff8ec" />
          <circle cx="34" cy="3.8" r="1.4" fill="#fff8ec" />
          <circle cx="40" cy="7.5" r="1.6" fill="#fff8ec" />
          <circle cx="30.5" cy="8.4" r="1" fill="#fff8ec" />
        </>
      ),
    },
    {
      tint: { pl: 'Kwiaty', en: 'Flowers' }, tintDefault: '#e87aa8',
      front: (p) => (
        <>
          {spiritFace(p)}
          {line('M23,12.5 Q32,7 41,12.5', 2.4, '#4a8a3a')}
          {[[24, 11.5], [29, 8.6], [35, 8.6], [40, 11.5]].map(([x, y]) => (
            <g key={x}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={x} cy={y! - 1.6} rx="1.1" ry="1.7" fill={p.tint} stroke={INK} strokeWidth="0.6" transform={`rotate(${a} ${x} ${y})`} />)}
              <circle cx={x} cy={y} r="0.9" fill="#f6d24a" />
            </g>
          ))}
        </>
      ),
    },
  ],
  flintborn: [
    { tint: null, front: (p) => <>{stoneFace(p)}<path d="M22.5,13.5 L41.5,13.5 L40.5,16 L23.5,16 Z" fill={shade(p.skin, 0.3)} {...S} strokeWidth={1.1} /></> },
    {
      tint: { pl: 'Hełm', en: 'Helmet' }, tintDefault: '#e8c020',
      front: (p) => (
        <>
          {stoneFace(p)}
          <path d="M21.5,13 Q21.5,3 32,3 Q42.5,3 42.5,13 Z" fill={p.tint} {...S} />
          <rect x="20" y="11.6" width="24" height="2.6" rx="1" fill={shade(p.tint, 0.25)} {...S} strokeWidth={1.1} />
          <circle cx="32" cy="7.6" r="2.6" fill="#fff6c0" stroke={INK} strokeWidth="1" />
          <circle cx="32" cy="7.6" r="4.4" fill="#fff6c0" opacity="0.25" />
        </>
      ),
    },
    {
      tint: { pl: 'Kryształy', en: 'Crystals' },
      front: (p) => (
        <>
          {stoneFace(p)}
          <path d="M25,9 L25.5,2.5 L28.5,8 Z M30,8 L32,0 L34,8 Z M35.5,8 L38.5,2.5 L39,9 Z" fill={p.tint} {...S} strokeWidth={1.1} />
          <path d="M31.2,7 L32,2 L32.6,7 Z" fill="#fff" opacity="0.6" />
        </>
      ),
    },
    {
      tint: { pl: 'Kamienna broda', en: 'Stone beard' }, tintDefault: '#5a5e68',
      front: (p) => (
        <>
          {stoneFace(p)}
          <path d="M22.5,19.5 L26,23 L29,22 L35,22 L38,23 L41.5,19.5 L40,28 L36,32 L32,30 L28,32 L24,28 Z" fill={p.tint} {...S} />
          {line('M28,25 L29,29 M32,24.5 L32,29 M36,25 L35,29', 0.8, shade(p.tint, 0.4))}
        </>
      ),
    },
    {
      tint: { pl: 'Kryształ', en: 'Crystal' },
      front: (p) => (
        <>
          <path d="M24,10 Q17,8 15.5,1.5 Q21,4.5 26,7 Z M40,10 Q47,8 48.5,1.5 Q43,4.5 38,7 Z" fill={shade(p.skin, 0.2)} {...S} />
          {stoneFace(p)}
          <path d="M32,6 L34.5,10.5 L32,14 L29.5,10.5 Z" fill={p.tint} {...S} strokeWidth={1} />
        </>
      ),
    },
  ],
};

/** What the hair colour paints for this head and its colour before any pick, or null when the head has nothing to colour. */
export function headTint(race: RaceId, head: number): { label: Text; colour: string } | null {
  const h = HEADS[race][head] ?? HEADS[race][0]!;
  return h.tint ? { label: h.tint, colour: h.tintDefault ?? RACE_DEFAULTS[race].hair } : null;
}

/* ------------------------------------------------------------------------------------------ */
/* Torsos: the clothes, in the cloth colour                                                    */
/* ------------------------------------------------------------------------------------------ */

const TORSO_PATH = 'M21.5,29.5 Q32,27 42.5,29.5 L41.5,45 L22.5,45 Z';
const body = (fill: string) => <path d={TORSO_PATH} fill={fill} {...S} />;
const SLEEVE = 'M21.5,29.8 Q16,30 15.6,35 L15.6,42.5 L21.2,42.5 L21.5,35 Z';
const ROBE = 'M21.5,29.5 Q32,27 42.5,29.5 L44.4,52 Q32,54 19.6,52 Z';
const belt = (y: number, fill = LEATHER, buckle = GOLD) => (
  <>
    <rect x="22.2" y={y} width="19.6" height="2.8" fill={fill} stroke={INK} strokeWidth={1.1} />
    <rect x="30.4" y={y - 0.3} width="3.2" height="3.4" rx="0.5" fill={buckle} stroke={INK} strokeWidth={0.9} />
  </>
);

type Torso = {
  /** One arm's sleeve (left side; mirrored for the right). */
  sleeve: (p: Pal) => ReactNode;
  body: (p: Pal) => ReactNode;
  back?: (p: Pal) => ReactNode;
};

const plainSleeve = (p: Pal) => <path d={SLEEVE} fill={p.cloth} {...S} />;
const linenSleeve = () => <path d={SLEEVE} fill={LINEN} {...S} />;
const bareArm = (p: Pal) => <path d={SLEEVE} fill={p.skin} {...S} />;

const TORSO: Record<string, Torso> = {
  tunic: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M28.5,28.6 L32,34 L35.5,28.6 Z" fill={p.skin} stroke={INK} strokeWidth={1} />
        {line('M22.6,44 L41.4,44', 1.6, p.trim)}
        {belt(39)}
      </>
    ),
  },
  mail: {
    sleeve: (p) => <><path d={SLEEVE} fill={p.cloth} {...S} /><path d="M21.5,29.8 Q16,30 15.6,35 L21.5,35 Z" fill={METAL} {...S} strokeWidth={1.1} /></>,
    body: (p) => (
      <>
        {body(METAL)}
        {[31, 33.5, 36, 38.5, 41].map((y) => line(`M22.5,${y} Q24,${y + 1.2} 25.5,${y} Q27,${y + 1.2} 28.5,${y} M35.5,${y} Q37,${y + 1.2} 38.5,${y} Q40,${y + 1.2} 41.5,${y}`, 0.6, '#6a707c'))}
        <path d="M27.5,29 L36.5,29 L36,45 L28,45 Z" fill={p.cloth} {...S} strokeWidth={1.1} />
        <path d="M30,33 L34,33 M32,31 L32,37" stroke={p.trim} strokeWidth="1.6" />
      </>
    ),
  },
  coat: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        <path d="M21.5,29.5 Q32,27 42.5,29.5 L43.5,52 L20.5,52 Z" fill={p.cloth} {...S} />
        <path d="M28,28.6 L32,40 L30,52 M36,28.6 L32,40" fill="none" stroke={INK} strokeWidth={1.1} />
        <path d="M28,28.6 L26,33 L30,35 Z M36,28.6 L38,33 L34,35 Z" fill={p.clothD} stroke={INK} strokeWidth={0.9} />
        {[36, 40, 44].map((y) => <circle key={y} cx="34.5" cy={y + 2} r="0.9" fill={GOLD} />)}
      </>
    ),
  },
  robe: {
    sleeve: (p) => <path d="M21.5,29.8 Q15.5,30 14.6,35 L13.6,43 L21.6,43 L21.5,35 Z" fill={p.cloth} {...S} />,
    body: (p) => (
      <>
        <path d={ROBE} fill={p.cloth} {...S} />
        {line('M32,36 L32,52.6', 1, p.clothD)}
        <path d="M28.5,28.6 L32,33 L35.5,28.6 Z" fill={p.skin} stroke={INK} strokeWidth={1} />
        <rect x="21.4" y="39" width="21.2" height="3" fill={p.trim} stroke={INK} strokeWidth={1.1} />
        {line('M30,42 L28.5,48 M34,42 L35.5,48', 1.6, p.trim)}
      </>
    ),
  },
  vest: {
    sleeve: linenSleeve,
    body: (p) => (
      <>
        {body(LINEN)}
        <path d="M21.5,29.5 L28.5,28.8 L30.5,45 L22.5,45 Z M42.5,29.5 L35.5,28.8 L33.5,45 L41.5,45 Z" fill={p.cloth} {...S} />
        {line('M24,33 L28,33 M40,33 L36,33', 0.9, p.clothD)}
        <circle cx="29.6" cy="36" r="0.8" fill={GOLD} />
        <circle cx="29.9" cy="40" r="0.8" fill={GOLD} />
      </>
    ),
  },
  furJacket: {
    sleeve: (p) => <><path d={SLEEVE} fill={p.cloth} {...S} /><rect x="15.2" y="39.6" width="6.4" height="3.4" rx="1.6" fill="#f1e9d6" stroke={INK} strokeWidth={1} /></>,
    body: (p) => (
      <>
        {body(p.cloth)}
        {line('M32,32 L32,45', 1.1)}
        <path d="M21,30.5 Q24,26.5 32,27 Q40,26.5 43,30.5 Q40,34 32,33 Q24,34 21,30.5 Z" fill="#f1e9d6" {...S} />
        {line('M24.5,30.5 L25.5,31.6 M29,31.5 L29.5,32.6 M35,31.5 L34.5,32.6 M39.5,30.5 L38.5,31.6', 0.7, '#a89a80')}
        {belt(40)}
      </>
    ),
  },
  cloak: {
    sleeve: (p) => <path d="M21.5,29.4 Q14,30 13,36 L12.6,47 L21,45 Z" fill={p.cloth} {...S} />,
    back: (p) => <path d="M20,29.5 L44,29.5 L47,51 L17,51 Z" fill={p.clothD} {...S} />,
    body: (p) => (
      <>
        {body(LINEN)}
        {belt(40, LEATHER_D)}
        <path d="M21.5,29.5 Q26,27.6 29,28.6 L27,46 L21,46 Z M42.5,29.5 Q38,27.6 35,28.6 L37,46 L43,46 Z" fill={p.cloth} {...S} />
        <circle cx="29" cy="30" r="1.6" fill={p.trim} stroke={INK} strokeWidth={0.9} />
        <circle cx="35" cy="30" r="1.6" fill={p.trim} stroke={INK} strokeWidth={0.9} />
      </>
    ),
  },
  fangVest: {
    sleeve: bareArm,
    body: (p) => (
      <>
        {body(p.skin)}
        <path d="M21.5,29.5 L27.5,29 L29.5,45 L22.5,45 Z M42.5,29.5 L36.5,29 L34.5,45 L41.5,45 Z" fill={p.cloth} {...S} />
        {line('M25,30 Q32,37 39,30', 1, '#5a4030')}
        {[[27, 32.6], [29.5, 34.2], [32, 34.8], [34.5, 34.2], [37, 32.6]].map(([x, y]) => <path key={x} d={`M${x! - 1},${y} L${x},${y! + 3} L${x! + 1},${y} Z`} fill="#f6f0e0" stroke={INK} strokeWidth="0.6" />)}
        {belt(41)}
      </>
    ),
  },
  scales: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        {[31, 34.5, 38, 41.5].flatMap((y, row) => [24, 28, 32, 36, 40].map((x) => {
          const cx = x + (row % 2 ? 2 : 0);
          return cx > 41 ? null : <path key={`${x}-${y}`} d={`M${cx - 2},${y} Q${cx},${y + 2.8} ${cx + 2},${y}`} fill="none" stroke={shade(p.cloth, -0.35)} strokeWidth="0.9" />;
        }))}
      </>
    ),
  },
  net: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M23,30 L41,44 M28,29 L41.5,39.5 M34,28.5 L42,34.5 M23,35 L36,45 M22.6,40 L29,45 M41,30 L23,44 M36,29 L22.6,39.5 M30,28.5 L22.4,34.5 M41.5,35 L28,45 M41.6,40 L35,45" stroke="#e8d8a8" strokeWidth="1" opacity="0.9" />
        <circle cx="38" cy="41.5" r="2" fill="#f2f0ea" stroke={INK} strokeWidth="0.8" />
      </>
    ),
  },
  shell: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M23,32 Q26.5,27.5 31.5,30 L31,40 Q26,41 23.5,37.5 Z M41,32 Q37.5,27.5 32.5,30 L33,40 Q38,41 40.5,37.5 Z" fill="#f4e4d4" {...S} strokeWidth={1.1} />
        {line('M26,30.6 L26.5,39.5 M28.6,30.2 L28.6,40.3 M38,30.6 L37.5,39.5 M35.4,30.2 L35.4,40.3', 0.7, '#c4a890')}
        {belt(41.6, p.clothD)}
      </>
    ),
  },
  priest: {
    sleeve: (p) => <path d="M21.5,29.8 Q15.5,30 14.6,35 L13.6,43 L21.6,43 L21.5,35 Z" fill={p.cloth} {...S} />,
    body: (p) => (
      <>
        <path d={ROBE} fill={p.cloth} {...S} />
        <path d="M24.5,34 L39.5,34 L38.6,53 L25.4,53 Z" fill={shade(p.cloth, -0.4)} stroke={INK} strokeWidth={1} />
        <path d="M22,30 Q32,26.5 42,30 Q40.5,37 32,37.5 Q23.5,37 22,30 Z" fill={GOLD} {...S} />
        {line('M24.5,32 Q32,36 39.5,32', 1.2, p.trim)}
      </>
    ),
  },
  goldPlate: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M23,30 Q32,27.6 41,30 L40,40.5 Q32,43.5 24,40.5 Z" fill={GOLD} {...S} />
        {line('M32,29 L32,42 M25,34.5 Q32,37 39,34.5', 1, '#9a7420')}
        <circle cx="32" cy="34" r="1.8" fill={p.trim} stroke={INK} strokeWidth={0.9} />
      </>
    ),
  },
  wrap: {
    sleeve: bareArm,
    body: (p) => (
      <>
        {body(p.skin)}
        <path d="M21.6,30.5 L27,29 L42,42 L41.6,45 L37,45 Z" fill={p.cloth} {...S} strokeWidth={1.2} />
        <path d="M22.4,41 L41.6,41 L41.5,45 L22.5,45 Z" fill={p.cloth} {...S} strokeWidth={1.2} />
        {line('M30,33 L38,40', 0.8, p.clothD)}
      </>
    ),
  },
  bark: {
    sleeve: (p) => <><path d={SLEEVE} fill={p.cloth} {...S} />{line('M18.5,32 L18.2,41', 0.8, p.clothD)}</>,
    body: (p) => (
      <>
        {body(p.cloth)}
        {line('M26,29 Q25,36 26.5,45 M30.5,28.5 Q31.5,35 30,45 M35,28.4 Q34,37 35.5,45 M39,29.4 Q40,36 38.5,45', 1, p.clothD)}
        <path d="M33,35 Q35,33 36.5,35 Q35,37.5 33,35 Z" fill="#6aa84a" stroke={INK} strokeWidth="0.6" />
      </>
    ),
  },
  leafCloak: {
    sleeve: (p) => <><path d={SLEEVE} fill="#6a4a2a" {...S} /><path d="M21.5,29.6 Q14.5,30 15,36.5 Q19,36 21.5,33 Z" fill={p.cloth} {...S} strokeWidth={1.1} /></>,
    body: (p) => (
      <>
        {body('#6a4a2a')}
        {[[24, 31, -30], [28.5, 30, -10], [33, 29.8, 8], [37.5, 30.4, 25], [41, 32, 40], [26, 35, -20], [30.5, 34.6, 0], [35, 34.8, 16], [39.5, 36, 30]].map(([x, y, a], i) => (
          <path key={i} d={`M${x},${y! - 3} Q${x! + 3},${y} ${x},${y! + 4} Q${x! - 3},${y} ${x},${y! - 3} Z`} fill={i % 2 ? p.cloth : p.clothD} stroke={INK} strokeWidth="0.9" transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </>
    ),
  },
  vines: {
    sleeve: (p) => <><path d={SLEEVE} fill={p.cloth} {...S} />{line('M16,33 Q20,35 16.5,38 Q20,40 17,42', 1.4, '#4a8a3a')}</>,
    body: (p) => (
      <>
        {body(p.cloth)}
        {line('M22.5,30.5 Q30,33 26,37 Q22.5,41 30,44 M41.5,30.5 Q34,34 38,38 Q41,42 34,44.6', 1.8, '#4a8a3a')}
        {[[26.5, 33], [26.5, 40], [37.5, 33.5], [38, 41]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.6" ry="1" fill="#7ac45a" stroke={INK} strokeWidth="0.5" />)}
      </>
    ),
  },
  apron: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M26,31 L38,31 L39,53 L25,53 Z" fill={LEATHER} {...S} />
        {line('M26,31 L23,29 M38,31 L41,29', 1.2, LEATHER_D)}
        <rect x="28.5" y="38" width="7" height="5" rx="0.8" fill="none" stroke={LEATHER_D} strokeWidth="1" />
      </>
    ),
  },
  stonePlates: {
    sleeve: (p) => <><path d={SLEEVE} fill={p.cloth} {...S} /><path d="M21.6,29 Q15,29 14.6,34.5 L21.5,34.5 Z" fill="#9a9ea8" {...S} strokeWidth={1.1} /></>,
    body: (p) => (
      <>
        {body(p.cloth)}
        <path d="M23,30 L31.4,29 L31,36.5 L23.4,36 Z M41,30 L32.6,29 L33,36.5 L40.6,36 Z M24,37.4 L40,37.4 L39.4,43 L24.6,43 Z" fill="#9a9ea8" {...S} strokeWidth={1.1} />
        {line('M25,32 L28,33.4 M39,32 L36,33.4', 0.7, '#5a5e68')}
      </>
    ),
  },
  toolBelt: {
    sleeve: plainSleeve,
    body: (p) => (
      <>
        {body(p.cloth)}
        {line('M22.4,29.8 L41,41.5', 2.2, LEATHER)}
        {belt(40.4)}
        <rect x="23.5" y="42.4" width="4" height="4.6" rx="0.8" fill={LEATHER} stroke={INK} strokeWidth={1} />
        {line('M37.5,42 L38.5,49', 1.6, WOOD)}
        <rect x="36" y="47.6" width="5" height="2.6" rx="0.5" fill={METAL} stroke={INK} strokeWidth={0.9} />
      </>
    ),
  },
};

const TORSO_KINDS: Record<RaceId, string[]> = {
  humans: ['tunic', 'mail', 'coat', 'robe', 'vest'],
  nomads: ['furJacket', 'cloak', 'fangVest', 'robe', 'vest'],
  myrmids: ['scales', 'net', 'shell', 'robe', 'vest'],
  sunborn: ['priest', 'goldPlate', 'wrap', 'robe', 'vest'],
  keepers: ['bark', 'leafCloak', 'vines', 'robe', 'vest'],
  flintborn: ['apron', 'stonePlates', 'toolBelt', 'robe', 'vest'],
};

/* ------------------------------------------------------------------------------------------ */
/* Legs: drawn for the left leg and mirrored; the trousers take the legwear colour              */
/* ------------------------------------------------------------------------------------------ */

const trousers = (p: Pal, to = 57) => <path d={`M22.6,44 L31.2,44 L30.8,${to} L23.6,${to} Z`} fill={p.leg} {...S} />;
const shin = (fill: string, from: number, to = 57) => <path d={`M23.6,${from} L30.8,${from} L30.8,${to} L23.6,${to} Z`} fill={fill} {...S} />;
const boot = (fill: string, top = 55, toe = 20.6) => <path d={`M23.4,${top} L31,${top} L31,61.4 L${toe},61.4 Q${toe - 0.4},57.6 23.4,57 Z`} fill={fill} {...S} />;
const pelvis = (p: Pal) => <path d="M22.4,42 L41.6,42 L41.8,47 L22.2,47 Z" fill={p.leg} {...S} />;

type Legs = { leg: (p: Pal) => ReactNode; over?: (p: Pal) => ReactNode; back?: (p: Pal) => ReactNode };

const LEGS: Record<string, Legs> = {
  furBoots: { leg: (p) => <>{trousers(p)}{boot('#f1e9d6', 51)}{line('M23.4,51 Q25,53 27,51 Q29,53 31,51', 1.1, '#a89a80')}</> },
  wraps: {
    leg: (p) => <>{trousers(p)}<path d="M23.6,48 L30.8,48 L30.8,57 L23.6,57 Z" fill={LINEN} {...S} />{line('M23.6,49.5 L30.8,52 M23.6,52.5 L30.8,55 M30.8,49.5 L23.6,52 M30.8,52.5 L23.6,55', 0.8, '#a89a80')}{boot(LEATHER_D, 57)}</>,
  },
  tallBoots: { leg: (p) => <>{trousers(p)}{boot(LEATHER_D, 47.5)}{line('M23.4,49.5 L31,49.5', 1, '#2a1a0e')}</> },
  kilt: {
    leg: (p) => <>{shin(p.skin, 46, 56)}<rect x="23.4" y="52.5" width="7.6" height="2.2" fill={LINEN} stroke={INK} strokeWidth="1" />{boot(LEATHER, 55.5)}</>,
    over: (p) => (
      <>
        <path d="M22,41.5 L42,41.5 L44,53 L20,53 Z" fill={p.leg} {...S} />
        {line('M26,42 L25,53 M30,42 L29.6,53 M34,42 L34.4,53 M38,42 L39,53', 0.9, p.legD)}
        {line('M20.4,51 L43.6,51', 1.4, p.trim)}
      </>
    ),
  },
  kneeTrousers: {
    leg: (p) => <>{trousers(p)}<circle cx="27.2" cy="51" r="2.8" fill={LEATHER} {...S} strokeWidth={1.1} />{boot(LEATHER_D, 56)}</>,
  },
  flippers: {
    leg: (p) => (
      <>
        {trousers(p, 54)}
        {shin(p.skin, 54, 57.5)}
        <path d="M23.4,57 L31,57 L31.4,61.6 L17.5,62 L16.5,59.5 Q19,58.4 23.4,57 Z" fill={p.skin === '#5fb3b3' ? '#3a8a8a' : shade(p.skin, 0.3)} {...S} />
        {line('M20,61.6 L22.5,58.6 M24,61.8 L25.5,58 M28,61.8 L28.4,57.8', 0.7, INK)}
      </>
    ),
  },
  bareFeet: {
    leg: (p) => (
      <>
        {trousers(p, 53)}
        {line('M23.6,51.4 L30.8,51.4', 1, p.legD)}
        {shin(p.skin, 53, 57.4)}
        <path d="M23.5,57 L30.9,57 L30.9,61.3 L21.6,61.3 Q21,58.2 23.5,57 Z" fill={p.skin} {...S} />
        {line('M22.6,61.2 L22.6,60.2 M24.2,61.2 L24.2,60.2', 0.7)}
      </>
    ),
  },
  kelp: {
    leg: (p) => <>{trousers(p)}{line('M23.6,47 Q27,49 30.8,47.6 M23.6,50.5 Q27,52.5 30.8,51 M23.6,54 Q27,56 30.8,54.6', 1.8, '#4a8a3a')}{boot('#2a5a4a', 57)}</>,
  },
  travelBoots: { leg: (p) => <>{trousers(p)}{boot(LEATHER, 53)}<rect x="23" y="52.4" width="8.4" height="2.2" rx="0.8" fill={shade(LEATHER, -0.2)} stroke={INK} strokeWidth="1" /></> },
  greaves: {
    leg: (p) => <>{trousers(p)}<path d="M23.2,48 L31.2,48 L30.8,57 L23.6,57 Z" fill={METAL} {...S} />{line('M27.2,48.6 L27.2,56.4', 0.9, '#7a808c')}{boot(LEATHER_D, 57)}</>,
  },
  sandals: {
    leg: (p) => (
      <>
        {trousers(p, 50)}
        {shin(p.skin, 50, 57.4)}
        <path d="M23.5,57 L30.9,57 L30.9,61.3 L21.6,61.3 Q21,58.2 23.5,57 Z" fill={p.skin} {...S} />
        {line('M23.6,52.6 L30.8,55.2 M30.8,52.6 L23.6,55.2', 1.1, LEATHER)}
        <rect x="21.2" y="60.4" width="10" height="1.6" rx="0.6" fill={LEATHER} stroke={INK} strokeWidth="0.8" />
      </>
    ),
  },
  lizardTail: {
    back: (p) => <path d="M38,45 Q50,46 52,54 Q53.5,60 58.5,59.5 Q53,63 49.5,57 Q47.5,51 38,50 Z" fill={p.skin} {...S} />,
    leg: (p) => <>{trousers(p)}<path d="M23.4,56 L31,56 L31,61.4 L20.6,61.4 Q20,57.6 23.4,56 Z" fill={p.skin} {...S} />{line('M21.4,61.3 L20.2,62.6 M23.6,61.3 L22.8,62.8', 1, INK)}</>,
  },
  roots: {
    leg: (p) => (
      <>
        {trousers(p, 53)}
        <path d="M23.6,53 L30.8,53 L31.5,58 L33.5,61.6 L29.5,60 L27,62 L25.5,59.6 L21,61.6 L23,57.6 Z" fill={WOOD} {...S} />
        {line('M26,54 L26.5,58.5 M29,54 L29.5,58', 0.8, '#5a3a1a')}
      </>
    ),
  },
  hooves: {
    leg: (p) => (
      <>
        <path d="M22.6,44 L31.2,44 L31,51 L29.6,56.5 L24.4,56.5 L23.4,51 Z" fill={p.leg} {...S} />
        {line('M24.5,47 L26,48 M28,48.6 L29.6,49.6 M25,51.5 L26.6,52.5', 0.8, p.legD)}
        <path d="M24,56.4 L30,56.4 L30.6,61.4 L23.4,61.4 Z" fill="#2a2420" {...S} />
        {line('M27,58 L27,61.4', 0.9, '#6a5a50')}
      </>
    ),
  },
  heavyBoots: { leg: (p) => <>{trousers(p)}<path d="M22.6,52 L31.6,52 L31.8,61.6 L19.4,61.6 Q19,56.6 22.6,55.6 Z" fill="#3a2a20" {...S} /><rect x="19.4" y="60" width="12.4" height="1.8" fill="#1a1410" /></> },
  stoneFeet: {
    leg: (p) => <>{trousers(p, 54)}<path d="M22.8,54 L31.4,54 L32,61.6 L19.6,61.6 L20.4,57 Z" fill={p.skin} {...S} />{line('M24.5,56.5 L27,58.5 L26,61.4 M29.5,55 L29,58', 0.8, shade(p.skin, 0.4))}</>,
  },
  ironBoots: {
    leg: (p) => <>{trousers(p)}{boot(LEATHER_D, 52)}<path d="M20.4,58.4 Q21,56.6 24,56.4 L24,61.4 L20.6,61.4 Z" fill={METAL} stroke={INK} strokeWidth="1" /><rect x="23.2" y="52" width="8" height="2.4" fill={METAL} stroke={INK} strokeWidth="1" /></>,
  },
};

const LEG_KINDS: Record<RaceId, string[]> = {
  nomads: ['furBoots', 'wraps', 'tallBoots', 'kilt', 'kneeTrousers'],
  myrmids: ['flippers', 'bareFeet', 'kelp', 'kilt', 'kneeTrousers'],
  humans: ['travelBoots', 'greaves', 'sandals', 'kilt', 'kneeTrousers'],
  sunborn: ['sandals', 'lizardTail', 'wraps', 'kilt', 'kneeTrousers'],
  keepers: ['roots', 'bareFeet', 'hooves', 'kilt', 'kneeTrousers'],
  flintborn: ['heavyBoots', 'stoneFeet', 'ironBoots', 'kilt', 'kneeTrousers'],
};

/* ------------------------------------------------------------------------------------------ */
/* What the hero holds, and armour                                                              */
/* ------------------------------------------------------------------------------------------ */

type Item = 'sword' | 'bow' | 'trident' | 'staff' | 'daggers' | 'axe' | 'spear' | 'hammer';
const PROFESSION: Record<ProfessionId, { item: Item; trim: string }> = {
  trapper: { item: 'bow', trim: '#6a8a3a' },
  elder: { item: 'staff', trim: '#e8dcc0' },
  diver: { item: 'trident', trim: '#7af0e0' },
  gourmet: { item: 'daggers', trim: '#ffb347' },
  explorer: { item: 'spear', trim: '#d4af37' },
  warrior: { item: 'sword', trim: '#c0392b' },
  mystic: { item: 'staff', trim: '#b080ff' },
  guardian: { item: 'spear', trim: '#e8c040' },
  wraith: { item: 'daggers', trim: '#8aa0b8' },
  druid: { item: 'staff', trim: '#4a9a3a' },
  runemaster: { item: 'hammer', trim: '#7af0ff' },
  cavedelver: { item: 'axe', trim: '#ffb347' },
};

const shaft = (y1: number, y2: number) => <rect x="46.4" y={y1} width="2.2" height={y2 - y1} rx="1" fill={WOOD} stroke={INK} strokeWidth="1" />;
const ITEMS: Record<Item, (p: Pal) => ReactNode> = {
  sword: (p) => (
    <>
      <path d="M46,41 L46,16 L47.5,13 L49,16 L49,41 Z" fill={METAL} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      {line('M47.5,16 L47.5,40', 0.6, '#8a909c')}
      <rect x="43" y="40.6" width="9" height="2.4" rx="1" fill={p.trim} stroke={INK} strokeWidth="1" />
      <rect x="46.6" y="43" width="1.8" height="4.6" fill={LEATHER_D} stroke={INK} strokeWidth="0.8" />
    </>
  ),
  bow: () => <>{line('M50,22 Q60,37 50,52', 2.6, WOOD)}{line('M50,22 Q60,37 50,52', 0.8, INK, 0.4)}{line('M50,22 L50,52', 0.6, '#f2ead8')}</>,
  trident: () => <>{shaft(10, 58)}<path d="M43.6,4 L43.6,10 L51.4,10 L51.4,4 M47.5,2 L47.5,10" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" /><path d="M43.6,4 L43.6,10 L51.4,10 L51.4,4 M47.5,2 L47.5,10" fill="none" stroke={METAL} strokeWidth="1.6" strokeLinecap="round" /></>,
  staff: (p) => <>{shaft(11, 58)}<circle cx="47.5" cy="8" r="4.6" fill={p.trim} opacity="0.3" /><circle cx="47.5" cy="8" r="3.2" fill={p.trim} stroke={INK} strokeWidth="1.1" /><circle cx="46.4" cy="7" r="0.9" fill="#fff" opacity="0.8" /></>,
  daggers: () => both(<path d="M17.6,44 L17.6,35.5 L18.6,33.5 L19.6,35.5 L19.6,44 Z" fill={METAL} stroke={INK} strokeWidth="1" strokeLinejoin="round" />),
  axe: () => <>{shaft(16, 57)}<path d="M48,17 Q55,14 56.5,21 Q55,28 48,25 Z" fill={METAL} {...S} strokeWidth={1.2} />{line('M54,17.5 Q55.6,21 54,24.6', 0.7, '#7a808c')}</>,
  spear: () => <>{shaft(9, 58)}<path d="M47.5,1.5 L50,8 L47.5,10.5 L45,8 Z" fill={METAL} {...S} strokeWidth={1.1} /></>,
  hammer: () => <>{shaft(20, 55)}<rect x="41.5" y="15" width="12" height="7" rx="1.2" fill={METAL} {...S} strokeWidth={1.2} />{line('M43,16.6 L52,16.6', 0.7, '#fff', 0.7)}</>,
};

/** What the hero wears: armour value on each slot (0 for none), a shield, and the weapon in hand. */
export interface Gear {
  head: number; arms: number; torso: number; legs: number;
  shield: boolean;
  weapon: string;
}

/** The weapon an item id is drawn as. */
const WEAPON_ITEM: Record<string, Item> = {
  dagger: 'daggers', shortSword: 'sword', oneHanded: 'sword', twoHanded: 'axe', minotaurAxe: 'axe', bow: 'bow', longBow: 'bow', crossbow: 'bow',
};

/** Leather, iron or plate by armour value. */
export const armourTier = (v: number) => (v >= 5 ? '#e4e8f0' : v >= 3 ? '#9aa1ae' : '#9a6234');

function armour(g: Gear) {
  return (
    <>
      {g.head > 0 && <path d="M22.6,15.5 Q22,6.2 32,6 Q42,6.2 41.4,15.5 L38,14 L26,14 Z" fill={armourTier(g.head)} {...S} />}
      {g.torso > 0 && <path d="M23,29.6 Q32,27.4 41,29.6 L40.2,41 Q32,43.6 23.8,41 Z" fill={armourTier(g.torso)} {...S} />}
      {g.arms > 0 && both(<rect x="15" y="36" width="6.8" height="6" rx="1.2" fill={armourTier(g.arms)} {...S} strokeWidth={1.2} />)}
      {g.legs > 0 && both(<path d="M23.2,48 L31.2,48 L30.8,55.6 L23.6,55.6 Z" fill={armourTier(g.legs)} {...S} strokeWidth={1.2} />)}
    </>
  );
}

const shield = <><path d="M8.5,32 L21,32 L21,40 Q21,46.5 14.75,49 Q8.5,46.5 8.5,40 Z" fill="#7a4a22" {...S} /><path d="M8.5,32 L21,32 L21,40 Q21,46.5 14.75,49 Q8.5,46.5 8.5,40 Z" fill="none" stroke={METAL} strokeWidth="1.4" transform="translate(14.75 40) scale(0.82) translate(-14.75 -40)" /><circle cx="14.75" cy="39.5" r="1.8" fill={GOLD} stroke={INK} strokeWidth="0.8" /></>;

/* ------------------------------------------------------------------------------------------ */
/* The figure                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function palette(race: RaceId, look: HeroLook, trim: string, headDefault?: string): Pal {
  const d = RACE_DEFAULTS[race];
  const skin = look.skin ?? d.skin;
  const tint = look.hair ?? headDefault ?? d.hair;
  const cloth = look.cloth ?? d.cloth;
  const leg = look.legwear ?? d.legwear;
  return { skin, skinD: shade(skin), tint, tintD: shade(tint, 0.3), cloth, clothD: shade(cloth, 0.3), leg, legD: shade(leg, 0.35), trim, eye: d.eye };
}

const HeroSvg = memo(function HeroSvg({ race, profession, look, gear, stride }: { race: RaceId; profession?: ProfessionId; look: HeroLook; gear?: Gear; stride: boolean }) {
  const prof = profession ? PROFESSION[profession] : null;
  const head = HEADS[race][look.head] ?? HEADS[race][0]!;
  const torso = TORSO[TORSO_KINDS[race][look.torso] ?? TORSO_KINDS[race][0]!]!;
  const legs = LEGS[LEG_KINDS[race][look.legs] ?? LEG_KINDS[race][0]!]!;
  const p = palette(race, look, prof?.trim ?? '#c8b070', head.tintDefault);
  const held = gear ? WEAPON_ITEM[gear.weapon] ?? prof?.item : prof?.item;
  const leftLeg = legs.leg(p);
  return (
    <>
      {legs.back?.(p)}
      {torso.back?.(p)}
      {head.back?.(p)}
      <g transform={stride ? 'rotate(9 27 45)' : undefined}>{leftLeg}</g>
      <g transform={stride ? `${MIRROR} rotate(9 27 45)` : MIRROR}>{leftLeg}</g>
      {pelvis(p)}
      {legs.over?.(p)}
      <rect x="28.6" y="23.5" width="6.8" height="6" fill={p.skinD} {...S} strokeWidth={1.2} />
      {torso.body(p)}
      {both(<>{torso.sleeve(p)}<circle cx="18.4" cy="44.4" r="2.7" fill={p.skin} {...S} strokeWidth={1.2} /></>)}
      {head.front(p)}
      {held && ITEMS[held](p)}
      {held && held !== 'bow' && held !== 'daggers' && <circle cx="45.6" cy="44.4" r="2.7" fill={p.skin} {...S} strokeWidth={1.2} />}
      {gear && armour(gear)}
      {gear?.shield && shield}
    </>
  );
});

export function HeroArt({ race, profession, look, size = 48, walking = false, facing = 1, gear }: {
  race: RaceId;
  profession?: ProfessionId;
  look?: HeroLook;
  size?: number;
  walking?: boolean;
  facing?: 1 | -1;
  /** Draw the hero in this armour and with this weapon instead of the profession's tool. */
  gear?: Gear;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 160);
    return () => clearInterval(timer);
  }, [walking]);
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"
      className={walking ? 'hero-art walking' : 'hero-art'}
      style={facing === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      <HeroSvg race={race} profession={profession} look={look ?? DEFAULT_LOOK} gear={gear} stride={walking && frame === 1} />
    </svg>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Foes                                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Foes on a 48×48 grid (four units to each square of the 12-square hit-location grid). */
const FOE_ART: Record<EnemyKind, (armourOn: (slot: 'head' | 'arms' | 'torso' | 'legs') => string | null) => ReactNode> = {
  beast: (a) => (
    <>
      <path d="M14,14 Q30,8 42,14 Q47,17 46,24 Q45,31 38,32 L18,32 Q12,30 12,22 Z" fill={a('torso') ?? '#8a5a3a'} {...S} />
      {[[8, 30], [16, 30], [32, 30], [40, 30]].map(([x, y], i) => <path key={i} d={`M${x},${y} L${x! + 5},${y} L${x! + 4.5},${y! + 13} L${x! + 0.5},${y! + 13} Z`} fill={(i < 2 ? a('arms') : a('legs')) ?? '#6e4630'} {...S} />)}
      <path d="M46,18 Q52,20 52,26" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M2,14 Q2,6 10,5 L8,0.5 L13,4.5 L17,6 Q20,10 18,17 L12,20 L3,19 Z" fill={a('head') ?? '#8a5a3a'} {...S} />
      <path d="M2,14 L0.5,16.5 L3,19 Z" fill={INK} />
      <circle cx="10" cy="10.5" r="1.4" fill="#ff4040" />
      <path d="M4,18 L5,20.5 L6.5,18.4 M8,18.8 L9,21 L10.4,18.8" fill="#fff" stroke={INK} strokeWidth="0.6" />
    </>
  ),
  demon: (a) => (
    <>
      <path d="M12,22 L1,10 L4,26 L12,30 Z M36,22 L47,10 L44,26 L36,30 Z" fill="#4a1a3a" {...S} />
      <path d="M17,36 L23,36 L22,47 L16,47 Z M25,36 L31,36 L32,47 L26,47 Z" fill={a('legs') ?? '#5e1f46'} {...S} />
      <path d="M14,20 Q24,17 34,20 L32,37 L16,37 Z" fill={a('torso') ?? '#7a2a5a'} {...S} />
      <path d="M14,20.5 L9,33 L13,34 L16,25 Z M34,20.5 L39,33 L35,34 L32,25 Z" fill={a('arms') ?? '#7a2a5a'} {...S} />
      <path d="M17,6 L14,0.5 L19,4 M31,6 L34,0.5 L29,4" fill="#ffb030" {...S} strokeWidth={1.2} />
      <path d="M16,10 Q16,3 24,3 Q32,3 32,10 L31,17 Q24,21 17,17 Z" fill={a('head') ?? '#7a2a5a'} {...S} />
      <path d="M19,10.5 L22.5,11.5 L19.5,12.6 Z M29,10.5 L25.5,11.5 L28.5,12.6 Z" fill="#ffb030" />
      {line('M21,15.5 L27,15.5', 1.2)}
    </>
  ),
  thug: (a) => (
    <>
      <path d="M16,36 L23,36 L22.5,47 L15.5,47 Z M25,36 L32,36 L32.5,47 L25.5,47 Z" fill={a('legs') ?? '#3e3e4a'} {...S} />
      <path d="M12,21 Q24,17 36,21 L34,37 L14,37 Z" fill={a('torso') ?? '#5a5a6a'} {...S} />
      <path d="M12,21.5 L7,34 L12,35 L15,26 Z M36,21.5 L41,34 L36,35 L33,26 Z" fill={a('arms') ?? '#5a5a6a'} {...S} />
      <circle cx="9.5" cy="35" r="2.6" fill="#c8a080" {...S} strokeWidth={1.1} />
      <circle cx="38.5" cy="35" r="2.6" fill="#c8a080" {...S} strokeWidth={1.1} />
      {line('M39,35 L45,22', 3, WOOD)}
      <path d="M15,12 Q15,2 24,2 Q33,2 33,12 L32,19 L16,19 Z" fill={a('head') ?? '#3a3a46'} {...S} />
      <path d="M18,9 L30,9 L29.5,17 L18.5,17 Z" fill="#c8a080" {...S} strokeWidth={1.1} />
      <circle cx="21.4" cy="12.4" r="1.1" fill="#ff4040" />
      <circle cx="26.6" cy="12.4" r="1.1" fill="#ff4040" />
    </>
  ),
  wraith: (a) => (
    <>
      <path d="M14,18 Q24,14 34,18 L37,40 L33,36 L30,42 L26,37 L22,43 L18,37 L15,42 L11,40 Z" fill={a('torso') ?? '#8aa0b8'} {...S} opacity="0.92" />
      <path d="M14,20 Q7,26 5,34 L10,32 L15,26 Z M34,20 Q41,26 43,34 L38,32 L33,26 Z" fill={a('arms') ?? '#8aa0b8'} {...S} opacity="0.92" />
      <path d="M15,12 Q15,2 24,2 Q33,2 33,12 L32,19 Q24,22 16,19 Z" fill={a('head') ?? '#a8bcd0'} {...S} />
      <ellipse cx="20.5" cy="11.5" rx="2" ry="2.6" fill="#e0f0ff" stroke={INK} strokeWidth="0.8" />
      <ellipse cx="27.5" cy="11.5" rx="2" ry="2.6" fill="#e0f0ff" stroke={INK} strokeWidth="0.8" />
      <ellipse cx="24" cy="16.5" rx="1.6" ry="2" fill={INK} />
      {a('legs') && <path d="M14,36 L34,36 L33.5,40 L14.5,40 Z" fill={a('legs')!} {...S} />}
    </>
  ),
  human: (a) => (
    <>
      <path d="M16,36 L23,36 L22.5,47 L15.5,47 Z M25,36 L32,36 L32.5,47 L25.5,47 Z" fill={a('legs') ?? '#5a4630'} {...S} />
      <path d="M13,21 Q24,18 35,21 L34,37 L14,37 Z" fill={a('torso') ?? '#9a7a4a'} {...S} />
      {line('M14.5,31 L33.5,31', 2.2, LEATHER_D)}
      <path d="M13,21.5 L8,34 L12.5,35 L15.5,26 Z M35,21.5 L40,34 L35.5,35 L32.5,26 Z" fill={a('arms') ?? '#9a7a4a'} {...S} />
      <path d="M39,35 L42,18 L43.5,17 L44,19 L41,35 Z" fill={METAL} stroke={INK} strokeWidth="1" />
      <path d="M15,13 Q15,2 24,2 Q33,2 33,13 L33,20 L15,20 Z" fill={a('head') ?? '#5a4a3a'} {...S} />
      <circle cx="24" cy="12.5" r="6" fill="#e8c8a0" {...S} strokeWidth={1.1} />
      <circle cx="21.8" cy="12.5" r="0.9" fill={INK} />
      <circle cx="26.2" cy="12.5" r="0.9" fill={INK} />
      <path d="M18,15 Q24,19 30,15 L29,18.5 Q24,20 19,18.5 Z" fill="#3a2a20" />
    </>
  ),
};

export function FoeArt({ kind, size = 48, armour: plates }: { kind: EnemyKind; size?: number; armour?: Partial<Record<'head' | 'arms' | 'torso' | 'legs', number>> }) {
  const on = (slot: 'head' | 'arms' | 'torso' | 'legs') => ((plates?.[slot] ?? 0) > 0 ? armourTier(plates![slot]!) : null);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="foe-art">
      {FOE_ART[kind](on)}
    </svg>
  );
}
