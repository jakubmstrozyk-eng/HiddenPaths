import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, BOUNTY_CARD_BASE, MAX_QUESTS, QUEST_BY_ID, QUIET_CARD, TOWN_EVENTS, isTownCard } from '@hp/content';
import {
  TOWN_EVENT_ROUNDS, applyAction, boardPostings, createGame, currentPlayer, eventDueHere, landAt, legalActions, neighbours, offeredQuests,
  questProgress, startCombat, worldView,
  type CharacterInput, type GameConfig, type GameState,
} from '../src';
import { onMap } from './helpers';

const hero: CharacterInput = { name: 'Ara', race: 'keepers', profession: 'wraith', bonus: {}, missions: ['hunter'] };
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };

/** The hero next to a fragment turned into `place`, with plenty of Speed. */
function beside(seed: string, place: 'city' | 'village' | 'inn' | 'monument'): { state: GameState; from: number; to: number } {
  const state = onMap(createGame(seed, solo, [{ id: 'p1', character: hero }]));
  const p = currentPlayer(state);
  const from = p.position;
  const to = neighbours(state.map, from).find((n) => landAt(state.map, n) !== 'core')!;
  (state.map.cells[to] as { terrain: string }).terrain = place;
  p.speedLeft = 10;
  p.staminaLeft = 10;
  return { state, from, to };
}

describe('town events (Jacob, 2026-11-28)', () => {
  it('a city, village or inn waits for the first action, then draws from the town deck or the quiet card', () => {
    let town = 0;
    let quiet = 0;
    for (let i = 0; i < 40; i++) {
      const { state, to } = beside(`town-${i}`, i % 3 === 0 ? 'inn' : i % 3 === 1 ? 'village' : 'city');
      let s = applyAction(state, 'p1', { type: 'move', to });
      expect(currentPlayer(s).pendingEvent).toBeNull();
      expect(eventDueHere(currentPlayer(s))).toBe(true);
      s = applyAction(s, 'p1', { type: 'service', service: 'gossip' });
      const card = currentPlayer(s).pendingEvent?.card;
      expect(card).toBeDefined();
      if (card === QUIET_CARD) quiet++;
      else {
        expect(isTownCard(card!)).toBe(true);
        const terrains = TOWN_EVENTS.find((e) => e.id === card)!.terrains!;
        expect(terrains).toContain(landAt(s.map, to));
        town++;
      }
    }
    expect(town).toBeGreaterThan(quiet);
    expect(quiet).toBeGreaterThan(0);
  });

  it('walking through a town or ending the round there draws nothing', () => {
    const { state, from, to } = beside('pass', 'village');
    let s = applyAction(state, 'p1', { type: 'move', to });
    s = applyAction(s, 'p1', { type: 'move', to: from });
    expect(currentPlayer(s).position).toBe(from);
    expect(currentPlayer(s).pendingEvent).toBeNull();
    const again = applyAction(applyAction(state, 'p1', { type: 'move', to }), 'p1', { type: 'endTurn' });
    expect(again.round).toBe(state.round + 1);
    expect(again.log.some((e) => e.type === 'eventDrawn')).toBe(false);
  });

  it('the same town gives a card at most once in a few rounds', () => {
    const { state, from, to } = beside('cool', 'city');
    let s = applyAction(state, 'p1', { type: 'move', to });
    s = applyAction(s, 'p1', { type: 'service', service: 'gossip' });
    currentPlayer(s).pendingEvent = null;
    s = applyAction(s, 'p1', { type: 'move', to: from });
    s = applyAction(s, 'p1', { type: 'move', to });
    expect(eventDueHere(currentPlayer(s))).toBe(false);
    currentPlayer(s).counters[`townEvent:${to}`] = s.round - TOWN_EVENT_ROUNDS;
    s = applyAction(s, 'p1', { type: 'move', to: from });
    s = applyAction(s, 'p1', { type: 'move', to });
    expect(eventDueHere(currentPlayer(s))).toBe(true);
  });

  it('a monument draws from the fragments\' deck after meditating', () => {
    const { state, to } = beside('mon', 'monument');
    let s = applyAction(state, 'p1', { type: 'move', to });
    expect(eventDueHere(currentPlayer(s))).toBe(true);
    s = applyAction(s, 'p1', { type: 'terrain', action: 'meditate' });
    const card = currentPlayer(s).pendingEvent?.card ?? null;
    expect(card === QUIET_CARD || (card !== null && card < 600) || !!currentPlayer(s).combat).toBe(true);
  });
});

