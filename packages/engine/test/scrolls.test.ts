import { describe, expect, it } from 'vitest';
import {
  applyAction, combatMoves, combatTurn, createGame, legalActions, missionProgress, Rng, startCombat, teleportTargets, worldView,
  type GameState,
} from '../src/index';
import { onMap } from './helpers';

const make = (): GameState =>
  onMap(createGame('scrolls', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 20 }, missions: ['magician', 'scout'] } }]));

describe('magic scrolls', () => {
  it('the Mystic sells scrolls in a city only', () => {
    const g = make();
    const p = g.players[0]!;
    p.character.gold = 50;
    const city = g.map.cells.find((c) => c.terrain === 'city');
    const village = g.map.cells.find((c) => c.terrain === 'village');
    if (village) {
      p.position = village.index;
      expect(legalActions(g, 'p').some((a) => a.type === 'buy' && a.item === 'scrollHeal')).toBe(false);
    }
    if (city) {
      p.position = city.index;
      expect(legalActions(g, 'p').some((a) => a.type === 'buy' && a.item === 'scrollHeal')).toBe(true);
    }
  });

  it('Healing heals in full; one scroll a round; it counts for the Magician', () => {
    let g = make();
    const p = g.players[0]!;
    p.inventory.items.push('scrollHeal', 'scrollRenewal');
    p.character.vitality = 3;
    g = applyAction(g, 'p', { type: 'scroll', item: 'scrollHeal' });
    const me = g.players[0]!;
    expect(me.character.vitality).toBe(me.character.maxVitality);
    expect(me.inventory.items).toEqual(['scrollRenewal']);
    expect(legalActions(g, 'p').some((a) => a.type === 'scroll')).toBe(false);
    expect(missionProgress(g, me, 'magician').count).toBe(1);
  });

  it('Teleport takes the hero up to 2 fragments away', () => {
    let g = make();
    const p = g.players[0]!;
    p.inventory.items.push('scrollTeleport');
    const targets = teleportTargets(worldView(g), p.position);
    expect(targets.length).toBeGreaterThan(4);
    const to = targets[targets.length - 1]!;
    g = applyAction(g, 'p', { type: 'scroll', item: 'scrollTeleport', to });
    expect(g.players[0]!.position).toBe(to);
    expect(g.players[0]!.revealed).toContain(to);
  });

  it('Fire bolt: a magic Combat strike in a fight; a burning foe loses 1 a round', () => {
    const g = make();
    const p = g.players[0]!;
    let seen = false;
    for (let seed = 1; seed < 100 && !seen; seed++) {
      const a = structuredClone(p);
      a.inventory.items.push('scrollFire');
      a.character.vitality = 99;
      const c = startCombat(worldView(g), ['bear']);
      expect(combatMoves(a, c).some((m) => m.move === 'scroll' && m.item === 'scrollFire')).toBe(true);
      const { events } = combatTurn(worldView(g), a, c, { move: 'scroll', item: 'scrollFire', target: 'bear-1' }, new Rng(seed));
      const strike = events.find((e) => e.type === 'strike' && e.by === 'hero');
      expect(strike && strike.type === 'strike' && strike.scroll).toBe('scrollFire');
      expect(a.inventory.items.includes('scrollFire')).toBe(false);
      if (strike && strike.type === 'strike' && strike.damage !== undefined) {
        expect(events.some((e) => e.type === 'burn')).toBe(true);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('Lightning: power S+2; a foe hit tests Strength and is stunned for a round on a failure', () => {
    const g = make();
    let stunned = false;
    for (let seed = 1; seed < 200 && !stunned; seed++) {
      const a = structuredClone(g.players[0]!);
      a.inventory.items.push('scrollLightning');
      a.character.vitality = 99;
      const c = startCombat(worldView(g), ['bear']);
      const { events } = combatTurn(worldView(g), a, c, { move: 'scroll', item: 'scrollLightning', target: 'bear-1' }, new Rng(seed));
      const shock = events.find((e) => e.type === 'shock');
      if (shock && shock.type === 'shock' && shock.stunned) {
        // The stunned bear loses its next attack.
        if (c.foes[0]!.vitality <= 0) continue;
        const next = combatTurn(worldView(g), a, c, { move: 'focus' }, new Rng(seed + 1));
        expect(next.events.some((e) => e.type === 'stunned' && e.who === 'bear-1')).toBe(true);
        expect(next.events.some((e) => e.type === 'strike' && e.by === 'bear-1')).toBe(false);
        stunned = true;
      }
    }
    expect(stunned).toBe(true);
  });
});
