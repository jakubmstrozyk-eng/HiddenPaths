import { describe, expect, it } from 'vitest';
import type { ProfessionId, RaceId } from '@hp/content';
import {
  applyAction, cardBonus, runTerrainAction, combatMoves, combatTurn, createGame, legalActions, Rng, startCombat, testModifier, worldView,
  type GameState,
} from '../src/index';
import { onMap } from './helpers';

const make = (race: RaceId, profession: ProfessionId, seed = 'cards'): GameState =>
  onMap(createGame(seed, { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race, profession, bonus: { com: 10 }, missions: ['hunter'] } }]));

describe('skill cards (level 1)', () => {
  it('every hero starts with its 3 level-1 cards', () => {
    expect(make('humans', 'warrior').players[0]!.character.cards).toEqual(['warrior-veteran', 'warrior-heavy-swing', 'warrior-rations']);
  });

  it('Strongman gives +10 to Strength tests only', () => {
    const g = make('flintborn', 'cavedelver');
    const p = g.players[0]!;
    expect(cardBonus(worldView(g), p, 'str')).toBe(10);
    expect(cardBonus(worldView(g), p, 'dex')).toBe(0);
  });

  it('Water-born gives +10 to everything on or next to water', () => {
    const g = make('myrmids', 'diver');
    const p = g.players[0]!;
    const water = g.map.cells.find((c) => c.terrain === 'river' || c.terrain === 'lake');
    const dry = g.map.cells.find((c) => c.terrain === 'desert' || c.terrain === 'fields');
    if (water) {
      p.position = water.index;
      expect(cardBonus(worldView(g), p, 'dex')).toBe(10);
    }
    const w = worldView(g);
    if (dry && !w.near(dry.index).some((n) => ['river', 'lake'].includes(w.terrainAt(n)))) {
      p.position = dry.index;
      expect(cardBonus(w, p, 'dex')).toBe(0);
    }
  });

  it('Heavy Swing attacks at -10 Combat for +4 damage', () => {
    const g = make('humans', 'warrior');
    const p = g.players[0]!;
    const combat = startCombat(worldView(g), ['bear']);
    expect(combatMoves(p, combat).some((m) => m.move === 'card' && m.card === 'warrior-heavy-swing')).toBe(true);
    const { events } = combatTurn(worldView(g), p, combat, { move: 'card', card: 'warrior-heavy-swing', target: 'bear-1' }, new Rng(5));
    const strike = events.find((e) => e.type === 'strike' && e.by === 'hero');
    expect(strike && strike.type === 'strike' && strike.card).toBe('warrior-heavy-swing');
    expect(strike && strike.type === 'strike' && strike.result.target).toBe(p.character.attributes.com + testModifier(worldView(g), p, 'com', -10));
  });

  it('Battle Rations: 3 per game, food plus +5 Combat and Strength for the round', () => {
    let g = make('humans', 'warrior');
    const food = g.players[0]!.character.food;
    for (let i = 0; i < 3; i++) g = applyAction(g, 'p', { type: 'card', card: 'warrior-rations' });
    const p = g.players[0]!;
    expect(p.character.food).toBe(food + 3);
    expect(testModifier(worldView(g), p, 'com')).toBeGreaterThanOrEqual(15);
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'warrior-rations')).toBe(false);
  });

  it('Haste: +1 Speed, then the card waits for the next camp', () => {
    let g = make('keepers', 'wraith');
    const speed = g.players[0]!.speedLeft;
    g = applyAction(g, 'p', { type: 'card', card: 'wraith-haste' });
    expect(g.players[0]!.speedLeft).toBe(speed + 1);
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'wraith-haste')).toBe(false);
  });

  it('Sacred Tree Leaves heal 4 and clear conditions for 1 Stamina', () => {
    let g = make('keepers', 'wraith');
    const p = g.players[0]!;
    p.character.vitality -= 6;
    p.conditions.push({ id: 'poison', name: { pl: 'x', en: 'x' }, test: 'str', modifier: 0, worsen: 0, each: [] });
    const before = { vit: p.character.vitality, sta: p.staminaLeft };
    g = applyAction(g, 'p', { type: 'card', card: 'wraith-leaves' });
    expect(g.players[0]!.character.vitality).toBe(before.vit + 4);
    expect(g.players[0]!.staminaLeft).toBe(before.sta - 1);
    expect(g.players[0]!.conditions).toEqual([]);
  });

  it('Barrier: when it stands, a blow must pass a Strength test and then deals half', () => {
    const g = make('sunborn', 'mystic');
    const p = g.players[0]!;
    const combat = startCombat(worldView(g), ['bear']);
    combat.barrier = true;
    let seen = false;
    for (let seed = 1; seed < 200 && !seen; seed++) {
      const c = structuredClone(combat);
      const a = structuredClone(p);
      const { events } = combatTurn(worldView(g), a, c, { move: 'focus' }, new Rng(seed));
      const blow = events.find((e) => e.type === 'strike' && e.by !== 'hero' && e.result.success && (e.damage !== undefined || e.blocked));
      if (blow && blow.type === 'strike') {
        expect(blow.barrier).toBeDefined();
        expect(c.barrier).toBe(false);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('Whirling Axe swings at up to 3 foes, each may dodge', () => {
    const g = make('flintborn', 'cavedelver');
    const p = g.players[0]!;
    const combat = startCombat(worldView(g), ['wolf', 'wolf', 'wolf', 'wolf']);
    const { events } = combatTurn(worldView(g), p, combat, { move: 'card', card: 'cavedelver-whirling-axe', target: 'wolf-1' }, new Rng(3));
    const targets = new Set(events.flatMap((e) => (e.type === 'strike' && e.by === 'hero' ? [e.target] : [])));
    expect(targets.size).toBe(3);
  });

  it('Researcher: camping with 1 more Stamina gives +1 Intelligence for good', () => {
    let g = make('sunborn', 'mystic');
    const study = legalActions(g, 'p').find((a) => a.type === 'camp' && a.research);
    if (!study) return; // the start fragment may not allow camping
    const int = g.players[0]!.character.attributes.int;
    g = applyAction(g, 'p', study);
    expect(g.players[0]!.character.attributes.int).toBe(int + 1);
  });

  it('a trap set on a fragment hurts foes that fight there', () => {
    let g = make('nomads', 'trapper');
    const move = legalActions(g, 'p').find((a) => a.type === 'move')!;
    g = applyAction(g, 'p', move);
    if (g.players[0]!.combat || g.players[0]!.pendingEvent) return;
    g = applyAction(g, 'p', { type: 'card', card: 'trapper-trap' });
    expect(g.players[0]!.counters[`trap:${g.players[0]!.position}`]).toBe(1);
  });

  it('Hunter: every failed hunt is rolled again once, with no limit per camp', () => {
    const g = make('nomads', 'trapper');
    const p = g.players[0]!;
    p.position = g.map.cells.find((c) => c.terrain === 'forest')!.index;
    let rerolls = 0;
    for (let seed = 1; seed < 60; seed++) {
      p.staminaLeft = 3;
      const out = runTerrainAction(worldView(g), p, 'hunt', new Rng(seed));
      if (out.type === 'test' && out.rerolled === 'trapper-hunter') {
        rerolls++;
        // The result keeps the failed first throw, so the player sees both.
        expect(out.result.rerolled).toBe('trapper-hunter');
        expect(out.result.first).toBeGreaterThan(out.result.target);
      }
    }
    expect(rerolls).toBeGreaterThan(1);
  });

  it('Fish: a failed hunt is rolled again once on water only', () => {
    const g = make('myrmids', 'diver');
    const p = g.players[0]!;
    const count = (terrain: string) => {
      const cell = g.map.cells.find((c) => c.terrain === terrain);
      if (!cell) return null;
      p.position = cell.index;
      let rerolls = 0;
      for (let seed = 1; seed < 60; seed++) {
        p.staminaLeft = 3;
        const out = runTerrainAction(worldView(g), p, 'hunt', new Rng(seed));
        if (out.type === 'test' && out.rerolled === 'diver-fish') rerolls++;
      }
      return rerolls;
    };
    const wet = count('river') ?? count('lake');
    if (wet !== null) expect(wet).toBeGreaterThan(0);
    expect(count('forest')).toBe(0);
  });

  it('Set a Trap in a fight: takes the round, springs next round, a caught foe loses 4 and skips its attack', () => {
    const g = make('nomads', 'trapper');
    const p = g.players[0]!;
    let seen = false;
    for (let seed = 1; seed < 80 && !seen; seed++) {
      const c = startCombat(worldView(g), ['wolf']);
      const a = structuredClone(p);
      a.character.vitality = 99;
      const first = combatTurn(worldView(g), a, c, { move: 'card', card: 'trapper-trap' }, new Rng(seed));
      expect(first.events.some((e) => e.type === 'strike' && e.by === 'hero')).toBe(false);
      expect(c.trap).toBe(true);
      expect(combatMoves(a, c).some((m) => m.move === 'card' && m.card === 'trapper-trap')).toBe(false);
      const before = c.foes[0]!.vitality;
      const second = combatTurn(worldView(g), a, c, { move: 'focus' }, new Rng(seed + 1000));
      const trap = second.events.find((e) => e.type === 'trap');
      expect(trap).toBeDefined();
      expect(c.trap).toBe(false);
      if (trap && trap.type === 'trap' && !trap.result.success) {
        expect(c.foes[0]!.vitality).toBe(before - 4);
        expect(second.events.some((e) => e.type === 'strike' && e.by !== 'hero')).toBe(false);
        expect(second.events.some((e) => e.type === 'stunned' && e.who === c.foes[0]!.uid)).toBe(true);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });
});
