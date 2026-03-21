import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../contexts/AuthContext.jsx";
import { useRequireAuth } from "./useRequireAuth.js";

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

function SecretPage() {
  const location = useLocation();
  const { user, loading } = useRequireAuth();

  if (loading) {
    return <p>Loading session</p>;
  }
  if (!user) {
    return <p>Should redirect</p>;
  }

  return (
    <div>
      <h1>Secret</h1>
      <p>{location.pathname}</p>
    </div>
  );
}

function renderSecret(initialPath = "/secret") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/secret" element={<SecretPage />} />
          <Route path="/auth/login" element={<h1>Login</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("useRequireAuth", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("navigates to login when unauthenticated after loading", async () => {
    renderSecret("/secret");

    expect(await screen.findByRole("heading", { name: /^login$/i })).toBeInTheDocument();
  });

  it("passes through when a user exists", async () => {
    authMock.state.initialUser = { uid: "1", email: "a@b.com" };
    renderSecret("/secret");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^secret$/i })).toBeInTheDocument();
    });
    expect(screen.getByText("/secret")).toBeInTheDocument();
  });
});
