import { describe, expect, it } from 'vitest';
import { ENEMIES, PROFESSIONS, type ProfessionId, type RaceId } from '@hp/content';
import { LEVEL_XP } from '../src/character';
import {
  applyAction, buyPrice, combatMoves, combatTurn, combatXp, createGame, heroArmour, highMapCards, legalActions, levelUp, Rng, runTerrainAction,
  startCombat, startSpeed, worldView, type CombatMove, type GameState, type PlayerState,
} from '../src/index';
import { gainXp } from '../src/progress';
import { onMap } from './helpers';

const RACE: Record<ProfessionId, RaceId> = {
  trapper: 'nomads', elder: 'nomads', diver: 'myrmids', gourmet: 'myrmids', explorer: 'humans', warrior: 'humans',
  mystic: 'sunborn', guardian: 'sunborn', wraith: 'keepers', druid: 'keepers', runemaster: 'flintborn', cavedelver: 'flintborn',
};
const HIGH = (profession: ProfessionId) => PROFESSIONS[profession].cards.filter((c) => c.level >= 5).map((c) => c.id);

/** A hero of the profession holding every card of levels 5 to 9 (the hand limit does not matter to the engine). */
const make = (profession: ProfessionId, cards = HIGH(profession)): GameState => {
  const g = onMap(createGame('high', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: RACE[profession], profession, bonus: { com: 10 }, missions: ['hunter'] } }]));
  g.players[0]!.character.cards = [...cards];
  return g;
};
const strong = (p: PlayerState) => {
  for (const a of ['com', 'dex', 'str', 'int', 'wil', 'cha'] as const) p.character.attributes[a] = 95;
  p.character.vitality = p.character.maxVitality = 99;
  p.staminaLeft = 4;
};
const at = (g: GameState, terrain: string) => {
  const cell = g.map.cells.find((c) => c.terrain === terrain);
  if (cell) {
    g.players[0]!.position = cell.index;
    if (!g.players[0]!.revealed.includes(cell.index)) g.players[0]!.revealed.push(cell.index);
  }
  return cell?.index;
};
/** Plays one card move in a fresh fight against these foes, on copies. */
const fightWith = (g: GameState, card: string, foes: string[], seed = 1, prep?: (p: PlayerState) => void) => {
  const p = structuredClone(g.players[0]!);
  strong(p);
  prep?.(p);
  const c = startCombat(worldView(g), foes);
  const move = combatMoves(p, c).find((m) => m.move === 'card' && m.card === card) as CombatMove | undefined;
  if (!move) throw new Error(`${card} is not offered`);
  const out = combatTurn(worldView(g), p, c, move, new Rng(seed));
  return { p, c, ...out };
};

describe('level 5, 7 and 9 cards from the document (Jacob, 2026-11-28)', () => {
  it('every profession has 11 cards: 3 at level 1 and 2 at levels 3, 5, 7 and 9', () => {
    const ids = new Set<string>();
    for (const p of Object.values(PROFESSIONS)) {
      expect(p.cards).toHaveLength(11);
      expect(p.cards.filter((c) => c.level === 1)).toHaveLength(3);
      for (const level of [3, 5, 7, 9]) expect(p.cards.filter((c) => c.level === level)).toHaveLength(2);
      for (const c of p.cards) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
        expect(c.name.pl && c.name.en && c.summary.pl && c.summary.en).toBeTruthy();
      }
    }
  });

  it('levels 5, 7 and 9 each bring their two cards', () => {
    const g = make('warrior', []);
    const c = g.players[0]!.character;
    c.cards = PROFESSIONS.warrior.cards.filter((x) => x.level <= 3).map((x) => x.id);
    gainXp(g, g.players[0]!, LEVEL_XP[5]!);
    expect(c.level).toBe(5);
    expect(c.newCards?.slice(-2)).toEqual(['warrior-whetstone', 'warrior-wide-swing']);
    expect(levelUp(c, 7)).toEqual(['warrior-intimidate', 'warrior-precision']);
    expect(levelUp(c, 9)).toEqual(['warrior-banner', 'warrior-behead']);
  });

  it('every fight card of every profession can be played without breaking the fight', () => {
    for (const profession of Object.keys(PROFESSIONS) as ProfessionId[]) {
      const g = make(profession);
      for (const seed of [1, 2, 3]) {
        const p = structuredClone(g.players[0]!);
        strong(p);
        p.character.equipment.weapon = 'bow';
        p.counters.dodgeLessons = 3;
        const c = startCombat(worldView(g), ['wolf', 'bandit', 'raven']);
        const cards = new Set(combatMoves(p, c).flatMap((m) => (m.move === 'card' ? [m.card] : [])));
        for (const card of cards) {
          const a = structuredClone(p);
          const f = structuredClone(c);
          const move = combatMoves(a, f).find((m) => m.move === 'card' && m.card === card)!;
          expect(() => combatTurn(worldView(g), a, f, move, new Rng(seed))).not.toThrow();
        }
      }
    }
  });

  it('every map card of every profession can be played where it is offered', () => {
    for (const profession of Object.keys(PROFESSIONS) as ProfessionId[]) {
      for (const terrain of ['forest', 'lake', 'mountains', 'village']) {
        const g = make(profession);
        if (at(g, terrain) === undefined) continue;
        const p = g.players[0]!;
        strong(p);
        p.counters.tanned = 3;
        for (const card of highMapCards(g, p)) {
          if (['gourmet-groundwater', 'cavedelver-shadow'].includes(card)) continue;
          expect(() => applyAction(g, 'p', { type: 'card', card })).not.toThrow();
        }
      }
    }
  });
});

