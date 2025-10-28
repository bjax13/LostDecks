import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SocialLoginButtons from '../../components/Auth/SocialLoginButtons';

function Register() {
  const { register, error, clearError } = useAuth();
  const [formState, setFormState] = useState({ displayName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      await register(formState.email, formState.password, { displayName: formState.displayName });
      navigate('/collections', { replace: true });
    } catch (err) {
      console.error('Registration failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <h1>Create your Lost Tales account</h1>
      {error ? <p className="auth-page__error">{error.message}</p> : null}
      <form className="auth-page__form" onSubmit={handleSubmit}>
        <label>
          <span>Display Name</span>
          <input
            name="displayName"
            type="text"
            value={formState.displayName}
            onChange={handleChange}
            required
          />
        </label>
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
            minLength={6}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
      <div className="auth-page__links">
        <Link to="/auth/login">Already have an account? Sign in</Link>
      </div>
      <SocialLoginButtons />
    </section>
  );
}

export default Register;
