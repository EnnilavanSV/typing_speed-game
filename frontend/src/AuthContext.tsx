import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { graphqlRequest } from "./graphql";

// Shape of the user data the backend sends back after auth.
interface User {
  id: string;
  email: string;
  bestTimeMs: number | null;
}

// Everything the rest of the app can read or do through this context.
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// React Context needs a default value for TypeScript's sake, even though
// AuthProvider below always supplies a real one — this default should
// never actually get used in practice.
const AuthContext = createContext<AuthContextValue | null>(null);

// The GraphQL mutation/query text, written once and reused by the
// functions below — same pattern as our backend's schema.ts, just on
// the client side now.
const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id email bestTimeMs }
    }
  }
`;

const REGISTER_MUTATION = `
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      token
      user { id email bestTimeMs }
    }
  }
`;

// Used once on page load, to check whether a saved token is still valid.
const ME_QUERY = `
  query Me {
    me { id email bestTimeMs }
  }
`;

// "ReactNode" is TypeScript's type for "anything React can render." We
// use it here because AuthProvider just wraps around whatever the rest
// of the app turns out to be, without needing to know what that is.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Starts true because on first load we don't yet know if a saved token
  // is still valid — we're about to go check.
  const [loading, setLoading] = useState(true);

  // Runs exactly once, when the app first mounts (the empty [] at the end
  // means "don't re-run this on every render"). If a token was saved from
  // a previous visit, ask the backend who it belongs to — this is what
  // keeps you logged in across a page refresh instead of losing your
  // session every time.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    graphqlRequest<{ me: User | null }>(ME_QUERY)
      .then((data) => setUser(data.me))
      .catch(() => {
        // The saved token was invalid or expired — clear it so we don't
        // keep sending a dead token on every future request.
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await graphqlRequest<{ login: { token: string; user: User } }>(
      LOGIN_MUTATION,
      { email, password },
    );

    // Save the token so future requests — and future page loads — stay
    // logged in, then update in-memory state so the UI reacts immediately.
    localStorage.setItem("token", data.login.token);
    setUser(data.login.user);
  }

  async function register(email: string, password: string) {
    const data = await graphqlRequest<{
      register: { token: string; user: User };
    }>(REGISTER_MUTATION, { email, password });

    localStorage.setItem("token", data.register.token);
    setUser(data.register.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// A small helper so other components can just call useAuth() instead of
// importing useContext and AuthContext separately every single time.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  // If this ever fires, some component tried to read auth data without
  // being wrapped in <AuthProvider> — a real bug worth failing loudly on,
  // rather than silently returning broken/empty data.
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
