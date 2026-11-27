import { useEffect, useId, useState } from 'react';
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
    ['................', '.....dddddd.....', '....dssssssd....', '....dSssssSd....', '....dsessesd....', '....dhsSSshd....', '.....dhhhhd.....'],
    ['.....dddddd.....', '....dccccccd....', '...dccccccccd...', '...dcdssssdcd...', '...dcsesseScd...', '...dcdssssdcd...', '....dcdSSdcd....'],
  ],
  nomads: [
    ['....dddddddd....', '...dkkkkkkkkd...', '..dkkhhhhhhkkd..', '..dkhsssssshkd..', '..dkhsesseshkd..', '..dkhsssssshkd..', '...dkkdSSdkkd...'],
    ['.....dddddd.....', '....dhhhhhhd....', '....dhhhhhhd....', '...dhsssssshd...', '...dhsesseshd...', '...dhsssssshd...', '...dadsSSsdad...'],
    ['.....dddddd.....', '....dhhhhhhd....', '....daaaaaadad..', '....dssssssd.a..', '....dsessesd....', '....dssssssd....', '.....dsSSsd.....'],
    ['.......hh.......', '......dhhd......', '....ddhhhhdd....', '....dssssssd....', '....dsessesd....', '....dskssksd....', '.....dsSSsd.....'],
    ['...d........d...', '...dkd....dkd...', '...dkkddddkkd...', '...dkdssssdkd...', '...dksesseskd...', '....dssssssd....', '.....dsSSsd.....'],
  ],
  myrmids: [
    ['.......dd.......', '......dkkd......', '.....dkkkkd.....', '....dssssssd....', '...dsweswesd....', '...dssssssssd...', '....dsSSSSsd....'],
    ['................', '.....dddddd.....', '....dssssssd....', '...dssssssssd...', '...dsweswesd....', '...dsssSSsssd...', '...dkdsSSsdkd...'],
    ['....k.k..k.k....', '....dkdkkdkd....', '....dssssssd....', '...dssssssssd...', '...dsweswesd....', '...dssssssssd...', '....dsSSSSsd....'],
    ['......dLd.......', '.......d........', '.....dddddd.....', '....dssssssd....', '...dsweswesd....', '...dssssssssd...', '....dsSSSSsd....'],
    ['................', '.....dddddd.....', '..kdssssssssdk..', '..kdssssssssdk..', '...dsweswesd....', '..kdssssssssdk..', '....dsSSSSsd....'],
  ],
  sunborn: [
    ['...dd......dd...', '...dsd....dsd...', '...dssddddssd...', '....dssssssd....', '....dskssksd....', '.....dsSSsd.....', '......dSSd......'],
    ['................', '....d.d..d.d....', '....dzdzzdzd....', '...dzzzzzzzzd...', '...dzkzzzzkzd...', '...dzzzzzzzzd...', '....dzZZZZzd....'],
    ['....dddddddd....', '...dkakakakad...', '..dkadssssdakd..', '..dkadskksdakd..', '..dkadssssdakd..', '..dkaddSSddakd..', '..ddd..dd..ddd..'],
    ['................', '.....dddddd.....', '....dhhhhhhd....', '...dhhssssshd...', '...dhskssskyyd..', '...dhhssssdd....', '....dhhSSd......'],
    ['.....dddddd.....', '...ddzzzzzzdd...', '..dzzzzzzzzzzd..', '..dzZdzzzzdZzd..', '..dzZdkzzkdZzd..', '...dzddzzddzd...', '......dZZd......'],
  ],
  keepers: [
    ['..k.k......k.k..', '...kk......kk...', '....kddddddk....', '....dssssssd....', '....dsgssgsd....', '....dssssssd....', '.....dsSSsd.....'],
    ['....h.h..h.h....', '....dhhhhhhd....', '...hdhhhhhhdh...', '....dssssssd....', '....dsgssgsd....', '....dssssssd....', '.....dsSSsd.....'],
    ['....dddddddd....', '...doooooooood..', '..dooooooooood..', '..doodssssdood..', '..doodgssgdood..', '..doodssssdood..', '...doodSSdood...'],
    ['....dddddddd....', '..ddkkwkkkwkdd..', '.dkwkkkkkkkwkkd.', '.ddddssssssdddd.', '....dsgssgsd....', '....dssssssd....', '.....dsSSsd.....'],
    ['...q.y..q..y....', '...hhhhhhhhhh...', '....dhhhhhhd....', '....dssssssd....', '....dsgssgsd....', '...hdssssssdh...', '...h.dsSSsd.h...'],
  ],
  flintborn: [
    ['................', '...dddddddddd...', '..dssssssssssd..', '..dSSSSSSSSSSd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
    ['.....dyyyyd.....', '....dyyLyyyd....', '..dddddddddddd..', '..dssssssssssd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
    ['...k..k..k..k...', '..dkddkddkddkd..', '..dssssssssssd..', '..dSSSSSSSSSSd..', '..dssessssessd..', '..dssssssssssd..', '...dsSSSSSSsd...'],
    ['................', '...dddddddddd...', '..dssssssssssd..', '..dSSSSSSSSSSd..', '..dssessssessd..', '..dshhhhhhhhsd..', '...dhhhkkhhhd...'],
    ['..d..........d..', '..dd........dd..', '..dsddddddddsd..', '..dsskssssSssd..', '..dssessssessd..', '..dSssssksssSd..', '...dsSSSSSSsd...'],
  ],
};

/** Four rows each: rows 7 to 10. */
export const TORSOS: string[][] = [
  ['....dccccccd....', '...dcccaacccd...', '..dsdccccccdsd..', '..dsdCaaaaCdsd..'],
  ['....dmmmmmmd....', '...dmmmaammmd...', '..dsdmmmmmmdsd..', '..dsdCddddCdsd..'],
  ['...dccccccccd...', '..dccccaaccccd..', '..dccccccccccd..', '..dsCccccccCsd..'],
  ['....dccccccd....', '...dcccaacccd...', '..dsdccccccdsd..', '..dsdyyyyyydsd..'],
  ['....diwwwwid....', '...diiwwwwiid...', '..dsdiiaaiidsd..', '..dsdCCCCCCdsd..'],
];

/** Five rows each: rows 11 to 15. */
export const LEGS: string[][] = [
  ['....dCCCCCCd....', '....dCCddCCd....', '...dlld..dlld...', '...dlld..dlld...', '...dddd..dddd...'],
  ['....dCCCCCCd....', '....dCCddCCd....', '...dssd..dssd...', '...dssd..dssd...', '..dddd....dddd..'],
  ['....dCCCCCCd....', '....dllddlld....', '...dlad..dlad...', '...dlld..dlld...', '...dddd..dddd...'],
  ['....dCCCCCCd....', '...dccccccccd...', '...dcCcCcCcCd...', '....dsd..dsd....', '....ddd..ddd....'],
  ['....dCCCCCCd....', '....dCCddCCd....', '...dmmd..dmmd...', '...dlld..dlld...', '..ddddd..ddddd..'],
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

/** What the hero wears: armour value on each slot (0 for none), a shield, and the weapon in hand. */
export interface Gear {
  head: number; arms: number; torso: number; legs: number;
  shield: boolean;
  weapon: string;
}

/** The weapon an item id is drawn as. */
const WEAPON_SPRITE: Record<string, Item> = {
  dagger: 'daggers', shortSword: 'sword', oneHanded: 'sword', twoHanded: 'axe', minotaurAxe: 'axe', bow: 'bow', longBow: 'bow', crossbow: 'bow',
};

/** Leather, iron or plate by armour value. */
const tier = (v: number) => (v >= 5 ? '#dfe3ec' : v >= 3 ? '#8f96a3' : '#9a6234');

/** Armour pieces and a shield laid over the sprite, pixel by pixel. */
function gearPixels(g: Gear): (readonly [number, number, number, number, string])[] {
  const out: (readonly [number, number, number, number, string])[] = [];
  if (g.head) out.push([4, 0, 8, 1, '#0b0b10'], [4, 1, 8, 2, tier(g.head)], [3, 2, 1, 1, '#0b0b10'], [12, 2, 1, 1, '#0b0b10']);
  if (g.arms) out.push([1, 7, 3, 2, tier(g.arms)], [12, 7, 3, 2, tier(g.arms)], [1, 9, 3, 1, '#0b0b10'], [12, 9, 3, 1, '#0b0b10']);
  if (g.torso) out.push([5, 8, 6, 3, tier(g.torso)], [7, 8, 2, 1, '#0b0b10']);
  if (g.legs) out.push([4, 13, 2, 2, tier(g.legs)], [10, 13, 2, 2, tier(g.legs)]);
  if (g.shield) out.push([0, 8, 4, 5, '#0b0b10'], [0, 9, 3, 3, '#7a4a22'], [1, 10, 1, 1, '#e8c020']);
  return out;
}

/** A colour darkened towards black, for the shade of a chosen colour. */
function shade(hex: string, by = 0.32): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - by)).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

