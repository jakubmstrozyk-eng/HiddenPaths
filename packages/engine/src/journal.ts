import {
  ATTRIBUTE_LESSON, ATTRIBUTE_LESSON_MAX, ATTRIBUTES, AXIS_LIMIT, BESTIARY_NOTES, CHAPTER_ENTRIES, ENEMIES, ENTRY_EVENTS, JOURNAL_AXES, JOURNAL_PROMPTS,
  LORE_BONUS, PERSON_OF_CARD, RETURN_BONUS, STORY_BONUS, TRAIT_AT, TRAIT_OF, TRAIT_OPTIONS, VOW_XP, VOWS,
  type Attribute, type EventOption, type JournalAxis, type LessonId, type PersonMark, type PromptTopic, type TraitId, type VowKind,
} from '@hp/content';
import type { CombatResult } from './combat';
import { test } from './dice';
import { EngineError } from './errors';
import { Rng, seedFromString } from './rng';
import { FOREVER } from './terrain';
import type { GameState, LogEntry, PlayerState } from './state';

/**
 * The hero journal (Jacob, 2026-11-27). The game writes the chronicle of what happened; at camp the player
 * answers a question, makes a vow, notes a foe, writes down a dream or closes a chapter. The entries belong to the
 * hero, not to one game, and everything the journal does later (character traits, people met again, bestiary,
 * chapters and lessons) is worked out from them.
 */

/** One thing the chronicle remembers. Kept small, since it is stored with the hero. */
export type JournalFact =
  | { k: 'explore'; n: number }
  | { k: 'fight'; foes: string[]; result: CombatResult }
  | { k: 'event'; card: number }
  | { k: 'cond'; id: string }
  | { k: 'cured'; id: string }
  | { k: 'room' }
  | { k: 'town'; terrain: string }
  | { k: 'level'; level: number }
  | { k: 'hunt' }
  | { k: 'died' }
  | { k: 'mission'; id: string }
  | { k: 'vow'; kind: VowKind }
  | { k: 'story'; ok: boolean };

export interface JournalEntry {
  id: string;
  /** The game (its seed) and round the entry was written in. */
  game: string;
  round: number;
  terrain?: string;
  facts: JournalFact[];
  xp: number;
  gold: number;
  /** Whether it was worth a reward: enough new things happened since the last rewarded entry. */
  rewarded: boolean;
  prompt?: { id: string; answer: number; axis: JournalAxis; delta: -1 | 1; about?: string };
  /** The player's own words: only for the player, never judged. */
  text?: string;
  vow?: VowKind;
  note?: { enemy: string; stat: string; confirmed: boolean };
  dream?: { text?: string };
  marks?: Record<string, PersonMark>;
  /** People met since the last entry. */
  met?: string[];
  chapter?: { title: string; lesson: LessonId; attribute?: Attribute };
  /** Attribute tests since the last entry, for the chapter's lesson. */
  tests?: Partial<Record<Attribute, number>>;
}

export interface Vow { kind: VowKind; need: number; have: number; game: string; round: number }

/** What a hero keeps between games. */
export interface HeroJournal {
  entries: JournalEntry[];
  /** Inspiration: a free second throw of one failed test. */
  inspiration: number;
  vow: Vow | null;
  /** A dream written down: the next game marks a hidden place. */
  omen?: boolean;
}

export interface JournalSummary {
  entries: number;
  axes: Record<JournalAxis, number>;
  traits: TraitId[];
  /** Confirmed bestiary notes: foe → the attribute noted. */
  bestiary: Record<string, string>;
  /** People the journal remembers, with the latest mark. */
  people: Record<string, PersonMark | 'met'>;
  chapters: { title: string; lesson: LessonId; attribute?: Attribute }[];
  lessons: { attr: Partial<Record<Attribute, number>>; friend: boolean; stars: boolean };
  /** Tests in the entries of the chapter still open. */
  chapterTests: Partial<Record<Attribute, number>>;
}

