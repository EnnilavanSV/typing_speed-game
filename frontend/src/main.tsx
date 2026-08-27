import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* ThemeProvider wraps everything, including AuthProvider, so the
        dark/light class on <html> is set before anything else even
        needs to render. */}
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
