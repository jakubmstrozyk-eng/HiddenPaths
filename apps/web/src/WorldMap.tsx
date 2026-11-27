import { memo, useMemo } from 'react';
import { RACES, RACE_IDS, type RaceId, type Text } from '@hp/content';
import { useT } from './i18n';

/**
 * Utopia after the Rift: one continent in a dark sea, its six lands split by the rifts torn from
 * the dark matter in the middle. The layout follows Jacob's pencil sketch in the rules (which race
 * lives where, what each land holds), drawn as a finished, cartographic map: a real coastline,
 * mountain ranges, forests, the capital and its roads, the sacred tree and the fabled lake, the
 * great river of the Sunborn and the Myrmid archipelago.
 *
 * Everything is still and plain SVG: no filters or animation, so it stays light on phones.
 */

const W = 1000;
const H = 700;
const CX = 500;
const CY = 350;

/** Each land as an arc of the compass, clockwise from north, matching the races' homelands. */
const SECTORS: Record<RaceId, { from: number; to: number; ground: string; deep: string }> = {
  nomads: { from: 30, to: 90, ground: '#cfc28c', deep: '#b3a670' },
  myrmids: { from: 90, to: 150, ground: '#9cc7a6', deep: '#78a888' },
  humans: { from: 150, to: 210, ground: '#b5c97e', deep: '#93ab5e' },
  sunborn: { from: 210, to: 270, ground: '#e6c483', deep: '#cfa45e' },
  keepers: { from: 270, to: 330, ground: '#79a865', deep: '#5a8a4c' },
  flintborn: { from: 330, to: 390, ground: '#b1aca1', deep: '#928c80' },
};

const INK = '#2a2620';
const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: CX + r * Math.sin(rad(deg)), y: CY - r * Math.cos(rad(deg)) });
const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** A small seeded random so the map is drawn the same every time. */
function random(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The coast's distance from the middle in each direction: an ellipse, roughened, with the Myrmid bay cut into the south-east. */
function coastR(deg: number) {
  const t = rad(deg);
  const ellipse = 1 / Math.sqrt((Math.sin(t) / 430) ** 2 + (Math.cos(t) / 292) ** 2);
  const rough = 1 + 0.05 * Math.sin(3 * t + 1.3) + 0.035 * Math.sin(7 * t + 0.4) + 0.022 * Math.sin(13 * t + 2.1) + 0.012 * Math.sin(29 * t + 0.7);
  const d = Math.abs(((deg - 122 + 540) % 360) - 180);
  const bay = d < 36 ? 1 - 0.5 * (0.5 + 0.5 * Math.cos((Math.PI * d) / 36)) : 1;
  return ellipse * rough * bay;
}

const COAST = (() => {
  const out: { x: number; y: number }[] = [];
  for (let d = 0; d < 360; d += 1.5) out.push(at(d, coastR(d)));
  return `M${pts(out)} Z`;
})();

/** Spots inside a land, between two shares of the way from the middle to the coast. */
function spots(race: RaceId, count: number, seed: number, near = 0.32, far = 0.9, gap = 30, margin = 6) {
  const { from, to } = SECTORS[race];
  const rnd = random(seed);
  const out: { x: number; y: number; s: number }[] = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 40) {
    const deg = from + margin + rnd() * (to - from - margin * 2);
    const r = Math.max(118, coastR(deg) * (near + rnd() * (far - near)));
    const p = at(deg, r);
    if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < gap)) continue;
    out.push({ ...p, s: 0.8 + rnd() * 0.45 });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** A jagged crack from the dark middle to the coast, along a border between two lands. */
function rift(deg: number, seed: number) {
  const rnd = random(seed);
  const out: { x: number; y: number }[] = [];
  const end = coastR(deg) + 14;
  for (let r = 70; r <= end; r += 16) out.push(at(deg + (rnd() - 0.5) * 4.5, Math.min(r, end)));
  return `M${pts(out)}`;
}