/** The journal while a game runs: what the hero brought, what was written here and the chronicle since. */
export interface GameJournal {
  summary: JournalSummary;
  written: JournalEntry[];
  inspiration: number;
  vow: Vow | null;
  omen: boolean;
  facts: JournalFact[];
  /** New things since the last rewarded entry; an entry pays only from ENTRY_EVENTS on. */
  notable: number;
  /** Fragments revealed since the last rewarded entry (every 3 count as one new thing). */
  explored: number;
  tests: Partial<Record<Attribute, number>>;
  met: string[];
  xpAt: number;
  goldAt: number;
  /** Set at camp: the app opens the campfire. */
  open: boolean;
  starsUsed?: boolean;
  /** The foes of the fight going on, for the chronicle. */
  fighting?: string[];
}

export const MAX_JOURNAL_ENTRIES = 400;
const TEXT_LIMIT = 400;
const TITLE_LIMIT = 48;

export const emptySummary = (): JournalSummary => ({
  entries: 0, axes: { courage: 0, mercy: 0, curiosity: 0, honour: 0 }, traits: [], bestiary: {}, people: {}, chapters: [],
  lessons: { attr: {}, friend: false, stars: false }, chapterTests: {},
});

const clampAxis = (v: number) => Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, v));

/** The traits an axis reading gives: from 3 either way. */
export function traitsOf(axes: Record<JournalAxis, number>): TraitId[] {
  const out: TraitId[] = [];
  for (const axis of JOURNAL_AXES) {
    const v = axes[axis] ?? 0;
    if (v <= -TRAIT_AT) out.push(TRAIT_OF[axis].low);
    if (v >= TRAIT_AT) out.push(TRAIT_OF[axis].high);
  }
  return out;
}

/** Adds one entry to a summary (the summary of a journal is all its entries folded in, in order). */
export function foldEntry(s: JournalSummary, e: JournalEntry): JournalSummary {
  s.entries++;
  if (e.prompt && JOURNAL_AXES.includes(e.prompt.axis)) s.axes[e.prompt.axis] = clampAxis(s.axes[e.prompt.axis] + (e.prompt.delta < 0 ? -1 : 1));
  s.traits = traitsOf(s.axes);
  if (e.note?.confirmed && !!ENEMIES[e.note!.enemy]) s.bestiary[e.note.enemy] = e.note.stat;
  for (const id of e.met ?? []) if (!s.people[id]) s.people[id] = 'met';
  for (const [id, mark] of Object.entries(e.marks ?? {})) if (mark === 'friend' || mark === 'debtor' || mark === 'foe') s.people[id] = mark;
  for (const [a, n] of Object.entries(e.tests ?? {})) s.chapterTests[a as Attribute] = (s.chapterTests[a as Attribute] ?? 0) + (n ?? 0);
  if (e.chapter) {
    s.chapters.push({ title: String(e.chapter.title).slice(0, TITLE_LIMIT), lesson: e.chapter.lesson, ...(e.chapter.attribute ? { attribute: e.chapter.attribute } : {}) });
    if (e.chapter.lesson === 'friend') s.lessons.friend = true;
    if (e.chapter.lesson === 'stars') s.lessons.stars = true;
    const at = e.chapter.attribute;
    if (e.chapter.lesson === 'attribute' && at && (ATTRIBUTES as readonly string[]).includes(at)) {
      s.lessons.attr[at] = Math.min(ATTRIBUTE_LESSON_MAX, (s.lessons.attr[at] ?? 0) + 1);
    }
    s.chapterTests = {};
  }
  return s;
}

export function summarize(entries: JournalEntry[]): JournalSummary {
  const s = emptySummary();
  for (const e of entries) foldEntry(s, e);
  return s;
}

/** The most Inspiration a hero holds: 1, and 2 from level 5. */
export const inspirationCap = (level: number) => (level >= 5 ? 2 : 1);

