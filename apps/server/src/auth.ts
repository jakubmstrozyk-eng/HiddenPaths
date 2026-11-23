import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from './db';

export const LOGIN_TOKEN_MINUTES = 20;
export const SESSION_DAYS = 60;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export interface User {
  id: string;
  email: string;
  display_name: string;
  locale: string;
}

/** Sends one email. The real sender uses Resend; tests and local runs collect mail in memory. */
export type Mailer = (to: string, subject: string, html: string, text: string) => Promise<void>;

export function resendMailer(apiKey: string, from: string): Mailer {
  return async (to, subject, html, text) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) throw new Error(`Email failed: ${res.status}`);
  };
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

/** Starts sign-in: stores a one-time token and emails a link carrying it. Returns the link. */
export async function startLogin(db: Db, mail: Mailer, appUrl: string, rawEmail: string, locale: 'pl' | 'en'): Promise<string> {
  const email = normaliseEmail(rawEmail);
  const token = newToken();
  await db.query(`insert into login_tokens (token_hash, email, expires_at) values ($1, $2, now() + interval '${LOGIN_TOKEN_MINUTES} minutes')`, [hash(token), email]);
  const link = `${appUrl.replace(/\/$/, '')}/?login=${token}`;
  const pl = locale === 'pl';
  const subject = pl ? 'Twój link do Hidden Paths' : 'Your Hidden Paths sign-in link';
  const text = pl
    ? `Kliknij, aby się zalogować: ${link}\nLink działa przez ${LOGIN_TOKEN_MINUTES} minut.`
    : `Tap to sign in: ${link}\nThe link works for ${LOGIN_TOKEN_MINUTES} minutes.`;
  const html = `<p>${pl ? 'Kliknij, aby się zalogować do Hidden Paths:' : 'Tap to sign in to Hidden Paths:'}</p><p><a href="${link}">${pl ? 'Zaloguj się' : 'Sign in'}</a></p><p style="color:#777">${pl ? `Link działa przez ${LOGIN_TOKEN_MINUTES} minut.` : `The link works for ${LOGIN_TOKEN_MINUTES} minutes.`}</p>`;
  await mail(email, subject, html, text);
  return link;
}

/** Finishes sign-in: spends the token, creates the user on first sign-in, returns a session token. */
export async function verifyLogin(db: Db, token: string, locale: 'pl' | 'en'): Promise<{ session: string; user: User } | null> {
  return db.tx(async (tx) => {
    const [row] = await tx.query<{ email: string }>(
      `update login_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email`,
      [hash(token)],
    );
    if (!row) return null;
    let [user] = await tx.query<User>(`select id, email, display_name, locale from users where email = $1`, [row.email]);
    if (!user) {
      const name = row.email.split('@')[0]!.slice(0, 24);
      [user] = await tx.query<User>(
        `insert into users (id, email, display_name, locale) values ($1, $2, $3, $4) returning id, email, display_name, locale`,
        [randomUUID(), row.email, name, locale],
      );
    }
    const session = newToken();
    await tx.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [hash(session), user!.id]);
    return { session, user: user! };
  });
}

export async function userForSession(db: Db, session: string | undefined): Promise<User | null> {
  if (!session) return null;
  const [user] = await db.query<User>(
    `select u.id, u.email, u.display_name, u.locale from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()`,
    [hash(session)],
  );
  return user ?? null;
}

export async function logout(db: Db, session: string) {
  await db.query(`delete from sessions where token_hash = $1`, [hash(session)]);
}
