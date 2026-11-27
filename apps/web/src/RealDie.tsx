import { useId } from 'react';
import { DEFAULT_DICE, type DiceEngraving, type DiceFinish, type DiceLook } from '@hp/content';
import { diceStyle } from './DiceFace';

/**
 * A die drawn as a real object: a ten-sided die seen from above (a kite face with four bevelled
 * facets around it) or a rounded cube with sunken pips. The light comes from the upper left; the
 * finish (matte, polished, pearl, metal) and what is cut into the die (gold-inked numbers, runes,
 * a filigree edge) come from the hero's dice. The die never changes shape: only its face changes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
};

const GOLD = '#f2c85a';

/** Draws a face into the die's face group: pips on a d6, a number otherwise. Used while the die tumbles too. */
export function paintFace(g: SVGGElement | null, face: string) {
  if (!g) return;
  if (g.dataset.face === face) return;
  g.dataset.face = face;
  const ink = g.dataset.ink ?? '#111';
  const inked = g.dataset.engrave === 'inked';
  const pips = g.dataset.pips === '1';
  while (g.firstChild) g.removeChild(g.firstChild);
  const n = Number(face);
  if (pips && PIPS[n]) {
    for (const [x, y] of PIPS[n]!) {
      // A sunken pip: a light rim below, the dark hollow, and gold in it when inked.
      const rim = document.createElementNS(SVG_NS, 'circle');
      rim.setAttribute('cx', String(x)); rim.setAttribute('cy', String(y + 1.2)); rim.setAttribute('r', '8');
      rim.setAttribute('fill', 'rgba(255,255,255,0.35)');
      const hole = document.createElementNS(SVG_NS, 'circle');
      hole.setAttribute('cx', String(x)); hole.setAttribute('cy', String(y)); hole.setAttribute('r', '7.5');
      hole.setAttribute('fill', inked ? GOLD : ink);
      if (inked) { hole.setAttribute('stroke', 'rgba(60,30,0,0.75)'); hole.setAttribute('stroke-width', '1.6'); }
      g.append(rim, hole);
    }
    return;
  }
  const big = face.length >= 2;
  const y = g.dataset.kind === 'd10' ? 55 : 51;
  const size = g.dataset.kind === 'd10' ? (big ? 24 : 30) : big ? 34 : 44;
  const mk = (dy: number, fill: string, stroke?: string) => {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', '50'); t.setAttribute('y', String(y + dy));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('font-family', 'Inter, system-ui, sans-serif'); t.setAttribute('font-weight', '800');
    t.setAttribute('font-size', String(size)); t.setAttribute('fill', fill);
    if (stroke) { t.setAttribute('stroke', stroke); t.setAttribute('stroke-width', '1.4'); t.setAttribute('paint-order', 'stroke'); }
    t.textContent = face;
    return t;
  };
  // Engraved: a light lip under the cut, then the number itself.
  g.append(mk(1.4, 'rgba(255,255,255,0.32)'), inked ? mk(0, GOLD, 'rgba(60,30,0,0.7)') : mk(0, ink));
}

/** A rune or two on the side facets, for the "runes" engraving. */
const RUNES = ['ᚠ', 'ᚱ', 'ᛟ', 'ᚹ', 'ᛉ', 'ᚦ'];

