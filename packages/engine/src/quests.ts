import {
  BOARD_REFRESH, BOARD_SIZE, COMMON_ORES, HERB_IDS, ITEMS, MAX_QUESTS, QUEST_BY_ID, QUEST_TEMPLATES, QUIET_CARD, RARE_ORES,
  isBountyCard, isDungeonCard, type HerbId, type MaterialId, type QuestGoods, type QuestTemplate,
} from '@hp/content';
import { DIFFICULTIES } from './config';
import { EngineError } from './errors';
import { insideMap, landAt, neighbours } from './mapgen';
import { gainXp, log } from './progress';
import { Rng, seedFromString } from './rng';
import type { GameState, LogEntry, PlayerState } from './state';

/** A quest a hero has taken from a notice board. */
export interface Quest {
  uid: string;
  /** The template in `QUEST_TEMPLATES`. */
  id: string;
  /** The settlement whose board posted it: it is handed in there. */
  town: number;
  need: number;
  have: number;
  /** Scout: the fragments around the settlement, and those already stood on. */
  cells?: number[];
  seen?: number[];
  /** Bounty: the marked fragment, and whether its foes are beaten. */
  target?: number;
  done?: boolean;
}

/** A board's state in the game: which posting it shows and what has been taken from it. */
export interface Board { serial: number; since: number; taken: string[] }

/** A quest as the board shows it, before anyone takes it. */
export interface Posting { id: string; target?: number; cells?: number[] }

type Town = 'village' | 'city';
const townAt = (state: GameState, cell: number): Town | null => {
  const t = landAt(state.map, cell);
  return t === 'village' || t === 'city' ? t : null;
};

/** The posting a board shows now: a new one once it was picked from and BOARD_REFRESH rounds have passed. */
function boardNow(state: GameState, cell: number): Board {
  const b = state.boards?.[cell] ?? { serial: 0, since: 0, taken: [] };
  if (b.taken.length > 0 && state.round - b.since >= BOARD_REFRESH) return { serial: b.serial + 1, since: state.round, taken: [] };
  return b;
}

/** Fragments 2 to 4 steps away where a bounty's foes can camp: on the map, not the centre or a building. */
function bountySpots(state: GameState, town: number): number[] {
  const { width } = state.map;
  const tx = town % width;
  const ty = Math.floor(town / width);
  return state.map.cells.flatMap((c, i) => {
    const d = Math.abs((i % width) - tx) + Math.abs(Math.floor(i / width) - ty);
    if (d < 2 || d > 4 || !insideMap(c)) return [];
    const t = landAt(state.map, i);
    return t === 'core' || t === 'city' || t === 'village' || t === 'inn' || t === 'monument' ? [] : [i];
  });
}

/**
 * What a board posts, drawn from its own seed (the game's seed, the fragment and the posting number), so
 * every player sees the same quests and looking at the board changes nothing. A city posts 4 with one hard
 * quest among them; a village 2, with a hard one now and then.
 */
export function boardPostings(state: GameState, cell: number): Posting[] {
  const town = townAt(state, cell);
  if (!town) return [];
  const board = boardNow(state, cell);
  const rng = new Rng(seedFromString(`${state.seed}:board:${cell}:${board.serial}`));
  const around = neighbours(state.map, cell).filter((n) => landAt(state.map, n) !== 'core');
  const spots = bountySpots(state, cell);
  const fits = (q: QuestTemplate) => (q.kind !== 'scout' || around.length >= 2) && (q.kind !== 'bounty' || spots.length > 0);
  const simple = rng.shuffle(QUEST_TEMPLATES.filter((q) => !q.hard && fits(q)));
  const hard = rng.shuffle(QUEST_TEMPLATES.filter((q) => q.hard && fits(q)));
  const hardCount = town === 'city' ? 1 + (rng.next() < 0.3 ? 1 : 0) : rng.next() < 0.3 ? 1 : 0;
  const picked = [...hard.slice(0, hardCount), ...simple.slice(0, BOARD_SIZE[town] - hardCount)];
  return picked
    .map((q): Posting => ({
      id: q.id,
      ...(q.kind === 'bounty' ? { target: spots[rng.int(spots.length)]! } : {}),
      ...(q.kind === 'scout' ? { cells: around } : {}),
    }))
    .filter((p) => !board.taken.includes(p.id));
}

