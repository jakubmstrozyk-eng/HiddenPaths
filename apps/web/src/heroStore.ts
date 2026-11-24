import { validateHero, type Hero, type NewHero } from '@hp/engine';
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

export const serverHeroes: HeroStore = {
  list: async () => (await api.heroes()).heroes,
  create: async (hero) => (await api.createHero(hero)).hero,
  remove: async (id) => {
    await api.deleteHero(id);
  },
};
