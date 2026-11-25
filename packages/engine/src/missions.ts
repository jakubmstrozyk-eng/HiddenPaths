import { CAREER_MISSIONS, MISSIONS, type Mission } from '@hp/content';
import { DIFFICULTIES, type SizePreset } from './config';
import { gainXp, log } from './progress';
import type { GameState, LogEntry, PlayerState } from './state';

const SIZES: SizePreset[] = ['short', 'medium', 'long', 'epic'];
const BUILDINGS = new Set(['cave', 'monument', 'inn', 'village', 'city']);

/** The number a mission asks for on this map size. */
export function missionTarget(mission: Pick<Mission, 'targets'>, size: SizePreset): number {
  return typeof mission.targets === 'number' ? mission.targets : mission.targets[SIZES.indexOf(size)] ?? mission.targets[0];
}

/** A mission's goal text with its number filled in. */
export function missionGoal(mission: Mission, size: SizePreset, locale: 'pl' | 'en'): string {
  return mission.goal[locale].replace('{n}', String(missionTarget(mission, size)));
}

const key = (id: string) => `m:${id}`;
const doneKey = (id: string) => `mdone:${id}`;

/** How far a player is with a game mission: counted from this game's own play. */
export function missionProgress(state: GameState, player: PlayerState, id: string): { count: number; target: number; done: boolean } {
  const mission = MISSIONS.find((m) => m.id === id);
  const target = mission ? missionTarget(mission, state.config.size) : 1;
  const count = id === 'discoverer' ? player.revealed.length : id === 'hunter' ? player.counters.hunts ?? 0 : player.counters[key(id)] ?? 0;
  return { count: Math.min(count, target), target, done: !!player.counters[doneKey(id)] };
}

/** What one log entry adds to the game missions it touches. */
function countsOf(state: GameState, entry: LogEntry): Record<string, number> {
  switch (entry.type) {
    case 'combat':
      if (entry.event.type === 'foeDown') return { warrior: 1 };
      if ((entry.event.type === 'strike' && entry.event.scroll && entry.event.by === 'hero') || entry.event.type === 'scroll') return { magician: 1 };
      return {};
    case 'scroll':
      return { magician: 1 };
    case 'revealed':
      return BUILDINGS.has(state.map.cells[entry.cell]?.terrain ?? '') ? { scout: 1, discoverer: 0 } : { discoverer: 0 };
    case 'test': {
      // A hunt counts for the Hunter (from its own counter) and its food for the Gatherer.
      const hunt: Record<string, number> = entry.action === 'hunt' ? { hunter: 0 } : {};
      let n = 0;
      for (const g of entry.gained) {
        const [kind, amount] = g.split(':');
        if (kind === 'food') n += Number(amount) || 1;
        else if (kind === 'material' || kind === 'herb') n += 1;
      }
      return n ? { ...hunt, gatherer: n } : hunt;
    }
    case 'change': {
      const c = entry.change;
      // Only gains count: drinking a potion or putting gear on is not finding an item.
      if (c.what === 'item') return c.amount > 0 ? { collector: 1 } : {};
      // Food and herbs found on the way (event cards) are gathered too.
      if ((c.what === 'food' || c.what === 'herbs') && c.amount > 0) return { gatherer: c.amount };
      return c.what === 'rune' ? { master: 1 } : {};
    }
    case 'check':
      return entry.attribute === 'cha' && entry.result.success ? { orator: 1 } : {};
    case 'card':
      return { professional: 1 };
    default:
      return {};
  }
}

/** Called for every log entry: counts mission progress and pays a game mission's XP once it is reached. */
export function trackMissions(state: GameState, entry: LogEntry) {
  if (entry.type === 'mission' || !('player' in entry)) return;
  const player = state.players.find((p) => p.id === entry.player);
  if (!player) return;
  const counts = countsOf(state, entry);
  for (const [id, n] of Object.entries(counts)) {
    if (n) player.counters[key(id)] = (player.counters[key(id)] ?? 0) + n;
  }
  for (const id of player.character.missions) {
    if (!(id in counts) || player.counters[doneKey(id)]) continue;
    const { count, target } = missionProgress(state, player, id);
    if (count < target) continue;
    player.counters[doneKey(id)] = 1;
    const xp = (MISSIONS.find((m) => m.id === id)?.xp ?? 0) * DIFFICULTIES[state.config.difficulty].xp;
    log(state, { type: 'mission', player: player.id, mission: id, xp });
    gainXp(state, player, xp);
  }
}

/** One game's share of a hero's career goals. */
export interface GameCareer {
  cards: number;
  bestSkill: number;
  bestAttribute: number;
  rune: boolean;
  level: number;
}

export function careerOf(player: PlayerState): GameCareer {
  const c = player.character;
  return {
    cards: player.counters[key('professional')] ?? 0,
    bestSkill: Math.max(0, ...Object.values(c.skills).map((v) => v ?? 0)),
    bestAttribute: Math.max(0, ...Object.values(c.attributes)),
    rune: !!c.equipment.rune || !!player.counters[key('master')],
    level: c.level,
  };
}

/** Career goals reached, from every game the hero has played (each game's latest share). */
export function careerProgress(games: GameCareer[]): { id: string; count: number; target: number; done: boolean }[] {
  const cards = games.reduce((n, g) => n + g.cards, 0);
  const best = (f: (g: GameCareer) => number) => Math.max(0, ...games.map(f));
  const value: Record<string, number> = {
    specialist: best((g) => g.bestSkill),
    expert: best((g) => g.bestAttribute),
    master: games.some((g) => g.rune) ? 1 : 0,
    professional: cards,
    hero: best((g) => g.level),
  };
  return CAREER_MISSIONS.map((m) => {
    const target = missionTarget(m, 'short');
    const count = Math.min(value[m.id] ?? 0, target);
    return { id: m.id, count, target, done: count >= target };
  });
}
