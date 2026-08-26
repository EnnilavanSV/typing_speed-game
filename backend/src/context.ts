import { PrismaClient } from "@prisma/client";

import jwt from "jsonwebtoken";

export const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

// This describes the SHAPE of data every resolver (every piece of logic
// that answers a GraphQL query) will receive. TypeScript uses this to warn
// us if we ever try to use something that isn't here.
export interface GraphQLContext {
  prisma: PrismaClient; // so resolvers can query the database
  userId: string | null; // who's making this request — or null if nobody's logged in
}

export function createContext(request: Request): GraphQLContext {
  const authHeader = request.headers.get("authorization") ?? "";

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId: string | null = null;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
      userId = payload.sub;
    } catch {
      userId = null;
    }
  }

  return { prisma, userId };
}
