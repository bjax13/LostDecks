import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseAuthModal = vi.hoisted(() => vi.fn());

vi.mock("./contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

// Home (and other routes) still call useAuthModal; MainNav no longer does.
vi.mock("./contexts/AuthModalContext.jsx", () => ({
  useAuthModal: mockUseAuthModal,
}));

describe("App (hook mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthModal.mockReturnValue({ openAuthModal: vi.fn() });
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      loading: false,
    });
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

  it("renders sign-in navigation for a signed-out user", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "ShardStash" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth/login");
    expect(screen.queryByRole("button", { name: "Quick sign in" })).not.toBeInTheDocument();
  });
});
