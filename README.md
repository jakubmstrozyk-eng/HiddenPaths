# Hidden Paths

A turn-based web RPG set in a shattered world. Players explore hidden map fragments, survive events and fights, and level up one of six races. Every game is set up to fit the player's time: map size, difficulty and goal are chosen before it starts, and each player can run up to 3 games at once, alone or in async multiplayer.

## Layout

| Path | What it is |
| --- | --- |
| `packages/content` | Game data in Polish and English: races, professions, terrains, missions |
| `packages/engine` | The rules engine: seeded dice, d100 tests, map generator, characters, turns |
| `apps/web` | React web app (main menu, game setup, character creation, map) |
| `apps/server` | Fastify server skeleton (in-memory games for now) |

## Run it

```bash
pnpm install
pnpm test        # engine tests
pnpm dev         # web app on http://localhost:5173
pnpm dev:server  # API on http://localhost:8787
```

## Rules engine in one paragraph

`applyAction(state, playerId, action)` returns a new game state and never changes the old one. Dice come from a generator whose state is stored in the game, so any game can be replayed from its seed and action list. `legalActions(state, playerId)` lists what the current player can do, and the app draws its buttons from that list.

## Milestones

1. **Foundation** (this): monorepo, engine core, content format, map generator, menu and character creation
2. Solo playable: terrain actions, events, combat, towns, levelling, win modes
3. Accounts and deploy: sign-in, 3 game slots, Postgres, hosting
4. Async multiplayer: turns one after another, 12 hour deadlines, quick-reply rewards, notifications
5. Polish and beta
