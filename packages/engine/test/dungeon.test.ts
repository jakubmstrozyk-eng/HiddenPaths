import { describe, expect, it } from 'vitest';
import { DUNGEON_CARDS, DUNGEON_LENGTH, EVENT_BY_ID, ITEMS, ENEMIES, isDungeonCard } from '@hp/content';
import { applyAction, createGame, legalActions, type GameState, type SizePreset } from '../src';

const SIZES: SizePreset[] = ['short', 'medium', 'long', 'epic'];

const game = (size: SizePreset = 'medium', seed = 'dungeon', players = 1): GameState => {
  const g = createGame(seed, { size, difficulty: 'normal', winMode: 'exploration', multiplayer: players > 1 },
    Array.from({ length: players }, (_, i) => ({ id: `p${i}`, character: { name: 'A', race: 'humans' as const, profession: 'warrior' as const, bonus: { com: 10 }, missions: ['hunter', 'scout'] } })));
  // Stand everyone on the entrance with plenty of Speed and Stamina.
  for (const p of g.players) {
    p.position = p.start = p.respawnAt = g.dungeon!.cell;
    p.revealed = [g.dungeon!.cell];
    p.speedLeft = 20;
    p.staminaLeft = 20;
    p.character.vitality = p.character.maxVitality = 200;
    p.character.attributes = { dex: 95, cha: 95, str: 95, wil: 95, int: 95, com: 95 };
  }
  return g;
};

/** Walks the hero through the current card: takes the first choice until the card and any fight are over. */
function finishRoom(g: GameState, id = 'p0'): GameState {
  for (let i = 0; i < 60; i++) {
    const me = g.players.find((p) => p.id === id)!;
    if (!me.pendingEvent && !me.combat) {
      // A fight takes the rest of the round; the tests walk on as if a new round had begun.
      me.speedLeft = 20;
      me.staminaLeft = 20;
      return g;
    }
    const a = legalActions(g, id).find((x) => x.type === 'event' || (x.type === 'combat' && x.move.move === 'attack')) ?? legalActions(g, id).find((x) => x.type === 'combat');
    if (!a) throw new Error('stuck in a room');
    g = applyAction(g, id, a);
  }
  throw new Error('room never ended');
}

const pathLength = (g: GameState) => {
  const d = g.dungeon!;
  let n = 0;
  let room = d.entry[0]!;
  for (;;) {
    n++;
    const r = d.rooms[room]!;
    if (r.kind === 'vault') return n;
    room = r.next.find((x) => d.rooms[x]!.kind !== 'side')!;
  }
};

