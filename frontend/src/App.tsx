import { useAuth } from "./AuthContext";
import { AuthForm } from "./AuthForm";
import { Game } from "./Game";
import { ThemeToggle } from "./ThemeToggle";

function App() {
  const { user, loading } = useAuth();

  return (
    // "min-h-screen" ensures the ruby/white (or dark) background fills
    // the whole viewport even when there's very little content, instead
    // of only covering as much height as the content itself needs.
    <div className="min-h-screen bg-white text-neutral-900 transition-colors dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between border-b border-ruby-100 px-6 py-4 dark:border-neutral-800">
        <h1 className="text-lg font-bold text-ruby-600 dark:text-ruby-400">
          Typing Speed Game
        </h1>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-12">
        {loading ? (
          // Still checking a saved token from a previous visit — show
          // nothing meaningful yet rather than briefly flashing the
          // login form first.
          <p className="text-neutral-500 dark:text-neutral-400">
            Loading...
          </p>
        ) : !user ? (
          // Not logged in — the login/register form is all we show.
          // Everything else (the actual game) requires an account.
          <AuthForm />
        ) : (
          <Game />
        )}
      </main>
    </div>
  );
}

export default App;
