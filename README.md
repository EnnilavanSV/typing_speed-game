# Typing Speed Game

A full-stack typing speed test. Register or log in, type 20 randomly generated letters as fast and accurately as possible (each mistake costs 0.5s), beat your own best time, and see how you rank on the leaderboard.

Built for the Product Engineering Intern — Full Stack take-home assignment (Burdenoff).

## Live Demo

- **App:** [typing-speed-game-beta.vercel.app](https://typing-speed-game-beta.vercel.app/)
- **API (GraphiQL playground):** [typing-speed-game-vnct.onrender.com/graphql](https://typing-speed-game-vnct.onrender.com/graphql)

The backend runs on Render's free tier, which spins down after 15 minutes of inactivity — the first request after a while can take about a minute to wake it back up.

## Tech Stack

**Backend:** Bun, TypeScript, GraphQL Yoga, PostgreSQL, Prisma, Docker Compose
**Frontend:** React, Vite, TypeScript, Tailwind CSS v4

## Features

- Registration and login (stateless JWT auth, no session store required)
- Typing game: 20 random letters, one at a time, 0.5s penalty per incorrect keypress, live timer, keyboard focus maintained throughout
- Best time persisted locally (survives a refresh, independent of the network) and separately tracked per account on the backend
- Leaderboard of top times across all players
- Per-user game history, shown on the home screen (backend-authenticated: `gameHistory` is scoped to the caller's JWT, no user can query another user's results)
- Input validation and specific, machine-readable GraphQL error codes (not generic 500s)
- Integration tests running against a real PostgreSQL database

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (runs the database and backend)
- [Bun](https://bun.sh) (runs the frontend dev server, and the backend directly if you're not using Docker for it)

## Setup

**1. Clone and configure environment variables:**

```bash
git clone <repo-url>
cd typing-speed-game
cp backend/.env.example backend/.env
```

**2. Start the backend (Postgres + GraphQL API), via Docker Compose:**

```bash
docker compose up -d --build
```

This starts PostgreSQL, automatically runs Prisma migrations against it, and starts the GraphQL API. The GraphiQL playground is available at **http://localhost:4000/graphql**.

**3. Start the frontend:**

```bash
cd frontend
bun install
bun run dev
```

Open **http://localhost:5173**.

## Running Tests

With `db` running (either via `docker compose up -d db` or the full stack above):

```bash
cd backend
bun test
```

This runs integration tests against the real database — no mocking — covering the atomic best-time-update logic (a completed game always gets recorded, but a user's best time only updates if the new run genuinely beats it, verified under both a slower and a faster subsequent submission).

## Project Structure

```
backend/
  src/
    schema.ts        GraphQL API contract (SDL)
    resolvers.ts      Query/Mutation implementations
    context.ts        Per-request auth (JWT verification) + Prisma client
    auth.ts            Password hashing, JWT signing
    validation.ts      Zod input validation schemas
    gameResultService.ts   Core game-result recording logic
  prisma/
    schema.prisma      Database schema
    migrations/         Applied migrations
  tests/
    gameResult.integration.test.ts

frontend/
  src/
    AuthContext.tsx    Login/register/session state
    AuthForm.tsx        Login/register UI
    Game.tsx             Core game: sequence, timer, penalty logic
    Leaderboard.tsx       Leaderboard view
    GameHistory.tsx        Recent games, shown on the home screen
    ThemeContext.tsx       Dark/light mode state + persistence
    ThemeToggle.tsx         Theme toggle button
    graphql.ts               GraphQL fetch helper

docs/
  PRD.md                  Product requirements
  TECHNICAL_DESIGN.md      Architecture, schema, API contract, and the
                           reasoning behind every major decision
  WALKTHROUGH.md            Written walkthrough of the implementation

docker-compose.yml     PostgreSQL + backend API
```

## Design Decisions

The full reasoning behind the schema, the API contract, and decisions like denormalizing the user's best time with an atomic conditional update (instead of a naive read-then-write, which would be vulnerable to race conditions under concurrent submissions), choosing stateless JWT over server-side sessions, and the GraphQL error convention, is documented in [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md).

## Design System

Styling is built with **Tailwind CSS v4**, using a custom color palette (`ruby-50` through `ruby-950`) derived from a base color of Ruby (`#E0115F`), paired with white/neutral surfaces. The palette is defined once in `frontend/src/index.css` under an `@theme` block, which makes `ruby-*` usable as ordinary Tailwind utility classes (`bg-ruby-600`, `text-ruby-400`, etc.) everywhere in the app.

Both light and dark modes are supported, toggled manually via the button in the header (`ThemeToggle.tsx`) rather than only following the OS preference. `ThemeContext.tsx` tracks the current theme, applies a `.dark` class to `<html>` accordingly, and persists the choice in `localStorage` so it's remembered across visits. On first visit with no saved preference, the app defaults to the browser/OS's own light-or-dark setting. A `@custom-variant dark` rule in `index.css` is what makes Tailwind's `dark:` utility classes key off that `.dark` class instead of only ever following `prefers-color-scheme`.

## Deployment

The live demo above runs on three separate free-tier services, each independent of the local Docker setup used for development:

- **Frontend (Vercel):** a static build of `frontend/`, produced by `vite build`. `frontend/src/graphql.ts` reads the backend URL from `VITE_GRAPHQL_ENDPOINT`, an environment variable set in Vercel and baked into the build at compile time — locally, with that variable unset, it falls back to `http://localhost:4000/graphql` automatically, so no code changes are needed between environments.
- **Backend (Render):** built and run from the same `backend/Dockerfile` used locally, as a long-running web service (not serverless) with `DATABASE_URL` and `JWT_SECRET` set as environment variables in Render's dashboard rather than a committed file.
- **Database (Neon):** a managed, serverless Postgres instance, replacing the local Docker `db` container for production. It's a separate database with separate data from local development — the same Prisma migrations were applied to both, but they don't share data. Its connection string requires `sslmode=require` (encrypted, since traffic now crosses the public internet rather than staying on `localhost`).

## Walkthrough

A written walkthrough of the implementation and the reasoning behind the key technical decisions is in [`docs/WALKTHROUGH.md`](./docs/WALKTHROUGH.md).

## Known Limitations

- Client-reported `timeMs` is trusted at face value beyond basic sanity validation (must be a positive integer) — full server-side timing verification is out of scope for this submission.
- No password reset flow, social login, or refresh token rotation — a single JWT with a 1-day expiry was chosen deliberately over a refresh-token setup, to keep the auth surface area proportional to a take-home's scope (see `docs/TECHNICAL_DESIGN.md` for the tradeoff).

