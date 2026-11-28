import { describe, expect, it } from 'vitest';
import { PROFESSIONS, TERRAINS, type ProfessionId, type RaceId } from '@hp/content';
import { LEVEL_XP } from '../src/character';
import {
  applyAction, combatMoves, combatTurn, createGame, heroArmour, keepCards, legalActions, levelUp, MAX_CARDS, Rng, runTerrainAction, startCombat,
  testModifier, worldView, type GameState,
} from '../src/index';
import { gainXp } from '../src/progress';
import { onMap } from './helpers';

const make = (race: RaceId, profession: ProfessionId, level3 = true): GameState => {
  const g = onMap(createGame('level3', { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race, profession, bonus: { com: 10 }, missions: ['hunter'] } }]));
  if (level3) g.players[0]!.character.cards.push(...PROFESSIONS[profession].cards.filter((c) => c.level === 3).map((c) => c.id));
  return g;
};
const at = (g: GameState, terrain: string) => {
  const cell = g.map.cells.find((c) => c.terrain === terrain);
  if (cell) g.players[0]!.position = cell.index;
  return cell?.index;
};

describe('new skill cards with the level (Jacob, 2026-11-25)', () => {
  it('every profession has 2 cards for level 3', () => {
    for (const p of Object.values(PROFESSIONS)) expect(p.cards.filter((c) => c.level === 3)).toHaveLength(2);
  });

  it('level 3 adds its 2 cards to the hand of 3; level 5 asks which 5 to keep', () => {
    const g = make('humans', 'warrior', false);
    const p = g.players[0]!;
    gainXp(g, p, LEVEL_XP[3]!);
    expect(p.character.level).toBe(3);
    expect(p.character.cards).toHaveLength(5);
    expect(p.character.newCards).toBeUndefined();
    // Level 5 has no cards in the data yet: a pretend pair shows the choice.
    p.character.newCards = ['x1', 'x2'];
    expect(legalActions(g, 'p').some((a) => a.type === 'keepCards')).toBe(true);
    expect(() => keepCards(p.character, p.character.cards.slice(0, 4))).toThrow();
    const keep = ['x1', 'x2', ...p.character.cards.slice(0, 3)];
    const next = applyAction(g, 'p', { type: 'keepCards', cards: keep });
    expect(next.players[0]!.character.cards).toEqual(keep);
    expect(next.players[0]!.character.newCards).toBeUndefined();
    expect(next.log.some((e) => e.type === 'cardsKept' && e.dropped.length === 2)).toBe(true);
    // The cards left out wait on the bench and come back into the next choice (Jacob, 2026-11-26).
    const c = next.players[0]!.character;
    expect(c.benched).toHaveLength(2);
    c.newCards = ['x3'];
    expect(() => keepCards(c, [...(c.benched ?? []), 'x3', 'x1', 'x2'])).not.toThrow();
    expect(c.benched).toHaveLength(3);
  });

  it('a level that brings cards beyond 5 waits for the choice', () => {
    const g = make('humans', 'warrior', false);
    const c = g.players[0]!.character;
    c.cards.push('a', 'b');
    expect(levelUp(c, 3)).toHaveLength(2);
    expect(c.cards).toHaveLength(MAX_CARDS);
    expect(c.newCards).toEqual(['warrior-strategist', 'warrior-way']);
  });
});

