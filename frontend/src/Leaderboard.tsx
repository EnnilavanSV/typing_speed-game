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
    <div>
      <h2>Leaderboard</h2>
      <button onClick={onClose}>Back</button>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading &&
        !error &&
        (entries.length === 0 ? (
          <p>No scores yet — be the first!</p>
        ) : (
          <ol>
            {entries.map((entry) => (
              // React needs a stable, unique "key" per list item to
              // correctly track which row is which across re-renders.
              // "rank" works perfectly here since it's always 1, 2, 3...
              // with no duplicates.
              <li key={entry.rank}>
                {entry.email} — {(entry.bestTimeMs / 1000).toFixed(2)}s
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
