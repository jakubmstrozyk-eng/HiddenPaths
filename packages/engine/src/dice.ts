import type { Rng } from './rng';

export interface TestResult {
  /** The d100 roll, 1 to 100. */
  roll: number;
  /** Attribute plus all modifiers, the number the roll must land at or under. */
  target: number;
  success: boolean;
  /** How far under the target the roll landed (negative on failure). Used for hit location and criticals. */
  margin: number;
}

/** A d100 test: roll at or under the attribute plus modifiers. A 1 always succeeds and 100 always fails. */
export function test(rng: Rng, attribute: number, modifier = 0): TestResult {
  const target = attribute + modifier;
  const roll = rng.die(100);
  const success = roll === 1 || (roll !== 100 && roll <= target);
  return { roll, target, success, margin: target - roll };
}

/** Chance of passing a test, shown to the player before they commit. */
export function successChance(attribute: number, modifier = 0): number {
  const target = Math.min(99, Math.max(1, attribute + modifier));
  return target / 100;
}