/** The journal a hero brings into a new game. */
export function startJournal(kept: HeroJournal | undefined, level: number, xp: number, gold: number): GameJournal {
  const entries = Array.isArray(kept?.entries) ? kept!.entries : [];
  const vow = kept?.vow && VOWS.some((v) => v.kind === kept.vow!.kind) ? { ...kept.vow } : null;
  return {
    summary: summarize(entries),
    written: [],
    inspiration: Math.max(0, Math.min(inspirationCap(level), Math.floor(kept?.inspiration ?? 0))),
    vow,
    omen: !!kept?.omen,
    facts: [],
    notable: 0,
    explored: 0,
    tests: {},
    met: [],
    xpAt: xp,
    goldAt: gold,
    open: false,
  };
}

/** A game's journal, for heroes from saves made before the journal existed. */
export function journalOf(player: PlayerState): GameJournal {
  if (!player.journal) player.journal = startJournal(undefined, player.character.level, player.character.xp, player.character.gold);
  return player.journal;
}

export const hasTrait = (player: Pick<PlayerState, 'journal'>, trait: TraitId) => !!player.journal?.summary.traits.includes(trait);

/** Effects that last the whole game: the +2 lessons of closed chapters. */
export function lessonEffects(summary: JournalSummary) {
  return Object.entries(summary.lessons.attr).flatMap(([attribute, times]) => (times ? [{
    id: `journal-lesson-${attribute}`, attribute: attribute as Attribute, amount: ATTRIBUTE_LESSON * times, untilRound: FOREVER,
  }] : []));
}

function applyLessons(player: PlayerState) {
  const j = journalOf(player);
  player.effects = [...player.effects.filter((e) => !e.id.startsWith('journal-lesson-')), ...lessonEffects(j.summary)];
}

/** The dungeon's entrance, or else a settlement, marked with a question mark: a dream written down came true. */
function markOmen(state: GameState, player: PlayerState): boolean {
  const hints = player.hints ?? [];
  const d = state.dungeon;
  if (d && !d.plundered && !d.foundBy.includes(player.id) && !hints.includes(d.cell)) {
    player.hints = [...hints, d.cell];
    return true;
  }
  return false;
}

/** At the start of a game: lessons apply, and a dream from an earlier game marks the hidden dungeon. */
export function beginJournal(state: GameState, player: PlayerState) {
  const j = journalOf(player);
  applyLessons(player);
  if (j.omen && markOmen(state, player)) j.omen = false;
}

const NOTABLE: JournalFact['k'][] = ['fight', 'event', 'cond', 'room', 'town', 'level', 'died', 'mission'];

function addFact(j: GameJournal, fact: JournalFact) {
  if (fact.k === 'explore') {
    const last = j.facts[j.facts.length - 1];
    if (last?.k === 'explore') last.n += fact.n;
    else j.facts.push(fact);
    j.explored += fact.n;
    return;
  }
  // A settlement is noted once per entry.
  if (fact.k === 'town' && j.facts.some((f) => f.k === 'town' && f.terrain === fact.terrain)) return;
  j.facts.push(fact);
  if (NOTABLE.includes(fact.k)) j.notable++;
}

/** New things since the last rewarded entry: the chronicle's events, plus one for every 3 fragments revealed. */
export const notableCount = (j: GameJournal) => j.notable + Math.floor(j.explored / 3);

const SETTLEMENTS = new Set(['village', 'inn', 'city']);

/** Moves the vow on; a kept vow pays its XP and an Inspiration. Returns the XP to give. */
function advanceVow(j: GameJournal, kind: VowKind, by = 1): boolean {
  if (!j.vow || j.vow.kind !== kind || j.vow.have >= j.vow.need) return false;
  j.vow.have = Math.min(j.vow.need, j.vow.have + by);
  return j.vow.have >= j.vow.need;
}

/**
 * Reads what an action added to the log into each hero's chronicle, and keeps vows. Returns the vows kept,
 * so the caller can pay them (paying writes to the log, which is read again).
 */
