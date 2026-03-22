import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Register from "./Register.jsx";

const mockRegister = vi.fn();
let mockError = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    register: mockRegister,
    error: mockError,
    clearError: vi.fn(),
  }),
}));

vi.mock("../../components/Auth/SocialLoginButtons", () => ({
  default: () => <div data-testid="social-login">Social</div>,
}));

describe("Register (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
  });

  it("renders registration form", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /Create your Lost Tales account/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it("calls register on submit", async () => {
    mockRegister.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/Display Name/i), "Test User");
    await userEvent.type(screen.getByLabelText(/Email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/Password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(mockRegister).toHaveBeenCalledWith("new@example.com", "secret123", {
      displayName: "Test User",
    });
  });
});