const wedge = (race: RaceId) => {
  const { from, to } = SECTORS[race];
  const arc = [0, 1, 2, 3, 4].map((i) => at(from + ((to - from) * i) / 4, 1300));
  return `M${CX},${CY} L${pts(arc)} Z`;
};

/** A smooth closed blob around a point (lakes, islands). */
function blob(x: number, y: number, rx: number, ry: number, seed: number, n = 14) {
  const rnd = random(seed);
  const p = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + rnd() * 0.3;
    return { x: x + Math.cos(a) * rx * k, y: y + Math.sin(a) * ry * k };
  });
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M${mid(p[n - 1]!, p[0]!).x.toFixed(1)},${mid(p[n - 1]!, p[0]!).y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const m = mid(p[i]!, p[(i + 1) % n]!);
    d += ` Q${p[i]!.x.toFixed(1)},${p[i]!.y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

/** A path that winds from one point to another. */
function meander(a: { x: number; y: number }, b: { x: number; y: number }, seed: number, wiggle = 18, steps = 9) {
  const rnd = random(seed);
  const nx = -(b.y - a.y);
  const ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  const p = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const off = i === 0 || i === steps ? 0 : Math.sin(t * Math.PI * 3 + rnd()) * wiggle * (0.6 + rnd() * 0.5);
    return { x: a.x + (b.x - a.x) * t + (nx / len) * off, y: a.y + (b.y - a.y) * t + (ny / len) * off };
  });
  let d = `M${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const m = { x: (p[i]!.x + p[i + 1]!.x) / 2, y: (p[i]!.y + p[i + 1]!.y) / 2 };
    d += ` Q${p[i]!.x.toFixed(1)},${p[i]!.y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  }
  return `${d} L${p[p.length - 1]!.x.toFixed(1)},${p[p.length - 1]!.y.toFixed(1)}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Map symbols                                                                                  */
/* ------------------------------------------------------------------------------------------ */

type P = { x: number; y: number; s: number };
const g = (p: P, children: React.ReactNode, key?: string | number) => <g key={key} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${p.s.toFixed(2)})`}>{children}</g>;

const mountain = (p: P, i: string | number, snow = true) => g(p, <>
  <path d="M-20,10 L-2,-20 L18,10 Z" fill="#9b958a" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
  <path d="M-2,-20 L18,10 L3,10 L4,-4 Z" fill="#7c766b" />
  {snow && <path d="M-8,-10 L-2,-20 L4,-10 L1,-7 L-2,-10 L-5,-7 Z" fill="#f6f4ee" />}
</>, i);
const hill = (p: P, i: string | number, fill = '#a4a08f') => g(p, <path d="M-16,6 Q-4,-12 14,6 Z" fill={fill} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />, i);
const tree = (p: P, i: string | number, tone = '#3f7a3a') => g(p, <>
  <rect x="-1.2" y="3" width="2.4" height="6" fill="#5a3a1a" />
  <circle r="7.5" fill={tone} stroke={INK} strokeWidth="1.1" />
  <path d="M2,-6 A7.5,7.5 0 0 1 2,6.5 A6,6 0 0 0 2,-6 Z" fill="#000" opacity="0.18" />
</>, i);
const pine = (p: P, i: string | number) => g(p, <path d="M0,-13 L8,2 L3,2 L10,11 L-10,11 L-3,2 L-8,2 Z" fill="#46684a" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />, i);
const yurt = (p: P, i: string | number) => g(p, <>
  <path d="M-10,6 L-10,-1 Q0,-11 10,-1 L10,6 Z" fill="#f0e6cc" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
  <path d="M-10,0 Q0,-4 10,0" fill="none" stroke="#b0503a" strokeWidth="1.6" />
  <rect x="-2.2" y="1" width="4.4" height="5" fill="#6a4a2a" />
</>, i);
const grass = (p: P, i: string | number) => g(p, <path d="M-5,3 L-6,-3 M0,3 L0,-5 M5,3 L6,-3" stroke="#8a7f48" strokeWidth="1.3" strokeLinecap="round" />, i);
const dune = (p: P, i: string | number) => g(p, <path d="M-16,4 Q-6,-6 4,2 Q10,-3 16,3" fill="none" stroke="#b88a46" strokeWidth="1.5" strokeLinecap="round" />, i);
const pyramid = (p: P, i: string | number) => g(p, <>
  <path d="M-17,9 L0,-15 L17,9 Z" fill="#e8c06a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
  <path d="M0,-15 L17,9 L4,9 Z" fill="#c49a4a" />
</>, i);
const palm = (p: P, i: string | number) => g(p, <>
  <path d="M0,9 Q2,0 0,-7" stroke="#6a4a1a" strokeWidth="1.8" fill="none" />
  <path d="M0,-7 Q-8,-11 -12,-4 M0,-7 Q8,-11 12,-4 M0,-7 Q-4,-14 -9,-13 M0,-7 Q4,-14 9,-13" stroke="#3a7a3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
</>, i);
const house = (p: P, i: string | number) => g(p, <>
  <rect x="-5" y="-2" width="10" height="7" fill="#efe6d4" stroke={INK} strokeWidth="1" />
  <path d="M-6.5,-2 L0,-8 L6.5,-2 Z" fill="#b0503a" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
</>, i);
const field = (p: P, i: string | number, rot: number) => (
  <g key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${rot})`}>
    <rect x="-15" y="-9" width="14" height="9" fill="#d8cc72" stroke="#8a8040" strokeWidth="0.8" />
    <rect x="1" y="-9" width="14" height="9" fill="#a8bc68" stroke="#7a8a40" strokeWidth="0.8" />
    <rect x="-15" y="1" width="30" height="8" fill="#c8b860" stroke="#8a8040" strokeWidth="0.8" />
  </g>
);
const stilt = (p: P, i: string | number) => g(p, <>
  <path d="M-6,4 L-6,11 M6,4 L6,11 M0,4 L0,11" stroke="#5a3a1a" strokeWidth="1.4" />
  <rect x="-8" y="-3" width="16" height="7" fill="#d4ac74" stroke={INK} strokeWidth="1" />
  <path d="M-10,-3 L0,-10 L10,-3 Z" fill="#8a5a3a" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
</>, i);
const wave = (p: P, i: string | number) => g(p, <path d="M-9,0 Q-4.5,-3.5 0,0 Q4.5,3.5 9,0" fill="none" stroke="#7fb4cc" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />, i);

