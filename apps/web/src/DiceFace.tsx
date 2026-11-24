import { DICE_STYLES, DEFAULT_DICE, type DiceLook, type DiceStyle } from '@hp/content';

export const diceStyle = (id: string | undefined): DiceStyle => DICE_STYLES.find((d) => d.id === id) ?? DICE_STYLES[0]!;

/** Colours of a hero's dice as CSS variables, for every die drawn inside the element. */
export function diceVars(dice: DiceLook | undefined, die: keyof DiceLook): React.CSSProperties {
  const s = diceStyle((dice ?? DEFAULT_DICE)[die]);
  return { '--die-from': s.from, '--die-to': s.to, '--die-ink': s.ink } as React.CSSProperties;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/**
 * One die face: a d6 with pips, or a d10 kite with a number. A d100 is a d10 counting the
 * tens ("00" to "90"); the units come from a plain d10.
 */
export function DieFace({ kind, value, style, size = 56 }: { kind: 'd6' | 'd10' | 'd100'; value: number; style: DiceStyle; size?: number }) {
  const id = `g-${style.id}-${kind}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="die-face" aria-label={`${kind} ${value}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.from} />
          <stop offset="100%" stopColor={style.to} />
        </linearGradient>
      </defs>
      {kind === 'd6' ? (
        <>
          <rect x="6" y="6" width="88" height="88" rx="16" fill={`url(#${id})`} stroke="#0b0b10" strokeWidth="4" />
          {PIPS[Math.min(6, Math.max(1, value))]!.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill={style.ink} />)}
        </>
      ) : (
        <>
          <path d="M50,4 L94,40 L50,96 L6,40 Z" fill={`url(#${id})`} stroke="#0b0b10" strokeWidth="4" strokeLinejoin="round" />
          <path d="M6,40 L50,58 L94,40 M50,58 L50,96" stroke="#0b0b10" strokeOpacity="0.25" strokeWidth="2" fill="none" />
          <text x="50" y="50" textAnchor="middle" fontSize={kind === 'd100' ? 26 : 30} fontWeight="700" fill={style.ink} fontFamily="'Pixelify Sans', Inter, sans-serif">
            {kind === 'd100' ? `${value % 10}0` : value % 10}
          </text>
        </>
      )}
    </svg>
  );
}
