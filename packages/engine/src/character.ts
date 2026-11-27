import {
  ATTRIBUTES, DICE_BOXES, DICE_ENGRAVINGS, DICE_FINISHES, DICE_STYLE_IDS, ITEMS, LOOK_COLOURS, LOOK_OPTIONS, MISSIONS, GAME_MISSIONS, PROFESSIONS, RACES, STARTING_KIT,
  type Attributes, type DiceLook, type HeroLook, type ProfessionId, type RaceId, type SkillId,
} from '@hp/content';
import { EngineError } from './errors';
import type { Rng } from './rng';
import type { Equipment, Inventory } from './terrain';

export const BONUS_POINTS = 20;
export const MISSIONS_DRAWN = 4;
export const MISSIONS_KEPT = 2;

export interface CharacterInput {
  name: string;
  race: RaceId;
  profession: ProfessionId;
  /** Up to 20 extra points spread over the base attributes. */
  bonus: Partial<Attributes>;
  /** The 2 missions kept out of the 4 drawn. */
  missions: string[];
  /** How the hero looks and the dice they roll; only for show. */
  look?: HeroLook;
  dice?: DiceLook;
  /** The kept hero this character was made from, for career goals. */
  heroId?: string;
  /** What the hero earned in earlier games: they start this one with it (Jacob, 2026-11-26). */
  growth?: HeroGrowth;
  /** The hero journal from earlier games (Jacob, 2026-11-27). Read when the game starts, not kept in the character. */
  journal?: import('./journal').HeroJournal;
}

/**
 * A hero's development, carried from game to game (Jacob, 2026-11-26): level, XP, attributes, Vitality, Stamina,
 * skills and skill cards, and also the gold, gear and belongings gathered. Only food starts fresh each game.
 */
export interface HeroGrowth {
  level: number;
  xp: number;
  attributes: Attributes;
  maxVitality: number;
  stamina: number;
  unspentPoints: number;
  skills: Partial<Record<SkillId, number>>;
  /** Every skill card the hero owns; the first ones are the hand they last played with. */
  cards: string[];
  /** Gold, worn gear and the bag; absent in records from before they were carried. */
  gold?: number;
  equipment?: Equipment;
  inventory?: Inventory;
}

export interface Character {
  name: string;
  race: RaceId;
  profession: ProfessionId;
  attributes: Attributes;
  speed: number;
  stamina: number;
  vitality: number;
  maxVitality: number;
  level: number;
  xp: number;
  gold: number;
  food: number;
  cards: string[];
  /**
   * Cards a new level brought that do not fit in the hand of 5: the player chooses which 5 of these, the
   * held cards and the benched ones to play with (Jacob, 2026-11-26).
   */
  newCards?: string[];
  /** Cards the hero owns but left out of the hand of 5; they can be picked again at the next choice. */
  benched?: string[];
  /** A hero who owns more than 5 cards picks the 5 to play with before the game starts (Jacob, 2026-11-26). */
  chooseCards?: boolean;
  missions: string[];
  equipment: Equipment;
  skills: Partial<Record<SkillId, number>>;
  /** Attribute points from levelling up, not spent yet. */
  unspentPoints: number;
  look?: HeroLook;
  dice?: DiceLook;
  /** The kept hero this character was made from, for career goals. */
  heroId?: string;
}

/** Draws the 4 mission cards a new character chooses from. */
export function drawMissionChoices(rng: Rng): string[] {
  return rng.shuffle(GAME_MISSIONS.map((m) => m.id)).slice(0, MISSIONS_DRAWN);
}

export function validateCharacter(input: CharacterInput, offered?: string[]): void {
  if (input.growth) validateGrowth(input);
  if (!input.name.trim()) throw new EngineError('character.name', 'A character needs a name.');
  const race = RACES[input.race];
  if (!race) throw new EngineError('character.race', `Unknown race ${input.race}.`);
  const profession = PROFESSIONS[input.profession];
  if (!profession || profession.race !== input.race) {
    throw new EngineError('character.profession', `${input.profession} is not a profession of ${input.race}.`);
  }
  let spent = 0;
  for (const [key, value] of Object.entries(input.bonus)) {
    if (!(ATTRIBUTES as readonly string[]).includes(key)) throw new EngineError('character.bonus', `Unknown attribute ${key}.`);
    if (!Number.isInteger(value) || value! < 0) throw new EngineError('character.bonus', 'Bonus points must be whole and not negative.');
    spent += value!;
  }
  if (input.look) {
    for (const part of ['head', 'torso', 'legs'] as const) {
      const v = input.look[part];
      if (!Number.isInteger(v) || v < 0 || v >= LOOK_OPTIONS) throw new EngineError('character.look', 'Unknown look.');
    }
    for (const part of LOOK_COLOURS) {
      const v = input.look[part];
      if (v !== undefined && !(typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))) throw new EngineError('character.look', 'Unknown colour.');
    }
  }
  if (input.dice) {
    for (const die of ['d6', 'd10', 'd100'] as const) {
      if (!DICE_STYLE_IDS.includes(input.dice[die])) throw new EngineError('character.dice', 'Unknown dice style.');
    }
    const { finish, engrave, box } = input.dice;
    if (finish !== undefined && !DICE_FINISHES.some((f) => f.id === finish)) throw new EngineError('character.dice', 'Unknown dice finish.');
    if (engrave !== undefined && !DICE_ENGRAVINGS.some((f) => f.id === engrave)) throw new EngineError('character.dice', 'Unknown engraving.');
    if (box !== undefined && !DICE_BOXES.some((f) => f.id === box)) throw new EngineError('character.dice', 'Unknown dice box.');
  }
  if (spent > BONUS_POINTS) throw new EngineError('character.bonus', `Only ${BONUS_POINTS} bonus points can be spent.`);
  if (new Set(input.missions).size !== MISSIONS_KEPT) throw new EngineError('character.missions', `Keep exactly ${MISSIONS_KEPT} missions.`);
  for (const m of input.missions) {
    if (!GAME_MISSIONS.some((x) => x.id === m)) throw new EngineError('character.missions', `Unknown mission ${m}.`);
    if (offered && !offered.includes(m)) throw new EngineError('character.missions', `Mission ${m} was not drawn.`);
  }
}

