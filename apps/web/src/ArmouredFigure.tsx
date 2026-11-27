import type { ReactNode } from 'react';
import type { ArmourSlot, EnemyKind, HeroLook, ProfessionId, RaceId } from '@hp/content';
import { useT } from './i18n';
import { FoeArt, HeroArt, type Gear } from './HeroArt';
import { spotName } from './ArmourBody';

/**
 * One figure for the hero or a foe: the sprite wearing its armour, with the armour value of each
 * hit-location spot pinned beside the body part (Jacob, 2026-11-27: no separate numbered diagram).
 * The k6 of the hit location ("Walka!", d. Atak): 1 head, 2 left arm, 3 right arm, 4 torso,
 * 5 left leg, 6 right leg. The figure faces the viewer, so its left side is on the viewer's right.
 */

type Spot = {
  slot: ArmourSlot;
  /** The k6 results that land here (a beast's front legs take both arm rolls). */
  rolls: number[];
  /** The body part on the sprite grid. */
  rect: [number, number, number, number];
  /** Where the leader line touches the body. */
  anchor: [number, number];
  /** Which side the value sits on, and how far down. */
  side: -1 | 1;
  y: number;
};

type Body = { grid: number; spots: Spot[] };

const HERO: Body = {
  grid: 16,
  spots: [
    { slot: 'head', rolls: [1], rect: [5.5, 1.5, 5, 5.5], anchor: [10, 3.4], side: 1, y: 2.4 },
    { slot: 'torso', rolls: [4], rect: [5.5, 7, 5, 4], anchor: [6.4, 8.2], side: -1, y: 5.6 },
    { slot: 'arms', rolls: [3], rect: [3.6, 7.2, 2, 4.2], anchor: [4.6, 9.6], side: -1, y: 9.6 },
    { slot: 'arms', rolls: [2], rect: [10.4, 7.2, 2, 4.2], anchor: [11.4, 9.6], side: 1, y: 8.4 },
    { slot: 'legs', rolls: [6], rect: [5.6, 11, 2.2, 4.4], anchor: [6.8, 13.4], side: -1, y: 13.8 },
    { slot: 'legs', rolls: [5], rect: [8.2, 11, 2.2, 4.4], anchor: [9.2, 13.4], side: 1, y: 13.8 },
  ],
};

const BIPED: Body = {
  grid: 12,
  spots: [
    { slot: 'head', rolls: [1], rect: [2, 0, 8, 5], anchor: [8.5, 2.5], side: 1, y: 1.8 },
    { slot: 'torso', rolls: [4], rect: [3, 5, 6, 4], anchor: [4, 6], side: -1, y: 4.2 },
    { slot: 'arms', rolls: [3], rect: [0, 5, 3, 4], anchor: [1.2, 7.2], side: -1, y: 7.4 },
    { slot: 'arms', rolls: [2], rect: [9, 5, 3, 4], anchor: [10.8, 7.2], side: 1, y: 6.4 },
    { slot: 'legs', rolls: [6], rect: [2, 9, 4, 3], anchor: [4, 10.6], side: -1, y: 10.6 },
    { slot: 'legs', rolls: [5], rect: [6, 9, 4, 3], anchor: [8, 10.6], side: 1, y: 10.6 },
  ],
};

/** Four legs: the front pair takes the arm rolls, the hind pair the leg rolls. */
const BEAST: Body = {
  grid: 12,
  spots: [
    { slot: 'head', rolls: [1], rect: [0, 1, 4, 4], anchor: [1.5, 2.5], side: -1, y: 2 },
    { slot: 'torso', rolls: [4], rect: [4, 3, 8, 5], anchor: [9, 4.5], side: 1, y: 3.6 },
    { slot: 'arms', rolls: [2, 3], rect: [1, 8, 4, 3], anchor: [2.5, 9.5], side: -1, y: 8.4 },
    { slot: 'legs', rolls: [5, 6], rect: [7, 8, 4, 3], anchor: [9, 9.5], side: 1, y: 8.4 },
  ],
};

const tier = (v: number) => (v <= 0 ? 'bare' : v === 1 ? 'light' : v === 2 ? 'mid' : 'heavy');

export interface FigureProps {
  armour: Partial<Record<ArmourSlot, number>>;
  /** Height of the sprite in pixels; the values sit on either side of it. */
  size?: number;
  /** The spot the hero aims at. */
  aim?: ArmourSlot | null;
  /** The spot a blow just landed on; `roll` picks the side for arms and legs. */
  hit?: { slot: ArmourSlot; roll?: number } | null;
  /** Makes each spot a button. */
  onPick?: (slot: ArmourSlot) => void;
  /** Shows the k6 number of each spot. */
  showRolls?: boolean;
  title?: string;
  className?: string;
}

