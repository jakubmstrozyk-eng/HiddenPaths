import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '@hp/content';
import {
  applyAction, createGame, growthOf, heroCharacter, legalActions, withGrowth, type Hero, type HeroGrowth,
} from '../src/index';
import { gainXp } from '../src/progress';

const hero: Hero = {
  id: 'h1', mode: 'solo', name: 'Ara', race: 'humans', profession: 'warrior', bonus: { com: 10 },
  look: { head: 0, torso: 0, legs: 0 }, dice: { d6: 'bone', d10: 'bone', d100: 'bone' } as Hero['dice'], createdAt: '2026-11-26',
};
const config = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false } as const;
const start = (h: Hero, seed = 'g1') => createGame(seed, config, [{ id: 'p', character: heroCharacter(h, ['hunter', 'scout']) }]);

describe('a hero keeps its level between games (Jacob, 2026-11-26)', () => {
  it('a new game starts where the last one left the hero', () => {
    const first = start(hero);
    const p = first.players[0]!;
    gainXp(first, p, 35);
    p.character.attributes.str += 5;
    const growth = growthOf(p.character);
    expect(growth.level).toBe(3);
    const next = start({ ...hero, growth }, 'g2').players[0]!.character;
    expect(next.level).toBe(3);
    expect(next.xp).toBe(35);
    expect(next.attributes.str).toBe(p.character.attributes.str);
    expect(next.maxVitality).toBe(p.character.maxVitality);
    expect(next.vitality).toBe(next.maxVitality);
    expect(next.cards).toEqual(p.character.cards);
    // Gold, food and gear start fresh.
    expect(next.gold).toBe(5);
    expect(next.chooseCards).toBeUndefined();
  });

  it('a hero with more than 5 cards picks the 5 to play with before the game', () => {
    const all = PROFESSIONS.warrior.cards.filter((c) => c.level <= 3).map((c) => c.id);
    const growth: HeroGrowth = {
      level: 3, xp: 30, attributes: { dex: 40, cha: 40, str: 40, wil: 40, int: 40, com: 50 }, maxVitality: 18, stamina: 3, unspentPoints: 0, skills: {},
      cards: [...all, 'warrior-veteran'].filter((c, i, a) => a.indexOf(c) === i),
    };
    // Only 5 cards up to level 3, so pretend the hero owned a 6th: a record with an unknown card is refused.
    expect(() => start({ ...hero, growth: { ...growth, cards: [...growth.cards, 'mystic-seer'] } })).toThrow();
    const g = start({ ...hero, growth });
    const c = g.players[0]!.character;
    c.benched = ['x'];
    c.chooseCards = true;
    expect(legalActions(g, 'p').some((a) => a.type === 'keepCards')).toBe(true);
    const keep = [...c.cards.slice(1), 'x'];
    const after = applyAction(g, 'p', { type: 'keepCards', cards: keep }).players[0]!.character;
    expect(after.cards).toEqual(keep);
    expect(after.chooseCards).toBeUndefined();
    expect(after.benched).toHaveLength(1);
  });

  it('the hero keeps the game that took it furthest', () => {
    const a = growthOf(start(hero).players[0]!.character);
    const b = { ...a, xp: 40, level: 3 };
    expect(withGrowth(undefined, a)).toBe(a);
    expect(withGrowth(b, a)).toBe(b);
    expect(withGrowth(a, b)).toBe(b);
  });

  it('a record that does not add up is refused', () => {
    const g = growthOf(start(hero).players[0]!.character);
    expect(() => start({ ...hero, growth: { ...g, level: 5 } })).toThrow(/XP/);
    expect(() => start({ ...hero, growth: { ...g, cards: ['warrior-strategist'] } })).toThrow();
  });
});
