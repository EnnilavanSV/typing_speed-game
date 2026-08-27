import { useTheme } from "./ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      // aria-label describes this button for screen readers, since its
      // visible content is just an icon + short word, not full sentences.
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="rounded-full border border-ruby-200 bg-white px-3 py-1.5 text-sm font-medium text-ruby-600 shadow-sm transition-colors hover:bg-ruby-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-ruby-300 dark:hover:bg-neutral-800"
    >
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
