import {
  ENEMIES, HIT_LOCATIONS, ITEMS,
  type ArmourSlot, type Enemy, type Outcome, type WeaponItem,
} from '@hp/content';
import { DIFFICULTIES } from './config';
import { test, type TestResult } from './dice';
import { EngineError } from './errors';
import { Rng as RngCtor, type Rng } from './rng';
import { bandage, eatRations, empower, healingHerb, isSpent, useLeaves, usesLeft, trapFoes } from './cards';
import { BURN_DEATH, readableScrolls, scrollOf, selfSpell, spendScroll } from './scrolls';
import { effectBonus, heroTest, itemBonus, magicBonus, type ActorState, type Companion, type WorldView } from './terrain';

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
  /** Explorer's Disarm: the foe lost its weapon and spends its turns trying to get it back. */
  disarmed?: boolean;
  /** Druid's Companion: the beast was tamed and left the fight on the hero's side. */
  tamed?: boolean;
  /** Fire bolt: the foe burns; the number is its failed Strength tests so far. */
  burning?: number;
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
  /** Guardian's Defensive Stance was taken in this fight (once a fight). */
  stanceUsed?: boolean;
  /** The game round the fight broke out in (a fight ends the round), for once-a-round limits such as scrolls. */
  round?: number;
}

export type CombatMove =
  /** `aim`: the spot the hero goes for; it is hit when the Combat test passes by more than 20. */
  | { move: 'attack'; target: string; aim?: ArmourSlot }
  | { move: 'parry' }
  | { move: 'focus' }
  | { move: 'flee' }
  | { move: 'potion'; item: string }
  /** A magic scroll: Fire bolt and Lightning at a foe, Healing and Renewal on the hero. */
  | { move: 'scroll'; item: string; target?: string; aim?: ArmourSlot }
  /** A skill card played as the hero's move; `target` for the attacking cards. */
  | { move: 'card'; card: string; target?: string; aim?: ArmourSlot };

export type CombatEvent =
  | {
    type: 'strike'; by: string; target: string; result: TestResult; location?: ArmourSlot; damage?: number;
    /** The k6 for the hit location (1 head, 2 left arm, 3 right arm, 4 torso, 5 left leg, 6 right leg); absent when the striker chose the spot. */
    locationRoll?: number;
    /** The striker chose where to hit: the test passed by more than 20. */
    aimed?: boolean;
    /** The k6 added to the weapon's strength, and the armour on the spot hit that took it off. */
    damageRoll?: number; armour?: number;
    parry?: TestResult; parried?: boolean;
    /** The skill card behind the hero's strike. */
    card?: string;
    /** Whirling Axe: the foe's Dexterity roll to get out of the way. */
    dodge?: TestResult; dodged?: boolean;
    /** Barrier: the foe's Strength roll to break through; `blocked` when it failed. */
    barrier?: TestResult; blocked?: boolean;
    /** The magic scroll behind the hero's strike. */
    scroll?: string;
  }
  /** A scroll read on the hero (Healing, Renewal); `amount` is Vitality healed. */
  | { type: 'scroll'; item: string; amount: number }
  /** A burning foe: loses 1 Vitality and tests Strength to put the fire out; the 3rd failure kills it. */
  | { type: 'burn'; uid: string; result: TestResult; damage: number; out: boolean; dead: boolean }
  | { type: 'trap'; uid: string; result: TestResult; damage: number }
  /** Guardian's Defensive Stance taken for the round. */
  | { type: 'stance' }
  /** Disarm: the foe's Dexterity roll to keep its weapon; `kept` false means it lost it. */
  | { type: 'disarm'; uid: string; result: TestResult; kept: boolean }
  /** A disarmed foe's opposed Dexterity test to pick its weapon up again. */
  | { type: 'rearm'; uid: string; foe: TestResult; hero: TestResult; success: boolean }
  /** Companion: the hero's Charisma test to tame a beast (in the fight, or once a round while the bond grows). */
  | { type: 'tame'; uid: string; result: TestResult }
  | { type: 'companionDown'; uid: string }
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
  return { foes, turn: 1, focus: false, heroStunned: false, reloading: false, onWin, round: world.round };
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
  // Hard Hide: the Guardian's own skin counts 1 on every part of the body, on top of armour.
  if ((actor.character.cards ?? []).includes('guardian-hide')) for (const slot of Object.keys(out) as ArmourSlot[]) out[slot] += 1;
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
  const first = combat.foes.find((f) => f.vitality > 0);
  for (const id of readableScrolls(actor, combat.round ?? -1, true)) {
    const attack = scrollOf(id)!.power !== undefined;
    if (attack && !first) continue;
    moves.push({ move: 'scroll', item: id, ...(attack ? { target: first!.uid } : {}) });
  }
  const cards = actor.character.cards ?? [];
  const alive = combat.foes.filter((f) => f.vitality > 0);
  const target = moves.find((m) => m.move === 'attack') as { target: string } | undefined;
  if (target) {
    for (const card of ['warrior-heavy-swing', 'diver-blowpipe', 'cavedelver-whirling-axe']) {
      if (cards.includes(card)) moves.push({ move: 'card', card, target: target.target });
    }
  }
  const armed = alive.find(canDisarm);
  if (cards.includes('explorer-disarm') && armed) moves.push({ move: 'card', card: 'explorer-disarm', target: armed.uid });
  const beast = alive.find((f) => canTame(actor, f));
  if (cards.includes('druid-companion') && beast) moves.push({ move: 'card', card: 'druid-companion', target: beast.uid });
  if (cards.includes('trapper-trap') && !combat.trap) moves.push({ move: 'card', card: 'trapper-trap' });
  if (cards.includes('mystic-barrier') && !combat.barrier) moves.push({ move: 'card', card: 'mystic-barrier' });
  if (cards.includes('guardian-stance') && !combat.stanceUsed) moves.push({ move: 'card', card: 'guardian-stance' });
  for (const card of ['warrior-rations', 'wraith-leaves']) {
    if (cards.includes(card) && (usesLeft(actor, card) ?? 0) > 0) moves.push({ move: 'card', card });
  }
  for (const card of ['elder-herb', 'runemaster-empower']) {
    if (cards.includes(card) && !isSpent(actor, card)) moves.push({ move: 'card', card });
  }
  if (cards.includes('explorer-bandages')) moves.push({ move: 'card', card: 'explorer-bandages' });
  return moves;
}

