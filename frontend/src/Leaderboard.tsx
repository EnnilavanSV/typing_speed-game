import { useState, useEffect } from "react";
import { graphqlRequest } from "./graphql";

// Matches the LeaderboardEntry shape from our backend schema.
interface LeaderboardEntry {
  rank: number;
  email: string;
  bestTimeMs: number;
}

const LEADERBOARD_QUERY = `
  query Leaderboard {
    leaderboard(limit: 10) {
      rank
      email
      bestTimeMs
    }
  }
`;

// "onClose" is a function passed in by whatever renders this component —
// it doesn't know or care what "closing" actually means (going back to
// the game, hiding a modal, etc.), it just calls the function it was given.
export function Leaderboard({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Runs once when this component first appears — fetches the current
  // top 10 from the backend. No auth needed; the leaderboard query is public.
  useEffect(() => {
    graphqlRequest<{ leaderboard: LeaderboardEntry[] }>(LEADERBOARD_QUERY)
      .then((data) => setEntries(data.leaderboard))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-ruby-100 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-center text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Leaderboard
      </h2>
      <button
        onClick={onClose}
        className="mb-6 w-full rounded-lg border border-ruby-200 px-4 py-2 font-medium text-ruby-600 transition-colors hover:bg-ruby-50 dark:border-neutral-700 dark:text-ruby-400 dark:hover:bg-neutral-800"
      >
        Back
      </button>

      {loading && (
        <p className="text-center text-neutral-500 dark:text-neutral-400">
          Loading...
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-center text-sm text-ruby-600 dark:text-ruby-400"
        >
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        (entries.length === 0 ? (
          <p className="text-center text-neutral-500 dark:text-neutral-400">
            No scores yet — be the first!
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry) => (
              // React needs a stable, unique "key" per list item to
              // correctly track which row is which across re-renders.
              // "rank" works perfectly here since it's always 1, 2, 3...
              // with no duplicates.
              <li
                key={entry.rank}
                className="flex items-center justify-between rounded-lg bg-ruby-50 px-4 py-2 dark:bg-neutral-800"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-200">
                  #{entry.rank} {entry.email}
                </span>
                <span className="font-mono text-ruby-600 dark:text-ruby-400">
                  {(entry.bestTimeMs / 1000).toFixed(2)}s
                </span>
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
