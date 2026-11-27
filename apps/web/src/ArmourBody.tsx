import type { ArmourSlot } from '@hp/content';

/** A spot's name with its side, from the k6: "lewa ręka", "prawa noga". */
export function spotName(slot: ArmourSlot, roll: number | undefined, locale: string): string {
  const pl = locale === 'pl';
  const side = roll === 2 || roll === 5 ? (pl ? 'lewa' : 'left') : roll === 3 || roll === 6 ? (pl ? 'prawa' : 'right') : '';
  const base = { head: pl ? 'głowa' : 'head', arms: pl ? 'ręka' : 'arm', torso: pl ? 'korpus' : 'torso', legs: pl ? 'noga' : 'leg' }[slot];
  return side ? `${side} ${base}` : base;
}