/** The hero's own colours, chosen at creation, over the race's. */
function lookColours(look: HeroLook | undefined): Palette {
  const out: Palette = {};
  if (look?.skin) { out.s = look.skin; out.S = shade(look.skin, 0.26); }
  if (look?.hair) out.h = look.hair;
  if (look?.cloth) { out.c = look.cloth; out.C = shade(look.cloth); }
  return out;
}

type Grid = (string | null)[][];

/**
 * EPX (Scale2x): doubles a pixel picture, rounding off stair-steps on diagonals while keeping
 * edges sharp. Run twice, the 16×16 hero becomes a smooth 64×64 one.
 */
function scale2x(g: Grid): Grid {
  const h = g.length;
  const w = g[0]!.length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : g[y]![x]!);
  const out: Grid = Array.from({ length: h * 2 }, () => Array<string | null>(w * 2).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1); const b = at(x + 1, y); const c = at(x - 1, y); const d = at(x, y + 1);
      let e0 = p; let e1 = p; let e2 = p; let e3 = p;
      if (c === a && c !== d && a !== b) e0 = a;
      if (a === b && a !== c && b !== d) e1 = b;
      if (d === c && d !== b && c !== a) e2 = c;
      if (b === d && b !== a && d !== c) e3 = d;
      out[y * 2]![x * 2] = e0; out[y * 2]![x * 2 + 1] = e1;
      out[y * 2 + 1]![x * 2] = e2; out[y * 2 + 1]![x * 2 + 1] = e3;
    }
  }
  return out;
}

