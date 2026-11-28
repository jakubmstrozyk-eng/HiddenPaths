import { describe, expect, it } from 'vitest';
import { TRAIT_OPTIONS, type Attribute } from '@hp/content';
import {
  applyAction, campfireOffer, canWriteJournal, payVows, createGame, eventOptions, heroTest, journalOf, journalShare, legalActions, noteLog, Rng, summarize, testModifier, withJournal, worldView,
  type GameState, type HeroJournal, type JournalEntry, type PlayerState,
} from '../src/index';
import { onMap } from './helpers';

const make = (journal?: HeroJournal, seed = 'journal'): GameState =>
  onMap(createGame(seed, { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false },
    [{ id: 'p', character: { name: 'A', race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter'], ...(journal ? { journal } : {}) } }]));

const me = (g: GameState) => g.players[0]!;

/** Writes facts into the chronicle as if they had happened. */
function happen(g: GameState, n: number) {
  for (let i = 0; i < n; i++) noteLog(g, [{ type: 'eventDrawn', player: 'p', cell: me(g).position, card: 3 }]);
}

const entry = (over: Partial<JournalEntry>, i: number): JournalEntry => ({ id: `e${i}`, game: 'old', round: 1, facts: [], xp: 0, gold: 0, rewarded: false, ...over });

describe('hero journal', () => {
  it('a new hero starts with an empty journal and no Inspiration', () => {
    const j = journalOf(me(make()));
    expect(j.summary.entries).toBe(0);
    expect(j.inspiration).toBe(0);
    expect(j.open).toBe(false);
  });

  it('camping opens the campfire', () => {
    const g = make();
    const camp = legalActions(g, 'p').find((a) => a.type === 'camp');
    if (!camp) return;
    const next = applyAction(g, 'p', camp);
    expect(journalOf(me(next)).open).toBe(true);
  });

  it('an entry pays an Inspiration only after 3 new things (Jacob: no bonuses for camping every step)', () => {
    let g = make();
    happen(g, 2);
    journalOf(me(g)).open = true;
    expect(campfireOffer(g, me(g)).rewarded).toBe(false);
    g = applyAction(g, 'p', { type: 'journal', entry: {} });
    expect(journalOf(me(g)).inspiration).toBe(0);
    expect(journalOf(me(g)).written).toHaveLength(1);
    // The two from before still count towards the next rewarded entry.
    happen(g, 1);
    expect(campfireOffer(g, me(g)).rewarded).toBe(true);
    journalOf(me(g)).open = true;
    g = applyAction(g, 'p', { type: 'journal', entry: {} });
    expect(journalOf(me(g)).inspiration).toBe(1);
    expect(g.log.some((e) => e.type === 'journal' && e.what === 'inspiration')).toBe(true);
  });

  it('nothing to write without new things or a camp', () => {
    const g = make();
    expect(() => applyAction(g, 'p', { type: 'journal', entry: {} })).toThrow();
    // Closing the campfire unwritten is always fine.
    expect(() => applyAction(g, 'p', { type: 'journal' })).not.toThrow();
  });

  it('entries are written only at camp, reading is fine anywhere (Jacob, 2026-11-27)', () => {
    let g = make();
    happen(g, 4);
    expect(canWriteJournal(me(g))).toBe(false);
    expect(() => applyAction(g, 'p', { type: 'journal', entry: {} })).toThrow(/camp/);
    // At camp (as the camp action leaves it).
    journalOf(me(g)).open = true;
    expect(canWriteJournal(me(g))).toBe(true);
    // The fire goes out with the hero's next move.
    const move = legalActions(g, 'p').find((a) => a.type === 'move');
    expect(move).toBeDefined();
    g = applyAction(g, 'p', move!);
    expect(canWriteJournal(me(g))).toBe(false);
    expect(() => applyAction(g, 'p', { type: 'journal', entry: {} })).toThrow(/camp/);
  });

  it('at most two vows at once; a third waits for a kept one or a later day', () => {
    let g = make();
    const vowAt = (pick?: (k: string[]) => string) => {
      journalOf(me(g)).open = true;
      const offer = campfireOffer(g, me(g));
      const vow = (pick ?? ((k) => k[0]!))(offer.vows) as never;
      if (vow) g = applyAction(g, 'p', { type: 'journal', entry: { vow } });
      return offer;
    };
    vowAt();
    const second = vowAt();
    expect(second.vows).not.toContain(journalOf(me(g)).vows[0]!.kind);
    expect(journalOf(me(g)).vows).toHaveLength(2);
    // Two open the same day: no third.
    journalOf(me(g)).open = true;
    expect(campfireOffer(g, me(g)).vows).toEqual([]);
    expect(() => applyAction(g, 'p', { type: 'journal', entry: { vow: 'town' } })).toThrow();
    // A day later a new vow replaces the oldest.
    g.round += 1;
    const oldest = journalOf(me(g)).vows[0]!.kind;
    const offer = vowAt();
    expect(offer.replaces).toBe(oldest);
    expect(journalOf(me(g)).vows).toHaveLength(2);
    expect(journalOf(me(g)).vows.map((v) => v.kind)).not.toContain(oldest);
  });

  it('a kept vow frees its place; an old single vow is read as one of two', () => {
    const old: HeroJournal = { entries: [], inspiration: 0, vow: { kind: 'town', need: 1, have: 0, game: 'x', round: 1 } };
    const g = make(old);
    expect(journalOf(me(g)).vows.map((v) => v.kind)).toEqual(['town']);
    const kept = noteLog(g, [{ type: 'moved', player: 'p', from: 0, to: g.map.cells.find((c) => c.terrain === 'village' || c.terrain === 'city' || c.terrain === 'inn')?.index ?? 0, cost: 1 }]);
    if (!kept.length) return;
    payVows(kept, (e) => g.log.push(e), (p, n) => { p.character.xp += n; });
    expect(journalOf(me(g)).vows).toEqual([]);
    expect(journalShare(me(g))!.vows).toEqual([]);
  });

  it('Inspiration throws a failed test again, once', () => {
    const g = make();
    const p = me(g);
    journalOf(p).inspiration = 1;
    // A test nobody can pass: both throws fail, and the Inspiration is spent on the first failure.
    const r = heroTest(worldView(g), p, 'dex', new Rng(1), -500);
    // (a throw of 1 always passes, so only the second throw's result is left to chance)
    expect(r.rerolled).toBe('inspiration');
    expect(journalOf(p).inspiration).toBe(0);
  });

  it('answers move the character and three the same way give a trait with its plus and minus', () => {
    const entries = [0, 1, 2].map((i) => entry({ prompt: { id: 'nightmare', answer: 0, axis: 'courage', delta: -1 } }, i));
    const s = summarize(entries);
    expect(s.axes.courage).toBe(-3);
    expect(s.traits).toEqual(['bold']);
    const g = make({ entries, inspiration: 0, vows: [] });
    const p = me(g);
    const plain = make();
    // Bold: +5 to Willpower tests.
    expect(testModifier(worldView(g), p, 'wil') - testModifier(worldView(plain), me(plain), 'wil')).toBe(5);
  });

  it('a trait adds its own choice to a card', () => {
    const entries = [0, 1, 2].map((i) => entry({ prompt: { id: 'fight', answer: 0, axis: 'mercy', delta: 1 } }, i));
    const g = make({ entries, inspiration: 0, vows: [] });
    const p = me(g);
    p.pendingEvent = { card: 51, step: 'start' };
    const opts = eventOptions(g, p);
    const ruthless = TRAIT_OPTIONS.find((o) => o.card === 51 && o.trait === 'ruthless')!;
    expect(opts.some((o) => o.option.trait === 'ruthless' && o.option.label.pl === ruthless.option.label.pl)).toBe(true);
    expect(opts.some((o) => o.option.trait === 'merciful')).toBe(false);
  });

  it('a kept vow pays +2 XP and an Inspiration', () => {
    let g = make();
    happen(g, 1);
    journalOf(me(g)).open = true;
    const offer = campfireOffer(g, me(g));
    expect(offer.vows.length).toBe(3);
    const vow = offer.vows.includes('explore') ? 'explore' : offer.vows[0]!;
    g = applyAction(g, 'p', { type: 'journal', entry: { vow } });
    const j = journalOf(me(g));
    expect(j.vows[0]?.kind).toBe(vow);
    j.vows[0]!.have = j.vows[0]!.need - 1;
    const xp = me(g).character.xp;
    const kinds: Record<string, Parameters<typeof noteLog>[1][number]> = {
      explore: { type: 'revealed', player: 'p', cell: 0, xp: 0 },
      fights: { type: 'combatEnded', player: 'p', result: 'won', xp: 0 },
      dungeon: { type: 'room', player: 'p', room: 0 },
      events: { type: 'eventEnded', player: 'p', card: 3 },
      town: { type: 'moved', player: 'p', from: 0, to: g.map.cells.find((c) => c.terrain === 'village' || c.terrain === 'city' || c.terrain === 'inn')?.index ?? 0, cost: 1 },
    };
    if (!kinds[vow]) return;
    const kept = noteLog(g, [kinds[vow]!]);
    expect(kept).toHaveLength(1);
    payVows(kept, (e) => g.log.push(e), (p, n) => { p.character.xp += n; });
    expect(me(g).character.xp - xp).toBe(2);
    expect(journalOf(me(g)).inspiration).toBe(1);
  });

  it('a bestiary note is checked with an Intelligence test and gives the first test +5', () => {
    let g = make();
    noteLog(g, [{ type: 'combatStarted', player: 'p', foes: ['wolf'] }, { type: 'combatEnded', player: 'p', result: 'won', xp: 2 }]);
    journalOf(me(g)).open = true;
    const offer = campfireOffer(g, me(g));
    expect(offer.note?.enemy).toBe('wolf');
    expect(offer.note!.options).toContain(offer.note!.truth);
    g = applyAction(g, 'p', { type: 'journal', entry: { note: offer.note!.truth } });
    const e = journalOf(me(g)).written[0]!;
    expect(e.note?.enemy).toBe('wolf');
    expect(journalOf(me(g)).summary.bestiary.wolf !== undefined).toBe(e.note!.confirmed);
  });

  it('the fifth entry closes a chapter and its lesson applies for the whole game', () => {
    const entries = [0, 1, 2, 3].map((i) => entry({ tests: { dex: 3 } }, i));
    let g = make({ entries, inspiration: 0, vows: [] });
    happen(g, 1);
    journalOf(me(g)).open = true;
    const offer = campfireOffer(g, me(g));
    expect(offer.chapter?.number).toBe(1);
    expect(offer.chapter?.attribute).toBe('dex');
    const before = testModifier(worldView(g), me(g), 'dex');
    g = applyAction(g, 'p', { type: 'journal', entry: { title: 'Mokradła', lesson: 'attribute' } });
    expect(journalOf(me(g)).summary.chapters[0]?.title).toBe('Mokradła');
    expect(testModifier(worldView(g), me(g), 'dex') - before).toBe(2);
    // The next game starts with the lesson too.
    const next = make({ entries: [...entries, ...journalOf(me(g)).written], inspiration: 0, vows: [] });
    expect(me(next).effects.some((x) => x.id === 'journal-lesson-dex' && x.amount === 2)).toBe(true);
  });

  it('a game\'s entries join the hero\'s journal without duplicates', () => {
    let g = make();
    happen(g, 3);
    journalOf(me(g)).open = true;
    g = applyAction(g, 'p', { type: 'journal', entry: { text: 'Pachniało ziołami.' } });
    const share = journalShare(me(g))!;
    const kept: HeroJournal = { entries: [entry({}, 9)], inspiration: 0, vows: [] };
    const once = withJournal(kept, share);
    const twice = withJournal(once, share);
    expect(once.entries).toHaveLength(2);
    expect(twice.entries).toHaveLength(2);
    expect(once.inspiration).toBe(1);
    expect(once.entries[1]!.text).toBe('Pachniało ziołami.');
  });

  it('someone the journal remembers gives +10 on their card', () => {
    const entries = [entry({ met: ['pickpocket'], marks: { pickpocket: 'foe' } }, 0)];
    const g = make({ entries, inspiration: 0, vows: [] });
    expect(journalOf(me(g)).summary.people.pickpocket).toBe('foe');
  });

  it('only rewards answers that were offered', () => {
    const g = make();
    happen(g, 1);
    journalOf(me(g)).open = true;
    expect(() => applyAction(g, 'p', { type: 'journal', entry: { answer: 7 } })).toThrow();
    expect(() => applyAction(g, 'p', { type: 'journal', entry: { lesson: 'stars' } })).toThrow();
  });
});

export type { Attribute, PlayerState };