describe('level 3 cards', () => {
  it('Trapper · Poisoned Arrow and Tannery', () => {
    let g = make('nomads', 'trapper');
    const p = g.players[0]!;
    p.character.equipment.weapon = 'bow';
    // Poisoned Arrow: a card shot, twice a fight; a plain shot does not poison.
    const c = startCombat(worldView(g), ['bear']);
    const a = structuredClone(p);
    a.character.attributes.com = 99;
    a.character.vitality = 99;
    const arrow = () => combatMoves(a, c).some((m) => m.move === 'card' && m.card === 'trapper-poison-arrow');
    expect(arrow()).toBe(true);
    combatTurn(worldView(g), a, c, { move: 'card', card: 'trapper-poison-arrow', target: 'bear-1' }, new Rng(1));
    expect(c.foes[0]!.poisoned || c.foes[0]!.vitality <= 0).toBe(true);
    combatTurn(worldView(g), a, c, { move: 'card', card: 'trapper-poison-arrow', target: 'bear-1' }, new Rng(2));
    expect(arrow()).toBe(false);
    if (at(g, 'forest') === undefined) return;
    p.character.attributes.dex = 99;
    p.character.attributes.int = 99;
    p.staminaLeft = 3;
    runTerrainAction(worldView(g), p, 'hunt', new Rng(1));
    expect(p.counters.hides).toBe(1);
    // One hide makes a helmet; the torso takes 2.
    expect(() => applyAction(g, 'p', { type: 'card', card: 'trapper-tannery', target: 'torso' })).toThrow();
    g = applyAction(g, 'p', { type: 'card', card: 'trapper-tannery', target: 'head' });
    expect(g.players[0]!.inventory.items).toContain('leather-head');
    expect(g.players[0]!.counters.hides).toBe(0);
  });

  it('Elder · Potion of Might: 3 ingredients from 3 fragments make the potion', () => {
    let g = make('nomads', 'elder');
    const forests = g.map.cells.filter((c) => c.terrain !== 'core' && c.terrain !== 'void' && TERRAINS[c.terrain].actions.some((a) => a === 'gather' || a === 'herbalism')).slice(0, 3);
    if (forests.length < 3) return;
    g.players[0]!.character.attributes.int = 99;
    for (const cell of forests) {
      g.players[0]!.position = cell.index;
      g.players[0]!.staminaLeft = 3;
      g = applyAction(g, 'p', { type: 'card', card: 'elder-power-potion' });
      expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'elder-power-potion')).toBe(false);
    }
    expect(g.players[0]!.inventory.items).toContain('elderPotion');
    const dex = testModifier(worldView(g), g.players[0]!, 'dex');
    g = applyAction(g, 'p', { type: 'use', item: 'elderPotion' });
    expect(testModifier(worldView(g), g.players[0]!, 'dex')).toBe(dex + 10);
  });

  it('Elder · Master of Beasts: three Charisma tests in a row make any beast a companion', () => {
    const g = make('nomads', 'elder');
    const p = g.players[0]!;
    p.character.attributes.cha = 99;
    // A bear (24 Vitality) is too big; a wolf is not (at most 20, Jacob 2026-11-26).
    const c = startCombat(worldView(g), ['bear', 'wolf']);
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'elder-beast-master' && m.target === 'wolf-2')).toBe(true);
    expect(() => combatTurn(worldView(g), structuredClone(p), structuredClone(c), { move: 'card', card: 'elder-beast-master', target: 'bear-1' }, new Rng(1))).toThrow();
    for (let i = 0; i < 3; i++) {
      p.character.vitality = 99;
      const { events } = combatTurn(worldView(g), p, c, { move: 'card', card: 'elder-beast-master', target: 'wolf-2' }, new Rng(i + 1));
      expect(events.some((e) => e.type === 'master' && e.step === i + 1)).toBe(true);
    }
    expect(p.companions).toHaveLength(1);
    expect(p.companions![0]!.tame).toBe(true);
    expect(c.foes[1]!.tamed).toBe(true);
  });

  it('Diver · Camouflage avoids the fight on the first turn only; Filleting bleeds a foe out', () => {
    const g = make('myrmids', 'diver');
    const p = g.players[0]!;
    p.character.attributes.dex = 99;
    let hidden = false;
    for (let seed = 1; seed < 30 && !hidden; seed++) {
      const c = startCombat(worldView(g), ['mummy']);
      const r = combatTurn(worldView(g), structuredClone(p), c, { move: 'card', card: 'diver-camouflage' }, new Rng(seed));
      if (r.result === 'hidden') hidden = true;
      expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'diver-camouflage')).toBe(false);
    }
    expect(hidden).toBe(true);
    // After hiding the Diver may leave, but do nothing else on this fragment.
    p.counters[`hiddenAt:${p.position}`] = 1;
    const here = legalActions(g, 'p');
    expect(here.some((x) => x.type === 'terrain' || x.type === 'camp' || x.type === 'card')).toBe(false);
    expect(here.some((x) => x.type === 'move') || p.speedLeft === 0).toBe(true);
    delete p.counters[`hiddenAt:${p.position}`];
    let bled = false;
    for (let seed = 1; seed < 80 && !bled; seed++) {
      const c = startCombat(worldView(g), ['bear']);
      const a = structuredClone(p);
      a.character.vitality = 99;
      a.character.attributes.com = 99;
      combatTurn(worldView(g), a, c, { move: 'card', card: 'diver-fillet', target: 'bear-1' }, new Rng(seed));
      if (c.foes[0]!.wound === undefined) continue;
      // The bear never manages to staunch it here: it bleeds out after 3 rounds.
      for (let i = 0; i < 3 && c.foes[0]!.vitality > 0; i++) combatTurn(worldView(g), a, c, { move: 'parry' }, new Rng(seed * 100 + i));
      if (c.foes[0]!.wound !== undefined || c.foes[0]!.vitality <= 0) bled = true;
    }
    expect(bled).toBe(true);
  });

  it('Gourmet · Fisher: a second try on water, one catch of 2 food', () => {
    const g = make('myrmids', 'gourmet');
    const p = g.players[0]!;
    if (at(g, 'lake') === undefined && at(g, 'river') === undefined) return;
    p.character.attributes.dex = 99;
    p.staminaLeft = 3;
    const food = p.character.food;
    const out = runTerrainAction(worldView(g), p, 'hunt', new Rng(1));
    expect(out.card).toBe('gourmet-fisher');
    expect(p.character.food - food).toBe(2);
    expect(p.counters.hunts).toBe(1);
  });

  it('Explorer · Sense of Direction: hard terrain costs 1 Speed; Smoke Bomb flees on one test', () => {
    const g = make('humans', 'explorer');
    const p = g.players[0]!;
    p.character.attributes.dex = 99;
    const c = startCombat(worldView(g), ['wolf']);
    const r = combatTurn(worldView(g), p, c, { move: 'card', card: 'explorer-smoke' }, new Rng(1));
    expect(r.events.some((e) => e.type === 'flee' && !e.foe)).toBe(true);
    expect(r.result).toBe('fled');
    const hard = g.map.cells.find((cell) => cell.terrain === 'mountains');
    if (!hard) return;
    const from = g.map.cells.find((cell) => worldView(g).near(cell.index).includes(hard.index))!;
    p.position = from.index;
    p.speedLeft = 1;
    p.staminaLeft = 3;
    p.cameFrom = null;
    expect(legalActions(g, 'p').some((a) => a.type === 'move' && a.to === hard.index)).toBe(true);
  });

  it('Warrior · Strategist gives +10 Combat after a round of study; Way of the Warrior +1 Combat', () => {
    let g = make('humans', 'warrior');
    const p = g.players[0]!;
    const c = startCombat(worldView(g), ['wolf']);
    combatTurn(worldView(g), p, c, { move: 'card', card: 'warrior-strategist', target: 'wolf-1' }, new Rng(1));
    expect(c.studied).toBe(true);
    expect(c.studiedKind).toBe('wolf');
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'warrior-strategist')).toBe(false);
    // Way of the Warrior is used only while camping.
    expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'warrior-way')).toBe(false);
    const camp = g.map.cells.find((cell) => cell.terrain === 'forest');
    if (!camp) return;
    g.players[0]!.position = camp.index;
    g.players[0]!.staminaLeft = 3;
    const com = g.players[0]!.character.attributes.com;
    expect(legalActions(g, 'p').some((a) => a.type === 'camp' && a.card === 'warrior-way')).toBe(true);
    g = applyAction(g, 'p', { type: 'camp', card: 'warrior-way' });
    expect(g.players[0]!.character.attributes.com).toBe(com + 1);
  });

  it('Mystic · Black Vines keep a bound foe from striking; Levitation lets the Mystic over a river', () => {
    let g = make('sunborn', 'mystic');
    const p = g.players[0]!;
    p.character.attributes.int = 99;
    const c = startCombat(worldView(g), ['bear']);
    combatTurn(worldView(g), p, c, { move: 'card', card: 'mystic-vines', target: 'bear-1' }, new Rng(1));
    expect(c.foes[0]!.vined).toBe(true);
    g = applyAction(g, 'p', { type: 'card', card: 'mystic-levitate' });
    expect(g.players[0]!.counters[`levitate@${g.round}`]).toBe(1);
    // A failed try turns the card until camp too.
    g.players[0]!.character.attributes.int = 0;
    delete g.players[0]!.counters['used:mystic-levitate'];
    g.players[0]!.staminaLeft = 3;
    g = applyAction(g, 'p', { type: 'card', card: 'mystic-levitate' });
    expect(g.players[0]!.counters['used:mystic-levitate']).toBe(1);
  });

  it('Guardian · Scalp: +1 Combat against a kind of foe for every fight won against it', () => {
    let g = make('sunborn', 'guardian');
    for (let fight = 1; fight <= 2; fight++) {
      const p = g.players[0]!;
      p.character.attributes.com = 99;
      p.character.vitality = 99;
      p.combat = startCombat(worldView(g), ['imp', 'imp']);
      for (const f of p.combat.foes) f.vitality = 1;
      while (g.players[0]!.combat) {
        const foe = g.players[0]!.combat!.foes.find((f) => f.vitality > 0)!;
        g = applyAction(g, 'p', { type: 'combat', move: { move: 'attack', target: foe.uid } });
      }
      expect(g.players[0]!.counters['scalp:imp']).toBe(fight);
    }
  });

  it('Wraith · Veil of Mist, once until camp; Lookout reveals the fragments around', () => {
    let g = make('keepers', 'wraith');
    const p = g.players[0]!;
    const c = startCombat(worldView(g), ['wolf']);
    combatTurn(worldView(g), p, c, { move: 'card', card: 'wraith-mist' }, new Rng(1));
    expect(c.mist).toBe(1);
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'wraith-mist')).toBe(false);
    const forest = at(g, 'forest');
    if (forest === undefined) return;
    p.staminaLeft = 3;
    const xp = p.character.xp;
    g = applyAction(g, 'p', { type: 'card', card: 'wraith-lookout' });
    for (const n of worldView(g).near(forest)) expect(g.players[0]!.revealed).toContain(n);
    // Seeing from afar gives no XP (Jacob, 2026-11-26); it comes on first stepping there.
    expect(g.players[0]!.character.xp).toBe(xp);
  });

  it('Druid · Teacher gives the companion +1; Fangs make the foe bleed', () => {
    let g = make('keepers', 'druid');
    const p = g.players[0]!;
    p.character.attributes.wil = 99;
    p.companions = [{ uid: 'pet-wolf-1', enemy: 'wolf', vitality: 8, maxVitality: 8, bond: 3, tame: true }];
    // Teacher: only while camping.
    const camp = g.map.cells.find((cell) => cell.terrain === 'forest');
    if (camp) {
      p.position = camp.index;
      p.staminaLeft = 3;
      expect(legalActions(g, 'p').some((a) => a.type === 'card' && a.card === 'druid-teacher')).toBe(false);
      g = applyAction(g, 'p', { type: 'camp', card: 'druid-teacher', target: 'pet-wolf-1' });
      expect(g.players[0]!.companions![0]!.bonus).toBe(1);
    }
    const a = g.players[0]!;
    a.character.attributes.com = 99;
    a.character.vitality = 99;
    const c = startCombat(worldView(g), ['bear']);
    const { events } = combatTurn(worldView(g), a, c, { move: 'card', card: 'druid-fangs', target: 'bear-1' }, new Rng(3));
    expect(events.some((e) => e.type === 'tear')).toBe(true);
    // Bleeding: a weak foe that keeps failing its Strength test dies in the 3rd round of it.
    let died = false;
    for (let seed = 1; seed < 60 && !died; seed++) {
      const w = startCombat(worldView(g), ['bear']);
      w.foes[0]!.vitality = 99;
      w.foes[0]!.bleed = 0;
      for (let i = 0; i < 3 && w.foes[0]!.bleed !== undefined; i++) combatTurn(worldView(g), structuredClone(a), w, { move: 'parry' }, new Rng(seed * 10 + i));
      if (w.foes[0]!.vitality <= 0) died = true;
    }
    expect(died).toBe(true);
  });

  it('Runemaster · Rune of Safety for 2 Stamina; Reinforcement +1 armour in a settlement and ends the round', () => {
    let g = make('flintborn', 'runemaster');
    g = applyAction(g, 'p', { type: 'card', card: 'runemaster-safety-rune' });
    expect(g.players[0]!.character.equipment.rune).toBe('safety');
    const p = g.players[0]!;
    if (at(g, 'village') === undefined && at(g, 'city') === undefined) return;
    p.inventory.materials = { iron: 2, wood: 2 };
    const torso = heroArmour(p).torso;
    expect(legalActions(g, 'p').some((a) => a.type === 'reinforce' && a.slot === 'torso')).toBe(true);
    const round = g.round;
    g = applyAction(g, 'p', { type: 'reinforce', slot: 'torso' });
    expect(heroArmour(g.players[0]!).torso).toBe(torso + 1);
    expect(g.round).toBe(round + 1);
    expect(legalActions(g, 'p').some((a) => a.type === 'reinforce' && a.slot === 'torso')).toBe(false);
    // The +1 belongs to the piece: a new torso piece is not reinforced (Jacob, 2026-11-26).
    const q = g.players[0]!;
    q.character.equipment.armour = q.character.equipment.armour.filter((id) => id !== 'leather-torso').concat('chainmail');
    expect(heroArmour(q).torso).toBe(heroArmour({ ...q, counters: {} }).torso);
  });

  it('Cave Delver · Caver +10 in the mountains; Blinding Light −30 to foes who fail', () => {
    const g = make('flintborn', 'cavedelver');
    const p = g.players[0]!;
    const plain = testModifier(worldView(g), p, 'dex');
    if (at(g, 'mountains') !== undefined) expect(testModifier(worldView(g), p, 'dex')).toBeGreaterThanOrEqual(plain);
    const c = startCombat(worldView(g), ['wolf', 'bandit']);
    const { events } = combatTurn(worldView(g), p, c, { move: 'card', card: 'cavedelver-blind' }, new Rng(5));
    const blind = events.find((e) => e.type === 'blind');
    expect(blind && blind.type === 'blind' && blind.foes).toHaveLength(2);
    expect(combatMoves(p, c).some((m) => m.move === 'card' && m.card === 'cavedelver-blind')).toBe(false);
  });
});