/** The capital of the Humans: walls with towers around a keep, after the octagon in the sketch. */
function City({ x, y }: { x: number; y: number }) {
  const ring = (r: number) => Array.from({ length: 8 }, (_, i) => ({ x: x + r * Math.sin(rad(i * 45 + 22.5)), y: y - r * Math.cos(rad(i * 45 + 22.5)) }));
  const wall = ring(30);
  return (
    <g>
      <polygon points={pts(wall)} fill="#e6dcc6" stroke={INK} strokeWidth="2" />
      <polygon points={pts(ring(19))} fill="#cfc2a4" stroke={INK} strokeWidth="1.2" />
      <polygon points={pts(ring(9))} fill="#b0503a" stroke={INK} strokeWidth="1.2" />
      {wall.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#cfc2a4" stroke={INK} strokeWidth="1.2" />)}
      <path d={`M${x},${y - 9} L${x},${y - 22}`} stroke={INK} strokeWidth="1.3" />
      <path d={`M${x},${y - 22} L${x + 9},${y - 19} L${x},${y - 16}`} fill="#e2b23a" stroke={INK} strokeWidth="0.8" />
    </g>
  );
}

function SacredTree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="40" fill="#f4ff9a" opacity="0.14" />
      <path d="M-4,22 Q-2,6 -9,-4 M4,22 Q2,6 9,-4 M0,22 L0,0" stroke="#4a2e14" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="-14" r="20" fill="#2f6e2c" stroke={INK} strokeWidth="1.6" />
      <circle cx="-13" cy="-4" r="11" fill="#3b8034" stroke={INK} strokeWidth="1.3" />
      <circle cx="13" cy="-5" r="11" fill="#3b8034" stroke={INK} strokeWidth="1.3" />
      <circle cx="-6" cy="-22" r="3.2" fill="#f4ff9a" />
      <circle cx="7" cy="-12" r="2.2" fill="#f4ff9a" />
      <circle cx="-10" cy="-6" r="1.8" fill="#f4ff9a" />
    </g>
  );
}

