import { DEFAULT_DICE, DEFAULT_LOOK, type Attributes, type DiceLook, type HeroLook, type ProfessionId, type RaceId } from '@hp/content';
import { cleanDice, cleanLook, MISSIONS_KEPT, validateCharacter, type CharacterInput, type HeroGrowth } from './character';
import { EngineError } from './errors';
import type { GameCareer } from './missions';
import type { HeroJournal } from './journal';

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
  /** What the hero has grown into over its games (Jacob, 2026-11-26): the furthest any game took it. */
  growth?: HeroGrowth;
  /** The hero journal: entries from every game, Inspiration and the current vow (Jacob, 2026-11-27). */
  journal?: HeroJournal;
}

export type NewHero = Omit<Hero, 'id' | 'createdAt' | 'career' | 'growth' | 'journal'>;

/**
 * Keeps the hero's furthest development: a game's latest state replaces the kept one when it has at least as
 * much XP. A hero can play several games at once; the one that took it furthest is the one it carries on with.
 */
export function withGrowth(kept: HeroGrowth | undefined, game: HeroGrowth): HeroGrowth {
  return !kept || game.xp >= kept.xp ? game : kept;
}

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
    look: cleanLook({ ...DEFAULT_LOOK, ...input.look }),
    dice: cleanDice({ ...DEFAULT_DICE, ...input.dice }),
  };
  validateCharacter({ ...heroCharacter(hero as Hero, PLACEHOLDER_MISSIONS) });
  return hero;
}

/** The character a hero brings into a new game, with the missions chosen for it. */
export function heroCharacter(hero: Pick<Hero, 'name' | 'race' | 'profession' | 'bonus' | 'look' | 'dice' | 'growth' | 'journal'> & { id?: string }, missions: string[]): CharacterInput {
  if (missions.length !== MISSIONS_KEPT) throw new EngineError('character.missions', `Keep exactly ${MISSIONS_KEPT} missions.`);
  return {
    name: hero.name, race: hero.race, profession: hero.profession, bonus: { ...hero.bonus }, missions: [...missions], look: { ...hero.look }, dice: { ...hero.dice },
    ...(hero.id ? { heroId: hero.id } : {}),
    ...(hero.growth ? { growth: structuredClone(hero.growth) } : {}),
    ...(hero.journal ? { journal: structuredClone(hero.journal) } : {}),
  };
}

/** Whether a hero may play a game: single-player heroes only solo games, multiplayer heroes only multiplayer ones. */
export function heroFits(hero: Pick<Hero, 'mode'>, multiplayer: boolean): boolean {
  return hero.mode === (multiplayer ? 'multi' : 'solo');
}
