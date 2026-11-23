import postgres from 'postgres';

/**
 * A small database interface over two drivers: postgres.js in production and PGlite
 * (Postgres compiled to WebAssembly, in memory) for tests and local play without a server.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` in a transaction; a thrown error rolls it back. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function postgresDb(url: string): Db {
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  const wrap = (s: postgres.Sql | postgres.TransactionSql): Db => ({
    query: async <T>(text: string, params: unknown[] = []) => (await s.unsafe(text, params as never[])) as unknown as T[],
    tx: async (fn) => {
      if ('savepoint' in s && s !== sql) return fn(wrap(s));
      return (sql.begin((t) => fn(wrap(t))) as Promise<unknown>) as never;
    },
    close: () => sql.end(),
  });
  return wrap(sql);
}

/** PGlite for tests. Imported lazily so production does not need it. */
export async function memoryDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  type Q = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (q: Q, inTx: boolean): Db => ({
    query: async <T>(text: string, params: unknown[] = []) => (await q.query(text, params)).rows as T[],
    tx: async (fn) => (inTx ? fn(wrap(q, true)) : pg.transaction((t) => fn(wrap(t as unknown as Q, true)))),
    close: () => pg.close(),
  });
  return wrap(pg as unknown as Q, false);
}

/** The whole schema. Every statement is idempotent, so it runs on each start. */
export const SCHEMA = `
create table if not exists users (
  id uuid primary key,
  email text unique not null,
  display_name text not null default '',
  locale text not null default 'en',
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists login_tokens (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists games (
  id uuid primary key,
  mode text not null,
  status text not null,
  config jsonb not null,
  seed text not null,
  max_players int not null default 1,
  state jsonb,
  version int not null default 0,
  round int not null default 1,
  turn_started_at timestamptz,
  turn_deadline_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_deadline on games (turn_deadline_at) where status = 'active';
create table if not exists game_players (
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id),
  seat int not null,
  character jsonb not null,
  status text not null default 'active',
  missed_turns int not null default 0,
  placement int,
  primary key (game_id, user_id)
);
create table if not exists actions (
  game_id uuid not null references games(id) on delete cascade,
  seq int not null,
  user_id uuid,
  round int not null,
  action jsonb not null,
  log jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);
create table if not exists invites (
  code text primary key,
  game_id uuid not null references games(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists rewards (
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id),
  round int not null,
  kind text not null,
  value int not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id, round)
);
`;

export async function migrate(db: Db) {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
}
