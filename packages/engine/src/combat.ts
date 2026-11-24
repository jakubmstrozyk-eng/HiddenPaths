import {
  ENEMIES, HIT_LOCATIONS, ITEMS,
  type ArmourSlot, type Enemy, type Outcome, type WeaponItem,
} from '@hp/content';
import { DIFFICULTIES } from './config';
import { test, type TestResult } from './dice';
import { EngineError } from './errors';
import { Rng as RngCtor, type Rng } from './rng';
import { eatRations, useLeaves, usesLeft, trapFoes } from './cards';
import { effectBonus, itemBonus, testModifier, type ActorState, type WorldView } from './terrain';

/** One foe in a fight. */
export interface Foe {
  uid: string;
  enemy: string;
  vitality: number;
  maxVitality: number;
  /** Attacks made so far, for the manticore's every-third sting. */
  attacks: number;
  /** Loses its next attack (stunning rune). */
  stunned: boolean;
  /** Bleeds 1 Vitality a turn until it passes a Strength test (venom rune). */
  poisoned: boolean;
  /** Hits taken from the hero, for the stunning rune. */
  hits: number;
}

export interface CombatState {
  foes: Foe[];
  turn: number;
  /** +10 to every hero test this turn, from focusing on the last one. */
  focus: boolean;
  /** The hero loses this turn (Banshee's shriek). */
  heroStunned: boolean;
  /** A crossbow needs a turn to reload after each shot. */
  reloading: boolean;
  /** Applied when every foe is down. */
  onWin: Outcome[];
  /** The event card the fight came from, so its script can continue after a win. */
  card?: number;
  /** Mystic's Barrier: up until a foe's blow lands on it. */
  barrier?: boolean;
  /** Set a Trap played in the fight: it springs at the start of the next round. */
  trap?: boolean;
}

export type CombatMove =
  | { move: 'attack'; target: string }
  | { move: 'parry' }
  | { move: 'focus' }
  | { move: 'flee' }
  | { move: 'potion'; item: string }
  /** A skill card played as the hero's move; `target` for the attacking cards. */
  | { move: 'card'; card: string; target?: string };

export type CombatEvent =
  | {
    type: 'strike'; by: string; target: string; result: TestResult; location?: ArmourSlot; damage?: number;
    parry?: TestResult; parried?: boolean;
    /** The skill card behind the hero's strike. */
    card?: string;
    /** Whirling Axe: the foe's Dexterity roll to get out of the way. */
    dodge?: TestResult; dodged?: boolean;
    /** Barrier: the foe's Strength roll to break through; `blocked` when it failed. */
    barrier?: TestResult; blocked?: boolean;
  }
  | { type: 'trap'; uid: string; result: TestResult; damage: number }
  | { type: 'barrier'; result: TestResult }
  | { type: 'card'; card: string; amount?: number }
  | { type: 'flee'; success: boolean; hero: TestResult; foe: TestResult }
  | { type: 'focus' }
  | { type: 'stunned'; who: string }
  | { type: 'drink'; item: string }
  | { type: 'reload' }
  | { type: 'foeDown'; uid: string; enemy: string }
  | { type: 'poisoned'; who: string; condition?: string }
  | { type: 'bleed'; uid: string; damage: number };

export type CombatResult = 'ongoing' | 'won' | 'lost' | 'fled' | 'enthralled';

export const HERO = 'hero';

/** Strength step "S" from the weapon table: Strength divided by 10, rounded down. */
export const strengthStep = (str: number) => Math.floor(str / 10);

export function startCombat(world: WorldView, enemies: string[], onWin: Outcome[] = []): CombatState {
  const factor = DIFFICULTIES[world.difficulty].enemyVitality;
  const foes = enemies.map((id, i): Foe => {
    const enemy = ENEMIES[id];
    if (!enemy) throw new EngineError('combat.enemy', `Unknown enemy ${id}.`);
    const vitality = Math.max(1, Math.round(enemy.vitality * factor));
    return { uid: `${id}-${i + 1}`, enemy: id, vitality, maxVitality: vitality, attacks: 0, stunned: false, poisoned: false, hits: 0 };
  });
  return { foes, turn: 1, focus: false, heroStunned: false, reloading: false, onWin };
}

