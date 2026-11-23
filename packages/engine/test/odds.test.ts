import { describe, expect, it } from 'vitest';
import { createGame, fightOdds, foeDamage, startCombat, worldView } from '../src/index';

describe('fight odds', () => {
  const game = createGame('odds', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]);
  const me = game.players[0]!;

  it('gives the same estimate for the same fight and leaves the state alone', () => {
    const combat = startCombat(worldView(game), ['bear']);
    const before = JSON.stringify({ me, combat });
    const a = fightOdds(worldView(game), me, combat);
    expect(fightOdds(worldView(game), me, combat)).toEqual(a);
    expect(JSON.stringify({ me, combat })).toBe(before);
    expect(a.win + a.lose).toBeLessThanOrEqual(1);
  });

  it('rates an imp easier than a bear', () => {
    const imp = fightOdds(worldView(game), me, startCombat(worldView(game), ['imp']));
    const bear = fightOdds(worldView(game), me, startCombat(worldView(game), ['bear']));
    expect(imp.win).toBeGreaterThan(bear.win);
  });

  it('reports foe damage before armour', () => {
    expect(foeDamage('bear')).toEqual([6, 11]);
  });
});

describe('random foes by level', () => {
  it('keeps bears, beastmen and giant spiders away until level 3', async () => {
    const { randomFoesFor } = await import('@hp/content');
    for (const level of [1, 2]) expect(randomFoesFor(level)).not.toContain('bear');
    expect(randomFoesFor(1)).toEqual(['wolf', 'bandit', 'mummy', 'raven', 'imp']);
    expect(randomFoesFor(3)).toContain('bear');
  });
});

describe("Jacob's movement and fight rules", async () => {
  const { applyAction, legalActions, createGame: make, startCombat: begin, worldView: view, currentPlayer } = await import('../src/index');
  const fresh = () => make('rules', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]);

  it('a step costs 1 Stamina as well as Speed, and needs it', () => {
    const g = fresh();
    const step = legalActions(g, 'p').find((a) => a.type === 'move')!;
    const after = applyAction(g, 'p', step);
    expect(currentPlayer(after).staminaLeft).toBe(g.players[0]!.staminaLeft - 1);
    const tired = structuredClone(g);
    tired.players[0]!.staminaLeft = 0;
    expect(legalActions(tired, 'p').some((a) => a.type === 'move')).toBe(false);
    expect(() => applyAction(tired, 'p', step)).toThrow(/Stamina/);
  });

  it('a finished fight leaves no Speed or Stamina', () => {
    let g = fresh();
    g.players[0]!.combat = begin(view(g), ['imp']);
    for (let i = 0; i < 40 && g.players[0]!.combat; i++) {
      g = applyAction(g, 'p', { type: 'combat', move: { move: 'attack', target: g.players[0]!.combat!.foes.find((f) => f.vitality > 0)!.uid } });
    }
    expect(g.players[0]!.combat).toBeNull();
    if (g.turnIndex === 0 && g.round === 1) {
      expect(g.players[0]!.speedLeft).toBe(0);
      expect(g.players[0]!.staminaLeft).toBe(0);
    }
  });
});