export function RealDie({ sides, tens = false, dice, kind, size = 48, face, faceRef }: {
  sides: number;
  tens?: boolean;
  dice?: DiceLook;
  /** Which of the hero's dice colours to use. */
  kind: 'd6' | 'd10' | 'd100';
  size?: number;
  /** The face to show (left out when the tray paints faces itself while the die tumbles). */
  face?: string;
  faceRef?: (g: SVGGElement | null) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const look = dice ?? DEFAULT_DICE;
  const style = diceStyle(look[kind]);
  const finish: DiceFinish = look.finish ?? 'gloss';
  const engrave: DiceEngraving = look.engrave ?? 'plain';
  const cube = sides !== 10;
  const outline = cube ? undefined : '50,3 97,41 50,97 3,41';
  const clip = `c${uid}`;
  const grad = `g${uid}`;
  const sheen = `s${uid}`;
  const tone = finish === 'matte' ? 0.6 : 1;
  const attach = (g: SVGGElement | null) => {
    // Only the first face: once the tray paints the die while it rolls, a re-render must not paint over it.
    if (g && face !== undefined && (!faceRef || !g.dataset.face)) paintFace(g, face);
    faceRef?.(g);
  };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="real-die" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.from} />
          <stop offset="100%" stopColor={style.to} />
        </linearGradient>
        <clipPath id={clip}>
          {cube ? <rect x="5" y="5" width="90" height="90" rx="16" /> : <polygon points={outline} />}
        </clipPath>
        {finish === 'pearl' && (
          <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#ffd6f0" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#c8f4ff" stopOpacity="0.3" />
            <stop offset="65%" stopColor="#fff2b8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#d8c8ff" stopOpacity="0.4" />
          </linearGradient>
        )}
        {finish === 'metal' && (
          <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="22%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="45%" stopColor="#000" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
        )}
      </defs>
      {cube ? (
        <>
          <rect x="5" y="5" width="90" height="90" rx="16" fill={`url(#${grad})`} />
          {/* Bevels: the rounded edges catch the light at the top left and fall into shade at the bottom right. */}
          <path d="M5 21 Q5 5 21 5 H79 Q95 5 95 21 L85 27 V27 Q85 15 73 15 H27 Q15 15 15 27 Z" fill="#fff" fillOpacity={0.3 * tone} />
          <path d="M5 21 V79 Q5 95 21 95 L27 85 Q15 85 15 73 V27 Z" fill="#fff" fillOpacity={0.14 * tone} />
          <path d="M95 21 V79 Q95 95 79 95 L73 85 Q85 85 85 73 V27 Z" fill="#000" fillOpacity={0.22 * tone} />
          <path d="M21 95 H79 Q95 95 95 79 L85 73 Q85 85 73 85 H27 Q15 85 15 73 L5 79 Q5 95 21 95 Z" fill="#000" fillOpacity={0.3 * tone} />
          {engrave === 'filigree' && <rect x="18" y="18" width="64" height="64" rx="9" fill="none" stroke={GOLD} strokeWidth="1.6" strokeDasharray="1 3.2" strokeLinecap="round" />}
          {engrave === 'runes' && RUNES.slice(0, 4).map((r, i) => (
            <text key={i} x={[20, 80, 20, 80][i]} y={[22, 22, 84, 84][i]} fontSize="9" textAnchor="middle" fill={style.ink} fillOpacity="0.45">{r}</text>
          ))}
        </>
      ) : (
        <>
          <polygon points={outline} fill={`url(#${grad})`} />
          {/* The four facets around the face, lit from the upper left. */}
          <polygon points="50,3 3,41 22,46 50,13" fill="#fff" fillOpacity={0.3 * tone} />
          <polygon points="50,3 50,13 78,46 97,41" fill="#fff" fillOpacity={0.08 * tone} />
          <polygon points="3,41 50,97 50,82 22,46" fill="#000" fillOpacity={0.16 * tone} />
          <polygon points="97,41 78,46 50,82 50,97" fill="#000" fillOpacity={0.34 * tone} />
          <polygon points="50,13 78,46 50,82 22,46" fill="#fff" fillOpacity={0.06} />
          <path d="M50 3 L50 13 M3 41 L22 46 M97 41 L78 46 M50 97 L50 82 M50 13 L78 46 L50 82 L22 46 Z" stroke="#000" strokeOpacity="0.28" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
          {engrave === 'filigree' && <polygon points="50,18 72,46 50,76 28,46" fill="none" stroke={GOLD} strokeWidth="1.4" strokeDasharray="1 3" strokeLinecap="round" />}
          {engrave === 'runes' && (
            <>
              <text x="27" y="30" fontSize="9" textAnchor="middle" fill={style.ink} fillOpacity="0.5" transform="rotate(-38 27 30)">{RUNES[0]}</text>
              <text x="73" y="30" fontSize="9" textAnchor="middle" fill={style.ink} fillOpacity="0.4" transform="rotate(38 73 30)">{RUNES[1]}</text>
              <text x="30" y="72" fontSize="9" textAnchor="middle" fill={style.ink} fillOpacity="0.45" transform="rotate(42 30 72)">{RUNES[2]}</text>
              <text x="70" y="72" fontSize="9" textAnchor="middle" fill={style.ink} fillOpacity="0.4" transform="rotate(-42 70 72)">{RUNES[3]}</text>
            </>
          )}
        </>
      )}
      <g
        ref={attach}
        data-ink={style.ink}
        data-engrave={engrave}
        data-pips={sides === 6 ? '1' : '0'}
        data-kind={cube ? 'd6' : 'd10'}
        data-tens={tens ? '1' : '0'}
      />
      {/* The finish, over everything and only inside the die. */}
      <g clipPath={`url(#${clip})`} pointerEvents="none">
        {(finish === 'pearl' || finish === 'metal') && <rect x="0" y="0" width="100" height="100" fill={`url(#${sheen})`} />}
        {finish !== 'matte' && (
          <>
            <ellipse cx="33" cy="24" rx={finish === 'metal' ? 26 : 20} ry={finish === 'metal' ? 8 : 10} fill="#fff" fillOpacity={finish === 'gloss' ? 0.38 : 0.3} transform="rotate(-28 33 24)" />
            <circle cx="27" cy="20" r="3" fill="#fff" fillOpacity={finish === 'pearl' ? 0.5 : 0.75} />
          </>
        )}
      </g>
      {cube ? <rect x="5" y="5" width="90" height="90" rx="16" fill="none" stroke="#0b0b10" strokeOpacity="0.85" strokeWidth="2.5" /> : <polygon points={outline} fill="none" stroke="#0b0b10" strokeOpacity="0.85" strokeWidth="2.5" strokeLinejoin="round" />}
    </svg>
  );
}
