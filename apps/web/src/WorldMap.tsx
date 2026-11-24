import { useMemo } from 'react';
import { RACES, RACE_IDS, type RaceId } from '@hp/content';
import { useT } from './i18n';

/**
 * Utopia after the Rift, drawn after the hand-made map in the rules: six lands around the dark
 * matter that welled up from the middle of the world, split by the rifts it tore. Each land
 * belongs to one race and is drawn with what the rules say of it.
 */

const W = 1000;
const H = 700;
const CX = 500;
const CY = 350;

/** Each land as an arc of the compass, clockwise from north, matching the races' homelands. */
const SECTORS: Record<RaceId, { from: number; to: number; ground: [string, string] }> = {
  nomads: { from: 30, to: 90, ground: ['#d8cf98', '#a9a070'] },
  myrmids: { from: 90, to: 150, ground: ['#6fb0cc', '#2f6a8a'] },
  humans: { from: 150, to: 210, ground: ['#c8d68a', '#8aa058'] },
  sunborn: { from: 210, to: 270, ground: ['#ecd093', '#c09a52'] },
  keepers: { from: 270, to: 330, ground: ['#7fae6a', '#3f6e3a'] },
  flintborn: { from: 330, to: 390, ground: ['#b4aea2', '#7a746a'] },
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: CX + r * Math.sin(rad(deg)), y: CY - r * Math.cos(rad(deg)) });

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

/** Spots inside a land, away from the dark middle and the edges of the sheet. */
function spots(race: RaceId, count: number, seed: number, rMin = 130, rMax = 520) {
  const { from, to } = SECTORS[race];
  const rnd = random(seed);
  const out: { x: number; y: number; s: number }[] = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 30) {
    const p = at(from + 5 + rnd() * (to - from - 10), rMin + rnd() * (rMax - rMin));
    if (p.x < 50 || p.x > W - 50 || p.y < 50 || p.y > H - 40) continue;
    if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 34)) continue;
    out.push({ ...p, s: 0.8 + rnd() * 0.5 });
  }
  return out.sort((a, b) => a.y - b.y);
}

const wedge = (race: RaceId) => {
  const { from, to } = SECTORS[race];
  const pts = [from, (from * 2 + to) / 3, (from + 2 * to) / 3, to].map((d) => at(d, 1200));
  return `M${CX},${CY} ${pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} Z`;
};

