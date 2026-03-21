import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../contexts/AuthContext.jsx";
import { useAuthGuard } from "./useAuthGuard.js";

function makeAuthMock() {
  const state = { deferInitialCallback: false, initialUser: null };
  const onAuthStateChanged = vi.fn((_auth, callback) => {
    if (!state.deferInitialCallback) {
      queueMicrotask(() => callback(state.initialUser));
    }
    return vi.fn();
  });
  return {
    state,
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

function GuardProbe() {
  const { isAuthenticated, loading, redirectState } = useAuthGuard();
  return (
    <div>
      <span data-testid="loading">{loading ? "loading" : "ready"}</span>
      <span data-testid="auth">{isAuthenticated ? "in" : "out"}</span>
      <span data-testid="from">{redirectState.from?.pathname ?? ""}</span>
    </div>
  );
}

function renderProbe(initialPath = "/here") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/here" element={<GuardProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("useAuthGuard", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("reports signed-out state and captures the current path for redirects", async () => {
    renderProbe("/here");

    expect(await screen.findByTestId("loading")).toHaveTextContent("ready");
    expect(screen.getByTestId("auth")).toHaveTextContent("out");
    expect(screen.getByTestId("from")).toHaveTextContent("/here");
  });

  it("reports authenticated when a user is present", async () => {
    authMock.state.initialUser = { uid: "1", email: "a@b.com" };
    renderProbe();

    expect(await screen.findByTestId("auth")).toHaveTextContent("in");
  });
});
