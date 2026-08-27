// GraphQLError lets us throw errors that include a machine-readable "code",
// not just a plain error message — so the frontend can react differently
// to "EMAIL_TAKEN" vs "UNAUTHENTICATED" instead of guessing from text.
import { GraphQLError, Token } from "graphql";

import type { GraphQLContext } from "./context";

import {
  registerInputSchema,
  loginInputSchema,
  submitGameResultInputSchema,
} from "./validation";
import { hashPassword, verifyPassword, signToken } from "./auth";

import { recordGameResult } from "./gameResultService";

// A small reusable helper. "feature: string" is the input; ": never" means
// this function never actually returns a value — it always throws instead.
function notImplemented(feature: string): never {
  throw new GraphQLError(`${feature} is not implemented yet`, {
    // "extensions.code" is the machine-readable part of the error, matching
    // the error convention from our design doc.
    extensions: { code: "NOT_IMMPLEMENTED" },
  });
}

// This object's shape mirrors the schema: one function per Query field,
// one per Mutation field. GraphQL Yoga calls the matching function
// whenever a client asks for that specific piece of data.
export const resolvers = {
  Query: {
    // Every resolver function receives THREE arguments (there's a 4th we
    // don't use here): the parent object (unused, so named "_parent"),
    // the arguments the client passed (unused here too), and our context
    // (created fresh per request in context.ts).
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.userId) return null;

      return context.prisma.user.findUnique({ where: { id: context.userId } });
    },

    // This resolver DOES receive real arguments, so we type them:
    // "limit" is optional (matches the schema's "limit: Int = 10").
    leaderboard: async (
      _parent: unknown,
      args: { limit?: number },
      context: GraphQLContext,
    ) => {
      const limit = args.limit ?? 10;

      // Ask Prisma for User rows, but only ones who've actually played
      // at least one game (bestTimeMs isn't null), sorted so the FASTEST
      // time comes first ("asc" = ascending = smallest number first —
      // correct here because a lower time means a better score), and cut
      // the list off at "limit" rows.
      const users = await context.prisma.user.findMany({
        where: { bestTimeMs: { not: null } },
        orderBy: { bestTimeMs: "asc" },
        take: limit,
      });

      // The database gives us User objects, but our schema promises
      // LeaderboardEntry objects (with a "rank" field that doesn't exist
      // in the database at all). This line transforms one shape into the
      // other: "map" runs once per user, and "index" is each user's
      // position in the sorted list (0, 1, 2, ...), so "index + 1" turns
      // that into a human-friendly rank starting at 1.
      return users.map((user, index) => ({
        rank: index + 1,
        email: user.email,
        bestTimeMs: user.bestTimeMs as number,
      }));
    },

    gameHistory: async (
      _parent: unknown,
      args: { limit?: number },
      context: GraphQLContext,
    ) => {
      // Same guard as submitGameResult — no logged-in user, no history to
      // return. Throwing here (rather than quietly returning []) matches
      // how "me" and submitGameResult already treat an anonymous caller.
      if (!context.userId) {
        throw new GraphQLError(
          "You must be logged in to view your game history",
          { extensions: { code: "UNAUTHENTICATED" } },
        );
      }

      const limit = args.limit ?? 10;

      // "where: { userId: context.userId }" is the entire security
      // boundary here — it comes from the verified JWT, not from anything
      // the client sent, so there's no argument a caller could tamper with
      // to read someone else's rows.
      return context.prisma.gameResult.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    },
  },

  Mutation: {
    // These three are placeholders for now. Calling any of them from a
    // client will return a clean "NOT_IMPLEMENTED" error instead of
    // crashing — real logic gets written in the Auth sprint (register,
    // login) and the leaderboard sprint (submitGameResult).

    register: async (
      _parent: unknown,
      args: { email: string; password: string },
      context: GraphQLContext,
    ) => {
      // Check the input actually matches our rules (valid email, 8+ char
      // password) BEFORE touching the database at all. "safeParse" checks
      // without throwing — it hands back an object telling us whether it
      // passed, instead of crashing the request on bad input.
      const parsed = registerInputSchema.safeParse(args);
      if (!parsed.success) {
        // parsed.error.issues is a list of every validation problem found;
        // we surface just the first one's message to keep the error simple
        // for the client to display.
        throw new GraphQLError(parsed.error.issues[0].message, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const { email, password } = parsed.data;

      const existing = await context.prisma.user.findUnique({
        where: { email },
      });
      if (existing) {
        throw new GraphQLError(
          "An account with this email is already existed",
          {
            extensions: { code: "EMAIL_TAKEN" },
          },
        );
      }

      const passwordHash = await hashPassword(password);

      const user = await context.prisma.user.create({
        data: { email, passwordHash },
      });

      return { token: signToken(user.id), user };
    },

    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      context: GraphQLContext,
    ) => {
      // Same validation pattern as register — check shape/rules before
      // touching the database.
      const parsed = loginInputSchema.safeParse(args);
      if (!parsed.success) {
        throw new GraphQLError(parsed.error.issues[0].message, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const { email, password } = parsed.data;

      // Look up the user by email. This might come back null if no account
      // exists with that email at all.
      const user = await context.prisma.user.findUnique({ where: { email } });

      // A small helper so both failure paths below throw the exact same
      // error. This is deliberate, not laziness: whether the real problem is
      // "no account with this email" or "right email, wrong password," we
      // give the client the SAME generic message either way. If we told the
      // client specifically "no account with that email," an attacker could
      // use that difference to check which emails are registered on this app
      // at all — a real, commonly-exploited weakness called user enumeration.
      const invalidCredentials = () =>
        new GraphQLError("Invalid email or password", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });

      if (!user) {
        throw invalidCredentials();
      }

      // Compare the typed password against the stored hash. This is the
      // verifyPassword helper from auth.ts — it hashes the attempt the same
      // way and checks if the results match, never "unscrambling" anything.
      const passwordMatches = await verifyPassword(password, user.passwordHash);
      if (!passwordMatches) {
        throw invalidCredentials();
      }

      // Success — hand back a fresh signed token and the user's public info.
      return { token: signToken(user.id), user };
    },

    submitGameResult: async (
      _parent: unknown,
      args: { timeMs: number; errorCount: number },
      context: GraphQLContext,
    ) => {
      // Reject anonymous callers immediately — there's no user to attach this
      // result to, and this is also what stops a script from spamming fake
      // scores without ever creating an account.
      if (!context.userId) {
        throw new GraphQLError("You must be logged in to submit a score", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Reject obviously-impossible input before it touches the database.
      const parsed = submitGameResultInputSchema.safeParse(args);
      if (!parsed.success) {
        throw new GraphQLError(parsed.error.issues[0].message, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const { timeMs, errorCount } = parsed.data;

      return recordGameResult(
        context.prisma,
        context.userId,
        timeMs,
        errorCount,
      );
    },
  },

  // A per-field resolver, keyed by type name then field name — GraphQL
  // calls this INSTEAD of just reading ".createdAt" straight off whatever
  // object a Query/Mutation resolver returned. We need it because Prisma
  // hands back createdAt as a real JS Date object, but our schema declares
  // it as "String!". Without this, GraphQL's default String serializer
  // falls back to Date's own .valueOf() (the raw epoch-milliseconds
  // number) instead of a readable date — which is exactly why it showed
  // up as "Invalid Date" once the frontend tried to parse it. This one
  // resolver fixes createdAt everywhere GameResult is returned (both here
  // and from submitGameResult), not just in gameHistory.
  GameResult: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
