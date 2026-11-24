import { randomBytes, randomUUID } from 'node:crypto';
import {
  applyAction, careerOf, createGame, currentPlayer, grantXp, newEntries, timeoutTurn, validateCharacter, EngineError,
  type Action, type CharacterInput, type GameConfig, type GameState, type LogEntry,
} from '@hp/engine';
import type { User } from './auth';
import type { Db } from './db';

/** A player may be in at most this many unfinished games (lobbies included). */
export const MAX_OPEN_GAMES = 3;
/** Each multiplayer turn has this long before it ends on its own. */
export const TURN_HOURS = 12;
/** After this many missed turns in a row, a player's turns are skipped quickly so others are not held up. */
export const MAX_MISSED_TURNS = 3;
/** Quick-reply rewards: finishing your turn within these hours gives this much XP. */
export const QUICK_REWARDS = [
  { hours: 1, kind: 'quick_1h', xp: 3 },
  { hours: 3, kind: 'quick_3h', xp: 1 },
] as const;
export const MAX_PLAYERS = 4;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface GameRow {
  id: string;
  mode: 'solo' | 'multi';
  status: 'lobby' | 'active' | 'finished' | 'abandoned';
  config: GameConfig;
  seed: string;
  max_players: number;
  state: GameState | null;
  version: number;
  round: number;
  turn_started_at: Date | null;
  turn_deadline_at: Date | null;
  created_by: string;
}

export interface PlayerRow {
  user_id: string;
  seat: number;
  character: CharacterInput;
  status: 'active' | 'inactive' | 'left';
  missed_turns: number;
  placement: number | null;
  display_name: string;
}

/** Tells a player it is their turn. Wired to email in production. */
export type TurnNotifier = (userId: string, gameId: string) => Promise<void>;

const HOUR = 3_600_000;

export class Games {
  constructor(
    private db: Db,
    private clock: () => Date = () => new Date(),
    private notify: TurnNotifier = async () => {},
  ) {}

  private async openCount(tx: Db, userId: string): Promise<number> {
    // Lock the user's row so two simultaneous creates cannot both pass the limit.
    await tx.query(`select id from users where id = $1 for update`, [userId]);
    const [row] = await tx.query<{ n: number }>(
      `select count(*)::int as n from game_players p join games g on g.id = p.game_id
        where p.user_id = $1 and p.status <> 'left' and g.status in ('lobby', 'active')`,
      [userId],
    );
    return row?.n ?? 0;
  }

  private checkCharacter(character: CharacterInput) {
    try {
      validateCharacter(character);
    } catch (e) {
      if (e instanceof EngineError) throw new ApiError(422, e.code, e.message);
      throw e;
    }
  }

  private checkConfig(config: GameConfig) {
    const sizes = ['short', 'medium', 'long', 'epic'];
    const levels = ['easy', 'normal', 'hard', 'nightmare'];
    if (!sizes.includes(config?.size) || !levels.includes(config?.difficulty) || !['stone', 'exploration'].includes(config?.winMode)) {
      throw new ApiError(422, 'game.config', 'Unknown map size, difficulty or goal.');
    }
  }

  /** A solo game starts at once. */
  async createSolo(user: User, config: GameConfig, character: CharacterInput, seed?: string) {
    this.checkConfig(config);
    this.checkCharacter(character);
    return this.db.tx(async (tx) => {
      if ((await this.openCount(tx, user.id)) >= MAX_OPEN_GAMES) throw new ApiError(409, 'slots.full', `You can have ${MAX_OPEN_GAMES} games at once.`);
      const id = randomUUID();
      const cfg = { ...config, multiplayer: false };
      const state = createGame(seed ?? id, cfg, [{ id: user.id, character }]);
      await tx.query(
        `insert into games (id, mode, status, config, seed, max_players, state, version, round, turn_started_at, created_by)
         values ($1, 'solo', 'active', $2, $3, 1, $4, $5, 1, $6, $7)`,
        [id, cfg, seed ?? id, state, state.version, this.clock(), user.id],
      );
      await tx.query(`insert into game_players (game_id, user_id, seat, character) values ($1, $2, 0, $3)`, [id, user.id, character]);
      return { id };
    });
  }

