import { describe, expect, it } from 'vitest';
import { MISSIONS, RACES, TERRAINS } from '@hp/content';
import {
  Rng, seedFromString, test as d100, successChance,
  SIZE_PRESETS, generateMap, terrainPool, regionOf, neighbours,
  createCharacter, drawMissionChoices, levelForXp,
  createGame, applyAction, legalActions, currentPlayer,
  EngineError, type CharacterInput, type GameConfig, type SizePreset,
} from '../src';
import { onMap } from './helpers';

const hero = (over: Partial<CharacterInput> = {}): CharacterInput => ({
  name: 'Ara',
  race: 'keepers',
  profession: 'wraith',
  bonus: { dex: 10, com: 10 },
  missions: ['hunter', 'scout'],
  ...over,
});
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

describe('dice', () => {
  it('replays the same rolls from the same seed', () => {
    const a = new Rng(seedFromString('abc'));
    const b = new Rng(seedFromString('abc'));
    expect([1, 2, 3, 4, 5].map(() => a.die(100))).toEqual([1, 2, 3, 4, 5].map(() => b.die(100)));
  });

  it('keeps d100 rolls between 1 and 100', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 5000; i++) {
      const r = rng.die(100);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(100);
    }
  });

  it('passes a test when the roll lands at or under the target', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const t = d100(rng, 40, -10);
      expect(t.target).toBe(30);
      if (t.roll !== 1 && t.roll !== 100) expect(t.success).toBe(t.roll <= 30);
    }
    expect(successChance(40, -10)).toBe(0.3);
  });
});

describe('map generator', () => {
  for (const size of Object.keys(SIZE_PRESETS) as SizePreset[]) {
    it(`builds a full ${size} map with a core at the centre and enough towns`, () => {
      const map = generateMap(size, new Rng(seedFromString(`map-${size}`)));
      const { width, height } = SIZE_PRESETS[size];
      expect(map.cells).toHaveLength(width * height);
      expect(width).toBe(height);
      const centre = map.cells.find((c) => c.terrain === 'core')!;
      expect(centre.ring).toBe(0);
      expect(centre.region).toBe('C');
      expect(map.cells.filter((c) => c.terrain === 'core')).toHaveLength(1);
      expect(map.cells.filter((c) => c.terrain === 'city').length).toBeGreaterThanOrEqual(1);
      expect(map.cells.filter((c) => c.terrain === 'village').length).toBeGreaterThanOrEqual(2);
    });
  }

  it('scales the deck to the map size', () => {
    for (const slots of [24, 35, 48, 63]) {
      const pool = terrainPool(slots);
      expect(Object.values(pool).reduce((a, b) => a + b, 0)).toBe(slots);
      expect(pool.forest).toBeGreaterThan(pool.desert);
    }
  });

  it('gives the same map for the same seed', () => {
    const a = generateMap('long', new Rng(seedFromString('same')));
    const b = generateMap('long', new Rng(seedFromString('same')));
    expect(a).toEqual(b);
  });

  it('places mountains in the north-west more often than in the south-east', () => {
    let nw = 0;
    let se = 0;
    for (let s = 0; s < 200; s++) {
      const map = generateMap('epic', new Rng(s));
      for (const c of map.cells) {
        if (c.terrain !== 'mountains') continue;
        if (c.region === 'NW') nw++;
        if (c.region === 'SE') se++;
      }
    }
    expect(nw).toBeGreaterThan(se * 1.5);
  });

  it('names compass regions with north at the top', () => {
    expect(regionOf(0, 0, 5, 5)).toBe('NW');
    expect(regionOf(4, 0, 5, 5)).toBe('NE');
    expect(regionOf(2, 4, 5, 5)).toBe('S');
    expect(regionOf(2, 2, 5, 5)).toBe('C');
    expect(neighbours({ width: 5, height: 5 }, 0).sort()).toEqual([1, 5]);
  });
});

