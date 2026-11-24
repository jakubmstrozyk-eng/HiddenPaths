import { useEffect, useState } from 'react';
import { DEFAULT_LOOK, type EnemyKind, type HeroLook, type ProfessionId, type RaceId } from '@hp/content';

/**
 * The hero as a 16×16 pixel figure, put together from a head, a torso and legs. Heads are drawn
 * for each race (the Sunborn are jackals and lizards, the Myrmids fish folk, the Keepers spirits
 * of the wood, the Flintborn living stone); torsos and legs take the race's colours. The
 * profession adds what the hero holds and the colour of their trim.
 */

// Letters: . empty, d outline, s skin, S skin shade, e eye, w white, h hair, k race detail, a trim,
// c cloth, C cloth shade, l legs, m metal, g glow, o moss, y gold helmet, L lamp, z/Z lizard scales.
type Palette = Record<string, string>;
const BASE: Palette = { d: '#0b0b10', e: '#111', w: '#f4f4f4', m: '#b8bcc8', y: '#e8c020', L: '#fff6c0', i: '#8a5a2a', q: '#b080ff' };
const RACE_COLOURS: Record<RaceId, Palette> = {
  nomads: { s: '#d9a066', S: '#a8743e', h: '#4a2e1a', k: '#e8dcc0', a: '#c0392b', c: '#8a6f3e', C: '#5e4a28', l: '#5a3a20' },
  myrmids: { s: '#5fb3b3', S: '#3a8080', h: '#2f5d7c', k: '#ff8a7a', a: '#a9e4e4', c: '#2f5d7c', C: '#1e3e56', l: '#3a8080' },
  humans: { s: '#e8b796', S: '#c08a6a', h: '#5a3a1a', k: '#3a3a5a', a: '#d4af37', c: '#7a3b3b', C: '#4e2626', l: '#4a3020' },
  sunborn: { s: '#c98a3a', S: '#8a5a1a', h: '#8a5a1a', k: '#e8c040', a: '#2a5aa0', m: '#e8c040', z: '#6a9a3a', Z: '#3a5a1a', c: '#e0c068', C: '#a08840', l: '#7a4a1a' },
  keepers: { s: '#b8e0a0', S: '#80a870', g: '#e0ff80', k: '#8a6a40', h: '#4a9a3a', o: '#4a6a3a', a: '#d8f0b0', c: '#3f6b3a', C: '#2a4a26', l: '#6a4a2a' },
  flintborn: { s: '#8a8f98', S: '#5a5e68', h: '#5a5e68', k: '#7af0ff', a: '#c7ccd6', c: '#4a4e57', C: '#33363d', l: '#2a2a30' },
};