/** The quests the hero can take where they stand. */
export function offeredQuests(state: GameState, player: PlayerState): Posting[] {
  if (!townAt(state, player.position) || player.delve) return [];
  const mine = new Set((player.quests ?? []).map((q) => q.id));
  return boardPostings(state, player.position).filter((p) => !mine.has(p.id));
}

/** How many of the goods the hero carries. */
export function goodsHave(player: PlayerState, what: QuestGoods): number {
  const inv = player.inventory;
  const sum = (ids: string[], bag: Record<string, number | undefined>) => ids.reduce((n, id) => n + (bag[id] ?? 0), 0);
  if (what === 'food') return player.character.food;
  if (what === 'herb') return sum(HERB_IDS, inv.herbs);
  if (what === 'ore') return sum(COMMON_ORES, inv.materials);
  if (what === 'rareOre') return sum(RARE_ORES, inv.materials);
  if ((HERB_IDS as string[]).includes(what)) return inv.herbs[what as HerbId] ?? 0;
  return inv.materials[what as MaterialId] ?? 0;
}

/** How far the hero is with a quest: for goods it is what they carry now. */
export function questProgress(player: PlayerState, quest: Quest): { have: number; need: number; ready: boolean } {
  const t = QUEST_BY_ID[quest.id]!;
  const have = t.kind === 'bring' ? Math.min(quest.need, goodsHave(player, t.what!)) : t.kind === 'bounty' ? (quest.done ? 1 : 0) : Math.min(quest.need, quest.have);
  return { have, need: quest.need, ready: have >= quest.need };
}

/** Quests ready to hand in at the board the hero stands by. */
export function questsToHandIn(state: GameState, player: PlayerState): Quest[] {
  if (!townAt(state, player.position) || player.delve) return [];
  return (player.quests ?? []).filter((q) => q.town === player.position && questProgress(player, q).ready);
}

export const canTakeQuest = (player: PlayerState) => (player.quests?.length ?? 0) < MAX_QUESTS;

/** The quest's reward: XP after the difficulty's multiplier, gold and maybe an item. */
export function questReward(state: Pick<GameState, 'config'>, id: string): { xp: number; gold: number; item?: string } {
  const t = QUEST_BY_ID[id]!;
  return { xp: Math.round(t.xp * DIFFICULTIES[state.config.difficulty].xp), gold: t.gold, ...(t.item ? { item: t.item } : {}) };
}

export function takeQuest(state: GameState, player: PlayerState, id: string) {
  const posting = offeredQuests(state, player).find((p) => p.id === id);
  if (!posting) throw new EngineError('quest.notOffered', 'That quest is not on this board.');
  if (!canTakeQuest(player)) throw new EngineError('quest.tooMany', `You can carry at most ${MAX_QUESTS} quests.`);
  const board = boardNow(state, player.position);
  state.boards = { ...(state.boards ?? {}), [player.position]: { ...board, taken: [...board.taken, id] } };
  const t = QUEST_BY_ID[id]!;
  const quest: Quest = {
    uid: `${player.position}:${board.serial}:${id}`, id, town: player.position, need: t.need, have: 0,
    ...(posting.cells ? { cells: posting.cells, seen: [], need: posting.cells.length } : {}),
    ...(posting.target !== undefined ? { target: posting.target } : {}),
  };
  player.quests = [...(player.quests ?? []), quest];
  log(state, { type: 'quest', player: player.id, quest: id, what: 'taken' });
}

/** Hands a finished quest in: goods are given away, the reward is paid. */
export function handInQuest(state: GameState, player: PlayerState, uid: string) {
  const quest = questsToHandIn(state, player).find((q) => q.uid === uid);
  if (!quest) throw new EngineError('quest.notReady', 'That quest cannot be handed in here.');
  const t = QUEST_BY_ID[quest.id]!;
  if (t.kind === 'bring') giveGoods(state, player, t.what!, quest.need);
  player.quests = player.quests!.filter((q) => q !== quest);
  const reward = questReward(state, quest.id);
  gainXp(state, player, reward.xp);
  player.character.gold += reward.gold;
  log(state, { type: 'change', player: player.id, change: { what: 'gold', amount: reward.gold } });
  if (reward.item && ITEMS[reward.item]) {
    player.inventory.items.push(reward.item);
    log(state, { type: 'change', player: player.id, change: { what: 'item', item: reward.item, amount: 1 } });
  }
  log(state, { type: 'quest', player: player.id, quest: quest.id, what: 'done', xp: reward.xp, gold: reward.gold, ...(reward.item ? { item: reward.item } : {}) });
}

