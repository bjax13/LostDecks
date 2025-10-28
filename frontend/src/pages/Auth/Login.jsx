import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SocialLoginButtons from '../../components/Auth/SocialLoginButtons';

function Login() {
  const { login, error, clearError } = useAuth();
  const [formState, setFormState] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/collections';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      await login(formState.email, formState.password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <h1>Sign in to Lost Tales Marketplace</h1>
      {error ? <p className="auth-page__error">{error.message}</p> : null}
      <form className="auth-page__form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={formState.email}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={formState.password}
            onChange={handleChange}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <div className="auth-page__links">
        <Link to="/auth/forgot">Forgot password?</Link>
        <Link to="/auth/register">Need an account? Sign up</Link>
      </div>
      <SocialLoginButtons />
    </section>
  );
}

export default Login;
