import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { capturePostHogException, initPostHog } from "./analytics/posthog.js";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AuthModalProvider } from "./contexts/AuthModalContext.jsx";
import "../styles.css";

initPostHog();

ReactDOM.createRoot(document.getElementById("root"), {
  onUncaughtError: (error, info) =>
    capturePostHogException(error, {
      componentStack: info?.componentStack,
      source: "react-uncaught",
    }),
  onCaughtError: (error, info) =>
    capturePostHogException(error, {
      componentStack: info?.componentStack,
      source: "react-boundary",
    }),
}).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <AuthModalProvider>
          <App />
        </AuthModalProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