export function noteLog(state: GameState, entries: LogEntry[]): { player: PlayerState; kind: VowKind }[] {
  const kept: { player: PlayerState; kind: VowKind }[] = [];
  for (const e of entries) {
    if (!('player' in e)) continue;
    const player = state.players.find((p) => p.id === e.player);
    if (!player) continue;
    const j = journalOf(player);
    const vow = (kind: VowKind, by = 1) => { if (advanceVow(j, kind, by)) kept.push({ player, kind }); };
    switch (e.type) {
      case 'revealed':
        addFact(j, { k: 'explore', n: 1 });
        vow('explore');
        break;
      case 'combatStarted':
        j.fighting = [...e.foes];
        break;
      case 'combatEnded':
        addFact(j, { k: 'fight', foes: j.fighting ?? [], result: e.result });
        delete j.fighting;
        if (e.result === 'won') vow('fights');
        break;
      case 'eventDrawn': {
        addFact(j, { k: 'event', card: e.card });
        const person = PERSON_OF_CARD[e.card];
        if (person && !j.met.includes(person)) j.met.push(person);
        break;
      }
      case 'eventEnded':
        vow('events');
        break;
      case 'condition':
        addFact(j, e.added ? { k: 'cond', id: e.id } : { k: 'cured', id: e.id });
        break;
      case 'room':
        addFact(j, { k: 'room' });
        vow('dungeon');
        break;
      case 'moved': {
        const terrain = state.map.cells[e.to]?.terrain;
        if (terrain && SETTLEMENTS.has(terrain)) {
          addFact(j, { k: 'town', terrain });
          vow('town');
        }
        break;
      }
      case 'levelUp':
        addFact(j, { k: 'level', level: e.level });
        break;
      case 'died':
        addFact(j, { k: 'died' });
        break;
      case 'mission':
        addFact(j, { k: 'mission', id: e.mission });
        break;
      case 'check':
        j.tests[e.attribute] = (j.tests[e.attribute] ?? 0) + 1;
        break;
      case 'test':
        if ('action' in e) {
          j.tests[e.attribute] = (j.tests[e.attribute] ?? 0) + 1;
          if (e.action === 'hunt' && e.result.success) {
            addFact(j, { k: 'hunt' });
            vow('hunts');
          }
        }
        break;
      default:
        break;
    }
  }
  return kept;
}

/** XP for a kept vow: +2, one more for a hero true to his word, one less for a schemer. */
export function vowXp(player: PlayerState): number {
  return VOW_XP + (hasTrait(player, 'true') ? 1 : 0) - (hasTrait(player, 'schemer') ? 1 : 0);
}

export function gainInspiration(player: PlayerState, by = 1): number {
  const j = journalOf(player);
  const before = j.inspiration;
  j.inspiration = Math.min(inspirationCap(player.character.level), j.inspiration + by);
  return j.inspiration - before;
}

/** What the campfire offers right now. Everything here is drawn from the game's seed, so it is the same on the server. */
export interface CampfireOffer {
  rewarded: boolean;
  notable: number;
  need: number;
  prompt?: { id: string; about?: string };
  vows: VowKind[];
  note?: { enemy: string; options: string[]; truth: string };
  dream: boolean;
  people: string[];
  chapter?: { number: number; lessons: LessonId[]; attribute: Attribute };
}

const offerRng = (state: GameState, player: PlayerState, salt: string) =>
  new Rng(seedFromString(`${state.seed}:journal:${player.id}:${journalOf(player).summary.entries}:${salt}`));

const CONDITION_TOPICS: Record<string, PromptTopic> = { nightmare: 'nightmare', plague: 'plague', enthralled: 'enthralled' };

