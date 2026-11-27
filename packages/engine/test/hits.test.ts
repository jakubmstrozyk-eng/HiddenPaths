import { describe, expect, it } from 'vitest';
import { ENEMIES, HIT_LOCATIONS } from '@hp/content';
import { combatTurn, createGame, heroWeapon, Rng, startCombat, strengthStep, worldView, type CombatEvent, type GameState } from '../src/index';
import { onMap } from './helpers';

const make = (): GameState =>
  onMap(createGame('hits', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'nomads', profession: 'elder', bonus: { com: 10 }, missions: ['hunter', 'scout'] } }]));

type Strike = Extract<CombatEvent, { type: 'strike' }>;

/** The hero's landed blows over many fights against a foe with armour on some spots. */
function heroHits(move: (uid: string) => Parameters<typeof combatTurn>[3], foe = 'youngVoidDemon'): Strike[] {
  const out: Strike[] = [];
  for (let seed = 0; seed < 300; seed++) {
    const g = make();
    const p = g.players[0]!;
    p.character.attributes.com = 90;
    const combat = startCombat(worldView(g), [foe]);
    combat.foes[0]!.vitality = 999;
    const { events } = combatTurn(worldView(g), p, combat, move(combat.foes[0]!.uid), new Rng(seed));
    for (const e of events) if (e.type === 'strike' && e.by === 'hero' && e.damage !== undefined) out.push(e);
  }
  return out;
}

describe('hit location and damage ("Walka!", d. Atak)', () => {
  it('a hit that passed by 20 or more lands where the hero aims; otherwise a k6 picks the spot', () => {
    const hits = heroHits((uid) => ({ move: 'attack', target: uid, aim: 'head' }));
    const aimed = hits.filter((h) => h.result.margin >= 20);
    const rolled = hits.filter((h) => h.result.margin < 20);
    expect(aimed.length).toBeGreaterThan(10);
    expect(rolled.length).toBeGreaterThan(10);
    for (const h of aimed) expect(h).toMatchObject({ aimed: true, location: 'head' });
    for (const h of aimed) expect(h.locationRoll).toBeUndefined();
    for (const h of rolled) {
      expect(h.locationRoll).toBeGreaterThanOrEqual(1);
      expect(h.locationRoll).toBeLessThanOrEqual(6);
      expect(h.location).toBe(HIT_LOCATIONS[h.locationRoll! - 1]);
    }
  });

  it('damage is the weapon strength plus a k6, less the armour on the spot hit', () => {
    const g = make();
    const p = g.players[0]!;
    const weapon = strengthStep(p.character.attributes.str) + heroWeapon(p).power;
    const enemy = ENEMIES.youngVoidDemon!;
    for (const h of heroHits((uid) => ({ move: 'attack', target: uid }))) {
      expect(h.damageRoll).toBeGreaterThanOrEqual(1);
      expect(h.damageRoll).toBeLessThanOrEqual(6);
      expect(h.armour).toBe(enemy.armour[h.location!] ?? 0);
      expect(h.damage).toBe(Math.max(0, weapon + h.damageRoll! - h.armour!));
    }
  });

  it('refuses to aim at a spot that is not on the body', () => {
    const g = make();
    const combat = startCombat(worldView(g), ['wolf']);
    expect(() => combatTurn(worldView(g), g.players[0]!, combat, { move: 'attack', target: combat.foes[0]!.uid, aim: 'tail' as never }, new Rng(1))).toThrow();
  });

  it('every landed blow, the hero\'s and the foes\', carries its k6 for damage and the strength it adds to', () => {
    const g = make();
    const p = g.players[0]!;
    const weapon = strengthStep(p.character.attributes.str) + heroWeapon(p).power;
    for (const h of heroHits((uid) => ({ move: 'attack', target: uid }), 'wolf')) expect(h.strength).toBe(weapon);
    let foeHits = 0;
    for (let seed = 0; seed < 200; seed++) {
      const g2 = make();
      const combat = startCombat(worldView(g2), ['wolf']);
      combat.foes[0]!.vitality = 999;
      const { events } = combatTurn(worldView(g2), g2.players[0]!, combat, { move: 'parry' }, new Rng(seed));
      for (const e of events) {
        if (e.type !== 'strike' || e.by === 'hero' || e.damage === undefined) continue;
        foeHits++;
        expect(e.damageRoll).toBeGreaterThanOrEqual(1);
        expect(e.damageRoll).toBeLessThanOrEqual(6);
        expect(e.damage).toBe(Math.max(0, e.strength! + e.damageRoll! - e.armour!));
        if (e.result.margin < 20) expect(e.locationRoll).toBeGreaterThanOrEqual(1);
        else expect(e.aimed).toBe(true);
      }
    }
    expect(foeHits).toBeGreaterThan(10);
  });
});

describe('the witch\'s drain (Jacob, 2026-11-27)', () => {
  it('one hit does not end the fight, even with little Stamina left from moving', () => {
    for (let seed = 0; seed < 300; seed++) {
      const g = make();
      const p = g.players[0]!;
      p.staminaLeft = 1;
      const combat = startCombat(worldView(g), ['witch']);
      combat.foes[0]!.vitality = 999;
      const { events, result } = combatTurn(worldView(g), p, combat, { move: 'parry' }, new Rng(seed));
      const drains = events.filter((e) => e.type === 'drain');
      if (!drains.length) continue;
      expect(result).not.toBe('enthralled');
      expect(drains[0]).toMatchObject({ left: p.character.stamina - 1, of: p.character.stamina });
      return;
    }
    throw new Error('the witch never hit');
  });

  it('the hero falls under her spell once hits have taken their full Stamina', () => {
    const g = make();
    const p = g.players[0]!;
    p.character.attributes.com = 1;
    p.character.vitality = p.character.maxVitality = 999;
    const combat = startCombat(worldView(g), ['witch']);
    combat.foes[0]!.vitality = 999;
    const rng = new Rng(7);
    let hits = 0;
    for (let turn = 0; turn < 200; turn++) {
      const { events, result } = combatTurn(worldView(g), p, combat, { move: 'focus' }, rng);
      hits += events.filter((e) => e.type === 'drain').length;
      if (result === 'enthralled') {
        expect(hits).toBe(p.character.stamina);
        return;
      }
      expect(hits).toBeLessThan(p.character.stamina);
    }
    throw new Error('never enthralled');
  });
});
