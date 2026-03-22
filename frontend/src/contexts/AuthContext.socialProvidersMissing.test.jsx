import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authFns = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/auth", () => authFns);

vi.mock("../lib/firebase", () => ({
  auth: { __tag: "auth" },
  googleProvider: null,
  githubProvider: null,
  hasFirebaseConfig: true,
}));

import { AuthProvider, useAuth } from "./AuthContext.jsx";

describe("AuthProvider with auth but no OAuth providers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loginWithGoogle errors on missing provider while auth exists", async () => {
    function Harness() {
      const ctx = useAuth();
      return (
        <div>
          <span data-testid="error-msg">{ctx.error?.message ?? ""}</span>
          <button type="button" onClick={() => void ctx.loginWithGoogle().catch(() => {})}>
            login-google
          </button>
        </div>
      );
    }
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "login-google" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(/enable social sign-in/i);
    });
  });

  it("loginWithGithub errors on missing provider while auth exists", async () => {
    function Harness() {
      const ctx = useAuth();
      return (
        <div>
          <span data-testid="error-msg">{ctx.error?.message ?? ""}</span>
          <button type="button" onClick={() => void ctx.loginWithGithub().catch(() => {})}>
            login-github
          </button>
        </div>
      );
    }
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "login-github" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(/enable social sign-in/i);
    });
  });
});