export function heroWeapon(actor: ActorState): WeaponItem {
  const item = ITEMS[actor.character.equipment.weapon];
  return item?.kind === 'weapon' ? item : (ITEMS.oneHanded as WeaponItem);
}

/** Armour on each slot: the best worn piece counts, pieces do not stack. */
export function heroArmour(actor: ActorState): Record<ArmourSlot, number> {
  const out: Record<ArmourSlot, number> = { head: 0, arms: 0, torso: 0, legs: 0 };
  for (const id of actor.character.equipment.armour) {
    const item = ITEMS[id];
    if (item?.kind !== 'armour') continue;
    for (const slot of item.covers) out[slot] = Math.max(out[slot], item.value);
  }
  return out;
}

/** Attacks per turn from Stamina left: 3 Stamina gives 2 attacks, 4 gives 3. A crossbow shoots once. */
export function attacksPerTurn(actor: ActorState): number {
  if (heroWeapon(actor).reload) return 1;
  return actor.staminaLeft >= 4 ? 3 : actor.staminaLeft >= 3 ? 2 : 1;
}

export function combatMoves(actor: ActorState, combat: CombatState): CombatMove[] {
  const moves: CombatMove[] = combat.foes.filter((f) => f.vitality > 0).map((f) => ({ move: 'attack', target: f.uid }));
  moves.push({ move: 'parry' }, { move: 'focus' }, { move: 'flee' });
  for (const id of new Set(actor.inventory.items)) if (ITEMS[id]?.kind === 'potion') moves.push({ move: 'potion', item: id });
  const cards = actor.character.cards ?? [];
  const target = moves.find((m) => m.move === 'attack') as { target: string } | undefined;
  if (target) {
    for (const card of ['warrior-heavy-swing', 'diver-blowpipe', 'cavedelver-whirling-axe']) {
      if (cards.includes(card)) moves.push({ move: 'card', card, target: target.target });
    }
  }
  if (cards.includes('trapper-trap') && !combat.trap) moves.push({ move: 'card', card: 'trapper-trap' });
  if (cards.includes('mystic-barrier') && !combat.barrier) moves.push({ move: 'card', card: 'mystic-barrier' });
  for (const card of ['warrior-rations', 'wraith-leaves']) {
    if (cards.includes(card) && (usesLeft(actor, card) ?? 0) > 0) moves.push({ move: 'card', card });
  }
  return moves;
}

/** Where a hit lands: a strike that passed by more than 20 picks the least armoured spot, otherwise a d6 decides. */
function hitLocation(rng: Rng, margin: number, armour: Partial<Record<ArmourSlot, number>>): ArmourSlot {
  if (margin > 20) {
    return (['torso', 'head', 'arms', 'legs'] as ArmourSlot[]).reduce((best, s) => ((armour[s] ?? 0) < (armour[best] ?? 0) ? s : best), 'torso');
  }
  return HIT_LOCATIONS[rng.die(6) - 1]!;
}

function damageDie(rng: Rng, penetrating: boolean): number {
  const d = rng.die(6);
  return penetrating && d <= 3 ? rng.die(6) : d;
}

function addCondition(actor: ActorState, id: string, name: { pl: string; en: string }, attribute: 'str' | 'dex', loss: number) {
  if (actor.conditions.some((c) => c.id === id)) return;
  actor.conditions.push({ id, name, test: attribute, modifier: 0, worsen: 0, each: [{ do: 'vitality', amount: -loss }] });
}

/**
 * Plays one combat turn: the hero's move and every foe's attack, in initiative order
 * (higher Dexterity first, the hero wins ties). Changes `actor` and `combat` in place.
 */
