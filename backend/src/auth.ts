import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { string } from "zod/v4";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

const SALT_ROUNDS = 10;

// Takes a plain-text password, returns the scrambled hash to store in the
// database instead. Marked "async" because hashing deliberately takes a
// noticeable, non-trivial amount of CPU time — that slowness is the point.
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// Takes the plain-text password someone just typed in, plus the hash we
// stored for them back at registration — returns true if they match.
// Notice there's no "un-hashing" happening; hashing is one-way, so this
// works by hashing the new attempt the same way and comparing results.
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

// Creates a signed token containing this user's id. "sub" (short for
// "subject") is the standard JWT field name for "who this token is about"
// — and it's exactly the field context.ts already reads back out when
// verifying a token on later requests, so the two files agree on the format.
// "expiresIn: '1d'" is our earlier decision in action: no refresh token,
// this one just stops working after a day and the user logs in again.
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "1d" });
}