export function dropQuest(state: GameState, player: PlayerState, uid: string) {
  const quest = player.quests?.find((q) => q.uid === uid);
  if (!quest) throw new EngineError('quest.none', 'You do not have that quest.');
  player.quests = player.quests!.filter((q) => q !== quest);
  log(state, { type: 'quest', player: player.id, quest: quest.id, what: 'dropped' });
}

/** Takes the goods from the bag, the most plentiful kind first. */
function giveGoods(state: GameState, player: PlayerState, what: QuestGoods, count: number) {
  const inv = player.inventory;
  if (what === 'food') {
    player.character.food -= count;
    log(state, { type: 'change', player: player.id, change: { what: 'food', amount: -count } });
    return;
  }
  const herbs = what === 'herb' ? HERB_IDS : (HERB_IDS as string[]).includes(what) ? [what as HerbId] : [];
  const ores: MaterialId[] = what === 'ore' ? COMMON_ORES : what === 'rareOre' ? RARE_ORES : herbs.length ? [] : [what as MaterialId];
  for (let i = 0; i < count; i++) {
    if (herbs.length) {
      const h = [...herbs].sort((a, b) => (inv.herbs[b] ?? 0) - (inv.herbs[a] ?? 0))[0]!;
      inv.herbs[h] = (inv.herbs[h] ?? 0) - 1;
      if (!inv.herbs[h]) delete inv.herbs[h];
      log(state, { type: 'change', player: player.id, change: { what: 'item', item: h, amount: -1 } });
    } else {
      const m = [...ores].sort((a, b) => (inv.materials[b] ?? 0) - (inv.materials[a] ?? 0))[0]!;
      inv.materials[m] = (inv.materials[m] ?? 0) - 1;
      if (!inv.materials[m]) delete inv.materials[m];
      log(state, { type: 'change', player: player.id, change: { what: 'item', item: m, amount: -1 } });
    }
  }
}

/** A bounty waiting where the hero just stepped: its card, or null. */
export function bountyAt(player: PlayerState, cell: number): number | null {
  const q = (player.quests ?? []).find((x) => x.target === cell && !x.done);
  return q ? QUEST_BY_ID[q.id]!.card ?? null : null;
}

/** Moves the quests on from what an action wrote to the log; a quest that just became ready says so. */
export function progressQuests(state: GameState, entries: LogEntry[]) {
  for (const e of entries) {
    if (!('player' in e)) continue;
    const player = state.players.find((p) => p.id === e.player);
    if (!player?.quests?.length) continue;
    for (const q of player.quests) {
      const t = QUEST_BY_ID[q.id]!;
      const before = questProgress(player, q).ready;
      switch (t.kind) {
        case 'scout':
          if (e.type === 'moved' && q.cells?.includes(e.to) && !q.seen?.includes(e.to)) { q.seen = [...(q.seen ?? []), e.to]; q.have = q.seen.length; }
          break;
        case 'discover':
          if (e.type === 'revealed') q.have++;
          break;
        case 'hunt':
          if (e.type === 'test' && 'action' in e && e.action === 'hunt' && e.result.success) q.have++;
          break;
        case 'fights':
          if (e.type === 'combatEnded' && e.result === 'won') q.have++;
          break;
        case 'events':
          if (e.type === 'eventEnded' && e.card !== QUIET_CARD && !isDungeonCard(e.card) && !isBountyCard(e.card) && e.card < 800) q.have++;
          break;
        case 'bounty':
          if (e.type === 'bounty' && e.card === t.card && player.position === q.target) q.done = true;
          break;
        case 'bring':
          break;
      }
      if (!before && t.kind !== 'bring' && questProgress(player, q).ready) log(state, { type: 'quest', player: player.id, quest: q.id, what: 'ready' });
    }
  }
}