export function combatTurn(
  world: WorldView, actor: ActorState, combat: CombatState, move: CombatMove, rng: Rng,
): { events: CombatEvent[]; result: CombatResult } {
  const events: CombatEvent[] = [];
  const attrs = actor.character.attributes;
  const focus = combat.focus ? 10 : 0;
  combat.focus = false;
  // A parry or a flight is declared for the whole round, so it also covers foes that strike before the hero.
  const parrying = move.move === 'parry' && !combat.heroStunned;
  const fleeing = move.move === 'flee' && !combat.heroStunned;
  let fled = false;
  let enthralled = false;
  const alive = () => combat.foes.filter((f) => f.vitality > 0);
  const weapon = heroWeapon(actor);
  const rune = actor.character.equipment.rune;

  if (move.move === 'attack' && !alive().some((f) => f.uid === move.target)) {
    throw new EngineError('combat.target', 'That foe is not in the fight.');
  }
  if (move.move === 'card' && !combatMoves(actor, combat).some((m) => m.move === 'card' && m.card === move.card)) {
    throw new EngineError('card.notNow', 'You cannot play that card now.');
  }
  const cards = actor.character.cards ?? [];

  /** One blow of the hero at a foe, with the skill cards that shape it. */
  const swing = (target: Foe, opts: { mod?: number; bonus?: number; power?: number; poison?: boolean; card?: string; dodge?: boolean } = {}) => {
    const enemy = ENEMIES[target.enemy]!;
    const mod = focus + (rune === 'precise' ? 5 : 0) + (opts.mod ?? 0);
    const result = test(rng, attrs.com, testModifier(world, actor, 'com', mod, enemy.kind));
    const base = { type: 'strike' as const, by: HERO, target: target.uid, result, ...(opts.card ? { card: opts.card } : {}) };
    if (!result.success) {
      events.push(base);
      return;
    }
    let dodge: TestResult | undefined;
    if (opts.dodge) {
      dodge = test(rng, enemy.dex);
      if (dodge.success) {
        events.push({ ...base, dodge, dodged: true });
        return;
      }
    }
    const location = hitLocation(rng, result.margin, enemy.armour);
    const armour = enemy.armour[location] ?? 0;
    // Critical Point: +1 damage for each 10 the roll beat the target by, at most 4.
    const critical = cards.includes('wraith-critical') ? Math.min(4, Math.floor(result.margin / 10)) : 0;
    // Precise Shot: a longbow hit that beat the target by 15 or more deals +2.
    const precise = cards.includes('trapper-precise-shot') && weapon.id === 'longBow' && result.margin >= 15 ? 2 : 0;
    let damage = strengthStep(attrs.str) + (opts.power ?? weapon.power) + damageDie(rng, !!weapon.penetrating || rune === 'piercing')
      + itemBonus(actor, 'damage') + effectBonus(actor, world.round, 'damage') + (rune === 'sharp' && armour > 0 ? 1 : 0)
      + critical + precise + (opts.bonus ?? 0) - armour;
    if (enemy.traits.includes('ethereal') && !rune) damage = Math.floor(damage / 2);
    damage = Math.max(0, damage);
    target.vitality -= damage;
    target.hits++;
    if (rune === 'venom' || opts.poison) target.poisoned = true;
    if (rune === 'stunning' && target.hits % 3 === 0) target.stunned = true;
    events.push({ ...base, location, damage, ...(dodge ? { dodge } : {}) });
    if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
  };
  const targetOf = (uid?: string) => alive().find((f) => f.uid === uid) ?? alive()[0];
  if (move.move === 'potion' && !actor.inventory.items.includes(move.item)) {
    throw new EngineError('combat.item', 'You do not carry that.');
  }

  const heroTurn = () => {
    if (combat.heroStunned) {
      combat.heroStunned = false;
      events.push({ type: 'stunned', who: HERO });
      return;
    }
    switch (move.move) {
      case 'parry':
        break;
      case 'focus':
        combat.focus = true;
        events.push({ type: 'focus' });
        break;
      case 'potion': {
        actor.inventory.items.splice(actor.inventory.items.indexOf(move.item), 1);
        drinkPotion(world, actor, move.item);
        events.push({ type: 'drink', item: move.item });
        break;
      }
      case 'flee': {
        const fastest = alive().reduce((a, b) => (ENEMIES[b.enemy]!.dex > ENEMIES[a.enemy]!.dex ? b : a));
        const harried = alive().some((f) => ENEMIES[f.enemy]!.traits.includes('harrying')) ? -10 : 0;
        const hero = test(rng, attrs.dex, testModifier(world, actor, 'dex', focus + harried));
        const foe = test(rng, ENEMIES[fastest.enemy]!.dex);
        fled = hero.success && (!foe.success || hero.roll <= foe.roll);
        events.push({ type: 'flee', success: fled, hero, foe });
        break;
      }
      case 'attack': {
        if (combat.reloading) {
          combat.reloading = false;
          events.push({ type: 'reload' });
          break;
        }
        const swings = attacksPerTurn(actor);
        for (let i = 0; i < swings; i++) {
          const target = targetOf(move.target);
          if (!target) break;
          swing(target);
        }
        if (weapon.reload) combat.reloading = true;
        break;
      }
      case 'card':
        switch (move.card) {
          case 'warrior-heavy-swing': {
            // Heavy Swing: Combat -10, damage +4, on every blow of the move.
            const swings = attacksPerTurn(actor);
            for (let i = 0; i < swings; i++) {
              const target = targetOf(move.target);
              if (!target) break;
              swing(target, { mod: -10, bonus: 4, card: move.card });
            }
            break;
          }
          case 'diver-blowpipe': {
            // Blowpipe: one poisoned dart (S-2); a hit poisons the foe.
            const target = targetOf(move.target);
            if (target) swing(target, { power: -2, poison: true, card: move.card });
            break;
          }
          case 'cavedelver-whirling-axe':
            // Whirling Axe: a separate Combat test against each foe, up to 3; each may dodge with Dexterity.
            for (const target of alive().slice(0, 3)) swing(target, { dodge: true, card: move.card });
            break;
          case 'mystic-barrier': {
            const result = test(rng, attrs.int, testModifier(world, actor, 'int', focus));
            if (result.success) combat.barrier = true;
            events.push({ type: 'barrier', result });
            break;
          }
          case 'trapper-trap':
            // Setting a trap in a fight takes the hero's whole round; it springs when the next one starts.
            combat.trap = true;
            events.push({ type: 'card', card: move.card });
            break;
          case 'warrior-rations':
            eatRations(world.round, actor);
            events.push({ type: 'card', card: move.card });
            break;
          case 'wraith-leaves':
            events.push({ type: 'card', card: move.card, amount: useLeaves(actor) });
            break;
        }
        break;
    }
  };

  const foeTurn = (foe: Foe) => {
    if (foe.vitality <= 0 || actor.character.vitality <= 0 || enthralled) return;
    if (foe.stunned) {
      foe.stunned = false;
      events.push({ type: 'stunned', who: foe.uid });
      return;
    }
    const enemy: Enemy = ENEMIES[foe.enemy]!;
    foe.attacks++;
    const sting = enemy.traits.includes('stinger') && foe.attacks % 3 === 0;
    const result = test(rng, enemy.com, fleeing ? 10 : 0);
    if (!result.success) {
      events.push({ type: 'strike', by: foe.uid, target: HERO, result });
      return;
    }
    if (parrying) {
      const shield = actor.character.equipment.shield ? 15 : 0;
      const parry = test(rng, attrs.com, testModifier(world, actor, 'com', focus + shield, enemy.kind));
      if (parry.success && parry.roll <= result.roll) {
        events.push({ type: 'strike', by: foe.uid, target: HERO, result, parry, parried: true });
        return;
      }
      events.push({ type: 'strike', by: foe.uid, target: HERO, result, parry, parried: false });
    }
    const armour = heroArmour(actor);
    const location = hitLocation(rng, result.margin, armour);
    let damage = Math.max(0, strengthStep(enemy.str) + enemy.weapon.power + (sting ? 1 : 0)
      + damageDie(rng, enemy.traits.includes('penetrating')) - armour[location]);
    // Barrier: the blow must break through on a Strength test, and then deals half; either way the barrier is gone.
    let barrier: TestResult | undefined;
    if (combat.barrier) {
      combat.barrier = false;
      barrier = test(rng, enemy.str);
      if (!barrier.success) {
        events.push({ type: 'strike', by: foe.uid, target: HERO, result, barrier, blocked: true });
        return;
      }
      damage = Math.floor(damage / 2);
    }
    actor.character.vitality -= damage;
    events.push({ type: 'strike', by: foe.uid, target: HERO, result, location, damage, ...(barrier ? { barrier } : {}) });
    if (enemy.traits.includes('poison') || sting) {
      addCondition(actor, 'poison', { pl: 'Zatrucie', en: 'Poisoned' }, 'str', 1);
      events.push({ type: 'poisoned', who: HERO, condition: 'poison' });
    }
    if (enemy.traits.includes('rot')) {
      addCondition(actor, 'rot', { pl: 'Zgnilizna', en: 'Rot' }, 'dex', 2);
      events.push({ type: 'poisoned', who: HERO, condition: 'rot' });
    }
    if (enemy.traits.includes('stun') && !test(rng, attrs.wil, testModifier(world, actor, 'wil', focus)).success) {
      combat.heroStunned = true;
    }
    if (enemy.traits.includes('drain')) {
      actor.staminaLeft = Math.max(0, actor.staminaLeft - 1);
      if (actor.staminaLeft === 0) enthralled = true;
    }
  };

  if (combat.trap) {
    combat.trap = false;
    events.push(...trapFoes(alive(), rng));
  }

  const heroInitiative = attrs.dex + itemBonus(actor, 'initiative');
  const order = [
    { id: HERO, dex: heroInitiative + 0.5 },
    ...alive().map((f) => ({ id: f.uid, dex: ENEMIES[f.enemy]!.dex })),
  ].sort((a, b) => b.dex - a.dex);
  for (const slot of order) {
    if (slot.id === HERO) heroTurn();
    else foeTurn(combat.foes.find((f) => f.uid === slot.id)!);
  }

  // Venom rune: poisoned foes bleed until they pass a Strength test.
  for (const foe of alive()) {
    if (!foe.poisoned) continue;
    if (test(rng, ENEMIES[foe.enemy]!.str).success) foe.poisoned = false;
    else {
      foe.vitality -= 1;
      events.push({ type: 'bleed', uid: foe.uid, damage: 1 });
      if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
    }
  }
  combat.turn++;

  if (actor.character.vitality <= 0) return { events, result: 'lost' };
  if (enthralled) return { events, result: 'enthralled' };
  if (alive().length === 0) return { events, result: 'won' };
  if (fled) return { events, result: 'fled' };
  return { events, result: 'ongoing' };
}

