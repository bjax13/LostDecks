import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseAuthModal = vi.hoisted(() => vi.fn());

vi.mock("./contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("./contexts/AuthModalContext.jsx", () => ({
  useAuthModal: mockUseAuthModal,
}));

function signedOutAuth(overrides = {}) {
  return {
    user: null,
    logout: vi.fn(),
    loading: false,
    loginAsGuest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("App (hook mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
    mockUseAuthModal.mockReturnValue({ openAuthModal: vi.fn() });
    mockUseAuth.mockReturnValue(signedOutAuth());
  });

  it("shows the session check message while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      loading: true,
    });
    render(<App />);
    expect(screen.getByText("Checking session…")).toBeInTheDocument();
  });

  it("greets a signed-in user by display name when present", () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: "River Tam", email: "river@example.com" },
      logout: vi.fn(),
      loading: false,
    });
    render(<App />);
    expect(screen.getByText("Hi, River Tam")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("falls back to email in the welcome line when displayName is missing", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "only@example.com" },
      logout: vi.fn(),
      loading: false,
    });
    render(<App />);
    expect(screen.getByText("Hi, only@example.com")).toBeInTheDocument();
  });

  it("calls logout when Sign out is clicked", async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { displayName: "Test", email: "t@example.com" },
      logout,
      loading: false,
    });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("logs when sign out fails", async () => {
    const user = userEvent.setup();
    const err = new Error("network");
    const logout = vi.fn().mockRejectedValue(err);
    mockUseAuth.mockReturnValue({
      user: { email: "x@y.com" },
      logout,
      loading: false,
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(errSpy).toHaveBeenCalledWith("Sign out failed", err);
    errSpy.mockRestore();
  });

  it("starts a guest session when Quick sign in is clicked", async () => {
    const user = userEvent.setup();
    const loginAsGuest = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(signedOutAuth({ loginAsGuest }));
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    expect(loginAsGuest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Sign In" })).not.toBeInTheDocument();
  });

  it("shows a signing-in state while Quick sign in is in progress", async () => {
    const user = userEvent.setup();
    let resolveGuest;
    const loginAsGuest = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveGuest = resolve;
        }),
    );
    mockUseAuth.mockReturnValue(signedOutAuth({ loginAsGuest }));
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    const pendingButton = screen.getByRole("button", { name: "Signing in…" });
    expect(pendingButton).toBeDisabled();
    resolveGuest();
    expect(await screen.findByRole("button", { name: "Quick sign in" })).toBeEnabled();
  });

  it("shows an alert when Quick sign in fails", async () => {
    const user = userEvent.setup();
    const err = new Error("Anonymous sign-in is disabled");
    const loginAsGuest = vi.fn().mockRejectedValue(err);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseAuth.mockReturnValue(signedOutAuth({ loginAsGuest }));
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Anonymous sign-in is disabled");
    expect(errSpy).toHaveBeenCalledWith("Quick sign in failed", err);
    errSpy.mockRestore();
  });

  it("shows a fallback alert when Quick sign in fails without a message", async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseAuth.mockReturnValue(signedOutAuth({ loginAsGuest: vi.fn().mockRejectedValue({}) }));
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Guest sign-in failed.");
    errSpy.mockRestore();
  });

  it("clears the guest error when the route changes", async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseAuth.mockReturnValue(
      signedOutAuth({ loginAsGuest: vi.fn().mockRejectedValue(new Error("guest failed")) }),
    );
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("guest failed");
    await user.click(screen.getByRole("link", { name: "Collectibles" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    errSpy.mockRestore();
  });

  it("clears the guest error after a later signed-in session ends", async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUseAuth.mockReturnValue(
      signedOutAuth({ loginAsGuest: vi.fn().mockRejectedValue(new Error("guest failed")) }),
    );
    const { rerender } = render(<App />);
    await user.click(screen.getByRole("button", { name: "Quick sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("guest failed");

    mockUseAuth.mockReturnValue({
      user: { displayName: "Pat", email: "pat@example.com" },
      logout: vi.fn(),
      loading: false,
      loginAsGuest: vi.fn(),
    });
    rerender(<App />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    mockUseAuth.mockReturnValue(signedOutAuth());
    rerender(<App />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    errSpy.mockRestore();
  });

  it("greets an anonymous guest when displayName and email are missing", () => {
    mockUseAuth.mockReturnValue({
      user: { isAnonymous: true },
      logout: vi.fn(),
      loading: false,
      loginAsGuest: vi.fn(),
    });
    render(<App />);
    expect(screen.getByText("Hi, Guest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("falls back to Signed in when a session has no name, email, or guest flag", () => {
    mockUseAuth.mockReturnValue({
      user: {},
      logout: vi.fn(),
      loading: false,
      loginAsGuest: vi.fn(),
    });
    render(<App />);
    expect(screen.getByText("Hi, Signed in")).toBeInTheDocument();
  });

  it("renders sign-in navigation for a signed-out user", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quick sign in" })).toBeInTheDocument();
  });
});