/** The figure as rectangles, one per run of a colour along a row (far fewer shapes than pixels). */
const drawn = new Map<string, { x: number; y: number; w: number; c: string }[]>();
function runs(key: string, make: () => Grid) {
  const hit = drawn.get(key);
  if (hit) return hit;
  const g = make();
  const out: { x: number; y: number; w: number; c: string }[] = [];
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (c && row[x + n] === c) n++;
      if (c) out.push({ x, y, w: n, c });
      x += n;
    }
  });
  if (drawn.size > 300) drawn.clear();
  drawn.set(key, out);
  return out;
}

export function PixelHero({ race, profession, look, size = 48, walking = false, facing = 1, gear }: {
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
  const uid = useId().replace(/:/g, '');
  useEffect(() => {
    if (!walking) return setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 130);
    return () => clearInterval(timer);
  }, [walking]);
  const prof = profession ? PROFESSION[profession] : null;
  const colour: Palette = { ...BASE, ...RACE_COLOURS[race], ...(prof ? { a: prof.trim } : {}), ...lookColours(look) };
  const f = walking ? frame : 0;
  const key = JSON.stringify([race, profession, look, gear, f]);
  const rects = runs(key, () => {
    // The 16×16 picture: the body, then armour, then what the hero holds.
    const grid: Grid = heroRows(race, look ?? DEFAULT_LOOK, f).map((row) => [...row].map((ch) => (ch === '.' ? null : colour[ch] ?? null)));
    if (gear) for (const [x, y, w, h, c] of gearPixels(gear)) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (grid[j]) grid[j]![i] = c;
    const held = gear ? WEAPON_SPRITE[gear.weapon] ?? prof?.item : prof?.item;
    for (const [x, y, c] of held ? ITEMS[held] : []) if (grid[y]) grid[y]![x] = colour[c] ?? null;
    // Small figures on the map stay crisp at 32×32; anything larger is smoothed to 64×64.
    return size <= 30 ? scale2x(grid) : scale2x(scale2x(grid));
  });
  const res = size <= 30 ? 32 : 64;
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${res} ${res}`} shapeRendering="crispEdges" aria-hidden="true"
      className={walking ? 'walking' : undefined}
      style={facing === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />)}
      {res === 64 && (
        // Light from the upper left over the whole figure, for a rounder, less flat look.
        <>
          <defs>
            <mask id={`m${uid}`}>{rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill="#fff" />)}</mask>
            <linearGradient id={`l${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={res} height={res} fill={`url(#l${uid})`} mask={`url(#m${uid})`} />
        </>
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