/** XP for a won fight: the sum of the foes' bestiary XP, scaled by difficulty. */
export function combatXp(world: WorldView, combat: CombatState): number {
  return combat.foes.reduce((sum, f) => sum + ENEMIES[f.enemy]!.xp, 0) * DIFFICULTIES[world.difficulty].xp;
}

/** Drinks a potion: heals, or adds its timed effect. */
export function drinkPotion(world: WorldView, actor: ActorState, id: string) {
  const item = ITEMS[id];
  if (item?.kind !== 'potion') throw new EngineError('item.notPotion', 'That is not a potion.');
  const c = actor.character;
  if (item.heal) c.vitality = Math.min(c.maxVitality, c.vitality + item.heal);
  if (item.effect) {
    actor.effects.push({ id, attribute: item.effect.target, amount: item.effect.amount, untilRound: world.round + item.effect.rounds - 1 });
    if (item.effect.target === 'stamina') actor.staminaLeft += item.effect.amount;
    if (item.effect.target === 'speed') actor.speedLeft += item.effect.amount;
  }
  // Clears poison too: the rules end poison "until healed".
  if (item.heal) actor.conditions = actor.conditions.filter((cnd) => cnd.id !== 'poison' && cnd.id !== 'rot' && cnd.id !== 'foulAir');
}

