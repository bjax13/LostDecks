import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initPostHog } from "./analytics/posthog.js";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AuthModalProvider } from "./contexts/AuthModalContext.jsx";
import "../styles.css";

initPostHog();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthModalProvider>
        <App />
      </AuthModalProvider>
    </AuthProvider>
  </React.StrictMode>,
);