describe('characters', () => {
  it('adds bonus points to the race sheet and gives the starting kit', () => {
    const c = createCharacter(hero(), 5);
    expect(c.attributes.dex).toBe(RACES.keepers.attributes.dex + 10);
    expect(c.attributes.com).toBe(RACES.keepers.attributes.com + 10);
    expect(c.stamina).toBe(3);
    expect(c.speed).toBe(2);
    expect(c.gold).toBe(5);
    expect(c.food).toBe(5);
    expect(c.cards).toHaveLength(3);
  });

  it('rejects broken characters', () => {
    expect(() => createCharacter(hero({ bonus: { dex: 21 } }), 5)).toThrow(EngineError);
    expect(() => createCharacter(hero({ profession: 'warrior' }), 5)).toThrow(/not a profession/);
    expect(() => createCharacter(hero({ missions: ['hunter'] }), 5)).toThrow(/exactly 2/);
    expect(() => createCharacter(hero({ name: ' ' }), 5)).toThrow(/name/);
    expect(() => createCharacter(hero(), 5, ['hero', 'expert', 'master', 'magician'])).toThrow(/not drawn/);
  });

  it('draws 4 different missions', () => {
    const drawn = drawMissionChoices(new Rng(3));
    expect(new Set(drawn).size).toBe(4);
    expect(drawn.every((d) => MISSIONS.some((m) => m.id === d))).toBe(true);
  });

  it('follows the level table', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(10)).toBe(2);
    expect(levelForXp(99)).toBe(4);
    expect(levelForXp(1000)).toBe(9);
  });
});

describe('turns', () => {
  it('moves to a neighbour, spends Speed and reveals the fragment', () => {
    let game = onMap(createGame('turns-1', solo, [{ id: 'p1', character: hero() }]));
    const me = currentPlayer(game);
    const move = legalActions(game, 'p1').find((a) => a.type === 'move');
    expect(move).toBeDefined();
    if (move?.type !== 'move') return;
    const terrain = game.map.cells[move.to]!.terrain;
    const cost = terrain !== 'core' && TERRAINS[terrain].hard ? 2 : 1;
    game = applyAction(game, 'p1', move);
    const after = currentPlayer(game);
    expect(after.position).toBe(move.to);
    expect(after.speedLeft).toBe(me.speedLeft - cost);
    expect(after.revealed).toContain(move.to);
    expect(after.character.xp).toBe(1);
    expect(game.version).toBe(1);
  });

  it('never changes the state it was given', () => {
    const game = createGame('turns-2', solo, [{ id: 'p1', character: hero() }]);
    const copy = structuredClone(game);
    applyAction(game, 'p1', { type: 'endTurn' });
    expect(game).toEqual(copy);
  });

  it('refuses moves that are too far or out of turn', () => {
    const game = createGame('turns-3', { ...solo, multiplayer: true }, [
      { id: 'p1', character: hero() },
      { id: 'p2', character: hero({ race: 'flintborn', profession: 'cavedelver', bonus: {} }) },
    ]);
    const first = currentPlayer(game);
    const other = game.players.find((p) => p.id !== first.id)!;
    expect(() => applyAction(game, other.id, { type: 'endTurn' })).toThrow(/not your turn/);
    expect(() => applyAction(game, first.id, { type: 'move', to: (first.position + 12) % 25 })).toThrow(EngineError);
  });

  it('orders turns by Dexterity and passes them one after another', () => {
    let game = createGame('turns-4', { ...solo, multiplayer: true }, [
      { id: 'slow', character: hero({ race: 'flintborn', profession: 'cavedelver', bonus: {} }) },
      { id: 'fast', character: hero() },
    ]);
    expect(game.turnOrder).toEqual(['fast', 'slow']);
    game = applyAction(game, 'fast', { type: 'endTurn' });
    expect(currentPlayer(game).id).toBe('slow');
    expect(game.round).toBe(1);
    game = applyAction(game, 'slow', { type: 'endTurn' });
    expect(currentPlayer(game).id).toBe('fast');
    expect(game.round).toBe(2);
  });

  it('eats 1 food per round and goes hungry without it', () => {
    let game = createGame('turns-5', { ...solo, difficulty: 'nightmare' }, [{ id: 'p1', character: hero() }]);
    expect(currentPlayer(game).character.food).toBe(3);
    for (let i = 0; i < 6; i++) game = applyAction(game, 'p1', { type: 'endTurn' });
    const p = currentPlayer(game);
    expect(p.character.food).toBe(0);
    expect(p.roundsWithoutFood).toBe(3);
    expect(p.character.vitality).toBe(RACES.keepers.vitality - 5);
  });
});
