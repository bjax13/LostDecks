import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import Register from "./Register.jsx";

function makeAuthMock() {
  const state = {
    deferInitialCallback: false,
    initialUser: null,
  };
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

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/auth/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/register" element={<Register />} />
          <Route path="/collections" element={<h1>Collection</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Register", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("creates an account and navigates to /collections", async () => {
    const user = userEvent.setup();
    renderRegister();

    await screen.findByRole("heading", { name: /create your lost tales account/i });

    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Test User");
    await user.type(screen.getByRole("textbox", { name: /^email$/i }), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(authMock.createUserWithEmailAndPassword).toHaveBeenCalled();
    });

    expect(authMock.updateProfile).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: /^collection$/i })).toBeInTheDocument();
  });

  it("shows registration errors from the auth context", async () => {
    authMock.createUserWithEmailAndPassword.mockRejectedValueOnce(
      new Error("Email already in use"),
    );

    const user = userEvent.setup();
    renderRegister();

    await screen.findByRole("heading", { name: /create your lost tales account/i });

    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Test User");
    await user.type(screen.getByRole("textbox", { name: /^email$/i }), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("links back to sign in", async () => {
    renderRegister();
    await screen.findByRole("heading", { name: /create your lost tales account/i });

    expect(screen.getByRole("link", { name: /already have an account/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });
});
