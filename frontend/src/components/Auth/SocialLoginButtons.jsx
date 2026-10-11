import { useAuth } from "../../contexts/AuthContext";

function SocialLoginButtons({ onSuccess, emphasis = "default", leadIn = "Or continue with" }) {
  const { loginWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Google sign-in failed", err);
    }
  };

  const className =
    emphasis === "primary"
      ? "social-login-buttons social-login-buttons--primary"
      : "social-login-buttons";

  return (
    <div className={className}>
      <p>{leadIn}</p>
      <div className="social-login-buttons__group">
        <button type="button" onClick={handleGoogleLogin}>
          Google
        </button>
      </div>
    </div>
  );
}

export default SocialLoginButtons;
