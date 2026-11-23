import { existsSync } from 'node:fs';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Action, CharacterInput, GameConfig } from '@hp/engine';
import { logout, startLogin, userForSession, validEmail, verifyLogin, type Mailer, type User } from './auth';
import type { Db } from './db';
import { ApiError, Games, type TurnNotifier } from './games';

export interface AppOptions {
  db: Db;
  mail: Mailer;
  /** Where sign-in links and turn emails point, e.g. https://hidden-paths.onrender.com */
  appUrl: string;
  /** Built web app to serve on the same origin, if present. */
  webDir?: string;
  clock?: () => Date;
  /** Return sign-in links in the response (local development and tests only). */
  exposeLinks?: boolean;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

const locale = (v: unknown): 'pl' | 'en' => (v === 'pl' ? 'pl' : 'en');

export async function buildApp(opts: AppOptions) {
  const { db } = opts;
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024 });

  /** Emails the player whose turn it is. */
  const notify: TurnNotifier = async (userId, gameId) => {
    const [u] = await db.query<{ email: string; locale: string }>(`select email, locale from users where id = $1`, [userId]);
    if (!u) return;
    const pl = u.locale === 'pl';
    const link = `${opts.appUrl.replace(/\/$/, '')}/?game=${gameId}`;
    await opts.mail(
      u.email,
      pl ? 'Twoja kolej w Hidden Paths' : 'Your turn in Hidden Paths',
      `<p>${pl ? 'Twoja kolej! Masz 12 godzin. Szybka odpowiedź daje dodatkowe PD.' : 'It is your turn! You have 12 hours. A quick reply earns bonus XP.'}</p><p><a href="${link}">${pl ? 'Graj' : 'Play'}</a></p>`,
      `${pl ? 'Twoja kolej' : 'Your turn'}: ${link}`,
    );
  };
  const games = new Games(db, opts.clock, notify);
  app.decorate('games', games);

  app.decorateRequest('user', null);
  app.addHook('preHandler', async (req) => {
    const auth = req.headers.authorization;
    req.user = auth?.startsWith('Bearer ') ? await userForSession(db, auth.slice(7)) : null;
  });

  const signedIn = (req: FastifyRequest): User => {
    if (!req.user) throw new ApiError(401, 'auth.required', 'Sign in first.');
    return req.user;
  };

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply: FastifyReply) => {
    if (err instanceof ApiError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err.validation || (err.statusCode && err.statusCode < 500)) return reply.code(err.statusCode ?? 400).send({ error: 'request.invalid', message: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong on the server.' });
  });

  app.get('/api/health', async () => ({ ok: true }));

  // Sign-in by email link.
  app.post<{ Body: { email: string; locale?: string } }>('/api/auth/start', async (req) => {
    const email = String(req.body?.email ?? '');
    if (!validEmail(email.trim())) throw new ApiError(422, 'auth.email', 'Enter a valid email address.');
    const link = await startLogin(db, opts.mail, opts.appUrl, email, locale(req.body?.locale));
    return opts.exposeLinks ? { sent: true, link } : { sent: true };
  });
  app.post<{ Body: { token: string; locale?: string } }>('/api/auth/verify', async (req) => {
    const result = await verifyLogin(db, String(req.body?.token ?? ''), locale(req.body?.locale));
    if (!result) throw new ApiError(401, 'auth.link', 'This sign-in link has expired or was already used.');
    return result;
  });
  app.post('/api/auth/logout', async (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) await logout(db, auth.slice(7));
    return { ok: true };
  });
  app.get('/api/me', async (req) => ({ user: signedIn(req) }));
  app.patch<{ Body: { displayName?: string; locale?: string } }>('/api/me', async (req) => {
    const user = signedIn(req);
    const name = req.body?.displayName?.trim().slice(0, 24);
    await db.query(`update users set display_name = coalesce($2, display_name), locale = coalesce($3, locale) where id = $1`, [user.id, name || null, req.body?.locale ? locale(req.body.locale) : null]);
    return { user: await userForSession(db, req.headers.authorization!.slice(7)) };
  });

  // Games.
  app.get('/api/games', async (req) => ({ games: await games.list(signedIn(req)) }));
  app.post<{ Body: { config: GameConfig; character: CharacterInput; seed?: string; maxPlayers?: number } }>('/api/games', async (req, reply) => {
    const user = signedIn(req);
    const { config, character, seed, maxPlayers } = req.body ?? ({} as never);
    const created = config?.multiplayer
      ? await games.createLobby(user, config, character, maxPlayers ?? 2)
      : await games.createSolo(user, config, character, seed);
    return reply.code(201).send(created);
  });
  app.get<{ Params: { id: string } }>('/api/games/:id', async (req) => games.get(signedIn(req), req.params.id));
  app.post<{ Params: { id: string }; Body: { version: number; action: Action } }>('/api/games/:id/actions', async (req) => {
    return games.act(signedIn(req), req.params.id, Number(req.body?.version), req.body?.action);
  });
  app.post<{ Params: { id: string } }>('/api/games/:id/start', async (req) => {
    await games.start(signedIn(req), req.params.id);
    return { ok: true };
  });
  app.delete<{ Params: { id: string } }>('/api/games/:id', async (req) => {
    await games.abandon(signedIn(req), req.params.id);
    return { ok: true };
  });
  app.get<{ Params: { code: string } }>('/api/invites/:code', async (req) => {
    const id = await games.lobbyByCode(req.params.code);
    const [g] = await db.query<{ config: GameConfig; max_players: number; players: number; host: string }>(
      `select g.config, g.max_players, (select count(*)::int from game_players p where p.game_id = g.id) as players,
              (select display_name from users u where u.id = g.created_by) as host
         from games g where g.id = $1`,
      [id],
    );
    return { id, ...g };
  });
  app.post<{ Params: { code: string }; Body: { character: CharacterInput } }>('/api/invites/:code/join', async (req) => {
    return games.join(signedIn(req), req.params.code, req.body?.character);
  });

  // The web app, on the same origin so no cross-site setup is needed.
  if (opts.webDir && existsSync(opts.webDir)) {
    await app.register(fastifyStatic, { root: opts.webDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'No such endpoint.' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    games: Games;
  }
}