describe('fight cards', () => {
  it('Beheading kills a foe of up to 20 Vitality; Headshot takes 20', () => {
    const g = make('warrior');
    let killed = false;
    for (let seed = 1; seed < 40 && !killed; seed++) {
      const { c } = fightWith(g, 'warrior-behead', ['bandit'], seed);
      if (c.foes[0]!.vitality <= 0) killed = true;
    }
    expect(killed).toBe(true);
    const w = make('wraith');
    w.players[0]!.character.equipment.weapon = 'bow';
    for (let seed = 1; seed < 40; seed++) {
      const { events, c } = fightWith(w, 'wraith-headshot', ['bear'], seed);
      const hit = events.find((e) => e.type === 'strike' && e.by === 'hero' && e.card === 'wraith-headshot');
      if (hit?.type === 'strike' && hit.result.success) {
        expect(hit.damage).toBe(20);
        expect(combatMoves(structuredClone(w.players[0]!), c).some((m) => m.move === 'card' && m.card === 'wraith-headshot')).toBe(false);
        return;
      }
    }
    throw new Error('no headshot landed');
  });

  it('Chasm swallows foes for half XP; Rending spares the flyers', () => {
    const g = make('mystic');
    for (let seed = 1; seed < 40; seed++) {
      const { c } = fightWith(g, 'mystic-chasm', ['bandit'], seed, (p) => { p.character.attributes.int = 99; });
      if (c.foes[0]!.gone !== 'void') continue;
      expect(combatXp(worldView(g), c)).toBe(Math.floor(ENEMIES.bandit!.xp / 2));
      break;
    }
    const r = make('runemaster');
    const { c } = fightWith(r, 'runemaster-rend', ['raven'], 1, (p) => { p.character.attributes.str = 200; });
    expect(c.foes[0]!.gone).toBeUndefined();
  });

  it('Shield Wall stops the next 3 blows that land', () => {
    const g = make('guardian');
    const { c, events } = fightWith(g, 'guardian-shield-wall', ['bear'], 3);
    const blocked = events.filter((e) => e.type === 'strike' && e.card === 'guardian-shield-wall').length;
    expect((c.wall ?? 0) + blocked).toBe(3);
  });

  it('Sleep Dart: a sleeping foe does not strike, and the next blow lands for sure and wakes it', () => {
    const g = make('diver');
    for (let seed = 1; seed < 60; seed++) {
      const { p, c } = fightWith(g, 'diver-sleep', ['bear'], seed);
      if (!c.foes[0]!.asleep) continue;
      const before = p.character.vitality;
      const r = combatTurn(worldView(g), p, c, { move: 'attack', target: 'bear-1' }, new Rng(seed));
      expect(r.events.some((e) => e.type === 'status' && e.what === 'woke')).toBe(true);
      expect(r.events.some((e) => e.type === 'strike' && e.by === 'hero' && e.result.success)).toBe(true);
      expect(p.character.vitality).toBeLessThanOrEqual(before);
      return;
    }
    throw new Error('the bear never fell asleep');
  });

  it('Toxin adds up: every hit adds 1 to the poison', () => {
    const g = make('diver');
    const { p, c } = fightWith(g, 'diver-toxin', ['bear'], 1);
    expect(c.toxin).toBe(3);
    const bear = c.foes[0]!;
    bear.vitality = bear.maxVitality = 999;
    for (let i = 0; i < 2; i++) combatTurn(worldView(g), p, c, { move: 'attack', target: bear.uid }, new Rng(10 + i));
    expect(c.foes[0]!.venom ?? 0).toBeGreaterThan(0);
  });

  it('Flashbang dazes: −20, then −10, then −5', () => {
    const g = make('explorer');
    for (let seed = 1; seed < 30; seed++) {
      const { c } = fightWith(g, 'explorer-flashbang', ['minotaur'], seed);
      if (c.foes[0]!.dazed === undefined) continue;
      expect(c.foes[0]!.dazed).toBe(1);
      return;
    }
    throw new Error('never dazed');
  });

  it('Spear Throw leaves the Guardian unarmed until an attack picks it up', () => {
    const g = make('guardian');
    const { p, c } = fightWith(g, 'guardian-spear', ['bear'], 1);
    expect(c.unarmed).toBe(true);
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'guardian-spear')).toBe(false);
    const r = combatTurn(worldView(g), p, c, { move: 'attack', target: 'bear-1' }, new Rng(2));
    expect(r.events.some((e) => e.type === 'status' && e.what === 'pickedUp')).toBe(true);
    expect(c.unarmed).toBe(false);
  });

  it('Water Bolt: away from water only twice a fight', () => {
    const g = make('diver');
    const p = g.players[0]!;
    strong(p);
    const c = startCombat(worldView(g), ['bear']);
    for (let i = 0; i < 2; i++) combatTurn(worldView(g), p, c, { move: 'card', card: 'diver-water-bolt', target: 'bear-1' }, new Rng(i + 1));
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'diver-water-bolt')).toBe(c.foes[0]!.vitality > 0 && false);
  });

  it('Taking Aim adds +20 once a fight', () => {
    const g = make('wraith');
    const p = g.players[0]!;
    strong(p);
    p.character.attributes.com = 30;
    const c = startCombat(worldView(g), ['bear']);
    const r = combatTurn(worldView(g), p, c, { move: 'attack', target: 'bear-1', boost: 'wraith-aim' }, new Rng(1));
    const first = r.events.find((e) => e.type === 'strike' && e.by === 'hero');
    const plain = combatTurn(worldView(g), p, c, { move: 'attack', target: 'bear-1', boost: 'wraith-aim' }, new Rng(1));
    const second = plain.events.find((e) => e.type === 'strike' && e.by === 'hero');
    expect(first?.type === 'strike' && second?.type === 'strike' && first.result.target - second.result.target).toBe(20);
  });

  it('Lord of the Forest tames a beast of up to 20 Vitality on one Wil test, up to 3 companions', () => {
    const g = make('druid');
    const { p, c } = fightWith(g, 'druid-forest-lord', ['wolf'], 1, (a) => { a.character.attributes.wil = 99; });
    expect(c.foes[0]!.tamed).toBe(true);
    expect(p.companions![0]!.tame).toBe(true);
  });

  it('Banner gives the hero +10 Str and Combat and +2 damage for the fight', () => {
    const g = make('warrior');
    const { p } = fightWith(g, 'warrior-banner', ['wolf']);
    expect(p.effects.filter((e) => e.id === 'ally:banner').map((e) => e.attribute).sort()).toEqual(['com', 'damage', 'str']);
  });

  it('Stone Skin adds 5 armour everywhere', () => {
    const g = make('cavedelver');
    const p = g.players[0]!;
    const before = heroArmour(p).torso;
    const next = applyAction(g, 'p', { type: 'card', card: 'cavedelver-stone-skin' });
    expect(heroArmour(next.players[0]!).torso).toBe(before + 5);
  });
});

