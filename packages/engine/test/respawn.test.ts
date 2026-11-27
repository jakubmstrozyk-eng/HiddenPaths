import { describe, expect, it } from 'vitest';
import { ENEMIES } from '@hp/content';
import { applyAction, createGame, startCombat, worldView, type GameState } from '../src/index';
import { onMap } from './helpers';

const make = (): GameState =>
  onMap(createGame('respawn', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'nomads', profession: 'elder', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]));

/** Fights a foe with 1 Vitality left until the hero falls, trying a few seeds; returns the state after death. */
function dieTo(foe: string, gold = 30, food = 3): GameState {
  for (let seed = 0; seed < 200; seed++) {
    let g = make();
    g.rng = seed;
    const p = g.players[0]!;
    p.character.vitality = 1;
    p.character.gold = gold;
    p.character.food = food;
    p.roundsWithoutFood = 2;
    p.combat = startCombat(worldView(g), [foe]);
    p.combat.foes[0]!.vitality = 999;
    for (let r = 0; r < 10 && g.players[0]!.combat; r++) g = applyAction(g, 'p', { type: 'combat', move: { move: 'parry' } });
    if (g.log.some((e) => e.type === 'died')) return g;
  }
  throw new Error('the hero never fell');
}

describe('death and waking again (Jacob, 2026-11-27)', () => {
  it('food and hunger stay as they were at death', () => {
    const g = dieTo('wolf', 30, 3);
    const p = g.players[0]!;
    expect(p.character.food).toBe(3);
    expect(p.roundsWithoutFood).toBe(2);
    expect(p.character.vitality).toBe(Math.ceil(p.character.maxVitality / 2));
  });

  it('a hero who starved to death wakes 3 hungry rounds away from starving again', () => {
    let g = make();
    const p = g.players[0]!;
    p.character.food = 0;
    p.roundsWithoutFood = 8;
    g = applyAction(g, 'p', { type: 'endTurn' });
    expect(g.log.some((e) => e.type === 'died')).toBe(true);
    expect(g.players[0]!.roundsWithoutFood).toBe(6);
    expect(g.players[0]!.character.food).toBe(0);
  });

  it('a beast does not take gold', () => {
    const g = dieTo('wolf', 30);
    expect(g.players[0]!.character.gold).toBe(30);
    expect(g.log.some((e) => e.type === 'robbed')).toBe(false);
  });

  it('a thinking foe that kills the hero takes all their gold', () => {
    const g = dieTo('bandit', 30);
    expect(g.players[0]!.character.gold).toBe(0);
    expect(g.log.find((e) => e.type === 'robbed')).toMatchObject({ enemy: 'bandit', gold: 30 });
  });

  it('people, demons and the like are thinking foes; beasts and the dead are not', () => {
    for (const id of ['bandit', 'witch', 'nomadWarrior', 'voidDemon', 'imp', 'beastman', 'minotaur', 'riftWarden']) expect(ENEMIES[id]!.sentient, id).toBe(true);
    for (const id of ['wolf', 'bear', 'giantSpider', 'mummy', 'banshee', 'raven', 'manticore']) expect(ENEMIES[id]!.sentient, id).toBeFalsy();
  });
});
