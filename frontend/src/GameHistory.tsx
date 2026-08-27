import { useState, useEffect } from "react";
import { graphqlRequest } from "./graphql";

// Matches the GameResult shape from our backend schema — same type the
// leaderboard's submitGameResult mutation already returns, just a list
// of them this time.
interface GameResultEntry {
  id: string;
  timeMs: number;
  errorCount: number;
  createdAt: string;
}

const GAME_HISTORY_QUERY = `
  query GameHistory($limit: Int) {
    gameHistory(limit: $limit) {
      id
      timeMs
      errorCount
      createdAt
    }
  }
`;

// "limit" defaults to 5 here — deliberately smaller than the backend's
// own default of 10, since this renders inline on the home screen and
// doesn't need to show as much as a dedicated history page would.
export function GameHistory({ limit = 5 }: { limit?: number }) {
  const [entries, setEntries] = useState<GameResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Runs once when this component mounts — same fetch-on-mount pattern
  // as Leaderboard.tsx. Requires a logged-in user (gameHistory throws
  // UNAUTHENTICATED otherwise), which is always true here since this only
  // ever renders inside Game.tsx's idle screen, itself only reachable
  // once App.tsx confirms a user is logged in.
  useEffect(() => {
    graphqlRequest<{ gameHistory: GameResultEntry[] }>(GAME_HISTORY_QUERY, {
      limit,
    })
      .then((data) => setEntries(data.gameHistory))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load game history",
        ),
      )
      .finally(() => setLoading(false));
  }, [limit]);

  // Turns an ISO timestamp string into something readable, e.g.
  // "Aug 27, 3:42 PM" — short enough to fit next to a time and error count
  // without wrapping awkwardly.
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Nothing to show while loading, and nothing worth showing an error
  // banner for either — this is a small supplementary panel, not a core
  // flow, so a failed fetch here just quietly shows nothing rather than
  // interrupting the home screen with an alert.
  if (loading || error) return null;

  if (entries.length === 0) {
    return (
      <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No games played yet — start one above!
      </p>
    );
  }

  return (
    <div className="mt-2 w-full">
      <h3 className="mb-2 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Recent Games
      </h3>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between rounded-lg bg-ruby-50 px-3 py-1.5 text-sm dark:bg-neutral-800"
          >
            <span className="text-neutral-500 dark:text-neutral-400">
              {formatDate(entry.createdAt)}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-ruby-600 dark:text-ruby-400">
                {(entry.timeMs / 1000).toFixed(2)}s
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                {entry.errorCount} {entry.errorCount === 1 ? "error" : "errors"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
