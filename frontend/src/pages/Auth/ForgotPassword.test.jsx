import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
import ForgotPassword from "./ForgotPassword.jsx";

const mockResetPassword = vi.fn();
let mockError = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    resetPassword: mockResetPassword,
    error: mockError,
    clearError: vi.fn(),
  }),
}));

describe("ForgotPassword (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
  });

  it("renders reset form", () => {
    render(
      <TestMemoryRouter>
        <ForgotPassword />
      </TestMemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Reset your password/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset email" })).toBeInTheDocument();
  });

  it("calls resetPassword on submit", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(
      <TestMemoryRouter>
        <ForgotPassword />
      </TestMemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));
    expect(mockResetPassword).toHaveBeenCalledWith("user@example.com");
  });

  it("shows success message after submit", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(
      <TestMemoryRouter>
        <ForgotPassword />
      </TestMemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));
    expect(screen.getByText(/Check your inbox/)).toBeInTheDocument();
  });

  it("maps user-not-found to reset copy instead of a password message", () => {
    mockError = new Error("Firebase: Error (auth/user-not-found).");
    mockError.code = "auth/user-not-found";
    render(
      <TestMemoryRouter>
        <ForgotPassword />
      </TestMemoryRouter>,
    );
    expect(
      screen.getByText("If an account exists for that email, a reset link has been sent."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/password is incorrect/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Firebase:/)).not.toBeInTheDocument();
  });
});