  /** A multiplayer lobby with an invite code; it starts when the host says so. */
  async createLobby(user: User, config: GameConfig, character: CharacterInput, maxPlayers: number) {
    this.checkConfig(config);
    this.checkCharacter(character);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > MAX_PLAYERS) throw new ApiError(422, 'game.players', 'A multiplayer game has 2 to 4 players.');
    return this.db.tx(async (tx) => {
      if ((await this.openCount(tx, user.id)) >= MAX_OPEN_GAMES) throw new ApiError(409, 'slots.full', `You can have ${MAX_OPEN_GAMES} games at once.`);
      const id = randomUUID();
      const code = randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 6).toUpperCase();
      await tx.query(
        `insert into games (id, mode, status, config, seed, max_players, created_by) values ($1, 'multi', 'lobby', $2, $3, $4, $5)`,
        [id, { ...config, multiplayer: true }, id, maxPlayers, user.id],
      );
      await tx.query(`insert into game_players (game_id, user_id, seat, character) values ($1, $2, 0, $3)`, [id, user.id, character]);
      await tx.query(`insert into invites (code, game_id, expires_at) values ($1, $2, $3)`, [code, id, new Date(this.clock().getTime() + 7 * 24 * HOUR)]);
      return { id, code };
    });
  }

  async lobbyByCode(code: string) {
    const [row] = await this.db.query<{ game_id: string }>(
      `select i.game_id from invites i join games g on g.id = i.game_id where i.code = $1 and i.expires_at > $2 and g.status = 'lobby'`,
      [code.trim().toUpperCase(), this.clock()],
    );
    if (!row) throw new ApiError(404, 'invite.notFound', 'That invite is not valid any more.');
    return row.game_id;
  }

  async join(user: User, code: string, character: CharacterInput) {
    this.checkCharacter(character);
    const gameId = await this.lobbyByCode(code);
    return this.db.tx(async (tx) => {
      const [game] = await tx.query<GameRow>(`select * from games where id = $1 for update`, [gameId]);
      if (!game || game.status !== 'lobby') throw new ApiError(409, 'lobby.closed', 'This game has already started.');
      const players = await tx.query<{ user_id: string }>(`select user_id from game_players where game_id = $1`, [gameId]);
      if (players.some((p) => p.user_id === user.id)) return { id: gameId };
      if (players.length >= game.max_players) throw new ApiError(409, 'lobby.full', 'This game is full.');
      if ((await this.openCount(tx, user.id)) >= MAX_OPEN_GAMES) throw new ApiError(409, 'slots.full', `You can have ${MAX_OPEN_GAMES} games at once.`);
      await tx.query(`insert into game_players (game_id, user_id, seat, character) values ($1, $2, $3, $4)`, [gameId, user.id, players.length, character]);
      return { id: gameId };
    });
  }

  /** The host starts the game once at least 2 players are in. */
  async start(user: User, gameId: string) {
    const first = await this.db.tx(async (tx) => {
      const [game] = await tx.query<GameRow>(`select * from games where id = $1 for update`, [gameId]);
      if (!game) throw new ApiError(404, 'game.notFound', 'No such game.');
      if (game.created_by !== user.id) throw new ApiError(403, 'game.notHost', 'Only the host can start the game.');
      if (game.status !== 'lobby') throw new ApiError(409, 'lobby.closed', 'This game has already started.');
      const players = await tx.query<PlayerRow>(`select * from game_players where game_id = $1 order by seat`, [gameId]);
      if (players.length < 2) throw new ApiError(409, 'lobby.tooFew', 'Wait for at least one more player.');
      const state = createGame(game.seed, game.config, players.map((p) => ({ id: p.user_id, character: p.character })));
      const now = this.clock();
      await tx.query(
        `update games set status = 'active', state = $2, version = $3, round = 1, turn_started_at = $4, turn_deadline_at = $5, updated_at = $4 where id = $1`,
        [gameId, state, state.version, now, new Date(now.getTime() + TURN_HOURS * HOUR)],
      );
      await tx.query(`delete from invites where game_id = $1`, [gameId]);
      return currentPlayer(state).id;
    });
    await this.notify(first, gameId).catch(() => {});
  }

  async list(user: User) {
    return this.db.query<{ id: string; mode: string; status: string; config: GameConfig; round: number; turn_deadline_at: Date | null; your_turn: boolean; players: number; updated_at: Date }>(
      `select g.id, g.mode, g.status, g.config, g.round, g.turn_deadline_at, g.updated_at,
              (g.status = 'active' and g.state->'turnOrder'->>(g.state->>'turnIndex')::int = p.user_id::text) as your_turn,
              (select count(*)::int from game_players x where x.game_id = g.id) as players
         from games g join game_players p on p.game_id = g.id
        where p.user_id = $1 and p.status <> 'left' and g.status <> 'abandoned'
        order by g.updated_at desc limit 20`,
      [user.id],
    );
  }

  async get(user: User, gameId: string) {
    const [game] = await this.db.query<GameRow>(`select * from games where id = $1`, [gameId]);
    if (!game) throw new ApiError(404, 'game.notFound', 'No such game.');
    const players = await this.db.query<PlayerRow>(
      `select p.*, u.display_name from game_players p join users u on u.id = p.user_id where p.game_id = $1 order by p.seat`,
      [gameId],
    );
    if (!players.some((p) => p.user_id === user.id)) throw new ApiError(403, 'game.notPlayer', 'You are not in this game.');
    const [invite] = game.status === 'lobby' ? await this.db.query<{ code: string }>(`select code from invites where game_id = $1`, [gameId]) : [];
    return {
      id: game.id, mode: game.mode, status: game.status, config: game.config, maxPlayers: game.max_players,
      host: game.created_by, deadline: game.turn_deadline_at, invite: invite?.code ?? null, state: game.state,
      players: players.map((p) => ({ userId: p.user_id, name: p.display_name, seat: p.seat, status: p.status, hero: p.character.name, race: p.character.race })),
    };
  }

  /** Plays one action for the signed-in player, saving it with the version check. */
  async act(user: User, gameId: string, version: number, action: Action) {
    const result = await this.db.tx(async (tx) => {
      const [game] = await tx.query<GameRow>(`select * from games where id = $1 for update`, [gameId]);
      if (!game) throw new ApiError(404, 'game.notFound', 'No such game.');
      if (game.status !== 'active' || !game.state) throw new ApiError(409, 'game.notActive', 'This game is not running.');
      // Optimistic concurrency: a stale or repeated submit is refused instead of applied twice.
      if (version !== game.version) throw new ApiError(409, 'game.stale', 'The game moved on; reload it.');
      let next: GameState;
      try {
        next = applyAction(game.state, user.id, action);
      } catch (e) {
        if (e instanceof EngineError) throw new ApiError(422, e.code, e.message);
        throw e;
      }
      const entries = newEntries(game.state, next);
      await tx.query(`insert into actions (game_id, seq, user_id, round, action, log) values ($1, $2, $3, $4, $5, $6)`, [gameId, next.version, user.id, game.state.round, action, entries]);
      const turnPassed = entries.some((e) => e.type === 'turnEnded');
      if (turnPassed) next = await this.finishTurn(tx, game, next, user.id, false);
      await this.save(tx, game, next, turnPassed);
      // Career goals: the hero keeps this game's latest share of them.
      const me = next.players.find((p) => p.id === user.id);
      if (me?.character.heroId) {
        await tx.query(
          `update heroes set data = data || jsonb_build_object('career', coalesce(data->'career', '{}'::jsonb) || jsonb_build_object($3::text, $4::jsonb))
            where id::text = $1 and user_id = $2`,
          [me.character.heroId, user.id, gameId, JSON.stringify(careerOf(me))],
        );
      }
      return { state: next, entries, nextPlayer: turnPassed && game.mode === 'multi' ? currentPlayer(next).id : null };
    });
    if (result.nextPlayer && result.nextPlayer !== user.id) await this.notify(result.nextPlayer, gameId).catch(() => {});
    return { state: result.state, entries: result.entries };
  }

  /** Quick-reply rewards and missed-turn bookkeeping when a multiplayer turn ends. */
  private async finishTurn(tx: Db, game: GameRow, state: GameState, userId: string, timedOut: boolean): Promise<GameState> {
    if (game.mode !== 'multi') return state;
    if (timedOut) {
      await tx.query(
        `update game_players set missed_turns = missed_turns + 1,
                status = case when missed_turns + 1 >= $3 then 'inactive' else status end
          where game_id = $1 and user_id = $2`,
        [game.id, userId, MAX_MISSED_TURNS],
      );
      return state;
    }
    await tx.query(`update game_players set missed_turns = 0, status = 'active' where game_id = $1 and user_id = $2`, [game.id, userId]);
    const elapsed = game.turn_started_at ? this.clock().getTime() - new Date(game.turn_started_at).getTime() : Infinity;
    const reward = QUICK_REWARDS.find((r) => elapsed <= r.hours * HOUR);
    if (!reward) return state;
    const [row] = await tx.query(
      `insert into rewards (game_id, user_id, round, kind, value) values ($1, $2, $3, $4, $5) on conflict do nothing returning kind`,
      [game.id, userId, game.state!.round, reward.kind, reward.xp],
    );
    return row ? grantXp(state, userId, reward.xp) : state;
  }

  private async save(tx: Db, game: GameRow, state: GameState, turnPassed: boolean) {
    const now = this.clock();
    let started = game.turn_started_at;
    let deadline = game.turn_deadline_at;
    if (turnPassed) {
      started = now;
      deadline = null;
      if (game.mode === 'multi') {
        const [next] = await tx.query<{ status: string }>(`select status from game_players where game_id = $1 and user_id = $2`, [game.id, currentPlayer(state).id]);
        // An inactive player's turn ends almost at once, so the others keep playing.
        deadline = new Date(now.getTime() + (next && next.status !== 'active' ? 60_000 : TURN_HOURS * HOUR));
      }
    }
    const status = state.winner ? 'finished' : game.status;
    await tx.query(
      `update games set state = $2, version = $3, round = $4, status = $5, turn_started_at = $6, turn_deadline_at = $7, updated_at = $8 where id = $1`,
      [game.id, state, state.version, state.round, status, started, status === 'finished' ? null : deadline, now],
    );
    if (state.winner) {
      await tx.query(`update game_players set placement = case when user_id = $2 then 1 else 2 end where game_id = $1`, [game.id, state.winner]);
    }
  }

  /** Ends every multiplayer turn whose deadline passed. Returns how many were ended. */
  async sweepDeadlines(): Promise<number> {
    let ended = 0;
    for (;;) {
      const done = await this.db.tx(async (tx) => {
        const [game] = await tx.query<GameRow>(
          `select * from games where status = 'active' and turn_deadline_at is not null and turn_deadline_at <= $1
            order by turn_deadline_at limit 1 for update skip locked`,
          [this.clock()],
        );
        if (!game || !game.state) return null;
        const userId = currentPlayer(game.state).id;
        let next = timeoutTurn(game.state);
        await tx.query(`insert into actions (game_id, seq, user_id, round, action, log) values ($1, $2, $3, $4, $5, $6)`, [game.id, next.version, null, game.state.round, { type: 'timeout' }, newEntries(game.state, next) as LogEntry[]]);
        next = await this.finishTurn(tx, game, next, userId, true);
        await this.save(tx, game, next, true);
        return { gameId: game.id, nextPlayer: currentPlayer(next).id };
      });
      if (!done) return ended;
      ended++;
      await this.notify(done.nextPlayer, done.gameId).catch(() => {});
    }
  }

  /** Leaves or gives up a game: solo games and lobbies you host are closed, otherwise you leave. */
  async abandon(user: User, gameId: string) {
    await this.db.tx(async (tx) => {
      const [game] = await tx.query<GameRow>(`select * from games where id = $1 for update`, [gameId]);
      if (!game) throw new ApiError(404, 'game.notFound', 'No such game.');
      if (game.mode === 'solo' || (game.status === 'lobby' && game.created_by === user.id)) {
        if (game.created_by !== user.id) throw new ApiError(403, 'game.notPlayer', 'You are not in this game.');
        await tx.query(`update games set status = 'abandoned', turn_deadline_at = null where id = $1`, [gameId]);
      } else {
        await tx.query(`update game_players set status = 'left' where game_id = $1 and user_id = $2`, [gameId, user.id]);
        if (game.status === 'lobby') await tx.query(`delete from game_players where game_id = $1 and user_id = $2`, [gameId, user.id]);
      }
    });
  }
}
