import {
  ENEMIES, HIT_LOCATIONS, ITEMS,
  type ArmourSlot, type Attribute, type Enemy, type Outcome, type WeaponItem,
} from '@hp/content';
import { DIFFICULTIES } from './config';
import { test, type TestResult } from './dice';
import { EngineError } from './errors';
import { Rng as RngCtor, type Rng } from './rng';
import { bandage, eatRations, empower, healingHerb, isSpent, useLeaves, usesLeft, trapFoes } from './cards';
import { allyBonus, callBeast, highBuff, HIGH_BUFFS, voidHeal } from './cardsHigh';
import { BURN_DEATH, readableScrolls, scrollOf, selfSpell, spendScroll } from './scrolls';
import { effectBonus, heroTest, isWater, itemBonus, magicBonus, runesOf, suddenDex, type ActorState, type Companion, type WorldView } from './terrain';

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
  /** Filleting or Shark Blade: a deep wound, the number of rounds it has bled; at 3 the foe bleeds out. */
  wound?: number;
  /** Black Vines: the foe is bound and tests Strength each turn to tear free. */
  vined?: boolean;
  /** Master of Beasts: Charisma tests in a row that hold this beast (it fights for the hero meanwhile). */
  controlled?: number;
  /** Master of Beasts: on its next move the held beast strikes another foe instead of the hero. */
  held?: boolean;
  /** Blinding Light: −30 Combat and Dexterity until the end of this combat turn. */
  blindUntil?: number;
  /** Fangs: the foe bleeds, the number of rounds so far; it stops on a passed Strength test, and the 3rd round kills. */
  bleed?: number;
  // Level 5–9 cards.
  /** Sleep Dart: the foe sleeps and does not attack; a blow wakes it. */
  asleep?: boolean;
  /** Flashbang: the combat turn the foe was dazed in (−20, then −10, then −5 to every test). */
  dazed?: number;
  /** Blinding Spice: −20 Combat and Dexterity up to this combat turn. */
  spiced?: number;
  /** Toxin: poison that adds up; the foe loses this much Vitality every round. */
  venom?: number;
  /** Venom Bone: rounds of the rising poison so far; each round takes one more. */
  rising?: number;
  /** The Wraith's Piercing Arrow: a wound right through, −1 Vitality a round and −10 Combat. */
  gash?: boolean;
  /** Blazing Hammer: parts of the body whose armour is smashed. */
  shattered?: ArmourSlot[];
  /** Flamethrower: the combat turn the foe caught fire; the next round it loses half its Vitality and tests again. */
  inferno?: number;
  /** How the foe left the fight without being beaten down: run off (Intimidation), swallowed by the void (Chasm),
   *  or fallen into the split ground (Rending). Fled and void foes give half XP. */
  gone?: 'fled' | 'void' | 'fell';
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
  /** Strategist: the round of study is spent (once a fight); +10 Combat after it. */
  studied?: boolean;
  /** Strategist: the kind of foe studied; the +10 counts against every foe of that kind (Jacob, 2026-11-26). */
  studiedKind?: string;
  /** The hero journal's say, fixed as the fight starts: a bestiary note's +5 and the careful's −5 on the first test, the bold's −5 to flee. */
  journal?: { lore: number; careful: number; flee: number; used?: boolean };
  /** Poisoned Arrow: shots taken this fight (2 a fight). */
  arrows?: number;
  /** Blinding Light was used in this fight (once a fight). */
  blindUsed?: boolean;
  /** Veil of Mist: the combat turn the mist was let out on; it lasts that turn and the next. */
  mist?: number;
  /** Witch's drain: Stamina taken by the spell's blows this fight. The hero falls under her power once it reaches
   *  their full Stamina, not the Stamina left over from moving (Jacob, 2026-11-27: one hit must not end the fight). */
  drained?: number;
  // Level 5–9 cards.
  /** Cards already played in this fight, for the once-a-fight ones. */
  once?: string[];
  /** Toxin: the last combat turn the hero's blows and skin carry the poison. */
  toxin?: number;
  /** Bloodlust: the trance has begun (+10 Str, Dex and Combat and +2 damage until the fight ends). */
  bloodlust?: boolean;
  /** Double: the last combat turn the Mystic's double stands, unless a foe hits it first. */
  double?: number;
  /** Shield Wall: blows that land and the shields still stop. */
  wall?: number;
  /** Spear Throw: the spear lies in the foe; the next attack picks it up. */
  unarmed?: boolean;
  /** Water Bolt shaped away from water this fight (2 a fight). */
  waterBolts?: number;
  /** Flamethrower: combat turns it has burned in this fight (2 in a row). */
  flames?: number[];
  /** The fight is on a fragment with water (Water Bolt). */
  wet?: boolean;
}

export type CombatMove =
  /** `aim`: the spot the hero goes for; it is hit when the Combat test passes by 20 or more. */
  | { move: 'attack'; target: string; aim?: ArmourSlot; boost?: Boost }
  | { move: 'parry' }
  | { move: 'focus' }
  | { move: 'flee' }
  | { move: 'potion'; item: string }
  /** A magic scroll: Fire bolt and Lightning at a foe, Healing and Renewal on the hero. */
  | { move: 'scroll'; item: string; target?: string; aim?: ArmourSlot; boost?: Boost }
  /** A skill card played as the hero's move; `target` for the attacking cards. */
  | { move: 'card'; card: string; target?: string; aim?: ArmourSlot; boost?: Boost };

/** A card added to another move without taking the round: Taking Aim's +20 to the Combat test. */
export type Boost = 'wraith-aim';

