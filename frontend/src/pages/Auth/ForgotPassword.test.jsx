import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Reset your password/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset email" })).toBeInTheDocument();
  });

  it("calls resetPassword on submit", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));
    expect(mockResetPassword).toHaveBeenCalledWith("user@example.com");
  });

  it("shows success message after submit", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));
    expect(screen.getByText(/Check your inbox/)).toBeInTheDocument();
  });
});