/** The question worth asking: the most telling thing in the chronicle since the last entry. */
function pickPrompt(j: GameJournal): CampfireOffer['prompt'] {
  const f = j.facts;
  const topic = (t: PromptTopic) => JOURNAL_PROMPTS.find((p) => p.topic === t)!;
  const cond = f.find((x) => x.k === 'cond') as { id: string } | undefined;
  if (cond) return { id: topic(CONDITION_TOPICS[cond.id] ?? 'condition').id, about: cond.id };
  if (f.some((x) => x.k === 'died')) return { id: topic('died').id };
  const fled = f.find((x) => x.k === 'fight' && (x.result === 'fled' || x.result === 'enthralled')) as { foes: string[] } | undefined;
  if (fled?.foes[0]) return { id: topic('fled').id, about: `enemy:${fled.foes[0]}` };
  if (j.met.length) return { id: topic('person').id, about: `person:${j.met[j.met.length - 1]}` };
  const won = f.find((x) => x.k === 'fight' && x.result === 'won') as { foes: string[] } | undefined;
  if (won?.foes[0]) return { id: topic('fightWon').id, about: `enemy:${won.foes[0]}` };
  if (f.some((x) => x.k === 'room')) return { id: topic('dungeon').id };
  const ev = f.find((x) => x.k === 'event') as { card: number } | undefined;
  if (ev) return { id: topic('event').id, about: `card:${ev.card}` };
  if (f.some((x) => x.k === 'town')) return { id: topic('town').id };
  const explored = f.reduce((n, x) => n + (x.k === 'explore' ? x.n : 0), 0);
  if (explored >= 3) return { id: topic('explore').id };
  return undefined;
}

/** A new vow can be made when there is none, the old one is kept, it came from another game, or a full day has passed. */
export function canVow(state: GameState, j: GameJournal): boolean {
  const v = j.vow;
  return !v || v.have >= v.need || v.game !== state.seed || state.round > v.round;
}

const NOTE_STATS = ['dex', 'str', 'wil', 'int', 'com'] as const;
/** The attribute a foe is known for: its highest. */
export function foeNature(enemy: string): (typeof NOTE_STATS)[number] {
  const e = ENEMIES[enemy]!;
  return [...NOTE_STATS].sort((a, b) => e[b] - e[a])[0]!;
}

function mostTested(tests: Partial<Record<Attribute, number>>, summary: JournalSummary): Attribute {
  const open = ATTRIBUTES.filter((a) => (summary.lessons.attr[a] ?? 0) < ATTRIBUTE_LESSON_MAX);
  const pool = open.length ? open : [...ATTRIBUTES];
  return [...pool].sort((a, b) => (tests[b] ?? 0) - (tests[a] ?? 0) || pool.indexOf(a) - pool.indexOf(b))[0]!;
}

export function campfireOffer(state: GameState, player: PlayerState): CampfireOffer {
  const j = journalOf(player);
  const notable = notableCount(j);
  const vows = canVow(state, j) ? offerRng(state, player, 'vow').shuffle(VOWS.map((v) => v.kind).filter((k) => k !== j.vow?.kind || (j.vow.have >= j.vow.need))).slice(0, 3) : [];
  const fought = j.facts.flatMap((f) => (f.k === 'fight' ? f.foes : [])).find((foe) => !j.summary.bestiary[foe] && !!ENEMIES[foe]);
  let note: CampfireOffer['note'];
  if (fought) {
    const truth = foeNature(fought);
    const rng = offerRng(state, player, 'note');
    const decoys = rng.shuffle(NOTE_STATS.filter((s) => s !== truth)).slice(0, 2);
    note = { enemy: fought, truth, options: rng.shuffle([truth, ...decoys]) };
  }
  const closes = (j.summary.entries + 1) % CHAPTER_ENTRIES === 0;
  const tests: Partial<Record<Attribute, number>> = { ...j.summary.chapterTests };
  for (const [a, n] of Object.entries(j.tests)) tests[a as Attribute] = (tests[a as Attribute] ?? 0) + (n ?? 0);
  const lessons: LessonId[] = ['attribute', ...(j.summary.lessons.friend ? [] : ['friend' as const]), ...(j.summary.lessons.stars ? [] : ['stars' as const])];
  return {
    rewarded: notable >= ENTRY_EVENTS,
    notable,
    need: ENTRY_EVENTS,
    prompt: pickPrompt(j),
    vows,
    ...(note ? { note } : {}),
    dream: j.facts.some((f) => f.k === 'cond'),
    people: [...j.met],
    ...(closes ? { chapter: { number: j.summary.chapters.length + 1, lessons, attribute: mostTested(tests, j.summary) } } : {}),
  };
}