export type CombatEvent =
  | {
    type: 'strike'; by: string; target: string; result: TestResult; location?: ArmourSlot; damage?: number;
    /** The k6 for the hit location (1 head, 2 left arm, 3 right arm, 4 torso, 5 left leg, 6 right leg); absent when the striker chose the spot. */
    locationRoll?: number;
    /** The striker chose where to hit: the test passed by 20 or more. */
    aimed?: boolean;
    /** The k6 added to the weapon's strength, and the armour on the spot hit that took it off. */
    damageRoll?: number; armour?: number;
    /** The strength of the blow before the k6: S plus the weapon and every bonus. */
    strength?: number;
    /** The damage was halved after armour (a spirit hit without magic, or a blow through the Barrier). */
    halved?: boolean;
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
  /** Lightning: the foe hit tests Strength; `stunned` when it failed and loses its next attack. */
  | { type: 'shock'; uid: string; result: TestResult; stunned: boolean }
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
  /** `foe` is missing when no foe rolls against the flight (Smoke Bomb). */
  | { type: 'flee'; success: boolean; hero: TestResult; foe?: TestResult; card?: string }
  | { type: 'focus' }
  | { type: 'stunned'; who: string }
  | { type: 'drink'; item: string }
  | { type: 'reload' }
  | { type: 'foeDown'; uid: string; enemy: string }
  | { type: 'poisoned'; who: string; condition?: string }
  | { type: 'bleed'; uid: string; damage: number; dead?: boolean }
  /** A deep wound: the foe's Dexterity test to staunch it (its move), or the round's blood loss; `dead` at the 3rd. */
  | { type: 'wound'; uid: string; result?: TestResult; staunched?: boolean; damage?: number; dead?: boolean }
  /** Black Vines: the hero's Intelligence test to bind, or the bound foe's Strength test to tear free. */
  | { type: 'vines'; uid: string; by: 'hero' | 'foe'; result: TestResult; bound: boolean }
  /** Master of Beasts: the Charisma test of `step` (1–3); `companion` when the third one made the beast stay. */
  | { type: 'master'; uid: string; result: TestResult; step: number; companion?: boolean }
  /** Camouflage: the hero's Dexterity test and the foes' Intelligence tests; `hidden` avoids the fight. */
  | { type: 'hide'; hero: TestResult; foes: { uid: string; result: TestResult }[]; hidden: boolean }
  /** Blinding Light: each foe's Dexterity test; `blinded` lists those who failed. */
  | { type: 'blind'; foes: { uid: string; result: TestResult }[] }
  /** Fangs: the opposed Strength test after a bite; `torn` adds +4 damage. */
  | { type: 'tear'; uid: string; hero: TestResult; foe: TestResult; torn: boolean }
  /** A held beast's blow at another foe (Master of Beasts). */
  | { type: 'held'; uid: string }
  /** Drain (the witch): a blow that landed takes 1 Stamina; `left` is what the hero still has against the spell. */
  | { type: 'drain'; uid: string; left: number; of: number }
  /** A test the hero throws for a skill card (an Int test to shape a void bolt, a Wil test to call the pack...). */
  | { type: 'cardTest'; card: string; attribute: Attribute; result: TestResult }
  /** A foe's test against a skill card (a Dex test against the gale, an Int test against the flashbang...). */
  | { type: 'save'; uid: string; card: string; attribute: Attribute; result: TestResult }
  /** A state a skill card puts on a foe or the hero, or takes away; `uid` is HERO for the hero. See STATUS_WORDS in the app. */
  | { type: 'status'; uid: string; card: string; what: CardStatus; amount?: number }
  /** A foe's blow at the Mystic's double; a hit makes it vanish. */
  | { type: 'decoy'; uid: string; result: TestResult; gone: boolean };

/** What a `status` event says happened. */
export type CardStatus =
  | 'asleep' | 'sleeping' | 'woke' | 'dazed' | 'spiced' | 'gash' | 'shattered' | 'burning' | 'burnedOut' | 'burnedDown'
  | 'fled' | 'void' | 'fell' | 'stays' | 'gale' | 'venom' | 'rising' | 'bloodlust' | 'summoned' | 'wall' | 'walled'
  | 'unarmed' | 'pickedUp' | 'double' | 'fizzle' | 'buff' | 'healed' | 'dodged' | 'hit';

export type CombatResult = 'ongoing' | 'won' | 'lost' | 'fled' | 'hidden' | 'enthralled';

export const HERO = 'hero';

/** Strength step "S" from the weapon table: Strength divided by 10, rounded down. */
export const strengthStep = (str: number) => Math.floor(str / 10);

export function startCombat(world: WorldView, enemies: string[], onWin: Outcome[] = [], at?: number): CombatState {
  const factor = DIFFICULTIES[world.difficulty].enemyVitality;
  const foes = enemies.map((id, i): Foe => {
    const enemy = ENEMIES[id];
    if (!enemy) throw new EngineError('combat.enemy', `Unknown enemy ${id}.`);
    const vitality = Math.max(1, Math.round(enemy.vitality * factor));
    return { uid: `${id}-${i + 1}`, enemy: id, vitality, maxVitality: vitality, attacks: 0, stunned: false, poisoned: false, hits: 0 };
  });
  const wet = at !== undefined && at >= 0 && isWater(world.terrainAt(at));
  return { foes, turn: 1, focus: false, heroStunned: false, reloading: false, onWin, round: world.round, ...(wet ? { wet } : {}) };
}

export function heroWeapon(actor: ActorState): WeaponItem {
  const item = ITEMS[actor.character.equipment.weapon];
  return item?.kind === 'weapon' ? item : (ITEMS.oneHanded as WeaponItem);
}

/** The worn piece of armour that guards a part of the body (the strongest one), if any. */
export function armourPiece(actor: Pick<ActorState, 'character'>, slot: ArmourSlot): string | null {
  let best: string | null = null;
  let value = -1;
  for (const id of actor.character.equipment.armour) {
    const item = ITEMS[id];
    if (item?.kind !== 'armour' || !item.covers.includes(slot) || item.value <= value) continue;
    best = id;
    value = item.value;
  }
  return best;
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
  // Reinforcement: the Runemaster's +1 on a piece of armour (at most 5 in all); a new piece is not reinforced.
  for (const slot of Object.keys(out) as ArmourSlot[]) {
    const piece = armourPiece(actor, slot);
    if (piece && actor.counters[`reinforced:${slot}:${piece}`]) out[slot] = Math.min(5, out[slot] + 1);
  }
  // Protective Field and Stone Skin: armour on every part of the body while they last. Expired effects are
  // dropped when the round passes, so every one still held counts now.
  const extra = actor.effects.filter((e) => e.attribute === 'armour').reduce((sum, e) => sum + e.amount, 0);
  if (extra) for (const slot of Object.keys(out) as ArmourSlot[]) out[slot] += extra;
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
    for (const card of ['warrior-heavy-swing', 'diver-blowpipe', 'cavedelver-whirling-axe', 'diver-fillet', 'druid-fangs']) {
      if (cards.includes(card)) moves.push({ move: 'card', card, target: target.target });
    }
    if (cards.includes('trapper-poison-arrow') && heroWeapon(actor).ranged && (combat.arrows ?? 0) < POISON_ARROWS) {
      moves.push({ move: 'card', card: 'trapper-poison-arrow', target: target.target });
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
  // Level 3 cards.
  const held = alive.find((f) => canMaster(actor, f));
  if (cards.includes('elder-beast-master') && held) moves.push({ move: 'card', card: 'elder-beast-master', target: held.uid });
  if (cards.includes('diver-camouflage') && combat.turn === 1) moves.push({ move: 'card', card: 'diver-camouflage' });
  if (cards.includes('explorer-smoke')) moves.push({ move: 'card', card: 'explorer-smoke' });
  if (cards.includes('warrior-strategist') && !combat.studied && alive.length) moves.push({ move: 'card', card: 'warrior-strategist', target: alive[0]!.uid });
  const free = alive.find((f) => !f.vined);
  if (cards.includes('mystic-vines') && free) moves.push({ move: 'card', card: 'mystic-vines', target: free.uid });
  if (cards.includes('wraith-mist') && !isSpent(actor, 'wraith-mist')) moves.push({ move: 'card', card: 'wraith-mist' });
  if (cards.includes('cavedelver-blind') && !combat.blindUsed && alive.length) moves.push({ move: 'card', card: 'cavedelver-blind' });
  if (target) moves.push(...highCardMoves(actor, combat, target.target));
  return moves;
}

/** Whether a once-a-fight card is still unplayed in this fight. */
export const freshInFight = (combat: Pick<CombatState, 'once'>, card: string) => !(combat.once ?? []).includes(card);

/** Companions the hero has room for: 2, or 3 with the Druid's Lord of the Forest. Called beasts (dog, wolves, voidling) do not count. */
export const maxCompanions = (actor: Pick<ActorState, 'character'>) => ((actor.character.cards ?? []).includes('druid-forest-lord') ? 3 : MAX_COMPANIONS);
export const boundCompanions = (actor: Pick<ActorState, 'companions'>) => (actor.companions ?? []).filter((p) => !p.summoned).length;
/** Lord of the Forest: a beast of at most 20 Vitality, while the Druid has room for it. */
export const canRule = (actor: Pick<ActorState, 'companions' | 'character'>, foe: Foe) =>
  ENEMIES[foe.enemy]!.kind === 'beast' && foe.vitality <= MASTER_MAX_VITALITY && boundCompanions(actor) < maxCompanions(actor);
/** Beheading: a foe of at most this much Vitality dies at one blow. */
export const BEHEAD_MAX = 20;
/** Headshot: the Vitality the shot takes. */
export const HEADSHOT = 20;
/** Water Bolt: bolts a fight away from water. */
export const DRY_BOLTS = 2;
/** Untouchable: easy Dex tests passed before the Wraith can dodge. */
export const DODGE_LESSONS = 3;
/** Flashbang: the dazed foe's penalty in its first, second and third round. */
export const DAZE = [-20, -10, -5];

/** Fight moves of the level 5 to 9 cards. `target` is the first foe an attack would go at. */
function highCardMoves(actor: ActorState, combat: CombatState, target: string): CombatMove[] {
  const cards = actor.character.cards ?? [];
  const out: CombatMove[] = [];
  const alive = combat.foes.filter((f) => f.vitality > 0);
  const ranged = !!heroWeapon(actor).ranged;
  const has = (card: string) => cards.includes(card);
  const once = (card: string) => has(card) && freshInFight(combat, card);
  const camp = (card: string) => has(card) && !isSpent(actor, card);
  const at = (card: string) => out.push({ move: 'card', card, target });
  const self = (card: string) => out.push({ move: 'card', card });
  // Attacks at one foe.
  if (has('trapper-piercing-arrow') && ranged) at('trapper-piercing-arrow');
  if (once('trapper-volley') && ranged) at('trapper-volley');
  if (has('diver-sleep')) at('diver-sleep');
  if (has('diver-water-bolt') && (combat.wet || (combat.waterBolts ?? 0) < DRY_BOLTS)) at('diver-water-bolt');
  if (has('gourmet-spice')) at('gourmet-spice');
  if (has('gourmet-venom-bone')) at('gourmet-venom-bone');
  if (has('warrior-wide-swing')) at('warrior-wide-swing');
  const small = alive.find((f) => f.vitality <= BEHEAD_MAX);
  if (once('warrior-behead') && small) out.push({ move: 'card', card: 'warrior-behead', target: small.uid });
  if (has('mystic-void-bolt')) at('mystic-void-bolt');
  if (has('guardian-claw')) at('guardian-claw');
  if (has('guardian-spear') && !combat.unarmed) at('guardian-spear');
  if (once('wraith-pierce') && ranged) at('wraith-pierce');
  if (has('wraith-triple-shot') && ranged) at('wraith-triple-shot');
  if (once('wraith-headshot') && ranged) at('wraith-headshot');
  if (has('runemaster-hammer')) at('runemaster-hammer');
  const beast = alive.find((f) => canRule(actor, f));
  if (has('druid-forest-lord') && beast) out.push({ move: 'card', card: 'druid-forest-lord', target: beast.uid });
  // Moves at every foe, or none.
  if (once('elder-mistral')) self('elder-mistral');
  if (once('explorer-flashbang')) self('explorer-flashbang');
  if (has('explorer-shrapnel') && (usesLeft(actor, 'explorer-shrapnel') ?? 0) > 0) self('explorer-shrapnel');
  if (once('warrior-intimidate')) self('warrior-intimidate');
  if (once('mystic-illusion')) self('mystic-illusion');
  if (once('mystic-chasm')) self('mystic-chasm');
  if (camp('runemaster-rend')) self('runemaster-rend');
  if (has('cavedelver-dynamite') && (usesLeft(actor, 'cavedelver-dynamite') ?? 0) > 0) self('cavedelver-dynamite');
  const flames = combat.flames ?? [];
  if (has('cavedelver-flamethrower') && (flames.length === 0 ? !isSpent(actor, 'cavedelver-flamethrower') : flames.length === 1 && flames[0] === combat.turn - 1)) self('cavedelver-flamethrower');
  // Calls, buffs and defences.
  if (camp('trapper-dog') && !(actor.companions ?? []).some((p) => p.enemy === 'steppeDog')) self('trapper-dog');
  if (once('diver-toxin') && actor.staminaLeft >= 1) self('diver-toxin');
  for (const card of ['elder-beast-form', 'warrior-banner', 'mystic-healing', 'guardian-sign', 'guardian-field', 'druid-totem', 'druid-raven', 'druid-nature-force', 'druid-shapeshift', 'runemaster-honour', 'cavedelver-stone-skin']) {
    if (camp(card)) self(card);
  }
  if (once('mystic-double')) self('mystic-double');
  if (once('guardian-shield-wall')) self('guardian-shield-wall');
  if (has('wraith-untouchable') && (actor.counters.dodgeLessons ?? 0) >= DODGE_LESSONS) self('wraith-untouchable');
  return out;
}

/** The moves Taking Aim can be added to: a Combat test of the hero's own. */
export const canBoost = (actor: Pick<ActorState, 'character'>, combat: Pick<CombatState, 'once'>) =>
  (actor.character.cards ?? []).includes('wraith-aim') && freshInFight(combat, 'wraith-aim');

/** Disarm only works on a foe holding a hand weapon (a blade or an axe), not on claws, teeth, bows or spells (Jacob, 2026-11-25). */
export const canDisarm = (foe: Foe) => !foe.disarmed && !!ENEMIES[foe.enemy]!.weapon.blade;

/** Most beasts that follow a Druid at once (Companion). */
export const MAX_COMPANIONS = 2;
/** Companion: a beast under 10 Vitality can be tamed. */
export const TAME_BELOW = 10;
export const canTame = (actor: Pick<ActorState, 'companions'>, foe: Foe) =>
  ENEMIES[foe.enemy]!.kind === 'beast' && foe.vitality < TAME_BELOW && (actor.companions ?? []).length < MAX_COMPANIONS;
/** Charisma tests passed that make a tamed beast stay for good. */
export const BOND_NEEDED = 3;
/** Master of Beasts: a beast of at most 20 Vitality (Jacob, 2026-11-26), while the Elder has room for a companion; the tests get easier: −10, 0, +10. */
export const MASTER_MAX_VITALITY = 20;
export const canMaster = (actor: Pick<ActorState, 'companions'>, foe: Foe) =>
  ENEMIES[foe.enemy]!.kind === 'beast' && foe.vitality <= MASTER_MAX_VITALITY && (actor.companions ?? []).length < MAX_COMPANIONS;
/** Poisoned Arrow: poisoned shots a Trapper may take in one fight. */
export const POISON_ARROWS = 2;
export const MASTER_STEPS = [-10, 0, 10];
/** A deep wound kills after this many rounds of bleeding. */
export const WOUND_DEATH = 3;
/** Veil of Mist: the foes' Combat penalty in its first and second turn, and their Dexterity penalty. */
export const MIST = { first: -20, second: -10, dex: -10, own: -10 };
export const BLIND = -30;
/** Blinding Spice: the foe's Combat and Dexterity penalty for 3 rounds. */
export const SPICE = -20;
/** The Wraith's Piercing Arrow: the open wound's Combat penalty. */
export const GASH = -10;
/** Bloodlust: the trance's bonus to Strength, Dexterity and Combat (and +2 damage). */
export const BLOODLUST = 10;
/** Taking Aim: added to one Combat test. */
export const AIM_BONUS = 20;
/** Whetstone: damage of a sharpened hand weapon in the next fight. */
export const WHETSTONE = 2;
/** The Trapper's Vigilance: initiative. */
export const TRAPPER_VIGILANCE = 15;
/** Spear Throw: the strength of the thrown spear. */
export const SPEAR_STRENGTH = 15;
/** Shrapnel: the grenade's strength. */
export const SHRAPNEL_STRENGTH = 6;
/** Mistral: Vitality the gale takes from a foe that fails. */
export const MISTRAL_DAMAGE = 2;
/** Shield Wall: blows the shields stop. */
export const SHIELD_WALL = 3;
/** A foe's armour, with what the Blazing Hammer has smashed. */
export const armourOf = (foe: Foe): Partial<Record<ArmourSlot, number>> => {
  const own = ENEMIES[foe.enemy]!.armour;
  if (!foe.shattered?.length) return own;
  const out = { ...own };
  for (const slot of foe.shattered) out[slot] = 0;
  return out;
};
/** Bonus initiative from the Rune of Safety, and from Vigilance. */
export const SAFETY_INITIATIVE = 20;
export const VIGILANCE = 10;
/** Scalp: +1 Combat against a kind of foe for every fight the Guardian has won against it (Jacob, 2026-11-26). */
export const scalpBonus = (actor: Pick<ActorState, 'counters' | 'character'>, enemy: string) =>
  (actor.character.cards ?? []).includes('guardian-scalp') ? actor.counters[`scalp:${enemy}`] ?? 0 : 0;

/** Margin over the Combat target past which the striker picks where the blow lands ("Walka!", d. Atak). */
export const AIM_MARGIN = 20;

/** The spot with the least armour, torso first on a tie. */
export const weakestSpot = (armour: Partial<Record<ArmourSlot, number>>): ArmourSlot =>
  (['torso', 'head', 'arms', 'legs'] as ArmourSlot[]).reduce((best, s) => ((armour[s] ?? 0) < (armour[best] ?? 0) ? s : best), 'torso');

/**
 * Where a hit lands: a strike that passed by 20 or more goes where the striker aims
 * (the weakest spot when nothing was chosen), otherwise a k6 decides.
 */
function hitLocation(rng: Rng, margin: number, armour: Partial<Record<ArmourSlot, number>>, aim?: ArmourSlot): { location: ArmourSlot; locationRoll?: number; aimed?: boolean } {
  if (margin >= AIM_MARGIN) return { location: aim ?? weakestSpot(armour), aimed: true };
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
  const smoke = move.move === 'card' && move.card === 'explorer-smoke';
  const fleeing = (move.move === 'flee' || smoke) && !combat.heroStunned;
  // Defensive Stance, like a parry, is taken for the whole round.
  const stance = move.move === 'card' && move.card === 'guardian-stance' && !combat.heroStunned;
  // So is the Wraith's dodge (Untouchable).
  const dodging = move.move === 'card' && move.card === 'wraith-untouchable' && !combat.heroStunned;
  let fled = false;
  let hidden = false;
  let enthralled = false;
  /** Foes that already acted this turn, so a penalty given now still reaches their next blow. */
  const acted = new Set<string>();
  const mistAge = () => (combat.mist === undefined ? -1 : combat.turn - combat.mist);
  const mistOn = () => mistAge() === 0 || mistAge() === 1;
  /** Flashbang's daze on any test of a foe: −20, then −10, then −5. */
  const dazeMod = (foe: Foe) => (foe.dazed === undefined ? 0 : DAZE[combat.turn - foe.dazed] ?? 0);
  /** Veil of Mist, Blinding Light, Blinding Spice, the daze and the Wraith's arrow wound on a foe's Combat or Dexterity. */
  const foeMod = (foe: Foe, what: 'com' | 'dex') => {
    let m = 0;
    if (mistOn()) m += what === 'dex' ? MIST.dex : mistAge() === 0 ? MIST.first : MIST.second;
    if ((foe.blindUntil ?? 0) >= combat.turn) m += BLIND;
    if ((foe.spiced ?? 0) >= combat.turn) m += SPICE;
    if (what === 'com' && foe.gash) m += GASH;
    return m + dazeMod(foe);
  };
  /** A foe's test against a skill card: its own attribute with the penalties on it. */
  const foeSave = (foe: Foe, card: string, attribute: Attribute, extra = 0): TestResult => {
    const enemy = ENEMIES[foe.enemy]!;
    const base = attribute === 'com' || attribute === 'dex' ? foeMod(foe, attribute) : dazeMod(foe);
    const result = test(rng, enemy[attribute as 'dex'] ?? 0, base + extra);
    events.push({ type: 'save', uid: foe.uid, card, attribute, result });
    return result;
  };
  const vigilance = ((actor.character.cards ?? []).includes('guardian-vigilance') ? VIGILANCE : 0) + suddenDex(actor);
  /** The hero's own Combat modifiers against a foe: Scalp, Strategist's study and the mist's −10. */
  const comMod = (enemy: string) => scalpBonus(actor, enemy) + (combat.studiedKind === enemy ? 10 : 0) + (mistOn() ? MIST.own : 0);
  const alive = () => combat.foes.filter((f) => f.vitality > 0);
  /** The journal on the hero's first test of the fight: a bestiary note's +5, and on an attack the careful's −5. */
  const firstTest = (attack: boolean) => {
    const j = combat.journal;
    if (!j || j.used) return 0;
    j.used = true;
    return j.lore + (attack ? j.careful : 0);
  };
  const weapon = heroWeapon(actor);
  const runes = runesOf(actor.character.equipment);
  const hasRune = (r: string) => runes.includes(r as never);
  /** Bloodlust: +10 Str, Dex and Combat once the trance has begun. */
  const trance = (attribute: Attribute) => (combat.bloodlust && (attribute === 'str' || attribute === 'dex' || attribute === 'com') ? BLOODLUST : 0);
  /** A test of the hero's in this fight, with the trance on it. */
  const ht = (attribute: Attribute, extra = 0, vs?: string) => heroTest(world, actor, attribute, rng, extra + trance(attribute), vs);
  const toxinOn = () => (combat.toxin ?? 0) >= combat.turn;
  const doubleOn = () => (combat.double ?? 0) >= combat.turn;
  /** Beast Form and the Druid's wolf: claws and teeth instead of the weapon. */
  const clawed = actor.effects.some((e) => e.id === 'beastForm' || e.id === 'wolfForm');
  const wolf = actor.effects.some((e) => e.id === 'wolfForm');
  /** Rune of Honour: every Combat test is thrown twice and the better counts. */
  const honour = actor.effects.some((e) => e.id === 'ally:honour');
  /** Taking Aim: +20 to the first Combat test of this move (once a fight). */
  let boost = 'boost' in move && move.boost === 'wraith-aim' && canBoost(actor, combat) ? AIM_BONUS : 0;
  if (boost) (combat.once ??= []).push('wraith-aim');
  const startTrance = () => {
    if (combat.bloodlust || !cards.includes('diver-bloodlust')) return;
    combat.bloodlust = true;
    events.push({ type: 'status', uid: HERO, card: 'diver-bloodlust', what: 'bloodlust' });
  };

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
  const swing = (target: Foe, opts: {
    mod?: number; bonus?: number; power?: number; poison?: boolean; card?: string; dodge?: boolean; scroll?: string; wound?: boolean; tear?: boolean;
    /** A test already thrown for the whole move (Volley, Shrapnel...): every blow of it lands on that one throw. */
    sure?: TestResult;
    /** The foe's Dexterity modifier to dodge (Shrapnel's −10). */
    dodgeMod?: number;
    /** The blow's strength instead of S plus the weapon (Shrapnel's 6, the spear's 15). */
    strength?: number;
    /** Damage dealt as it is, past armour and dice (Headshot, Beheading, Dynamite). */
    fixed?: number;
    /** Magic that is not a scroll (Void Bolt, Water Bolt): no weapon runes or bonuses. */
    magic?: boolean;
    /** Armour does not stop it (Piercing Arrow). */
    pierce?: boolean;
    /** Blazing Hammer: the armour where it lands is smashed. */
    shatter?: boolean;
    /** Talon: the foe bleeds. */
    bleed?: boolean;
  } = {}): boolean => {
    const enemy = ENEMIES[target.enemy]!;
    // A sleeping foe is hit for sure, for +2, and wakes (Sleep Dart).
    const sleeper = !!target.asleep && !opts.sure;
    const mod = focus + (hasRune('precise') ? 5 : 0) + (opts.mod ?? 0) + comMod(target.enemy) + firstTest(true) + boost;
    boost = 0;
    let result = opts.sure ?? (sleeper ? { roll: 1, target: 100, success: true, margin: 0 } : ht('com', mod, enemy.kind));
    if (!result.success && honour && !opts.sure) result = { ...ht('com', mod, enemy.kind), rerolled: 'runemaster-honour', first: result.roll };
    const base = { type: 'strike' as const, by: HERO, target: target.uid, result, ...(opts.card ? { card: opts.card } : {}), ...(opts.scroll ? { scroll: opts.scroll } : {}) };
    if (!result.success) {
      events.push(base);
      return false;
    }
    let dodge: TestResult | undefined;
    if (opts.dodge) {
      dodge = test(rng, enemy.dex, foeMod(target, 'dex') + (opts.dodgeMod ?? 0));
      if (dodge.success) {
        events.push({ ...base, dodge, dodged: true });
        return false;
      }
    }
    const magic = !!opts.scroll || !!opts.magic;
    // Precision: with a hand weapon the Warrior always picks where the blow lands.
    const precision = cards.includes('warrior-precision') && !weapon.ranged && !magic && !opts.card?.startsWith('cavedelver') ? AIM_MARGIN : 0;
    const spot = hitLocation(rng, Math.max(result.margin, precision), armourOf(target), aim);
    const { location } = spot;
    const armour = opts.pierce || opts.fixed !== undefined ? 0 : armourOf(target)[location] ?? 0;
    if (sleeper) {
      delete target.asleep;
      events.push({ type: 'status', uid: target.uid, card: 'diver-sleep', what: 'woke' });
    }
    if (opts.fixed !== undefined) {
      const damage = Math.max(0, Math.min(target.vitality, opts.fixed));
      target.vitality -= damage;
      target.hits++;
      events.push({ ...base, ...spot, damage });
      if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
      startTrance();
      return true;
    }
    // Fangs (and the Druid's wolf): after the bite an opposed Strength test; winning it tears the foe open for +4.
    let tear: CombatEvent | undefined;
    if (opts.tear || (wolf && !magic && !opts.card)) {
      const hero = ht('str');
      const foe = test(rng, enemy.str);
      const torn = hero.success && (!foe.success || hero.roll <= foe.roll);
      tear = { type: 'tear', uid: target.uid, hero, foe, torn };
    }
    // Critical Point: +1 damage for each 10 the roll beat the target by, at most 4.
    const critical = !magic && cards.includes('wraith-critical') ? Math.min(4, Math.floor(result.margin / 10)) : 0;
    // Precise Shot: a longbow hit that beat the target by 15 or more deals +2.
    const precise = cards.includes('trapper-precise-shot') && weapon.id === 'longBow' && result.margin >= 15 ? 2 : 0;
    // Whetstone: a sharpened hand weapon deals +2 in this fight.
    const whet = actor.counters.whetted && !weapon.ranged && !magic && !opts.card?.startsWith('cavedelver') ? WHETSTONE : 0;
    // A scroll's magic is not a blade: weapon runes and weapon bonuses do not add to it.
    const damageRoll = damageDie(rng, !magic && (!!weapon.penetrating || hasRune('piercing')));
    const power = opts.power ?? (clawed ? -1 : weapon.power);
    const strength = opts.strength !== undefined
      ? opts.strength
      : magic
        ? strengthStep(attrs.str) + (opts.power ?? 0)
        : strengthStep(attrs.str) + power
          + itemBonus(actor, 'damage') + effectBonus(actor, world.round, 'damage') + (hasRune('sharp') && armour > 0 ? 1 : 0)
          + critical + precise + whet + (opts.bonus ?? 0) + (tear?.type === 'tear' && tear.torn ? 4 : 0) + (combat.bloodlust ? 2 : 0);
    let damage = strength + damageRoll - armour;
    // Spirits are hurt in full only by magic or runes.
    const halved = enemy.traits.includes('ethereal') && !runes.length && !magic;
    if (halved) damage = Math.floor(damage / 2);
    damage = Math.max(0, damage);
    target.vitality -= damage;
    target.hits++;
    if ((hasRune('venom') && !magic) || opts.poison) target.poisoned = true;
    if (hasRune('stunning') && !magic && target.hits % 3 === 0) target.stunned = true;
    if (opts.scroll && scrollOf(opts.scroll)?.spell === 'fire' && target.burning === undefined) target.burning = 0;
    // Fangs: the bite makes the foe bleed (Jacob, 2026-11-26: like the venom rune, but the 3rd round kills).
    if ((opts.tear || opts.bleed || (tear?.type === 'tear' && tear.torn)) && target.bleed === undefined) target.bleed = 0;
    // Filleting, and every second hit with the Shark Blade, open a deep wound.
    if (target.wound === undefined && (opts.wound || (!magic && !opts.card && cards.includes('gourmet-shark-blade') && target.hits % 2 === 0))) target.wound = 0;
    events.push({ ...base, ...spot, damage, damageRoll, armour, strength, ...(halved ? { halved } : {}), ...(dodge ? { dodge } : {}) });
    if (tear) events.push(tear);
    // Toxin: while it lasts every hit adds to the foe's poison.
    if (toxinOn() && target.vitality > 0) {
      target.venom = (target.venom ?? 0) + 1;
      events.push({ type: 'status', uid: target.uid, card: 'diver-toxin', what: 'venom', amount: target.venom });
    }
    if (opts.shatter && target.vitality > 0 && !(target.shattered ?? []).includes(location)) {
      (target.shattered ??= []).push(location);
      events.push({ type: 'status', uid: target.uid, card: 'runemaster-hammer', what: 'shattered' });
    }
    startTrance();
    if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
    // Lightning: a foe that is hit tests Strength; a failure leaves it stunned for a round.
    else if (opts.scroll && scrollOf(opts.scroll)?.spell === 'lightning') {
      const shock = test(rng, enemy.str);
      if (!shock.success) target.stunned = true;
      events.push({ type: 'shock', uid: target.uid, result: shock, stunned: !shock.success });
    }
    return true;
  };
  const targetOf = (uid?: string) => alive().find((f) => f.uid === uid) ?? alive()[0];
  if (move.move === 'potion' && !actor.inventory.items.includes(move.item)) {
    throw new EngineError('combat.item', 'You do not carry that.');
  }
  if (move.move === 'scroll' && !combatMoves(actor, combat).some((m) => m.move === 'scroll' && m.item === move.item)) {
    throw new EngineError('scroll.notNow', 'You cannot read that scroll now.');
  }

  /** A test the hero throws for a card, written to the log. */
  const cardTest = (card: string, attribute: Attribute, extra = 0): TestResult => {
    const result = ht(attribute, focus + extra);
    events.push({ type: 'cardTest', card, attribute, result });
    return result;
  };
  const used = (card: string) => (combat.once ??= []).push(card);
  /** The level 5 to 9 cards played as the hero's move. */
  const highCard = (card: string, uid?: string) => {
    const target = targetOf(uid);
    const shots = (n: number, mod: number, what: Parameters<typeof swing>[1] = {}) => {
      // One throw for the whole volley; then each arrow goes at the next foe standing (the target first).
      const first = target ?? alive()[0];
      if (!first) return;
      const sure = ht('com', focus + mod + comMod(first.enemy) + firstTest(true) + boost, ENEMIES[first.enemy]!.kind);
      boost = 0;
      if (!sure.success) {
        events.push({ type: 'strike', by: HERO, target: first.uid, result: sure, card });
        return;
      }
      const pool = [first, ...alive().filter((f) => f !== first)].slice(0, what.dodge ? 3 : n);
      for (let i = 0; i < n; i++) {
        const standing = pool.filter((f) => f.vitality > 0);
        if (!standing.length) break;
        swing(standing[i % standing.length]!, { ...what, sure, card });
      }
    };
    switch (card) {
      case 'trapper-piercing-arrow':
        if (target) swing(target, { bonus: 4, pierce: true, card });
        break;
      case 'trapper-volley':
        used(card);
        shots(5, -10);
        break;
      case 'diver-sleep': {
        if (!target) break;
        if (swing(target, { power: -2, card }) && target.vitality > 0) {
          const save = foeSave(target, card, 'str');
          if (!save.success) {
            target.asleep = true;
            events.push({ type: 'status', uid: target.uid, card, what: 'asleep' });
          }
        }
        break;
      }
      case 'diver-water-bolt':
        if (!combat.wet) combat.waterBolts = (combat.waterBolts ?? 0) + 1;
        if (target) swing(target, { mod: 10, power: combat.wet ? 2 : 0, magic: true, card });
        break;
      case 'gourmet-spice':
        // A handful of spice in the eyes: no wound, but −20 Combat and Dex for 3 rounds.
        if (target && swing(target, { fixed: 0, card })) {
          target.spiced = combat.turn + 2;
          events.push({ type: 'status', uid: target.uid, card, what: 'spiced' });
        }
        break;
      case 'gourmet-venom-bone':
        if (target && swing(target, { power: -1, card }) && target.vitality > 0 && target.rising === undefined) {
          target.rising = 0;
          events.push({ type: 'status', uid: target.uid, card, what: 'rising' });
        }
        break;
      case 'warrior-wide-swing':
        for (const foe of [target, ...alive().filter((f) => f !== target)].filter((f): f is Foe => !!f).slice(0, 2)) swing(foe, { card });
        break;
      case 'warrior-behead':
        used(card);
        if (target && target.vitality <= BEHEAD_MAX) swing(target, { mod: -20, fixed: target.vitality, card });
        break;
      case 'mystic-void-bolt':
        if (!target) break;
        if (cardTest(card, 'int', magicBonus(world, actor)).success) swing(target, { power: 2, magic: true, card });
        break;
      case 'guardian-claw':
        if (target) swing(target, { mod: -10, power: 0, bonus: 4, bleed: true, card });
        break;
      case 'guardian-spear':
        if (!target) break;
        swing(target, { mod: -20, strength: SPEAR_STRENGTH, card });
        combat.unarmed = true;
        events.push({ type: 'status', uid: HERO, card, what: 'unarmed' });
        break;
      case 'wraith-pierce':
        used(card);
        if (target && swing(target, { power: 1, card }) && target.vitality > 0) {
          target.gash = true;
          events.push({ type: 'status', uid: target.uid, card, what: 'gash' });
        }
        break;
      case 'wraith-triple-shot':
        shots(3, -20);
        break;
      case 'wraith-headshot':
        used(card);
        if (target) swing(target, { mod: -20, fixed: HEADSHOT, card });
        break;
      case 'runemaster-hammer':
        if (target) swing(target, { mod: -10, power: 1, bonus: 4, shatter: true, card });
        break;
      case 'druid-forest-lord': {
        if (!target || !canRule(actor, target)) throw new EngineError('combat.target', 'That beast cannot be tamed.');
        if (!cardTest(card, 'wil').success) break;
        const n = (actor.counters.tamed ?? 0) + 1;
        actor.counters.tamed = n;
        (actor.companions ??= []).push({ uid: `pet-${target.enemy}-${n}`, enemy: target.enemy, vitality: target.vitality, maxVitality: target.maxVitality, bond: BOND_NEEDED, tame: true });
        target.tamed = true;
        target.vitality = 0;
        events.push({ type: 'tame', uid: target.uid, result: { roll: 0, target: 0, success: true, margin: 0 } });
        break;
      }
      case 'elder-mistral':
        used(card);
        for (const foe of alive().slice(0, 3)) {
          if (foeSave(foe, card, 'dex').success) continue;
          foe.stunned = true;
          foe.vitality -= MISTRAL_DAMAGE;
          events.push({ type: 'status', uid: foe.uid, card, what: 'gale', amount: MISTRAL_DAMAGE });
          if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
        }
        break;
      case 'explorer-flashbang':
        used(card);
        for (const foe of alive()) {
          if (foeSave(foe, card, 'int').success) continue;
          foe.dazed = combat.turn;
          events.push({ type: 'status', uid: foe.uid, card, what: 'dazed' });
        }
        break;
      case 'explorer-shrapnel':
        actor.counters[`spent:${card}`] = (actor.counters[`spent:${card}`] ?? 0) + 1;
        shots(3, -10, { dodge: true, dodgeMod: -10, strength: SHRAPNEL_STRENGTH });
        break;
      case 'cavedelver-dynamite': {
        actor.counters[`spent:${card}`] = (actor.counters[`spent:${card}`] ?? 0) + 1;
        const first = target ?? alive()[0];
        if (!first) break;
        const sure = ht('com', focus + comMod(first.enemy) + firstTest(true), ENEMIES[first.enemy]!.kind);
        if (!sure.success) {
          events.push({ type: 'strike', by: HERO, target: first.uid, result: sure, card });
          break;
        }
        for (const foe of alive().slice(0, 3)) swing(foe, { sure, dodge: true, fixed: Math.ceil(foe.vitality / 2), card });
        break;
      }
      case 'cavedelver-flamethrower':
        actor.counters[`used:${card}`] = 1;
        (combat.flames ??= []).push(combat.turn);
        for (const foe of alive().slice(0, 3)) {
          if (!swing(foe, { mod: -10, power: 2, card }) || foe.vitality <= 0 || foe.inferno !== undefined) continue;
          if (foeSave(foe, card, 'int').success) continue;
          foe.inferno = combat.turn;
          events.push({ type: 'status', uid: foe.uid, card, what: 'burning' });
        }
        break;
      case 'warrior-intimidate': {
        used(card);
        if (!cardTest(card, 'cha').success) break;
        for (const foe of alive()) {
          if (foeSave(foe, card, 'wil').success) continue;
          foe.vitality = 0;
          foe.gone = 'fled';
          events.push({ type: 'status', uid: foe.uid, card, what: 'fled' });
        }
        break;
      }
      case 'mystic-illusion': {
        used(card);
        if (!cardTest(card, 'int', magicBonus(world, actor)).success) break;
        const seen = alive().map((foe) => foeSave(foe, card, 'int', 10).success);
        if (seen.every((s) => !s)) {
          hidden = true;
          events.push({ type: 'status', uid: HERO, card, what: 'stays' });
        }
        break;
      }
      case 'mystic-chasm':
        used(card);
        if (!cardTest(card, 'int', magicBonus(world, actor)).success) break;
        for (const foe of alive().slice(0, 3)) {
          if (foeSave(foe, card, 'dex').success) continue;
          foe.vitality = 0;
          foe.gone = 'void';
          events.push({ type: 'status', uid: foe.uid, card, what: 'void' });
        }
        break;
      case 'runemaster-rend':
        actor.counters[`used:${card}`] = 1;
        if (!cardTest(card, 'str', -20).success) break;
        for (const foe of alive()) {
          if (ENEMIES[foe.enemy]!.traits.includes('flying') || foeSave(foe, card, 'dex').success) continue;
          foe.vitality = 0;
          foe.gone = 'fell';
          events.push({ type: 'status', uid: foe.uid, card, what: 'fell' });
        }
        break;
      case 'trapper-dog':
        actor.counters[`used:${card}`] = 1;
        callBeast(actor, 'steppeDog');
        events.push({ type: 'status', uid: HERO, card, what: 'summoned', amount: 1 });
        break;
      case 'diver-toxin':
        used(card);
        actor.staminaLeft -= 1;
        combat.toxin = combat.turn + 2;
        events.push({ type: 'status', uid: HERO, card, what: 'buff' });
        break;
      case 'mystic-healing': {
        actor.counters[`used:${card}`] = 1;
        if (!cardTest(card, 'int', magicBonus(world, actor)).success) break;
        events.push({ type: 'status', uid: HERO, card, what: 'healed', amount: voidHeal(actor) });
        break;
      }
      case 'mystic-double':
        used(card);
        if (!cardTest(card, 'int', magicBonus(world, actor)).success) break;
        combat.double = combat.turn + 2;
        events.push({ type: 'status', uid: HERO, card, what: 'double' });
        break;
      case 'guardian-shield-wall':
        used(card);
        combat.wall = SHIELD_WALL;
        events.push({ type: 'status', uid: HERO, card, what: 'wall', amount: SHIELD_WALL });
        break;
      case 'druid-raven':
        // Raven Form: the Druid flies off; nothing can follow.
        actor.counters[`used:${card}`] = 1;
        fled = true;
        events.push({ type: 'flee', success: true, hero: { roll: 1, target: 100, success: true, margin: 99 }, card });
        break;
      case 'wraith-untouchable':
        events.push({ type: 'status', uid: HERO, card, what: 'buff' });
        break;
      default:
        if (HIGH_BUFFS.includes(card)) events.push({ type: 'card', card, amount: highBuff(world.round, actor, card) });
    }
  };

  const heroTurn = () => {
    // Everyone may already be down (a trap sprung at the start of the round, a held beast's blow): nothing left to do.
    if (!alive().length) return;
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
        // A trap sprung at the start of the round may already have felled every foe: nobody is left to chase.
        if (!alive().length) break;
        const fastest = alive().reduce((a, b) => (ENEMIES[b.enemy]!.dex > ENEMIES[a.enemy]!.dex ? b : a));
        const harried = alive().some((f) => ENEMIES[f.enemy]!.traits.includes('harrying')) ? -10 : 0;
        const hero = ht('dex', focus + harried + vigilance + firstTest(false) + (combat.journal?.flee ?? 0));
        // Sleep Dart: with every foe asleep, nobody gives chase.
        if (alive().every((f) => f.asleep)) {
          fled = true;
          events.push({ type: 'flee', success: true, hero: { ...hero, success: true }, card: 'diver-sleep' });
          break;
        }
        const foe = test(rng, ENEMIES[fastest.enemy]!.dex, foeMod(fastest, 'dex'));
        fled = hero.success && (!foe.success || hero.roll <= foe.roll);
        events.push({ type: 'flee', success: fled, hero, foe });
        break;
      }
      case 'attack': {
        // Spear Throw: the spear is still in the foe; this round goes on pulling it out.
        if (combat.unarmed) {
          combat.unarmed = false;
          events.push({ type: 'status', uid: HERO, card: 'guardian-spear', what: 'pickedUp' });
          break;
        }
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
          case 'trapper-poison-arrow': {
            // Poisoned Arrow: a bow or crossbow shot that poisons on a hit; 2 a fight (Jacob, 2026-11-26).
            combat.arrows = (combat.arrows ?? 0) + 1;
            const target = targetOf(move.target);
            if (target) swing(target, { poison: true, card: move.card });
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
            const result = ht('cha', focus);
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
            const result = ht('int', focus + magicBonus(world, actor));
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
          case 'diver-fillet': {
            // Filleting: one hard blow (−10) that opens a deep wound.
            const target = targetOf(move.target);
            if (target) swing(target, { mod: -10, wound: true, card: move.card });
            break;
          }
          case 'druid-fangs': {
            // Fangs: a very hard bite (−20) of power S−1; it makes the foe bleed and may tear it open.
            const target = targetOf(move.target);
            if (target) swing(target, { mod: -20, power: -1, tear: true, card: move.card });
            break;
          }
          case 'elder-beast-master': {
            const target = targetOf(move.target);
            if (!target || !canMaster(actor, target)) throw new EngineError('combat.target', 'That beast cannot be mastered.');
            const step = target.controlled ?? 0;
            const result = ht('cha', focus + MASTER_STEPS[step]!);
            if (!result.success) {
              delete target.controlled;
              delete target.held;
              events.push({ type: 'master', uid: target.uid, result, step: step + 1 });
              break;
            }
            target.controlled = step + 1;
            const companion = target.controlled >= MASTER_STEPS.length;
            events.push({ type: 'master', uid: target.uid, result, step: step + 1, ...(companion ? { companion } : {}) });
            if (companion) {
              const n = (actor.counters.tamed ?? 0) + 1;
              actor.counters.tamed = n;
              (actor.companions ??= []).push({
                uid: `pet-${target.enemy}-${n}`, enemy: target.enemy, vitality: target.vitality, maxVitality: target.maxVitality, bond: BOND_NEEDED, tame: true,
              });
              target.tamed = true;
              target.vitality = 0;
            } else target.held = true;
            break;
          }
          case 'diver-camouflage': {
            // Camouflage: the Diver hides; any foe that passes an Intelligence test spots them.
            const hero = ht('dex', focus);
            const foes = alive().map((f) => ({ uid: f.uid, result: test(rng, ENEMIES[f.enemy]!.int) }));
            hidden = hero.success && foes.every((f) => !f.result.success);
            events.push({ type: 'hide', hero, foes, hidden });
            break;
          }
          case 'explorer-smoke': {
            // Smoke Bomb: the flight is one plain Dexterity test, no foe rolls against it.
            const hero = ht('dex', focus + vigilance);
            fled = hero.success;
            events.push({ type: 'flee', success: fled, hero, card: move.card });
            break;
          }
          case 'warrior-strategist': {
            // Strategist: a round spent studying one foe; then +10 Combat against every foe of its kind.
            combat.studied = true;
            const studied = targetOf(move.target);
            if (studied) combat.studiedKind = studied.enemy;
            events.push({ type: 'card', card: move.card, amount: 10 });
            break;
          }
          case 'mystic-vines': {
            const target = targetOf(move.target);
            if (!target) break;
            const result = ht('int', focus);
            if (result.success) target.vined = true;
            events.push({ type: 'vines', uid: target.uid, by: 'hero', result, bound: result.success });
            break;
          }
          case 'wraith-mist':
            actor.counters['used:wraith-mist'] = 1;
            combat.mist = combat.turn;
            events.push({ type: 'card', card: move.card });
            break;
          default:
            highCard(move.card, move.target);
            break;
          case 'cavedelver-blind': {
            // Blinding Light: every foe that fails a Dexterity test is blind until it has struck once more. Once a fight.
            combat.blindUsed = true;
            const foes = alive().map((f) => ({ uid: f.uid, result: test(rng, ENEMIES[f.enemy]!.dex, foeMod(f, 'dex')) }));
            for (const { uid, result } of foes) {
              if (result.success) continue;
              const foe = combat.foes.find((f) => f.uid === uid)!;
              foe.blindUntil = acted.has(uid) ? combat.turn + 1 : combat.turn;
            }
            events.push({ type: 'blind', foes });
            break;
          }
        }
        break;
    }
  };

  const pets = () => (actor.companions ?? []).filter((p) => p.vitality > 0);

  const foeTurn = (foe: Foe) => {
    if (foe.vitality <= 0 || actor.character.vitality <= 0 || enthralled || hidden) return;
    acted.add(foe.uid);
    if (foe.stunned) {
      foe.stunned = false;
      events.push({ type: 'stunned', who: foe.uid });
      return;
    }
    // Sleep Dart: a sleeping foe does nothing until a blow wakes it.
    if (foe.asleep) {
      events.push({ type: 'status', uid: foe.uid, card: 'diver-sleep', what: 'sleeping' });
      return;
    }
    const enemy: Enemy = ENEMIES[foe.enemy]!;
    // Master of Beasts: a held beast strikes another foe instead of the hero.
    if (foe.held) {
      foe.held = false;
      events.push({ type: 'held', uid: foe.uid });
      const other = alive().find((f) => f.uid !== foe.uid);
      if (other) beastStrike(foe.uid, enemy, other);
      return;
    }
    // A deep wound: the foe spends its move on a Dexterity test to staunch it.
    if (foe.wound !== undefined) {
      const result = test(rng, enemy.dex, foeMod(foe, 'dex'));
      if (result.success) delete foe.wound;
      events.push({ type: 'wound', uid: foe.uid, result, staunched: result.success });
      return;
    }
    // Black Vines: a Strength test to tear free; while bound the foe cannot fight hand to hand.
    if (foe.vined) {
      const result = test(rng, enemy.str);
      if (result.success) foe.vined = false;
      events.push({ type: 'vines', uid: foe.uid, by: 'foe', result, bound: !result.success });
      if (!result.success && !enemy.weapon.ranged) return;
    }
    if (foe.disarmed) {
      // Disarm: the foe spends its turn on an opposed Dexterity test to get its weapon back. Both must pass;
      // then the lower roll wins, and a tie goes to the Explorer.
      const own = test(rng, enemy.dex, foeMod(foe, 'dex'));
      const hero = ht('dex', focus);
      const success = own.success && (!hero.success || own.roll < hero.roll);
      if (success) foe.disarmed = false;
      events.push({ type: 'rearm', uid: foe.uid, foe: own, hero, success });
      return;
    }
    // Double: the foe may go for the Mystic's double instead; a blow that lands makes it vanish.
    if (doubleOn() && rng.int(2) === 0) {
      foe.attacks++;
      const result = test(rng, enemy.com, foeMod(foe, 'com'));
      if (result.success) delete combat.double;
      events.push({ type: 'decoy', uid: foe.uid, result, gone: result.success });
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
    const result = test(rng, enemy.com, (fleeing ? 10 : 0) + foeMod(foe, 'com'));
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
    // Shield Wall: the shields stop the next blows that land.
    if (combat.wall) {
      combat.wall--;
      events.push({ type: 'strike', by: foe.uid, target: HERO, result, blocked: true, card: 'guardian-shield-wall' });
      return;
    }
    // Untouchable: the Wraith slips each blow of the round on a plain Dexterity test.
    if (dodging) {
      const dodge = ht('dex', focus + vigilance);
      events.push({ type: 'cardTest', card: 'wraith-untouchable', attribute: 'dex', result: dodge });
      if (dodge.success) {
        events.push({ type: 'strike', by: foe.uid, target: HERO, result, blocked: true, card: 'wraith-untouchable' });
        return;
      }
    }
    if (parrying) {
      const shield = actor.character.equipment.shield ? 15 : 0;
      const parry = ht('com', focus + shield + comMod(foe.enemy), enemy.kind);
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
    const strength = strengthStep(enemy.str) + enemy.weapon.power + (sting ? 1 : 0);
    let damage = Math.max(0, strength + damageRoll - armour[location]);
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
    events.push({ type: 'strike', by: foe.uid, target: HERO, result, ...spot, damage, damageRoll, armour: armour[location], strength, ...(barrier ? { barrier, halved: true } : {}) });
    // Toxin: a foe that strikes the Diver's skin hand to hand takes the poison too.
    if (toxinOn() && !enemy.weapon.ranged) {
      foe.venom = (foe.venom ?? 0) + 1;
      events.push({ type: 'status', uid: foe.uid, card: 'diver-toxin', what: 'venom', amount: foe.venom });
    }
    startTrance();
    if (enemy.traits.includes('poison') || sting) {
      addCondition(actor, 'poison', { pl: 'Zatrucie', en: 'Poisoned' }, 'str', 1);
      events.push({ type: 'poisoned', who: HERO, condition: 'poison' });
    }
    if (enemy.traits.includes('rot')) {
      addCondition(actor, 'rot', { pl: 'Zgnilizna', en: 'Rot' }, 'dex', 2);
      events.push({ type: 'poisoned', who: HERO, condition: 'rot' });
    }
    if (enemy.traits.includes('stun') && !ht('wil', focus).success) {
      combat.heroStunned = true;
    }
    // Drain: a blow that lands takes 1 Stamina; the hero is lost to the spell only at their full Stamina.
    if (enemy.traits.includes('drain')) {
      actor.staminaLeft = Math.max(0, actor.staminaLeft - 1);
      const of = Math.max(1, actor.character.stamina ?? 3);
      combat.drained = (combat.drained ?? 0) + 1;
      const left = Math.max(0, of - combat.drained);
      events.push({ type: 'drain', uid: foe.uid, left, of });
      if (left === 0) enthralled = true;
    }
  };

  /** A foe's blow at one of the hero's beasts: no armour, no parry. */
  const strikePet = (foe: Foe, enemy: Enemy, pet: Companion) => {
    foe.attacks++;
    const result = test(rng, enemy.com, foeMod(foe, 'com'));
    if (!result.success) {
      events.push({ type: 'strike', by: foe.uid, target: pet.uid, result });
      return;
    }
    const strength = strengthStep(enemy.str) + enemy.weapon.power;
    const damageRoll = damageDie(rng, enemy.traits.includes('penetrating'));
    const damage = Math.max(0, strength + damageRoll);
    pet.vitality -= damage;
    events.push({ type: 'strike', by: foe.uid, target: pet.uid, result, damage, damageRoll, strength });
    if (pet.vitality <= 0) events.push({ type: 'companionDown', uid: pet.uid });
  };

  /** A beast on the hero's side bites a foe with its own stats (a companion's `bonus` from Teacher adds to them). */
  const beastStrike = (by: string, beast: Enemy, target: Foe, bonus = 0) => {
    // Banner, Totem and Force of Nature reach the hero's companions too; so does the Rune of Honour's second throw.
    const ally = by.startsWith('pet-') ? (attribute: string) => allyBonus(actor, attribute) : () => 0;
    let result = test(rng, beast.com + bonus + ally('com'));
    if (!result.success && honour && by.startsWith('pet-')) result = test(rng, beast.com + bonus + ally('com'));
    if (!result.success) {
      events.push({ type: 'strike', by, target: target.uid, result });
      return;
    }
    const spot = hitLocation(rng, result.margin, armourOf(target));
    const damageRoll = damageDie(rng, false);
    const armour = armourOf(target)[spot.location] ?? 0;
    const strength = strengthStep(beast.str + bonus + ally('str')) + beast.weapon.power + ally('damage');
    const damage = Math.max(0, strength + damageRoll - armour);
    target.vitality -= damage;
    events.push({ type: 'strike', by, target: target.uid, result, ...spot, damage, damageRoll, armour, strength });
    if (target.vitality <= 0) events.push({ type: 'foeDown', uid: target.uid, enemy: target.enemy });
  };

  /** Each companion bites the hero's target, or the first foe standing. */
  const petsTurn = () => {
    if (hidden) return;
    for (const pet of pets()) {
      const target = targetOf(move.move === 'attack' || move.move === 'card' ? move.target : undefined);
      if (!target) return;
      beastStrike(pet.uid, ENEMIES[pet.enemy]!, target, pet.bonus ?? 0);
    }
    // Double: the Mystic's double strikes beside them with the same skill.
    if (doubleOn() && !fled) {
      const target = targetOf(move.move === 'attack' || move.move === 'card' ? move.target : undefined);
      if (target) swing(target, { card: 'mystic-double' });
    }
  };

  if (combat.trap) {
    combat.trap = false;
    events.push(...trapFoes(alive(), rng));
  }

  // Rune of Safety: +20 initiative; Vigilance: +10 in a sudden moment such as this.
  const heroInitiative = attrs.dex + itemBonus(actor, 'initiative') + (hasRune('safety') ? SAFETY_INITIATIVE : 0) + vigilance + (cards.includes('trapper-vigilance') ? TRAPPER_VIGILANCE : 0);
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

  // A deep wound bleeds 1 a round; the third round of bleeding kills.
  for (const foe of alive()) {
    if (foe.wound === undefined) continue;
    foe.vitality -= 1;
    foe.wound++;
    const dead = foe.wound >= WOUND_DEATH;
    if (dead) foe.vitality = 0;
    events.push({ type: 'wound', uid: foe.uid, damage: 1, dead });
    if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
  }
  // Master of Beasts: the hold must be renewed every round, or the beast breaks free.
  for (const foe of alive()) {
    if (foe.controlled && !(move.move === 'card' && move.card === 'elder-beast-master' && targetOf(move.target)?.uid === foe.uid)) {
      delete foe.controlled;
      delete foe.held;
    }
  }

  // Fangs: a bleeding foe loses 1 a round until it passes a Strength test; the 3rd round of bleeding kills.
  for (const foe of alive()) {
    if (foe.bleed === undefined) continue;
    if (test(rng, ENEMIES[foe.enemy]!.str).success) {
      delete foe.bleed;
      continue;
    }
    foe.vitality -= 1;
    foe.bleed++;
    const dead = foe.bleed >= WOUND_DEATH;
    if (dead) foe.vitality = 0;
    events.push({ type: 'bleed', uid: foe.uid, damage: 1, ...(dead ? { dead } : {}) });
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
  // Toxin, Venom Bone and the Wraith's arrow wound: Vitality lost every round with no test to stop it.
  for (const foe of alive()) {
    let loss = 0;
    if (foe.venom) loss += foe.venom;
    if (foe.rising !== undefined) loss += ++foe.rising;
    if (foe.gash) loss += 1;
    if (!loss) continue;
    foe.vitality -= loss;
    events.push({ type: 'bleed', uid: foe.uid, damage: loss });
    if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
  }
  // Flamethrower: the round after it caught fire the foe loses half its Vitality and tests Int again; a second failure kills.
  for (const foe of alive()) {
    if (foe.inferno === undefined || foe.inferno >= combat.turn) continue;
    const loss = Math.ceil(foe.vitality / 2);
    foe.vitality -= loss;
    events.push({ type: 'bleed', uid: foe.uid, damage: loss });
    const save = test(rng, ENEMIES[foe.enemy]!.int, dazeMod(foe));
    events.push({ type: 'save', uid: foe.uid, card: 'cavedelver-flamethrower', attribute: 'int', result: save });
    delete foe.inferno;
    if (!save.success) foe.vitality = 0;
    events.push({ type: 'status', uid: foe.uid, card: 'cavedelver-flamethrower', what: save.success ? 'burnedOut' : 'burnedDown' });
    if (foe.vitality <= 0) events.push({ type: 'foeDown', uid: foe.uid, enemy: foe.enemy });
  }
  combat.turn++;

  if (actor.character.vitality <= 0) return { events, result: 'lost' };
  if (enthralled) return { events, result: 'enthralled' };
  if (alive().length === 0) return { events, result: 'won' };
  if (hidden) return { events, result: 'hidden' };
  if (fled) return { events, result: 'fled' };
  return { events, result: 'ongoing' };
}

/** XP for a won fight: the sum of the foes' bestiary XP, scaled by difficulty. */
export function combatXp(world: WorldView, combat: CombatState): number {
  // Foes run off by Intimidation or swallowed by the Chasm give half their XP.
  return combat.foes.reduce((sum, f) => sum + (f.gone === 'fled' || f.gone === 'void' ? Math.floor(ENEMIES[f.enemy]!.xp / 2) : ENEMIES[f.enemy]!.xp), 0) * DIFFICULTIES[world.difficulty].xp;
}

/** Drinks a potion: heals, or adds its timed effect. */
export function drinkPotion(world: WorldView, actor: ActorState, id: string) {
  const item = ITEMS[id];
  if (item?.kind !== 'potion') throw new EngineError('item.notPotion', 'That is not a potion.');
  const c = actor.character;
  if (item.heal) c.vitality = Math.min(c.maxVitality, c.vitality + item.heal);
  for (const effect of [...(item.effect ? [item.effect] : []), ...(item.effects ?? [])]) {
    actor.effects.push({ id, attribute: effect.target, amount: effect.amount, untilRound: world.round + effect.rounds - 1 });
    if (effect.target === 'stamina') actor.staminaLeft += effect.amount;
    if (effect.target === 'speed') actor.speedLeft += effect.amount;
  }
  // Clears poison too: the rules end poison "until healed".
  if (item.heal) actor.conditions = actor.conditions.filter((cnd) => cnd.id !== 'poison' && cnd.id !== 'rot' && cnd.id !== 'foulAir');
  // The Elder's Potion of Life ends every ill and every curse on the hero.
  if (item.cureAll) {
    actor.conditions = [];
    actor.effects = actor.effects.filter((e) => e.amount >= 0);
  }
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
