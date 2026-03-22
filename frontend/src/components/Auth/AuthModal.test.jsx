import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthModal from "./AuthModal.jsx";

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockResetPassword = vi.fn();
const mockClearError = vi.fn();
let mockError = null;

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    resetPassword: mockResetPassword,
    error: mockError,
    clearError: mockClearError,
  }),
}));

vi.mock("./SocialLoginButtons", () => ({
  default: ({ onSuccess }) => (
    <button type="button" data-testid="social-mock-success" onClick={() => onSuccess?.()}>
      Social success
    </button>
  ),
}));

function renderModal(props = {}) {
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(<AuthModal isOpen={props.isOpen ?? true} onClose={onClose} />),
  };
}

describe("AuthModal (unit)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders nothing when closed", () => {
    render(<AuthModal isOpen={false} onClose={vi.fn()} />);
    expect(document.querySelector(".auth-modal__backdrop")).not.toBeInTheDocument();
  });

  it("calls clearError when isOpen becomes false", () => {
    const onClose = vi.fn();
    const { rerender } = render(<AuthModal isOpen onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    mockClearError.mockClear();
    rerender(<AuthModal isOpen={false} onClose={onClose} />);
    expect(mockClearError).toHaveBeenCalled();
  });

  it("shows login form with correct password autocomplete", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    const password = screen.getByLabelText(/^Password$/i);
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("displays auth error message when present", () => {
    mockError = { message: "Bad credentials" };
    renderModal();
    expect(screen.getByText("Bad credentials")).toHaveClass("auth-modal__error");
  });

  it("close button resets state, clears error, and calls onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(screen.getByLabelText(/^Email$/i), "a@b.com");
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(mockClearError).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to register mode and clears error", async () => {
    const user = userEvent.setup();
    renderModal();
    mockClearError.mockClear();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    expect(mockClearError).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Display Name$/i)).toBeInTheDocument();
    const password = screen.getByLabelText(/^Password$/i);
    expect(password).toHaveAttribute("autocomplete", "new-password");
  });

  it("switches from register back to login via switcher", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    await user.click(screen.getByRole("button", { name: /Already have an account/i }));
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  });

  it("switches to forgot password mode and hides password field", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText("Forgot password?"));
    expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Email" })).toBeInTheDocument();
  });

  it("updates controlled fields via handleChange", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    await user.type(screen.getByLabelText(/^Display Name$/i), "Pat");
    await user.type(screen.getByLabelText(/^Email$/i), "pat@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "secret12");
    expect(screen.getByLabelText(/^Display Name$/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/^Email$/i)).toHaveValue("pat@example.com");
    expect(screen.getByLabelText(/^Password$/i)).toHaveValue("secret12");
  });

  it("submits login and closes on success", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);
    const { onClose } = renderModal();
    await user.type(screen.getByLabelText(/^Email$/i), "u@x.com");
    await user.type(screen.getByLabelText(/^Password$/i), "pw123456");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(mockLogin).toHaveBeenCalledWith("u@x.com", "pw123456");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs when login rejects", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("nope"));
    renderModal();
    await user.type(screen.getByLabelText(/^Email$/i), "u2@x.com");
    await user.type(screen.getByLabelText(/^Password$/i), "pw222222");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Login failed", expect.any(Error));
  });

  it("submits register with displayName and closes on success", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    mockRegister.mockResolvedValueOnce(undefined);
    await user.type(screen.getByLabelText(/^Display Name$/i), "Sam");
    await user.type(screen.getByLabelText(/^Email$/i), "sam@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "pw123456");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(mockRegister).toHaveBeenCalledWith("sam@example.com", "pw123456", {
      displayName: "Sam",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs when registration rejects", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    mockRegister.mockRejectedValueOnce(new Error("reg fail"));
    await user.type(screen.getByLabelText(/^Display Name$/i), "Other");
    await user.type(screen.getByLabelText(/^Email$/i), "other@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "pw123456");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Registration failed", expect.any(Error));
  });

  it("submits forgot password, closes on success, and logs on failure", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByText("Forgot password?"));
    mockResetPassword.mockResolvedValueOnce(undefined);
    await user.type(screen.getByLabelText(/^Email$/i), "reset@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Email" }));
    expect(mockResetPassword).toHaveBeenCalledWith("reset@example.com");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Forgot password?"));
    mockResetPassword.mockRejectedValueOnce(new Error("reset fail"));
    await user.type(screen.getByLabelText(/^Email$/i), "bad@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Email" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Reset password failed", expect.any(Error));
  });

  it("invokes onClose when mocked social login triggers onSuccess", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId("social-mock-success"));
    expect(mockClearError).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
