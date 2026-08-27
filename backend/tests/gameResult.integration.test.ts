import { test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { recordGameResult } from "../src/gameResultService";

// A separate PrismaClient, connecting to the SAME real Postgres database
// (via DATABASE_URL in .env) that the actual app uses. Nothing here is
// mocked — every call below runs real SQL against a real database, which
// is exactly what makes this an integration test rather than a unit test.
const prisma = new PrismaClient();

// A unique-enough email so re-running this test file doesn't collide with
// a leftover row from a previous run.
const TEST_EMAIL = `integration-test-${Date.now()}@example.com`;
let testUserId: string;

// Runs once before any test below — creates a fresh, known user to test
// against, rather than depending on whatever's already in the database
// from manual testing.
beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, passwordHash: "not-a-real-hash" },
  });
  testUserId = user.id;
});

// Runs once after every test in this file finishes — deletes everything
// this test created, so running the suite repeatedly doesn't pile up junk.
afterAll(async () => {
  await prisma.gameResult.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

test("first submitted result becomes the user's best time", async () => {
  const result = await recordGameResult(prisma, testUserId, 15000, 2);

  expect(result.timeMs).toBe(15000);
  expect(result.errorCount).toBe(2);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: testUserId },
  });
  expect(user.bestTimeMs).toBe(15000);
});

test("a slower result does NOT overwrite an existing best time", async () => {
  // bestTimeMs is 15000 at this point, from the test above.
  await recordGameResult(prisma, testUserId, 20000, 0);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: testUserId },
  });
  // Still 15000 — proves the slower run didn't overwrite the real best.
  expect(user.bestTimeMs).toBe(15000);
});

test("a faster result DOES overwrite the existing best time", async () => {
  await recordGameResult(prisma, testUserId, 10000, 1);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: testUserId },
  });
  expect(user.bestTimeMs).toBe(10000);
});

test("every call still creates a permanent GameResult row, win or not", async () => {
  const results = await prisma.gameResult.findMany({
    where: { userId: testUserId },
  });
  // Three recordGameResult calls happened across the tests above — all
  // three should be preserved as history, even the one that didn't
  // become the new best.
  expect(results).toHaveLength(3);
});
