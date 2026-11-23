import type { Action, CharacterInput, GameConfig, GameState, LogEntry } from '@hp/engine';

/** Talks to the game server on the same origin. Without a server the app plays solo games locally. */

const SESSION_KEY = 'hidden-paths.session';

export function getSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSession(session: string | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, session);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage can be unavailable */
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = getSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? res.statusText);
  return data as T;
}

/** True when the game server answers; false in an offline build (solo only). */
export async function serverAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

export interface Me {
  id: string;
  email: string;
  display_name: string;
  locale: string;
}

export interface GameSummary {
  id: string;
  mode: 'solo' | 'multi';
  status: 'lobby' | 'active' | 'finished';
  config: GameConfig;
  round: number;
  turn_deadline_at: string | null;
  your_turn: boolean;
  players: number;
}

export interface GameView {
  id: string;
  mode: 'solo' | 'multi';
  status: 'lobby' | 'active' | 'finished' | 'abandoned';
  config: GameConfig;
  maxPlayers: number;
  host: string;
  deadline: string | null;
  invite: string | null;
  state: GameState | null;
  players: { userId: string; name: string; seat: number; status: string; hero: string; race: string }[];
}

export const api = {
  startLogin: (email: string, locale: string) => call<{ sent: boolean; link?: string }>('POST', '/auth/start', { email, locale }),
  verifyLogin: (token: string, locale: string) => call<{ session: string; user: Me }>('POST', '/auth/verify', { token, locale }),
  logout: () => call('POST', '/auth/logout', {}),
  me: () => call<{ user: Me }>('GET', '/me'),
  updateMe: (displayName: string, locale: string) => call<{ user: Me }>('PATCH', '/me', { displayName, locale }),
  games: () => call<{ games: GameSummary[] }>('GET', '/games'),
  game: (id: string) => call<GameView>('GET', `/games/${id}`),
  create: (config: GameConfig, character: CharacterInput, maxPlayers: number, seed?: string) =>
    call<{ id: string; code?: string }>('POST', '/games', { config, character, maxPlayers, seed }),
  act: (id: string, version: number, action: Action) => call<{ state: GameState; entries: LogEntry[] }>('POST', `/games/${id}/actions`, { version, action }),
  start: (id: string) => call('POST', `/games/${id}/start`, {}),
  abandon: (id: string) => call('DELETE', `/games/${id}`),
  invite: (code: string) => call<{ id: string; config: GameConfig; max_players: number; players: number; host: string }>('GET', `/invites/${encodeURIComponent(code)}`),
  join: (code: string, character: CharacterInput) => call<{ id: string }>('POST', `/invites/${encodeURIComponent(code)}/join`, { character }),
};
