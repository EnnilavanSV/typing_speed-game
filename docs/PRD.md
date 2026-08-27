# Typing Speed Game — Product Requirements Document

**Author:** Ennilavan
**Date:** 2026-08-25
**Context:** Take-home assignment, Product Engineering Intern — Full Stack, Burdenoff
**Submission deadline:** August 27, 2026

> **Living document.** If scope, requirements, or the plan change during development, update this file (and `TECHNICAL_DESIGN.md`) in the same session — not after the fact.

## 1. Problem

Recruiters and take-home reviewers need a fast, objective way to gauge a candidate's typing accuracy and speed. The product is a small web game: a user types a sequence of randomly generated characters as fast and accurately as possible, gets scored on time (with a penalty for mistakes), and can see how they rank against other players.

## 2. Goals

- Let a user play a complete round (20 characters) and get an accurate, tamper-resistant score.
- Let a user see whether they beat their own best time.
- Let users compare scores against each other via a leaderboard.
- Keep accounts real: registration + login gate score submission, so leaderboard entries are attributable to real users, not anonymous input.

**Non-goals for this submission:** password reset flows, social login, multiplayer/real-time play, mobile app, admin moderation tools. These are reasonable follow-ups but out of scope for a 6–8 hour build.

## 3. Users

Single user type: a player. No admin role, no anonymous play — the assignment requires registration/login, so every game result is tied to an account.

## 4. Functional Requirements

**Gameplay**
- Game starts a timer at 0 seconds.
- 20 randomly generated alphabet characters are presented one at a time.
- Correct keypress advances to the next character.
- Incorrect keypress adds a 0.5 second penalty to the running time; the current character does not advance.
- Input focus is retained for the whole round (no clicking back into a text field mid-game).
- Progress is visible throughout (e.g., "10 / 20").
- On completing all 20 characters, the final time (base time + penalties) is shown.
- Result is compared against the player's previous best: **Success** if this run is faster, **Failure / Try Again** otherwise.

**Persistence**
- The player's best time persists locally (survives a page refresh) independent of the network.
- Every completed round is saved server-side as a game result.
- A leaderboard shows each player's best time, ranked fastest first.

**Accounts**
- A user can register with email + password.
- A user can log in and stay authenticated across requests.
- Game submission and personal best are tied to the authenticated user — not guessable or spoofable via client input.

## 5. Non-Functional Requirements

- Input validation on all mutations (malformed email, weak password, out-of-range game data all rejected before touching the database).
- GraphQL errors are specific and machine-readable (`extensions.code`), not generic 500s.
- At least one automated integration test runs against a real Postgres instance, not a mock.
- Setup instructions let a reviewer run the whole stack (`docker compose up` + a couple of commands) without guessing.

## 6. Constraints

- Backend stack is fixed by the assignment: Bun + TypeScript, GraphQL Yoga, PostgreSQL, Prisma, Docker Compose.
- Frontend is unrestricted — chosen: React + Vite + TypeScript.
- Effort budget: 6–8 hours. Design choices favor a clean, correct, defensible solution over a maximally "complete" one — see `TECHNICAL_DESIGN.md` for what was deliberately left out and why.
- Deadline: submit GitHub repo + walkthrough video by August 27, via the application email (ennilavan.contact@gmail.com).

## 7. Success Criteria

- A reviewer can clone the repo, run one setup command, and play a full round end to end.
- Cheating the score via direct API calls (e.g., submitting someone else's result, or a suspiciously low time) is not trivially possible.
- The walkthrough can explain every architectural choice and its tradeoff, not just narrate what the code does.
