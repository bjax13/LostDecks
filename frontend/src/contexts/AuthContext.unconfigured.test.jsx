import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authFns = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/auth", () => authFns);

vi.mock("../lib/firebase", () => ({
  auth: null,
  googleProvider: null,
  githubProvider: null,
  hasFirebaseConfig: false,
}));

import { AuthProvider, useAuth } from "./AuthContext.jsx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function Harness() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user-id">{ctx.user?.uid ?? "none"}</span>
      <span data-testid="error-msg">{ctx.error?.message ?? ""}</span>
      <span data-testid="has-config">{String(ctx.hasFirebaseConfig)}</span>
      <button
        type="button"
        onClick={() => void ctx.login("u@example.com", "secret").catch(() => {})}
      >
        login-email
      </button>
      <button
        type="button"
        onClick={() => void ctx.register("u@example.com", "secret").catch(() => {})}
      >
        register
      </button>
      <button type="button" onClick={() => void ctx.logout().catch(() => {})}>
        logout
      </button>
      <button type="button" onClick={() => void ctx.resetPassword("u@example.com").catch(() => {})}>
        reset-password
      </button>
      <button type="button" onClick={() => void ctx.loginWithGoogle().catch(() => {})}>
        login-google
      </button>
    </div>
  );
}

describe("AuthProvider without Firebase auth", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not subscribe when auth is null and finishes loading", async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");
    expect(authFns.onAuthStateChanged).not.toHaveBeenCalled();
  });

  it("login throws a configuration error", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "login-email" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(/enable sign-in/i);
    });
  });

  it("register throws a configuration error", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "register" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(/enable registration/i);
    });
  });

  it("resetPassword throws a configuration error", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "reset-password" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(/enable password reset/i);
    });
  });

  it("loginWithGoogle throws when auth is not configured", async () => {
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

  it("logout still invokes signOut with null auth", async () => {
    authFns.signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(authFns.signOut).toHaveBeenCalledWith(null);
    });
  });
});
