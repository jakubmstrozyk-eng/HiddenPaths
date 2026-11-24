import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CharacterInput, GameConfig, GameState } from '@hp/engine';
import { buildApp } from '../src/app';
import { memoryDb, migrate, postgresDb, type Db } from '../src/db';
import { MAX_OPEN_GAMES, TURN_HOURS } from '../src/games';

const hero = (name: string): CharacterInput => ({ name, race: 'humans', profession: 'warrior', bonus: { com: 10 }, missions: ['hunter', 'scout'] });
const solo: GameConfig = { size: 'short', difficulty: 'normal', winMode: 'exploration', multiplayer: false };
const multi: GameConfig = { ...solo, multiplayer: true };

let db: Db;
let now: Date;
let mails: { to: string; subject: string; text: string }[];
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  // Runs on in-memory PGlite; set TEST_DATABASE_URL to run against a real (throwaway) Postgres.
  const url = process.env.TEST_DATABASE_URL;
  db = url ? postgresDb(url) : await memoryDb();
  if (url) await db.query('drop schema public cascade; create schema public');
  await migrate(db);
  now = new Date('2026-11-23T12:00:00Z');
  mails = [];
  app = await buildApp({
    db,
    appUrl: 'https://play.test',
    clock: () => now,
    exposeLinks: true,
    mail: async (to, subject, _html, text) => {
      mails.push({ to, subject, text });
    },
  });
}, 30_000);

afterEach(async () => {
  await app.close();
  await db.close();
});

async function signIn(email: string): Promise<string> {
  const start = await app.inject({ method: 'POST', url: '/api/auth/start', payload: { email } });
  expect(start.statusCode).toBe(200);
  const token = new URL(start.json().link).searchParams.get('login')!;
  const verify = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } });
  expect(verify.statusCode).toBe(200);
  return verify.json().session;
}

const as = (session: string) => ({ authorization: `Bearer ${session}` });

describe('sign-in', () => {
  it('emails a one-time link that creates the account and a session', async () => {
    const session = await signIn('Ara@Example.com');
    expect(mails[0]!.to).toBe('ara@example.com');
    expect(mails[0]!.text).toContain('https://play.test/?login=');
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: as(session) });
    expect(me.json().user.email).toBe('ara@example.com');
  });

  it('a link works only once', async () => {
    const start = await app.inject({ method: 'POST', url: '/api/auth/start', payload: { email: 'a@b.co' } });
    const token = new URL(start.json().link).searchParams.get('login')!;
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { token } })).statusCode).toBe(401);
  });

  it('games need a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/games' })).statusCode).toBe(401);
  });
});

describe('solo games on the server', () => {
  it('creates a game, plays an action with the version check and refuses a stale one', async () => {
    const s = await signIn('solo@x.io');
    const created = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, character: hero('Ara') } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const game = (await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: as(s) })).json();
    const state: GameState = game.state;
    const act = await app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: as(s), payload: { version: state.version, action: { type: 'endTurn' } } });
    expect(act.statusCode).toBe(200);
    expect(act.json().state.round).toBe(2);
    const again = await app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: as(s), payload: { version: state.version, action: { type: 'endTurn' } } });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('game.stale');
    const list = (await app.inject({ method: 'GET', url: '/api/games', headers: as(s) })).json().games;
    expect(list).toHaveLength(1);
    expect(list[0].your_turn).toBe(true);
  });

  it(`allows at most ${MAX_OPEN_GAMES} open games, and giving one up frees a slot`, async () => {
    const s = await signIn('slots@x.io');
    const ids: string[] = [];
    for (let i = 0; i < MAX_OPEN_GAMES; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, character: hero('Ara') } });
      expect(r.statusCode).toBe(201);
      ids.push(r.json().id);
    }
    const full = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, character: hero('Ara') } });
    expect(full.statusCode).toBe(409);
    expect(full.json().error).toBe('slots.full');
    await app.inject({ method: 'DELETE', url: `/api/games/${ids[0]}`, headers: as(s) });
    expect((await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, character: hero('Ara') } })).statusCode).toBe(201);
  });

  it('refuses a broken character', async () => {
    const s = await signIn('bad@x.io');
    const r = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, character: { ...hero('Ara'), bonus: { com: 50 } } } });
    expect(r.statusCode).toBe(422);
  });

  it('only players can see a game', async () => {
    const a = await signIn('a@x.io');
    const b = await signIn('b@x.io');
    const id = (await app.inject({ method: 'POST', url: '/api/games', headers: as(a), payload: { config: solo, character: hero('Ara') } })).json().id;
    expect((await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: as(b) })).statusCode).toBe(403);
  });
});

