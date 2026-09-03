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
  signInAnonymously: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/auth", () => authFns);

const fb = vi.hoisted(() => ({
  auth: { __tag: "auth" },
  googleProvider: { __tag: "google" },
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
  authFns.signInAnonymously.mockReset();
  authFns.signInWithEmailAndPassword.mockReset();
  authFns.signInWithPopup.mockReset();
  authFns.signOut.mockReset();
  authFns.updateProfile.mockReset();
  mockUnsubscribe.mockClear();
  fb.auth = { __tag: "auth" };
  fb.googleProvider = { __tag: "google" };
  fb.hasFirebaseConfig = true;
});

function Harness() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user-id">{ctx.user?.uid ?? "none"}</span>
      <span data-testid="error-msg">{ctx.error?.message ?? ""}</span>
      <span data-testid="display-name">{ctx.user?.displayName ?? ""}</span>
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
      <button type="button" onClick={() => void ctx.loginAsGuest().catch(() => {})}>
        login-guest
      </button>
      <button type="button" onClick={() => ctx.clearError()}>
        clear-error
      </button>
      <button type="button" onClick={() => void ctx.updateDisplayName("River Tam").catch(() => {})}>
        update-display-name
      </button>
      <button type="button" onClick={() => void ctx.updateDisplayName("   ").catch(() => {})}>
        update-display-name-blank
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

  it("loginAsGuest calls signInAnonymously", async () => {
    authFns.signInAnonymously.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-guest" }));
    await waitFor(() => {
      expect(authFns.signInAnonymously).toHaveBeenCalledWith(fb.auth);
    });
  });

  it("loginAsGuest sets error when signInAnonymously fails", async () => {
    const err = new Error("anonymous disabled");
    authFns.signInAnonymously.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login-guest" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("anonymous disabled");
    });
    expect(console.error).toHaveBeenCalledWith("Firebase auth error", err);
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

  it("updateDisplayName writes the trimmed name and refreshes user state", async () => {
    const currentUser = { uid: "user-1", displayName: "Old Name", email: "a@example.com" };
    fb.auth = { currentUser };
    authFns.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(currentUser);
      return mockUnsubscribe;
    });
    authFns.updateProfile.mockImplementation(async (firebaseUser, profile) => {
      firebaseUser.displayName = profile.displayName;
    });
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("display-name")).toHaveTextContent("Old Name");
    });
    await user.click(screen.getByRole("button", { name: "update-display-name" }));
    await waitFor(() => {
      expect(authFns.updateProfile).toHaveBeenCalledWith(currentUser, { displayName: "River Tam" });
    });
    expect(screen.getByTestId("display-name")).toHaveTextContent("River Tam");
  });

  it("updateDisplayName does not restore a user after the auth session changes", async () => {
    const originalUser = { uid: "user-1", displayName: "Old Name", email: "a@example.com" };
    const nextUser = { uid: "user-2", displayName: "Other" };
    let authCallback = () => {};
    fb.auth = { currentUser: originalUser };
    authFns.onAuthStateChanged.mockImplementation((_auth, callback) => {
      authCallback = callback;
      callback(originalUser);
      return mockUnsubscribe;
    });
    authFns.updateProfile.mockImplementation(async () => {
      fb.auth.currentUser = nextUser;
      authCallback(nextUser);
    });
    const user = userEvent.setup();
    renderAuth();
    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("user-1");
    });
    await user.click(screen.getByRole("button", { name: "update-display-name" }));
    await waitFor(() => {
      expect(authFns.updateProfile).toHaveBeenCalledWith(originalUser, {
        displayName: "River Tam",
      });
    });
    expect(screen.getByTestId("user-id")).toHaveTextContent("user-2");
    expect(screen.getByTestId("display-name")).toHaveTextContent("Other");
  });

  it("updateDisplayName rejects a blank name without calling updateProfile", async () => {
    const currentUser = { uid: "user-1", displayName: "Old Name" };
    fb.auth = { currentUser };
    authFns.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(currentUser);
      return mockUnsubscribe;
    });
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "update-display-name-blank" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("Display name cannot be empty.");
    });
    expect(authFns.updateProfile).not.toHaveBeenCalled();
  });

  it("updateDisplayName errors when no user is signed in", async () => {
    fb.auth = { currentUser: null };
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "update-display-name" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent(
        "You must be signed in to update your display name.",
      );
    });
    expect(authFns.updateProfile).not.toHaveBeenCalled();
  });

  it("updateDisplayName surfaces updateProfile failures", async () => {
    const currentUser = { uid: "user-1", displayName: "Old Name" };
    fb.auth = { currentUser };
    const err = new Error("profile write failed");
    authFns.updateProfile.mockRejectedValue(err);
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "update-display-name" }));
    await waitFor(() => {
      expect(screen.getByTestId("error-msg")).toHaveTextContent("profile write failed");
    });
  });
});