/** Dice with only the colours, finish, engraving and box a hero may have. */
export function cleanDice(dice: DiceLook): DiceLook {
  const out: DiceLook = { d6: dice.d6, d10: dice.d10, d100: dice.d100 };
  if (dice.finish) out.finish = dice.finish;
  if (dice.engrave) out.engrave = dice.engrave;
  if (dice.box) out.box = dice.box;
  return out;
}

/** A look with only the parts and colours a hero may have. */
export function cleanLook(look: HeroLook): HeroLook {
  const out: HeroLook = { head: look.head, torso: look.torso, legs: look.legs };
  for (const part of LOOK_COLOURS) if (look[part]) out[part] = look[part];
  return out;
}

/** Builds a level 1 character with the starting kit from the rules. */
export function createCharacter(input: CharacterInput, startFood: number, offered?: string[]): Character {
  validateCharacter(input, offered);
  const race = RACES[input.race];
  const attributes = { ...race.attributes };
  for (const a of ATTRIBUTES) attributes[a] += input.bonus[a] ?? 0;
  return {
    name: input.name.trim(),
    race: input.race,
    profession: input.profession,
    attributes,
    speed: race.speed,
    stamina: race.stamina,
    vitality: race.vitality,
    maxVitality: race.vitality,
    level: 1,
    xp: 0,
    gold: 5,
    food: startFood,
    cards: PROFESSIONS[input.profession].cards.filter((c) => c.level === 1).map((c) => c.id),
    missions: [...input.missions],
    equipment: { weapon: STARTING_KIT.weapon, armour: [...STARTING_KIT.armour], shield: false, rune: null },
    skills: {},
    unspentPoints: 0,
    ...(input.look ? { look: cleanLook(input.look) } : {}),
    ...(input.dice ? { dice: cleanDice(input.dice) } : {}),
    ...(typeof input.heroId === 'string' ? { heroId: input.heroId.slice(0, 64) } : {}),
    ...(input.growth ? grown(input) : {}),
  };
}

/** XP needed for each level (index = level). Level 9 is the maximum. */
export const LEVEL_XP = [0, 0, 10, 30, 60, 100, 150, 200, 250, 300];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l < LEVEL_XP.length; l++) if (xp >= LEVEL_XP[l]!) level = l;
  return level;
}

/** What each new level gives, from the "Doświadczenie" rules. */
export const LEVEL_UP = { points: 20, vitality: 2, staminaAt: [4, 8] };

/** A hero holds at most this many skill cards at once (rules, profession sheets). */
export const MAX_CARDS = 5;

/** Applies the rewards of reaching `level` to a character. Returns the new skill cards it brought. */
export function levelUp(c: Character, level: number): string[] {
  c.level = level;
  c.unspentPoints += LEVEL_UP.points;
  c.maxVitality += LEVEL_UP.vitality;
  c.vitality += LEVEL_UP.vitality;
  if (LEVEL_UP.staminaAt.includes(level)) c.stamina += 1;
  // Levels 3, 5, 7 and 9 open new skill cards; while they fit in the hand of 5 they go straight in.
  const fresh = PROFESSIONS[c.profession].cards.filter((card) => card.level === level).map((card) => card.id);
  if (!fresh.length) return [];
  if (!c.newCards?.length && c.cards.length + fresh.length <= MAX_CARDS) c.cards.push(...fresh);
  else c.newCards = [...(c.newCards ?? []), ...fresh];
  return fresh;
}

/** The cards a hero chooses from when a new level brought more than the hand holds. */
export const cardPool = (c: Pick<Character, 'cards' | 'newCards' | 'benched'>) => [...c.cards, ...(c.newCards ?? []), ...(c.benched ?? [])];