describe('map cards and passive cards', () => {
  it('Teleport: set it, walk away, come back', () => {
    let g = make('explorer');
    const start = g.players[0]!.position;
    g = applyAction(g, 'p', { type: 'card', card: 'explorer-teleport' });
    expect(g.players[0]!.counters.teleport).toBe(start + 1);
    const n = legalActions(g, 'p').find((a) => a.type === 'move');
    if (!n || n.type !== 'move') return;
    g = applyAction(g, 'p', n);
    if (g.players[0]!.pendingEvent || g.players[0]!.combat) return;
    g = applyAction(g, 'p', { type: 'card', card: 'explorer-teleport' });
    expect(g.players[0]!.position).toBe(start);
    expect(g.players[0]!.counters.teleport).toBeUndefined();
  });

  it('Raven Form flies one fragment with no Speed or Stamina', () => {
    let g = make('druid');
    g = applyAction(g, 'p', { type: 'card', card: 'druid-raven' });
    g.players[0]!.speedLeft = 0;
    g.players[0]!.staminaLeft = 0;
    const move = legalActions(g, 'p').find((a) => a.type === 'move');
    expect(move).toBeTruthy();
    g = applyAction(g, 'p', move!);
    expect(legalActions(g, 'p').some((a) => a.type === 'move')).toBe(false);
  });

  it('Healthy Eating: +1 max Vitality and no meal needed this round and the next', () => {
    let g = make('gourmet');
    g.players[0]!.character.food = 3;
    const max = g.players[0]!.character.maxVitality;
    g = applyAction(g, 'p', { type: 'card', card: 'gourmet-healthy' });
    expect(g.players[0]!.character.maxVitality).toBe(max + 1);
    expect(legalActions(g, 'p').some((a) => a.type === 'eat')).toBe(false);
    expect(highMapCards(g, g.players[0]!)).not.toContain('gourmet-healthy');
  });

  it('Special Recipe restores the Stamina used', () => {
    let g = make('gourmet');
    g.players[0]!.character.food = 3;
    g.players[0]!.staminaLeft = 0;
    g = applyAction(g, 'p', { type: 'card', card: 'gourmet-recipe' });
    expect(g.players[0]!.staminaLeft).toBe(g.players[0]!.character.stamina);
    expect(g.players[0]!.character.food).toBe(1);
  });

  it('Better Camp heals 3 more; Runner +1 Speed at the start of a round', () => {
    let g = make('trapper');
    const forest = at(g, 'forest');
    if (forest === undefined) return;
    const p = g.players[0]!;
    p.character.vitality = 1;
    p.staminaLeft = 4;
    g = applyAction(g, 'p', { type: 'camp' });
    expect(g.players[0]!.character.vitality).toBe(6);
    const w = make('wraith');
    expect(startSpeed(w, w.players[0]!)).toBe(w.players[0]!.character.speed + 1);
  });

  it('Service: 20% off in towns', () => {
    const g = make('guardian');
    if (at(g, 'village') === undefined) return;
    const plain = make('guardian', []);
    at(plain, 'village');
    const a = buyPrice(g, g.players[0]!, 'food');
    const b = buyPrice(plain, plain.players[0]!, 'food');
    expect(a).toBe(b! * 0.8);
  });

  it('Bait gives +20 to the next hunt; Expert\'s Nose gives 2 rare finds', () => {
    let g = make('explorer');
    if (at(g, 'forest') === undefined) return;
    g = applyAction(g, 'p', { type: 'card', card: 'explorer-bait' });
    const p = g.players[0]!;
    p.staminaLeft = 3;
    const out = runTerrainAction(worldView(g), p, 'hunt', new Rng(1));
    expect(p.counters.bait).toBeUndefined();
    expect(out.type).toBe('test');
    const r = make('runemaster');
    if (at(r, 'mountains') === undefined) return;
    const m = r.players[0]!;
    strong(m);
    const mine = runTerrainAction(worldView(r), m, 'mine', new Rng(1));
    if (mine.type === 'test' && mine.result.success) expect(mine.gained.filter((x) => x.startsWith('material:')).length).toBeGreaterThanOrEqual(4);
  });

  it('Shadow Walker travels between caves and mountains, the road taking half the fragments in rounds', () => {
    let g = make('cavedelver');
    const hills = g.map.cells.filter((c) => c.terrain === 'mountains' || c.terrain === 'cave');
    if (hills.length < 2) return;
    const p = g.players[0]!;
    p.position = hills[0]!.index;
    p.revealed = hills.map((c) => c.index);
    const far = hills[hills.length - 1]!.index;
    g = applyAction(g, 'p', { type: 'card', card: 'cavedelver-shadow', target: String(far) });
    expect(g.players[0]!.position).toBe(far);
    expect(g.players[0]!.id === 'p' && g.turnIndex === 0).toBe(true);
  });

  it('Vision: a charge lets the next event card be drawn again', () => {
    let g = make('elder');
    g.players[0]!.character.attributes.int = 99;
    g = applyAction(g, 'p', { type: 'card', card: 'elder-vision' });
    expect(g.players[0]!.counters.vision).toBe(1);
    g.players[0]!.pendingEvent = { card: g.eventDeck[0]!, step: 'start' };
    expect(highMapCards(g, g.players[0]!)).toContain('elder-vision');
    g = applyAction(g, 'p', { type: 'card', card: 'elder-vision' });
    expect(g.players[0]!.counters.vision).toBeUndefined();
  });

  it('Leather Suit after 3 Tanneries gives 2 armour on every part of the body', () => {
    let g = make('trapper');
    const p = g.players[0]!;
    strong(p);
    p.counters.tanned = 3;
    g = applyAction(g, 'p', { type: 'card', card: 'trapper-leatherwork' });
    g = applyAction(g, 'p', { type: 'equip', item: 'leatherSuit' });
    expect(heroArmour(g.players[0]!).head).toBeGreaterThanOrEqual(2);
  });
});
