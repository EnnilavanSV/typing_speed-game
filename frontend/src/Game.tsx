import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useAuth } from "./AuthContext";
import { graphqlRequest } from "./graphql";
import { Leaderboard } from "./Leaderboard";
import { GameHistory } from "./GameHistory";

const SEQUENCE_LENGTH = 20;
const PENALTY_MS = 500;
// The key we use to store the local best time in the browser's storage —
// separate from the backend leaderboard, per the assignment's requirement
// to "persist the user's best score locally."
const LOCAL_BEST_KEY = "typingGameLocalBest";

// The three phases this component can be in.
type GameStatus = "idle" | "playing" | "finished";

// Builds a fresh sequence of random uppercase letters each time a game
// starts. Math.random() gives a decimal from 0 up to (not including) 1;
// multiplying by 26 and flooring gives a whole number 0–25, and adding
// that to 65 (the character code for 'A') gives a random letter A–Z.
function generateSequence(length: number): string[] {
  return Array.from({ length }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  );
}

const SUBMIT_RESULT_MUTATION = `
  mutation SubmitGameResult($timeMs: Int!, $errorCount: Int!) {
    submitGameResult(timeMs: $timeMs, errorCount: $errorCount) {
      id
      timeMs
      errorCount
    }
  }
`;

export function Game() {
  // "logout" comes from the same AuthContext as "user" — pulling it out
  // here means the finished-game screen can offer a logout button without
  // needing App.tsx to pass anything down.
  const { user, logout } = useAuth();

  const [status, setStatus] = useState<GameStatus>("idle");
  const [sequence, setSequence] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // "ref" values persist between renders WITHOUT causing a re-render when
  // they change — unlike useState. That's exactly what we want for a
  // timestamp and an accumulating penalty: we need to read/write them
  // from inside the keydown handler, but changing them shouldn't by
  // itself cause React to redraw anything.
  const startTimeRef = useRef<number>(0);
  const penaltyMsRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // This ONE is useState on purpose — it's the number actually shown on
  // screen, ticking upward, so changing it must trigger a re-render.
  const [elapsedMs, setElapsedMs] = useState(0);

  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [wasNewBest, setWasNewBest] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // While playing, tick the displayed timer roughly 10 times a second.
  useEffect(() => {
    if (status !== "playing") return;

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current + penaltyMsRef.current);
    }, 100);

    // React automatically runs this "cleanup" function whenever the
    // effect re-runs (status changes) or the component unmounts — here
    // that means stopping the interval so it doesn't keep ticking (and
    // leaking memory) after the game ends.
    return () => clearInterval(interval);
  }, [status]);

  // Keep the hidden input focused for the entire game, satisfying "keep
  // the keyboard/input focused throughout the game" even if the page is
  // clicked elsewhere.
  useEffect(() => {
    if (status === "playing") {
      inputRef.current?.focus();
    }
  }, [status]);

  function startGame() {
    setSequence(generateSequence(SEQUENCE_LENGTH));
    setCurrentIndex(0);
    setErrorCount(0);
    setElapsedMs(0);
    setFinalTimeMs(null);
    setSubmitError(null);
    startTimeRef.current = Date.now();
    penaltyMsRef.current = 0;
    setStatus("playing");
  }

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (status !== "playing") return;

      // Stop the actual character from ever appearing in the input —
      // we're using this input purely as an invisible focus target to
      // capture keystrokes, not as a real text field.
      event.preventDefault();

      const expected = sequence[currentIndex];
      const pressed = event.key.toUpperCase();

      // Ignore modifier/control keys entirely (Shift, Tab, arrow keys,
      // etc.) — their .key names are multiple characters long (like
      // "Backspace" or "ArrowLeft"), while a real letter key is always
      // exactly one character.
      if (pressed.length !== 1) return;

      if (pressed === expected) {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= sequence.length) {
          // That was the 20th and final letter — the game just ended.
          const finalTime =
            Date.now() - startTimeRef.current + penaltyMsRef.current;
          setFinalTimeMs(finalTime);
          setStatus("finished");
          finishGame(finalTime, errorCount);
        } else {
          setCurrentIndex(nextIndex);
        }
      } else {
        // Wrong key — add the penalty immediately, to both the ref (the
        // real running total) and the visible timer, so the player sees
        // the clock jump forward the instant they make a mistake.
        penaltyMsRef.current += PENALTY_MS;
        setErrorCount((count) => count + 1);
        setElapsedMs(Date.now() - startTimeRef.current + penaltyMsRef.current);
      }
    },
    [status, sequence, currentIndex, errorCount],
  );

  async function finishGame(timeMs: number, mistakes: number) {
    // Compare against whatever was saved locally BEFORE this run, so we
    // know whether to show Success or Failure right away — this doesn't
    // depend on the backend responding at all.
    const previousBest = localStorage.getItem(LOCAL_BEST_KEY);
    const isNewBest = !previousBest || timeMs < Number(previousBest);
    setWasNewBest(isNewBest);

    if (isNewBest) {
      localStorage.setItem(LOCAL_BEST_KEY, String(timeMs));
    }

    // Separately, submit to the backend so this result counts toward the
    // account-tied leaderboard. This is independent of the local copy —
    // if it fails, the player still sees their Success/Failure result,
    // just with an error noting the leaderboard save didn't go through.
    try {
      await graphqlRequest(SUBMIT_RESULT_MUTATION, {
        timeMs,
        errorCount: mistakes,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save result",
      );
    }
  }

  // Shared by both the "Home" button below and the Leaderboard's own
  // "Home" button (passed down as onGoHome) — resets the game back to
  // its very first screen (status "idle"), regardless of which screen
  // (finished, or leaderboard-over-finished) the player is coming from.
  function goHome() {
    setShowLeaderboard(false);
    setStatus("idle");
  }

  if (showLeaderboard) {
    return (
      <Leaderboard
        onClose={() => setShowLeaderboard(false)}
        onGoHome={goHome}
      />
    );
  }

  // Shared "card" styling for all three game screens, so idle/finished/
  // playing all sit inside the same visual container.
  const cardClasses =
    "flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-ruby-100 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  const secondaryButtonClasses =
    "w-full rounded-lg border border-ruby-200 px-4 py-2 font-medium text-ruby-600 transition-colors hover:bg-ruby-50 dark:border-neutral-700 dark:text-ruby-400 dark:hover:bg-neutral-800";

  const primaryButtonClasses =
    "w-full rounded-lg bg-ruby-600 px-4 py-2 font-medium text-white transition-colors hover:bg-ruby-700";

  if (status === "idle") {
    return (
      <div className={cardClasses}>
        <p className="text-neutral-600 dark:text-neutral-300">
          Welcome,{" "}
          <span className="font-medium text-ruby-600 dark:text-ruby-400">
            {user?.email}
          </span>
        </p>
        <button onClick={startGame} className={primaryButtonClasses}>
          Start Game
        </button>
        <button
          onClick={() => setShowLeaderboard(true)}
          className={secondaryButtonClasses}
        >
          View Leaderboard
        </button>
        {/* Only rendered on the home screen — a fresh fetch every time you
            land back here, so a game you just finished shows up immediately
            without needing a manual refresh. */}
        <GameHistory />
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className={cardClasses}>
        <h2
          className={
            wasNewBest
              ? "text-2xl font-bold text-ruby-600 dark:text-ruby-400"
              : "text-2xl font-bold text-neutral-700 dark:text-neutral-300"
          }
        >
          {wasNewBest ? "Success!" : "Failure — Try Again"}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-300">
          Your time: {(finalTimeMs! / 1000).toFixed(2)}s
        </p>
        <p className="text-neutral-600 dark:text-neutral-300">
          Mistakes: {errorCount}
        </p>
        {submitError && (
          <p role="alert" className="text-sm text-ruby-600 dark:text-ruby-400">
            Couldn't save to leaderboard: {submitError}
          </p>
        )}
        <div className="flex w-full flex-col gap-2">
          <button onClick={startGame} className={primaryButtonClasses}>
            Play Again
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            className={secondaryButtonClasses}
          >
            View Leaderboard
          </button>
          <button onClick={goHome} className={secondaryButtonClasses}>
            Home
          </button>
        </div>
        {/* A plain underlined link instead of a bordered button — logout
            is a valid but infrequent action here, so it shouldn't compete
            visually with Play Again / Leaderboard / Home above it. */}
        <button
          onClick={logout}
          className="w-full text-center text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Log out
        </button>
      </div>
    );
  }

  // status === "playing"
  return (
    <div className={cardClasses}>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Progress: {currentIndex} / {sequence.length}
      </p>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Time: {(elapsedMs / 1000).toFixed(2)}s
      </p>
      {/* "leading-none" plus the py-4 padding below are what actually fix
          the old letter/input overlap bug — the tall 6xl text gets
          explicit vertical breathing room instead of relying on default
          line-height. */}
      <p className="py-4 text-6xl font-bold leading-none text-ruby-600 dark:text-ruby-400">
        {sequence[currentIndex]}
      </p>
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onBlur={() => inputRef.current?.focus()}
        autoFocus
        className="w-24 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-neutral-900 focus:border-ruby-500 focus:outline-none focus:ring-2 focus:ring-ruby-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:ring-ruby-900"
      />
    </div>
  );
}