/**
 * Rough odds of this fight if the hero keeps attacking, from simulated fights.
 * Uses its own dice, so the game's dice and state are untouched; the same fight always gives the same estimate.
 */
export function fightOdds(world: WorldView, actor: ActorState, combat: CombatState, samples = 200): { win: number; lose: number } {
  const seed = combat.foes.reduce((s, f) => s * 31 + f.vitality * 7 + f.uid.length, combat.turn * 7919 + actor.character.vitality);
  const rng = new RngCtor(seed | 0);
  let win = 0;
  let lose = 0;
  for (let i = 0; i < samples; i++) {
    const a = structuredClone(actor);
    const c = structuredClone(combat);
    for (let turn = 0; turn < 40; turn++) {
      const target = c.foes.find((f) => f.vitality > 0);
      if (!target) break;
      const { result } = combatTurn(world, a, c, { move: 'attack', target: target.uid }, rng);
      if (result === 'won') { win++; break; }
      if (result === 'lost' || result === 'enthralled') { lose++; break; }
    }
  }
  return { win: win / samples, lose: lose / samples };
}

/** Damage a foe deals with one hit before armour: lowest and highest. */
export function foeDamage(enemyId: string): [number, number] {
  const e = ENEMIES[enemyId]!;
  const base = strengthStep(e.str) + e.weapon.power;
  return [Math.max(0, base + 1), base + 6];
}
