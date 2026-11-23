# Hidden Paths

A turn-based web RPG set in a shattered world. Players explore hidden map fragments, survive events and fights, and level up one of six races. Every game is set up to fit the player's time: map size, difficulty and goal are chosen before it starts, and each player can run up to 3 games at once, alone or in async multiplayer.

## Layout

| Path | What it is |
| --- | --- |
| `packages/content` | Game data in Polish and English: races, professions, terrains, missions |
| `packages/engine` | The rules engine: seeded dice, d100 tests, map generator, characters, turns |
| `apps/web` | React web app (main menu, game setup, character creation, map) |
| `apps/server` | Fastify game server: email sign-in, Postgres storage, 3 game slots, async multiplayer turns |

## Run it

```bash
pnpm install
pnpm test        # engine and server tests (server tests use in-memory Postgres)
pnpm dev:server  # game server on http://localhost:8787 (in-memory database, sign-in links printed to the log)
pnpm dev         # web app on http://localhost:5173, sending /api to the server
```

Without a server the web app still plays solo games on the device. Set `DATABASE_URL` to use a real Postgres.

## Deploy (Render + Neon + Resend, free tiers)

`render.yaml` describes one web service that builds the web app and serves it with the API on the same address. In Render, choose **New > Blueprint**, pick this repository, and fill in:

| Setting | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled, with `sslmode=require`) |
| `APP_URL` | The service address, e.g. `https://hidden-paths.onrender.com` |
| `RESEND_API_KEY` | Resend API key, for sign-in and turn emails |
| `MAIL_FROM` | Sender, e.g. `Hidden Paths <onboarding@resend.dev>` until a domain is verified |

The database tables are created on first start. A free Render service sleeps after 15 minutes without visits; the first visit wakes it in about a minute, and turns that ran out while it slept are closed then.

## Rules engine in one paragraph

`applyAction(state, playerId, action)` returns a new game state and never changes the old one. Dice come from a generator whose state is stored in the game, so any game can be replayed from its seed and action list. `legalActions(state, playerId)` lists what the current player can do, and the app draws its buttons from that list.

## Milestones

1. **Foundation** (this): monorepo, engine core, content format, map generator, menu and character creation
2. Solo playable: terrain actions, events, combat, towns, levelling, win modes
3. Accounts and deploy: sign-in, 3 game slots, Postgres, hosting
4. Async multiplayer: turns one after another, 12 hour deadlines, quick-reply rewards, notifications
5. Polish and beta
