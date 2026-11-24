import { randomUUID } from 'node:crypto';
import { EngineError, heroCharacter, heroFits, validateHero, type CharacterInput, type Hero, type NewHero } from '@hp/engine';
import type { User } from './auth';
import type { Db } from './db';
import { ApiError } from './games';

/** A player may keep this many heroes. */
export const MAX_HEROES = 24;

/** Heroes kept on the server, so a player finds them on any device. */
export class Heroes {
  constructor(private db: Db, private clock: () => Date) {}

  async list(user: User): Promise<Hero[]> {
    const rows = await this.db.query<{ id: string; data: NewHero; created_at: Date }>(
      `select id, data, created_at from heroes where user_id = $1 order by created_at`, [user.id]);
    return rows.map((r) => ({ ...(typeof r.data === 'string' ? JSON.parse(r.data) : r.data), id: r.id, createdAt: new Date(r.created_at).toISOString() }));
  }

  async create(user: User, input: NewHero): Promise<Hero> {
    let hero: NewHero;
    try {
      hero = validateHero(input);
    } catch (e) {
      if (e instanceof EngineError) throw new ApiError(422, e.code, e.message);
      throw e;
    }
    const [row] = await this.db.query<{ n: number }>(`select count(*)::int as n from heroes where user_id = $1`, [user.id]);
    if ((row?.n ?? 0) >= MAX_HEROES) throw new ApiError(409, 'hero.limit', `You can keep at most ${MAX_HEROES} heroes.`);
    const id = randomUUID();
    const at = this.clock();
    await this.db.query(`insert into heroes (id, user_id, data, created_at) values ($1, $2, $3, $4)`, [id, user.id, JSON.stringify(hero), at]);
    return { ...hero, id, createdAt: at.toISOString() };
  }

  async remove(user: User, id: string): Promise<void> {
    await this.db.query(`delete from heroes where id = $1 and user_id = $2`, [id, user.id]);
  }

  /** The character a player's hero brings into a game, refused when the hero is made for the other mode. */
  async character(user: User, heroId: string, missions: string[], multiplayer: boolean): Promise<CharacterInput> {
    const hero = (await this.list(user)).find((h) => h.id === heroId);
    if (!hero) throw new ApiError(404, 'hero.missing', 'No such hero.');
    if (!heroFits(hero, multiplayer)) {
      throw new ApiError(422, 'hero.mode', multiplayer ? 'A single-player hero cannot play multiplayer.' : 'A multiplayer hero cannot play single player.');
    }
    try {
      return heroCharacter(hero, missions ?? []);
    } catch (e) {
      if (e instanceof EngineError) throw new ApiError(422, e.code, e.message);
      throw e;
    }
  }
}
