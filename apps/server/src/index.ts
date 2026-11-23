import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { resendMailer, type Mailer } from './auth';
import { memoryDb, migrate, postgresDb } from './db';

/**
 * Starts the server. Settings come from the environment:
 * - DATABASE_URL: Postgres connection string (Neon). Without it, an in-memory database is used.
 * - APP_URL: the public address, used in emailed links.
 * - RESEND_API_KEY and MAIL_FROM: email sending. Without them, links are printed to the log.
 * - PORT: defaults to 8787.
 */
const env = process.env;
const production = env.NODE_ENV === 'production';
const db = env.DATABASE_URL ? postgresDb(env.DATABASE_URL) : await memoryDb();
await migrate(db);

const consoleMailer: Mailer = async (to, subject, _html, text) => {
  console.log(`[mail] to ${to}: ${subject}\n${text}`);
};
const mail = env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY, env.MAIL_FROM ?? 'Hidden Paths <onboarding@resend.dev>') : consoleMailer;

const app = await buildApp({
  db,
  mail,
  appUrl: env.APP_URL ?? `http://localhost:${env.PORT ?? 8787}`,
  webDir: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  exposeLinks: !production && !env.RESEND_API_KEY,
  logger: true,
});

// Multiplayer turns end on their own after 12 hours; check once a minute.
const sweep = setInterval(() => {
  app.games.sweepDeadlines().catch((e) => app.log.error(e));
}, 60_000);

const close = async () => {
  clearInterval(sweep);
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);

await app.listen({ port: Number(env.PORT ?? 8787), host: '0.0.0.0' });
