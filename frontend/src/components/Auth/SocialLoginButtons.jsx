import { useAuth } from '../../contexts/AuthContext';

function SocialLoginButtons({ onSuccess }) {
  const { loginWithGoogle, loginWithGithub } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Google sign-in failed', err);
    }
  };

  const handleGithubLogin = async () => {
    try {
      await loginWithGithub();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('GitHub sign-in failed', err);
    }
  };

  return (
    <div className="social-login-buttons">
      <p>Or continue with</p>
      <div className="social-login-buttons__group">
        <button type="button" onClick={handleGoogleLogin}>
          Google
        </button>
        <button type="button" onClick={handleGithubLogin}>
          GitHub
        </button>
      </div>
    </div>
  );
}

export default SocialLoginButtons;