/** Picks the 5 cards to play with out of every card the hero owns; the others wait on the bench (Jacob, 2026-11-26). */
export function keepCards(c: Character, keep: string[]): void {
  const pool = cardPool(c);
  const want = Math.min(MAX_CARDS, pool.length);
  if (!c.newCards?.length && !c.chooseCards) throw new EngineError('cards.noChoice', 'There are no new cards to choose from.');
  if (new Set(keep).size !== keep.length || keep.length !== want || !keep.every((id) => pool.includes(id))) {
    throw new EngineError('cards.keep', `Choose ${want} of your cards to keep.`);
  }
  c.cards = [...keep];
  const benched = pool.filter((id) => !keep.includes(id));
  if (benched.length) c.benched = benched;
  else delete c.benched;
  delete c.newCards;
  delete c.chooseCards;
}

/** Spends level-up points on base attributes. */
export function spendPoints(c: Character, bonus: Partial<Attributes>): void {
  let total = 0;
  for (const [key, value] of Object.entries(bonus)) {
    if (!(ATTRIBUTES as readonly string[]).includes(key)) throw new EngineError('character.bonus', `Unknown attribute ${key}.`);
    if (!Number.isInteger(value) || value! < 0) throw new EngineError('character.bonus', 'Points must be whole and not negative.');
    total += value!;
  }
  if (total === 0 || total > c.unspentPoints) throw new EngineError('character.points', 'Not that many points to spend.');
  for (const a of ATTRIBUTES) c.attributes[a] += bonus[a] ?? 0;
  c.unspentPoints -= total;
}

/** A hero's development as it stands in a game, to carry into the next one. */
export function growthOf(c: Character, inventory?: Inventory): HeroGrowth {
  return {
    level: c.level, xp: c.xp, attributes: { ...c.attributes }, maxVitality: c.maxVitality, stamina: c.stamina,
    unspentPoints: c.unspentPoints, skills: { ...c.skills }, cards: cardPool(c),
    gold: c.gold, equipment: structuredClone(c.equipment),
    ...(inventory ? { inventory: structuredClone(inventory) } : {}),
  };
}

/** Checks a carried development against the rules, so a bad record cannot make a hero stronger than play could. */
export function validateGrowth(input: CharacterInput): void {
  const g = input.growth!;
  const bad = (why: string) => new EngineError('character.growth', why);
  if (!Number.isInteger(g.level) || g.level < 1 || g.level > LEVEL_XP.length - 1) throw bad('Unknown level.');
  if (!(g.xp >= LEVEL_XP[g.level]!) || levelForXp(g.xp) !== g.level) throw bad('The XP does not match the level.');
  const own = PROFESSIONS[input.profession]?.cards ?? [];
  if (!Array.isArray(g.cards) || new Set(g.cards).size !== g.cards.length) throw bad('Unknown cards.');
  for (const id of g.cards) {
    const card = own.find((c) => c.id === id);
    if (!card || card.level > g.level) throw bad(`${id} is not a card this hero can own.`);
  }
  for (const a of ATTRIBUTES) if (!Number.isFinite(g.attributes?.[a])) throw bad('Unknown attributes.');
  if (!Number.isInteger(g.maxVitality) || !Number.isInteger(g.stamina) || !Number.isInteger(g.unspentPoints) || g.unspentPoints < 0) throw bad('Bad numbers.');
  if (g.gold !== undefined && !(Number.isFinite(g.gold) && g.gold >= 0)) throw bad('Bad gold.');
  const known = (id: string) => typeof id === 'string' && !!ITEMS[id];
  if (g.equipment) {
    const e = g.equipment;
    if (!known(e.weapon) || !Array.isArray(e.armour) || !e.armour.every(known)) throw bad('Unknown gear.');
  }
  if (g.inventory) {
    const inv = g.inventory;
    if (!Array.isArray(inv.items) || !inv.items.every(known)) throw bad('Unknown items.');
    for (const bag of [inv.materials, inv.herbs]) {
      if (!bag || typeof bag !== 'object' || !Object.values(bag).every((n) => Number.isInteger(n) && n! >= 0)) throw bad('Bad belongings.');
    }
  }
}

/** The parts of a new character that come from the hero's earlier games. */
function grown(input: CharacterInput): Partial<Character> {
  validateGrowth(input);
  const g = input.growth!;
  const all = [...g.cards];
  // Cards of the levels reached that the record lacks (new ones in the game data) come along too.
  for (const card of PROFESSIONS[input.profession]?.cards ?? []) if (card.level <= g.level && !all.includes(card.id)) all.push(card.id);
  const out: Partial<Character> = {
    level: g.level, xp: g.xp, attributes: { ...g.attributes }, maxVitality: g.maxVitality, vitality: g.maxVitality,
    stamina: g.stamina, unspentPoints: g.unspentPoints, skills: { ...g.skills }, cards: all.slice(0, MAX_CARDS),
    ...(g.gold !== undefined ? { gold: g.gold } : {}),
    ...(g.equipment ? { equipment: structuredClone(g.equipment) } : {}),
  };
  if (all.length > MAX_CARDS) {
    out.benched = all.slice(MAX_CARDS);
    out.chooseCards = true;
  }
  return out;
}
