import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Avoid initializing the real Firebase client in this file (faster, no env required).
// Auth/session behavior is still covered in App.hooks.test.jsx with mocked useAuth.
vi.mock("./lib/firebase", () => ({
  app: null,
  auth: null,
  db: null,
  functions: null,
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
    expect(screen.getByRole("link", { name: "ShardStash" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Matches" })).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /sign in/i }, { timeout: 500 }),
    ).toBeInTheDocument();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("site-footer");
    expect(window.getComputedStyle(footer).position).not.toBe("fixed");
    expect(window.getComputedStyle(footer).position).not.toBe("sticky");
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
  });

  it("opens Discord-only site feedback from the document footer", async () => {
    const user = userEvent.setup();
    renderWithAppProviders(<App />);

    await user.click(screen.getByRole("button", { name: "Feedback" }));

    const dialog = screen.getByRole("dialog", { name: "Send site feedback" });
    expect(dialog).toHaveTextContent("Sanderson Collectors Guild");
    expect(dialog).toHaveTextContent("gimpy_12");
    expect(dialog).toHaveTextContent("1bjax");
    expect(dialog).toHaveTextContent("not trade match contact");
  });
});
