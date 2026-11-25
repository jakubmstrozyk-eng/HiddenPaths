import { describe, expect, it } from 'vitest';
import { CAREER_MISSIONS, GAME_MISSIONS, MISSIONS } from '@hp/content';
import { careerOf, careerProgress, createGame, drawMissionChoices, missionProgress, missionTarget, Rng } from '../src';
import { log } from '../src/progress';
import { onMap } from './helpers';

const game = (missions = ['warrior', 'hunter']) => onMap(createGame('missions', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
  [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions } }]));

describe('missions', () => {
  it('splits game goals from career goals and scales game goals with the map', () => {
    expect(GAME_MISSIONS.length + CAREER_MISSIONS.length).toBe(MISSIONS.length);
    expect(GAME_MISSIONS.some((m) => m.id === 'magician')).toBe(true); // scrolls are in the game
    const warrior = MISSIONS.find((m) => m.id === 'warrior')!;
    expect(missionTarget(warrior, 'short')).toBe(3);
    expect(missionTarget(warrior, 'epic')).toBe(10);
    for (let s = 0; s < 20; s++) for (const id of drawMissionChoices(new Rng(s))) expect(GAME_MISSIONS.some((m) => m.id === id)).toBe(true);
  });

  it('counts defeated foes and pays the XP once when the goal is reached', () => {
    const g = game();
    const p = g.players[0]!;
    const xp = p.character.xp;
    for (let i = 0; i < 4; i++) log(g, { type: 'combat', player: 'p', event: { type: 'foeDown', uid: `w${i}`, enemy: 'wolf' } });
    expect(missionProgress(g, p, 'warrior')).toEqual({ count: 3, target: 3, done: true });
    const paid = g.log.filter((e) => e.type === 'mission');
    expect(paid).toHaveLength(1);
    expect(p.character.xp).toBe(xp + 60);
  });

  it('counts food and herbs found on event cards for the Gatherer, and hunted food too', () => {
    const g = game(['gatherer', 'hunter']);
    const p = g.players[0]!;
    log(g, { type: 'change', player: 'p', change: { what: 'food', amount: 2 } });
    log(g, { type: 'change', player: 'p', change: { what: 'herbs', amount: 1 } });
    log(g, { type: 'change', player: 'p', change: { what: 'food', amount: -3 } });
    p.counters.hunts = 1;
    log(g, { type: 'test', player: 'p', action: 'hunt', attribute: 'dex', result: { roll: 10, target: 40, success: true, margin: 30 }, gained: ['food:2'] });
    expect(missionProgress(g, p, 'gatherer').count).toBe(5);
    expect(missionProgress(g, p, 'hunter').count).toBe(1);
  });

  it('counts only items gained for the Collector, not potions drunk or gear put on', () => {
    const g = game(['collector', 'hunter']);
    const p = g.players[0]!;
    log(g, { type: 'change', player: 'p', change: { what: 'item', item: 'healingPotion', amount: -1 } });
    log(g, { type: 'change', player: 'p', change: { what: 'item', item: 'dagger', amount: 0 } });
    expect(missionProgress(g, p, 'collector').count).toBe(0);
    log(g, { type: 'change', player: 'p', change: { what: 'item', item: 'dagger', amount: 1 } });
    expect(missionProgress(g, p, 'collector').count).toBe(1);
  });

  it('adds up career goals across games', () => {
    const one = careerOf(game().players[0]!);
    const done = careerProgress([{ ...one, cards: 12 }, { ...one, cards: 9, level: 5 }]);
    expect(done.find((c) => c.id === 'professional')).toMatchObject({ count: 20, done: true });
    expect(done.find((c) => c.id === 'hero')!.done).toBe(true);
    expect(done.find((c) => c.id === 'expert')!.done).toBe(false);
  });
});