describe('multiplayer', () => {
  async function lobbyOfTwo() {
    const host = await signIn('host@x.io');
    const guest = await signIn('guest@x.io');
    const lobby = await app.inject({ method: 'POST', url: '/api/games', headers: as(host), payload: { config: multi, character: hero('Host'), maxPlayers: 2 } });
    expect(lobby.statusCode).toBe(201);
    const { id, code } = lobby.json();
    const info = await app.inject({ method: 'GET', url: `/api/invites/${code}` });
    expect(info.json().players).toBe(1);
    const join = await app.inject({ method: 'POST', url: `/api/invites/${code.toLowerCase()}/join`, headers: as(guest), payload: { character: hero('Guest') } });
    expect(join.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/games/${id}/start`, headers: as(guest) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/api/games/${id}/start`, headers: as(host) })).statusCode).toBe(200);
    const game = (await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: as(host) })).json();
    const users = Object.fromEntries(game.players.map((p: { userId: string; name: string }) => [p.name, p.userId]));
    return { host, guest, id, game, users };
  }

  it('players take turns one after another, and only the current player may act', async () => {
    const { host, guest, id, game, users } = await lobbyOfTwo();
    const state: GameState = game.state;
    const first = state.turnOrder[0] === users.host ? host : guest;
    const second = first === host ? guest : host;
    const wrong = await app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: as(second), payload: { version: state.version, action: { type: 'endTurn' } } });
    expect(wrong.statusCode).toBe(422);
    const ok = await app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: as(first), payload: { version: state.version, action: { type: 'endTurn' } } });
    expect(ok.statusCode).toBe(200);
    expect(mails.some((m) => m.subject.includes('turn') && m.to === (second === host ? 'host@x.io' : 'guest@x.io'))).toBe(true);
  });

  it('a quick reply earns bonus XP once per round', async () => {
    const { host, guest, id, game, users } = await lobbyOfTwo();
    const state: GameState = game.state;
    const firstId = state.turnOrder[0]!;
    const first = firstId === users.host ? host : guest;
    const xp = state.players.find((p) => p.id === firstId)!.character.xp;
    now = new Date(now.getTime() + 20 * 60_000);
    const after = (await app.inject({ method: 'POST', url: `/api/games/${id}/actions`, headers: as(first), payload: { version: state.version, action: { type: 'endTurn' } } })).json().state as GameState;
    expect(after.players.find((p) => p.id === firstId)!.character.xp).toBe(xp + 3);
  });

  it('a turn ends on its own after 12 hours, and the next player is told', async () => {
    const { id, game, users } = await lobbyOfTwo();
    const state: GameState = game.state;
    now = new Date(now.getTime() + (TURN_HOURS + 0.1) * 3_600_000);
    mails = [];
    expect(await app.games.sweepDeadlines()).toBe(1);
    const host = await signIn('host@x.io');
    const after: GameState = (await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: as(host) })).json().state;
    expect(after.turnIndex).toBe(1);
    expect(after.log.some((e) => e.type === 'timedOut')).toBe(true);
    const nextEmail = after.turnOrder[1] === users.host ? 'host@x.io' : 'guest@x.io';
    expect(mails.some((m) => m.to === nextEmail && m.subject.includes('turn'))).toBe(true);
    expect(state.turnIndex).toBe(0);
  });

  it('a full lobby refuses more players', async () => {
    const { id } = await lobbyOfTwo();
    expect(id).toBeTruthy();
    const host = await signIn('h2@x.io');
    const lobby = (await app.inject({ method: 'POST', url: '/api/games', headers: as(host), payload: { config: multi, character: hero('H'), maxPlayers: 2 } })).json();
    const g1 = await signIn('g1@x.io');
    const g2 = await signIn('g2@x.io');
    expect((await app.inject({ method: 'POST', url: `/api/invites/${lobby.code}/join`, headers: as(g1), payload: { character: hero('G1') } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/invites/${lobby.code}/join`, headers: as(g2), payload: { character: hero('G2') } })).statusCode).toBe(409);
  });
});

describe('heroes', () => {
  const newHero = (mode: 'solo' | 'multi', name = 'Ara') => ({
    mode, name, race: 'sunborn', profession: 'mystic', bonus: { int: 10 },
    look: { head: 1, torso: 2, legs: 0 }, dice: { d6: 'ruby', d10: 'gold', d100: 'void' },
  });

  it('keeps heroes apart from games, and a hero plays several games at once', async () => {
    const s = await signIn('heroes@x.io');
    const made = await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: newHero('solo') } });
    expect(made.statusCode).toBe(201);
    const id = made.json().hero.id;
    const list = (await app.inject({ method: 'GET', url: '/api/heroes', headers: as(s) })).json().heroes;
    expect(list).toHaveLength(1);
    expect(list[0].look).toEqual({ head: 1, torso: 2, legs: 0 });
    for (const missions of [['hunter', 'scout'], ['hunter', 'scout']]) {
      const g = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, heroId: id, missions } });
      expect(g.statusCode).toBe(201);
      const state: GameState = (await app.inject({ method: 'GET', url: `/api/games/${g.json().id}`, headers: as(s) })).json().state;
      expect(state.players[0]!.character.name).toBe('Ara');
      expect(state.players[0]!.character.dice?.d6).toBe('ruby');
    }
  });

  it('keeps each game\'s share of the career goals on the hero', async () => {
    const s = await signIn('career@x.io');
    const id = (await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: newHero('solo') } })).json().hero.id;
    const g = (await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, heroId: id, missions: ['hunter', 'scout'] } })).json().id;
    const state: GameState = (await app.inject({ method: 'GET', url: `/api/games/${g}`, headers: as(s) })).json().state;
    expect(state.players[0]!.character.heroId).toBe(id);
    const act = await app.inject({ method: 'POST', url: `/api/games/${g}/actions`, headers: as(s), payload: { version: state.version, action: { type: 'endTurn' } } });
    expect(act.statusCode).toBe(200);
    const hero = (await app.inject({ method: 'GET', url: '/api/heroes', headers: as(s) })).json().heroes[0];
    expect(hero.career[g]).toMatchObject({ cards: 0, level: 1, rune: false });
    // A hero sent from the client never brings a career of its own.
    const sneaky = await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: { ...newHero('solo', 'Bo'), career: { x: { cards: 99 } } } } });
    expect(sneaky.json().hero.career).toBeUndefined();
  });

  it('a single-player hero cannot play multiplayer, and the other way round', async () => {
    const s = await signIn('modes@x.io');
    const soloHero = (await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: newHero('solo') } })).json().hero.id;
    const multiHero = (await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: newHero('multi', 'Bo') } })).json().hero.id;
    const a = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: multi, heroId: soloHero, missions: ['hunter', 'scout'] } });
    expect(a.statusCode).toBe(422);
    expect(a.json().error).toBe('hero.mode');
    const b = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: solo, heroId: multiHero, missions: ['hunter', 'scout'] } });
    expect(b.statusCode).toBe(422);
    const c = await app.inject({ method: 'POST', url: '/api/games', headers: as(s), payload: { config: multi, heroId: multiHero, missions: ['hunter', 'scout'] } });
    expect(c.statusCode).toBe(201);
  });

  it('refuses a broken hero and hides heroes from other players', async () => {
    const s = await signIn('broken@x.io');
    const bad = await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: { ...newHero('solo'), profession: 'warrior' } } });
    expect(bad.statusCode).toBe(422);
    const id = (await app.inject({ method: 'POST', url: '/api/heroes', headers: as(s), payload: { hero: newHero('solo') } })).json().hero.id;
    const other = await signIn('other@x.io');
    const g = await app.inject({ method: 'POST', url: '/api/games', headers: as(other), payload: { config: solo, heroId: id, missions: ['hunter', 'scout'] } });
    expect(g.statusCode).toBe(404);
  });
});