function Compass({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <circle r="30" fill="none" stroke="#c9d6dc" strokeWidth="1" opacity="0.6" />
      <circle r="24" fill="none" stroke="#c9d6dc" strokeWidth="0.6" opacity="0.4" />
      <path d="M0,-34 L5,-5 L0,0 Z M0,34 L-5,5 L0,0 Z M34,0 L5,5 L0,0 Z M-34,0 L-5,-5 L0,0 Z" fill="#e8eef0" />
      <path d="M0,-34 L-5,-5 L0,0 Z M0,34 L5,5 L0,0 Z M34,0 L5,-5 L0,0 Z M-34,0 L-5,5 L0,0 Z" fill="#7d9aa6" />
      <path d="M0,-18 L3,-3 L18,0 L3,3 L0,18 L-3,3 L-18,0 L-3,-3 Z" fill="#7d9aa6" opacity="0.6" transform="rotate(45)" />
      <text y="-40" textAnchor="middle" className="compass">N</text>
    </g>
  );
}

/** Small names of places, shown when there is room for them. */
const PLACES: { text: Text; deg: number; share: number; dy?: number }[] = [
  { text: { pl: 'Stolica', en: 'The Capital' }, deg: 180, share: 0.5, dy: 46 },
  { text: { pl: 'Święte Drzewo', en: 'The Sacred Tree' }, deg: 312, share: 0.42, dy: 40 },
  { text: { pl: 'Bajeczne Jezioro', en: 'The Fabled Lake' }, deg: 290, share: 0.66, dy: 52 },
  { text: { pl: 'Wielka Rzeka', en: 'The Great River' }, deg: 236, share: 0.6, dy: 0 },
  { text: { pl: 'Tundra', en: 'Tundra' }, deg: 52, share: 0.86, dy: 4 },
  { text: { pl: 'Archipelag', en: 'Archipelago' }, deg: 124, share: 1.45, dy: 0 },
  { text: { pl: 'Kaniony', en: 'Canyons' }, deg: 258, share: 0.82, dy: 0 },
  { text: { pl: 'Góry Bez Końca', en: 'Endless Peaks' }, deg: 2, share: 0.82, dy: -6 },
];

/* ------------------------------------------------------------------------------------------ */

