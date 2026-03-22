import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Avoid initializing the real Firebase client in this file (faster, no env required).
// Auth/session behavior is still covered in App.hooks.test.jsx with mocked useAuth.
vi.mock("./lib/firebase", () => ({
  app: null,
  auth: null,
  db: null,
  functions: null,
  githubProvider: null,
  googleProvider: null,
  hasFirebaseConfig: false,
}));

import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { AuthModalProvider } from "./contexts/AuthModalContext.jsx";

function renderWithAppProviders(ui) {
  return render(
    <AuthProvider>
      <AuthModalProvider>{ui}</AuthModalProvider>
    </AuthProvider>,
  );
}

describe("App (integration)", () => {
  it("renders primary navigation for a signed-out user after auth finishes loading", async () => {
    renderWithAppProviders(<App />);
    expect(screen.getByRole("link", { name: "Collectibles" })).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /sign in/i }, { timeout: 500 }),
    ).toBeInTheDocument();
  });
});