describe('notice boards', () => {
  it('a city posts 4 quests with a hard one, a village 2, the same for every look', () => {
    const { state, to } = beside('board', 'city');
    const city = boardPostings(state, to);
    expect(city).toHaveLength(BOARD_SIZE.city);
    expect(city.some((q) => QUEST_BY_ID[q.id]!.hard)).toBe(true);
    expect(boardPostings(state, to)).toEqual(city);
    (state.map.cells[to] as { terrain: string }).terrain = 'village';
    expect(boardPostings(state, to)).toHaveLength(BOARD_SIZE.village);
    (state.map.cells[to] as { terrain: string }).terrain = 'inn';
    expect(boardPostings(state, to)).toHaveLength(0);
  });

  it('a quest is taken at the board, leaves it, and pays XP and gold when handed in', () => {
    const { state, to } = beside('quest', 'city');
    let s = applyAction(state, 'p1', { type: 'move', to });
    currentPlayer(s).eventDue = null;
    const posting = offeredQuests(s, currentPlayer(s))[0]!;
    expect(legalActions(s, 'p1')).toContainEqual({ type: 'quest', op: 'take', id: posting.id });
    s = applyAction(s, 'p1', { type: 'quest', op: 'take', id: posting.id });
    const me = currentPlayer(s);
    expect(me.quests).toHaveLength(1);
    expect(boardPostings(s, to).map((p) => p.id)).not.toContain(posting.id);
    // Finish it by hand and hand it in.
    const q = me.quests![0]!;
    q.have = q.need;
    q.done = true;
    const t = QUEST_BY_ID[q.id]!;
    if (t.kind === 'bring') {
      if (t.what === 'food') me.character.food += q.need;
      else if (t.what === 'herb' || t.what === 'lifeLeaf') me.inventory.herbs[t.what === 'herb' ? 'forestHerb' : 'lifeLeaf'] = q.need;
      else me.inventory.materials[t.what === 'ore' ? 'iron' : t.what === 'rareOre' ? 'silver' : 'wood'] = q.need;
    }
    expect(questProgress(me, q).ready).toBe(true);
    const gold = me.character.gold;
    const xp = me.character.xp;
    s = applyAction(s, 'p1', { type: 'quest', op: 'handIn', id: q.uid });
    const after = currentPlayer(s);
    expect(after.quests).toHaveLength(0);
    expect(after.character.gold).toBe(gold + t.gold);
    expect(after.character.xp).toBe(xp + t.xp);
    if (t.item) expect(after.inventory.items).toContain(t.item);
  });

  it('scouting counts the fragments around the town that the hero stood on', () => {
    for (let i = 0; i < 60; i++) {
      const { state, to } = beside(`scout-${i}`, 'village');
      const scout = boardPostings(state, to).find((p) => p.id === 'scout');
      if (!scout) continue;
      let s = applyAction(state, 'p1', { type: 'move', to });
      currentPlayer(s).eventDue = null;
      s = applyAction(s, 'p1', { type: 'quest', op: 'take', id: 'scout' });
      const q = currentPlayer(s).quests![0]!;
      expect(q.need).toBe(q.cells!.length);
      for (const cell of q.cells!) {
        const me = currentPlayer(s);
        me.position = to;
        me.speedLeft = 10;
        me.staminaLeft = 10;
        me.pendingEvent = null;
        me.eventDue = null;
        if (me.combat) me.combat = null;
        s = applyAction(s, 'p1', { type: 'move', to: cell });
      }
      expect(questProgress(currentPlayer(s), currentPlayer(s).quests![0]!).ready).toBe(true);
      expect(s.log.some((e) => e.type === 'quest' && e.what === 'ready')).toBe(true);
      return;
    }
    throw new Error('no village posted a scouting quest');
  });

  it('a bounty starts its fight on the marked fragment and a win makes it ready', () => {
    const { state, to } = beside('bounty', 'city');
    const me = currentPlayer(state);
    me.quests = [{ uid: 'x', id: 'bandits', town: to, need: 1, have: 0, target: to }];
    let s = applyAction(state, 'p1', { type: 'move', to });
    expect(currentPlayer(s).pendingEvent?.card).toBe(BOUNTY_CARD_BASE);
    s = applyAction(s, 'p1', { type: 'event', option: 0 });
    const p = currentPlayer(s);
    expect(p.combat).toBeTruthy();
    // Win at once: knock every foe out and strike.
    for (const f of p.combat!.foes) f.vitality = 0;
    const move = legalActions(s, 'p1')[0]!;
    s = applyAction(s, 'p1', move);
    expect(currentPlayer(s).combat).toBeNull();
    expect(currentPlayer(s).quests![0]!.done).toBe(true);
    void startCombat; void worldView;
  });

  it(`a hero carries at most ${MAX_QUESTS} quests`, () => {
    const { state, to } = beside('max', 'city');
    let s = applyAction(state, 'p1', { type: 'move', to });
    currentPlayer(s).eventDue = null;
    for (let i = 0; i < MAX_QUESTS; i++) {
      const id = offeredQuests(s, currentPlayer(s))[0]!.id;
      s = applyAction(s, 'p1', { type: 'quest', op: 'take', id });
      currentPlayer(s).pendingEvent = null;
    }
    expect(legalActions(s, 'p1').some((a) => a.type === 'quest' && a.op === 'take')).toBe(false);
    const drop = currentPlayer(s).quests![0]!.uid;
    s = applyAction(s, 'p1', { type: 'quest', op: 'drop', id: drop });
    expect(currentPlayer(s).quests).toHaveLength(MAX_QUESTS - 1);
  });
});