/** A jagged crack from the middle to the edge of the world, along a border between two lands. */
function rift(deg: number, seed: number) {
  const rnd = random(seed);
  const pts: string[] = [];
  for (let r = 60; r <= 640; r += 26) {
    const p = at(deg + (rnd() - 0.5) * 5, r);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

/* The little drawings on the map. */
const Mountain = ({ x, y, s, snow = true }: { x: number; y: number; s: number; snow?: boolean }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-22,12 L0,-22 L22,12 Z" fill="#8f897e" stroke="#3a352e" strokeWidth="1.6" />
    <path d="M0,-22 L22,12 L6,12 Z" fill="#6c665c" />
    {snow && <path d="M-7,-11 L0,-22 L7,-11 L3,-8 L0,-11 L-3,-8 Z" fill="#f4f1ea" />}
  </g>
);
const Tree = ({ x, y, s, tone = '#2f5a2a' }: { x: number; y: number; s: number; tone?: string }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-1.5" y="2" width="3" height="8" fill="#5a3a1a" />
    <circle r="9" fill={tone} stroke="#1a3018" strokeWidth="1.4" />
    <circle cx="-3" cy="-3" r="3.5" fill="#ffffff" opacity="0.15" />
  </g>
);
const Pine = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M0,-14 L9,4 L-9,4 Z M0,-6 L11,10 L-11,10 Z" fill="#3d5a3a" stroke="#1e2e1c" strokeWidth="1.2" />
  </g>
);
const Tent = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-12,8 L0,-12 L12,8 Z" fill="#e6d6ae" stroke="#5a4628" strokeWidth="1.5" />
    <path d="M0,-12 L0,8 M-3,8 L0,0 L3,8" stroke="#5a4628" strokeWidth="1.3" fill="#8a6a3a" />
    <path d="M0,-12 L-3,-17 M0,-12 L3,-17" stroke="#5a4628" strokeWidth="1.3" />
  </g>
);
const Grass = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`} stroke="#7a7240" strokeWidth="1.5" strokeLinecap="round">
    <path d="M-6,4 L-8,-4 M0,4 L0,-6 M6,4 L8,-4" />
  </g>
);
const Pyramid = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-20,10 L0,-16 L20,10 Z" fill="#e2b85a" stroke="#6a4a1a" strokeWidth="1.5" />
    <path d="M0,-16 L20,10 L4,10 Z" fill="#b88a3a" />
    <path d="M-12,0 L0,0 M-16,5 L0,5" stroke="#6a4a1a" strokeWidth="0.8" opacity="0.6" />
  </g>
);
const Dune = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill="none" stroke="#a07a3a" strokeWidth="1.6" strokeLinecap="round">
    <path d="M-16,4 Q-6,-6 4,2 Q10,-3 16,3" />
  </g>
);
const Palm = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M0,10 Q2,0 0,-8" stroke="#6a4a1a" strokeWidth="2" fill="none" />
    <path d="M0,-8 Q-9,-12 -13,-5 M0,-8 Q9,-12 13,-5 M0,-8 Q-5,-16 -10,-15 M0,-8 Q5,-16 10,-15" stroke="#2f7a3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </g>
);
const Island = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-16,2 C-14,-8 -2,-10 6,-7 C16,-4 18,4 10,8 C2,12 -14,10 -16,2 Z" fill="#e8d6a0" stroke="#6a5a3a" strokeWidth="1.3" />
    <ellipse cx="0" cy="-1" rx="8" ry="4.5" fill="#5a9a4a" />
  </g>
);
const Wave = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill="none" stroke="#d8f0ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7">
    <path d="M-10,0 Q-5,-4 0,0 Q5,4 10,0" />
  </g>
);
const Stilts = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-7,4 L-7,12 M7,4 L7,12 M0,4 L0,12" stroke="#5a3a1a" strokeWidth="1.6" />
    <rect x="-9" y="-4" width="18" height="9" fill="#c8a06a" stroke="#5a3a1a" strokeWidth="1.3" />
    <path d="M-11,-4 L0,-12 L11,-4 Z" fill="#8a5a3a" stroke="#5a3a1a" strokeWidth="1.3" />
  </g>
);
const House = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-6" y="-3" width="12" height="9" fill="#e8dcc8" stroke="#4a3a2a" strokeWidth="1.2" />
    <path d="M-8,-3 L0,-10 L8,-3 Z" fill="#a04a3a" stroke="#4a3a2a" strokeWidth="1.2" />
  </g>
);
const Field = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(-12)`}>
    <rect x="-14" y="-7" width="28" height="14" fill="#e0d070" stroke="#8a7a30" strokeWidth="1" opacity="0.85" />
    <path d="M-14,-2 L14,-2 M-14,3 L14,3" stroke="#a89a40" strokeWidth="1" />
  </g>
);

/** The great city of the Humans: walls with towers around a keep, after the octagon in the sketch. */
function City({ x, y }: { x: number; y: number }) {
  const ring = (r: number, n = 8) => Array.from({ length: n }, (_, i) => at(i * (360 / n) + 22.5, r)).map((p) => ({ x: p.x - CX + x, y: p.y - CY + y }));
  const wall = ring(46);
  return (
    <g>
      <polygon points={wall.map((p) => `${p.x},${p.y}`).join(' ')} fill="#d8ccb4" stroke="#4a3a2a" strokeWidth="2.5" />
      <polygon points={ring(30).map((p) => `${p.x},${p.y}`).join(' ')} fill="#c4b698" stroke="#4a3a2a" strokeWidth="1.5" />
      <polygon points={ring(14).map((p) => `${p.x},${p.y}`).join(' ')} fill="#a04a3a" stroke="#4a3a2a" strokeWidth="1.5" />
      {wall.map((p, i) => <rect key={i} x={p.x - 5} y={p.y - 5} width="10" height="10" fill="#b8aa8a" stroke="#4a3a2a" strokeWidth="1.5" />)}
      <path d={`M${x},${y - 14} L${x},${y - 30}`} stroke="#4a3a2a" strokeWidth="1.5" />
      <path d={`M${x},${y - 30} L${x + 10},${y - 26} L${x},${y - 22}`} fill="#d4af37" />
    </g>
  );
}

