import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  default: () => <div data-testid="social-login">Social</div>,
}));

function renderLogin() {
  return render(
    <TestMemoryRouter>
      <Login />
    </TestMemoryRouter>,
  );
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
    expect(screen.getByRole("heading", { name: /Sign in to Lost Tales/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("calls login on submit with email and password", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    await user.click(screen.getByLabelText(/Email/i));
    await user.paste("test@example.com");
    await user.click(screen.getByLabelText(/Password/i));
    await user.paste("password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("shows error when provided", () => {
    mockError = new Error("Invalid credentials");
    renderLogin();
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });
});
