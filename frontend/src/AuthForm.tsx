import { useState, type SyntheticEvent } from "react";
import { useAuth } from "./AuthContext";

// Two modes this one form can be in, toggled by a button — avoids
// building two nearly-identical components for login vs. register.
type Mode = "login" | "register";

export function AuthForm() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Holds a readable error message if login/register fails. null = no error.
  const [error, setError] = useState<string | null>(null);

  // True while a request is in flight — lets us disable the button so a
  // double-click can't fire two submissions at once.
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SyntheticEvent) {
    // Forms reload the whole page by default when submitted. This line
    // stops that, since we're handling the submission with JavaScript instead.
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      // On success, AuthContext's internal state update is what actually
      // changes what's on screen — there's nothing left to do here.
    } catch (err) {
      // TypeScript treats a caught error as type "unknown" by default
      // (it genuinely could be anything), so we check it's a real Error
      // before trusting it has a .message property.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // A shared set of classes for both text inputs, so the focus ring and
  // border colors only need to be written once instead of duplicated.
  const inputClasses =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-ruby-500 focus:outline-none focus:ring-2 focus:ring-ruby-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:ring-ruby-900";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-ruby-100 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="mb-6 text-center text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {mode === "login" ? "Log in" : "Create an account"}
      </h2>

      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClasses}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClasses}
        />
      </div>

      {/* "error && <p>...</p>" only renders the paragraph at all if error
          is truthy — a common React shorthand for conditional rendering. */}
      {error && (
        <p
          role="alert"
          className="mb-4 text-sm text-ruby-600 dark:text-ruby-400"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mb-3 w-full rounded-lg bg-ruby-600 px-4 py-2 font-medium text-white transition-colors hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Please wait..."
          : mode === "login"
            ? "Log in"
            : "Register"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="w-full text-center text-sm text-ruby-600 hover:underline dark:text-ruby-400"
      >
        {mode === "login"
          ? "Need an account? Register"
          : "Already have an account? Log in"}
      </button>
    </form>
  );
}
