import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import Login from "./Login.jsx";

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
    createUserWithEmailAndPassword: vi.fn(() =>
      Promise.resolve({ user: { uid: "new-user", email: "n@example.com" } }),
    ),
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

function renderLogin(initialPath = "/auth/login", routeState = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state: routeState }]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/collections" element={<h1>Collection</h1>} />
          <Route path="/market" element={<h1>Market</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    authMock.state.deferInitialCallback = false;
  });

  it("submits email and password and navigates to the default redirect (/collections)", async () => {
    const user = userEvent.setup();
    renderLogin();

    await screen.findByRole("heading", { name: /sign in to lost tales marketplace/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "a@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(authMock.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "a@example.com",
        "secret12",
      );
    });

    expect(await screen.findByRole("heading", { name: /^collection$/i })).toBeInTheDocument();
  });

  it("redirects to location.state.from when present", async () => {
    const user = userEvent.setup();
    renderLogin("/auth/login", { from: { pathname: "/market" } });

    await screen.findByRole("heading", { name: /sign in to lost tales marketplace/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "a@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("heading", { name: /^market$/i })).toBeInTheDocument();
  });

  it("renders auth error message from context", async () => {
    authMock.signInWithEmailAndPassword.mockRejectedValueOnce(new Error("Invalid credentials"));

    const user = userEvent.setup();
    renderLogin();

    await screen.findByRole("heading", { name: /sign in to lost tales marketplace/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "a@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("links to forgot password and register", async () => {
    renderLogin();
    await screen.findByRole("heading", { name: /sign in to lost tales marketplace/i });

    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/auth/forgot",
    );
    expect(screen.getByRole("link", { name: /need an account/i })).toHaveAttribute(
      "href",
      "/auth/register",
    );
  });
});