/** What the player wrote at the campfire. Leaving it out closes the journal without an entry. */
export interface JournalWrite {
  answer?: number;
  text?: string;
  vow?: VowKind;
  note?: string;
  dream?: boolean;
  dreamText?: string;
  marks?: Record<string, PersonMark>;
  title?: string;
  lesson?: LessonId;
}

/** Whether the player can write now: something happened since the last entry, or they have just camped. */
export function canWriteJournal(player: PlayerState): boolean {
  const j = player.journal;
  if (!j || player.combat || player.pendingEvent) return false;
  return j.open || j.facts.length > 0;
}

const clean = (s: unknown, limit: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit) : '');

/** Writes an entry (or just closes the campfire). The journal action may come from any player, even out of turn. */
export function writeJournal(state: GameState, player: PlayerState, write: JournalWrite | undefined, log: (e: LogEntry) => void) {
  const j = journalOf(player);
  if (!write) {
    j.open = false;
    return;
  }
  if (!canWriteJournal(player)) throw new EngineError('journal.nothing', 'Nothing new to write yet.');
  const offer = campfireOffer(state, player);
  const prompt = offer.prompt ? JOURNAL_PROMPTS.find((p) => p.id === offer.prompt!.id) : undefined;
  if (write.answer !== undefined && (!prompt || !Number.isInteger(write.answer) || !prompt.answers[write.answer])) throw new EngineError('journal.answer', 'That answer is not offered.');
  if (write.vow !== undefined && !offer.vows.includes(write.vow)) throw new EngineError('journal.vow', 'That vow is not offered.');
  if (write.note !== undefined && !offer.note?.options.includes(write.note)) throw new EngineError('journal.note', 'That note is not offered.');
  if (write.lesson !== undefined && !offer.chapter?.lessons.includes(write.lesson)) throw new EngineError('journal.lesson', 'That lesson is not offered.');
  for (const [id, mark] of Object.entries(write.marks ?? {})) {
    if (!offer.people.includes(id) || !['friend', 'debtor', 'foe'].includes(mark)) throw new EngineError('journal.mark', 'Unknown person.');
  }
  const c = player.character;
  const entry: JournalEntry = {
    id: `${state.seed}:${player.id}:${j.written.length + 1}:${state.round}`,
    game: state.seed,
    round: state.round,
    ...(player.position >= 0 ? { terrain: state.map.cells[player.position]?.terrain } : {}),
    facts: j.facts,
    xp: Math.max(0, Math.round(c.xp - j.xpAt)),
    gold: Math.round((c.gold - j.goldAt) * 100) / 100,
    rewarded: offer.rewarded,
    tests: { ...j.tests },
    ...(j.met.length ? { met: [...j.met] } : {}),
  };
  if (prompt && write.answer !== undefined) {
    const ans = prompt.answers[write.answer]!;
    entry.prompt = { id: prompt.id, answer: write.answer, axis: ans.axis, delta: ans.delta, ...(offer.prompt?.about ? { about: offer.prompt.about } : {}) };
  }
  const text = clean(write.text, TEXT_LIMIT);
  if (text) entry.text = text;
  if (write.marks && Object.keys(write.marks).length) entry.marks = { ...write.marks };
  // Bestiary: the guess is checked with an Intelligence test: easy (+10) for the true nature, hard (−20) otherwise.
  if (write.note && offer.note) {
    const rng = offerRng(state, player, 'noteTest');
    const result = test(rng, c.attributes.int, write.note === offer.note.truth ? 10 : -20);
    log({ type: 'check', player: player.id, attribute: 'int', result });
    entry.note = { enemy: offer.note.enemy, stat: offer.note.truth, confirmed: result.success };
  }
  if (write.dream && offer.dream) {
    const dreamText = clean(write.dreamText, TEXT_LIMIT);
    entry.dream = dreamText ? { text: dreamText } : {};
  }
  if (offer.chapter) {
    const lesson = write.lesson ?? 'attribute';
    const title = clean(write.title, TITLE_LIMIT) || `${offer.chapter.number}`;
    entry.chapter = { title, lesson, ...(lesson === 'attribute' ? { attribute: offer.chapter.attribute } : {}) };
  }
  if (write.vow) {
    // True to his word: abandoning a vow not kept costs the Inspiration.
    if (j.vow && j.vow.have < j.vow.need && hasTrait(player, 'true') && j.inspiration > 0) {
      j.inspiration--;
      log({ type: 'journal', player: player.id, what: 'vowBroken' });
    }
    const def = VOWS.find((v) => v.kind === write.vow)!;
    j.vow = { kind: def.kind, need: def.need, have: 0, game: state.seed, round: state.round };
    entry.vow = def.kind;
  }
  j.written.push(entry);
  if (j.written.length > MAX_JOURNAL_ENTRIES) j.written.splice(0, j.written.length - MAX_JOURNAL_ENTRIES);
  const traitsBefore = j.summary.traits.join();
  foldEntry(j.summary, entry);
  log({ type: 'journal', player: player.id, what: 'entry', rewarded: offer.rewarded, ...(entry.note ? { enemy: entry.note.enemy, ok: entry.note.confirmed } : {}) });
  if (traitsBefore !== j.summary.traits.join()) log({ type: 'journal', player: player.id, what: 'traits', traits: [...j.summary.traits] });
  if (offer.rewarded) {
    j.notable = 0;
    j.explored = 0;
    if (gainInspiration(player)) log({ type: 'journal', player: player.id, what: 'inspiration' });
  }
  if (entry.chapter) {
    applyLessons(player);
    log({ type: 'journal', player: player.id, what: 'chapter', lesson: entry.chapter.lesson });
  }
  if (entry.dream) {
    if (markOmen(state, player)) log({ type: 'journal', player: player.id, what: 'omen' });
    else j.omen = true;
  }
  j.facts = [];
  j.tests = {};
  j.met = [];
  j.xpAt = c.xp;
  j.goldAt = c.gold;
  j.open = false;
}

