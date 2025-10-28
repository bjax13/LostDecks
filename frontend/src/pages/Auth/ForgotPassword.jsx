import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function ForgotPassword() {
  const { resetPassword, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      console.error('Reset password failed', err);
    }
  };

  return (
    <section className="auth-page">
      <h1>Reset your password</h1>
      {error ? <p className="auth-page__error">{error.message}</p> : null}
      {submitted ? (
        <p>Check your inbox for a password reset link.</p>
      ) : (
        <form className="auth-page__form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button type="submit">Send reset email</button>
        </form>
      )}
      <div className="auth-page__links">
        <Link to="/auth/login">Return to sign in</Link>
      </div>
    </section>
  );
}

export default ForgotPassword;
