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
