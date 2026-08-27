import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useAuth } from "./AuthContext";
import { graphqlRequest } from "./graphql";

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
  const { user } = useAuth();

  const [status, setStatus] = useState<GameStatus>("idle");
  const [sequence, setSequence] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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

  if (status === "idle") {
    return (
      <div>
        <p>Welcome, {user?.email}</p>
        <button onClick={startGame}>Start Game</button>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div>
        <h2>{wasNewBest ? "Success!" : "Failure — Try Again"}</h2>
        <p>Your time: {(finalTimeMs! / 1000).toFixed(2)}s</p>
        <p>Mistakes: {errorCount}</p>
        {submitError && (
          <p role="alert">Couldn't save to leaderboard: {submitError}</p>
        )}
        <button onClick={startGame}>Play Again</button>
      </div>
    );
  }

  // status === "playing"
  return (
    <div>
      <p>
        Progress: {currentIndex} / {sequence.length}
      </p>
      <p>Time: {(elapsedMs / 1000).toFixed(2)}s</p>
      <p style={{ fontSize: "3rem", lineHeight: 1.5, marginBottom: "1rem" }}>
        {sequence[currentIndex]}
      </p>
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onBlur={() => inputRef.current?.focus()}
        autoFocus
      />
    </div>
  );
}
