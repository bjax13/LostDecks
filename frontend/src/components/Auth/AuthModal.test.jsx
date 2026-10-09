import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestMemoryRouter } from "../../test/router.jsx";
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
  default: ({ onSuccess, leadIn = "Or continue with" }) => (
    <div>
      <p>{leadIn}</p>
      <button type="button" data-testid="social-mock-success" onClick={() => onSuccess?.()}>
        Social success
      </button>
    </div>
  ),
}));

function renderModal(props = {}) {
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <TestMemoryRouter>
        <AuthModal isOpen={props.isOpen ?? true} onClose={onClose} context={props.context ?? null} />
      </TestMemoryRouter>,
    ),
  };
}

describe("AuthModal (unit)", () => {
  let consoleErrorSpy;
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders nothing when closed", () => {
    render(
      <TestMemoryRouter>
        <AuthModal isOpen={false} onClose={vi.fn()} />
      </TestMemoryRouter>,
    );
    expect(document.querySelector(".auth-modal__backdrop")).not.toBeInTheDocument();
  });

  it("calls clearError when isOpen becomes false", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <TestMemoryRouter>
        <AuthModal isOpen onClose={onClose} />
      </TestMemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    mockClearError.mockClear();
    rerender(
      <TestMemoryRouter>
        <AuthModal isOpen={false} onClose={onClose} />
      </TestMemoryRouter>,
    );
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

  it("maps a Firebase invalid-credential error to friendly copy", () => {
    mockError = {
      code: "auth/invalid-credential",
      message: "Firebase: Error (auth/invalid-credential).",
    };
    renderModal();
    expect(screen.getByText("Email or password is incorrect.")).toHaveClass("auth-modal__error");
    expect(screen.queryByText(/Firebase:/)).not.toBeInTheDocument();
  });

  it("maps user-not-found to reset copy in forgot-password mode", async () => {
    mockError = {
      code: "auth/user-not-found",
      message: "Firebase: Error (auth/user-not-found).",
    };
    renderModal();
    await user.click(screen.getByText("Forgot password?"));
    expect(
      screen.getByText("If an account exists for that email, a reset link has been sent."),
    ).toHaveClass("auth-modal__error");
    expect(screen.queryByText(/password is incorrect/i)).not.toBeInTheDocument();
  });

  it("close button resets state, clears error, and calls onClose", async () => {
    const { onClose } = renderModal();
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("a@b.com");
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(mockClearError).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to register mode and clears error", async () => {
    renderModal();
    mockClearError.mockClear();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    expect(mockClearError).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Display Name$/i)).toBeInTheDocument();
    const password = screen.getByLabelText(/^Password$/i);
    expect(password).toHaveAttribute("autocomplete", "new-password");
  });

  it("shows Terms and Privacy Policy consent links in register mode", async () => {
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    const termsLinks = screen.getAllByRole("link", { name: "Terms" });
    const privacyLinks = screen.getAllByRole("link", { name: "Privacy Policy" });
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
    expect(termsLinks[0]).toHaveAttribute("href", "/terms");
    expect(privacyLinks[0]).toHaveAttribute("href", "/privacy");
    await user.click(termsLinks[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("switches from register back to login via switcher", async () => {
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    await user.click(screen.getByRole("button", { name: /Already have an account/i }));
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
  });

  it("switches to forgot password mode and hides password field", async () => {
    renderModal();
    await user.click(screen.getByText("Forgot password?"));
    expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Email" })).toBeInTheDocument();
  });

  it("updates controlled fields via handleChange", async () => {
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    await user.click(screen.getByLabelText(/^Display Name$/i));
    await user.paste("Pat");
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("pat@example.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("secret12");
    expect(screen.getByLabelText(/^Display Name$/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/^Email$/i)).toHaveValue("pat@example.com");
    expect(screen.getByLabelText(/^Password$/i)).toHaveValue("secret12");
  });

  it("submits login and closes on success", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const { onClose } = renderModal();
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("u@x.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw123456");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(mockLogin).toHaveBeenCalledWith("u@x.com", "pw123456");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs when login rejects", async () => {
    mockLogin.mockRejectedValueOnce(new Error("nope"));
    renderModal();
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("u2@x.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw222222");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Login failed", expect.any(Error));
  });

  it("submits register with displayName and closes on success", async () => {
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    mockRegister.mockResolvedValueOnce(undefined);
    await user.click(screen.getByLabelText(/^Display Name$/i));
    await user.paste("Sam");
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("sam@example.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw123456");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(mockRegister).toHaveBeenCalledWith("sam@example.com", "pw123456", {
      displayName: "Sam",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs when registration rejects", async () => {
    renderModal();
    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    mockRegister.mockRejectedValueOnce(new Error("reg fail"));
    await user.click(screen.getByLabelText(/^Display Name$/i));
    await user.paste("Other");
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("other@example.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw123456");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Registration failed", expect.any(Error));
  });

  it("submits forgot password, closes on success, and logs on failure", async () => {
    const { onClose } = renderModal();
    await user.click(screen.getByText("Forgot password?"));
    mockResetPassword.mockResolvedValueOnce(undefined);
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("reset@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Email" }));
    expect(mockResetPassword).toHaveBeenCalledWith("reset@example.com");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Forgot password?"));
    mockResetPassword.mockRejectedValueOnce(new Error("reset fail"));
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("bad@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Email" }));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Reset password failed", expect.any(Error));
  });

  it("invokes onClose when mocked social login triggers onSuccess", async () => {
    const { onClose } = renderModal();
    await user.click(screen.getByTestId("social-mock-success"));
    expect(mockClearError).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens in register mode when context.initialMode is register", () => {
    renderModal({ context: { initialMode: "register" } });
    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText("Or use email")).toBeInTheDocument();
  });

  it("calls context.onSuccess before closing after register", async () => {
    const onSuccess = vi.fn();
    const { onClose } = renderModal({ context: { initialMode: "register", onSuccess } });
    mockRegister.mockResolvedValueOnce(undefined);
    await user.click(screen.getByLabelText(/^Display Name$/i));
    await user.paste("Sam");
    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("sam@example.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw123456");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on success without navigating away from the page that opened the modal", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <TestMemoryRouter initialEntries={["/collectibles"]}>
        <Routes>
          <Route
            path="/collectibles"
            element={
              <>
                <h1>Collectibles</h1>
                <AuthModal isOpen onClose={onClose} />
              </>
            }
          />
          <Route path="/" element={<h1>Home page</h1>} />
        </Routes>
      </TestMemoryRouter>,
    );

    await user.click(screen.getByLabelText(/^Email$/i));
    await user.paste("u@x.com");
    await user.click(screen.getByLabelText(/^Password$/i));
    await user.paste("pw123456");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Collectibles" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home page" })).not.toBeInTheDocument();
  });
});
