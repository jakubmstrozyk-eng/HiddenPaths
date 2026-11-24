import { DEFAULT_DICE, DEFAULT_LOOK, type Attributes, type DiceLook, type HeroLook, type ProfessionId, type RaceId } from '@hp/content';
import { MISSIONS_KEPT, validateCharacter, type CharacterInput } from './character';
import { EngineError } from './errors';
import type { GameCareer } from './missions';

/**
 * A hero is made once and kept apart from games: the same hero can play several games at
 * once. A hero is made either for single player or for multiplayer, never both. Missions
 * are drawn for each game, so they are chosen when a game starts, not here.
 */
export interface Hero {
  id: string;
  mode: 'solo' | 'multi';
  name: string;
  race: RaceId;
  profession: ProfessionId;
  bonus: Partial<Attributes>;
  look: HeroLook;
  dice: DiceLook;
  createdAt: string;
  /** Each game's share of the career goals, by game: kept on the hero, never sent when making one. */
  career?: Record<string, GameCareer>;
}

export type NewHero = Omit<Hero, 'id' | 'createdAt' | 'career'>;

/** How many games a hero's career remembers; the oldest drop off past this. */
export const CAREER_GAMES = 200;

/** The hero's career with one game's latest share written in. */
export function withCareer(career: Hero['career'], game: string, share: GameCareer): Record<string, GameCareer> {
  const next = { ...(career ?? {}), [game]: share };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - CAREER_GAMES))) delete next[k];
  return next;
}

const PLACEHOLDER_MISSIONS = ['hunter', 'scout'];

/** Checks a hero the same way a character is checked, without missions. Returns a clean copy. */
export function validateHero(input: NewHero): NewHero {
  if (input?.mode !== 'solo' && input?.mode !== 'multi') throw new EngineError('hero.mode', 'A hero is for single player or for multiplayer.');
  const hero: NewHero = {
    mode: input.mode,
    name: String(input.name ?? '').trim().slice(0, 24),
    race: input.race,
    profession: input.profession,
    bonus: { ...input.bonus },
    look: { ...DEFAULT_LOOK, ...input.look },
    dice: { ...DEFAULT_DICE, ...input.dice },
  };
  validateCharacter({ ...heroCharacter(hero as Hero, PLACEHOLDER_MISSIONS) });
  return hero;
}

/** The character a hero brings into a new game, with the missions chosen for it. */
export function heroCharacter(hero: Pick<Hero, 'name' | 'race' | 'profession' | 'bonus' | 'look' | 'dice'> & { id?: string }, missions: string[]): CharacterInput {
  if (missions.length !== MISSIONS_KEPT) throw new EngineError('character.missions', `Keep exactly ${MISSIONS_KEPT} missions.`);
  return { name: hero.name, race: hero.race, profession: hero.profession, bonus: { ...hero.bonus }, missions: [...missions], look: { ...hero.look }, dice: { ...hero.dice }, ...(hero.id ? { heroId: hero.id } : {}) };
}

/** Whether a hero may play a game: single-player heroes only solo games, multiplayer heroes only multiplayer ones. */
export function heroFits(hero: Pick<Hero, 'mode'>, multiplayer: boolean): boolean {
  return hero.mode === (multiplayer ? 'multi' : 'solo');
}
