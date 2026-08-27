# Typing Speed Game

A full-stack typing speed test. Register or log in, type 20 randomly generated letters as fast and accurately as possible (each mistake costs 0.5s), beat your own best time, and see how you rank on the leaderboard.

Built for the Product Engineering Intern — Full Stack take-home assignment (Burdenoff).

## Tech Stack

**Backend:** Bun, TypeScript, GraphQL Yoga, PostgreSQL, Prisma, Docker Compose
**Frontend:** React, Vite, TypeScript

## Features

- Registration and login (stateless JWT auth, no session store required)
- Typing game: 20 random letters, one at a time, 0.5s penalty per incorrect keypress, live timer, keyboard focus maintained throughout
- Best time persisted locally (survives a refresh, independent of the network) and separately tracked per account on the backend
- Leaderboard of top times across all players
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
    graphql.ts             GraphQL fetch helper

docs/
  PRD.md                  Product requirements
  TECHNICAL_DESIGN.md      Architecture, schema, API contract, and the
                           reasoning behind every major decision

docker-compose.yml     PostgreSQL + backend API
```

## Design Decisions

The full reasoning behind the schema, the API contract, and decisions like denormalizing the user's best time with an atomic conditional update (instead of a naive read-then-write, which would be vulnerable to race conditions under concurrent submissions), choosing stateless JWT over server-side sessions, and the GraphQL error convention, is documented in [`docs/TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md).

## Known Limitations

- Client-reported `timeMs` is trusted at face value beyond basic sanity validation (must be a positive integer) — full server-side timing verification is out of scope for this submission.
- No password reset flow, social login, or refresh token rotation — a single JWT with a 1-day expiry was chosen deliberately over a refresh-token setup, to keep the auth surface area proportional to a take-home's scope (see `docs/TECHNICAL_DESIGN.md` for the tradeoff).

## Walkthrough

[Video link to be added]
