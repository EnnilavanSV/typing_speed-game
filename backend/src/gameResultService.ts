import type { PrismaClient } from "@prisma/client";

// Records one completed game: always saves a permanent GameResult row,
// and updates the user's bestTimeMs ONLY if this run actually beats their
// previous best (or they have none yet). Both writes happen in one atomic
// transaction — this is the exact race-condition-safe pattern from our
// technical design doc, now pulled into its own function so it can be
// tested directly, independent of GraphQL.
export async function recordGameResult(
  prisma: PrismaClient,
  userId: string,
  timeMs: number,
  errorCount: number,
) {
  const [gameResult] = await prisma.$transaction([
    prisma.gameResult.create({
      data: { userId, timeMs, errorCount },
    }),
    prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ bestTimeMs: null }, { bestTimeMs: { gt: timeMs } }],
      },
      data: { bestTimeMs: timeMs },
    }),
  ]);

  return gameResult;
}
