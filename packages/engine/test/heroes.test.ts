import { describe, expect, it } from 'vitest';
import { createGame, heroCharacter, heroFits, validateHero, type NewHero } from '../src/index';

const hero: NewHero = {
  mode: 'solo', name: ' Ara ', race: 'keepers', profession: 'wraith', bonus: { dex: 10 },
  look: { head: 2, torso: 1, legs: 0 }, dice: { d6: 'ruby', d10: 'gold', d100: 'void' },
};

describe('heroes', () => {
  it('a hero is checked like a character and trimmed', () => {
    expect(validateHero(hero).name).toBe('Ara');
    expect(() => validateHero({ ...hero, profession: 'warrior' })).toThrow();
    expect(() => validateHero({ ...hero, look: { head: 5, torso: 0, legs: 0 } })).toThrow();
    expect(() => validateHero({ ...hero, look: { head: 0, torso: 0, legs: 0, skin: 'red' } })).toThrow();
    expect(validateHero({ ...hero, look: { head: 4, torso: 3, legs: 4, hair: '#ab12cd', junk: 1 } as never }).look).toEqual({ head: 4, torso: 3, legs: 4, hair: '#ab12cd' });
    expect(() => validateHero({ ...hero, dice: { d6: 'plaid', d10: 'gold', d100: 'void' } })).toThrow();
    expect(() => validateHero({ ...hero, mode: 'both' as never })).toThrow();
  });

  it('dice keep their finish, engraving and box, and odd ones are refused', () => {
    const dice = { d6: 'ruby', d10: 'gold', d100: 'void', finish: 'pearl', engrave: 'runes', box: 'leather' } as const;
    expect(validateHero({ ...hero, dice: { ...dice, junk: 1 } as never }).dice).toEqual(dice);
    expect(() => validateHero({ ...hero, dice: { ...dice, finish: 'chrome' as never } })).toThrow();
    expect(() => validateHero({ ...hero, dice: { ...dice, engrave: 'neon' as never } })).toThrow();
    expect(() => validateHero({ ...hero, dice: { ...dice, box: 'cardboard' } })).toThrow();
  });

  it('single-player heroes play solo games only, multiplayer heroes multiplayer only', () => {
    expect(heroFits({ mode: 'solo' }, false)).toBe(true);
    expect(heroFits({ mode: 'solo' }, true)).toBe(false);
    expect(heroFits({ mode: 'multi' }, true)).toBe(true);
    expect(heroFits({ mode: 'multi' }, false)).toBe(false);
  });

  it('brings its look and dice into a game, with the missions chosen for that game', () => {
    const g = createGame('h', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
      [{ id: 'p', character: heroCharacter(validateHero(hero), ['hunter']) }]);
    const c = g.players[0]!.character;
    expect(c.look).toEqual({ head: 2, torso: 1, legs: 0 });
    expect(c.dice?.d100).toBe('void');
    expect(c.missions).toEqual(['hunter']);
  });
});
