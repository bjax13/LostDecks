import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import ForgotPassword from "./ForgotPassword.jsx";

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

function renderForgotPassword() {
  return render(
    <MemoryRouter initialEntries={["/auth/forgot"]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/forgot" element={<ForgotPassword />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ForgotPassword", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("sends a password reset email and shows confirmation", async () => {
    const user = userEvent.setup();
    renderForgotPassword();

    await screen.findByRole("heading", { name: /reset your password/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "recover@example.com");
    await user.click(screen.getByRole("button", { name: /send reset email/i }));

    await waitFor(() => {
      expect(authMock.sendPasswordResetEmail).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/check your inbox for a password reset link/i),
    ).toBeInTheDocument();
  });

  it("surfaces reset errors from the auth context", async () => {
    authMock.sendPasswordResetEmail.mockRejectedValueOnce(new Error("User not found"));

    const user = userEvent.setup();
    renderForgotPassword();

    await screen.findByRole("heading", { name: /reset your password/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "missing@example.com");
    await user.click(screen.getByRole("button", { name: /send reset email/i }));

    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("links back to sign in", async () => {
    renderForgotPassword();
    await screen.findByRole("heading", { name: /reset your password/i });

    expect(screen.getByRole("link", { name: /return to sign in/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });
});
