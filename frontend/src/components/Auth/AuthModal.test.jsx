import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../contexts/AuthContext.jsx";
import AuthModal from "./AuthModal.jsx";

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

function renderModal({ isOpen = true, onClose = vi.fn() } = {}) {
  return render(
    <AuthProvider>
      <AuthModal isOpen={isOpen} onClose={onClose} />
    </AuthProvider>,
  );
}

describe("AuthModal", () => {
  beforeEach(() => {
    authMock.state.deferInitialCallback = false;
    authMock.state.initialUser = null;
    vi.clearAllMocks();
  });

  it("returns null when closed", () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it("submits sign-in and calls onClose on success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await screen.findByRole("heading", { name: /^sign in$/i });

    await user.type(screen.getByRole("textbox", { name: /email/i }), "a@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(authMock.signInWithEmailAndPassword).toHaveBeenCalled();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to register and creates an account", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await screen.findByRole("heading", { name: /^sign in$/i });
    await user.click(screen.getByRole("button", { name: /need an account/i }));

    expect(await screen.findByRole("heading", { name: /create account/i })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /display name/i }), "Modal User");
    await user.type(screen.getByRole("textbox", { name: /^email$/i }), "modal@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret12");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => {
      expect(authMock.createUserWithEmailAndPassword).toHaveBeenCalled();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to forgot password flow from sign-in", async () => {
    const user = userEvent.setup();
    renderModal();

    await screen.findByRole("heading", { name: /^sign in$/i });
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(await screen.findByRole("heading", { name: /reset password/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it("closes when the close control is activated", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await screen.findByRole("heading", { name: /^sign in$/i });
    await user.click(screen.getByRole("button", { name: "×" }));

    expect(onClose).toHaveBeenCalled();
  });
});
