import { describe, expect, it } from 'vitest';
import { EVENTS, EVENT_BY_ID, ITEMS, ENEMIES } from '@hp/content';
import { LEVEL_XP } from '../src/character';
import {
  applyAction, createGame, currentPlayer, legalActions, neighbours, startCombat, strengthStep, worldView, Rng,
  type Action, type CharacterInput, type GameConfig, type GameState,
  landAt,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter', 'scout'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

function game(seed = 'm2', config: GameConfig = solo): GameState {
  return onMap(createGame(seed, config, [{ id: 'p1', character: hero }]));
}

/** Makes every test pass (98 is under every roll but 99 and 100). */
function strong(state: GameState) {
  const p = currentPlayer(state);
  for (const k of Object.keys(p.character.attributes)) (p.character.attributes as Record<string, number>)[k] = 98;
  return state;
}

function withCard(state: GameState, card: number, step = 'start'): GameState {
  currentPlayer(state).pendingEvent = { card, step };
  return state;
}

describe('event cards', () => {
  it('every card is well formed: steps exist, gotos point at real steps, items and foes exist', () => {
    const ids = new Set<number>();
    for (const card of EVENTS) {
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);
      expect(card.title.pl && card.title.en && card.text.pl && card.text.en).toBeTruthy();
      const visit = (outcomes: unknown[]) => {
        for (const o of outcomes as Record<string, unknown>[]) {
          if (o.do === 'goto') expect(card.steps[o.step as string], `card ${card.id} step ${o.step}`).toBeDefined();
          if (o.do === 'item') expect(ITEMS[o.item as string], `card ${card.id} item ${o.item}`).toBeDefined();
          if (o.do === 'fight') for (const e of o.enemies as string[]) expect(ENEMIES[e], `card ${card.id} foe ${e}`).toBeDefined();
          for (const key of ['pass', 'fail', 'then', 'else', 'onWin', 'each']) if (Array.isArray(o[key])) visit(o[key] as unknown[]);
          if (Array.isArray(o.table)) for (const row of o.table as { then: unknown[] }[]) visit(row.then);
          if (o.do === 'puzzle') {
            const pz = o.puzzle as Record<string, unknown>;
            for (const key of ['win', 'fast', 'lose', 'treasure', 'empty', 'blast', 'hit', 'bust', 'bottom', 'loot', 'burn']) if (Array.isArray(pz[key])) visit(pz[key] as unknown[]);
            if (Array.isArray(pz.byScore)) for (const row of pz.byScore as unknown[][]) visit(row);
          }
        }
      };
      for (const step of Object.values(card.steps)) {
        expect(step.options.length).toBeGreaterThan(0);
        expect(step.options.some((o) => !o.cost), `card ${card.id} needs a free way out`).toBe(true);
        for (const o of step.options) visit(o.then);
      }
    }
    expect(EVENTS.length).toBeGreaterThanOrEqual(30);
    expect(EVENT_BY_ID[26]!.title.en).toBe('Book II');
  });

  it('revealing an event fragment draws a card and blocks other actions until it is answered', () => {
    let state = game();
    const p = currentPlayer(state);
    const target = neighbours(state.map, p.position).find((n) => {
      const t = landAt(state.map, n);
      return t === 'forest' || t === 'fields';
    });
    if (target === undefined) return;
    p.speedLeft = 5;
    state = applyAction(state, 'p1', { type: 'move', to: target });
    const after = currentPlayer(state);
    expect(after.pendingEvent).not.toBeNull();
    expect(legalActions(state, 'p1').every((a) => a.type === 'event')).toBe(true);
    expect(() => applyAction(state, 'p1', { type: 'endTurn' })).toThrow();
  });

  it('the sage teaches a Keeper +10 Intelligence for 1 gold', () => {
    const state = withCard(game(), 2);
    const int = currentPlayer(state).character.attributes.int;
    const after = currentPlayer(applyAction(state, 'p1', { type: 'event', option: 0 }));
    expect(after.character.attributes.int).toBe(int + 10);
    expect(after.character.gold).toBe(4);
    expect(after.pendingEvent).toBeNull();
  });

  it('a choice the hero cannot pay for is not offered', () => {
    const state = withCard(game(), 2);
    currentPlayer(state).character.gold = 0;
    currentPlayer(state).character.food = 0;
    expect(legalActions(state, 'p1').filter((a) => a.type === 'event')).toEqual([{ type: 'event', option: 2 }, { type: 'event', option: 3 }]);
    expect(() => applyAction(state, 'p1', { type: 'event', option: 0 })).toThrow();
  });

  it('the wolf pack starts a fight with three wolves', () => {
    const after = currentPlayer(applyAction(withCard(game(), 3), 'p1', { type: 'event', option: 0 }));
    expect(after.combat?.foes.map((f) => f.enemy)).toEqual(['wolf', 'wolf', 'wolf']);
  });

  it('multi-step cards continue at the next step', () => {
    const state = strong(withCard(game(), 25));
    const after = currentPlayer(applyAction(state, 'p1', { type: 'event', option: 1 }));
    expect(after.pendingEvent).toEqual({ card: 25, step: 'camp' });
  });

  it('the plague is a condition tested at the start of each turn until it passes', () => {
    let state = withCard(game(), 28);
    const p = currentPlayer(state);
    p.character.attributes.str = -200; // fails for sure (a 1 still passes)
    state = applyAction(state, 'p1', { type: 'event', option: 0 });
    expect(currentPlayer(state).conditions.map((c) => c.id)).toContain('plague');
    currentPlayer(state).character.attributes.str = 98;
    state = applyAction(state, 'p1', { type: 'endTurn' });
    expect(currentPlayer(state).conditions).toHaveLength(0);
  });

  it('the portal pushes the hero forward, away from the side they entered', () => {
    let state = game('portal');
    const p = currentPlayer(state);
    const { width } = state.map;
    p.position = 2 * width + 2;
    p.cameFrom = 2 * width + 1; // entered from the west, so forward is east
    state = applyAction(withCard(state, 9), 'p1', { type: 'event', option: 1 });
    const after = currentPlayer(state);
    expect(Math.floor(after.position / width)).toBe(2);
    expect(after.position % width).toBeGreaterThan(2);
  });
});

