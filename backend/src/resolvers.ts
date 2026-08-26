// GraphQLError lets us throw errors that include a machine-readable "code",
// not just a plain error message — so the frontend can react differently
// to "EMAIL_TAKEN" vs "UNAUTHENTICATED" instead of guessing from text.
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "./context";


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
        reank: index + 1,
        email: user.email,
        bestTimeMs: user.bestTimeMs as number,
      }));
    },
  },

  Mutation: {
    // These three are placeholders for now. Calling any of them from a
    // client will return a clean "NOT_IMPLEMENTED" error instead of
    // crashing — real logic gets written in the Auth sprint (register,
    // login) and the leaderboard sprint (submitGameResult).

    register: () => notImplemented("register"),
    login: () => notImplemented("login"),
    submitGameResult: () => notImplemented("submitGameResult"),
  },
};
