# Typing Speed Game — Technical Design Document

**Author:** Ennilavan
**Date:** 2026-08-25
**Companion doc:** `PRD.md`

> **Living document.** Any change to the schema, API contract, or a key decision below must be reflected here (and in `PRD.md` if scope is affected) at the same time the change is made — not retroactively.

## 1. Architecture Overview

```
┌─────────────────────┐        GraphQL over HTTP        ┌──────────────────────┐
│  React + Vite + TS  │ ───────────────────────────────▶ │  GraphQL Yoga (Bun)  │
│  (frontend, SPA)    │ ◀─────────────────────────────── │  + TypeScript        │
└─────────────────────┘        JWT in Authorization      └──────────┬───────────┘
                                                                     │ Prisma Client
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │     PostgreSQL       │
                                                          └──────────────────────┘
```

Local dev/orchestration: Docker Compose runs Postgres (and optionally the backend) as services, so `docker compose up` gets a reviewer to a working stack without manual DB setup.

## 2. Data Model

```prisma
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  bestTimeMs   Int?
  createdAt    DateTime     @default(now())
  results      GameResult[]
}

model GameResult {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  timeMs     Int
  errorCount Int      @default(0)
  createdAt  DateTime @default(now())

  @@index([timeMs])
}
```

`timeMs` is an integer, not a float — penalties are exact 500ms increments, so integer arithmetic avoids floating-point drift. Lower `timeMs` is a better score.

`GameResult` is the source of truth for every completed round (required for persistence + auditability + the integration test). `User.bestTimeMs` is a denormalized cache of the player's fastest `timeMs`, kept in sync so the leaderboard query never needs a `MAX()` aggregation across the whole results table.

## 3. API Contract

```graphql
type User {
  id: ID!
  email: String!
  bestTimeMs: Int
}

type GameResult {
  id: ID!
  timeMs: Int!
  errorCount: Int!
  createdAt: String!
}

type LeaderboardEntry {
  rank: Int!
  email: String!
  bestTimeMs: Int!
}

type AuthPayload {
  token: String!
  user: User!
}

type Query {
  me: User
  leaderboard(limit: Int = 10): [LeaderboardEntry!]!
}

type Mutation {
  register(email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  submitGameResult(timeMs: Int!, errorCount: Int!): GameResult!
}
```

`submitGameResult` intentionally has no `userId` argument — the acting user comes from the verified JWT in request context, never from client input. Accepting a client-supplied user id would let anyone submit fake scores for other players.

`me` returns nullable `User` rather than throwing when logged out — "not authenticated" is a normal state for this query, not an error condition. `leaderboard` requires no auth; it's public by nature.

**Error convention:** all resolver failures throw `GraphQLError` with a stable `extensions.code` (e.g. `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `BAD_USER_INPUT`) plus a human-readable message. The frontend branches on `code`, never on parsing message text.

## 4. Key Decisions

**Denormalize `bestTimeMs` on `User` rather than computing `MAX()` per check.**
The best-score comparison happens on every game submission — a hot path. A denormalized column turns that into an indexed point lookup. Cost: it can drift from the `GameResult` table if not updated correctly, which is why the update has to be atomic (see below). `GameResult` stays the source of truth so the cached value is always re-derivable if needed.

**Update `GameResult` insert + `User.bestTimeMs` update in a single transaction, with the comparison done at the SQL level.**
Two separate writes risk two failure modes: a crash between them leaves the tables inconsistent, and a read-then-write comparison in application code risks a lost update under concurrent requests. Fix: one transaction, and a conditional `UPDATE ... WHERE bestTimeMs IS NULL OR $new < bestTimeMs` so the database — not app code — makes the atomic comparison.

**Stateless JWT over server-side sessions.**
The mandated stack has no Redis or session store. A session-cookie approach would require a lookup (DB or cache) on every request just to resolve who's calling. A JWT carries identity in a signed payload, so authentication is a signature check — no per-request storage layer needed.

**No refresh token.**
The textbook production pattern is a short-lived access token plus a longer-lived refresh token (and a revocation table for the refresh tokens). For this scope, that's meaningfully more surface area — a second token type, a refresh endpoint, expiry handling on the client — for a benefit (seamless re-auth after expiry) that doesn't matter for a short demo session. Decision: a single JWT issued at login with a 1-day expiry, verified by signature only. Explicitly flagged here as a scope tradeoff, not an oversight.

**JWT stored client-side in `localStorage`, sent via `Authorization: Bearer`.**
Alternative was an `httpOnly` cookie (immune to XSS token theft, but reintroduces CSRF concerns and auto-attachment behavior that complicates a pure API backend with no server-rendered pages). Given the app has no other user-generated content that creates a realistic XSS vector, `localStorage` is the pragmatic choice for this scope — noted here as an accepted tradeoff, revisit if the app grows.

**Input validation via Zod.**
Chosen over hand-rolled checks because it pairs directly with TypeScript types and keeps validation declarative — one schema per mutation input, checked before any DB call.

**Docker Compose covers `db` and `backend`, not the frontend.**
The assignment mandates Docker Compose for "backend and infrastructure," not the frontend. Containerizing the frontend too would add a Dockerfile, a build stage, and a static-serving setup for no real benefit in a take-home reviewed by running `npm run dev` locally. Decision: `docker compose up` brings up Postgres and the GraphQL API; the frontend runs via its own dev server, documented in the README.

## 5. Testing Strategy

- Unit tests for pure logic: penalty calculation, win/loss comparison against best time.
- At least one integration test that runs against a real Postgres instance (via Docker) covering `submitGameResult` — insert + best-time update — and `leaderboard` ordering.
- Auth-path tests: duplicate email registration, wrong password, missing/invalid JWT on protected resolvers.

## 6. Edge Cases to Handle

- Duplicate registration email → `EMAIL_TAKEN`, not a generic DB constraint error leaking to the client.
- Expired/malformed JWT on a protected resolver → `UNAUTHENTICATED`, not a 500.
- `submitGameResult` with an implausible `timeMs` (e.g., 0 or negative) → rejected by validation; the server does not trust client-reported timing blindly for anything beyond storing it (full server-side timing verification is out of scope for this pass, noted as a known limitation).
- First-ever game for a user (`bestTimeMs` is `null`) → any completed run counts as success.
- Leaderboard with fewer than `limit` players → returns as many as exist, no padding/errors.

## 7. Milestones

Tracked as sprints: backend scaffold (Docker Compose, Prisma migration, Yoga skeleton) → auth → frontend game UI + timer/penalty logic → game-result persistence + leaderboard → tests, docs, and submission.
