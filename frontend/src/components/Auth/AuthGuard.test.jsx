import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import AuthGuard from "./AuthGuard.jsx";

function makeAuthMock() {
  const state = {
    deferInitialCallback: false,
    initialUser: null,
  };
  let pendingCallback = null;
  const fireAuthState = (user) => {
    pendingCallback?.(user);
  };
  const onAuthStateChanged = vi.fn((_auth, callback) => {
    pendingCallback = callback;
    if (!state.deferInitialCallback) {
      queueMicrotask(() => callback(state.initialUser));
    }
    return vi.fn();
  });
  return {
    state,
    fireAuthState,
    onAuthStateChanged,
    signInWithEmailAndPassword: vi.fn(() => Promise.resolve()),
    createUserWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: {} })),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    signInWithPopup: vi.fn(() => Promise.resolve()),
    updateProfile: vi.fn(() => Promise.resolve()),
  };
}

const authMock = vi.hoisted(() => makeAuthMock());

vi.mock("firebase/auth", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    onAuthStateChanged: authMock.onAuthStateChanged,
    signInWithEmailAndPassword: authMock.signInWithEmailAndPassword,
    createUserWithEmailAndPassword: authMock.createUserWithEmailAndPassword,
    sendPasswordResetEmail: authMock.sendPasswordResetEmail,
    signOut: authMock.signOut,
    signInWithPopup: authMock.signInWithPopup,
    updateProfile: authMock.updateProfile,
  };
});

function renderGuard(initialPath = "/protected", options = {}) {
  const { fallback = <span>Loading guard</span> } = options;
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard fallback={fallback}>
                <h1>Protected</h1>
              </AuthGuard>
            }
          />
          <Route path="/auth/login" element={<h1>Login page</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AuthGuard", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("renders fallback while auth is loading", async () => {
    authMock.state.deferInitialCallback = true;
    renderGuard();

    expect(screen.getByText("Loading guard")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^protected$/i })).not.toBeInTheDocument();

    authMock.fireAuthState(null);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^login page$/i })).toBeInTheDocument();
    });
  });

  it("redirects signed-out users to login with state.from", async () => {
    renderGuard();

    expect(await screen.findByRole("heading", { name: /^login page$/i })).toBeInTheDocument();
  });

  it("renders children when signed in", async () => {
    authMock.state.initialUser = { uid: "u1", email: "in@example.com" };
    renderGuard();

    expect(await screen.findByRole("heading", { name: /^protected$/i })).toBeInTheDocument();
  });
});