/** Pays the vows the log just kept. */
export function payVows(kept: { player: PlayerState; kind: VowKind }[], log: (e: LogEntry) => void, gainXp: (player: PlayerState, xp: number) => void) {
  for (const { player, kind } of kept) {
    const xp = vowXp(player);
    gainXp(player, xp);
    gainInspiration(player);
    addFact(journalOf(player), { k: 'vow', kind });
    log({ type: 'journal', player: player.id, what: 'vowKept', vow: kind, xp });
  }
}

/** The hero's share of the journal to keep: this game's entries, the Inspiration, the vow and an unspent dream. */
export function journalShare(player: PlayerState): HeroJournal | null {
  const j = player.journal;
  if (!j) return null;
  return { entries: j.written, inspiration: j.inspiration, vow: j.vow, ...(j.omen ? { omen: true } : {}) };
}

/** A game's share written into the hero's journal: entries by id, the rest from the game that wrote last. */
export function withJournal(kept: HeroJournal | undefined, share: HeroJournal): HeroJournal {
  const entries = [...(kept?.entries ?? [])];
  const ids = new Set(entries.map((e) => e.id));
  for (const e of share.entries) if (!ids.has(e.id)) entries.push(e);
  if (entries.length > MAX_JOURNAL_ENTRIES) entries.splice(0, entries.length - MAX_JOURNAL_ENTRIES);
  return { entries, inspiration: share.inspiration, vow: share.vow, ...(share.omen ? { omen: true } : {}) };
}