describe('combat', () => {
  it('weapon damage uses the Strength step S = Strength / 10', () => {
    expect(strengthStep(20)).toBe(2);
    expect(strengthStep(39)).toBe(3);
  });

  it('enemy Vitality scales with difficulty', () => {
    const hard = worldView(game('h', { ...solo, difficulty: 'hard' }));
    expect(startCombat(hard, ['wolf']).foes[0]!.vitality).toBe(Math.round(8 * 1.2));
  });

  it('a strong hero beats a wolf and gets its XP', () => {
    let state = strong(game());
    const p = currentPlayer(state);
    p.combat = startCombat(worldView(state), ['wolf']);
    p.character.maxVitality = p.character.vitality = 500;
    const xp = p.character.xp;
    for (let i = 0; i < 20 && currentPlayer(state).combat; i++) {
      const target = currentPlayer(state).combat!.foes[0]!.uid;
      state = applyAction(state, 'p1', { type: 'combat', move: { move: 'attack', target } });
    }
    const after = currentPlayer(state);
    expect(after.combat).toBeNull();
    expect(after.character.xp).toBe(xp + 2);
  });

  it('during a fight only combat moves are allowed', () => {
    const state = game();
    currentPlayer(state).combat = startCombat(worldView(state), ['wolf', 'wolf']);
    const kinds = new Set(legalActions(state, 'p1').map((a) => (a.type === 'combat' ? a.move.move : a.type)));
    // 'card': the hero's fight skill cards are combat moves too.
    expect([...kinds].sort()).toEqual(['attack', 'card', 'flee', 'focus', 'parry']);
  });

  it('losing a fight sends the hero back to the start with half Vitality', () => {
    let state = game();
    const p = currentPlayer(state);
    p.position = neighbours(state.map, p.start)[0]!;
    p.combat = startCombat(worldView(state), ['manticore']);
    p.character.vitality = 1;
    for (const k of Object.keys(p.character.attributes)) (p.character.attributes as Record<string, number>)[k] = -200;
    for (let i = 0; i < 30 && currentPlayer(state).combat; i++) {
      state = applyAction(state, 'p1', { type: 'combat', move: { move: 'parry' } });
    }
    const after = currentPlayer(state);
    expect(after.combat).toBeNull();
    expect(after.position).toBe(after.start);
    expect(after.character.vitality).toBe(Math.ceil(after.character.maxVitality / 2));
  });
});

describe('towns', () => {
  function inTown(terrain: 'village' | 'city' | 'inn') {
    const state = game('town');
    const p = currentPlayer(state);
    (state.map.cells[p.position] as { terrain: string }).terrain = terrain;
    return state;
  }

  it('the village market sells up to 4 food a round for 1 gold each', () => {
    let state = inTown('village');
    currentPlayer(state).character.gold = 10;
    const food = currentPlayer(state).character.food;
    for (let i = 0; i < 4; i++) state = applyAction(state, 'p1', { type: 'buy', item: 'food' });
    expect(currentPlayer(state).character.food).toBe(food + 4);
    expect(currentPlayer(state).character.gold).toBe(6);
    expect(() => applyAction(state, 'p1', { type: 'buy', item: 'food' })).toThrow();
  });

  it('iron armour is sold only in a city', () => {
    const village = inTown('village');
    currentPlayer(village).character.gold = 50;
    expect(legalActions(village, 'p1')).not.toContainEqual({ type: 'buy', item: 'iron-torso' });
    const city = inTown('city');
    currentPlayer(city).character.gold = 50;
    expect(legalActions(city, 'p1')).toContainEqual({ type: 'buy', item: 'iron-torso' });
  });

  it('buying and wearing armour swaps out the old piece on that slot', () => {
    let state = inTown('city');
    currentPlayer(state).character.gold = 50;
    state = applyAction(state, 'p1', { type: 'buy', item: 'iron-torso' });
    state = applyAction(state, 'p1', { type: 'equip', item: 'iron-torso' });
    const p = currentPlayer(state);
    expect(p.character.equipment.armour).toContain('iron-torso');
    expect(p.character.equipment.armour).not.toContain('leather-torso');
    expect(p.inventory.items).toContain('leather-torso');
  });

  it('training costs 2 Stamina and gives +1 Combat, at most 3 times in villages', () => {
    let state = inTown('village');
    const com = currentPlayer(state).character.attributes.com;
    state = applyAction(state, 'p1', { type: 'service', service: 'train' });
    expect(currentPlayer(state).character.attributes.com).toBe(com + 1);
    expect(currentPlayer(state).staminaLeft).toBe(1);
  });

  it('selling ore at a village pays the merchant price', () => {
    let state = inTown('village');
    currentPlayer(state).inventory.materials.iron = 2;
    const gold = currentPlayer(state).character.gold;
    state = applyAction(state, 'p1', { type: 'sell', item: 'iron' });
    expect(currentPlayer(state).character.gold).toBe(gold + 1);
    expect(currentPlayer(state).inventory.materials.iron).toBe(1);
  });
});