/** Disarm only works on foes that fight with a weapon in hand, not on beasts or spirits. */
export const canDisarm = (foe: Foe) => !foe.disarmed && ['human', 'thug', 'demon'].includes(ENEMIES[foe.enemy]!.kind);

/** Most beasts that follow a Druid at once (Companion). */
export const MAX_COMPANIONS = 2;
/** Companion: a beast under 10 Vitality can be tamed. */
export const TAME_BELOW = 10;
export const canTame = (actor: Pick<ActorState, 'companions'>, foe: Foe) =>
  ENEMIES[foe.enemy]!.kind === 'beast' && foe.vitality < TAME_BELOW && (actor.companions ?? []).length < MAX_COMPANIONS;
/** Charisma tests passed that make a tamed beast stay for good. */
export const BOND_NEEDED = 3;

/** Margin over the Combat target past which the striker picks where the blow lands ("Walka!", d. Atak). */
export const AIM_MARGIN = 20;

/** The spot with the least armour, torso first on a tie. */
export const weakestSpot = (armour: Partial<Record<ArmourSlot, number>>): ArmourSlot =>
  (['torso', 'head', 'arms', 'legs'] as ArmourSlot[]).reduce((best, s) => ((armour[s] ?? 0) < (armour[best] ?? 0) ? s : best), 'torso');

/**
 * Where a hit lands: a strike that passed by more than 20 goes where the striker aims
 * (the weakest spot when nothing was chosen), otherwise a k6 decides.
 */