/** Everything that never changes: drawn once. */
const Terrain = memo(function Terrain({ placeNames }: { placeNames: string[] }) {
  const d = useMemo(() => {
    const city = at(180, coastR(180) * 0.5);
    const tree = at(312, coastR(312) * 0.42);
    const lake = at(290, coastR(290) * 0.66);
    const away = (list: P[], from: { x: number; y: number }[], r: number) => list.filter((p) => from.every((f) => Math.hypot(p.x - f.x, p.y - f.y) > r));
    const tundraEdge: { x: number; y: number }[] = [];
    for (let deg = 28; deg <= 92; deg += 4) tundraEdge.push(at(deg, coastR(deg) * (0.74 + 0.04 * Math.sin(deg * 0.4))));
    const riverFrom = at(246, 150);
    const riverTo = at(226, coastR(226) + 8);
    return {
      city, tree, lake,
      tundra: `M${pts(tundraEdge)} L${pts([at(92, 1300), at(60, 1300), at(28, 1300)])} Z`,
      river: meander(riverFrom, riverTo, 7, 22),
      riverBranch: meander(at(262, 210), at(240, coastR(240) * 0.62), 9, 10, 6),
      roads: [at(150, coastR(150) * 0.86), at(208, coastR(208) * 0.82), at(180, 140), at(166, coastR(166) * 0.95)].map((to, i) => meander(city, to, 30 + i, 9, 6)),
      flint: { peaks: spots('flintborn', 30, 61, 0.36, 0.92, 30, 4), hills: spots('flintborn', 6, 62, 0.85, 0.97, 34, 4) },
      nomads: { yurts: spots('nomads', 6, 11, 0.4, 0.7, 50), grass: spots('nomads', 22, 12, 0.32, 0.72, 26), pines: spots('nomads', 12, 13, 0.78, 0.96, 26, 4) },
      humans: {
        houses: away(spots('humans', 9, 31, 0.35, 0.95, 36), [city], 48),
        fields: away(spots('humans', 7, 32, 0.38, 0.9, 50), [city], 54),
        trees: away(spots('humans', 12, 33, 0.7, 0.98, 18, 3), [city], 60),
      },
      sunborn: { pyramids: spots('sunborn', 4, 41, 0.45, 0.8, 70), dunes: spots('sunborn', 16, 42, 0.3, 0.95, 30), palms: spots('sunborn', 6, 43, 0.4, 0.75, 34), canyons: spots('sunborn', 3, 44, 0.75, 0.92, 60, 5) },
      keepers: { trees: away(spots('keepers', 46, 51, 0.3, 0.97, 18, 3), [tree, lake], 52) },
      myrmids: {
        shore: spots('myrmids', 6, 23, 0.55, 0.92, 34),
        lagoons: spots('myrmids', 3, 26, 0.45, 0.7, 60, 10),
        reeds: spots('myrmids', 8, 24, 0.35, 0.9, 26),
        islands: (() => {
          const rnd = random(25);
          const out: P[] = [];
          let tries = 0;
          while (out.length < 12 && tries++ < 600) {
            const deg = 92 + rnd() * 58;
            const p = at(deg, coastR(deg) * (1.1 + rnd() * 0.75));
            if (p.x > 960 || p.y > 660 || p.x < 40) continue;
            if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 50)) continue;
            out.push({ ...p, s: 0.7 + rnd() * 0.7 });
          }
          return out;
        })(),
      },
      waves: (() => {
        const rnd = random(77);
        const out: P[] = [];
        let tries = 0;
        while (out.length < 34 && tries++ < 800) {
          const p = { x: 30 + rnd() * 940, y: 30 + rnd() * 640, s: 0.8 + rnd() * 0.6 };
          const deg = ((Math.atan2(p.x - CX, -(p.y - CY)) * 180) / Math.PI + 360) % 360;
          if (Math.hypot(p.x - CX, p.y - CY) < coastR(deg) + 26) continue;
          if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 60)) continue;
          out.push(p);
        }
        return out;
      })(),
    };
  }, []);

  return (
    <g pointerEvents="none">
      {/* The sea, its shallows and the waves. */}
      <path d={COAST} fill="none" stroke="#2c5a70" strokeWidth="38" strokeLinejoin="round" opacity="0.45" />
      <path d={COAST} fill="none" stroke="#3f7a90" strokeWidth="18" strokeLinejoin="round" opacity="0.5" />
      {d.waves.map((p, i) => wave(p, i))}
      {d.myrmids.islands.map((p, i) => (
        <g key={`is${i}`}>
          <path d={blob(p.x, p.y, 20 * p.s, 12 * p.s, 300 + i)} fill="#3f7a90" opacity="0.5" />
          <path d={blob(p.x, p.y, 14 * p.s, 8.5 * p.s, 300 + i)} fill="#ecdcab" stroke={INK} strokeWidth="1.1" />
          <path d={blob(p.x - 1, p.y - 1, 8 * p.s, 4.6 * p.s, 400 + i)} fill="#7ab070" />
          {i % 3 === 0 && stilt({ x: p.x + 2, y: p.y - 6, s: 0.8 }, `st${i}`)}
          {i % 3 === 1 && palm({ x: p.x, y: p.y - 6, s: 0.7 }, `pa${i}`)}
        </g>
      ))}

      {/* The continent. */}
      <g clipPath="url(#continent)">
        {RACE_IDS.map((r) => <path key={r} d={wedge(r)} fill={`url(#ground-${r})`} />)}
        <path d={d.tundra} fill="#e6e8e0" />
        <path d={COAST} fill="url(#relief)" />
      </g>
      <path d={COAST} fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />

      {/* Water on land. */}
      <path d={d.river} fill="none" stroke="#2c5a70" strokeWidth="9" strokeLinecap="round" />
      <path d={d.river} fill="none" stroke="#6fb0cc" strokeWidth="5.5" strokeLinecap="round" />
      <path d={d.riverBranch} fill="none" stroke="#2c5a70" strokeWidth="5" strokeLinecap="round" />
      <path d={d.riverBranch} fill="none" stroke="#6fb0cc" strokeWidth="2.6" strokeLinecap="round" />
      <path d={blob(d.lake.x, d.lake.y, 58, 34, 5)} fill="#6fb0cc" stroke={INK} strokeWidth="1.6" />
      <path d={blob(d.lake.x + 4, d.lake.y + 2, 40, 21, 6)} fill="#5a9ebc" />

      {/* Roads from the capital. */}
      {d.roads.map((r, i) => <path key={i} d={r} fill="none" stroke="#7a5a32" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" opacity="0.8" />)}

      {d.nomads.grass.map((p, i) => grass(p, `g${i}`))}
      {d.nomads.pines.map((p, i) => pine(p, `p${i}`))}
      {d.nomads.yurts.map((p, i) => yurt(p, `y${i}`))}

      {d.myrmids.lagoons.map((p, i) => <path key={`l${i}`} d={blob(p.x, p.y, 16 * p.s, 9 * p.s, 500 + i)} fill="#6fb0cc" stroke={INK} strokeWidth="1.1" />)}
      {d.myrmids.reeds.map((p, i) => grass(p, `r${i}`))}
      {d.myrmids.shore.map((p, i) => stilt(p, `s${i}`))}

      {d.humans.fields.map((p, i) => field(p, i, (i * 37) % 50 - 25))}
      {d.humans.trees.map((p, i) => tree(p, `t${i}`, '#4f8a40'))}
      {d.humans.houses.map((p, i) => house(p, `h${i}`))}
      <City {...d.city} />

      {d.sunborn.canyons.map((p, i) => <path key={`c${i}`} d={meander({ x: p.x - 40, y: p.y - 10 }, { x: p.x + 30, y: p.y + 14 }, 90 + i, 6, 5)} fill="none" stroke="#a86a34" strokeWidth="3" strokeLinecap="round" />)}
      {d.sunborn.dunes.map((p, i) => dune(p, `d${i}`))}
      {d.sunborn.palms.map((p, i) => palm(p, `pa${i}`))}
      {d.sunborn.pyramids.map((p, i) => pyramid(p, `py${i}`))}

      {d.keepers.trees.map((p, i) => tree(p, `k${i}`, i % 3 ? '#356e30' : '#478438'))}
      <SacredTree {...d.tree} />

      {d.flint.hills.map((p, i) => hill(p, `hl${i}`))}
      {d.flint.peaks.map((p, i) => mountain(p, `m${i}`, p.s > 0.95))}

      {/* The rifts between the lands, and the dark matter welling up in the middle. */}
      {RACE_IDS.map((r, i) => (
        <g key={`rift-${r}`}>
          <path d={rift(SECTORS[r].from, 100 + i)} stroke="#8f7bff" strokeWidth="11" fill="none" opacity="0.22" strokeLinejoin="round" />
          <path d={rift(SECTORS[r].from, 100 + i)} stroke="#0b0618" strokeWidth="4.5" fill="none" strokeLinejoin="round" />
        </g>
      ))}
      <circle cx={CX} cy={CY} r="128" fill="url(#matter)" />
      <path d={blob(CX, CY, 66, 58, 13, 18)} fill="#05030a" stroke="#3a2470" strokeWidth="2" />
      <path d={blob(CX - 6, CY + 4, 34, 28, 14, 12)} fill="#000" />

      {PLACES.map((pl, i) => {
        const p = at(pl.deg, coastR(pl.deg) * pl.share);
        return <text key={i} x={p.x} y={p.y + (pl.dy ?? 0)} textAnchor="middle" className={`place-label ${pl.share > 1 ? 'sea' : ''}`}>{placeNames[i]}</text>;
      })}
      <Compass x={905} y={600} />
    </g>
  );
});

