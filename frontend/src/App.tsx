import { useAuth } from "./AuthContext";
import { AuthForm } from "./AuthForm";

function App() {
  const { user, loading, logout } = useAuth();

  // Still checking a saved token from a previous visit — show nothing
  // meaningful yet rather than briefly flashing the login form first.
  if (loading) {
    return <p>Loading...</p>;
  }

  // Not logged in — the login/register form is all we show. Everything
  // else (the actual game) requires an account.
  if (!user) {
    return <AuthForm />;
  }

  // Logged in — placeholder for now. The real typing game replaces this
  // in the next step.
  return (
    <div>
      <p>Logged in as {user.email}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

export default App;
