import { validateHero, withCareer, withGrowth, withJournal, type GameCareer, type Hero, type HeroGrowth, type HeroJournal, type NewHero } from '@hp/engine';
import { api } from './api';

/** Where heroes are kept: on the server for a signed-in player, otherwise on this device. */
export interface HeroStore {
  list(): Promise<Hero[]>;
  create(hero: NewHero): Promise<Hero>;
  remove(id: string): Promise<void>;
}

const KEY = 'hidden-paths.heroes';

function read(): Hero[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Hero[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function write(list: Hero[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage can be unavailable */
  }
}

export const deviceHeroes: HeroStore = {
  list: async () => read(),
  create: async (input) => {
    const hero: Hero = { ...validateHero(input), id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
    write([...read(), hero]);
    return hero;
  },
  remove: async (id) => write(read().filter((h) => h.id !== id)),
};

/**
 * Keeps a device game's latest share of the career goals on its hero, and the hero's development when this
 * game took it furthest (the server does this itself).
 */
export function recordDeviceCareer(heroId: string, game: string, share: GameCareer, growth?: HeroGrowth, journal?: HeroJournal | null) {
  const list = read();
  const hero = list.find((h) => h.id === heroId);
  if (!hero) return;
  const before = JSON.stringify([hero.career?.[game] ?? null, hero.growth ?? null, hero.journal ?? null]);
  const career = withCareer(hero.career, game, share);
  const grown = growth ? withGrowth(hero.growth, growth) : hero.growth;
  // The hero journal: this game's entries join the hero's, with the latest Inspiration and vow.
  const written = journal ? withJournal(hero.journal, journal) : hero.journal;
  if (before === JSON.stringify([career[game], grown ?? null, written ?? null])) return;
  hero.career = career;
  if (grown) hero.growth = grown;
  if (written) hero.journal = written;
  write(list);
}

export const serverHeroes: HeroStore = {
  list: async () => (await api.heroes()).heroes,
  create: async (hero) => (await api.createHero(hero)).hero,
  remove: async (id) => {
    await api.deleteHero(id);
  },
};