function Figure({ body, sprite, armour, size = 72, aim, hit, onPick, showRolls = false, title, className = '' }: FigureProps & { body: Body; sprite: ReactNode }) {
  const { t, locale } = useT();
  const g = body.grid;
  const unit = size / g;
  // Room on each side for the values, a little more when the k6 numbers show too.
  const r = Math.max(7.5, Math.min(11, size / 9)) / unit;
  const rollW = showRolls ? 11 / unit : 0;
  const pad = Math.max(g * 0.34, 20 / unit) + rollW;
  const width = size * (g + pad * 2) / g;
  const isHit = (s: Spot) => !!hit && hit.slot === s.slot && (hit.roll === undefined || s.rolls.length > 1 || hit.slot === 'head' || hit.slot === 'torso' || s.rolls.includes(hit.roll));
  return (
    <span className={`armoured ${onPick ? 'pickable' : ''} ${className}`} style={{ width, height: size }} role={onPick ? 'group' : 'img'} aria-label={title ?? t('armour')}>
      <span className="armoured-sprite" style={{ left: pad * unit, width: size, height: size }}>{sprite}</span>
      <svg className="armoured-marks" viewBox={`${-pad} 0 ${g + pad * 2} ${g}`} width={width} height={size} aria-hidden={onPick ? undefined : true}>
        {body.spots.map((s) => {
          const v = armour[s.slot] ?? 0;
          const name = `${spotName(s.slot, s.rolls.length === 1 ? s.rolls[0] : undefined, locale)} · ${t('armour')} ${v}`;
          const bx = s.side === -1 ? -pad + rollW + r + 0.3 : g + pad - rollW - r - 0.3;
          const pick = onPick ? () => onPick(s.slot) : undefined;
          return (
            <g
              key={s.rolls.join('')}
              className={`spot ${tier(v)} ${aim === s.slot ? 'aim' : ''} ${isHit(s) ? 'hit' : ''}`}
              onClick={pick ? (e) => { e.stopPropagation(); pick(); } : undefined}
              role={pick ? 'button' : undefined}
              tabIndex={pick ? 0 : undefined}
              aria-pressed={pick ? aim === s.slot : undefined}
              aria-label={pick ? name : undefined}
              onKeyDown={pick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } : undefined}
            >
              <title>{name}</title>
              <rect className="spot-area" x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx={0.6} />
              <line className="spot-lead" x1={s.anchor[0]} y1={s.anchor[1]} x2={bx} y2={s.y} vectorEffect="non-scaling-stroke" />
              <circle className="spot-dot" cx={s.anchor[0]} cy={s.anchor[1]} r={0.32} />
              <g transform={`translate(${bx} ${s.y})`}>
                <rect className="spot-badge" x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} vectorEffect="non-scaling-stroke" />
                <text className="spot-value" y={0.05} fontSize={r * 1.2}>{v}</text>
                {showRolls && (
                  <text className="spot-roll" x={s.side * (r + 2.5 / unit)} y={0.05} fontSize={r * 0.85} textAnchor={s.side === -1 ? 'end' : 'start'}>
                    {s.rolls.join('·')}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
    </span>
  );
}

/** The hero in their armour, with the value of each spot beside it. */
export function HeroFigure({ race, profession, look, gear, ...rest }: FigureProps & {
  race: RaceId; profession?: ProfessionId; look?: HeroLook; gear?: Gear;
}) {
  return <Figure body={HERO} sprite={<HeroArt race={race} profession={profession} look={look} size={rest.size ?? 72} gear={gear} />} {...rest} />;
}

/** A foe, with the value of each spot beside it. */
export function FoeFigure({ kind, ...rest }: FigureProps & { kind: EnemyKind }) {
  return <Figure body={kind === 'beast' ? BEAST : BIPED} sprite={<FoeArt kind={kind} size={rest.size ?? 72} armour={rest.armour} />} {...rest} />;
}

/** What the colours of the values mean, with a word on the k6. */
export function FigureLegend({ rolls = false }: { rolls?: boolean }) {
  const { tx } = useT();
  return (
    <span className="armour-legend">
      {tx({ pl: 'Pancerz:', en: 'Armour:' })}
      <i className="bare" />0
      <i className="light" />1
      <i className="mid" />2
      <i className="heavy" />3+
      {rolls && <em>{tx({ pl: '· małe cyfry: wynik k6 trafienia', en: '· small numbers: the hit k6' })}</em>}
    </span>
  );
}
