import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getAuthErrorMessage } from "../../lib/authErrorMessage";
import SignupConsent from "./SignupConsent";
import SocialLoginButtons from "./SocialLoginButtons";

const modes = {
  LOGIN: "login",
  REGISTER: "register",
  FORGOT: "forgot",
};

function AuthModal({ isOpen, onClose, context = null }) {
  const [mode, setMode] = useState(modes.LOGIN);
  const [formState, setFormState] = useState({ email: "", password: "", displayName: "" });
  const { login, register, resetPassword, error, clearError } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setFormState({ email: "", password: "", displayName: "" });
      setMode(modes.LOGIN);
      clearError();
      return;
    }
    const initialMode = context?.initialMode;
    if (
      initialMode === modes.REGISTER ||
      initialMode === modes.LOGIN ||
      initialMode === modes.FORGOT
    ) {
      setMode(initialMode);
    } else {
      setMode(modes.LOGIN);
    }
    clearError();
  }, [isOpen, context?.initialMode, clearError]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    clearError();
    setFormState({ email: "", password: "", displayName: "" });
    setMode(modes.LOGIN);
    onClose();
  };

  const finishSuccess = () => {
    context?.onSuccess?.();
    handleClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (mode === modes.LOGIN) {
      try {
        await login(formState.email, formState.password);
        finishSuccess();
      } catch (err) {
        console.error("Login failed", err);
      }
      return;
    }

    if (mode === modes.REGISTER) {
      try {
        await register(formState.email, formState.password, { displayName: formState.displayName });
        finishSuccess();
      } catch (err) {
        console.error("Registration failed", err);
      }
      return;
    }

    if (mode === modes.FORGOT) {
      try {
        await resetPassword(formState.email);
        handleClose();
      } catch (err) {
        console.error("Reset password failed", err);
      }
    }
  };

  const isRegister = mode === modes.REGISTER;

  return (
    <div className="auth-modal__backdrop">
      <div className="auth-modal">
        <button type="button" className="auth-modal__close" onClick={handleClose}>
          ×
        </button>
        <h2 className="auth-modal__title">
          {mode === modes.LOGIN && "Sign In"}
          {mode === modes.REGISTER && "Create Account"}
          {mode === modes.FORGOT && "Reset Password"}
        </h2>
        {error ? (
          <p className="auth-modal__error">
            {getAuthErrorMessage(error, {
              operation: mode === modes.FORGOT ? "reset" : mode,
            })}
          </p>
        ) : null}

        {isRegister ? (
          <SocialLoginButtons
            onSuccess={finishSuccess}
            emphasis="primary"
            leadIn="Continue with Google"
          />
        ) : null}

        {isRegister ? <p className="auth-modal__divider">Or use email</p> : null}

        <form className="auth-modal__form" onSubmit={handleSubmit}>
          {mode === modes.REGISTER && (
            <label className="auth-modal__field">
              <span>Display Name</span>
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                value={formState.displayName}
                onChange={handleChange}
                required
              />
            </label>
          )}
          <label className="auth-modal__field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={handleChange}
              required
            />
          </label>
          {mode !== modes.FORGOT && (
            <label className="auth-modal__field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete={mode === modes.LOGIN ? "current-password" : "new-password"}
                value={formState.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </label>
          )}
          {mode === modes.REGISTER ? <SignupConsent onNavigate={handleClose} /> : null}
          <button type="submit" className="auth-modal__submit">
            {mode === modes.LOGIN && "Sign In"}
            {mode === modes.REGISTER && "Sign Up"}
            {mode === modes.FORGOT && "Send Reset Email"}
          </button>
        </form>

        {mode === modes.LOGIN && (
          <button
            type="button"
            className="auth-modal__link"
            onClick={() => handleModeChange(modes.FORGOT)}
          >
            Forgot password?
          </button>
        )}
        <div className="auth-modal__switcher">
          {mode !== modes.LOGIN ? (
            <button type="button" onClick={() => handleModeChange(modes.LOGIN)}>
              Already have an account? Sign in
            </button>
          ) : (
            <button type="button" onClick={() => handleModeChange(modes.REGISTER)}>
              Need an account? Sign up
            </button>
          )}
        </div>

        {!isRegister ? <SocialLoginButtons onSuccess={finishSuccess} /> : null}
      </div>
    </div>
  );
}

export default AuthModal;
