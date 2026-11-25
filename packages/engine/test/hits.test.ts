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
  it('a hit that passed by more than 20 lands where the hero aims; otherwise a k6 picks the spot', () => {
    const hits = heroHits((uid) => ({ move: 'attack', target: uid, aim: 'head' }));
    const aimed = hits.filter((h) => h.result.margin > 20);
    const rolled = hits.filter((h) => h.result.margin <= 20);
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
});
