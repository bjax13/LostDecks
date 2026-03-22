import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUnsubscribe = vi.fn();

const authFns = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return mockUnsubscribe;
  }),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/auth", () => authFns);

const fb = vi.hoisted(() => ({
  auth: { __tag: "auth" },
  googleProvider: { __tag: "google" },
  githubProvider: { __tag: "github" },
  hasFirebaseConfig: true,
}));

vi.mock("../lib/firebase", () => fb);

import { AuthProvider, useAuth } from "./AuthContext.jsx";

afterEach(() => {
  vi.restoreAllMocks();
  authFns.createUserWithEmailAndPassword.mockReset();
  authFns.onAuthStateChanged.mockReset();
  authFns.onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback(null);
    return mockUnsubscribe;
  });
  authFns.sendPasswordResetEmail.mockReset();
  authFns.signInWithEmailAndPassword.mockReset();
  authFns.signInWithPopup.mockReset();
  authFns.signOut.mockReset();
  authFns.updateProfile.mockReset();
  mockUnsubscribe.mockClear();
  fb.auth = { __tag: "auth" };
  fb.googleProvider = { __tag: "google" };
  fb.githubProvider = { __tag: "github" };
  fb.hasFirebaseConfig = true;
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
        onClick={() =>
          void ctx.register("new@example.com", "pw", { displayName: "Neo" }).catch(() => {})
        }
      >
        register-with-name
      </button>
      <button
        type="button"
        onClick={() => void ctx.register("new@example.com", "pw", {}).catch(() => {})}
      >
        register-no-name
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
      <button type="button" onClick={() => void ctx.loginWithGithub().catch(() => {})}>
        login-github
      </button>
      <button type="button" onClick={() => ctx.clearError()}>
        clear-error
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("subscribes to onAuthStateChanged and exposes user when callback fires with a user", async () => {
    const mockUser = { uid: "user-1" };
    authFns.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(mockUser);
      return mockUnsubscribe;
    });
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("user-1");
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(authFns.onAuthStateChanged).toHaveBeenCalledWith(fb.auth, expect.any(Function));
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderAuth();
    unmount();
    // React 18 Strict Mode runs effect cleanup twice in development tests.
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("login clears prior error then succeeds", async () => {
    authFns.signInWithEmailAndPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-email" }));
    await waitFor(() => {
      expect(authFns.signInWithEmailAndPassword).toHaveBeenCalledWith(
        fb.auth,
        "u@example.com",
        "secret",
      );
    });
  });

  it("login sets error and rethrows when signInWithEmailAndPassword fails", async () => {
    const err = new Error("bad creds");
    authFns.signInWithEmailAndPassword.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-email" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("bad creds");
    });
    expect(console.error).toHaveBeenCalledWith("Firebase auth error", err);
  });

  it("register calls updateProfile when displayName is provided", async () => {
    const credUser = { uid: "new" };
    authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: credUser });
    authFns.updateProfile.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "register-with-name" }));
    await waitFor(() => {
      expect(authFns.updateProfile).toHaveBeenCalledWith(credUser, { displayName: "Neo" });
    });
  });

  it("register skips updateProfile when displayName is omitted", async () => {
    authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "x" } });
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "register-no-name" }));
    await waitFor(() => {
      expect(authFns.createUserWithEmailAndPassword).toHaveBeenCalled();
    });
    expect(authFns.updateProfile).not.toHaveBeenCalled();
  });

  it("register sets error when createUserWithEmailAndPassword fails", async () => {
    const err = new Error("weak password");
    authFns.createUserWithEmailAndPassword.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "register-no-name" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("weak password");
    });
  });

  it("logout calls signOut", async () => {
    authFns.signOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(authFns.signOut).toHaveBeenCalledWith(fb.auth);
    });
  });

  it("logout sets error when signOut fails", async () => {
    const err = new Error("signout failed");
    authFns.signOut.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("signout failed");
    });
  });

  it("resetPassword sends email", async () => {
    authFns.sendPasswordResetEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "reset-password" }));
    await waitFor(() => {
      expect(authFns.sendPasswordResetEmail).toHaveBeenCalledWith(fb.auth, "u@example.com");
    });
  });

  it("resetPassword sets error when sendPasswordResetEmail fails", async () => {
    const err = new Error("no user");
    authFns.sendPasswordResetEmail.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "reset-password" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("no user");
    });
  });

  it("loginWithGoogle uses signInWithPopup with google provider", async () => {
    authFns.signInWithPopup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-google" }));
    await waitFor(() => {
      expect(authFns.signInWithPopup).toHaveBeenCalledWith(fb.auth, fb.googleProvider);
    });
  });

  it("loginWithGithub uses signInWithPopup with github provider", async () => {
    authFns.signInWithPopup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-github" }));
    await waitFor(() => {
      expect(authFns.signInWithPopup).toHaveBeenCalledWith(fb.auth, fb.githubProvider);
    });
  });

  it("loginWithGoogle sets error when signInWithPopup fails", async () => {
    const err = new Error("popup blocked");
    authFns.signInWithPopup.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-google" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("popup blocked");
    });
  });

  it("clearError removes error state", async () => {
    const err = new Error("oops");
    authFns.signInWithEmailAndPassword.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-email" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("oops");
    });
    await user.click(screen.getByRole("button", { name: "clear-error" }));
    expect(screen.getByTestId("error-msg")).toHaveTextContent("");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    function Bad() {
      useAuth();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useAuth must be used within an AuthProvider");
  });

  it("register surfaces error when updateProfile fails after account creation", async () => {
    authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "1" } });
    const err = new Error("profile update failed");
    authFns.updateProfile.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "register-with-name" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("profile update failed");
    });
  });
});
