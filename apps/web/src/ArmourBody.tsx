import type { ArmourSlot } from '@hp/content';
import { useT } from './i18n';

/**
 * A body seen from the front, split into the six spots of the hit-location k6
 * ("Walka!", d. Atak: 1 head, 2 left arm, 3 right arm, 4 torso, 5 left leg, 6 right leg).
 * Each spot is tinted by the armour on it, so weak and strong spots show at a glance.
 * The figure faces the viewer, so its left arm is on the viewer's right.
 */

type Zone = { roll: number; slot: ArmourSlot; d: string; label: [number, number] };

const ZONES: Zone[] = [
  { roll: 1, slot: 'head', d: 'M50 4 a13 13 0 1 1 -0.01 0 Z', label: [50, 21] },
  { roll: 3, slot: 'arms', d: 'M22 36 h12 v50 a6 6 0 0 1 -12 0 Z', label: [28, 62] },
  { roll: 2, slot: 'arms', d: 'M66 36 h12 v50 a6 6 0 0 1 -12 0 Z', label: [72, 62] },
  { roll: 4, slot: 'torso', d: 'M37 34 h26 a4 4 0 0 1 4 4 v48 h-34 v-48 a4 4 0 0 1 4 -4 Z', label: [50, 62] },
  { roll: 6, slot: 'legs', d: 'M34 89 h15 v61 a5 5 0 0 1 -5 5 h-5 a5 5 0 0 1 -5 -5 Z', label: [41.5, 124] },
  { roll: 5, slot: 'legs', d: 'M51 89 h15 v61 a5 5 0 0 1 -5 5 h-5 a5 5 0 0 1 -5 -5 Z', label: [58.5, 124] },
];

/** A spot's name with its side, from the k6: "lewa ręka", "prawa noga". */
export function spotName(slot: ArmourSlot, roll: number | undefined, locale: string): string {
  const pl = locale === 'pl';
  const side = roll === 2 || roll === 5 ? (pl ? 'lewa' : 'left') : roll === 3 || roll === 6 ? (pl ? 'prawa' : 'right') : '';
  const base = { head: pl ? 'głowa' : 'head', arms: pl ? 'ręka' : 'arm', torso: pl ? 'korpus' : 'torso', legs: pl ? 'noga' : 'leg' }[slot];
  return side ? `${side} ${base}` : base;
}

const tier = (v: number) => (v <= 0 ? 'bare' : v === 1 ? 'light' : v === 2 ? 'mid' : 'heavy');

export function ArmourBody({ armour, size = 90, aim, hit, onPick, showRolls = false, title }: {
  armour: Partial<Record<ArmourSlot, number>>;
  /** Height in pixels. */
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
}) {
  const { t, locale } = useT();
  const hitZone = (z: Zone) => !!hit && hit.slot === z.slot && (hit.roll === undefined || hit.slot === 'head' || hit.slot === 'torso' || hit.roll === z.roll);
  return (
    <svg className={`armour-body ${onPick ? 'pickable' : ''}`} viewBox="18 0 64 158" width={size * 64 / 158} height={size} role={onPick ? 'group' : 'img'} aria-label={title ?? t('armour')}>
      {ZONES.map((z) => {
        const v = armour[z.slot] ?? 0;
        const name = `${spotName(z.slot, z.roll, locale)} · ${t('armour')} ${v}`;
        return (
          <g
            key={z.roll}
            className={`zone ${tier(v)} ${aim === z.slot ? 'aim' : ''} ${hitZone(z) ? 'hit' : ''}`}
            onClick={onPick ? (e) => { e.stopPropagation(); onPick(z.slot); } : undefined}
            role={onPick ? 'button' : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-pressed={onPick ? aim === z.slot : undefined}
            aria-label={onPick ? name : undefined}
            onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(z.slot); } } : undefined}
          >
            <title>{name}</title>
            <path d={z.d} />
            <text x={z.label[0]} y={z.label[1]} className="zone-armour">{v}</text>
            {showRolls && <text x={z.label[0]} y={z.label[1] + (z.slot === 'head' ? 9 : 12)} className="zone-roll">{z.roll}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** What the colours mean. */
export function ArmourLegend() {
  const { tx } = useT();
  return (
    <span className="armour-legend">
      <i className="bare" />{tx({ pl: 'bez pancerza', en: 'bare' })}
      <i className="light" />1
      <i className="mid" />2
      <i className="heavy" />3+
    </span>
  );
}