/* ---- What the journal does in play ---- */

const isSettlementTerrain = (t: string) => SETTLEMENTS.has(t);

/** Character traits on a test anywhere: Willpower for the bold, traps in the dungeon, Charisma in settlements. */
export function traitBonus(terrainHere: string, actor: { journal?: GameJournal; delve?: unknown }, attribute: Attribute): number {
  const traits = actor.journal?.summary.traits;
  if (!traits?.length) return 0;
  let bonus = 0;
  if (attribute === 'wil' && traits.includes('bold')) bonus += 5;
  if (attribute === 'dex' && actor.delve) {
    if (traits.includes('careful')) bonus += 5;
    if (traits.includes('curious')) bonus -= 5;
  }
  if (attribute === 'cha' && isSettlementTerrain(terrainHere)) {
    if (traits.includes('merciful')) bonus += 5;
    if (traits.includes('ruthless')) bonus -= 5;
  }
  return bonus;
}

/** On an event card: the person met again (+10), and the curious, the prudent and the schemer. */
export function cardTestBonus(player: Pick<PlayerState, 'journal'>, card: number | undefined, attribute: Attribute): number {
  const j = player.journal;
  if (!j || card === undefined) return 0;
  let bonus = 0;
  const person = PERSON_OF_CARD[card];
  if (person && j.summary.people[person]) bonus += RETURN_BONUS;
  const traits = j.summary.traits;
  if (attribute === 'int' && traits.includes('curious')) bonus += 5;
  if (attribute === 'int' && traits.includes('prudent')) bonus -= 5;
  if (attribute === 'cha' && traits.includes('schemer')) bonus += 5;
  return bonus;
}

/** The person on a card the hero has met before, if any. */
export function knownPerson(player: Pick<PlayerState, 'journal'>, card: number): { id: string; mark: PersonMark | 'met' } | null {
  const id = PERSON_OF_CARD[card];
  const mark = id ? player.journal?.summary.people[id] : undefined;
  return id && mark ? { id, mark } : null;
}

/** Choices a hero's traits add to the start of a card. Their indexes follow the card's own choices. */
export function traitOptions(player: Pick<PlayerState, 'journal'>, card: number, base: number): { option: EventOption; index: number }[] {
  const all = TRAIT_OPTIONS.filter((o) => o.card === card);
  return all.flatMap((o, i) => (hasTrait(player, o.trait) ? [{ option: { ...o.option, trait: o.trait }, index: base + i }] : []));
}

/** The journal's say in a fight: a confirmed bestiary note (+5, not with Scalp), the careful's first blow, the bold's flight. */
export function combatJournal(player: PlayerState, foes: string[]) {
  const j = player.journal;
  const known = foes.some((f) => j?.summary.bestiary[f]);
  const scalp = player.character.cards.includes('guardian-scalp');
  return {
    lore: known && !scalp ? LORE_BONUS : 0,
    careful: hasTrait(player, 'careful') ? -5 : 0,
    flee: hasTrait(player, 'bold') ? -5 : 0,
  };
}

/** Gold after a won fight with people: +1 for the ruthless, −1 for the merciful. */
export function fightGold(player: PlayerState, foes: string[]): number {
  const people = foes.some((f) => ['thug', 'human'].includes(ENEMIES[f]?.kind ?? ''));
  if (!people) return 0;
  return (hasTrait(player, 'ruthless') ? 1 : 0) - (hasTrait(player, 'merciful') && player.character.gold >= 1 ? 1 : 0);
}

/** Charisma bonus for a story told in the inn: +5 for each closed chapter, at most +15. */
export const storyBonus = (player: Pick<PlayerState, 'journal'>) => Math.min(STORY_BONUS.max, STORY_BONUS.each * (player.journal?.summary.chapters.length ?? 0));

