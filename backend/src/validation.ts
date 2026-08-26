import { z } from "zod";

// "z.object({...})" means: this must be an object with exactly these fields.
export const registerInputSchema = z.object({
  // Must be a string, AND must look like a real email address
  // (something@something.something). If it doesn't, Zod's error message
  // will be exactly the text we provide here.
  email: z.string().email({ message: "Enter a valid email address" }),

  // Must be a string with at least 8 characters. This is a real design
  // decision, not an arbitrary number — 8 is a common minimum that
  // balances security against not annoying users too much.
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

// Login has slightly different rules than register. We still check the
// email LOOKS valid, but we don't re-enforce the 8-character minimum here
// — that's a rule about what NEW passwords must satisfy, not something
// login should re-check (an existing user's password stays valid to log
// in with even if our minimum-length rule changed after they signed up).
// We only require SOME password was typed at all.
export const loginInputSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export const submitGameResultInputSchema = z.object({
  // "positive()" rejects zero and negative numbers — a completed game
  // always takes SOME real time, so 0 or less is impossible and almost
  // certainly a bug (or someone poking the API directly) rather than a
  // real result.
  timeMs: z
    .number()
    .int()
    .positive({ message: "timeMs must be a positive number" }),

  // "min(0)" allows zero mistakes (a perfect run) but rejects negative
  // counts, which make no sense.
  errorCount: z
    .number()
    .int()
    .min(0, { message: "errorCount cannot be negative" }),
});