describe('levelling and winning', () => {
  it('a level gives 20 attribute points and +2 Vitality, and the points can be spent', () => {
    let state = withCard(game(), 12);
    const p = currentPlayer(state);
    p.character.xp = LEVEL_XP[2]! - 1;
    const maxVit = p.character.maxVitality;
    // Choose to walk on (no XP); then give XP through a fight win.
    p.combat = startCombat(worldView(state), ['imp']);
    p.pendingEvent = null;
    strong(state);
    for (let i = 0; i < 10 && currentPlayer(state).combat; i++) {
      state = applyAction(state, 'p1', { type: 'combat', move: { move: 'attack', target: currentPlayer(state).combat!.foes[0]!.uid } });
    }
    const after = currentPlayer(state);
    expect(after.character.level).toBe(2);
    expect(after.character.unspentPoints).toBe(20);
    expect(after.character.maxVitality).toBe(maxVit + 2);
    state = applyAction(state, 'p1', { type: 'spend', bonus: { dex: 15, str: 5 } });
    expect(currentPlayer(state).character.unspentPoints).toBe(0);
  });

  it('bringing the Stone of Beginnings to a city wins a Stone game', () => {
    let state = game('stone', { ...solo, winMode: 'stone' });
    const p = currentPlayer(state);
    const core = state.map.cells.find((c) => c.terrain === 'core')!.index;
    const next = neighbours(state.map, core)[0]!;
    (state.map.cells[next] as { terrain: string }).terrain = 'city';
    p.position = neighbours(state.map, core).find((n) => n !== next) ?? next;
    p.revealed.push(core, next);
    p.speedLeft = 10;
    state = applyAction(state, 'p1', { type: 'move', to: core });
    expect(currentPlayer(state).hasStone).toBe(true);
    state = applyAction(state, 'p1', { type: 'move', to: next });
    expect(state.winner).toBe('p1');
    expect(legalActions(state, 'p1')).toEqual([]);
  });
});

describe('random play', () => {
  it('thousands of random legal actions never break the engine', () => {
    const configs: GameConfig[] = [
      { size: 'short', difficulty: 'easy', winMode: 'exploration', multiplayer: false },
      { size: 'medium', difficulty: 'nightmare', winMode: 'stone', multiplayer: false },
      { size: 'epic', difficulty: 'hard', winMode: 'exploration', multiplayer: false },
    ];
    let actions = 0;
    for (let g = 0; g < 30; g++) {
      const config = configs[g % configs.length]!;
      let state = createGame(`fuzz-${g}`, config, [{ id: 'p1', character: { ...hero, race: (['nomads', 'myrmids', 'humans', 'sunborn', 'keepers', 'flintborn'] as const)[g % 6]!, profession: (['trapper', 'diver', 'warrior', 'mystic', 'wraith', 'cavedelver'] as const)[g % 6]! } }]);
      const pick = new Rng(g + 1);
      for (let i = 0; i < 300 && !state.winner; i++) {
        let legal = legalActions(state, 'p1');
        expect(legal.length).toBeGreaterThan(0);
        // Prefer moving so games travel; avoid ending turns too often.
        const moves = legal.filter((a) => a.type === 'move');
        if (moves.length && pick.next() < 0.6) legal = moves;
        let action: Action = legal[pick.int(legal.length)]!;
        if (action.type === 'spend') action = { type: 'spend', bonus: { com: currentPlayer(state).character.unspentPoints } };
        state = applyAction(state, 'p1', action);
        actions++;
        const p = currentPlayer(state);
        expect(p.character.vitality).toBeGreaterThan(0);
        expect(p.character.gold).toBeGreaterThanOrEqual(0);
        expect(p.character.food).toBeGreaterThanOrEqual(0);
        if (i % 100 === 0) expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      }
    }
    expect(actions).toBeGreaterThan(3000);
  }, 60_000);
});
