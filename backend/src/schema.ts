// This exports one string constant: the description of our entire API,
// written in GraphQL's own language called "SDL" (Schema Definition Language).
// The `/* GraphQL */` comment right before the string does nothing at
// runtime — it's just a hint that lets VS Code's GraphQL extension apply
// syntax highlighting to the text inside.
export const typeDefs = /* GraphQL */ `
  # "type User" describes what a User object looks like when sent to the client.
  # This is NOT the same as the Prisma "model User" — that one describes the
  # database table; this one describes what we're willing to expose over the API.
  type User {
    id: ID! # "ID!" = a unique identifier, and "!" means it can never be null
    email: String! # "String!" = text that will always be present
    bestTimeMs: Int # no "!" here — this CAN be null, for a user who hasn't played yet
  }

  # Describes one row of a completed game, as sent to the client.
  type GameResult {
    id: ID!
    timeMs: Int!
    errorCount: Int!
    createdAt: String! # dates get sent as plain text over GraphQL
  }

  # One row of the leaderboard — notice this is DIFFERENT from User.
  # We don't want to expose every User field (like their raw id) on a
  # public leaderboard, so this is a purpose-built shape instead.
  type LeaderboardEntry {
    rank: Int!
    email: String!
    bestTimeMs: Int!
  }

  # What we hand back after a successful register or login: a token to
  # prove who you are on future requests, plus your own user info.
  type AuthPayload {
    token: String!
    user: User!
  }

  # "Query" lists every piece of data a client can ASK FOR (read-only).
  type Query {
    # Returns the currently logged-in user, or null if nobody's logged in.
    # No "!" after "User" because returning null is allowed and expected.
    me: User

    # Returns a list of leaderboard entries. "limit: Int = 10" means the
    # client can optionally pass how many rows they want, defaulting to 10
    # if they don't specify. "[LeaderboardEntry!]!" means: the list itself
    # is never null, and none of the entries inside it are null either.
    leaderboard(limit: Int = 10): [LeaderboardEntry!]!

    # Every game the CURRENTLY LOGGED-IN user has completed, newest first.
    # "limit" works exactly like leaderboard's — optional, defaults to 10.
    # Deliberately takes no "userId" argument at all — who this returns
    # results for comes only from the caller's own auth token
    # (context.userId), never from something a client could pass in. That's
    # what makes it impossible for one user to ever read another user's
    # history, by construction rather than by a permission check we could
    # forget to add.
    gameHistory(limit: Int = 10): [GameResult!]!
  }

  # "Mutation" lists every action a client can PERFORM (things that change data).
  type Mutation {
    # Create a new account. Takes an email and password, returns a token + user.
    register(email: String!, password: String!): AuthPayload!

    # Log into an existing account.
    login(email: String!, password: String!): AuthPayload!

    # Submit a finished game's result. On purpose, this does NOT take a
    # userId argument — the server figures out who's submitting from their
    # login token instead, so nobody can submit a fake score as someone else.
    submitGameResult(timeMs: Int!, errorCount: Int!): GameResult!
  }
`;
