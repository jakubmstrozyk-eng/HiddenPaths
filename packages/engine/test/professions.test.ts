import { describe, expect, it } from 'vitest';
import { EVENTS, PROFESSIONS, type ProfessionId, type RaceId } from '@hp/content';
import {
  applyAction, combatMoves, combatTurn, createGame, heroArmour, heroTest, legalActions, Rng, runTerrainAction, startCombat, testModifier, worldView,
  type GameState,
} from '../src/index';
import { onMap } from './helpers';

const make = (race: RaceId, profession: ProfessionId, seed = 'profs'): GameState =>
  onMap(createGame(seed, { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race, profession, bonus: { com: 10 }, missions: ['hunter'] } }]));

const at = (g: GameState, terrain: string) => {
  const cell = g.map.cells.find((c) => c.terrain === terrain);
  if (cell) g.players[0]!.position = cell.index;
  return !!cell;
};

describe('the six professions added after the MVP', () => {
  it('every profession of every race is playable with 3 level-1 cards', () => {
    for (const prof of Object.values(PROFESSIONS)) {
      expect(prof.mvp).toBe(true);
      const g = make(prof.race, prof.id);
      expect(g.players[0]!.character.cards).toHaveLength(3);
    }
  });

  it('Elder · Wisdom of Ages: every failed Intelligence test is thrown again once', () => {
    const g = make('nomads', 'elder');
    const p = g.players[0]!;
    p.character.attributes.int = 2;
    let rerolled = 0;
    for (let seed = 1; seed < 20; seed++) if (heroTest(worldView(g), p, 'int', new Rng(seed)).rerolled === 'elder-wisdom') rerolled++;
    expect(rerolled).toBeGreaterThan(1);
  });

  it('Elder · Close to Nature: 1 Stamina for +10 to the next test only, renewed at camp', () => {
    let g = make('nomads', 'elder');
    const sta = g.players[0]!.staminaLeft;
    const base = testModifier(worldView(g), g.players[0]!, 'dex');
    g = applyAction(g, 'p', { type: 'card', card: 'elder-nature' });
    const p = g.players[0]!;
    expect(p.staminaLeft).toBe(sta - 1);
    expect(testModifier(worldView(g), p, 'dex')).toBe(base + 10);
    heroTest(worldView(g), p, 'dex', new Rng(1));
    expect(testModifier(worldView(g), p, 'dex')).toBe(base);
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'elder-nature')).toBe(false);
  });

  it('Elder · Healing Herb: +2 Vitality and poison cured, then waits for camp', () => {
    let g = make('nomads', 'elder');
    const p = g.players[0]!;
    p.character.vitality -= 5;
    p.conditions.push({ id: 'poison', name: { pl: 'x', en: 'x' }, test: 'str', modifier: 0, worsen: 0, each: [] });
    const vit = p.character.vitality;
    const sta = p.staminaLeft;
    g = applyAction(g, 'p', { type: 'card', card: 'elder-herb' });
    expect(g.players[0]!.character.vitality).toBe(vit + 2);
    expect(g.players[0]!.staminaLeft).toBe(sta - 1);
    expect(g.players[0]!.conditions).toEqual([]);
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'elder-herb')).toBe(false);
  });

  it('Myrmids prepare food; a Gourmet seasons it, and eating it gives +2 to all and +5 to the spice', () => {
    let g = make('myrmids', 'gourmet');
    const p = g.players[0]!;
    p.character.attributes.dex = 99;
    const seasons = legalActions(g, 'p').filter((a) => a.type === 'cook');
    expect(seasons.length).toBe(7); // plain, or seasoned with one of 6 attributes
    g = applyAction(g, 'p', { type: 'cook', spice: 'str' });
    expect(g.players[0]!.meals).toEqual([{ kind: 'prepared', spice: 'str' }]);
    // One seasoning a round.
    expect(legalActions(g, 'p').some((a) => a.type === 'cook' && a.spice)).toBe(false);
    g = applyAction(g, 'p', { type: 'eat' });
    const me = g.players[0]!;
    expect(me.meals).toEqual([]);
    const effects = me.effects.filter((e) => e.untilRound >= g.round);
    expect(effects.some((e) => e.attribute === 'all' && e.amount === 2)).toBe(true);
    expect(effects.some((e) => e.attribute === 'str' && e.amount === 5)).toBe(true);
  });

  it('Gourmet · Healing Stew: a stew eaten while hurt heals 2', () => {
    let g = make('myrmids', 'gourmet');
    g.players[0]!.character.attributes.int = 99;
    g = applyAction(g, 'p', { type: 'card', card: 'gourmet-stew' });
    expect(g.players[0]!.meals).toEqual([{ kind: 'stew' }]);
    g.players[0]!.character.vitality -= 4;
    const vit = g.players[0]!.character.vitality;
    g = applyAction(g, 'p', { type: 'eat' });
    expect(g.players[0]!.character.vitality).toBeGreaterThanOrEqual(vit + 2);
  });

  it('Explorer · Traveller: the second new fragment in a turn gives +1 XP', () => {
    let g = make('humans', 'explorer');
    for (let i = 0; i < 2; i++) {
      const move = legalActions(g, 'p').find((a) => a.type === 'move' && !g.players[0]!.revealed.includes(a.to));
      if (!move || g.players[0]!.pendingEvent || g.players[0]!.combat) return;
      g = applyAction(g, 'p', move);
    }
    expect(g.log.some((e) => e.type === 'card' && e.card === 'explorer-traveller')).toBe(true);
  });

  it('Explorer · Bandages: 1 Stamina for +2 Vitality', () => {
    let g = make('humans', 'explorer');
    const p = g.players[0]!;
    p.character.vitality -= 4;
    const before = { vit: p.character.vitality, sta: p.staminaLeft };
    g = applyAction(g, 'p', { type: 'card', card: 'explorer-bandages' });
    expect(g.players[0]!.character.vitality).toBe(before.vit + 2);
    expect(g.players[0]!.staminaLeft).toBe(before.sta - 1);
  });

  it('Explorer · Disarm: only armed foes; a disarmed foe spends its turn on getting the weapon back', () => {
    const g = make('humans', 'explorer');
    const p = g.players[0]!;
    expect(combatMoves(p, startCombat(worldView(g), ['wolf'])).some((m) => m.move === 'card' && m.card === 'explorer-disarm')).toBe(false);
    // Only a hand weapon can be knocked away: not a bow, claws or a spell.
    for (const foe of ['nomadWarrior', 'witch', 'bear']) {
      expect(combatMoves(p, startCombat(worldView(g), [foe])).some((m) => m.move === 'card' && m.card === 'explorer-disarm')).toBe(false);
    }
    expect(combatMoves(p, startCombat(worldView(g), ['imp'])).some((m) => m.move === 'card' && m.card === 'explorer-disarm')).toBe(true);
    let seen = false;
    for (let seed = 1; seed < 200 && !seen; seed++) {
      const c = startCombat(worldView(g), ['bandit']);
      const a = structuredClone(p);
      a.character.vitality = 99;
      const { events } = combatTurn(worldView(g), a, c, { move: 'card', card: 'explorer-disarm', target: 'bandit-1' }, new Rng(seed));
      const disarm = events.find((e) => e.type === 'disarm');
      if (disarm && disarm.type === 'disarm' && !disarm.kept && c.foes[0]!.vitality > 0) {
        expect(c.foes[0]!.disarmed).toBe(true);
        const next = combatTurn(worldView(g), a, c, { move: 'focus' }, new Rng(seed + 500));
        expect(next.events.some((e) => e.type === 'rearm')).toBe(true);
        expect(next.events.some((e) => e.type === 'strike' && e.by === 'bandit-1')).toBe(false);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('Guardian · Hard Hide: +1 on every part of the body', () => {
    const g = make('sunborn', 'guardian');
    const armour = heroArmour(g.players[0]!);
    expect(armour.head).toBe(1);
    expect(armour.torso).toBe(2); // leather jerkin 1 + hide 1
  });

  it('Guardian · Defensive Stance blocks every blow of the round, once a fight; Riposte answers each attack', () => {
    const g = make('sunborn', 'guardian');
    const p = g.players[0]!;
    const c = startCombat(worldView(g), ['wolf', 'wolf']);
    const vit = p.character.vitality;
    const { events } = combatTurn(worldView(g), p, c, { move: 'card', card: 'guardian-stance' }, new Rng(9));
    expect(p.character.vitality).toBe(vit);
    expect(events.filter((e) => e.type === 'strike' && e.card === 'guardian-riposte').length).toBeGreaterThan(0);
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'guardian-stance')).toBe(false);
  });

  it('Druid · Herbalist: +20 to gathering herbs and fruit', () => {
    const g = make('keepers', 'druid');
    const p = g.players[0]!;
    if (!at(g, 'forest')) return;
    p.staminaLeft = 3;
    const out = runTerrainAction(worldView(g), p, 'gather', new Rng(1));
    expect(out.result.target).toBe(p.character.attributes.int + testModifier(worldView(g), p, 'int', 30));
  });

  it('Druid · Companion: a weak beast is tamed, fights beside the hero and is bound after 3 passes', () => {
    let g = make('keepers', 'druid');
    const p = g.players[0]!;
    p.character.attributes.cha = 99;
    const c = startCombat(worldView(g), ['wolf', 'bandit']);
    c.foes[0]!.vitality = 5;
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'druid-companion' && m.target === 'wolf-1')).toBe(true);
    combatTurn(worldView(g), p, c, { move: 'card', card: 'druid-companion', target: 'wolf-1' }, new Rng(2));
    expect(p.companions).toHaveLength(1);
    expect(c.foes[0]!.tamed).toBe(true);
    const next = combatTurn(worldView(g), p, c, { move: 'attack', target: 'bandit-2' }, new Rng(3));
    expect(next.events.some((e) => e.type === 'strike' && e.by === p.companions![0]?.uid)).toBe(true);
    // The bond is tested at the start of each of the Druid's turns.
    p.combat = null;
    for (let i = 0; i < 2; i++) g = applyAction(g, 'p', { type: 'endTurn' });
    expect(g.players[0]!.companions?.[0]?.tame).toBe(true);
  });

  it('Runemaster · Empowered Weapon: +2 damage for 3 rounds, renews at camp', () => {
    let g = make('flintborn', 'runemaster');
    const sta = g.players[0]!.staminaLeft;
    g = applyAction(g, 'p', { type: 'card', card: 'runemaster-empower' });
    expect(g.players[0]!.staminaLeft).toBe(sta - 1);
    const e = g.players[0]!.effects.find((x) => x.id === 'empower')!;
    expect(e.amount).toBe(2);
    expect(e.untilRound).toBe(g.round + 2);
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'runemaster-empower')).toBe(false);
  });

  it('quick skill cards can be played during an event, before it is answered; the rest wait', () => {
    let g = make('flintborn', 'runemaster');
    const p = g.players[0]!;
    p.character.cards.push('elder-nature', 'trapper-tannery');
    p.counters.hides = 5;
    p.pendingEvent = { card: EVENTS[0]!.id, step: 'start' };
    const cards = legalActions(g, 'p').flatMap((a) => (a.type === 'card' ? [a.card] : []));
    expect(cards).toContain('runemaster-empower');
    expect(cards).toContain('elder-nature');
    expect(cards).not.toContain('trapper-tannery');
    expect(() => applyAction(g, 'p', { type: 'card', card: 'trapper-tannery' })).toThrow();
    g = applyAction(g, 'p', { type: 'card', card: 'runemaster-empower' });
    expect(g.players[0]!.pendingEvent).toBeTruthy();
    expect(g.players[0]!.effects.some((e) => e.id === 'empower')).toBe(true);
    // In a fight the map version is not offered: the card is a combat move there.
    const q = g.players[0]!;
    q.pendingEvent = null;
    q.combat = startCombat(worldView(g), ['wolf']);
    expect(() => applyAction(g, 'p', { type: 'card', card: 'elder-nature' })).toThrow();
  });

  it('Runemaster · Vise: a failed mining test is thrown again', () => {
    const g = make('flintborn', 'runemaster');
    const p = g.players[0]!;
    if (!at(g, 'mountains') && !at(g, 'forest')) return;
    let rerolls = 0;
    for (let seed = 1; seed < 60; seed++) {
      p.staminaLeft = 3;
      const out = runTerrainAction(worldView(g), p, 'mine', new Rng(seed));
      if (out.rerolled === 'runemaster-vise') rerolls++;
    }
    expect(rerolls).toBeGreaterThan(0);
  });

  it('Runemaster · Smelting: 3 pieces of gear in a city become iron ore', () => {
    let g = make('flintborn', 'runemaster');
    const p = g.players[0]!;
    if (!at(g, 'city')) return;
    p.inventory.items.push('dagger', 'shortSword', 'leather-head');
    expect(legalActions(g, 'p').some((a) => a.type === 'smelt')).toBe(true);
    g = applyAction(g, 'p', { type: 'smelt', into: 'ore' });
    expect(g.players[0]!.inventory.items).toEqual([]);
    expect(g.players[0]!.inventory.materials.iron).toBe(1);
  });
});