describe('dungeons', () => {
  it('puts one dungeon on every map, on open ground and not on the outer ring', () => {
    for (const size of SIZES) {
      for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        const g = createGame(seed, { size, difficulty: 'normal', winMode: 'stone', multiplayer: false }, [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]);
        const d = g.dungeon!;
        expect(d).toBeTruthy();
        const cell = g.map.cells[d.cell]!;
        expect(['forest', 'mountains', 'fields', 'river', 'lake', 'desert', 'cave']).toContain(cell.terrain);
        expect(cell.ring).toBeGreaterThanOrEqual(1);
        expect(cell.ring).toBeLessThan(g.map.maxRing);
      }
    }
  });

  it('gives the dungeon 4 to 7 rooms to walk by map size, with one fork', () => {
    SIZES.forEach((size, tier) => {
      const g = game(size);
      expect(pathLength(g)).toBe(DUNGEON_LENGTH[tier]);
      const forks = g.dungeon!.rooms.filter((r) => r.next.filter((n) => g.dungeon!.rooms[n]!.kind !== 'side').length > 1).length + (g.dungeon!.entry.length > 1 ? 1 : 0);
      expect(forks).toBe(1);
    });
  });

  it('keeps the same dungeon for the same seed', () => {
    expect(game('long', 'same').dungeon).toEqual(game('long', 'same').dungeon);
  });

  it('has a card for every room, and every foe and relic the cards name exists', () => {
    for (const card of DUNGEON_CARDS) {
      expect(isDungeonCard(card.id)).toBe(true);
      expect(EVENT_BY_ID[card.id]).toBe(card);
      const text = JSON.stringify(card);
      for (const m of text.matchAll(/"enemies":\[([^\]]*)\]/g)) for (const e of JSON.parse(`[${m[1]}]`)) expect(ENEMIES[e], e).toBeTruthy();
      for (const m of text.matchAll(/"do":"item","item":"([^"]+)"/g)) expect(ITEMS[m[1]!], m[1]).toBeTruthy();
    }
  });

  it('offers the way down on the entrance and plays the first room\'s card', () => {
    let g = game();
    const down = legalActions(g, 'p0').filter((a) => a.type === 'dungeon');
    expect(down.length).toBeGreaterThan(0);
    const to = g.dungeon!.entry[0]!;
    g = applyAction(g, 'p0', { type: 'dungeon', to });
    const me = g.players[0]!;
    expect(me.delve).toEqual({ room: to, path: [] });
    expect(me.speedLeft).toBe(19);
    expect(me.staminaLeft).toBe(19);
    expect(me.pendingEvent?.card).toBe(g.dungeon!.rooms[to]!.card);
    expect(g.dungeon!.rooms[to]!.seenBy).toContain('p0');
    // Map actions are closed while below.
    expect(() => applyAction(finishRoom(g), 'p0', { type: 'camp' })).toThrow(/Climb out/);
  });

  it('clears rooms on the way, opens the vault and closes the dungeon behind it', () => {
    let g = game('short', 'walk');
    let room = g.dungeon!.entry[0]!;
    g = finishRoom(applyAction(g, 'p0', { type: 'dungeon', to: room }));
    for (let i = 0; i < 10 && g.dungeon!.rooms[room]!.kind !== 'vault'; i++) {
      expect(g.dungeon!.rooms[room]!.cleared).toBe(true);
      room = g.dungeon!.rooms[room]!.next.find((x) => g.dungeon!.rooms[x]!.kind !== 'side')!;
      g.players[0]!.speedLeft = 20;
      g.players[0]!.staminaLeft = 20;
      g = finishRoom(applyAction(g, 'p0', { type: 'dungeon', to: room }));
      if (!g.players[0]!.delve) throw new Error('the hero left the dungeon');
    }
    expect(g.dungeon!.plundered).toBe(true);
    const items = g.players[0]!.inventory.items;
    expect(items.some((i) => ['ancestorPick', 'silkCloak', 'deepPearl', 'kingScepter', 'riftShard'].includes(i))).toBe(true);
    g = applyAction(g, 'p0', { type: 'dungeon', to: 'exit' });
    expect(g.players[0]!.delve).toBeNull();
    expect(legalActions(g, 'p0').some((a) => a.type === 'dungeon')).toBe(false);
  });

  it('cannot walk on until the room is dealt with, and can walk back the way it came', () => {
    let g = game('medium', 'back');
    const first = g.dungeon!.entry[0]!;
    g = applyAction(g, 'p0', { type: 'dungeon', to: first });
    expect(legalActions(g, 'p0').some((a) => a.type === 'dungeon')).toBe(false);
    g = finishRoom(g);
    const next = g.dungeon!.rooms[first]!.next[0]!;
    g = finishRoom(applyAction(g, 'p0', { type: 'dungeon', to: next }));
    expect(g.players[0]!.delve!.path).toEqual([first]);
    expect(legalActions(g, 'p0')).toContainEqual({ type: 'dungeon', to: first });
    g = applyAction(g, 'p0', { type: 'dungeon', to: first });
    expect(g.players[0]!.delve).toEqual({ room: first, path: [] });
  });

  it('sends a hero who flees back to the room before', () => {
    let g = game('long', 'flee');
    const first = g.dungeon!.entry[0]!;
    g = finishRoom(applyAction(g, 'p0', { type: 'dungeon', to: first }));
    // Find a guard room among the next ones.
    const d = g.dungeon!;
    const target = d.rooms[first]!.next.find((x) => d.rooms[x]!.kind === 'guard');
    if (target === undefined) return;
    g = applyAction(g, 'p0', { type: 'dungeon', to: target });
    expect(g.players[0]!.combat || g.players[0]!.pendingEvent).toBeTruthy();
    if (g.players[0]!.pendingEvent) g = applyAction(g, 'p0', legalActions(g, 'p0').find((a) => a.type === 'event')!);
    const flee = legalActions(g, 'p0').find((a) => a.type === 'combat' && a.move.move === 'flee');
    if (!flee) return;
    for (let i = 0; i < 20 && g.players[0]!.combat; i++) {
      const a = legalActions(g, 'p0').find((x) => x.type === 'combat' && x.move.move === 'flee');
      if (!a) break;
      g = applyAction(g, 'p0', a);
    }
    if (g.players[0]!.combat) return;
    expect(g.players[0]!.delve?.room).toBe(first);
    expect(g.dungeon!.rooms[target]!.cleared).toBe(false);
  });

  it('shares cleared rooms between players and brings a dead hero back out', () => {
    let g = game('medium', 'share', 2);
    const first = g.dungeon!.entry[0]!;
    const me = g.turnOrder[0]!;
    g = finishRoom(applyAction(g, me, { type: 'dungeon', to: first }), me);
    expect(g.dungeon!.rooms[first]!.cleared).toBe(true);
    const p = g.players.find((x) => x.id === me)!;
    p.character.vitality = 0;
    g = applyAction(g, me, { type: 'endTurn' });
    expect(g.players.find((x) => x.id === me)!.delve ?? null).toBeNull();
  });

  it('plays old games without a dungeon', () => {
    const g = game();
    delete g.dungeon;
    expect(legalActions(g, 'p0').some((a) => a.type === 'dungeon')).toBe(false);
  });
});