/** Seven rows each, the face between columns 4 and 11. */
export const HEADS: Record<RaceId, string[][]> = {
  humans: [
    ['................', '.....dddddd.....', '....dhhhhhhd....', '....dhsssshd....', '....dsessesd....', '....dssssssd....', '.....dsSSsd.....'],
    ['.....dddddd.....', '....dhhhhhhd....', '...dhhhhhhhhd...', '...dhhsssshhd...', '...dhsesseshd...', '...dhsssssshd...', '...dhdsSSsdhd...'],
    ['...dddddddddd...', '....dkkkkkkd....', '..ddkaaaaaakdd..', '....dssssssd....', '....dsessesd....', '....dssssssd....', '.....dsSSsd.....'],
  ],
  nomads: [
    ['....dddddddd....', '...dkkkkkkkkd...', '..dkkhhhhhhkkd..', '..dkhsssssshkd..', '..dkhsesseshkd..', '..dkhsssssshkd..', '...dkkdSSdkkd...'],
    ['.....dddddd.....', '....dhhhhhhd....', '....dhhhhhhd....', '...dhsssssshd...', '...dhsesseshd...', '...dhsssssshd...', '...dadsSSsdad...'],
    ['.....dddddd.....', '....dhhhhhhd....', '....daaaaaadad..', '....dssssssd.a..', '....dsessesd....', '....dssssssd....', '.....dsSSsd.....'],
  ],
  myrmids: [
    ['.......dd.......', '......dkkd......', '.....dkkkkd.....', '....dssssssd....', '...dsweswesd....', '...dssssssssd...', '....dsSSSSsd....'],
    ['................', '.....dddddd.....', '....dssssssd....', '...dssssssssd...', '...dsweswesd....', '...dsssSSsssd...', '...dkdsSSsdkd...'],
    ['....k.k..k.k....', '....dkdkkdkd....', '....dssssssd....', '...dssssssssd...', '...dsweswesd....', '...dssssssssd...', '....dsSSSSsd....'],
  ],
  sunborn: [
    ['...dd......dd...', '...dsd....dsd...', '...dssddddssd...', '....dssssssd....', '....dskssksd....', '.....dsSSsd.....', '......dSSd......'],
    ['................', '....d.d..d.d....', '....dzdzzdzd....', '...dzzzzzzzzd...', '...dzkzzzzkzd...', '...dzzzzzzzzd...', '....dzZZZZzd....'],
    ['....dddddddd....', '...dkakakakad...', '..dkadssssdakd..', '..dkadskksdakd..', '..dkadssssdakd..', '..dkaddSSddakd..', '..ddd..dd..ddd..'],
  ],
  keepers: [
    ['..k.k......k.k..', '...kk......kk...', '....kddddddk....', '....dssssssd....', '....dsgssgsd....', '....dssssssd....', '.....dsSSsd.....'],
    ['....h.h..h.h....', '....dhhhhhhd....', '...hdhhhhhhdh...', '....dssssssd....', '....dsgssgsd....', '....dssssssd....', '.....dsSSsd.....'],
    ['....dddddddd....', '...doooooooood..', '..dooooooooood..', '..doodssssdood..', '..doodgssgdood..', '..doodssssdood..', '...doodSSdood...'],
  ],
  flintborn: [
    ['................', '...dddddddddd...', '..dssssssssssd..', '..dSSSSSSSSSSd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
    ['.....dyyyyd.....', '....dyyLyyyd....', '..dddddddddddd..', '..dssssssssssd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
    ['...k..k..k..k...', '..dkddkddkddkd..', '..dssssssssssd..', '..dSSSSSSSSSSd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
  ],
};

/** Four rows each: rows 7 to 10. */
export const TORSOS: string[][] = [
  ['....dccccccd....', '...dcccaacccd...', '..dsdccccccdsd..', '..dsdCaaaaCdsd..'],
  ['....dmmmmmmd....', '...dmmmaammmd...', '..dsdmmmmmmdsd..', '..dsdCddddCdsd..'],
  ['...dccccccccd...', '..dccccaaccccd..', '..dccccccccccd..', '..dsCccccccCsd..'],
];

/** Five rows each: rows 11 to 15. */
export const LEGS: string[][] = [
  ['....dCCCCCCd....', '....dCCddCCd....', '...dlld..dlld...', '...dlld..dlld...', '...dddd..dddd...'],
  ['....dCCCCCCd....', '....dCCddCCd....', '...dssd..dssd...', '...dssd..dssd...', '..dddd....dddd..'],
  ['....dCCCCCCd....', '....dllddlld....', '...dlad..dlad...', '...dlld..dlld...', '...dddd..dddd...'],
];

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

const run = (x: number, ys: number[], c: string) => ys.map((y) => [x, y, c] as const);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ITEMS: Record<Item, (readonly [number, number, string])[]> = {
  sword: [...run(13, range(3, 9), 'm'), [12, 10, 'a'], [13, 10, 'a'], [14, 10, 'a'], [13, 11, 'i']],
  bow: [[13, 4, 'i'], ...run(14, range(5, 9), 'i'), [13, 10, 'i'], ...run(13, range(5, 9), 'w')],
  trident: [...run(13, range(1, 13), 'i'), [13, 0, 'm'], [12, 0, 'm'], [14, 0, 'm'], [12, 1, 'm'], [14, 1, 'm']],
  staff: [...run(13, range(3, 13), 'i'), [12, 1, 'q'], [13, 1, 'q'], [14, 1, 'q'], [12, 2, 'q'], [13, 2, 'w'], [14, 2, 'q'], [13, 0, 'q']],
  daggers: [[13, 8, 'm'], [13, 9, 'm'], [13, 10, 'a'], [2, 8, 'm'], [2, 9, 'm'], [2, 10, 'a']],
  axe: [...run(13, range(5, 12), 'i'), [14, 4, 'm'], [15, 4, 'm'], [14, 5, 'm'], [15, 5, 'm'], [14, 6, 'm'], [15, 6, 'm'], [14, 7, 'm']],
  spear: [...run(13, range(2, 13), 'i'), [13, 0, 'm'], [13, 1, 'm'], [12, 1, 'm'], [14, 1, 'm']],
  hammer: [...run(13, range(6, 12), 'i'), [12, 4, 'm'], [13, 4, 'm'], [14, 4, 'm'], [12, 5, 'm'], [13, 5, 'm'], [14, 5, 'm']],
};

/** A stride frame: the feet (the last three rows) step outwards. */
function stride(rows: string[]): string[] {
  return rows.map((row, i) => {
    if (i < 2) return row;
    const left = row.slice(0, 8);
    const right = row.slice(8);
    return `${left.slice(1)}.`.slice(0, 8) + `.${right}`.slice(0, 8);
  });
}

/** The rows of the figure, for tests and for anything that needs the bare sprite. */
export function heroRows(race: RaceId, look: HeroLook = DEFAULT_LOOK, frame = 0): string[] {
  const legs = LEGS[look.legs] ?? LEGS[0]!;
  return [...(HEADS[race][look.head] ?? HEADS[race][0]!), ...(TORSOS[look.torso] ?? TORSOS[0]!), ...(frame === 1 ? stride(legs) : legs)];
}

export function PixelHero({ race, profession, look, size = 48, walking = false, facing = 1 }: {
  race: RaceId;
  profession?: ProfessionId;
  look?: HeroLook;
  size?: number;
  walking?: boolean;
  facing?: 1 | -1;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 130);
    return () => clearInterval(timer);
  }, [walking]);
  const prof = profession ? PROFESSION[profession] : null;
  const colour: Palette = { ...BASE, ...RACE_COLOURS[race], ...(prof ? { a: prof.trim } : {}) };
  const rows = heroRows(race, look ?? DEFAULT_LOOK, walking ? frame : 0);
  const item = prof ? ITEMS[prof.item] : [];
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true"
      className={walking ? 'walking' : undefined}
      style={facing === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === '.' || !colour[ch] ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour[ch]} />)),
      )}
      {item.map(([x, y, c]) => <rect key={`i${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour[c]} />)}
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