function hitLocation(rng: Rng, margin: number, armour: Partial<Record<ArmourSlot, number>>, aim?: ArmourSlot): { location: ArmourSlot; locationRoll?: number; aimed?: boolean } {
  if (margin > AIM_MARGIN) return { location: aim ?? weakestSpot(armour), aimed: true };
  const locationRoll = rng.die(6);
  return { location: HIT_LOCATIONS[locationRoll - 1]!, locationRoll };
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
  // Defensive Stance, like a parry, is taken for the whole round.
  const stance = move.move === 'card' && move.card === 'guardian-stance' && !combat.heroStunned;
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
  const aim = 'aim' in move ? move.aim : undefined;
  if (aim !== undefined && !(['head', 'arms', 'torso', 'legs'] as const).includes(aim)) throw new EngineError('combat.aim', 'Aim at the head, arms, torso or legs.');
  const swing = (target: Foe, opts: { mod?: number; bonus?: number; power?: number; poison?: boolean; card?: string; dodge?: boolean; scroll?: string } = {}): boolean => {
    const enemy = ENEMIES[target.enemy]!;
    const mod = focus + (rune === 'precise' ? 5 : 0) + (opts.mod ?? 0);
    const result = heroTest(world, actor, 'com', rng, mod, enemy.kind);
    const base = { type: 'strike' as const, by: HERO, target: target.uid, result, ...(opts.card ? { card: opts.card } : {}), ...(opts.scroll ? { scroll: opts.scroll } : {}) };
    if (!result.success) {
      events.push(base);
      return false;
    }
    let dodge: TestResult | undefined;
    if (opts.dodge) {
      dodge = test(rng, enemy.dex);
      if (dodge.success) {
        events.push({ ...base, dodge, dodged: true });
        return false;
      }
    }
    const spot = hitLocation(rng, result.margin, enemy.armour, aim);
    const { location } = spot;
    const armour = enemy.armour[location] ?? 0;
    // Critical Point: +1 damage for each 10 the roll beat the target by, at most 4.
    const magic = !!opts.scroll;
    const critical = !magic && cards.includes('wraith-critical') ? Math.min(4, Math.floor(result.margin / 10)) : 0;
    // Precise Shot: a longbow hit that beat the target by 15 or more deals +2.
    const precise = cards.includes('trapper-precise-shot') && weapon.id === 'longBow' && result.margin >= 15 ? 2 : 0;
    // A scroll's magic is not a blade: weapon runes and weapon bonuses do not add to it.
    const damageRoll = damageDie(rng, !magic && (!!weapon.penetrating || rune === 'piercing'));
    let damage = magic
      ? strengthStep(attrs.str) + (opts.power ?? 0) + damageRoll - armour
      : strengthStep(attrs.str) + (opts.power ?? weapon.power) + damageRoll
        + itemBonus(actor, 'damage') + effectBonus(actor, world.round, 'damage') + (rune === 'sharp' && armour > 0 ? 1 : 0)
        + critical + precise + (opts.bonus ?? 0) - armour;
    // Spirits are hurt in full only by magic or runes.
    if (enemy.traits.includes('ethereal') && !rune && !magic) damage = Math.floor(damage / 2);
    damage = Math.max(0, damage);
    target.vitality -= damage;
    target.hits++;
    if ((rune === 'venom' && !magic) || opts.poison) target.poisoned = true;
    if (rune === 'stunning' && !magic && target.hits % 3 === 0) target.stunned = true;
    if (opts.scroll && scrollOf(opts.scroll)?.spell === 'fire' && target.burning === undefined) target.burning = 0;
    events.push({ ...base, ...spot, damage, damageRoll, armour, ...(dodge ? { dodge } : {}) });
    if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
    return true;
  };
  const targetOf = (uid?: string) => alive().find((f) => f.uid === uid) ?? alive()[0];
  if (move.move === 'potion' && !actor.inventory.items.includes(move.item)) {
    throw new EngineError('combat.item', 'You do not carry that.');
  }
  if (move.move === 'scroll' && !combatMoves(actor, combat).some((m) => m.move === 'scroll' && m.item === move.item)) {
    throw new EngineError('scroll.notNow', 'You cannot read that scroll now.');
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
      case 'scroll': {
        const scroll = spendScroll(actor, combat.round ?? world.round, move.item);
        if (scroll.power === undefined) {
          events.push({ type: 'scroll', item: move.item, amount: selfSpell(actor, scroll) });
          break;
        }
        const target = targetOf(move.target);
        // Strength of the Forest helps the Druid shape the scroll's magic in a forest.
        if (target) swing(target, { power: scroll.power, scroll: move.item, mod: magicBonus(world, actor) });
        break;
      }
      case 'potion': {
        actor.inventory.items.splice(actor.inventory.items.indexOf(move.item), 1);
        drinkPotion(world, actor, move.item);
        events.push({ type: 'drink', item: move.item });
        break;
      }
      case 'flee': {
        const fastest = alive().reduce((a, b) => (ENEMIES[b.enemy]!.dex > ENEMIES[a.enemy]!.dex ? b : a));
        const harried = alive().some((f) => ENEMIES[f.enemy]!.traits.includes('harrying')) ? -10 : 0;
        const hero = heroTest(world, actor, 'dex', rng, focus + harried);
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
          case 'explorer-disarm': {
            // Disarm: a plain blow; a foe it hits tests Dexterity or loses its weapon.
            const target = targetOf(move.target);
            if (!target || !canDisarm(target)) throw new EngineError('combat.target', 'That foe cannot be disarmed.');
            if (swing(target, { card: move.card }) && target.vitality > 0) {
              const result = test(rng, ENEMIES[target.enemy]!.dex);
              if (!result.success) target.disarmed = true;
              events.push({ type: 'disarm', uid: target.uid, result, kept: result.success });
            }
            break;
          }
          case 'druid-companion': {
            // Companion: a Charisma test tames a weak beast; it leaves the fight and follows the Druid.
            const target = targetOf(move.target);
            if (!target || !canTame(actor, target)) throw new EngineError('combat.target', 'That beast cannot be tamed.');
            const result = heroTest(world, actor, 'cha', rng, focus);
            events.push({ type: 'tame', uid: target.uid, result });
            if (result.success) {
              const n = (actor.counters.tamed ?? 0) + 1;
              actor.counters.tamed = n;
              (actor.companions ??= []).push({
                uid: `pet-${target.enemy}-${n}`,
                enemy: target.enemy, vitality: target.vitality, maxVitality: target.maxVitality, bond: 1, tame: false,
              });
              target.tamed = true;
              target.vitality = 0;
            }
            break;
          }
          case 'guardian-stance':
            combat.stanceUsed = true;
            events.push({ type: 'stance' });
            break;
          case 'elder-herb':
            events.push({ type: 'card', card: move.card, amount: healingHerb(actor) });
            break;
          case 'explorer-bandages':
            events.push({ type: 'card', card: move.card, amount: bandage(actor) });
            break;
          case 'runemaster-empower':
            empower(world.round, actor);
            events.push({ type: 'card', card: move.card, amount: 2 });
            break;
          case 'mystic-barrier': {
            const result = heroTest(world, actor, 'int', rng, focus + magicBonus(world, actor));
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

  const pets = () => (actor.companions ?? []).filter((p) => p.vitality > 0);

  const foeTurn = (foe: Foe) => {
    if (foe.vitality <= 0 || actor.character.vitality <= 0 || enthralled) return;
    if (foe.stunned) {
      foe.stunned = false;
      events.push({ type: 'stunned', who: foe.uid });
      return;
    }
    const enemy: Enemy = ENEMIES[foe.enemy]!;
    if (foe.disarmed) {
      // Disarm: the foe spends its turn on an opposed Dexterity test to get its weapon back. Both must pass;
      // then the lower roll wins, and a tie goes to the Explorer.
      const own = test(rng, enemy.dex);
      const hero = heroTest(world, actor, 'dex', rng, focus);
      const success = own.success && (!hero.success || own.roll < hero.roll);
      if (success) foe.disarmed = false;
      events.push({ type: 'rearm', uid: foe.uid, foe: own, hero, success });
      return;
    }
    // With companions in the fight, each foe picks whom to strike: the hero or one of the beasts.
    const beside = pets();
    if (beside.length) {
      const pick = rng.int(beside.length + 1);
      if (pick > 0) return strikePet(foe, enemy, beside[pick - 1]!);
    }
    foe.attacks++;
    const sting = enemy.traits.includes('stinger') && foe.attacks % 3 === 0;
    const result = test(rng, enemy.com, fleeing ? 10 : 0);
    // Riposte: in the defensive stance the Guardian answers every attack with the spear.
    const riposte = () => {
      if (stance && cards.includes('guardian-riposte') && foe.vitality > 0) swing(foe, { mod: -10, power: 1, card: 'guardian-riposte' });
    };
    if (!result.success) {
      events.push({ type: 'strike', by: foe.uid, target: HERO, result });
      riposte();
      return;
    }
    if (stance) {
      events.push({ type: 'strike', by: foe.uid, target: HERO, result, blocked: true, card: 'guardian-stance' });
      riposte();
      return;
    }
    if (parrying) {
      const shield = actor.character.equipment.shield ? 15 : 0;
      const parry = heroTest(world, actor, 'com', rng, focus + shield, enemy.kind);
      if (parry.success && parry.roll <= result.roll) {
        events.push({ type: 'strike', by: foe.uid, target: HERO, result, parry, parried: true });
        return;
      }
      events.push({ type: 'strike', by: foe.uid, target: HERO, result, parry, parried: false });
    }
    const armour = heroArmour(actor);
    const spot = hitLocation(rng, result.margin, armour);
    const { location } = spot;
    const damageRoll = damageDie(rng, enemy.traits.includes('penetrating'));
    let damage = Math.max(0, strengthStep(enemy.str) + enemy.weapon.power + (sting ? 1 : 0) + damageRoll - armour[location]);
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
    events.push({ type: 'strike', by: foe.uid, target: HERO, result, ...spot, damage, damageRoll, armour: armour[location], ...(barrier ? { barrier } : {}) });
    if (enemy.traits.includes('poison') || sting) {
      addCondition(actor, 'poison', { pl: 'Zatrucie', en: 'Poisoned' }, 'str', 1);
      events.push({ type: 'poisoned', who: HERO, condition: 'poison' });
    }
    if (enemy.traits.includes('rot')) {
      addCondition(actor, 'rot', { pl: 'Zgnilizna', en: 'Rot' }, 'dex', 2);
      events.push({ type: 'poisoned', who: HERO, condition: 'rot' });
    }
    if (enemy.traits.includes('stun') && !heroTest(world, actor, 'wil', rng, focus).success) {
      combat.heroStunned = true;
    }
    if (enemy.traits.includes('drain')) {
      actor.staminaLeft = Math.max(0, actor.staminaLeft - 1);
      if (actor.staminaLeft === 0) enthralled = true;
    }
  };

  /** A foe's blow at one of the hero's beasts: no armour, no parry. */
  const strikePet = (foe: Foe, enemy: Enemy, pet: Companion) => {
    foe.attacks++;
    const result = test(rng, enemy.com);
    if (!result.success) {
      events.push({ type: 'strike', by: foe.uid, target: pet.uid, result });
      return;
    }
    const damage = Math.max(0, strengthStep(enemy.str) + enemy.weapon.power + damageDie(rng, enemy.traits.includes('penetrating')));
    pet.vitality -= damage;
    events.push({ type: 'strike', by: foe.uid, target: pet.uid, result, damage });
    if (pet.vitality <= 0) events.push({ type: 'companionDown', uid: pet.uid });
  };

  /** Each companion bites the hero's target, or the first foe standing, with its own stats. */
  const petsTurn = () => {
    for (const pet of pets()) {
      const target = targetOf(move.move === 'attack' || move.move === 'card' ? move.target : undefined);
      if (!target) return;
      const beast = ENEMIES[pet.enemy]!;
      const foe = ENEMIES[target.enemy]!;
      const result = test(rng, beast.com);
      if (!result.success) {
        events.push({ type: 'strike', by: pet.uid, target: target.uid, result });
        continue;
      }
      const spot = hitLocation(rng, result.margin, foe.armour);
      const damageRoll = damageDie(rng, false);
      const armour = foe.armour[spot.location] ?? 0;
      const damage = Math.max(0, strengthStep(beast.str) + beast.weapon.power + damageRoll - armour);
      target.vitality -= damage;
      events.push({ type: 'strike', by: pet.uid, target: target.uid, result, ...spot, damage, damageRoll, armour });
      if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
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
    if (slot.id === HERO) {
      heroTurn();
      petsTurn();
    } else foeTurn(combat.foes.find((f) => f.uid === slot.id)!);
  }
  // Fallen companions are gone for good.
  if (actor.companions?.some((p) => p.vitality <= 0)) actor.companions = actor.companions.filter((p) => p.vitality > 0);

  // Fire bolt: a burning foe loses 1 Vitality a round and tests Strength to put the fire out; the 3rd failure kills it.
  for (const foe of alive()) {
    if (foe.burning === undefined) continue;
    const result = test(rng, ENEMIES[foe.enemy]!.str);
    foe.vitality -= 1;
    if (result.success) delete foe.burning;
    else foe.burning++;
    const dead = foe.burning !== undefined && foe.burning >= BURN_DEATH;
    if (dead) foe.vitality = 0;
    events.push({ type: 'burn', uid: foe.uid, result, damage: 1, out: result.success, dead });
    if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
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
