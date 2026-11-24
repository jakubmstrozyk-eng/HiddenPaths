import {
  ATTRIBUTES, DICE_STYLE_IDS, LOOK_OPTIONS, MISSIONS, GAME_MISSIONS, PROFESSIONS, RACES, STARTING_KIT,
  type Attributes, type DiceLook, type HeroLook, type ProfessionId, type RaceId, type SkillId,
} from '@hp/content';
import { EngineError } from './errors';
import type { Rng } from './rng';
import type { Equipment } from './terrain';

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
  }
  if (input.dice) {
    for (const die of ['d6', 'd10', 'd100'] as const) {
      if (!DICE_STYLE_IDS.includes(input.dice[die])) throw new EngineError('character.dice', 'Unknown dice style.');
    }
  }
  if (spent > BONUS_POINTS) throw new EngineError('character.bonus', `Only ${BONUS_POINTS} bonus points can be spent.`);
  if (new Set(input.missions).size !== MISSIONS_KEPT) throw new EngineError('character.missions', `Keep exactly ${MISSIONS_KEPT} missions.`);
  for (const m of input.missions) {
    if (!GAME_MISSIONS.some((x) => x.id === m)) throw new EngineError('character.missions', `Unknown mission ${m}.`);
    if (offered && !offered.includes(m)) throw new EngineError('character.missions', `Mission ${m} was not drawn.`);
  }
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
    ...(input.look ? { look: { head: input.look.head, torso: input.look.torso, legs: input.look.legs } } : {}),
    ...(input.dice ? { dice: { d6: input.dice.d6, d10: input.dice.d10, d100: input.dice.d100 } } : {}),
    ...(typeof input.heroId === 'string' ? { heroId: input.heroId.slice(0, 64) } : {}),
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

/** Applies the rewards of reaching `level` to a character. */
export function levelUp(c: Character, level: number): void {
  c.level = level;
  c.unspentPoints += LEVEL_UP.points;
  c.maxVitality += LEVEL_UP.vitality;
  c.vitality += LEVEL_UP.vitality;
  if (LEVEL_UP.staminaAt.includes(level)) c.stamina += 1;
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
