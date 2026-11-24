import type { GameState } from '@hp/engine';

/** A game kept on this device: named by the player, or the automatic save of a game in progress. */
export interface SaveSlot {
  id: string;
  name: string;
  auto: boolean;
  savedAt: string;
  game: GameState;
}

const KEY = 'hidden-paths.saves';
/** The single save of the first version, moved into the list once. */
const OLD_KEY = 'hidden-paths.save';
export const MAX_NAMED = 12;
const MAX_AUTO = 3;

const valid = (game: GameState | null | undefined): game is GameState =>
  !!game && Array.isArray(game.eventDeck) && typeof game.logSeq === 'number';

function read(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SaveSlot[]) : [];
    const slots = Array.isArray(list) ? list.filter((s) => s && valid(s.game)) : [];
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const game = JSON.parse(old) as GameState;
      if (valid(game)) slots.push({ id: autoId(game), name: '', auto: true, savedAt: new Date().toISOString(), game });
      localStorage.removeItem(OLD_KEY);
      write(slots);
    }
    return slots;
  } catch {
    return [];
  }
}

/** Writes the list; false when the browser refused (storage full or blocked). */
function write(list: SaveSlot[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const autoId = (game: GameState) => `auto-${game.seed}`;
const newest = (a: SaveSlot, b: SaveSlot) => b.savedAt.localeCompare(a.savedAt);

export function listSaves(): SaveSlot[] {
  return read().sort(newest);
}

/** Keeps the automatic save of this game up to date; only the latest few games keep one. */
export function autosave(game: GameState): boolean {
  const id = autoId(game);
  const others = read().filter((s) => s.id !== id);
  const autos = others.filter((s) => s.auto).sort(newest).slice(0, MAX_AUTO - 1);
  const named = others.filter((s) => !s.auto);
  return write([...named, ...autos, { id, name: '', auto: true, savedAt: new Date().toISOString(), game }]);
}

/** Saves under a name; passing an existing slot's id overwrites that slot. */
export function saveAs(game: GameState, name: string, overwrite?: string): SaveSlot | null {
  const slot: SaveSlot = { id: overwrite ?? `save-${Date.now().toString(36)}`, name: name.trim().slice(0, 40), auto: false, savedAt: new Date().toISOString(), game };
  const list = read().filter((s) => s.id !== slot.id);
  if (!overwrite && list.filter((s) => !s.auto).length >= MAX_NAMED) return null;
  return write([...list, slot]) ? slot : null;
}

export function removeSave(id: string) {
  write(read().filter((s) => s.id !== id));
}