function SacredTree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M-4,22 Q-2,6 -8,-4 M4,22 Q2,6 8,-4 M0,22 L0,0" stroke="#4a2e14" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="-16" r="24" fill="#2f6a2a" stroke="#14300f" strokeWidth="2" />
      <circle cx="-14" cy="-6" r="12" fill="#3a7a32" stroke="#14300f" strokeWidth="1.5" />
      <circle cx="15" cy="-7" r="12" fill="#3a7a32" stroke="#14300f" strokeWidth="1.5" />
      <circle cx="-6" cy="-24" r="5" fill="#e0ff80" opacity="0.7" />
      <circle cx="8" cy="-14" r="3" fill="#e0ff80" opacity="0.6" />
    </g>
  );
}

/** What each land shows, placed once. */
function useDecor() {
  return useMemo(() => {
    const lake = at(292, 330);
    const city = at(180, 250);
    const tree = at(306, 230);
    return { lake, city, tree };
  }, []);
}

export function WorldMap({ focus, onFocus, onChoose }: { focus: RaceId | null; onFocus: (r: RaceId) => void; onChoose?: (r: RaceId) => void }) {
  const { tx } = useT();
  const d = useDecor();
  const decor = useMemo(() => ({
    nomads: { tents: spots('nomads', 7, 11, 170, 420), grass: spots('nomads', 18, 12, 140, 560), pines: spots('nomads', 6, 13, 380, 560) },
    myrmids: { islands: spots('myrmids', 9, 21, 150, 560), waves: spots('myrmids', 16, 22, 130, 600), stilts: spots('myrmids', 4, 23, 200, 420) },
    humans: { houses: spots('humans', 10, 31, 140, 420).filter((p) => Math.hypot(p.x - d.city.x, p.y - d.city.y) > 70), fields: spots('humans', 6, 32, 160, 420).filter((p) => Math.hypot(p.x - d.city.x, p.y - d.city.y) > 70) },
    sunborn: { pyramids: spots('sunborn', 5, 41, 180, 460), dunes: spots('sunborn', 14, 42, 140, 560), palms: spots('sunborn', 7, 43, 130, 300) },
    keepers: { trees: spots('keepers', 26, 51, 130, 560).filter((p) => Math.hypot(p.x - d.lake.x, (p.y - d.lake.y) * 1.6) > 70 && Math.hypot(p.x - d.tree.x, p.y - d.tree.y) > 40) },
    flintborn: { peaks: spots('flintborn', 18, 61, 130, 560) },
  }), [d]);

  const label = (race: RaceId) => {
    const { from, to } = SECTORS[race];
    return at((from + to) / 2, race === 'humans' ? 215 : race === 'myrmids' || race === 'keepers' ? 250 : 270);
  };

  return (
    <svg className="world-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Utopia">
      <defs>
        <filter id="paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.15  0 0 0 0.22 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="rough" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="14" />
        </filter>
        <filter id="glow"><feGaussianBlur stdDeviation="6" /></filter>
        <radialGradient id="matter">
          <stop offset="0%" stopColor="#000" />
          <stop offset="55%" stopColor="#0b0618" />
          <stop offset="80%" stopColor="#2a1050" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8f7bff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="65%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#2a1a08" stopOpacity="0.55" />
        </radialGradient>
        {RACE_IDS.map((r) => (
          <linearGradient key={r} id={`ground-${r}`} gradientTransform={`rotate(${(SECTORS[r].from + SECTORS[r].to) / 2})`}>
            <stop offset="0%" stopColor={SECTORS[r].ground[0]} />
            <stop offset="100%" stopColor={SECTORS[r].ground[1]} />
          </linearGradient>
        ))}
        <clipPath id="world"><rect x="24" y="24" width={W - 48} height={H - 48} rx="18" /></clipPath>
      </defs>

      <rect width={W} height={H} fill="#e9dcbc" rx="22" />
      <g clipPath="url(#world)">
        {RACE_IDS.map((r) => (
          <path
            key={r}
            d={wedge(r)}
            fill={`url(#ground-${r})`}
            className={`land ${focus === r ? 'focus' : focus ? 'dim' : ''}`}
            onMouseEnter={() => onFocus(r)}
            onClick={() => onFocus(r)}
          />
        ))}

        <g pointerEvents="none">
          {decor.nomads.grass.map((p, i) => <Grass key={`g${i}`} {...p} />)}
          {decor.nomads.pines.map((p, i) => <Pine key={`p${i}`} {...p} />)}
          {decor.nomads.tents.map((p, i) => <Tent key={`t${i}`} {...p} />)}

          {decor.myrmids.waves.map((p, i) => <Wave key={`w${i}`} {...p} />)}
          {decor.myrmids.islands.map((p, i) => <Island key={`i${i}`} {...p} />)}
          {decor.myrmids.stilts.map((p, i) => <Stilts key={`s${i}`} {...p} />)}

          {decor.humans.fields.map((p, i) => <Field key={`f${i}`} {...p} />)}
          {decor.humans.houses.map((p, i) => <House key={`h${i}`} {...p} />)}
          <City {...d.city} />

          {decor.sunborn.dunes.map((p, i) => <Dune key={`d${i}`} {...p} />)}
          {decor.sunborn.palms.map((p, i) => <Palm key={`pa${i}`} {...p} />)}
          {decor.sunborn.pyramids.map((p, i) => <Pyramid key={`py${i}`} {...p} />)}

          <ellipse cx={d.lake.x} cy={d.lake.y} rx="64" ry="40" fill="#4a8ab0" stroke="#1e4a6a" strokeWidth="2" filter="url(#rough)" />
          <Wave x={d.lake.x - 20} y={d.lake.y - 6} s={1} />
          <Wave x={d.lake.x + 18} y={d.lake.y + 10} s={0.9} />
          {decor.keepers.trees.map((p, i) => <Tree key={`k${i}`} {...p} tone={i % 3 ? '#2f5a2a' : '#3f6e32'} />)}
          <SacredTree {...d.tree} />

          {decor.flintborn.peaks.map((p, i) => <Mountain key={`m${i}`} {...p} />)}

          {/* The rifts between the lands, and the dark matter welling up in the middle. */}
          {RACE_IDS.map((r, i) => (
            <g key={`rift-${r}`}>
              <path d={rift(SECTORS[r].from, 100 + i)} stroke="#8f7bff" strokeWidth="10" fill="none" opacity="0.35" filter="url(#glow)" />
              <path d={rift(SECTORS[r].from, 100 + i)} stroke="#0b0618" strokeWidth="5" fill="none" strokeLinejoin="round" />
            </g>
          ))}
          <g>
            <animateTransform attributeName="transform" type="rotate" from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur="120s" repeatCount="indefinite" />
            <circle cx={CX} cy={CY} r="120" fill="url(#matter)" filter="url(#rough)" />
            <circle cx={CX} cy={CY} r="44" fill="#000" filter="url(#rough)" />
          </g>

          <rect width={W} height={H} filter="url(#paper)" fill="#fff" opacity="0.9" />
          <rect width={W} height={H} fill="url(#vignette)" />
        </g>

        {RACE_IDS.map((r) => {
          const p = label(r);
          const name = tx(RACES[r].name);
          return (
            <g key={`label-${r}`} className={`land-label ${focus === r ? 'focus' : ''}`} onMouseEnter={() => onFocus(r)} onClick={() => (focus === r && onChoose ? onChoose(r) : onFocus(r))}>
              <rect x={p.x - name.length * 7 - 14} y={p.y - 17} width={name.length * 14 + 28} height="32" rx="4" />
              <text x={p.x} y={p.y + 6} textAnchor="middle">{name}</text>
            </g>
          );
        })}
      </g>

      {/* Compass rose and frame. */}
      <g transform="translate(920,90)" pointerEvents="none">
        <circle r="34" fill="#f2e8cc" stroke="#5a4628" strokeWidth="1.5" />
        <path d="M0,-30 L6,0 L0,30 L-6,0 Z" fill="#5a4628" />
        <path d="M-30,0 L0,-6 L30,0 L0,6 Z" fill="#a08a5a" />
        <text y="-38" textAnchor="middle" className="compass">N</text>
      </g>
      <rect x="24" y="24" width={W - 48} height={H - 48} rx="18" fill="none" stroke="#5a4628" strokeWidth="4" pointerEvents="none" />
      <rect x="12" y="12" width={W - 24} height={H - 24} rx="22" fill="none" stroke="#5a4628" strokeWidth="1.5" pointerEvents="none" />
    </svg>
  );
}
