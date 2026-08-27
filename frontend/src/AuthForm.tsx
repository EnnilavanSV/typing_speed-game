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

  return (
    <form onSubmit={handleSubmit}>
      <h2>{mode === "login" ? "Log in" : "Create an account"}</h2>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {/* "error && <p>...</p>" only renders the paragraph at all if error
          is truthy — a common React shorthand for conditional rendering. */}
      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting
          ? "Please wait..."
          : mode === "login"
            ? "Log in"
            : "Register"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "Need an account? Register"
          : "Already have an account? Log in"}
      </button>
    </form>
  );
}