/** Where each land's name sits. */
const LABEL: Record<RaceId, { deg: number; share: number; x?: number; y?: number }> = {
  nomads: { deg: 62, share: 0.56 },
  myrmids: { deg: 104, share: 0.62 },
  humans: { deg: 180, share: 0.76 },
  sunborn: { deg: 244, share: 0.3 },
  keepers: { deg: 300, share: 0.6, x: 300, y: 262 },
  flintborn: { deg: 358, share: 0.5 },
};

export function WorldMap({ focus, onFocus, onChoose }: { focus: RaceId | null; onFocus: (r: RaceId) => void; onChoose?: (r: RaceId) => void }) {
  const { tx } = useT();
  const placeNames = PLACES.map((p) => tx(p.text));
  return (
    <svg className="world-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Utopia">
      <defs>
        <radialGradient id="sea" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#1d4456" />
          <stop offset="100%" stopColor="#0c1c26" />
        </radialGradient>
        <radialGradient id="matter">
          <stop offset="0%" stopColor="#000" />
          <stop offset="50%" stopColor="#120a26" stopOpacity="0.95" />
          <stop offset="78%" stopColor="#3a2470" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8f7bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="relief" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
        {RACE_IDS.map((r) => (
          <radialGradient key={r} id={`ground-${r}`} cx={CX} cy={CY} r="520" gradientUnits="userSpaceOnUse">
            <stop offset="20%" stopColor={SECTORS[r].deep} />
            <stop offset="70%" stopColor={SECTORS[r].ground} />
          </radialGradient>
        ))}
        <clipPath id="continent"><path d={COAST} /></clipPath>
        <clipPath id="lands"><path d={`${COAST} M${CX + 72},${CY} A72,72 0 1 0 ${CX - 72},${CY} A72,72 0 1 0 ${CX + 72},${CY} Z`} clipRule="evenodd" /></clipPath>
      </defs>

      <rect width={W} height={H} fill="url(#sea)" />
      <Terrain placeNames={placeNames} />

      {/* Lands to point at: the one in focus is lit, the rest dimmed. */}
      <g clipPath="url(#lands)">
        {RACE_IDS.map((r) => (
          <path
            key={r}
            d={wedge(r)}
            className={`land ${focus === r ? 'focus' : focus ? 'dim' : ''}`}
            onMouseEnter={() => onFocus(r)}
            onClick={() => (focus === r && onChoose ? onChoose(r) : onFocus(r))}
          />
        ))}
      </g>

      {RACE_IDS.map((r) => {
        const l = LABEL[r];
        const p = l.x !== undefined && l.y !== undefined ? { x: l.x, y: l.y } : at(l.deg, coastR(l.deg) * l.share);
        const name = tx(RACES[r].name).toUpperCase();
        return (
          <g key={`label-${r}`} className={`land-label ${focus === r ? 'focus' : ''}`} onMouseEnter={() => onFocus(r)} onClick={() => (focus === r && onChoose ? onChoose(r) : onFocus(r))}>
            <rect x={p.x - name.length * 9 - 14} y={p.y - 22} width={name.length * 18 + 28} height="34" rx="6" />
            <text x={p.x} y={p.y + 4} textAnchor="middle">{name}</text>
          </g>
        );
      })}
    </svg>
  );
}
