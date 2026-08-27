import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

const THEME_KEY = "typingGameTheme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Figures out what theme to start with: whatever the user explicitly
// picked on a previous visit (saved in localStorage), or — if they've
// never chosen one on this site before — their operating system's own
// light/dark preference.
function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;

  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Passing a FUNCTION to useState (instead of calling getInitialTheme()
  // directly) means it only runs once, on the very first render — not on
  // every single re-render, which would be wasteful since the initial
  // theme never needs to be recalculated after that.
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Whenever theme changes, keep two things in sync: the "dark" class on
  // <html> (which is what our Tailwind `dark:` utilities actually key
  // off, via the @custom-variant rule in index.css), and the saved
  // choice in localStorage so it persists across visits.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
