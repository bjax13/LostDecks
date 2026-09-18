import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import Login from "./Login.jsx";

const mockLogin = vi.fn();
const mockClearError = vi.fn();
let mockError = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    error: mockError,
    clearError: mockClearError,
  }),
}));

vi.mock("../../components/Auth/SocialLoginButtons", () => ({
  default: ({ onSuccess }) => (
    <button type="button" onClick={() => onSuccess?.()}>
      Google
    </button>
  ),
}));

function renderLogin(entry = "/auth/login") {
  return render(
    <TestMemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/collections" element={<div>Collection page</div>} />
        <Route path="/account" element={<div>Account page</div>} />
        <Route path="/matches" element={<div>Matches page</div>} />
      </Routes>
    </TestMemoryRouter>,
  );
}

async function fillAndSubmit(user) {
  await user.click(screen.getByLabelText(/Email/i));
  await user.paste("test@example.com");
  await user.click(screen.getByLabelText(/Password/i));
  await user.paste("password123");
  await user.click(screen.getByRole("button", { name: "Sign In" }));
}

describe("Login (unit)", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    user = userEvent.setup({ delay: null });
  });

  it("renders sign in form", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: /Sign in to ShardStash/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("calls login on submit with email and password", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    await fillAndSubmit(user);
    expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("navigates to home after successful email/password login", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    await fillAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByText("Home page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Collection page")).not.toBeInTheDocument();
  });

  it("honors state.from over home after successful login", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin({
      pathname: "/auth/login",
      state: { from: { pathname: "/account", search: "", hash: "" } },
    });
    await fillAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByText("Account page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  it("honors ?redirect= over home after successful login", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin("/auth/login?redirect=/matches");
    await fillAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByText("Matches page")).toBeInTheDocument();
    });
  });

  it("stays on login when email/password login fails", async () => {
    mockLogin.mockRejectedValue(new Error("nope"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderLogin();
    await fillAndSubmit(user);
    expect(screen.getByRole("heading", { name: /Sign in to ShardStash/ })).toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith("Login failed", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("navigates to home after successful Google login", async () => {
    renderLogin();
    await user.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });

  it("shows error when provided", () => {
    mockError = new Error("Invalid credentials");
    renderLogin();
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("maps a Firebase invalid-credential error to friendly copy", () => {
    mockError = new Error("Firebase: Error (auth/invalid-credential).");
    mockError.code = "auth/invalid-credential";
    renderLogin();
    expect(screen.getByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText(/Firebase:/)).not.toBeInTheDocument();
  });
});
