import Fastify from 'fastify';
import { applyAction, createGame, EngineError, type Action, type GameConfig, type GameState, type NewPlayer } from '@hp/engine';

/**
 * Milestone 1 server skeleton: games live in memory. Milestone 3 moves them to Postgres,
 * adds sign-in and the 3-game limit; milestone 4 adds turn deadlines and notifications.
 */
const games = new Map<string, GameState>();
const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

app.post<{ Body: { seed?: string; config: GameConfig; players: NewPlayer[] } }>('/games', async (req, reply) => {
  const id = crypto.randomUUID();
  const game = createGame(req.body.seed ?? id, req.body.config, req.body.players);
  games.set(id, game);
  return reply.code(201).send({ id, game });
});

app.get<{ Params: { id: string } }>('/games/:id', async (req, reply) => {
  const game = games.get(req.params.id);
  return game ? { id: req.params.id, game } : reply.code(404).send({ error: 'not_found' });
});

app.post<{ Params: { id: string }; Body: { player: string; version: number; action: Action } }>(
  '/games/:id/actions',
  async (req, reply) => {
    const game = games.get(req.params.id);
    if (!game) return reply.code(404).send({ error: 'not_found' });
    // Optimistic concurrency: a stale or repeated submit is refused instead of applied twice.
    if (req.body.version !== game.version) return reply.code(409).send({ error: 'stale_version', version: game.version });
    const next = applyAction(game, req.body.player, req.body.action);
    games.set(req.params.id, next);
    return { id: req.params.id, game: next };
  },
);

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof EngineError) return reply.code(422).send({ error: err.code, message: err.message });
  reply.code(500).send({ error: 'internal' });
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '0.0.0.0' });
